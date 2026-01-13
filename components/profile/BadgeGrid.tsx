import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MotiView } from '../../lib/moti-shim';
import * as Haptics from 'expo-haptics';
import { colors, spacing, fontSize, fontWeight } from '../../lib/constants';
import type { Badge } from '../../hooks/useBadges';

type BadgeGridProps = {
  badges: Badge[];
  earnedBadgeIds: Set<string>;
  onBadgePress?: (badge: Badge) => void;
  showLocked?: boolean;
  columns?: number;
};

type BadgeItemProps = {
  badge: Badge;
  earned: boolean;
  index: number;
  onPress?: () => void;
};

function BadgeItem({ badge, earned, index, onPress }: BadgeItemProps) {
  return (
    <MotiView
      from={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', delay: index * 50 }}
    >
      <Pressable
        style={({ pressed }) => [
          styles.badgeItem,
          !earned && styles.badgeItemLocked,
          pressed && styles.badgeItemPressed,
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress?.();
        }}
      >
        <View style={[styles.badgeEmoji, !earned && styles.badgeEmojiLocked]}>
          <Text style={[styles.emojiText, !earned && styles.emojiTextLocked]}>
            {badge.emoji}
          </Text>
        </View>
        <Text
          style={[styles.badgeName, !earned && styles.badgeNameLocked]}
          numberOfLines={2}
        >
          {badge.name}
        </Text>
        {earned && <View style={styles.earnedIndicator} />}
      </Pressable>
    </MotiView>
  );
}

export function BadgeGrid({
  badges,
  earnedBadgeIds,
  onBadgePress,
  showLocked = true,
  columns = 4,
}: BadgeGridProps) {
  const displayBadges = showLocked
    ? badges
    : badges.filter(b => earnedBadgeIds.has(b.id));

  if (displayBadges.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No badges yet</Text>
        <Text style={styles.emptySubtext}>Keep sending oomfs to earn badges!</Text>
      </View>
    );
  }

  return (
    <View style={[styles.grid, { gap: spacing.sm }]}>
      {displayBadges.map((badge, index) => (
        <View key={badge.id} style={{ width: `${100 / columns - 2}%` }}>
          <BadgeItem
            badge={badge}
            earned={earnedBadgeIds.has(badge.id)}
            index={index}
            onPress={() => onBadgePress?.(badge)}
          />
        </View>
      ))}
    </View>
  );
}

export function BadgeShowcase({
  badges,
  earnedBadgeIds,
  maxDisplay = 5,
  onSeeAll,
}: {
  badges: Badge[];
  earnedBadgeIds: Set<string>;
  maxDisplay?: number;
  onSeeAll?: () => void;
}) {
  const earnedBadges = badges.filter(b => earnedBadgeIds.has(b.id));
  const displayBadges = earnedBadges.slice(0, maxDisplay);
  const remaining = earnedBadges.length - maxDisplay;

  if (earnedBadges.length === 0) {
    return null;
  }

  return (
    <View style={styles.showcaseContainer}>
      <View style={styles.showcaseBadges}>
        {displayBadges.map((badge, index) => (
          <MotiView
            key={badge.id}
            from={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', delay: index * 100 }}
            style={[
              styles.showcaseBadge,
              { marginLeft: index > 0 ? -8 : 0, zIndex: maxDisplay - index },
            ]}
          >
            <Text style={styles.showcaseEmoji}>{badge.emoji}</Text>
          </MotiView>
        ))}
        {remaining > 0 && (
          <Pressable
            style={[styles.showcaseBadge, styles.moreButton, { marginLeft: -8 }]}
            onPress={onSeeAll}
          >
            <Text style={styles.moreText}>+{remaining}</Text>
          </Pressable>
        )}
      </View>
      {earnedBadges.length > 0 && (
        <Pressable onPress={onSeeAll}>
          <Text style={styles.badgeCount}>
            {earnedBadges.length} badge{earnedBadges.length === 1 ? '' : 's'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  badgeItem: {
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  badgeItemLocked: {
    opacity: 0.5,
  },
  badgeItemPressed: {
    transform: [{ scale: 0.95 }],
    backgroundColor: colors.card,
  },
  badgeEmoji: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  badgeEmojiLocked: {
    backgroundColor: colors.surface,
  },
  emojiText: {
    fontSize: 24,
  },
  emojiTextLocked: {
    opacity: 0.3,
  },
  badgeName: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.text,
    textAlign: 'center',
  },
  badgeNameLocked: {
    color: colors.textMuted,
  },
  earnedIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.textSubtle,
    marginTop: spacing.xs,
  },
  showcaseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  showcaseBadges: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  showcaseBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  showcaseEmoji: {
    fontSize: 18,
  },
  moreButton: {
    backgroundColor: colors.surface,
  },
  moreText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
  },
  badgeCount: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
});
