import { create } from 'zustand';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { User } from '../types/database';

interface AuthState {
  // Auth state
  session: Session | null;
  supabaseUser: SupabaseUser | null;
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  fetchUserProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  supabaseUser: null,
  user: null,
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    try {
      set({ isLoading: true });

      // Get current session
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        set({
          session,
          supabaseUser: session.user,
        });

        // Fetch user profile
        await get().fetchUserProfile();
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        set({
          session,
          supabaseUser: session?.user ?? null,
        });

        if (session?.user) {
          await get().fetchUserProfile();
        } else {
          set({ user: null });
        }
      });
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    } finally {
      set({ isLoading: false, isInitialized: true });
    }
  },

  setSession: (session) => {
    set({
      session,
      supabaseUser: session?.user ?? null,
    });
  },

  setUser: (user) => {
    set({ user });
  },

  fetchUserProfile: async () => {
    const { supabaseUser } = get();
    if (!supabaseUser) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      if (error) {
        // User doesn't exist in our users table yet (new signup)
        if (error.code === 'PGRST116') {
          set({ user: null });
          return;
        }
        throw error;
      }

      set({ user: data as User });
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
      set({
        session: null,
        supabaseUser: null,
        user: null,
      });
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  },

  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      set({ user: data as User });
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  },
}));
