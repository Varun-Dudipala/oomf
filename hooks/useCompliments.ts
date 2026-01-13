import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import {
  checkRateLimit,
  recordRateLimitAction,
  checkFriendCooldown,
  recordFriendCompliment,
  getRemainingCompliments,
} from '../lib/rateLimit';
import type { Compliment, Template, User } from '../types/database';

export type ComplimentWithDetails = Compliment & {
  template: Template;
  sender?: User;
};

export function useCompliments() {
  const { user, fetchUserProfile } = useAuthStore();
  const [received, setReceived] = useState<ComplimentWithDetails[]>([]);
  const [sent, setSent] = useState<ComplimentWithDetails[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompliments = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      // Fetch received compliments
      const { data: receivedData, error: receivedError } = await supabase
        .from('compliments')
        .select(`
          *,
          template:templates(*),
          sender:users!compliments_sender_id_fkey(*)
        `)
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false });

      if (receivedError) throw receivedError;

      // Fetch sent compliments
      const { data: sentData, error: sentError } = await supabase
        .from('compliments')
        .select(`
          *,
          template:templates(*),
          receiver:users!compliments_receiver_id_fkey(*)
        `)
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false });

      if (sentError) throw sentError;

      // Process received - hide sender unless revealed
      const processedReceived = receivedData?.map((c: any) => ({
        ...c,
        sender: c.is_revealed ? c.sender : undefined,
      })) || [];

      setReceived(processedReceived);
      setSent(sentData || []);
      setUnreadCount(processedReceived.filter((c: any) => !c.is_read).length);
    } catch (err: any) {
      console.error('Error fetching compliments:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Send a compliment (with rate limiting)
  const sendCompliment = async (receiverId: string, templateId: string) => {
    if (!user) throw new Error('Not authenticated');

    // Check for blocks between users
    const { data: blockExists } = await supabase
      .from('blocked_users')
      .select('id')
      .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${receiverId}),and(blocker_id.eq.${receiverId},blocked_id.eq.${user.id})`)
      .maybeSingle();

    if (blockExists) {
      throw new Error('Unable to send compliment to this user');
    }

    // Check daily rate limit
    const rateCheck = await checkRateLimit('sendCompliment', user.id);
    if (!rateCheck.allowed) {
      throw new Error(rateCheck.message || 'Daily limit reached. Try again tomorrow.');
    }

    // Check cooldown for this specific friend
    const cooldownCheck = await checkFriendCooldown(user.id, receiverId);
    if (!cooldownCheck.allowed) {
      throw new Error(cooldownCheck.message || 'Please wait before sending another oomf to this friend.');
    }

    // Use the RPC function we created
    const { data, error } = await supabase.rpc('send_compliment' as any, {
      p_receiver_id: receiverId,
      p_template_id: templateId,
    });

    if (error) throw error;

    // Record rate limit action and cooldown
    await recordRateLimitAction('sendCompliment', user.id);
    await recordFriendCompliment(user.id, receiverId);

    // Refresh data
    await fetchCompliments();
    await fetchUserProfile();

    return data;
  };

  // Get remaining compliments for today
  const getDailyRemaining = async () => {
    if (!user) return 0;
    return getRemainingCompliments(user.id);
  };

  // Mark as read
  const markAsRead = async (complimentId: string) => {
    const { error } = await supabase
      .from('compliments')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      } as any)
      .eq('id', complimentId);

    if (error) throw error;

    // Update local state
    setReceived((prev) =>
      prev.map((c) =>
        c.id === complimentId ? { ...c, is_read: true, read_at: new Date().toISOString() } : c
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  // Make a guess
  const makeGuess = async (complimentId: string, guessedUserId: string) => {
    if (!user) throw new Error('Not authenticated');

    const { data: isCorrect, error } = await supabase.rpc('make_guess' as any, {
      p_compliment_id: complimentId,
      p_guessed_user_id: guessedUserId,
    });

    if (error) throw error;

    // Refresh to get updated compliment state
    await fetchCompliments();
    await fetchUserProfile();

    return isCorrect as boolean;
  };

  // Get single compliment with full details
  const getCompliment = async (complimentId: string): Promise<ComplimentWithDetails> => {
    const { data, error } = await supabase
      .from('compliments')
      .select(`
        *,
        template:templates(*),
        sender:users!compliments_sender_id_fkey(*),
        guesses(*)
      `)
      .eq('id', complimentId)
      .single();

    if (error) throw error;

    const complimentData = data as any;

    // Hide sender if not revealed
    return {
      ...complimentData,
      sender: complimentData.is_revealed ? complimentData.sender : undefined,
    };
  };

  // Initial fetch
  useEffect(() => {
    fetchCompliments();
  }, [fetchCompliments]);

  // Real-time subscription for new compliments
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('compliments-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'compliments',
          filter: `receiver_id=eq.${user.id}`,
        },
        () => fetchCompliments()
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'compliments',
          filter: `receiver_id=eq.${user.id}`,
        },
        () => fetchCompliments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchCompliments]);

  return {
    received,
    sent,
    unreadCount,
    isLoading,
    error,
    refetch: fetchCompliments,
    sendCompliment,
    markAsRead,
    makeGuess,
    getCompliment,
    getDailyRemaining,
  };
}
