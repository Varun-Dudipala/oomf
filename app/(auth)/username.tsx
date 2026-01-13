import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from '../../lib/moti-shim';
import { Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, fontSize, fontWeight, limits } from '../../lib/constants';

export default function UsernameScreen() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { supabaseUser } = useAuthStore();

  // Validate username format
  const validateUsername = (value: string): string | null => {
    if (value.length < limits.usernameMinLength) {
      return `Username must be at least ${limits.usernameMinLength} characters`;
    }
    if (value.length > limits.usernameMaxLength) {
      return `Username must be less than ${limits.usernameMaxLength} characters`;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      return 'Only letters, numbers, and underscores allowed';
    }
    return null;
  };

  // Check username availability with debounce
  useEffect(() => {
    const validationError = validateUsername(username);
    if (validationError || !username) {
      setIsAvailable(null);
      return;
    }

    setIsChecking(true);
    const timer = setTimeout(async () => {
      try {
        const { data, error: checkError } = await supabase
          .from('users')
          .select('username')
          .eq('username', username.toLowerCase())
          .single();

        if (checkError && checkError.code === 'PGRST116') {
          // No rows found = available
          setIsAvailable(true);
        } else if (data) {
          setIsAvailable(false);
        }
      } catch (err) {
        console.error('Error checking username:', err);
      } finally {
        setIsChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  const handleSubmit = async () => {
    const validationError = validateUsername(username);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!isAvailable) {
      setError('This username is taken');
      return;
    }

    if (!supabaseUser) {
      setError('Please sign in again');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Create user profile
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: supabaseUser.id,
          email: supabaseUser.email!,
          username: username.toLowerCase(),
          display_name: username, // Default to username, can change later
        } as any);

      if (insertError) {
        throw insertError;
      }

      // Navigate to profile setup
      router.push('/(auth)/profile-setup');
    } catch (err: any) {
      console.error('Error creating profile:', err);
      setError(err.message || 'Failed to create profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUsernameChange = (value: string) => {
    // Remove spaces and special characters as they type
    const cleaned = value.replace(/[^a-zA-Z0-9_]/g, '');
    setUsername(cleaned);
    setError('');
    setIsAvailable(null);
  };

  const getHintText = () => {
    if (isChecking) return 'Checking availability...';
    if (isAvailable === true) return 'Username is available';
    if (isAvailable === false) return 'Username is taken';
    return 'Letters, numbers, and underscores only';
  };

  const getHintColor = () => {
    if (isAvailable === true) return colors.success;
    if (isAvailable === false) return colors.error;
    return colors.textMuted;
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Header */}
          <MotiView
            from={{ opacity: 0, translateY: -20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400 }}
          >
            <Text style={styles.title}>Pick your username</Text>
            <Text style={styles.subtitle}>
              This is how friends will find you on Oomf
            </Text>
          </MotiView>

          {/* Input */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 100 }}
            style={styles.inputContainer}
          >
            <Input
              prefix="@"
              placeholder="username"
              value={username}
              onChangeText={handleUsernameChange}
              error={error}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <View style={styles.hintContainer}>
              {isAvailable === true && (
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              )}
              {isAvailable === false && (
                <Ionicons name="close-circle" size={16} color={colors.error} />
              )}
              {isChecking && (
                <Ionicons name="time-outline" size={16} color={colors.textMuted} />
              )}
              <Text style={[styles.hint, { color: getHintColor() }]}>
                {getHintText()}
              </Text>
            </View>
          </MotiView>
        </View>

        {/* CTA */}
        <MotiView
          from={{ opacity: 0, translateY: 30 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 200 }}
          style={styles.cta}
        >
          <Button
            onPress={handleSubmit}
            size="lg"
            fullWidth
            loading={isSubmitting}
            disabled={!username.trim() || isAvailable !== true}
          >
            Continue
          </Button>
        </MotiView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['3xl'],
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  inputContainer: {
    marginTop: spacing.md,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  hint: {
    fontSize: fontSize.sm,
  },
  cta: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
