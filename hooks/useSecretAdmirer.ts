import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export const SECRET_ADMIRER_COST = 3;
export const SECRET_ADMIRER_MAX_LENGTH = 280;
export const SECRET_ADMIRER_MIN_LENGTH = 5;

export function useSecretAdmirer() {
  const { user, fetchUserProfile } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAfford = useCallback(() => {
    return (user?.tokens || 0) >= SECRET_ADMIRER_COST;
  }, [user?.tokens]);

  const sendSecretAdmirer = useCallback(async (
    receiverId: string,
    customMessage: string
  ): Promise<{ complimentId: string | null; error: string | null }> => {
    if (!user) {
      return { complimentId: null, error: 'Not authenticated' };
    }

    // Validate message
    const trimmedMessage = customMessage.trim();
    if (trimmedMessage.length < SECRET_ADMIRER_MIN_LENGTH) {
      return { complimentId: null, error: `Message must be at least ${SECRET_ADMIRER_MIN_LENGTH} characters` };
    }

    if (trimmedMessage.length > SECRET_ADMIRER_MAX_LENGTH) {
      return { complimentId: null, error: `Message cannot exceed ${SECRET_ADMIRER_MAX_LENGTH} characters` };
    }

    // Check token balance
    if (!canAfford()) {
      return { complimentId: null, error: `Not enough tokens. Need ${SECRET_ADMIRER_COST} tokens.` };
    }

    setIsLoading(true);
    setError(null);

    try {
      // Try to use the RPC function
      const { data, error: rpcError } = await supabase.rpc(
        'send_secret_admirer' as any,
        {
          p_sender_id: user.id,
          p_receiver_id: receiverId,
          p_custom_message: trimmedMessage,
        }
      );

      if (rpcError) {
        // Fallback: do it manually
        // Deduct tokens
        const { error: tokenError } = await supabase
          .from('users')
          .update({ tokens: (user.tokens || 0) - SECRET_ADMIRER_COST })
          .eq('id', user.id);

        if (tokenError) {
          throw new Error('Failed to deduct tokens');
        }

        // Create compliment with custom message
        const { data: complimentData, error: complimentError } = await supabase
          .from('compliments')
          .insert({
            sender_id: user.id,
            receiver_id: receiverId,
            template_id: null,
            custom_message: trimmedMessage,
            is_secret_admirer: true,
            tokens_spent: SECRET_ADMIRER_COST,
          })
          .select('id')
          .single();

        if (complimentError) {
          // Refund tokens on failure
          await supabase
            .from('users')
            .update({ tokens: user.tokens })
            .eq('id', user.id);
          throw complimentError;
        }

        // Update sender stats
        await supabase
          .from('users')
          .update({
            compliments_sent: (user.compliments_sent || 0) + 1,
            oomf_score: (user.oomf_score || 0) + 15,
          })
          .eq('id', user.id);

        // Refresh user profile
        await fetchUserProfile();

        return { complimentId: complimentData.id, error: null };
      }

      // RPC succeeded
      await fetchUserProfile();
      return { complimentId: data, error: null };
    } catch (err: any) {
      console.error('Error sending secret admirer:', err);
      const errorMsg = err.message || 'Failed to send message';
      setError(errorMsg);
      return { complimentId: null, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, [user, canAfford, fetchUserProfile]);

  return {
    sendSecretAdmirer,
    isLoading,
    error,
    canAfford,
    cost: SECRET_ADMIRER_COST,
    maxLength: SECRET_ADMIRER_MAX_LENGTH,
    minLength: SECRET_ADMIRER_MIN_LENGTH,
  };
}
