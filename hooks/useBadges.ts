import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export type Badge = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  requirement_type: string;
  requirement_value: number;
  is_secret: boolean;
  created_at: string;
};

export type UserBadge = {
  id: string;
  badge_id: string;
  user_id: string;
  earned_at: string;
  badge: Badge;
};

export type BadgeCheckResult = {
  out_badge_id: string;
  out_badge_name: string;
  out_badge_emoji: string;
  out_newly_awarded: boolean;
  // Aliases for easier access
  badge_id?: string;
  badge_name?: string;
  badge_emoji?: string;
  newly_awarded?: boolean;
};

export function useBadges(userId?: string) {
  const { user } = useAuthStore();
  const targetUserId = userId || user?.id;

  const [badges, setBadges] = useState<Badge[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [earnedBadgeIds, setEarnedBadgeIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all available badges
  const fetchBadges = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('badges')
        .select('*')
        .order('requirement_value', { ascending: true });

      if (fetchError) throw fetchError;
      setBadges((data || []) as Badge[]);
    } catch (err: any) {
      console.error('Error fetching badges:', err);
      setError(err.message);
    }
  }, []);

  // Fetch user's earned badges
  const fetchUserBadges = useCallback(async () => {
    if (!targetUserId) return;

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('user_badges')
        .select(`
          *,
          badge:badges(*)
        `)
        .eq('user_id', targetUserId)
        .order('earned_at', { ascending: false });

      if (fetchError) throw fetchError;

      const userBadgesData = (data || []) as UserBadge[];
      setUserBadges(userBadgesData);
      setEarnedBadgeIds(new Set(userBadgesData.map(ub => ub.badge_id)));
    } catch (err: any) {
      console.error('Error fetching user badges:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId]);

  // Check and award new badges
  const checkBadges = useCallback(async (): Promise<BadgeCheckResult[]> => {
    if (!user) return [];

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'check_and_award_badges' as any,
        { p_user_id: user.id }
      );

      if (rpcError) throw rpcError;

      // Refresh user badges after check
      await fetchUserBadges();

      // Map the out_ prefixed columns to regular names for compatibility
      const results = (data || []).map((r: any) => ({
        ...r,
        badge_id: r.out_badge_id,
        badge_name: r.out_badge_name,
        badge_emoji: r.out_badge_emoji,
        newly_awarded: r.out_newly_awarded,
      }));

      return results as BadgeCheckResult[];
    } catch (err: any) {
      console.error('Error checking badges:', err);
      return [];
    }
  }, [user, fetchUserBadges]);

  // Get newly awarded badges (for showing notifications)
  const getNewlyAwardedBadges = async (): Promise<BadgeCheckResult[]> => {
    const results = await checkBadges();
    return results.filter(r => r.newly_awarded || r.out_newly_awarded);
  };

  // Get badges grouped by category
  const getBadgesByCategory = useCallback(() => {
    const categories: Record<string, Badge[]> = {
      'Sending': [],
      'Receiving': [],
      'Guessing': [],
      'Streaks': [],
      'Social': [],
      'Levels': [],
      'Milestones': [],
    };

    badges.forEach(badge => {
      switch (badge.requirement_type) {
        case 'compliments_sent':
          categories['Sending'].push(badge);
          break;
        case 'compliments_received':
          categories['Receiving'].push(badge);
          break;
        case 'correct_guesses':
          categories['Guessing'].push(badge);
          break;
        case 'streak_days':
          categories['Streaks'].push(badge);
          break;
        case 'friends_count':
          categories['Social'].push(badge);
          break;
        case 'level_reached':
          categories['Levels'].push(badge);
          break;
        default:
          categories['Milestones'].push(badge);
      }
    });

    return categories;
  }, [badges]);

  // Initial fetch
  useEffect(() => {
    fetchBadges();
    fetchUserBadges();
  }, [fetchBadges, fetchUserBadges]);

  return {
    badges,
    userBadges,
    earnedBadgeIds,
    isLoading,
    error,
    refetch: fetchUserBadges,
    checkBadges,
    getNewlyAwardedBadges,
    getBadgesByCategory,
    hasBadge: (badgeId: string) => earnedBadgeIds.has(badgeId),
  };
}
