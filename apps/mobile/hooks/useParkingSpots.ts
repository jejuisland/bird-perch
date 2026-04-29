import { useQuery } from '@tanstack/react-query';
import { parkingApi, heatmapApi } from '../services/api';
import { useMapStore } from '../store/mapStore';

export function useParkingSpots(lat: number | null, lng: number | null) {
  const { setParkingSpots, setHeatmapPoints } = useMapStore();

  const spotsQuery = useQuery({
    queryKey: ['parking-spots', lat, lng],
    queryFn: () => parkingApi.getNearby(lat!, lng!),
    enabled: lat !== null && lng !== null,
    staleTime: 60_000,
    onSuccess: (data) => setParkingSpots(data),
  });

  const heatmapQuery = useQuery({
    queryKey: ['heatmap', lat, lng],
    queryFn: () => heatmapApi.getAggregated(lat!, lng!),
    enabled: lat !== null && lng !== null,
    staleTime: 120_000,
    onSuccess: (data) => setHeatmapPoints(data),
  });

  return { spotsQuery, heatmapQuery };
}
