import React, { forwardRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { UrlTile, Marker, Region, Circle } from 'react-native-maps';
import { ParkingSpot } from '@perch/shared';
import { useMapStore } from '../../store/mapStore';
import { OSM_TILE_URL, DEFAULT_REGION, COLORS } from '../../constants';
import HeatmapLayer from './HeatmapLayer';

interface Props {
  userLocation: { latitude: number; longitude: number } | null;
  onRegionChangeComplete: (region: Region) => void;
  onMarkerPress: (spot: ParkingSpot) => void;
}

const ParkingMap = forwardRef<MapView, Props>(
  ({ userLocation, onRegionChangeComplete, onMarkerPress }, ref) => {
    const { parkingSpots, selectedSpot, heatmapEnabled } = useMapStore();

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
        mapType="none" // Required for UrlTile to work as sole map layer
        rotateEnabled={false}
      >
        {/* OpenStreetMap tiles */}
        <UrlTile urlTemplate={OSM_TILE_URL} maximumZ={19} flipY={false} />

        {/* Heatmap overlay */}
        {heatmapEnabled && <HeatmapLayer />}

        {/* Parking markers */}
        {parkingSpots.map((spot) => (
          <Marker
            key={spot.id}
            coordinate={{ latitude: spot.latitude, longitude: spot.longitude }}
            onPress={() => onMarkerPress(spot)}
            pinColor={selectedSpot?.id === spot.id ? COLORS.markerSelected : COLORS.markerDefault}
            title={spot.name}
          />
        ))}
      </MapView>
    );
  },
);

ParkingMap.displayName = 'ParkingMap';
export default ParkingMap;
