import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ParkingSpot, HeatmapPoint } from '@perch/shared';

const PARKED_CAR_KEY = 'perch_parked_car';

export interface ParkedLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
}

interface MapState {
  selectedSpot: ParkingSpot | null;
  heatmapEnabled: boolean;
  heatmapPoints: HeatmapPoint[];
  parkingSpots: ParkingSpot[];
  searchQuery: string;
  parkedLocation: ParkedLocation | null;
  openNow: boolean;
  radiusMeters: number;

  setSelectedSpot: (spot: ParkingSpot | null) => void;
  toggleHeatmap: () => void;
  setHeatmapPoints: (points: HeatmapPoint[]) => void;
  setParkingSpots: (spots: ParkingSpot[]) => void;
  setSearchQuery: (query: string) => void;
  toggleOpenNow: () => void;
  setRadius: (meters: number) => void;
  parkCar: (loc: { latitude: number; longitude: number }) => Promise<void>;
  clearParkedCar: () => Promise<void>;
  loadParkedCar: () => Promise<void>;
}

export const useMapStore = create<MapState>((set) => ({
  selectedSpot: null,
  heatmapEnabled: true,
  heatmapPoints: [],
  parkingSpots: [],
  searchQuery: '',
  parkedLocation: null,
  openNow: false,
  radiusMeters: 3000,

  setSelectedSpot: (spot) => set({ selectedSpot: spot }),
  toggleHeatmap: () => set((s) => ({ heatmapEnabled: !s.heatmapEnabled })),
  setHeatmapPoints: (points) => set({ heatmapPoints: points }),
  setParkingSpots: (spots) => set({ parkingSpots: spots }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleOpenNow: () => set((s) => ({ openNow: !s.openNow })),
  setRadius: (meters) => set({ radiusMeters: meters }),

  parkCar: async (loc) => {
    const parkedLocation: ParkedLocation = { ...loc, timestamp: Date.now() };
    set({ parkedLocation });
    await AsyncStorage.setItem(PARKED_CAR_KEY, JSON.stringify(parkedLocation));
  },

  clearParkedCar: async () => {
    set({ parkedLocation: null });
    await AsyncStorage.removeItem(PARKED_CAR_KEY);
  },

  loadParkedCar: async () => {
    const raw = await AsyncStorage.getItem(PARKED_CAR_KEY);
    if (raw) set({ parkedLocation: JSON.parse(raw) });
  },
}));
