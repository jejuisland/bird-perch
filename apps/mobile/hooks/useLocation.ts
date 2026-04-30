import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import { requestLocationPermission, getCurrentLocation, startPassiveCollection } from '../services/location';

export function useLocation() {
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stopCollection: (() => void) | null = null;

    (async () => {
      const granted = await requestLocationPermission();
      setHasPermission(granted);
      if (granted) {
        const loc = await getCurrentLocation();
        setCoords(loc);

        let sid = await AsyncStorage.getItem('heatmapSessionId');
        if (!sid) {
          sid = uuidv4();
          await AsyncStorage.setItem('heatmapSessionId', sid);
        }
        stopCollection = startPassiveCollection(sid);
      }
      setLoading(false);
    })();

    return () => {
      if (stopCollection) stopCollection();
    };
  }, []);

  return { coords, hasPermission, loading };
}
