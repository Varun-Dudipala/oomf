import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from '../../lib/moti-shim';
import { Button, Input } from '../../components/ui';
import { signInWithMagicLink, verifyOtp } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, fontSize, fontWeight } from '../../lib/constants';

export default function VerifyScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState('');
  const { fetchUserProfile, user, session } = useAuthStore();

  // Navigate when user profile is loaded (or not - means new user)
  useEffect(() => {
    if (session) {
      if (user) {
        // Existing user with profile
        router.replace('/(tabs)');
      } else {
        // New user needs to complete onboarding
        router.replace('/(auth)/username');
      }
    }
  }, [session, user]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleVerify = async () => {
    if (!code.trim() || !email) return;

    setIsVerifying(true);
    setError('');

    try {
      const { data, error: verifyError } = await verifyOtp(email, code.trim());

      if (verifyError) {
        setError(verifyError.message || 'Invalid code. Please try again.');
        return;
      }

      if (data.session) {
        await fetchUserProfile();
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !email) return;

    setIsResending(true);
    try {
      await signInWithMagicLink(email);
      setResendCooldown(60);
      Alert.alert('Code Sent', 'Check your email for a new code.');
    } catch (err) {
      console.error('Failed to resend:', err);
    } finally {
      setIsResending(false);
    }
  };

  const handleChangeEmail = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Icon */}
        <MotiView
          from={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 12 }}
          style={styles.iconContainer}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="mail" size={40} color={colors.primary} />
          </View>
        </MotiView>

        {/* Text */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 100 }}
        >
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a login link to{'\n'}
            <Text style={styles.email}>{email}</Text>
          </Text>
          <Text style={styles.hint}>
            Copy the token from the email link and paste it below
          </Text>
        </MotiView>

        {/* Code Input */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 150 }}
          style={styles.inputContainer}
        >
          <Input
            value={code}
            onChangeText={(text) => {
              setCode(text);
              setError('');
            }}
            placeholder="Paste token from email"
            autoCapitalize="none"
            autoCorrect={false}
            error={error}
          />
        </MotiView>
      </View>

      {/* Actions */}
      <MotiView
        from={{ opacity: 0, translateY: 30 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400, delay: 200 }}
        style={styles.actions}
      >
        <Button
          onPress={handleVerify}
          size="lg"
          fullWidth
          loading={isVerifying}
          disabled={code.length < 3}
        >
          Verify
        </Button>

        <Button
          onPress={handleResend}
          variant="secondary"
          size="md"
          fullWidth
          loading={isResending}
          disabled={resendCooldown > 0}
        >
          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
        </Button>

        <Pressable onPress={handleChangeEmail} style={styles.changeEmail}>
          <Text style={styles.changeEmailText}>Use a different email</Text>
        </Pressable>
      </MotiView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: spacing.xl,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
  email: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  hint: {
    fontSize: fontSize.sm,
    color: colors.textSubtle,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  inputContainer: {
    width: '100%',
    marginTop: spacing.xl,
  },
  codeInput: {
    textAlign: 'center',
    fontSize: fontSize.xl,
    letterSpacing: 8,
  },
  actions: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  changeEmail: {
    alignItems: 'center',
    padding: spacing.sm,
  },
  changeEmailText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
});
