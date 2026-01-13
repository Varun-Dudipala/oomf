import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Using any for flexibility - will use proper types in queries
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Auth helpers
export const signInWithMagicLink = async (email: string) => {
  // Use OTP (6-digit code) for Expo Go compatibility
  const { error } = await supabase.auth.signInWithOtp({
    email,
  });
  return { error };
};

// Password-based auth (easier for testing)
export const signUpWithPassword = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  return { data, error };
};

export const signInWithPassword = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

// Verify OTP code or token from magic link
export const verifyOtp = async (email: string, token: string) => {
  // Check if user pasted a full URL - extract the token
  let actualToken = token.trim();

  if (token.includes('token=')) {
    try {
      const url = new URL(token);
      actualToken = url.searchParams.get('token') || token;
    } catch {
      // Not a valid URL, try to extract token manually
      const match = token.match(/token=([^&]+)/);
      if (match) actualToken = match[1];
    }
  } else if (token.includes('token_hash=')) {
    try {
      const url = new URL(token);
      actualToken = url.searchParams.get('token_hash') || token;
    } catch {
      const match = token.match(/token_hash=([^&]+)/);
      if (match) actualToken = match[1];
    }
  }

  // Try magiclink type first, then email
  let { data, error } = await supabase.auth.verifyOtp({
    email,
    token: actualToken,
    type: 'magiclink',
  });

  // If magiclink fails, try email type
  if (error) {
    const result = await supabase.auth.verifyOtp({
      email,
      token: actualToken,
      type: 'email',
    });
    data = result.data;
    error = result.error;
  }

  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
};

export const getCurrentSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error };
};

// Storage helpers for avatars
export const uploadAvatar = async (userId: string, fileUri: string): Promise<{ url: string | null; error: Error | null }> => {
  try {
    // Get the file extension
    const ext = fileUri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${userId}-${Date.now()}.${ext}`;
    const filePath = `avatars/${fileName}`;

    // Fetch the file and convert to blob
    const response = await fetch(fileUri);
    const blob = await response.blob();

    // Convert blob to ArrayBuffer for Supabase
    const arrayBuffer = await new Response(blob).arrayBuffer();

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, arrayBuffer, {
        contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return { url: urlData.publicUrl, error: null };
  } catch (err) {
    console.error('Avatar upload error:', err);
    return { url: null, error: err as Error };
  }
};

export const deleteAvatar = async (avatarUrl: string): Promise<{ error: Error | null }> => {
  try {
    // Extract the file path from the URL
    const urlParts = avatarUrl.split('/avatars/');
    if (urlParts.length < 2) {
      return { error: null }; // Not a valid avatar URL, skip
    }

    const filePath = `avatars/${urlParts[1]}`;

    const { error } = await supabase.storage
      .from('avatars')
      .remove([filePath]);

    if (error) throw error;
    return { error: null };
  } catch (err) {
    console.error('Avatar delete error:', err);
    return { error: err as Error };
  }
};

// Account deletion helper
// This deletes all user data from the database
// Note: The auth user must be deleted via Supabase dashboard or Edge Function
export const deleteUserData = async (userId: string): Promise<{ error: Error | null }> => {
  try {
    // Delete user's guesses
    await supabase
      .from('guesses')
      .delete()
      .eq('guesser_id', userId);

    // Delete compliments where user is sender or receiver
    await supabase
      .from('compliments')
      .delete()
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

    // Delete friendships
    await supabase
      .from('friendships')
      .delete()
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    // Get user's avatar URL before deleting profile
    const { data: userData } = await supabase
      .from('users')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    // Delete avatar from storage if exists
    if (userData?.avatar_url) {
      await deleteAvatar(userData.avatar_url);
    }

    // Delete user profile
    const { error: deleteUserError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteUserError) throw deleteUserError;

    return { error: null };
  } catch (err) {
    console.error('Delete user data error:', err);
    return { error: err as Error };
  }
};
