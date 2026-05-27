import React, { forwardRef, useState, useEffect, useRef, useImperativeHandle, useMemo } from 'react';
import { StyleSheet, View, Text, Image } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline, Circle } from 'react-native-maps';
import { ParkingSpot } from '@perch/shared';
import { useMapStore } from '../../store/mapStore';
import { DEFAULT_REGION, COLORS } from '../../constants';
import HeatmapLayer from './HeatmapLayer';

const PIN_LOGO = require('../../assets/logo.png');
const PIN_UNVERIFIED = require('../../assets/pin-marker-unverified.png');

type Coord = { latitude: number; longitude: number };

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type RouteResult = { coords: Coord[]; distanceM: number; durationSec: number };

async function fetchOsrmRoute(
  from: Coord,
  to: Coord,
  profile: 'driving' | 'foot' = 'driving',
  signal?: AbortSignal,
): Promise<RouteResult> {
  const url =
    `https://router.project-osrm.org/route/v1/${profile}/` +
    `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
    `?geometries=geojson&overview=full`;
  const res = await fetch(url, { signal });
  const json = await res.json();
  const route = json?.routes?.[0];
  const rawCoords: [number, number][] = route?.geometry?.coordinates ?? [];
  return {
    coords: rawCoords.map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
    distanceM: route?.distance ?? 0,
    durationSec: route?.duration ?? 0,
  };
}

// Google Maps SDK on Android captures a bitmap of the marker's View children.
// tracksViewChanges=true means it recaptures every frame (expensive but necessary until image is drawn).
// We flip to false only after onLoad fires (image pixels are decoded + painted to the surface).
// A 500ms timeout acts as a safety net in case onLoad is delayed.
const SpotMarker = React.memo(function SpotMarker({
  spot,
  onPress,
}: {
  spot: ParkingSpot;
  onPress: (s: ParkingSpot) => void;
}) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <Marker
      coordinate={{ latitude: Number(spot.latitude), longitude: Number(spot.longitude) }}
      onPress={() => onPress(spot)}
      tracksViewChanges={tracksViewChanges}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={styles.markerWrap}>
        <Image
          source={spot.communityVerification === 'unverified' ? PIN_UNVERIFIED : PIN_LOGO}
          style={styles.markerImage}
          resizeMode="contain"
          fadeDuration={0}
          onLoad={() => setTracksViewChanges(false)}
        />
      </View>
    </Marker>
  );
});

type SearchedLocation = { latitude: number; longitude: number; label: string };
export type RouteInfo = { distanceM: number; durationSec: number };

export interface MapHandle {
  animateToRegion(
    region: { latitude: number; longitude: number; latitudeDelta?: number; longitudeDelta?: number },
    duration?: number,
  ): void;
}

interface Props {
  userLocation: Coord | null;
  onRegionChangeComplete: (region: { latitude: number; longitude: number }) => void;
  onMarkerPress: (spot: ParkingSpot) => void;
  searchedLocation?: SearchedLocation | null;
  onRouteUpdate?: (info: RouteInfo | null) => void;
  onReroutingChange?: (rerouting: boolean) => void;
}

const REROUTE_DISTANCE_M = 10;

const ParkingMap = forwardRef<MapHandle, Props>(
  (
    { userLocation, onRegionChangeComplete, onMarkerPress, searchedLocation, onRouteUpdate, onReroutingChange },
    ref,
  ) => {
    const { parkingSpots, selectedSpot, heatmapEnabled, searchQuery, parkedLocation, radiusMeters } =
      useMapStore();

    const mapRef = useRef<MapView>(null);
    const navigating = !!(selectedSpot || parkedLocation);
    const navigatingRef = useRef(navigating);
    const hasAutocentered = useRef(false);
    const [driveRoute, setDriveRoute] = useState<Coord[]>([]);
    const [walkRoute, setWalkRoute] = useState<Coord[]>([]);
    const driveAbort = useRef<AbortController | null>(null);
    const walkAbort = useRef<AbortController | null>(null);
    const routeFetchedForSpot = useRef<string | null>(null);
    const lastDriveFetchCoord = useRef<Coord | null>(null);

    useEffect(() => { navigatingRef.current = navigating; }, [navigating]);

    useImperativeHandle(ref, () => ({
      animateToRegion: (region, duration = 500) => {
        mapRef.current?.animateToRegion(
          {
            latitude: region.latitude,
            longitude: region.longitude,
            latitudeDelta: region.latitudeDelta ?? 0.01,
            longitudeDelta: region.longitudeDelta ?? 0.01,
          },
          duration,
        );
      },
    }));

    // Fly to user's location the first time GPS resolves
    useEffect(() => {
      if (!userLocation || hasAutocentered.current || !mapRef.current) return;
      hasAutocentered.current = true;
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        800,
      );
    }, [userLocation]);

    // Center camera when navigation starts
    useEffect(() => {
      if (!navigating || !userLocation || !mapRef.current) return;
      mapRef.current.animateCamera(
        { center: { latitude: userLocation.latitude, longitude: userLocation.longitude }, zoom: 16 },
        { duration: 400 },
      );
    }, [navigating]);

    // Driving route
    useEffect(() => {
      if (!selectedSpot || !userLocation) {
        setDriveRoute([]);
        routeFetchedForSpot.current = null;
        lastDriveFetchCoord.current = null;
        onRouteUpdate?.(null);
        onReroutingChange?.(false);
        return;
      }
      if (lastDriveFetchCoord.current) {
        const moved = haversineMeters(
          lastDriveFetchCoord.current.latitude,
          lastDriveFetchCoord.current.longitude,
          userLocation.latitude,
          userLocation.longitude,
        );
        if (moved < REROUTE_DISTANCE_M) return;
      }
      driveAbort.current?.abort();
      driveAbort.current = new AbortController();
      const isReRoute = routeFetchedForSpot.current === selectedSpot.id;
      if (isReRoute) onReroutingChange?.(true);
      const fetchFrom = { ...userLocation };
      const dest = { latitude: Number(selectedSpot.latitude), longitude: Number(selectedSpot.longitude) };
      fetchOsrmRoute(fetchFrom, dest, 'driving', driveAbort.current.signal)
        .then((result) => {
          setDriveRoute(result.coords);
          onRouteUpdate?.({ distanceM: result.distanceM, durationSec: result.durationSec });
          onReroutingChange?.(false);
          routeFetchedForSpot.current = selectedSpot.id;
          lastDriveFetchCoord.current = fetchFrom;
        })
        .catch(() => onReroutingChange?.(false));
    }, [selectedSpot?.id, userLocation?.latitude, userLocation?.longitude]);

    // Walking route to parked car
    useEffect(() => {
      if (!parkedLocation || !userLocation) {
        setWalkRoute([]);
        return;
      }
      walkAbort.current?.abort();
      walkAbort.current = new AbortController();
      fetchOsrmRoute(userLocation, parkedLocation, 'foot', walkAbort.current.signal)
        .then((result) => setWalkRoute(result.coords))
        .catch(() => setWalkRoute([]));
    }, [
      parkedLocation?.latitude,
      parkedLocation?.longitude,
      userLocation?.latitude,
      userLocation?.longitude,
    ]);

    const filteredSpots = useMemo(
      () =>
        searchedLocation || !searchQuery.trim()
          ? parkingSpots
          : parkingSpots.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase())),
      [parkingSpots, searchedLocation, searchQuery],
    );

    const radiusCenter = searchedLocation ?? userLocation;

    const initialRegion = {
      latitude: userLocation?.latitude ?? DEFAULT_REGION.latitude,
      longitude: userLocation?.longitude ?? DEFAULT_REGION.longitude,
      latitudeDelta: userLocation ? 0.05 : DEFAULT_REGION.latitudeDelta,
      longitudeDelta: userLocation ? 0.05 : DEFAULT_REGION.longitudeDelta,
    };

    return (
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        rotateEnabled={false}
        onMapReady={() => {
          const lat = userLocation?.latitude ?? DEFAULT_REGION.latitude;
          const lng = userLocation?.longitude ?? DEFAULT_REGION.longitude;
          onRegionChangeComplete({ latitude: lat, longitude: lng });
        }}
        onRegionChangeComplete={(region) => {
          onRegionChangeComplete({ latitude: region.latitude, longitude: region.longitude });
        }}
        onUserLocationChange={(e) => {
          if (!navigatingRef.current || !mapRef.current) return;
          const coord = e.nativeEvent.coordinate;
          if (!coord) return;
          mapRef.current.animateCamera(
            { center: { latitude: coord.latitude, longitude: coord.longitude }, zoom: 16 },
            { duration: 200 },
          );
        }}
      >
        {/* Search radius ring */}
        {radiusCenter && (
          <Circle
            center={{ latitude: radiusCenter.latitude, longitude: radiusCenter.longitude }}
            radius={radiusMeters}
            fillColor="rgba(37,99,235,0.08)"
            strokeColor="rgba(37,99,235,0.5)"
            strokeWidth={2}
          />
        )}

        {/* Parking spot markers */}
        {filteredSpots.map((spot) => (
          <SpotMarker key={spot.id} spot={spot} onPress={onMarkerPress} />
        ))}

        {/* Heatmap overlay */}
        {heatmapEnabled && <HeatmapLayer />}

        {/* Drive route */}
        {driveRoute.length > 1 && (
          <>
            <Polyline
              coordinates={driveRoute}
              strokeColor="#FFFFFF"
              strokeWidth={9}
              zIndex={10}
            />
            <Polyline
              coordinates={driveRoute}
              strokeColor={COLORS.primary}
              strokeWidth={5}
              zIndex={11}
            />
          </>
        )}

        {/* Drive dash while fetch is in flight */}
        {driveRoute.length === 0 && selectedSpot && userLocation && (
          <Polyline
            coordinates={[
              userLocation,
              { latitude: Number(selectedSpot.latitude), longitude: Number(selectedSpot.longitude) },
            ]}
            strokeColor={COLORS.primary}
            strokeWidth={2}
            lineDashPattern={[6, 6]}
            zIndex={10}
          />
        )}

        {/* Walk route to parked car */}
        {walkRoute.length > 1 && (
          <>
            <Polyline
              coordinates={walkRoute}
              strokeColor="#FFFFFF"
              strokeWidth={8}
              zIndex={10}
            />
            <Polyline
              coordinates={walkRoute}
              strokeColor={COLORS.walkRoute}
              strokeWidth={4}
              zIndex={11}
            />
          </>
        )}

        {/* Walk dash */}
        {walkRoute.length === 0 && parkedLocation && userLocation && (
          <Polyline
            coordinates={[userLocation, parkedLocation]}
            strokeColor={COLORS.walkRoute}
            strokeWidth={2.5}
            lineDashPattern={[6, 6]}
            zIndex={10}
          />
        )}

        {/* Parked car marker */}
        {parkedLocation && (
          <Marker coordinate={parkedLocation} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <Text style={styles.carIcon}>🚗</Text>
          </Marker>
        )}

        {/* Search location pin */}
        {searchedLocation && (
          <Marker
            coordinate={{ latitude: searchedLocation.latitude, longitude: searchedLocation.longitude }}
            anchor={{ x: 0.5, y: 1.0 }}
            tracksViewChanges={false}
          >
            <View style={searchPinStyles.wrapper}>
              <View style={searchPinStyles.bubble}>
                <Text style={searchPinStyles.icon}>🔍</Text>
                <Text style={searchPinStyles.label} numberOfLines={1}>
                  {searchedLocation.label}
                </Text>
              </View>
              <View style={searchPinStyles.stem} />
            </View>
          </Marker>
        )}
      </MapView>
    );
  },
);

ParkingMap.displayName = 'ParkingMap';
export default ParkingMap;

const styles = StyleSheet.create({
  markerWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  markerImage: { width: 44, height: 44 },
  carIcon: { fontSize: 28 },
});

const searchPinStyles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    maxWidth: 160,
  },
  icon: { fontSize: 12 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.primary, flexShrink: 1 },
  stem: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: COLORS.primary,
    marginTop: -1,
  },
});
