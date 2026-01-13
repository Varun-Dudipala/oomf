import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from '../../lib/moti-shim';
import { useState, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { Card, Avatar } from '../../components/ui';
import { useLeaderboard, type LeaderboardEntry, type CategoryWinner, CATEGORY_INFO } from '../../hooks/useLeaderboard';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, fontSize, fontWeight } from '../../lib/constants';

const PODIUM_COLORS = {
  1: { bg: '#FFD700', text: '#000' }, // Gold
  2: { bg: '#C0C0C0', text: '#000' }, // Silver
  3: { bg: '#CD7F32', text: '#FFF' }, // Bronze
};

type PodiumItemProps = {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
  position: 1 | 2 | 3;
};

function PodiumItem({ entry, isCurrentUser, position }: PodiumItemProps) {
  const heights = { 1: 100, 2: 80, 3: 60 };
  const avatarSizes = { 1: 'lg', 2: 'md', 3: 'md' } as const;
  const podiumColor = PODIUM_COLORS[position];

  return (
    <MotiView
      from={{ opacity: 0, translateY: 50 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', delay: position * 100 }}
      style={[styles.podiumItem, position === 1 && styles.podiumItemFirst]}
    >
      <Pressable
        style={styles.podiumContent}
        onPress={() => router.push(`/user/${entry.username}`)}
      >
        <View style={[styles.podiumRankBadge, { backgroundColor: podiumColor.bg }]}>
          <Text style={[styles.podiumRankText, { color: podiumColor.text }]}>
            {position}
          </Text>
        </View>
        <Avatar
          source={entry.avatar_url}
          name={entry.display_name}
          size={avatarSizes[position]}
        />
        <Text style={[styles.podiumName, isCurrentUser && styles.podiumNameHighlight]} numberOfLines={1}>
          {entry.display_name}
        </Text>
        <Text style={styles.podiumScore}>{entry.total_activity}</Text>
      </Pressable>
      <View style={[styles.podiumBar, { height: heights[position], backgroundColor: podiumColor.bg }]}>
        <Text style={[styles.podiumBarText, { color: podiumColor.text }]}>
          {position === 1 ? '🏆' : position === 2 ? '🥈' : '🥉'}
        </Text>
      </View>
    </MotiView>
  );
}

type LeaderboardRowProps = {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
  index: number;
};

function CategoryWinnerItem({ winner, index }: { winner: CategoryWinner; index: number }) {
  const categoryInfo = CATEGORY_INFO[winner.category] || { emoji: '🏆', label: winner.category };

  return (
    <MotiView
      from={{ opacity: 0, translateX: -20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: 'timing', duration: 200, delay: index * 50 }}
    >
      <Pressable
        style={({ pressed }) => [
          styles.categoryWinnerItem,
          pressed && styles.categoryWinnerItemPressed,
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/user/${winner.username}`);
        }}
      >
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryEmoji}>{categoryInfo.emoji}</Text>
        </View>
        <View style={styles.categoryInfo}>
          <Text style={styles.categoryLabel}>{categoryInfo.label}</Text>
          <Text style={styles.categoryWinnerName}>@{winner.username}</Text>
        </View>
        <Avatar
          source={winner.avatar_url}
          name={winner.display_name}
          size="sm"
        />
      </Pressable>
    </MotiView>
  );
}

function LeaderboardRow({ entry, isCurrentUser, index }: LeaderboardRowProps) {
  return (
    <MotiView
      from={{ opacity: 0, translateX: -20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: 'timing', duration: 200, delay: index * 50 }}
    >
      <Pressable
        style={({ pressed }) => [
          styles.leaderboardRow,
          isCurrentUser && styles.leaderboardRowHighlight,
          pressed && styles.leaderboardRowPressed,
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/user/${entry.username}`);
        }}
      >
        <View style={styles.rankContainer}>
          <Text style={[styles.rankText, isCurrentUser && styles.rankTextHighlight]}>
            {entry.rank}
          </Text>
        </View>
        <Avatar
          source={entry.avatar_url}
          name={entry.display_name}
          size="sm"
        />
        <View style={styles.userInfo}>
          <Text style={[styles.userName, isCurrentUser && styles.userNameHighlight]} numberOfLines={1}>
            {entry.display_name}
          </Text>
          <Text style={styles.userHandle}>@{entry.username}</Text>
        </View>
        <View style={styles.scoreContainer}>
          <Text style={[styles.scoreText, isCurrentUser && styles.scoreTextHighlight]}>
            {entry.total_activity}
          </Text>
          <Text style={styles.scoreLabel}>oomfs</Text>
        </View>
      </Pressable>
    </MotiView>
  );
}

export default function LeaderboardScreen() {
  const { user } = useAuthStore();
  const {
    leaderboard,
    userRank,
    categoryWinners,
    isLoading,
    refetch,
    getWeekRange,
    getPodium,
    getRest,
  } = useLeaderboard();
  const [refreshing, setRefreshing] = useState(false);

  const weekRange = getWeekRange();
  const podium = getPodium();
  const rest = getRest();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Reorder podium for display: [2nd, 1st, 3rd]
  const podiumOrdered = [podium[1], podium[0], podium[2]].filter(Boolean);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Weekly Leaderboard</Text>
          <Text style={styles.weekRange}>{weekRange.label}</Text>
        </View>
        <View style={styles.backButton} />
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
        {/* Podium */}
        {podiumOrdered.length > 0 && (
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring' }}
          >
            <View style={styles.podiumContainer}>
              {podiumOrdered.map((entry, idx) => {
                if (!entry) return null;
                const position = idx === 1 ? 1 : idx === 0 ? 2 : 3;
                return (
                  <PodiumItem
                    key={entry.user_id}
                    entry={entry}
                    isCurrentUser={user?.id === entry.user_id}
                    position={position as 1 | 2 | 3}
                  />
                );
              })}
            </View>
          </MotiView>
        )}

        {/* Category Winners */}
        {categoryWinners.length > 0 && (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300, delay: 150 }}
          >
            <Text style={styles.sectionTitle}>Category Winners</Text>
            <Card style={styles.categoryWinnersCard}>
              {categoryWinners.map((winner, index) => (
                <CategoryWinnerItem
                  key={`${winner.category}-${winner.user_id}`}
                  winner={winner}
                  index={index}
                />
              ))}
            </Card>
          </MotiView>
        )}

        {/* User's Rank Card */}
        {userRank && userRank.rank > 3 && (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300, delay: 200 }}
          >
            <Card style={styles.yourRankCard} variant="elevated">
              <View style={styles.yourRankHeader}>
                <Text style={styles.yourRankTitle}>Your Rank</Text>
                <View style={styles.yourRankBadge}>
                  <Text style={styles.yourRankBadgeText}>#{userRank.rank}</Text>
                </View>
              </View>
              <View style={styles.yourRankStats}>
                <View style={styles.yourRankStat}>
                  <Text style={styles.yourRankStatValue}>{userRank.compliments_sent}</Text>
                  <Text style={styles.yourRankStatLabel}>sent</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.yourRankStat}>
                  <Text style={styles.yourRankStatValue}>{userRank.compliments_received}</Text>
                  <Text style={styles.yourRankStatLabel}>received</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.yourRankStat}>
                  <Text style={styles.yourRankStatValue}>{userRank.total_activity}</Text>
                  <Text style={styles.yourRankStatLabel}>total</Text>
                </View>
              </View>
            </Card>
          </MotiView>
        )}

        {/* Rest of Leaderboard */}
        {rest.length > 0 && (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300, delay: 300 }}
            style={styles.restContainer}
          >
            <Card style={styles.leaderboardCard}>
              {rest.map((entry, index) => (
                <LeaderboardRow
                  key={entry.user_id}
                  entry={entry}
                  isCurrentUser={user?.id === entry.user_id}
                  index={index}
                />
              ))}
            </Card>
          </MotiView>
        )}

        {/* Empty State */}
        {leaderboard.length === 0 && !isLoading && (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            style={styles.emptyContainer}
          >
            <Text style={styles.emptyEmoji}>🏆</Text>
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptySubtitle}>
              Start sending oomfs to climb the leaderboard!
            </Text>
          </MotiView>
        )}

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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  backButtonPressed: {
    backgroundColor: colors.surface,
  },
  headerCenter: {
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  weekRange: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },

  // Podium
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingTop: spacing.xl,
  },
  podiumItem: {
    alignItems: 'center',
    flex: 1,
    maxWidth: 120,
  },
  podiumItemFirst: {
    marginTop: -20,
  },
  podiumContent: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  podiumRankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  podiumRankText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  podiumName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginTop: spacing.xs,
    maxWidth: 80,
    textAlign: 'center',
  },
  podiumNameHighlight: {
    color: colors.primary,
  },
  podiumScore: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  podiumBar: {
    width: '80%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm,
  },
  podiumBarText: {
    fontSize: 20,
  },

  // Section Title
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },

  // Category Winners
  categoryWinnersCard: {
    padding: 0,
    overflow: 'hidden',
  },
  categoryWinnerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryWinnerItemPressed: {
    backgroundColor: colors.surface,
  },
  categoryBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryEmoji: {
    fontSize: 20,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  categoryWinnerName: {
    fontSize: fontSize.xs,
    color: colors.primary,
  },

  // Your Rank Card
  yourRankCard: {
    padding: spacing.lg,
  },
  yourRankHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  yourRankTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  yourRankBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  yourRankBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },
  yourRankStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  yourRankStat: {
    alignItems: 'center',
  },
  yourRankStatValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  yourRankStatLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },

  // Rest Container
  restContainer: {},
  leaderboardCard: {
    padding: 0,
    overflow: 'hidden',
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  leaderboardRowHighlight: {
    backgroundColor: `${colors.primary}10`,
  },
  leaderboardRowPressed: {
    backgroundColor: colors.surface,
  },
  rankContainer: {
    width: 28,
    alignItems: 'center',
  },
  rankText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
  },
  rankTextHighlight: {
    color: colors.primary,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  userNameHighlight: {
    color: colors.primary,
  },
  userHandle: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  scoreText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  scoreTextHighlight: {
    color: colors.primary,
  },
  scoreLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  // Empty State
  emptyContainer: {
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
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    textAlign: 'center',
  },

  bottomSpacer: {
    height: spacing.xl,
  },
});
