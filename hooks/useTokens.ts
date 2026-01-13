import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export type HintType = 'first_letter' | 'join_date' | 'level';

export type Hint = {
  hint_type: HintType;
  hint_text: string;
  hint_value: string;
};

export type RevealedSender = {
  sender_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

export const HINT_COST = 1;
export const FULL_REVEAL_COST = 3;

export function useTokens() {
  const { user, fetchUserProfile } = useAuthStore();

  // Get current token balance
  const getBalance = useCallback(() => {
    return user?.tokens ?? 0;
  }, [user]);

  // Get a hint for a compliment (costs 1 token each)
  const getHint = useCallback(async (
    complimentId: string,
    hintNumber: 1 | 2 | 3
  ): Promise<Hint> => {
    if (!user) throw new Error('Not authenticated');

    if (user.tokens < HINT_COST) {
      throw new Error('Not enough tokens. Send more oomfs to earn tokens!');
    }

    // Try RPC first
    const { data, error } = await supabase.rpc('get_compliment_hint' as any, {
      p_compliment_id: complimentId,
      p_hint_number: hintNumber,
    });

    if (error) {
      // Fallback: manual hint generation
      if (error.message.includes('Not enough tokens')) {
        throw new Error('Not enough tokens. Send more oomfs to earn tokens!');
      }
      if (error.message.includes('already been used')) {
        throw new Error('This hint has already been used');
      }
      if (error.message.includes('already been revealed')) {
        throw new Error('This compliment has already been revealed');
      }

      // If RPC doesn't exist, generate hint manually
      const { data: compliment } = await supabase
        .from('compliments')
        .select('sender_id, hints_used')
        .eq('id', complimentId)
        .single();

      if (!compliment) throw new Error('Compliment not found');

      // Check hints used
      if ((compliment.hints_used || 0) >= hintNumber) {
        throw new Error('This hint has already been used');
      }

      // Get sender info
      const { data: sender } = await supabase
        .from('users')
        .select('username, created_at, oomf_score')
        .eq('id', compliment.sender_id)
        .single();

      if (!sender) throw new Error('Sender not found');

      // Deduct token
      await supabase
        .from('users')
        .update({ tokens: user.tokens - HINT_COST })
        .eq('id', user.id);

      // Update hints used
      await supabase
        .from('compliments')
        .update({ hints_used: hintNumber })
        .eq('id', complimentId);

      // Generate hint
      let hint: Hint;
      switch (hintNumber) {
        case 1:
          hint = {
            hint_type: 'first_letter',
            hint_text: 'Username starts with',
            hint_value: sender.username.charAt(0).toUpperCase(),
          };
          break;
        case 2:
          const joinDate = new Date(sender.created_at);
          hint = {
            hint_type: 'join_date',
            hint_text: 'Joined Oomf',
            hint_value: joinDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          };
          break;
        case 3:
          const score = sender.oomf_score || 0;
          let level = 'Newcomer';
          if (score >= 1000) level = 'Mythic';
          else if (score >= 500) level = 'Legendary';
          else if (score >= 300) level = 'Oomf Lord';
          else if (score >= 150) level = 'On Fire';
          else if (score >= 75) level = 'Warming Up';
          else if (score >= 25) level = 'Rising';

          hint = {
            hint_type: 'level',
            hint_text: 'Current level',
            hint_value: level,
          };
          break;
        default:
          throw new Error('Invalid hint number');
      }

      await fetchUserProfile();
      return hint;
    }

    // Refresh user profile to update token count
    await fetchUserProfile();

    return data as Hint;
  }, [user, fetchUserProfile]);

  // Reveal compliment sender using tokens (costs 3 tokens)
  const revealWithTokens = useCallback(async (
    complimentId: string
  ): Promise<RevealedSender> => {
    if (!user) throw new Error('Not authenticated');

    if (user.tokens < FULL_REVEAL_COST) {
      throw new Error(`Not enough tokens. Need ${FULL_REVEAL_COST} tokens for full reveal.`);
    }

    // Try RPC first
    const { data, error } = await supabase.rpc('reveal_with_tokens' as any, {
      p_compliment_id: complimentId,
    });

    if (error) {
      // Fallback: manual reveal
      if (error.message.includes('Not enough tokens')) {
        throw new Error(`Not enough tokens. Need ${FULL_REVEAL_COST} tokens for full reveal.`);
      }
      if (error.message.includes('already been revealed')) {
        throw new Error('This compliment has already been revealed');
      }

      // Manual fallback
      const { data: compliment } = await supabase
        .from('compliments')
        .select('sender_id, is_revealed')
        .eq('id', complimentId)
        .single();

      if (!compliment) throw new Error('Compliment not found');
      if (compliment.is_revealed) throw new Error('Already revealed');

      // Get sender info
      const { data: sender } = await supabase
        .from('users')
        .select('id, username, display_name, avatar_url')
        .eq('id', compliment.sender_id)
        .single();

      if (!sender) throw new Error('Sender not found');

      // Deduct tokens
      await supabase
        .from('users')
        .update({ tokens: user.tokens - FULL_REVEAL_COST })
        .eq('id', user.id);

      // Mark as revealed
      await supabase
        .from('compliments')
        .update({
          is_revealed: true,
          reveal_method: 'tokens',
          revealed_at: new Date().toISOString(),
        })
        .eq('id', complimentId);

      await fetchUserProfile();

      return {
        sender_id: sender.id,
        username: sender.username,
        display_name: sender.display_name,
        avatar_url: sender.avatar_url,
      };
    }

    // Refresh user profile to update token count
    await fetchUserProfile();

    return data as RevealedSender;
  }, [user, fetchUserProfile]);

  // Check if user can afford a hint
  const canAffordHint = useCallback(() => {
    return (user?.tokens ?? 0) >= HINT_COST;
  }, [user]);

  // Check if user can afford full reveal
  const canAffordReveal = useCallback(() => {
    return (user?.tokens ?? 0) >= FULL_REVEAL_COST;
  }, [user]);

  return {
    balance: user?.tokens ?? 0,
    getBalance,
    getHint,
    revealWithTokens,
    canAffordHint,
    canAffordReveal,
    HINT_COST,
    FULL_REVEAL_COST,
  };
}
