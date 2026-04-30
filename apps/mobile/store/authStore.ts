import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@perch/shared';
import { apiClient, authApi, usersApi } from '../services/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  register: (data: {
    name: string;
    email: string;
    mobileNumber?: string;
    age: number;
    vehicleType: string;
    password?: string;
  }) => Promise<void>;

  loginWithPassword: (email: string, password: string) => Promise<void>;

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

async function persistTokensAndLoadUser(
  accessToken: string,
  refreshToken: string,
  set: (partial: Partial<AuthState>) => void,
) {
  await AsyncStorage.setItem('accessToken', accessToken);
  await AsyncStorage.setItem('refreshToken', refreshToken);
  setToken(accessToken);
  const user = await usersApi.me();
  set({ isAuthenticated: true, user });
}

export const useAuthStore = create<AuthState>((set) => ({
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

  register: async (data) => {
    await authApi.register(data);
    // OTP is sent — caller navigates to verify-otp screen
  },

  loginWithPassword: async (email, password) => {
    const { accessToken, refreshToken } = await authApi.loginWithPassword(email, password);
    await persistTokensAndLoadUser(accessToken, refreshToken, set);
  },

  sendOtp: async (email) => {
    await authApi.sendOtp(email);
  },

  verifyOtp: async (email, code) => {
    const { accessToken, refreshToken, isNewUser } = await authApi.verifyOtp(email, code);
    await persistTokensAndLoadUser(accessToken, refreshToken, set);
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
