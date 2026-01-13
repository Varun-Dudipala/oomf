// Database types for Supabase
// These will be auto-generated once you run: npx supabase gen types typescript

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          username: string;
          display_name: string;
          avatar_url: string | null;
          bio: string | null;
          oomf_score: number;
          level: number;
          tokens: number;
          streak_current: number;
          streak_best: number;
          streak_last_date: string | null;
          compliments_sent: number;
          compliments_received: number;
          correct_guesses: number;
          expo_push_token: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          username: string;
          display_name: string;
          avatar_url?: string | null;
          bio?: string | null;
          oomf_score?: number;
          level?: number;
          tokens?: number;
          streak_current?: number;
          streak_best?: number;
          streak_last_date?: string | null;
          compliments_sent?: number;
          compliments_received?: number;
          correct_guesses?: number;
          expo_push_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          username?: string;
          display_name?: string;
          avatar_url?: string | null;
          bio?: string | null;
          oomf_score?: number;
          level?: number;
          tokens?: number;
          streak_current?: number;
          streak_best?: number;
          streak_last_date?: string | null;
          compliments_sent?: number;
          compliments_received?: number;
          correct_guesses?: number;
          expo_push_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      friendships: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: 'pending' | 'accepted' | 'blocked';
          created_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          requester_id: string;
          addressee_id: string;
          status?: 'pending' | 'accepted' | 'blocked';
          created_at?: string;
          accepted_at?: string | null;
        };
        Update: {
          id?: string;
          requester_id?: string;
          addressee_id?: string;
          status?: 'pending' | 'accepted' | 'blocked';
          created_at?: string;
          accepted_at?: string | null;
        };
      };
      templates: {
        Row: {
          id: string;
          text: string;
          emoji: string | null;
          category: string;
          is_active: boolean;
          usage_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          text: string;
          emoji?: string | null;
          category: string;
          is_active?: boolean;
          usage_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          text?: string;
          emoji?: string | null;
          category?: string;
          is_active?: boolean;
          usage_count?: number;
          created_at?: string;
        };
      };
      compliments: {
        Row: {
          id: string;
          sender_id: string;
          receiver_id: string;
          template_id: string;
          is_read: boolean;
          is_revealed: boolean;
          reveal_method: 'guessed' | 'tokens' | null;
          guesses_remaining: number;
          created_at: string;
          read_at: string | null;
          revealed_at: string | null;
        };
        Insert: {
          id?: string;
          sender_id: string;
          receiver_id: string;
          template_id: string;
          is_read?: boolean;
          is_revealed?: boolean;
          reveal_method?: 'guessed' | 'tokens' | null;
          guesses_remaining?: number;
          created_at?: string;
          read_at?: string | null;
          revealed_at?: string | null;
        };
        Update: {
          id?: string;
          sender_id?: string;
          receiver_id?: string;
          template_id?: string;
          is_read?: boolean;
          is_revealed?: boolean;
          reveal_method?: 'guessed' | 'tokens' | null;
          guesses_remaining?: number;
          created_at?: string;
          read_at?: string | null;
          revealed_at?: string | null;
        };
      };
      guesses: {
        Row: {
          id: string;
          compliment_id: string;
          guesser_id: string;
          guessed_user_id: string;
          is_correct: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          compliment_id: string;
          guesser_id: string;
          guessed_user_id: string;
          is_correct: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          compliment_id?: string;
          guesser_id?: string;
          guessed_user_id?: string;
          is_correct?: boolean;
          created_at?: string;
        };
      };
    };
    Views: {};
    Functions: {
      send_compliment: {
        Args: {
          p_receiver_id: string;
          p_template_id: string;
        };
        Returns: string;
      };
      make_guess: {
        Args: {
          p_compliment_id: string;
          p_guessed_user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {};
  };
}

// Convenience types
export type User = Database['public']['Tables']['users']['Row'];
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type UserUpdate = Database['public']['Tables']['users']['Update'];

export type Friendship = Database['public']['Tables']['friendships']['Row'];
export type Template = Database['public']['Tables']['templates']['Row'];
export type Compliment = Database['public']['Tables']['compliments']['Row'];
export type Guess = Database['public']['Tables']['guesses']['Row'];

// Badge types (for badges table)
export type Badge = {
  id: string;
  name: string;
  description: string | null;
  emoji: string;
  requirement_type: string;
  requirement_value: number;
  is_secret: boolean;
  created_at: string;
};

export type UserBadge = {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
};

// Extended types with relations
export type ComplimentWithTemplate = Compliment & {
  template: Template;
};

export type ComplimentWithSender = Compliment & {
  template: Template;
  sender: User;
};

export type FriendWithUser = Friendship & {
  friend: User;
};
