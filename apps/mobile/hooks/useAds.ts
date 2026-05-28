import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adsApi, Ad } from '../services/api';

export type { Ad };

export function useAds() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data: ads = [] } = useQuery<Ad[]>({
    queryKey: ['ads'],
    queryFn: adsApi.getActive,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  // Reset to first ad whenever the list changes (e.g. after refetch adds/removes ads)
  useEffect(() => {
    setCurrentIndex(0);
  }, [ads.length]);

  // Auto-advance after each ad's own durationSeconds
  useEffect(() => {
    if (ads.length <= 1) return;
    const duration = (ads[currentIndex]?.durationSeconds ?? 8) * 1000;
    const timer = setTimeout(() => {
      setCurrentIndex((i) => (i + 1) % ads.length);
    }, duration);
    return () => clearTimeout(timer);
  }, [currentIndex, ads]);

  return {
    ads,
    currentAd: ads[currentIndex] ?? null,
    currentIndex,
    setCurrentIndex,
  };
}
