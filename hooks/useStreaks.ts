import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export type StreakStatus = {
  current_streak: number;
  best_streak: number;
  freezes_available: number;
  last_activity_date: string | null;
  is_at_risk: boolean;
  milestones_achieved: number[];
};

export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 365];
export const STREAK_FREEZE_COST = 5;

export const MILESTONE_REWARDS = {
  3: { name: 'Getting Started', emoji: '🌱', tokens: 1 },
  7: { name: 'Week Warrior', emoji: '🔥', tokens: 2 },
  14: { name: 'Two Week Titan', emoji: '💪', tokens: 3 },
  30: { name: 'Monthly Master', emoji: '🏆', tokens: 5 },
  60: { name: 'Dedication', emoji: '⭐', tokens: 8 },
  100: { name: 'Centurion', emoji: '👑', tokens: 15 },
  365: { name: 'Legendary', emoji: '💎', tokens: 50 },
};

export function useStreaks() {
  const { user, fetchUserProfile } = useAuthStore();
  const [streakStatus, setStreakStatus] = useState<StreakStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStreakStatus = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.rpc(
        'get_streak_status' as any,
        { p_user_id: user.id }
      );

      if (fetchError) {
        // Fallback to basic streak from user profile
        setStreakStatus({
          current_streak: user.streak_current || 0,
          best_streak: user.streak_best || 0,
          freezes_available: (user as any).streak_freezes || 0,
          last_activity_date: user.streak_last_date || null,
          is_at_risk: false,
          milestones_achieved: [],
        });
      } else if (data && data.length > 0) {
        setStreakStatus(data[0] as StreakStatus);
      }
    } catch (err: any) {
      console.error('Error fetching streak status:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Check if streak is about to expire
  const getStreakTimeRemaining = useCallback(() => {
    if (!streakStatus?.last_activity_date) return null;

    const lastActivity = new Date(streakStatus.last_activity_date);
    const now = new Date();

    // Calculate end of today in local time
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // If last activity was today, streak expires at end of tomorrow
    if (lastActivity.toDateString() === now.toDateString()) {
      const endOfTomorrow = new Date(endOfToday);
      endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
      return endOfTomorrow.getTime() - now.getTime();
    }

    // If last activity was yesterday, streak expires at end of today
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (lastActivity.toDateString() === yesterday.toDateString()) {
      return endOfToday.getTime() - now.getTime();
    }

    // Streak already expired
    return 0;
  }, [streakStatus]);

  // Format time remaining
  const formatTimeRemaining = useCallback(() => {
    const remaining = getStreakTimeRemaining();
    if (remaining === null) return null;
    if (remaining <= 0) return 'Expired';

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    }
    return `${minutes}m left`;
  }, [getStreakTimeRemaining]);

  // Get next milestone
  const getNextMilestone = useCallback(() => {
    if (!streakStatus) return STREAK_MILESTONES[0];

    const current = streakStatus.current_streak;
    for (const milestone of STREAK_MILESTONES) {
      if (current < milestone) {
        return milestone;
      }
    }
    return null; // All milestones achieved
  }, [streakStatus]);

  // Get progress to next milestone
  const getMilestoneProgress = useCallback(() => {
    if (!streakStatus) return 0;

    const current = streakStatus.current_streak;
    const nextMilestone = getNextMilestone();
    if (!nextMilestone) return 100;

    // Find previous milestone
    const prevMilestoneIndex = STREAK_MILESTONES.findIndex(m => m === nextMilestone) - 1;
    const prevMilestone = prevMilestoneIndex >= 0 ? STREAK_MILESTONES[prevMilestoneIndex] : 0;

    const progress = ((current - prevMilestone) / (nextMilestone - prevMilestone)) * 100;
    return Math.min(Math.max(progress, 0), 100);
  }, [streakStatus, getNextMilestone]);

  // Purchase a streak freeze with tokens
  const purchaseStreakFreeze = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    if ((user.tokens || 0) < STREAK_FREEZE_COST) {
      return { success: false, error: `Not enough tokens. Need ${STREAK_FREEZE_COST} tokens.` };
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('purchase_streak_freeze' as any);

      if (rpcError) {
        // Fallback: manual purchase
        if (rpcError.message.includes('Not enough tokens')) {
          return { success: false, error: `Not enough tokens. Need ${STREAK_FREEZE_COST} tokens.` };
        }

        await supabase
          .from('users')
          .update({
            tokens: (user.tokens || 0) - STREAK_FREEZE_COST,
            streak_freezes: ((user as any).streak_freezes || 0) + 1,
          })
          .eq('id', user.id);
      }

      await fetchUserProfile();
      await fetchStreakStatus();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, [user, fetchUserProfile, fetchStreakStatus]);

  // Use a streak freeze
  const useStreakFreeze = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    if ((streakStatus?.freezes_available || 0) < 1) {
      return { success: false, error: 'No streak freezes available' };
    }

    try {
      const { error: rpcError } = await supabase.rpc('use_streak_freeze' as any);

      if (rpcError) {
        // Fallback: manual use
        if (rpcError.message.includes('No streak freezes')) {
          return { success: false, error: 'No streak freezes available' };
        }

        await supabase
          .from('users')
          .update({
            streak_freezes: ((user as any).streak_freezes || 0) - 1,
            streak_last_date: new Date().toISOString().split('T')[0],
          })
          .eq('id', user.id);
      }

      await fetchUserProfile();
      await fetchStreakStatus();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, [user, streakStatus, fetchUserProfile, fetchStreakStatus]);

  // Check if user can afford a freeze
  const canAffordFreeze = useCallback(() => {
    return (user?.tokens || 0) >= STREAK_FREEZE_COST;
  }, [user?.tokens]);

  // Initial fetch
  useEffect(() => {
    fetchStreakStatus();
  }, [fetchStreakStatus]);

  return {
    streakStatus,
    isLoading,
    error,
    refetch: fetchStreakStatus,
    getStreakTimeRemaining,
    formatTimeRemaining,
    getNextMilestone,
    getMilestoneProgress,
    milestoneRewards: MILESTONE_REWARDS,
    purchaseStreakFreeze,
    useStreakFreeze,
    canAffordFreeze,
    STREAK_FREEZE_COST,
  };
}
