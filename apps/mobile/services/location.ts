import * as Location from 'expo-location';
import { heatmapApi } from './api';

let sessionId: string | null = null;

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getCurrentLocation() {
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}

// Starts a passive location watcher that collects anonymized GPS data for heatmap.
// Call once after user grants permission; returns a cleanup function.
export function startPassiveCollection(sid: string): () => void {
  sessionId = sid;
  let lastCollectedAt = 0;
  let dwellStart = Date.now();
  let lastCoords = { latitude: 0, longitude: 0 };

  const COLLECTION_INTERVAL_MS = 30_000; // every 30s
  const MOVEMENT_THRESHOLD_METERS = 20;

  const subscription = Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, timeInterval: 10_000, distanceInterval: 10 },
    (loc) => {
      const now = Date.now();
      const { latitude, longitude } = loc.coords;

      const moved = distance(lastCoords.latitude, lastCoords.longitude, latitude, longitude) > MOVEMENT_THRESHOLD_METERS;
      if (moved) {
        dwellStart = now;
        lastCoords = { latitude, longitude };
      }

      if (now - lastCollectedAt >= COLLECTION_INTERVAL_MS) {
        const dwellSeconds = Math.round((now - dwellStart) / 1000);
        heatmapApi.collect({ latitude, longitude, sessionId: sid, dwellSeconds });
        lastCollectedAt = now;
      }
    },
  );

  return () => {
    subscription.then((sub) => sub.remove());
  };
}

function distance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
