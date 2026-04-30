import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import { requestLocationPermission, startPassiveCollection } from '../services/location';

const MIN_UPDATE_DISTANCE_M = 20; // only update state when moved ≥ 20 m
const MIN_UPDATE_INTERVAL_MS = 4_000; // and at least 4 s between updates

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useLocation() {
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(true);

  const lastUpdate = useRef<number>(0);
  const lastCoords = useRef<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    let stopPassive: (() => void) | null = null;
    let watchSub: Location.LocationSubscription | null = null;

    (async () => {
      const granted = await requestLocationPermission();
      setHasPermission(granted);

      if (!granted) {
        setLoading(false);
        return;
      }

      // Get initial position immediately
      const initial = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const initCoords = {
        latitude: initial.coords.latitude,
        longitude: initial.coords.longitude,
      };
      setCoords(initCoords);
      lastCoords.current = initCoords;
      lastUpdate.current = Date.now();
      setLoading(false);

      // Start heatmap passive collection
      let sid = await AsyncStorage.getItem('heatmapSessionId');
      if (!sid) {
        sid = uuidv4();
        await AsyncStorage.setItem('heatmapSessionId', sid);
      }
      stopPassive = startPassiveCollection(sid);

      // Continuous position watcher — updates coords as user moves
      watchSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3_000,      // poll every 3s
          distanceInterval: 10,     // or every 10m moved
        },
        (loc) => {
          const now = Date.now();
          const { latitude, longitude } = loc.coords;

          const moved =
            lastCoords.current
              ? haversineMeters(lastCoords.current.latitude, lastCoords.current.longitude, latitude, longitude)
              : 9999;

          // Only push a state update if moved enough AND enough time has passed
          if (moved >= MIN_UPDATE_DISTANCE_M && now - lastUpdate.current >= MIN_UPDATE_INTERVAL_MS) {
            lastCoords.current = { latitude, longitude };
            lastUpdate.current = now;
            setCoords({ latitude, longitude });
          }
        },
      );
    })();

    return () => {
      stopPassive?.();
      watchSub?.remove();
    };
  }, []);

  return { coords, hasPermission, loading };
}
