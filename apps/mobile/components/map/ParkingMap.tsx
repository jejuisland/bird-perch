import React, { forwardRef, useState, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { UrlTile, Marker, Polyline, Region, Circle } from 'react-native-maps';
import { ParkingSpot } from '@perch/shared';
import { useMapStore } from '../../store/mapStore';
import { OSM_TILE_URL, DEFAULT_REGION, COLORS } from '../../constants';
import HeatmapLayer from './HeatmapLayer';
import ParkingMarker from './ParkingMarker';

type Coord = { latitude: number; longitude: number };

// Fetches a road-following route from OSRM (free, no key required).
// profile: 'driving' | 'foot' | 'cycling'
async function fetchOsrmRoute(
  from: Coord,
  to: Coord,
  profile: 'driving' | 'foot' = 'driving',
  signal?: AbortSignal,
): Promise<Coord[]> {
  const url =
    `https://router.project-osrm.org/route/v1/${profile}/` +
    `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
    `?geometries=geojson&overview=full`;

  const res = await fetch(url, { signal });
  const json = await res.json();

  const coords: [number, number][] = json?.routes?.[0]?.geometry?.coordinates ?? [];
  // OSRM returns [lng, lat] — flip to { latitude, longitude }
  return coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
}

interface Props {
  userLocation: Coord | null;
  onRegionChangeComplete: (region: Region) => void;
  onMarkerPress: (spot: ParkingSpot) => void;
}

const ParkingMap = forwardRef<MapView, Props>(
  ({ userLocation, onRegionChangeComplete, onMarkerPress }, ref) => {
    const { parkingSpots, selectedSpot, heatmapEnabled, searchQuery, parkedLocation, radiusMeters } =
      useMapStore();

    const [driveRoute, setDriveRoute] = useState<Coord[]>([]);
    const [walkRoute, setWalkRoute] = useState<Coord[]>([]);

    const driveAbort = useRef<AbortController | null>(null);
    const walkAbort = useRef<AbortController | null>(null);

    // Fetch driving route to selected parking spot
    useEffect(() => {
      if (!selectedSpot || !userLocation) {
        setDriveRoute([]);
        return;
      }

      driveAbort.current?.abort();
      driveAbort.current = new AbortController();

      fetchOsrmRoute(userLocation, selectedSpot, 'driving', driveAbort.current.signal)
        .then(setDriveRoute)
        .catch(() => setDriveRoute([])); // fallback to nothing on error
    }, [selectedSpot?.id, userLocation?.latitude, userLocation?.longitude]);

    // Fetch walking route back to parked car
    useEffect(() => {
      if (!parkedLocation || !userLocation) {
        setWalkRoute([]);
        return;
      }

      walkAbort.current?.abort();
      walkAbort.current = new AbortController();

      fetchOsrmRoute(userLocation, parkedLocation, 'foot', walkAbort.current.signal)
        .then(setWalkRoute)
        .catch(() => setWalkRoute([]));
    }, [parkedLocation?.latitude, parkedLocation?.longitude, userLocation?.latitude, userLocation?.longitude]);

    const filteredSpots = searchQuery.trim()
      ? parkingSpots.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : parkingSpots;

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
        {/* OpenStreetMap tiles */}
        <UrlTile urlTemplate={OSM_TILE_URL} maximumZ={19} flipY={false} />

        {/* Search radius circle */}
        {userLocation && (
          <Circle
            center={userLocation}
            radius={radiusMeters}
            strokeColor="rgba(37, 99, 235, 0.25)"
            strokeWidth={1.5}
            fillColor="rgba(37, 99, 235, 0.04)"
          />
        )}

        {/* Heatmap overlay */}
        {heatmapEnabled && <HeatmapLayer />}

        {/* ── Driving route to selected parking spot ── */}
        {driveRoute.length > 1 && (
          <>
            {/* White outline for contrast against OSM tiles */}
            <Polyline
              coordinates={driveRoute}
              strokeColor="rgba(255,255,255,0.75)"
              strokeWidth={8}
            />
            {/* Blue route */}
            <Polyline
              coordinates={driveRoute}
              strokeColor={COLORS.primary}
              strokeWidth={5}
            />
          </>
        )}

        {/* Fallback straight line if OSRM hasn't responded yet */}
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

        {/* ── Walking route to parked car ── */}
        {walkRoute.length > 1 && (
          <>
            <Polyline
              coordinates={walkRoute}
              strokeColor="rgba(255,255,255,0.75)"
              strokeWidth={7}
            />
            <Polyline
              coordinates={walkRoute}
              strokeColor="#F97316"
              strokeWidth={4}
            />
          </>
        )}

        {/* Fallback straight line to car while OSRM loads */}
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

        {/* Parked car marker */}
        {parkedLocation && (
          <Marker
            coordinate={{ latitude: parkedLocation.latitude, longitude: parkedLocation.longitude }}
            title="My Car 🚗"
            description="Your parked car"
            pinColor="#F97316"
          />
        )}

        {/* Parking spot markers */}
        {filteredSpots.map((spot) => {
          const isSelected = selectedSpot?.id === spot.id;
          return (
            <Marker
              key={spot.id}
              coordinate={{ latitude: spot.latitude, longitude: spot.longitude }}
              onPress={() => onMarkerPress(spot)}
              tracksViewChanges={isSelected}
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
