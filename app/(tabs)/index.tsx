import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from '../../lib/moti-shim';
import { useState, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { Card, Avatar, Button, ProgressBar } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { useCompliments, type ComplimentWithDetails } from '../../hooks/useCompliments';
import { getReactionEmoji } from '../../hooks/useReactions';
import { colors, spacing, fontSize, fontWeight, levels } from '../../lib/constants';

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

function ComplimentCard({ compliment, isNew }: { compliment: ComplimentWithDetails; isNew: boolean }) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/compliment/${compliment.id}`);
  };

  return (
    <Card
      variant={isNew ? 'glow' : 'default'}
      style={styles.complimentCard}
      onPress={handlePress}
    >
      <View style={styles.complimentHeader}>
        <View style={styles.complimentEmojiContainer}>
          <Text style={styles.complimentEmoji}>{compliment.template?.emoji}</Text>
        </View>
        <View style={styles.complimentMeta}>
          {isNew && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}
          <Text style={styles.complimentTime}>{formatTimeAgo(compliment.created_at)}</Text>
        </View>
      </View>
      <Text style={styles.complimentText} numberOfLines={2}>
        {compliment.template?.text}
      </Text>
      <View style={styles.complimentFooter}>
        {!compliment.is_revealed && compliment.guesses_remaining > 0 ? (
          <View style={styles.guessContainer}>
            <Text style={styles.guessPrompt}>Guess who sent this</Text>
            <Text style={styles.guessArrow}>→</Text>
          </View>
        ) : compliment.is_revealed && compliment.sender ? (
          <View style={styles.revealedContainer}>
            <Avatar
              source={compliment.sender.avatar_url}
              name={compliment.sender.display_name}
              size="xs"
            />
            <Text style={styles.revealedFrom}>from @{compliment.sender.username}</Text>
          </View>
        ) : (
          <Text style={styles.mysteryText}>Mystery sender</Text>
        )}
        {/* Show reaction if any */}
        {(compliment as any).reaction && (
          <View style={styles.reactionBadge}>
            <Text style={styles.reactionBadgeEmoji}>{getReactionEmoji((compliment as any).reaction)}</Text>
          </View>
        )}
      </View>
    </Card>
  );
}

export default function HomeScreen() {
  const { user, fetchUserProfile } = useAuthStore();
  const { received, unreadCount, isLoading, refetch } = useCompliments();
  const [refreshing, setRefreshing] = useState(false);

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

  const pointsToNext = nextLevel
    ? nextLevel.minPoints - (user?.oomf_score ?? 0)
    : 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetch(), fetchUserProfile()]);
    setRefreshing(false);
  }, [refetch, fetchUserProfile]);

  const unreadCompliments = received.filter(c => !c.is_read);
  const readCompliments = received.filter(c => c.is_read);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.logo}>oomf</Text>
          <Text style={styles.tagline}>spread the love</Text>
        </View>
        <Pressable
          onPress={() => router.push('/(tabs)/profile')}
          style={styles.avatarContainer}
        >
          <Avatar
            source={user?.avatar_url}
            name={user?.display_name}
            size="md"
          />
          {unreadCount > 0 && (
            <View style={styles.notificationDot} />
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Score Card */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400 }}
        >
          <Card variant="elevated" style={styles.scoreCard}>
            <View style={styles.scoreTop}>
              <View style={styles.levelSection}>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelEmoji}>{currentLevel.emoji}</Text>
                </View>
                <View>
                  <Text style={styles.levelName}>{currentLevel.name}</Text>
                  <Text style={styles.levelLabel}>Level {currentLevel.level}</Text>
                </View>
              </View>
              <Pressable
                style={styles.leaderboardButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/leaderboard' as any);
                }}
              >
                <Ionicons name="trophy" size={16} color={colors.secondary} />
                <Text style={styles.leaderboardButtonText}>Leaderboard</Text>
              </Pressable>
            </View>

            <View style={styles.scoreRow}>
              <View style={styles.scoreSection}>
                <Text style={styles.scoreValue}>{user?.oomf_score ?? 0}</Text>
                <Text style={styles.scoreLabel}>points</Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.tokenSection,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/shop' as any);
                }}
              >
                <Ionicons name="flash" size={16} color={colors.secondary} />
                <Text style={styles.tokenValue}>{user?.tokens ?? 0}</Text>
                <Ionicons name="add-circle" size={14} color={colors.secondary} />
              </Pressable>
            </View>

            <View style={styles.progressSection}>
              <ProgressBar progress={progress} height={8} />
              {nextLevel && (
                <Text style={styles.progressText}>
                  {pointsToNext} pts to {nextLevel.emoji} {nextLevel.name}
                </Text>
              )}
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <View style={styles.statValueRow}>
                  <Ionicons name="flame" size={18} color={colors.secondary} />
                  <Text style={styles.statValue}>{user?.streak_current ?? 0}</Text>
                </View>
                <Text style={styles.statLabel}>streak</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{user?.compliments_sent ?? 0}</Text>
                <Text style={styles.statLabel}>sent</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{user?.compliments_received ?? 0}</Text>
                <Text style={styles.statLabel}>received</Text>
              </View>
            </View>
          </Card>
        </MotiView>

        {/* Send Oomf CTA */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 50 }}
        >
          <Pressable
            style={({ pressed }) => [
              styles.sendCta,
              pressed && styles.sendCtaPressed
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/(tabs)/send');
            }}
          >
            <View style={styles.sendCtaIconContainer}>
              <Ionicons name="sparkles" size={28} color={colors.textInverse} />
            </View>
            <View style={styles.sendCtaText}>
              <Text style={styles.sendCtaTitle}>Send an Oomf</Text>
              <Text style={styles.sendCtaSubtitle}>Make someone's day</Text>
            </View>
            <Ionicons name="arrow-forward" size={24} color={colors.textInverse} />
          </Pressable>
        </MotiView>

        {/* Unread Compliments Section */}
        {unreadCount > 0 && (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 100 }}
            style={styles.section}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>New Oomfs</Text>
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            </View>

            {unreadCompliments.map((compliment, index) => (
              <MotiView
                key={compliment.id}
                from={{ opacity: 0, translateX: -20 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'timing', duration: 200, delay: index * 50 }}
              >
                <ComplimentCard compliment={compliment} isNew />
              </MotiView>
            ))}
          </MotiView>
        )}

        {/* Empty State */}
        {received.length === 0 && !isLoading && (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 100 }}
            style={styles.section}
          >
            <Card variant="elevated" style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>💌</Text>
              <Text style={styles.emptyTitle}>No oomfs yet</Text>
              <Text style={styles.emptySubtitle}>
                Add some friends and send compliments{'\n'}to start receiving them!
              </Text>
              <Button
                onPress={() => router.push('/(tabs)/friends')}
                variant="primary"
                size="lg"
                style={styles.emptyButton}
              >
                Add Friends
              </Button>
            </Card>
          </MotiView>
        )}

        {/* Previous Compliments */}
        {readCompliments.length > 0 && (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 200 }}
            style={styles.section}
          >
            <Text style={styles.sectionTitle}>Previous</Text>
            {readCompliments.slice(0, 10).map((compliment, index) => (
              <MotiView
                key={compliment.id}
                from={{ opacity: 0, translateX: -20 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'timing', duration: 200, delay: index * 30 }}
              >
                <ComplimentCard compliment={compliment} isNew={false} />
              </MotiView>
            ))}
          </MotiView>
        )}

        {/* Bottom Spacer */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerLeft: {},
  logo: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    color: colors.primary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: -2,
  },
  avatarContainer: {
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.error,
    borderWidth: 2,
    borderColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  scoreCard: {
    padding: spacing.lg,
  },
  scoreTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  leaderboardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: `${colors.secondary}20`,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  leaderboardButtonText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.secondary,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  levelSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  levelBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  levelEmoji: {
    fontSize: 24,
  },
  levelName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  levelLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  scoreSection: {
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
  tokenSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: `${colors.secondary}20`,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
  },
  tokenValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.secondary,
  },
  tokenLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  progressSection: {
    marginBottom: spacing.lg,
  },
  progressText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  sendCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  sendCtaPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  sendCtaIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  sendCtaText: {
    flex: 1,
  },
  sendCtaTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },
  sendCtaSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textInverse,
    opacity: 0.8,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  unreadBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },
  complimentCard: {
    padding: spacing.md,
  },
  complimentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  complimentEmojiContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  complimentEmoji: {
    fontSize: 24,
  },
  complimentMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  newBadge: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: 0.5,
  },
  complimentTime: {
    fontSize: fontSize.xs,
    color: colors.textSubtle,
  },
  complimentText: {
    fontSize: fontSize.base,
    color: colors.text,
    fontWeight: fontWeight.medium,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  complimentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  guessContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  guessPrompt: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  guessArrow: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },
  revealedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  revealedFrom: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  mysteryText: {
    fontSize: fontSize.sm,
    color: colors.textSubtle,
    fontStyle: 'italic',
  },
  reactionBadge: {
    marginLeft: 'auto',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionBadgeEmoji: {
    fontSize: 16,
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  emptyButton: {
    minWidth: 200,
  },
  bottomSpacer: {
    height: spacing.xl,
  },
});
