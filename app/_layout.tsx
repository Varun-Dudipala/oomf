import { useEffect } from 'react';
import { Stack, router, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { useAuthStore } from '../store/authStore';
import { useNotifications } from '../hooks/useNotifications';
import { colors } from '../lib/constants';

export default function RootLayout() {
  const { initialize, isLoading, isInitialized, session } = useAuthStore();
  const navigationState = useRootNavigationState();

  // Initialize push notifications (handles registration when user is authenticated)
  useNotifications();

  useEffect(() => {
    initialize();
  }, []);

  // Handle deep links
  useEffect(() => {
    // Only handle deep links after navigation is ready and user is authenticated
    if (!navigationState?.key || !session) return;

    const handleDeepLink = (event: { url: string }) => {
      const { url } = event;
      console.log('Deep link received:', url);

      // Parse the URL
      const parsed = Linking.parse(url);
      console.log('Parsed deep link:', parsed);

      // Handle different paths
      if (parsed.path) {
        const pathParts = parsed.path.split('/').filter(Boolean);

        if (pathParts[0] === 'user' && pathParts[1]) {
          // Navigate to user profile: oomf://user/username
          router.push(`/user/${pathParts[1]}`);
        } else if (pathParts[0] === 'compliment' && pathParts[1]) {
          // Navigate to compliment detail: oomf://compliment/id
          router.push(`/compliment/${pathParts[1]}`);
        } else if (pathParts[0] === 'friends') {
          // Navigate to friends tab: oomf://friends
          router.push('/(tabs)/friends');
        }
      }
    };

    // Listen for incoming links
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check if app was opened via a link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [navigationState?.key, session]);

  // Show loading screen while initializing
  if (!isInitialized || isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="compliment/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="user/[username]" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="leaderboard/index" options={{ headerShown: false }} />
          <Stack.Screen name="shop/index" options={{ headerShown: false }} />
          <Stack.Screen name="secret-admirer/[id]" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="light" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
