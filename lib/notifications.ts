import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from './supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationData {
  type: 'new_compliment' | 'friend_request' | 'friend_accepted' | 'streak_warning' | 'daily_drop' | 'podium' | 'secret_admirer_message' | 'secret_admirer_revealed';
  complimentId?: string;
  friendRequestId?: string;
  fromUserId?: string;
  rank?: number;
  chatId?: string;
}

/**
 * Register for push notifications and return the Expo push token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Only works on physical devices
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permissions if not granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  // Get the Expo push token
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID, // Set this in your .env
    });

    return tokenData.data;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
}

/**
 * Save the push token to the user's profile in Supabase
 */
export async function savePushToken(userId: string, token: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('users')
      .update({ expo_push_token: token } as any)
      .eq('id', userId);

    if (error) throw error;
    console.log('Push token saved successfully');
  } catch (error) {
    console.error('Error saving push token:', error);
  }
}

/**
 * Remove push token from user profile (on sign out)
 */
export async function removePushToken(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('users')
      .update({ expo_push_token: null } as any)
      .eq('id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Error removing push token:', error);
  }
}

/**
 * Handle notification received while app is in foreground
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Handle notification tap (when user interacts with notification)
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Default handler for notification taps - navigate to relevant screen
 */
export function handleNotificationTap(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data as unknown as NotificationData;

  switch (data?.type) {
    case 'new_compliment':
      if (data.complimentId) {
        router.push(`/compliment/${data.complimentId}`);
      } else {
        router.push('/(tabs)');
      }
      break;

    case 'friend_request':
      router.push('/(tabs)/friends');
      break;

    case 'friend_accepted':
      router.push('/(tabs)/friends');
      break;

    case 'streak_warning':
      router.push('/(tabs)/send');
      break;

    case 'daily_drop':
      router.push('/(tabs)/send');
      break;

    case 'podium':
      router.push('/leaderboard');
      break;

    case 'secret_admirer_message':
    case 'secret_admirer_revealed':
      if (data.chatId) {
        router.push(`/secret-admirer/${data.chatId}`);
      } else if (data.complimentId) {
        router.push(`/compliment/${data.complimentId}`);
      } else {
        router.push('/(tabs)');
      }
      break;

    default:
      router.push('/(tabs)');
  }
}

/**
 * Set the badge count on the app icon (iOS)
 */
export async function setBadgeCount(count: number): Promise<void> {
  if (Platform.OS === 'ios') {
    await Notifications.setBadgeCountAsync(count);
  }
}

/**
 * Clear all delivered notifications
 */
export async function clearAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
}

/**
 * Schedule a local notification (e.g., streak reminder)
 */
export async function scheduleStreakReminder(hour: number = 20): Promise<string | null> {
  // Cancel existing streak reminders first
  await cancelStreakReminder();

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Don't lose your streak! 🔥",
        body: "Send an oomf to keep your streak going!",
        data: { type: 'streak_warning' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute: 0,
      },
    });
    return id;
  } catch (error) {
    console.error('Error scheduling streak reminder:', error);
    return null;
  }
}

/**
 * Cancel streak reminder notification
 */
export async function cancelStreakReminder(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  for (const notification of scheduled) {
    const data = notification.content.data as unknown as NotificationData;
    if (data?.type === 'streak_warning') {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
}

/**
 * Schedule daily drop notification (when new drops are available)
 * Defaults to 9 AM when new daily drops refresh
 */
export async function scheduleDailyDropReminder(hour: number = 9): Promise<string | null> {
  // Cancel existing daily drop reminders first
  await cancelDailyDropReminder();

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "New Daily Drop is Here! 🎁",
        body: "Fresh compliments are waiting! Send oomfs to your friends.",
        data: { type: 'daily_drop' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute: 0,
      },
    });
    return id;
  } catch (error) {
    console.error('Error scheduling daily drop reminder:', error);
    return null;
  }
}

/**
 * Cancel daily drop reminder notification
 */
export async function cancelDailyDropReminder(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  for (const notification of scheduled) {
    const data = notification.content.data as unknown as NotificationData;
    if (data?.type === 'daily_drop') {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
}

/**
 * Show immediate podium notification (called when user makes top 3)
 */
export async function showPodiumNotification(rank: number): Promise<void> {
  const rankEmojis = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const rankNames = { 1: '1st', 2: '2nd', 3: '3rd' };
  const emoji = rankEmojis[rank as keyof typeof rankEmojis] || '🏆';
  const rankName = rankNames[rank as keyof typeof rankNames] || `#${rank}`;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `You Made the Podium! ${emoji}`,
        body: `Congrats! You're ${rankName} on this week's leaderboard! Keep spreading the love.`,
        data: { type: 'podium', rank },
      },
      trigger: null, // Show immediately
    });
  } catch (error) {
    console.error('Error showing podium notification:', error);
  }
}

/**
 * Initialize push notifications for the app
 * Call this in your root layout or auth state change handler
 */
export async function initializePushNotifications(userId: string): Promise<void> {
  // Register for push notifications
  const token = await registerForPushNotifications();

  if (token) {
    // Save token to user profile
    await savePushToken(userId, token);
  }

  // Schedule streak reminder (8 PM daily)
  await scheduleStreakReminder(20);

  // Schedule daily drop reminder (9 AM daily)
  await scheduleDailyDropReminder(9);
}
