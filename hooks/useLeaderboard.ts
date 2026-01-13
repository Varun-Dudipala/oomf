import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export type LeaderboardEntry = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  compliments_sent: number;
  compliments_received: number;
  total_activity: number;
  rank: number;
};

export type UserRank = {
  compliments_sent: number;
  compliments_received: number;
  total_activity: number;
  rank: number;
  total_participants: number;
};

export type CategoryWinner = {
  category: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  category_count: number;
};

// Category display info
export const CATEGORY_INFO: Record<string, { emoji: string; label: string }> = {
  vibes: { emoji: '✨', label: 'Best Vibes' },
  funny: { emoji: '😂', label: 'Funniest' },
  smart: { emoji: '🧠', label: 'Smartest' },
  looks: { emoji: '👀', label: 'Best Looking' },
  skills: { emoji: '🎯', label: 'Most Skilled' },
  trust: { emoji: '🤝', label: 'Most Trusted' },
  energy: { emoji: '⚡', label: 'Best Energy' },
  kind: { emoji: '💖', label: 'Kindest' },
};

export function useLeaderboard() {
  const { user } = useAuthStore();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<UserRank | null>(null);
  const [categoryWinners, setCategoryWinners] = useState<CategoryWinner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get current week date range for display
  const getWeekRange = useCallback(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek; // Adjust for Monday start

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    return {
      start: weekStart,
      end: weekEnd,
      label: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    };
  }, []);

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get top 10 users
      const { data: leaderboardData, error: leaderboardError } = await supabase.rpc(
        'get_weekly_leaderboard' as any,
        { p_limit: 10 }
      );

      if (leaderboardError) throw leaderboardError;
      setLeaderboard((leaderboardData || []) as LeaderboardEntry[]);

      // Get current user's rank if authenticated
      if (user) {
        const { data: rankData, error: rankError } = await supabase.rpc(
          'get_user_weekly_rank' as any,
          { p_user_id: user.id }
        );

        if (rankError) {
          console.error('Error fetching user rank:', rankError);
        } else if (rankData && rankData.length > 0) {
          setUserRank(rankData[0] as UserRank);
        } else {
          // User has no activity this week
          setUserRank({
            compliments_sent: 0,
            compliments_received: 0,
            total_activity: 0,
            rank: 0,
            total_participants: (leaderboardData?.length || 0),
          });
        }

        // Check podium status and trigger notification if user made top 3
        // This runs in the background - don't await
        supabase.rpc('check_and_notify_podium_user' as any, { p_user_id: user.id })
          .then(({ error: podiumError }) => {
            if (podiumError) {
              console.log('Podium check skipped (function may not exist yet)');
            }
          });
      }

      // Get category winners
      const { data: categoryData, error: categoryError } = await supabase.rpc(
        'get_weekly_category_winners' as any
      );

      if (!categoryError && categoryData) {
        setCategoryWinners(categoryData as CategoryWinner[]);
      }
    } catch (err: any) {
      console.error('Error fetching leaderboard:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Check if user is on podium (top 3)
  const isUserOnPodium = useCallback(() => {
    if (!user || !userRank) return false;
    return userRank.rank >= 1 && userRank.rank <= 3;
  }, [user, userRank]);

  // Get podium (top 3) users
  const getPodium = useCallback(() => {
    return leaderboard.slice(0, 3);
  }, [leaderboard]);

  // Get the rest (4-10)
  const getRest = useCallback(() => {
    return leaderboard.slice(3);
  }, [leaderboard]);

  // Initial fetch
  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return {
    leaderboard,
    userRank,
    categoryWinners,
    isLoading,
    error,
    refetch: fetchLeaderboard,
    getWeekRange,
    isUserOnPodium,
    getPodium,
    getRest,
    CATEGORY_INFO,
  };
}
