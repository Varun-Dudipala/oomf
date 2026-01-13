import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export type ReactionType = 'fire' | 'heart' | 'laugh' | 'cry' | 'crown' | null;

export const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'fire', emoji: '🔥', label: 'Fire' },
  { type: 'heart', emoji: '❤️', label: 'Love' },
  { type: 'laugh', emoji: '😂', label: 'Haha' },
  { type: 'cry', emoji: '🥹', label: 'Touched' },
  { type: 'crown', emoji: '👑', label: 'Crown' },
];

export function getReactionEmoji(reaction: ReactionType): string {
  const found = REACTIONS.find(r => r.type === reaction);
  return found?.emoji || '';
}

export function useReactions() {
  const { user } = useAuthStore();

  // React to a compliment
  const reactToCompliment = useCallback(async (
    complimentId: string,
    reaction: ReactionType
  ): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    // Try RPC first
    const { error: rpcError } = await supabase.rpc('react_to_compliment' as any, {
      p_compliment_id: complimentId,
      p_reaction: reaction,
    });

    if (rpcError) {
      // Fallback: direct update
      if (rpcError.message.includes('only react to compliments you received')) {
        throw new Error('You can only react to compliments you received');
      }
      if (rpcError.message.includes('Invalid reaction')) {
        throw new Error('Invalid reaction type');
      }

      const { error } = await supabase
        .from('compliments')
        .update({ reaction })
        .eq('id', complimentId)
        .eq('receiver_id', user.id);

      if (error) throw error;
    }
  }, [user]);

  // Remove reaction
  const removeReaction = useCallback(async (complimentId: string): Promise<void> => {
    await reactToCompliment(complimentId, null);
  }, [reactToCompliment]);

  return {
    reactToCompliment,
    removeReaction,
    REACTIONS,
    getReactionEmoji,
  };
}
