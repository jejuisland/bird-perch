import React, { useRef, useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ParkingMap from '../../components/map/ParkingMap';
import ParkingBottomSheet from '../../components/sheets/ParkingBottomSheet';
import SearchBar from '../../components/ui/SearchBar';
import AdBanner from '../../components/ui/AdBanner';
import RecenterButton from '../../components/ui/RecenterButton';
import HeatmapToggle from '../../components/ui/HeatmapToggle';
import { useLocation } from '../../hooks/useLocation';
import { useParkingSpots } from '../../hooks/useParkingSpots';
import { useMapStore } from '../../store/mapStore';

export default function MapScreen() {
  const { coords } = useLocation();
  const { selectedSpot, setSelectedSpot } = useMapStore();
  const mapRef = useRef<any>(null);
  const [mapCenter, setMapCenter] = useState(coords);

  useParkingSpots(mapCenter?.latitude ?? coords?.latitude ?? null, mapCenter?.longitude ?? coords?.longitude ?? null);

  const handleRecenter = useCallback(() => {
    if (coords && mapRef.current) {
      mapRef.current.animateToRegion({
        ...coords,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    }
  }, [coords]);

  return (
    <View style={styles.container}>
      <ParkingMap
        ref={mapRef}
        userLocation={coords}
        onRegionChangeComplete={(region) =>
          setMapCenter({ latitude: region.latitude, longitude: region.longitude })
        }
        onMarkerPress={(spot) => setSelectedSpot(spot)}
      />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <SearchBar />
        <HeatmapToggle />
        <RecenterButton onPress={handleRecenter} />
        <AdBanner />
      </SafeAreaView>

      <ParkingBottomSheet
        spot={selectedSpot}
        onClose={() => setSelectedSpot(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'box-none',
  },
});
