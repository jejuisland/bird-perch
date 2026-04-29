import { create } from 'zustand';
import { ParkingSpot, HeatmapPoint } from '@perch/shared';

interface MapState {
  selectedSpot: ParkingSpot | null;
  heatmapEnabled: boolean;
  heatmapPoints: HeatmapPoint[];
  parkingSpots: ParkingSpot[];
  searchQuery: string;
  setSelectedSpot: (spot: ParkingSpot | null) => void;
  toggleHeatmap: () => void;
  setHeatmapPoints: (points: HeatmapPoint[]) => void;
  setParkingSpots: (spots: ParkingSpot[]) => void;
  setSearchQuery: (query: string) => void;
}

export const useMapStore = create<MapState>((set) => ({
  selectedSpot: null,
  heatmapEnabled: true,
  heatmapPoints: [],
  parkingSpots: [],
  searchQuery: '',

  setSelectedSpot: (spot) => set({ selectedSpot: spot }),
  toggleHeatmap: () => set((s) => ({ heatmapEnabled: !s.heatmapEnabled })),
  setHeatmapPoints: (points) => set({ heatmapPoints: points }),
  setParkingSpots: (spots) => set({ parkingSpots: spots }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));
