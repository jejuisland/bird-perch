import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '../store/authStore';

const queryClient = new QueryClient();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user, hydrate } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuth = segments[0] === '(auth)';
    const profileComplete = !!user?.name;

    if (!isAuthenticated && !inAuth) {
      router.replace('/(auth)/login');
      return;
    }

    // Authenticated + profile done → leave auth group
    if (isAuthenticated && profileComplete && inAuth) {
      router.replace('/(tabs)');
      return;
    }

    // Authenticated + profile incomplete + not on register or verify-otp → send to profile completion
    const authScreens = ['register', 'verify-otp'];
    if (isAuthenticated && !profileComplete && inAuth && !authScreens.includes(segments[1] as string)) {
      router.replace('/(auth)/register');
    }
  }, [isAuthenticated, isLoading, user, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthGuard>
          <Stack screenOptions={{ headerShown: false }} />
        </AuthGuard>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
