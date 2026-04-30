import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@perch/shared';
import { apiClient, authApi, usersApi } from '../services/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sendOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, code: string) => Promise<{ isNewUser: boolean }>;
  completeProfile: (data: {
    name: string;
    mobileNumber: string;
    age: number;
    vehicleType: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

function setToken(token: string) {
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

function clearToken() {
  delete apiClient.defaults.headers.common['Authorization'];
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  hydrate: async () => {
    const token = await AsyncStorage.getItem('accessToken');
    if (!token) {
      set({ isAuthenticated: false, isLoading: false });
      return;
    }
    setToken(token);
    try {
      const user = await usersApi.me();
      set({ isAuthenticated: true, isLoading: false, user });
    } catch {
      clearToken();
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
      set({ isAuthenticated: false, isLoading: false, user: null });
    }
  },

  sendOtp: async (email) => {
    await authApi.sendOtp(email);
  },

  verifyOtp: async (email, code) => {
    const { accessToken, refreshToken, isNewUser } = await authApi.verifyOtp(email, code);
    await AsyncStorage.setItem('accessToken', accessToken);
    await AsyncStorage.setItem('refreshToken', refreshToken);
    setToken(accessToken);
    const user = await usersApi.me();
    set({ isAuthenticated: true, user });
    return { isNewUser };
  },

  completeProfile: async (data) => {
    const user = await usersApi.updateMe(data as Record<string, unknown>);
    set({ user });
  },

  logout: async () => {
    clearToken();
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
    set({ user: null, isAuthenticated: false });
  },
}));
