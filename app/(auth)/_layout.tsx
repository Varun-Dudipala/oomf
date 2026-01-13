import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../lib/constants';

export default function AuthLayout() {
  const { session, user } = useAuthStore();

  // If user has session and profile, redirect to main app
  if (session && user) {
    return <Redirect href="/(tabs)" />;
  }

  // If user has session but no profile, they need to complete onboarding
  // This is handled in the auth flow

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="email" options={{ headerShown: false }} />
      <Stack.Screen name="verify" options={{ headerShown: false }} />
      <Stack.Screen name="username" options={{ headerShown: false }} />
      <Stack.Screen name="profile-setup" options={{ headerShown: false }} />
      <Stack.Screen name="add-friends" options={{ headerShown: false }} />
    </Stack>
  );
}
