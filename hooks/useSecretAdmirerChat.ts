import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export type SecretAdmirerMessage = {
  id: string;
  sender_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  is_own: boolean;
};

export type SecretAdmirerUserInfo = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

export type SecretAdmirerChat = {
  id: string;
  compliment_id: string;
  exchange_count: number;
  is_revealed: boolean;
  revealed_at: string | null;
  created_at: string;
  sender: SecretAdmirerUserInfo;
  receiver: SecretAdmirerUserInfo;
  messages: SecretAdmirerMessage[];
  messages_until_reveal: number;
  is_sender: boolean;
};

export type SecretAdmirerChatPreview = {
  id: string;
  compliment_id: string;
  is_revealed: boolean;
  exchange_count: number;
  is_sender: boolean;
  other_user: SecretAdmirerUserInfo;
  last_message: string | null;
  unread_count: number;
  messages_until_reveal: number;
  updated_at: string;
};

export function useSecretAdmirerChat(chatId?: string) {
  const { user } = useAuthStore();
  const [chat, setChat] = useState<SecretAdmirerChat | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch chat details
  const fetchChat = useCallback(async () => {
    if (!chatId || !user) return;

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.rpc(
        'get_secret_admirer_chat' as any,
        { p_chat_id: chatId }
      );

      if (fetchError) throw fetchError;
      setChat(data as SecretAdmirerChat);
    } catch (err: any) {
      console.error('Error fetching chat:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [chatId, user]);

  // Fetch chat by compliment ID
  const fetchChatByCompliment = useCallback(async (complimentId: string) => {
    if (!user) return null;

    try {
      const { data, error: fetchError } = await supabase.rpc(
        'get_secret_admirer_chat_by_compliment' as any,
        { p_compliment_id: complimentId }
      );

      if (fetchError) throw fetchError;
      return data as SecretAdmirerChat | null;
    } catch (err: any) {
      console.error('Error fetching chat by compliment:', err);
      return null;
    }
  }, [user]);

  // Send a reply
  const sendReply = useCallback(async (message: string): Promise<{
    success: boolean;
    error?: string;
    isRevealed?: boolean;
    messagesUntilReveal?: number;
  }> => {
    if (!chatId || !user) {
      return { success: false, error: 'Not authenticated' };
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length < 1) {
      return { success: false, error: 'Message cannot be empty' };
    }

    if (trimmedMessage.length > 280) {
      return { success: false, error: 'Message cannot exceed 280 characters' };
    }

    setIsSending(true);
    setError(null);

    try {
      const { data, error: sendError } = await supabase.rpc(
        'send_secret_admirer_reply' as any,
        {
          p_chat_id: chatId,
          p_message: trimmedMessage,
        }
      );

      if (sendError) throw sendError;

      // Refresh chat data
      await fetchChat();

      return {
        success: true,
        isRevealed: data.is_revealed,
        messagesUntilReveal: data.messages_until_reveal,
      };
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to send message';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsSending(false);
    }
  }, [chatId, user, fetchChat]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!chatId || !user) return;

    const channel = supabase
      .channel(`secret-admirer-chat-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'secret_admirer_messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          // Refresh chat when new message arrives
          fetchChat();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'secret_admirer_chats',
          filter: `id=eq.${chatId}`,
        },
        (payload) => {
          // Refresh when chat is updated (e.g., revealed)
          fetchChat();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, user, fetchChat]);

  // Initial fetch
  useEffect(() => {
    if (chatId) {
      fetchChat();
    }
  }, [chatId, fetchChat]);

  return {
    chat,
    isLoading,
    isSending,
    error,
    refetch: fetchChat,
    sendReply,
    fetchChatByCompliment,
  };
}

// Hook to get all secret admirer chats for the user
export function useSecretAdmirerChats() {
  const { user } = useAuthStore();
  const [chats, setChats] = useState<SecretAdmirerChatPreview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChats = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.rpc(
        'get_my_secret_admirer_chats' as any
      );

      if (fetchError) throw fetchError;
      setChats((data || []) as SecretAdmirerChatPreview[]);
    } catch (err: any) {
      console.error('Error fetching chats:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('secret-admirer-chats-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'secret_admirer_messages',
        },
        () => fetchChats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchChats]);

  // Initial fetch
  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Get total unread count
  const totalUnread = chats.reduce((sum, chat) => sum + chat.unread_count, 0);

  return {
    chats,
    isLoading,
    error,
    refetch: fetchChats,
    totalUnread,
  };
}
