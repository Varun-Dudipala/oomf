import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Dimensions, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from '../../lib/moti-shim';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Share } from 'react-native';
import { useState, useEffect } from 'react';
import { Card, Avatar, Button, ProgressBar } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { useBadges, type Badge } from '../../hooks/useBadges';
import { BadgeShowcase, BadgeGrid } from '../../components/profile/BadgeGrid';
import { colors, spacing, fontSize, fontWeight, levels } from '../../lib/constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type StatItemProps = {
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  value: number | string;
  label: string;
};

function StatItem({ iconName, iconColor = colors.primary, value, label }: StatItemProps) {
  return (
    <View style={styles.statItem}>
      <View style={styles.statIconContainer}>
        <Ionicons name={iconName} size={20} color={iconColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, signOut } = useAuthStore();
  const { badges, earnedBadgeIds, checkBadges, getNewlyAwardedBadges } = useBadges();
  const [copied, setCopied] = useState(false);
  const [showBadgesModal, setShowBadgesModal] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  // Check for new badges on mount
  useEffect(() => {
    const checkNewBadges = async () => {
      const newBadges = await getNewlyAwardedBadges();
      if (newBadges.length > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Show notification for new badges
        const badgeNames = newBadges.map(b => `${b.badge_emoji} ${b.badge_name}`).join(', ');
        Alert.alert('New Badge!', `You earned: ${badgeNames}`);
      }
    };
    checkNewBadges();
  }, []);

  // Calculate level progress
  const currentLevel = levels.find((l, i) => {
    const nextLevel = levels[i + 1];
    return !nextLevel || (user?.oomf_score ?? 0) < nextLevel.minPoints;
  }) || levels[0];

  const nextLevel = levels[levels.indexOf(currentLevel) + 1];
  const progress = nextLevel
    ? ((user?.oomf_score ?? 0) - currentLevel.minPoints) /
      (nextLevel.minPoints - currentLevel.minPoints) *
      100
    : 100;

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

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)');
          },
        },
      ]
    );
  };

  const pointsToNext = nextLevel
    ? nextLevel.minPoints - (user?.oomf_score ?? 0)
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400 }}
        >
          <View style={styles.profileHeader}>
            <View style={styles.avatarSection}>
              <View style={styles.avatarContainer}>
                <Avatar
                  source={user?.avatar_url}
                  name={user?.display_name}
                  size="xl"
                />
                <View style={styles.levelBadge}>
                  <Text style={styles.levelBadgeEmoji}>{currentLevel.emoji}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.displayName}>{user?.display_name}</Text>
            <Text style={styles.username}>@{user?.username}</Text>

            {user?.bio && <Text style={styles.bio}>{user.bio}</Text>}

            {/* Score Banner */}
            <View style={styles.scoreBanner}>
              <View style={styles.scoreMain}>
                <Text style={styles.scoreValue}>{user?.oomf_score ?? 0}</Text>
                <Text style={styles.scoreLabel}>oomf points</Text>
              </View>
              <View style={styles.scoreDivider} />
              <View style={styles.levelSection}>
                <Text style={styles.levelName}>{currentLevel.name}</Text>
                <Text style={styles.levelNumber}>Level {currentLevel.level}</Text>
              </View>
            </View>
          </View>
        </MotiView>

        {/* Progress Card */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 50 }}
        >
          <Card style={styles.progressCard} variant="elevated">
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Progress to Next Level</Text>
              {nextLevel && (
                <View style={styles.nextLevelBadge}>
                  <Text style={styles.nextLevelEmoji}>{nextLevel.emoji}</Text>
                  <Text style={styles.nextLevelName}>{nextLevel.name}</Text>
                </View>
              )}
            </View>

            <ProgressBar progress={progress} height={12} />

            <View style={styles.progressFooter}>
              {nextLevel ? (
                <Text style={styles.progressText}>
                  <Text style={styles.progressHighlight}>{pointsToNext}</Text> points to go
                </Text>
              ) : (
                <Text style={styles.progressText}>Max level reached!</Text>
              )}
            </View>
          </Card>
        </MotiView>

        {/* Stats Grid */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 100 }}
        >
          <Card style={styles.statsCard} variant="elevated">
            <Text style={styles.statsTitle}>Your Stats</Text>
            <View style={styles.statsGrid}>
              <StatItem iconName="send" iconColor={colors.primary} value={user?.compliments_sent ?? 0} label="Sent" />
              <StatItem iconName="heart" iconColor={colors.error} value={user?.compliments_received ?? 0} label="Received" />
              <StatItem iconName="checkmark-circle" iconColor={colors.success} value={user?.correct_guesses ?? 0} label="Guessed" />
              <StatItem iconName="flame" iconColor={colors.secondary} value={user?.streak_current ?? 0} label="Streak" />
            </View>
          </Card>
        </MotiView>

        {/* Badges Section */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 125 }}
        >
          <Card style={styles.badgesCard} variant="elevated">
            <View style={styles.badgesHeader}>
              <Text style={styles.statsTitle}>Badges</Text>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowBadgesModal(true);
                }}
              >
                <Text style={styles.seeAllText}>See all</Text>
              </Pressable>
            </View>
            <BadgeShowcase
              badges={badges}
              earnedBadgeIds={earnedBadgeIds}
              maxDisplay={5}
              onSeeAll={() => setShowBadgesModal(true)}
            />
            {earnedBadgeIds.size === 0 && (
              <Text style={styles.noBadgesText}>
                Keep sending oomfs to earn badges!
              </Text>
            )}
          </Card>
        </MotiView>

        {/* Share Link */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 150 }}
        >
          <Card style={styles.shareCard} variant="elevated">
            <View style={styles.shareHeader}>
              <View style={styles.shareIconContainer}>
                <Ionicons name="link" size={22} color={colors.primary} />
              </View>
              <View style={styles.shareTitleSection}>
                <Text style={styles.shareTitle}>Your Oomf Link</Text>
                <Text style={styles.shareSubtitle}>Share to add friends</Text>
              </View>
            </View>

            <View style={styles.shareLinkContainer}>
              <Text style={styles.shareLink}>{profileLink}</Text>
            </View>

            <View style={styles.shareActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.shareButton,
                  copied && styles.shareButtonActive,
                  pressed && styles.shareButtonPressed,
                ]}
                onPress={handleCopyLink}
              >
                <Ionicons
                  name={copied ? 'checkmark' : 'copy-outline'}
                  size={16}
                  color={copied ? colors.textInverse : colors.text}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.shareButtonText, copied && styles.shareButtonTextActive]}>
                  {copied ? 'Copied!' : 'Copy'}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.shareButton,
                  styles.shareButtonPrimary,
                  pressed && styles.shareButtonPressed,
                ]}
                onPress={handleShare}
              >
                <Ionicons name="share-outline" size={16} color={colors.textInverse} style={{ marginRight: 6 }} />
                <Text style={[styles.shareButtonText, styles.shareButtonTextPrimary]}>
                  Share
                </Text>
              </Pressable>
            </View>
          </Card>
        </MotiView>

        {/* Settings */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 200 }}
          style={styles.settingsSection}
        >
          <Text style={styles.sectionTitle}>Settings</Text>

          <Pressable
            style={({ pressed }) => [
              styles.settingsItem,
              pressed && styles.settingsItemPressed,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/settings');
            }}
          >
            <View style={styles.settingsItemLeft}>
              <View style={styles.settingsItemIcon}>
                <Ionicons name="settings-outline" size={20} color={colors.text} />
              </View>
              <Text style={styles.settingsItemText}>Settings & Profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.settingsItem,
              styles.signOutItem,
              pressed && styles.settingsItemPressed,
            ]}
            onPress={handleSignOut}
          >
            <View style={styles.settingsItemLeft}>
              <View style={[styles.settingsItemIcon, styles.signOutIcon]}>
                <Ionicons name="log-out-outline" size={20} color={colors.error} />
              </View>
              <Text style={styles.signOutText}>Sign Out</Text>
            </View>
          </Pressable>
        </MotiView>

        {/* Bottom Spacer */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Badges Modal */}
      <Modal
        visible={showBadgesModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowBadgesModal(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setShowBadgesModal(false)}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.modalTitle}>All Badges</Text>
            <View style={styles.modalCloseButton} />
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalSubtitle}>
              {earnedBadgeIds.size} of {badges.length} badges earned
            </Text>
            <BadgeGrid
              badges={badges}
              earnedBadgeIds={earnedBadgeIds}
              showLocked={true}
              columns={3}
              onBadgePress={(badge) => {
                setSelectedBadge(badge);
              }}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Badge Detail Modal */}
      <Modal
        visible={!!selectedBadge}
        animationType="fade"
        transparent
        onRequestClose={() => setSelectedBadge(null)}
      >
        <Pressable
          style={styles.badgeDetailOverlay}
          onPress={() => setSelectedBadge(null)}
        >
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 15 }}
          >
            <View style={styles.badgeDetailCard}>
              <View style={[
                styles.badgeDetailEmoji,
                !earnedBadgeIds.has(selectedBadge?.id || '') && styles.badgeDetailEmojiLocked,
              ]}>
                <Text style={styles.badgeDetailEmojiText}>
                  {selectedBadge?.emoji}
                </Text>
              </View>
              <Text style={styles.badgeDetailName}>{selectedBadge?.name}</Text>
              <Text style={styles.badgeDetailDesc}>
                {selectedBadge?.description}
              </Text>
              {earnedBadgeIds.has(selectedBadge?.id || '') ? (
                <View style={styles.badgeDetailEarned}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={styles.badgeDetailEarnedText}>Earned!</Text>
                </View>
              ) : (
                <Text style={styles.badgeDetailLocked}>
                  Keep going to unlock!
                </Text>
              )}
              <Pressable
                style={styles.badgeDetailClose}
                onPress={() => setSelectedBadge(null)}
              >
                <Text style={styles.badgeDetailCloseText}>Done</Text>
              </Pressable>
            </View>
          </MotiView>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },

  // Profile Header
  profileHeader: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  avatarSection: {
    marginBottom: spacing.md,
  },
  avatarContainer: {
    position: 'relative',
  },
  levelBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.primary,
  },
  levelBadgeEmoji: {
    fontSize: 16,
  },
  displayName: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  username: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  bio: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    maxWidth: '80%',
    lineHeight: 20,
  },

  // Score Banner
  scoreBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 16,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scoreMain: {
    flex: 1,
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  scoreLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  scoreDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  levelSection: {
    flex: 1,
    alignItems: 'center',
  },
  levelName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  levelNumber: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  // Progress Card
  progressCard: {
    padding: spacing.lg,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  progressTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
  },
  nextLevelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  nextLevelEmoji: {
    fontSize: 14,
  },
  nextLevelName: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  progressFooter: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  progressText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  progressHighlight: {
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },

  // Stats Card
  statsCard: {
    padding: spacing.lg,
  },
  statsTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Share Card
  shareCard: {
    padding: spacing.lg,
  },
  shareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  shareIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  shareTitleSection: {
    flex: 1,
  },
  shareTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  shareSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  shareLinkContainer: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 10,
    marginBottom: spacing.md,
  },
  shareLink: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
    textAlign: 'center',
  },
  shareActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  shareButtonActive: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  shareButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  shareButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  shareButtonTextPrimary: {
    color: colors.textInverse,
  },
  shareButtonTextActive: {
    color: colors.textInverse,
  },

  // Settings Section
  settingsSection: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  settingsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsItemPressed: {
    backgroundColor: colors.cardHover,
    transform: [{ scale: 0.98 }],
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  settingsItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsItemText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  signOutItem: {
    marginTop: spacing.sm,
  },
  signOutIcon: {
    backgroundColor: `${colors.error}20`,
  },
  signOutText: {
    fontSize: fontSize.base,
    color: colors.error,
    fontWeight: fontWeight.medium,
  },

  // Bottom Spacer
  bottomSpacer: {
    height: spacing.xl,
  },

  // Badges Card
  badgesCard: {
    padding: spacing.lg,
  },
  badgesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  seeAllText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  noBadgesText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalCloseButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  modalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  modalSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  // Badge Detail Modal
  badgeDetailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  badgeDetailCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: spacing.xl,
    alignItems: 'center',
    minWidth: 280,
  },
  badgeDetailEmoji: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  badgeDetailEmojiLocked: {
    opacity: 0.4,
  },
  badgeDetailEmojiText: {
    fontSize: 40,
  },
  badgeDetailName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  badgeDetailDesc: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  badgeDetailEarned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  badgeDetailEarnedText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.success,
  },
  badgeDetailLocked: {
    fontSize: fontSize.sm,
    color: colors.textSubtle,
    marginBottom: spacing.lg,
  },
  badgeDetailClose: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 12,
  },
  badgeDetailCloseText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textInverse,
  },
});
