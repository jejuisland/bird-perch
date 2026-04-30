import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { parkingApi, heatmapApi } from '../services/api';
import { useMapStore } from '../store/mapStore';

export function useParkingSpots(lat: number | null, lng: number | null) {
  const { setParkingSpots, setHeatmapPoints, openNow, radiusMeters } = useMapStore();

  const spotsQuery = useQuery({
    queryKey: ['parking-spots', lat, lng, openNow, radiusMeters],
    queryFn: () => parkingApi.getNearby(lat!, lng!, radiusMeters, openNow || undefined),
    enabled: lat !== null && lng !== null,
    staleTime: 60_000,
  });

  const heatmapQuery = useQuery({
    queryKey: ['heatmap', lat, lng],
    queryFn: () => heatmapApi.getAggregated(lat!, lng!),
    enabled: lat !== null && lng !== null,
    staleTime: 120_000,
  });

  useEffect(() => {
    if (spotsQuery.data) setParkingSpots(spotsQuery.data);
  }, [spotsQuery.data]);

  useEffect(() => {
    if (heatmapQuery.data) setHeatmapPoints(heatmapQuery.data);
  }, [heatmapQuery.data]);

  return { spotsQuery, heatmapQuery };
}
