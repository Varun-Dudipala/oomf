import { useEffect, useRef, useState, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import {
  addNotificationReceivedListener,
  addNotificationResponseListener,
  handleNotificationTap,
  initializePushNotifications,
  setBadgeCount,
} from '../lib/notifications';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

/**
 * Hook to manage push notifications
 * Handles registration, listening for notifications, and badge updates
 */
export function useNotifications() {
  const { user } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingFriendRequests, setPendingFriendRequests] = useState(0);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  // Initialize push notifications when user is authenticated
  useEffect(() => {
    if (user?.id) {
      initializePushNotifications(user.id);
    }
  }, [user?.id]);

  // Set up notification listeners
  useEffect(() => {
    // Listen for notifications received while app is foregrounded
    notificationListener.current = addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
      // You can update state or show in-app notification here
    });

    // Listen for notification taps
    responseListener.current = addNotificationResponseListener(handleNotificationTap);

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  // Update badge count when unread count changes
  useEffect(() => {
    setBadgeCount(unreadCount + pendingFriendRequests);
  }, [unreadCount, pendingFriendRequests]);

  // Subscribe to real-time notifications from Supabase
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('pending-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pending_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const notification = payload.new as {
            id: string;
            type: string;
            title: string;
            body: string;
            data: any;
          };

          // Show local notification immediately for real-time updates
          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: notification.title,
                body: notification.body,
                data: notification.data,
              },
              trigger: null, // Show immediately
            });

            // Mark as sent in the database
            await supabase
              .from('pending_notifications')
              .update({ sent_at: new Date().toISOString() })
              .eq('id', notification.id);
          } catch (err) {
            console.error('Error showing notification:', err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Fetch pending friend requests count
  const fetchPendingRequests = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { count, error } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('addressee_id', user.id)
        .eq('status', 'pending');

      if (!error && count !== null) {
        setPendingFriendRequests(count);
      }
    } catch (err) {
      console.error('Error fetching pending requests:', err);
    }
  }, [user?.id]);

  // Subscribe to friend requests changes
  useEffect(() => {
    if (!user?.id) return;

    fetchPendingRequests();

    const channel = supabase
      .channel('friend-requests-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `addressee_id=eq.${user.id}`,
        },
        () => fetchPendingRequests()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchPendingRequests]);

  return {
    unreadCount,
    setUnreadCount,
    pendingFriendRequests,
  };
}
