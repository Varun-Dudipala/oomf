import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export type Circle = {
  id: string;
  name: string;
  emoji: string;
  description: string | null;
  owner_id: string;
  is_private: boolean;
  color: string;
  created_at: string;
  member_count: number;
  is_owner: boolean;
};

export type CircleMember = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  oomf_score: number;
  joined_at: string;
};

const CIRCLE_COLORS = [
  '#6C5CE7', // Purple
  '#00B894', // Green
  '#E17055', // Orange
  '#0984E3', // Blue
  '#D63031', // Red
  '#FDCB6E', // Yellow
  '#E84393', // Pink
  '#00CEC9', // Cyan
];

export function useCircles() {
  const { user } = useAuthStore();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCircles = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      // Try RPC first
      const { data, error: rpcError } = await supabase.rpc(
        'get_user_circles' as any,
        { p_user_id: user.id }
      );

      if (rpcError) {
        // Fallback to direct query
        const { data: circlesData, error: queryError } = await supabase
          .from('circles')
          .select('*')
          .or(`owner_id.eq.${user.id}`);

        if (queryError) throw queryError;

        // Get member counts
        const circlesWithCounts = await Promise.all(
          (circlesData || []).map(async (circle: any) => {
            const { count } = await supabase
              .from('circle_members')
              .select('*', { count: 'exact', head: true })
              .eq('circle_id', circle.id);

            return {
              ...circle,
              member_count: count || 0,
              is_owner: circle.owner_id === user.id,
            };
          })
        );

        setCircles(circlesWithCounts);
      } else {
        setCircles(data || []);
      }
    } catch (err: any) {
      console.error('Error fetching circles:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const createCircle = useCallback(async (
    name: string,
    emoji: string = '👥',
    description?: string,
    color?: string
  ): Promise<{ circleId: string | null; error: string | null }> => {
    if (!user) {
      return { circleId: null, error: 'Not authenticated' };
    }

    if (!name.trim()) {
      return { circleId: null, error: 'Circle name is required' };
    }

    if (name.length > 50) {
      return { circleId: null, error: 'Circle name is too long' };
    }

    try {
      // Try RPC first
      const { data, error: rpcError } = await supabase.rpc(
        'create_circle' as any,
        {
          p_owner_id: user.id,
          p_name: name.trim(),
          p_emoji: emoji,
          p_description: description || null,
          p_color: color || CIRCLE_COLORS[Math.floor(Math.random() * CIRCLE_COLORS.length)],
        }
      );

      if (rpcError) {
        // Fallback to direct insert
        const circleColor = color || CIRCLE_COLORS[Math.floor(Math.random() * CIRCLE_COLORS.length)];

        const { data: circleData, error: insertError } = await supabase
          .from('circles')
          .insert({
            name: name.trim(),
            emoji,
            description: description || null,
            owner_id: user.id,
            color: circleColor,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;

        // Add owner as first member
        await supabase.from('circle_members').insert({
          circle_id: circleData.id,
          user_id: user.id,
        });

        await fetchCircles();
        return { circleId: circleData.id, error: null };
      }

      await fetchCircles();
      return { circleId: data, error: null };
    } catch (err: any) {
      console.error('Error creating circle:', err);
      return { circleId: null, error: err.message };
    }
  }, [user, fetchCircles]);

  const getCircleMembers = useCallback(async (circleId: string): Promise<CircleMember[]> => {
    try {
      // Try RPC first
      const { data, error: rpcError } = await supabase.rpc(
        'get_circle_members' as any,
        { p_circle_id: circleId }
      );

      if (rpcError) {
        // Fallback
        const { data: membersData, error: queryError } = await supabase
          .from('circle_members')
          .select(`
            joined_at,
            user:users(id, username, display_name, avatar_url, oomf_score)
          `)
          .eq('circle_id', circleId);

        if (queryError) throw queryError;

        return (membersData || []).map((m: any) => ({
          user_id: m.user.id,
          username: m.user.username,
          display_name: m.user.display_name,
          avatar_url: m.user.avatar_url,
          oomf_score: m.user.oomf_score,
          joined_at: m.joined_at,
        }));
      }

      return data || [];
    } catch (err: any) {
      console.error('Error fetching circle members:', err);
      return [];
    }
  }, []);

  const addMember = useCallback(async (
    circleId: string,
    userId: string
  ): Promise<{ success: boolean; error: string | null }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Try RPC first
      const { error: rpcError } = await supabase.rpc(
        'add_circle_member' as any,
        {
          p_circle_id: circleId,
          p_user_id: userId,
          p_requester_id: user.id,
        }
      );

      if (rpcError) {
        // Fallback - direct insert (simpler, less validation)
        const { error: insertError } = await supabase
          .from('circle_members')
          .insert({ circle_id: circleId, user_id: userId });

        if (insertError) {
          if (insertError.message.includes('duplicate')) {
            return { success: true, error: null }; // Already a member
          }
          throw insertError;
        }
      }

      await fetchCircles();
      return { success: true, error: null };
    } catch (err: any) {
      console.error('Error adding member:', err);
      return { success: false, error: err.message };
    }
  }, [user, fetchCircles]);

  const removeMember = useCallback(async (
    circleId: string,
    userId: string
  ): Promise<{ success: boolean; error: string | null }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const { error: deleteError } = await supabase
        .from('circle_members')
        .delete()
        .eq('circle_id', circleId)
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      await fetchCircles();
      return { success: true, error: null };
    } catch (err: any) {
      console.error('Error removing member:', err);
      return { success: false, error: err.message };
    }
  }, [user, fetchCircles]);

  const deleteCircle = useCallback(async (
    circleId: string
  ): Promise<{ success: boolean; error: string | null }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const { error: deleteError } = await supabase
        .from('circles')
        .delete()
        .eq('id', circleId)
        .eq('owner_id', user.id); // Only owner can delete

      if (deleteError) throw deleteError;

      await fetchCircles();
      return { success: true, error: null };
    } catch (err: any) {
      console.error('Error deleting circle:', err);
      return { success: false, error: err.message };
    }
  }, [user, fetchCircles]);

  const updateCircle = useCallback(async (
    circleId: string,
    updates: { name?: string; emoji?: string; description?: string; color?: string }
  ): Promise<{ success: boolean; error: string | null }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const { error: updateError } = await supabase
        .from('circles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', circleId)
        .eq('owner_id', user.id); // Only owner can update

      if (updateError) throw updateError;

      await fetchCircles();
      return { success: true, error: null };
    } catch (err: any) {
      console.error('Error updating circle:', err);
      return { success: false, error: err.message };
    }
  }, [user, fetchCircles]);

  // Initial fetch
  useEffect(() => {
    fetchCircles();
  }, [fetchCircles]);

  return {
    circles,
    isLoading,
    error,
    refetch: fetchCircles,
    createCircle,
    getCircleMembers,
    addMember,
    removeMember,
    deleteCircle,
    updateCircle,
    circleColors: CIRCLE_COLORS,
  };
}
