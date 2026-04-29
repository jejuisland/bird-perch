import { useState, useEffect } from 'react';
import { requestLocationPermission, getCurrentLocation } from '../services/location';

export function useLocation() {
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const granted = await requestLocationPermission();
      setHasPermission(granted);
      if (granted) {
        const loc = await getCurrentLocation();
        setCoords(loc);
      }
      setLoading(false);
    })();
  }, []);

  return { coords, hasPermission, loading };
}
