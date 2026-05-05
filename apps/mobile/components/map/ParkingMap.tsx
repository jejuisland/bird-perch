import React, { forwardRef, useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { UrlTile, Marker, Polyline, Region, Circle } from 'react-native-maps';
import { ParkingSpot } from '@perch/shared';
import { useMapStore } from '../../store/mapStore';
import { OSM_TILE_URL, DEFAULT_REGION, COLORS } from '../../constants';
import HeatmapLayer from './HeatmapLayer';
import ParkingMarker from './ParkingMarker';

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

type RouteResult = {
  coords: Coord[];
  distanceM: number;
  durationSec: number;
};

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

type SearchedLocation = { latitude: number; longitude: number; label: string };

export type RouteInfo = { distanceM: number; durationSec: number };

interface Props {
  userLocation: Coord | null;
  onRegionChangeComplete: (region: Region) => void;
  onMarkerPress: (spot: ParkingSpot) => void;
  searchedLocation?: SearchedLocation | null;
  onRouteUpdate?: (info: RouteInfo | null) => void;
  onReroutingChange?: (rerouting: boolean) => void;
}

const ParkingMap = forwardRef<MapView, Props>(
  ({ userLocation, onRegionChangeComplete, onMarkerPress, searchedLocation, onRouteUpdate, onReroutingChange }, ref) => {
    const { parkingSpots, selectedSpot, heatmapEnabled, searchQuery, parkedLocation, radiusMeters } =
      useMapStore();

    const [driveRoute, setDriveRoute] = useState<Coord[]>([]);
    const [walkRoute, setWalkRoute] = useState<Coord[]>([]);

    const driveAbort = useRef<AbortController | null>(null);
    const walkAbort = useRef<AbortController | null>(null);
    // Tracks which spot's initial route has been fetched — used to distinguish re-routes from first fetch
    const routeFetchedForSpot = useRef<string | null>(null);
    // Position where the last OSRM drive-route was fetched from — re-fetch only when moved ≥ 10 m
    const lastDriveFetchCoord = useRef<Coord | null>(null);
    const REROUTE_DISTANCE_M = 10;

    // Driving route — re-fetches when user moves ≥ REROUTE_DISTANCE_M from last fetch point
    useEffect(() => {
      if (!selectedSpot || !userLocation) {
        setDriveRoute([]);
        routeFetchedForSpot.current = null;
        lastDriveFetchCoord.current = null;
        onRouteUpdate?.(null);
        onReroutingChange?.(false);
        return;
      }

      // Skip re-fetch if user hasn't moved far enough from last fetch position
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

      // Show re-routing indicator only after the first route for this spot was already fetched
      const isReRoute = routeFetchedForSpot.current === selectedSpot.id;
      if (isReRoute) {
        onReroutingChange?.(true);
      }

      const fetchFrom = { ...userLocation };
      fetchOsrmRoute(fetchFrom, selectedSpot, 'driving', driveAbort.current.signal)
        .then((result) => {
          setDriveRoute(result.coords);
          onRouteUpdate?.({ distanceM: result.distanceM, durationSec: result.durationSec });
          onReroutingChange?.(false);
          routeFetchedForSpot.current = selectedSpot.id;
          lastDriveFetchCoord.current = fetchFrom;
        })
        .catch(() => {
          onReroutingChange?.(false);
        });
    }, [selectedSpot?.id, userLocation?.latitude, userLocation?.longitude]);

    // Walking route to parked car — re-fetches as user walks
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
    }, [parkedLocation?.latitude, parkedLocation?.longitude, userLocation?.latitude, userLocation?.longitude]);

    const filteredSpots =
      searchedLocation || !searchQuery.trim()
        ? parkingSpots
        : parkingSpots.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const initialRegion = userLocation
      ? { ...userLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 }
      : DEFAULT_REGION;

    return (
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={false}
        mapType="none"
        rotateEnabled={false}
      >
        <UrlTile urlTemplate={OSM_TILE_URL} maximumZ={19} flipY={false} />

        {(searchedLocation ?? userLocation) && (
          <Circle
            center={searchedLocation ?? userLocation!}
            radius={radiusMeters}
            strokeColor="rgba(37, 99, 235, 0.3)"
            strokeWidth={1.5}
            fillColor="rgba(37, 99, 235, 0.05)"
          />
        )}

        {searchedLocation && (
          <Marker
            coordinate={{ latitude: searchedLocation.latitude, longitude: searchedLocation.longitude }}
            anchor={{ x: 0.5, y: 1 }}
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

        {heatmapEnabled && <HeatmapLayer />}

        {/* Driving route — old route stays visible during re-fetch */}
        {driveRoute.length > 1 && (
          <>
            <Polyline coordinates={driveRoute} strokeColor="rgba(255,255,255,0.75)" strokeWidth={8} />
            <Polyline coordinates={driveRoute} strokeColor={COLORS.primary} strokeWidth={5} />
          </>
        )}

        {/* Dashed fallback only on very first fetch (no route yet) */}
        {driveRoute.length === 0 && selectedSpot && userLocation && (
          <Polyline
            coordinates={[
              { latitude: userLocation.latitude, longitude: userLocation.longitude },
              { latitude: selectedSpot.latitude, longitude: selectedSpot.longitude },
            ]}
            strokeColor={COLORS.primary}
            strokeWidth={2}
            lineDashPattern={[6, 5]}
          />
        )}

        {walkRoute.length > 1 && (
          <>
            <Polyline coordinates={walkRoute} strokeColor="rgba(255,255,255,0.75)" strokeWidth={7} />
            <Polyline coordinates={walkRoute} strokeColor="#F97316" strokeWidth={4} />
          </>
        )}

        {walkRoute.length === 0 && parkedLocation && userLocation && (
          <Polyline
            coordinates={[
              { latitude: userLocation.latitude, longitude: userLocation.longitude },
              { latitude: parkedLocation.latitude, longitude: parkedLocation.longitude },
            ]}
            strokeColor="#F97316"
            strokeWidth={2.5}
            lineDashPattern={[8, 6]}
          />
        )}

        {parkedLocation && (
          <Marker
            coordinate={{ latitude: parkedLocation.latitude, longitude: parkedLocation.longitude }}
            title="My Car 🚗"
            description="Your parked car"
            pinColor="#F97316"
          />
        )}

        {filteredSpots.map((spot) => {
          const isSelected = selectedSpot?.id === spot.id;
          return (
            <Marker
              key={`${spot.id}_${isSelected ? 's' : 'd'}`}
              coordinate={{ latitude: spot.latitude, longitude: spot.longitude }}
              onPress={() => onMarkerPress(spot)}
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 1 }}
            >
              <ParkingMarker selected={isSelected} />
            </Marker>
          );
        })}
      </MapView>
    );
  },
);

ParkingMap.displayName = 'ParkingMap';
export default ParkingMap;

const searchPinStyles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
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
