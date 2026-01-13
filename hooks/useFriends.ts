import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { checkRateLimit, recordRateLimitAction } from '../lib/rateLimit';
import type { User, Friendship } from '../types/database';

export type FriendWithProfile = {
  friendship_id: string;
  friend: User;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
  is_requester: boolean;
};

export const MAX_FRIENDS = 150;

export function useFriends() {
  const { user } = useAuthStore();
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [pendingIncoming, setPendingIncoming] = useState<FriendWithProfile[]>([]);
  const [pendingOutgoing, setPendingOutgoing] = useState<FriendWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFriends = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      // Fetch all friendships where user is involved
      const { data: friendships, error: fetchError } = await supabase
        .from('friendships')
        .select(`
          id,
          requester_id,
          addressee_id,
          status,
          created_at,
          requester:users!friendships_requester_id_fkey(*),
          addressee:users!friendships_addressee_id_fkey(*)
        `)
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .neq('status', 'blocked');

      if (fetchError) throw fetchError;

      const accepted: FriendWithProfile[] = [];
      const incoming: FriendWithProfile[] = [];
      const outgoing: FriendWithProfile[] = [];

      friendships?.forEach((f: any) => {
        const isRequester = f.requester_id === user.id;
        const friendUser = isRequester ? f.addressee : f.requester;

        const friendData: FriendWithProfile = {
          friendship_id: f.id,
          friend: friendUser,
          status: f.status,
          created_at: f.created_at,
          is_requester: isRequester,
        };

        if (f.status === 'accepted') {
          accepted.push(friendData);
        } else if (f.status === 'pending') {
          if (isRequester) {
            outgoing.push(friendData);
          } else {
            incoming.push(friendData);
          }
        }
      });

      setFriends(accepted);
      setPendingIncoming(incoming);
      setPendingOutgoing(outgoing);
    } catch (err: any) {
      console.error('Error fetching friends:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Send friend request (with rate limiting)
  const sendFriendRequest = async (username: string) => {
    if (!user) throw new Error('Not authenticated');

    // Check rate limit
    const rateCheck = await checkRateLimit('sendFriendRequest', user.id);
    if (!rateCheck.allowed) {
      throw new Error(rateCheck.message || 'Too many friend requests. Try again later.');
    }

    // Find user by username
    const { data: targetUser, error: findError } = await supabase
      .from('users')
      .select('id, username')
      .eq('username', username.toLowerCase())
      .single();

    if (findError || !targetUser) {
      throw new Error('User not found');
    }

    const targetUserId = (targetUser as { id: string }).id;

    // Check for blocks between users
    const { data: blockExists } = await supabase
      .from('blocked_users')
      .select('id')
      .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${targetUserId}),and(blocker_id.eq.${targetUserId},blocked_id.eq.${user.id})`)
      .maybeSingle();

    if (blockExists) {
      throw new Error('Unable to send request');
    }

    if (targetUserId === user.id) {
      throw new Error("You can't add yourself");
    }

    // Check if current user is at friend limit
    if (friends.length >= MAX_FRIENDS) {
      throw new Error(`You've reached the maximum of ${MAX_FRIENDS} friends`);
    }

    // Check if friendship already exists
    const { data: sentRequest } = await supabase
      .from('friendships')
      .select('id, status')
      .eq('requester_id', user.id)
      .eq('addressee_id', targetUserId)
      .maybeSingle();

    const { data: receivedRequest } = await supabase
      .from('friendships')
      .select('id, status')
      .eq('requester_id', targetUserId)
      .eq('addressee_id', user.id)
      .maybeSingle();

    const existing = sentRequest || receivedRequest;

    if (existing) {
      const existingFriendship = existing as { id: string; status: string };
      if (existingFriendship.status === 'accepted') {
        throw new Error('Already friends');
      } else if (existingFriendship.status === 'pending') {
        // If they sent us a request, accept it instead
        if (receivedRequest) {
          await acceptFriendRequest(existingFriendship.id);
          return;
        }
        throw new Error('Friend request already pending');
      } else if (existingFriendship.status === 'blocked') {
        throw new Error('Unable to send request');
      }
    }

    // Create friend request
    const { error: insertError } = await supabase
      .from('friendships')
      .insert({
        requester_id: user.id,
        addressee_id: targetUserId,
        status: 'pending',
      })
      .select();

    if (insertError) {
      if (insertError.code === '23505') {
        throw new Error('Friend request already exists');
      }
      throw new Error(insertError.message || 'Failed to send friend request');
    }

    // Record rate limit action
    await recordRateLimitAction('sendFriendRequest', user.id);

    await fetchFriends();
  };

  // Accept friend request
  const acceptFriendRequest = async (friendshipId: string) => {
    // Check if at friend limit
    if (friends.length >= MAX_FRIENDS) {
      throw new Error(`You've reached the maximum of ${MAX_FRIENDS} friends`);
    }

    // Try to use RPC which checks both users' limits
    const { error: rpcError } = await supabase.rpc('accept_friend_request' as any, {
      p_friendship_id: friendshipId,
    });

    if (rpcError) {
      // Fallback to direct update if RPC doesn't exist
      if (rpcError.message.includes('maximum friends')) {
        throw new Error(rpcError.message);
      }

      const { error } = await supabase
        .from('friendships')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        } as any)
        .eq('id', friendshipId);

      if (error) throw error;
    }

    await fetchFriends();
  };

  // Reject/decline friend request
  const rejectFriendRequest = async (friendshipId: string) => {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);

    if (error) throw error;

    await fetchFriends();
  };

  // Remove friend
  const removeFriend = async (friendshipId: string) => {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);

    if (error) throw error;

    await fetchFriends();
  };

  // Block user
  const blockUser = async (friendshipId: string) => {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'blocked' } as any)
      .eq('id', friendshipId);

    if (error) throw error;

    await fetchFriends();
  };

  // Initial fetch
  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('friendships-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `requester_id=eq.${user.id}`,
        },
        () => fetchFriends()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `addressee_id=eq.${user.id}`,
        },
        () => fetchFriends()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchFriends]);

  return {
    friends,
    pendingIncoming,
    pendingOutgoing,
    isLoading,
    error,
    refetch: fetchFriends,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    blockUser,
    friendCount: friends.length,
    maxFriends: MAX_FRIENDS,
    canAddMoreFriends: friends.length < MAX_FRIENDS,
  };
}
