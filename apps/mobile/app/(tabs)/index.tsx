import React, { useRef, useCallback, useState, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ParkingMap, { RouteInfo } from '../../components/map/ParkingMap';
import ParkingBottomSheet from '../../components/sheets/ParkingBottomSheet';
import SearchBar from '../../components/ui/SearchBar';
import AdBanner from '../../components/ui/AdBanner';
import RecenterButton from '../../components/ui/RecenterButton';
import HeatmapToggle from '../../components/ui/HeatmapToggle';
import ParkHereButton from '../../components/ui/ParkHereButton';
import MyCarPanel from '../../components/ui/MyCarPanel';
import OpenNowToggle from '../../components/ui/OpenNowToggle';
import RadiusSelector from '../../components/ui/RadiusSelector';
import NavigationBanner from '../../components/ui/NavigationBanner';
import { useLocation } from '../../hooks/useLocation';
import { useParkingSpots } from '../../hooks/useParkingSpots';
import { useMapStore } from '../../store/mapStore';

type SearchedLocation = { latitude: number; longitude: number; label: string };

export default function MapScreen() {
  const { coords } = useLocation();
  const { selectedSpot, setSelectedSpot, loadParkedCar, parkedLocation } = useMapStore();
  const mapRef = useRef<any>(null);
  const [mapCenter, setMapCenter] = useState(coords);
  const [searchedLocation, setSearchedLocation] = useState<SearchedLocation | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isRerouting, setIsRerouting] = useState(false);

  useEffect(() => {
    loadParkedCar();
  }, []);

  // When user has searched a location, always fetch spots around that pin, not the scrolled map center
  useParkingSpots(
    searchedLocation?.latitude ?? mapCenter?.latitude ?? coords?.latitude ?? null,
    searchedLocation?.longitude ?? mapCenter?.longitude ?? coords?.longitude ?? null,
  );

  // Auto-follow user location while navigating to a spot or back to car
  useEffect(() => {
    const navigating = !!selectedSpot || !!parkedLocation;
    if (!navigating || !coords || !mapRef.current) return;

    mapRef.current.animateToRegion(
      {
        ...coords,
        latitudeDelta: 0.008,   // tighter zoom when navigating
        longitudeDelta: 0.008,
      },
      600, // animation duration ms
    );
  }, [coords?.latitude, coords?.longitude]);

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
        searchedLocation={searchedLocation}
        onRegionChangeComplete={(region) =>
          setMapCenter({ latitude: region.latitude, longitude: region.longitude })
        }
        onMarkerPress={(spot) => setSelectedSpot(spot)}
        onRouteUpdate={(info) => setRouteInfo(info)}
        onReroutingChange={(v) => setIsRerouting(v)}
      />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        {/* Search bar at top */}
        <SearchBar
          onLocationSelect={(lat, lng, label) => {
            const loc = { latitude: lat, longitude: lng };
            setSearchedLocation({ ...loc, label });
            setMapCenter(loc);
            mapRef.current?.animateToRegion({
              latitude: lat,
              longitude: lng,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            });
          }}
          onClear={() => setSearchedLocation(null)}
        />

        {/* Navigation banner replaces filter chips while driving to a spot */}
        {selectedSpot && routeInfo ? (
          <NavigationBanner
            spotName={selectedSpot.name}
            distanceM={routeInfo.distanceM}
            durationSec={routeInfo.durationSec}
            isRerouting={isRerouting}
          />
        ) : (
          <View style={styles.filterRow} pointerEvents="box-none">
            <HeatmapToggle />
            <OpenNowToggle />
          </View>
        )}

        {/* Right-side action buttons — absolute */}
        <RecenterButton onPress={handleRecenter} />
        <RadiusSelector />
        <ParkHereButton userLocation={coords} />

        {/* Bottom overlays — absolute */}
        <MyCarPanel userLocation={coords} />
        <AdBanner />
      </SafeAreaView>

      <ParkingBottomSheet
        spot={selectedSpot}
        userLocation={coords}
        onClose={() => { setSelectedSpot(null); setRouteInfo(null); }}
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
});
