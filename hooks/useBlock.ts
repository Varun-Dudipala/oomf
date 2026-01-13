import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { User } from '../types/database';

export type BlockedUser = {
  id: string;
  blocked_id: string;
  created_at: string;
  user: User;
};

export function useBlock() {
  const { user } = useAuthStore();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBlockedUsers = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('blocked_users')
        .select(`
          id,
          blocked_id,
          created_at,
          user:users!blocked_users_blocked_id_fkey(*)
        `)
        .eq('blocker_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setBlockedUsers((data || []).map((item: any) => ({
        id: item.id,
        blocked_id: item.blocked_id,
        created_at: item.created_at,
        user: item.user,
      })));
    } catch (err: any) {
      console.error('Error fetching blocked users:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Block a user by their ID
  const blockUser = useCallback(async (blockedId: string): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    if (blockedId === user.id) {
      throw new Error('Cannot block yourself');
    }

    // Try RPC first
    const { error: rpcError } = await supabase.rpc('block_user' as any, {
      p_blocked_id: blockedId,
    });

    if (rpcError) {
      // Fallback: manual block
      // Insert block record
      const { error: insertError } = await supabase
        .from('blocked_users')
        .insert({
          blocker_id: user.id,
          blocked_id: blockedId,
        });

      if (insertError && !insertError.message.includes('duplicate')) {
        throw insertError;
      }

      // Remove any existing friendship
      await supabase
        .from('friendships')
        .delete()
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${blockedId}),and(requester_id.eq.${blockedId},addressee_id.eq.${user.id})`);
    }

    await fetchBlockedUsers();
  }, [user, fetchBlockedUsers]);

  // Block a user by username
  const blockUserByUsername = useCallback(async (username: string): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    // Find user by username
    const { data: targetUser, error: findError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username.toLowerCase())
      .single();

    if (findError || !targetUser) {
      throw new Error('User not found');
    }

    await blockUser(targetUser.id);
  }, [user, blockUser]);

  // Unblock a user
  const unblockUser = useCallback(async (blockedId: string): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    // Try RPC first
    const { error: rpcError } = await supabase.rpc('unblock_user' as any, {
      p_blocked_id: blockedId,
    });

    if (rpcError) {
      // Fallback: manual unblock
      const { error: deleteError } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', blockedId);

      if (deleteError) throw deleteError;
    }

    await fetchBlockedUsers();
  }, [user, fetchBlockedUsers]);

  // Check if a specific user is blocked
  const isUserBlocked = useCallback((userId: string): boolean => {
    return blockedUsers.some(b => b.blocked_id === userId);
  }, [blockedUsers]);

  // Check if there's a block between current user and another user
  const hasBlockBetween = useCallback(async (otherUserId: string): Promise<boolean> => {
    if (!user) return false;

    // Check if current user blocked the other
    const blocked = isUserBlocked(otherUserId);
    if (blocked) return true;

    // Check if the other user blocked current user
    const { data, error } = await supabase
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', otherUserId)
      .eq('blocked_id', user.id)
      .maybeSingle();

    return !!data && !error;
  }, [user, isUserBlocked]);

  // Initial fetch
  useEffect(() => {
    fetchBlockedUsers();
  }, [fetchBlockedUsers]);

  return {
    blockedUsers,
    isLoading,
    error,
    blockUser,
    blockUserByUsername,
    unblockUser,
    isUserBlocked,
    hasBlockBetween,
    refetch: fetchBlockedUsers,
  };
}
