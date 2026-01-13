import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActionSheetIOS, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from '../../lib/moti-shim';
import * as Haptics from 'expo-haptics';
import { Card, Avatar, Button, ProgressBar } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useFriends } from '../../hooks/useFriends';
import { useBlock } from '../../hooks/useBlock';
import { colors, spacing, fontSize, fontWeight, levels } from '../../lib/constants';
import type { User } from '../../types/database';

function getLevelInfo(oomfScore: number) {
  const level = levels.find((l, i) => {
    const nextLevel = levels[i + 1];
    return !nextLevel || oomfScore < nextLevel.minPoints;
  }) || levels[0];
  return level;
}

type StatItemProps = {
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  value: number | string;
  label: string;
};

function StatItem({ iconName, iconColor = colors.primary, value, label }: StatItemProps) {
  return (
    <View style={styles.statItem}>
      <View style={[styles.statIconContainer, { backgroundColor: `${iconColor}20` }]}>
        <Ionicons name={iconName} size={18} color={iconColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { user: currentUser } = useAuthStore();
  const { friends, sendFriendRequest, pendingOutgoing, removeFriend } = useFriends();
  const { blockUser, isUserBlocked, hasBlockBetween } = useBlock();

  const [profile, setProfile] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [isBlockedByThem, setIsBlockedByThem] = useState(false);

  // Check friendship status
  const isFriend = friends.some(f => f.friend.username === username);
  const isPending = pendingOutgoing.some(f => f.friend.username === username);
  const isOwnProfile = currentUser?.username === username;

  useEffect(() => {
    const fetchProfile = async () => {
      if (!username) return;

      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('username', username.toLowerCase())
          .single();

        if (error) throw error;
        setProfile(data as User);

        // Check if they blocked us
        if (data && currentUser) {
          const blocked = await hasBlockBetween(data.id);
          if (blocked && !isUserBlocked(data.id)) {
            setIsBlockedByThem(true);
          }
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        Alert.alert('Error', 'User not found');
        router.back();
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [username, currentUser, hasBlockBetween, isUserBlocked]);

  const handleSendRequest = async () => {
    if (!username) return;

    setIsSendingRequest(true);
    try {
      await sendFriendRequest(username);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Friend request sent!');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.message || 'Failed to send request');
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleSendCompliment = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Navigate to send screen with this user preselected
    router.push({
      pathname: '/(tabs)/send',
      params: { preselectedUser: username },
    });
  };

  const handleBlockUser = async () => {
    if (!profile) return;

    Alert.alert(
      'Block User',
      `Are you sure you want to block @${profile.username}? They won't be able to send you friend requests or compliments.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setIsBlocking(true);
            try {
              await blockUser(profile.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Blocked', `@${profile.username} has been blocked.`);
              router.back();
            } catch (err: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', err.message || 'Failed to block user');
            } finally {
              setIsBlocking(false);
            }
          },
        },
      ]
    );
  };

  const handleRemoveFriend = async () => {
    if (!profile) return;

    const friendship = friends.find(f => f.friend.id === profile.id);
    if (!friendship) return;

    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove @${profile.username} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFriend(friendship.friendship_id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', err.message || 'Failed to remove friend');
            }
          },
        },
      ]
    );
  };

  const showMoreOptions = () => {
    if (Platform.OS === 'ios') {
      const options = isFriend
        ? ['Cancel', 'Remove Friend', 'Block User']
        : ['Cancel', 'Block User'];
      const destructiveButtonIndex = isFriend ? 2 : 1;
      const cancelButtonIndex = 0;

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          destructiveButtonIndex,
          cancelButtonIndex,
        },
        (buttonIndex) => {
          if (isFriend) {
            if (buttonIndex === 1) handleRemoveFriend();
            if (buttonIndex === 2) handleBlockUser();
          } else {
            if (buttonIndex === 1) handleBlockUser();
          }
        }
      );
    } else {
      // Android fallback
      Alert.alert(
        'Options',
        undefined,
        isFriend
          ? [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove Friend', onPress: handleRemoveFriend },
              { text: 'Block User', style: 'destructive', onPress: handleBlockUser },
            ]
          : [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Block User', style: 'destructive', onPress: handleBlockUser },
            ]
      );
    }
  };

  if (isLoading || !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingIcon}>
            <Ionicons name="person" size={32} color={colors.primary} />
          </View>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const levelInfo = getLevelInfo(profile.oomf_score || 0);
  const nextLevel = levels[levels.indexOf(levelInfo) + 1];
  const progress = nextLevel
    ? ((profile.oomf_score || 0) - levelInfo.minPoints) /
      (nextLevel.minPoints - levelInfo.minPoints) *
      100
    : 100;

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
        <Text style={styles.headerTitle}>@{profile.username}</Text>
        {!isOwnProfile ? (
          <Pressable
            onPress={showMoreOptions}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
          >
            <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.backButton} />
        )}
      </View>

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
            <View style={styles.avatarContainer}>
              <Avatar
                source={profile.avatar_url}
                name={profile.display_name}
                size="xl"
              />
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeEmoji}>{levelInfo.emoji}</Text>
              </View>
            </View>

            <Text style={styles.displayName}>{profile.display_name}</Text>
            <Text style={styles.username}>@{profile.username}</Text>

            {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

            {/* Level & Score Banner */}
            <View style={styles.scoreBanner}>
              <View style={styles.scoreMain}>
                <Text style={styles.scoreValue}>{profile.oomf_score || 0}</Text>
                <Text style={styles.scoreLabel}>oomf points</Text>
              </View>
              <View style={styles.scoreDivider} />
              <View style={styles.levelSection}>
                <Text style={styles.levelName}>{levelInfo.name}</Text>
                <Text style={styles.levelNumber}>Level {levelInfo.level}</Text>
              </View>
            </View>
          </View>
        </MotiView>

        {/* Action Buttons */}
        {!isOwnProfile && (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 50 }}
            style={styles.actionButtons}
          >
            {isFriend ? (
              <Pressable
                style={({ pressed }) => [
                  styles.sendOomfButton,
                  pressed && styles.sendOomfButtonPressed,
                ]}
                onPress={handleSendCompliment}
              >
                <Ionicons name="heart" size={20} color={colors.textInverse} />
                <Text style={styles.sendOomfButtonText}>Send Oomf</Text>
              </Pressable>
            ) : isPending ? (
              <View style={styles.pendingButton}>
                <Ionicons name="time-outline" size={20} color={colors.textMuted} />
                <Text style={styles.pendingButtonText}>Request Pending</Text>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.addFriendButton,
                  pressed && styles.addFriendButtonPressed,
                ]}
                onPress={handleSendRequest}
                disabled={isSendingRequest}
              >
                {isSendingRequest ? (
                  <Text style={styles.addFriendButtonText}>Sending...</Text>
                ) : (
                  <>
                    <Ionicons name="person-add" size={20} color={colors.textInverse} />
                    <Text style={styles.addFriendButtonText}>Add Friend</Text>
                  </>
                )}
              </Pressable>
            )}
          </MotiView>
        )}

        {/* Stats Card */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 100 }}
        >
          <Card style={styles.statsCard} variant="elevated">
            <Text style={styles.statsTitle}>Stats</Text>
            <View style={styles.statsGrid}>
              <StatItem
                iconName="send"
                iconColor={colors.primary}
                value={profile.compliments_sent || 0}
                label="Sent"
              />
              <StatItem
                iconName="heart"
                iconColor={colors.error}
                value={profile.compliments_received || 0}
                label="Received"
              />
              <StatItem
                iconName="checkmark-circle"
                iconColor={colors.success}
                value={profile.correct_guesses || 0}
                label="Guessed"
              />
              <StatItem
                iconName="flame"
                iconColor={colors.secondary}
                value={profile.streak_current || 0}
                label="Streak"
              />
            </View>
          </Card>
        </MotiView>

        {/* Progress Card */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 150 }}
        >
          <Card style={styles.progressCard} variant="elevated">
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Level Progress</Text>
              {nextLevel && (
                <View style={styles.nextLevelBadge}>
                  <Text style={styles.nextLevelEmoji}>{nextLevel.emoji}</Text>
                  <Text style={styles.nextLevelName}>{nextLevel.name}</Text>
                </View>
              )}
            </View>

            <ProgressBar progress={progress} height={10} />

            <View style={styles.progressFooter}>
              {nextLevel ? (
                <Text style={styles.progressText}>
                  <Text style={styles.progressHighlight}>
                    {nextLevel.minPoints - (profile.oomf_score || 0)}
                  </Text>{' '}
                  points to {nextLevel.name}
                </Text>
              ) : (
                <View style={styles.maxLevelContainer}>
                  <Ionicons name="trophy" size={16} color={colors.primary} />
                  <Text style={styles.maxLevelText}>Max level reached!</Text>
                </View>
              )}
            </View>
          </Card>
        </MotiView>

        {/* Member Since */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 200 }}
        >
          <View style={styles.memberSince}>
            <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
            <Text style={styles.memberSinceText}>
              Member since {new Date(profile.created_at).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          </View>
        </MotiView>

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
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: fontSize.base,
    color: colors.textMuted,
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
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.md,
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

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  sendOomfButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  sendOomfButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  sendOomfButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },
  addFriendButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    borderRadius: 12,
  },
  addFriendButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  addFriendButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },
  pendingButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pendingButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
  maxLevelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  maxLevelText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },

  // Member Since
  memberSince: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  memberSinceText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  bottomSpacer: {
    height: spacing.xl,
  },
});
