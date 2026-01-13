import { View, Text, StyleSheet, Share, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from '../../lib/moti-shim';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Button, Card } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, fontSize, fontWeight } from '../../lib/constants';
import { useState } from 'react';

export default function AddFriendsScreen() {
  const { user } = useAuthStore();
  const [copied, setCopied] = useState(false);

  const profileLink = `oomf.app/${user?.username || ''}`;

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(profileLink);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Add me on Oomf! ${profileLink}`,
        url: `https://${profileLink}`,
      });
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  const handleDone = () => {
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <MotiView
          from={{ opacity: 0, translateY: -20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400 }}
        >
          <Text style={styles.title}>Oomf is better with friends</Text>
          <Text style={styles.subtitle}>
            Share your link to start sending and receiving compliments
          </Text>
        </MotiView>

        {/* Link Card */}
        <MotiView
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 15, delay: 100 }}
          style={styles.linkContainer}
        >
          <Card style={styles.linkCard}>
            <Text style={styles.linkLabel}>Your Oomf link</Text>
            <Text style={styles.linkText}>{profileLink}</Text>

            <View style={styles.linkActions}>
              <Pressable
                style={[styles.linkButton, copied && styles.linkButtonActive]}
                onPress={handleCopyLink}
              >
                <Ionicons
                  name={copied ? "checkmark" : "copy-outline"}
                  size={18}
                  color={copied ? colors.textInverse : colors.text}
                />
                <Text style={[styles.linkButtonText, copied && styles.linkButtonTextActive]}>
                  {copied ? 'Copied!' : 'Copy'}
                </Text>
              </Pressable>

              <Pressable style={styles.linkButton} onPress={handleShare}>
                <Ionicons name="share-outline" size={18} color={colors.text} />
                <Text style={styles.linkButtonText}>Share</Text>
              </Pressable>
            </View>
          </Card>
        </MotiView>

        {/* Tips */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 200 }}
          style={styles.tips}
        >
          <TipItem icon="phone-portrait-outline" color={colors.primary} text="Share on your socials" />
          <TipItem icon="chatbubbles-outline" color={colors.secondary} text="Send to your group chats" />
          <TipItem icon="people-outline" color={colors.success} text="You need at least 3 friends to play" />
        </MotiView>
      </View>

      {/* CTAs */}
      <MotiView
        from={{ opacity: 0, translateY: 30 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400, delay: 300 }}
        style={styles.cta}
      >
        <Button onPress={handleDone} size="lg" fullWidth>
          Done
        </Button>

        <Pressable onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>I'll do this later</Text>
        </Pressable>
      </MotiView>
    </SafeAreaView>
  );
}

function TipItem({ icon, color, text }: { icon: keyof typeof Ionicons.glyphMap; color: string; text: string }) {
  return (
    <View style={styles.tipItem}>
      <View style={[styles.tipIconContainer, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.tipText}>{text}</Text>
    </View>
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
  linkContainer: {
    marginBottom: spacing.xl,
  },
  linkCard: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  linkLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  linkText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginBottom: spacing.lg,
  },
  linkActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  linkButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  linkButtonTextActive: {
    color: colors.textInverse,
  },
  tips: {
    gap: spacing.md,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  tipIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    fontSize: fontSize.base,
    color: colors.textMuted,
  },
  cta: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  skipButton: {
    alignItems: 'center',
    padding: spacing.sm,
  },
  skipText: {
    fontSize: fontSize.sm,
    color: colors.textSubtle,
  },
});
