import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from '../../lib/moti-shim';
import { Button, Input } from '../../components/ui';
import { signUpWithPassword, signInWithPassword } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, fontSize, fontWeight } from '../../lib/constants';

export default function EmailScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(true);
  const { fetchUserProfile, session, user } = useAuthStore();

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async () => {
    console.log('Submit pressed', { email, password: password.length });

    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email');
      return;
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      if (isSignUp) {
        console.log('Signing up...');
        const { data, error: signUpError } = await signUpWithPassword(
          email.trim().toLowerCase(),
          password
        );

        console.log('Signup result:', { data, error: signUpError });

        if (signUpError) {
          if (signUpError.message.includes('already registered') ||
              signUpError.message.includes('already been registered')) {
            // User exists, try signing in
            console.log('User exists, trying sign in...');
            setIsSignUp(false);
            const { data: signInData, error: signInError } = await signInWithPassword(
              email.trim().toLowerCase(),
              password
            );

            if (signInError) {
              setError(signInError.message);
              setIsLoading(false);
              return;
            }

            if (signInData.session) {
              console.log('Sign in successful, fetching profile...');
              await fetchUserProfile();
              router.replace('/(tabs)');
            }
            return;
          }
          setError(signUpError.message);
          setIsLoading(false);
          return;
        }

        // Check if we got a session (auto-confirmed)
        if (data?.session) {
          console.log('Got session, checking for user profile...');
          await fetchUserProfile();
          // New user - go to username setup
          router.replace('/(auth)/username');
        } else if (data?.user && !data?.session) {
          // Email confirmation required
          Alert.alert(
            'Check your email',
            'Please confirm your email address to continue. Check your inbox for a confirmation link.',
            [{ text: 'OK' }]
          );
        } else {
          console.log('Unexpected signup state:', data);
          setError('Something went wrong. Please try again.');
        }
      } else {
        // Sign in
        console.log('Signing in...');
        const { data, error: signInError } = await signInWithPassword(
          email.trim().toLowerCase(),
          password
        );

        console.log('Sign in result:', { data, error: signInError });

        if (signInError) {
          setError(signInError.message);
          setIsLoading(false);
          return;
        }

        if (data.session) {
          console.log('Sign in successful!');
          await fetchUserProfile();
          // Check if user has profile
          const store = useAuthStore.getState();
          if (store.user) {
            router.replace('/(tabs)');
          } else {
            router.replace('/(auth)/username');
          }
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <MotiView
            from={{ opacity: 0, translateY: -20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400 }}
          >
            <Text style={styles.title}>
              {isSignUp ? 'Create account' : 'Welcome back'}
            </Text>
            <Text style={styles.subtitle}>
              {isSignUp ? 'Enter your email and create a password' : 'Sign in to your account'}
            </Text>
          </MotiView>

          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 100 }}
            style={styles.inputContainer}
          >
            <Input
              placeholder="your@email.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoFocus
            />
            <Input
              placeholder="Password (min 6 characters)"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError('');
              }}
              secureTextEntry
              autoCapitalize="none"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </MotiView>

          <Pressable onPress={() => setIsSignUp(!isSignUp)} style={styles.toggle}>
            <Text style={styles.toggleText}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={styles.toggleLink}>{isSignUp ? 'Sign in' : 'Sign up'}</Text>
            </Text>
          </Pressable>
        </View>

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
            loading={isLoading}
          >
            {isLoading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
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
    gap: spacing.md,
  },
  error: {
    color: colors.error,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  toggle: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  toggleLink: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  cta: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
