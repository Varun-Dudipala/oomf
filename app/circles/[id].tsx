import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from '../../lib/moti-shim';
import * as Haptics from 'expo-haptics';
import { Card, Avatar, Button } from '../../components/ui';
import { useCircles, type Circle, type CircleMember } from '../../hooks/useCircles';
import { useFriends } from '../../hooks/useFriends';
import { colors, spacing, fontSize, fontWeight, levels } from '../../lib/constants';

function getLevelInfo(oomfScore: number) {
  const level = levels.find((l, i) => {
    const nextLevel = levels[i + 1];
    return !nextLevel || oomfScore < nextLevel.minPoints;
  }) || levels[0];
  return level;
}

function AddMemberModal({
  visible,
  onClose,
  onAdd,
  existingMemberIds,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (userId: string) => Promise<void>;
  existingMemberIds: string[];
}) {
  const { friends } = useFriends();
  const [isAdding, setIsAdding] = useState<string | null>(null);

  const availableFriends = friends.filter(
    (f) => !existingMemberIds.includes(f.friend.id)
  );

  const handleAdd = async (userId: string) => {
    setIsAdding(userId);
    try {
      await onAdd(userId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsAdding(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.addMemberModal}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Add Friends</Text>

          {availableFriends.length === 0 ? (
            <View style={styles.noFriendsContainer}>
              <Text style={styles.noFriendsEmoji}>👥</Text>
              <Text style={styles.noFriendsText}>
                All your friends are already in this circle!
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.friendsList} showsVerticalScrollIndicator={false}>
              {availableFriends.map((f) => {
                const level = getLevelInfo(f.friend.oomf_score || 0);
                return (
                  <Pressable
                    key={f.friend.id}
                    style={styles.friendItem}
                    onPress={() => handleAdd(f.friend.id)}
                    disabled={isAdding !== null}
                  >
                    <View style={styles.friendAvatarContainer}>
                      <Avatar
                        source={f.friend.avatar_url}
                        name={f.friend.display_name}
                        size="md"
                      />
                      <View style={styles.friendLevelBadge}>
                        <Text style={styles.friendLevelEmoji}>{level.emoji}</Text>
                      </View>
                    </View>
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName}>{f.friend.display_name}</Text>
                      <Text style={styles.friendUsername}>@{f.friend.username}</Text>
                    </View>
                    {isAdding === f.friend.id ? (
                      <Text style={styles.addingText}>Adding...</Text>
                    ) : (
                      <View style={styles.addIconContainer}>
                        <Ionicons name="add" size={20} color={colors.primary} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <Button onPress={onClose} variant="secondary" size="md" fullWidth>
            Done
          </Button>
        </View>
      </View>
    </Modal>
  );
}

export default function CircleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { circles, getCircleMembers, addMember, removeMember, deleteCircle, refetch } = useCircles();
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const circle = circles.find((c) => c.id === id);

  const fetchMembers = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    const data = await getCircleMembers(id);
    setMembers(data);
    setIsLoading(false);
  }, [id, getCircleMembers]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetch(), fetchMembers()]);
    setRefreshing(false);
  }, [refetch, fetchMembers]);

  const handleAddMember = async (userId: string) => {
    if (!id) return;
    const { error } = await addMember(id, userId);
    if (error) throw new Error(error);
    await fetchMembers();
  };

  const handleRemoveMember = (member: CircleMember) => {
    Alert.alert(
      'Remove Member',
      `Remove ${member.display_name} from this circle?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            const { error } = await removeMember(id, member.user_id);
            if (error) {
              Alert.alert('Error', error);
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await fetchMembers();
            }
          },
        },
      ]
    );
  };

  const handleDeleteCircle = () => {
    Alert.alert(
      'Delete Circle',
      'Are you sure you want to delete this circle? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            const { error } = await deleteCircle(id);
            if (error) {
              Alert.alert('Error', error);
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            }
          },
        },
      ]
    );
  };

  if (!circle) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundEmoji}>🔍</Text>
          <Text style={styles.notFoundText}>Circle not found</Text>
          <Button onPress={() => router.back()} variant="secondary" size="md">
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitle}>
          <View style={styles.circleTitleRow}>
            <Text style={styles.circleEmoji}>{circle.emoji}</Text>
            <Text style={styles.title}>{circle.name}</Text>
          </View>
          <Text style={styles.subtitle}>
            {members.length} member{members.length !== 1 ? 's' : ''}
          </Text>
        </View>
        {circle.is_owner && (
          <Pressable
            style={styles.deleteButton}
            onPress={handleDeleteCircle}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </Pressable>
        )}
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
        {/* Actions */}
        {circle.is_owner && (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400 }}
          >
            <Pressable
              style={({ pressed }) => [
                styles.addMemberCard,
                { borderColor: circle.color },
                pressed && styles.addMemberCardPressed,
              ]}
              onPress={() => setShowAddModal(true)}
            >
              <View style={[styles.addMemberIcon, { backgroundColor: `${circle.color}20` }]}>
                <Ionicons name="person-add" size={24} color={circle.color} />
              </View>
              <View style={styles.addMemberText}>
                <Text style={styles.addMemberTitle}>Add Friends</Text>
                <Text style={styles.addMemberSubtitle}>Invite friends to this circle</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          </MotiView>
        )}

        {/* Members List */}
        <View style={styles.membersSection}>
          <Text style={styles.sectionTitle}>Members</Text>

          {isLoading ? (
            <Text style={styles.loadingText}>Loading members...</Text>
          ) : members.length === 0 ? (
            <Card style={styles.emptyMembers}>
              <Text style={styles.emptyMembersText}>No members yet</Text>
            </Card>
          ) : (
            <View style={styles.membersList}>
              {members.map((member, index) => {
                const level = getLevelInfo(member.oomf_score || 0);
                return (
                  <MotiView
                    key={member.user_id}
                    from={{ opacity: 0, translateX: -20 }}
                    animate={{ opacity: 1, translateX: 0 }}
                    transition={{ type: 'timing', duration: 200, delay: index * 50 }}
                  >
                    <Pressable
                      style={styles.memberCard}
                      onLongPress={() => {
                        if (circle.is_owner && member.user_id !== circle.owner_id) {
                          handleRemoveMember(member);
                        }
                      }}
                    >
                      <View style={styles.memberAvatarContainer}>
                        <Avatar
                          source={member.avatar_url}
                          name={member.display_name}
                          size="md"
                        />
                        <View style={styles.memberLevelBadge}>
                          <Text style={styles.memberLevelEmoji}>{level.emoji}</Text>
                        </View>
                      </View>
                      <View style={styles.memberInfo}>
                        <View style={styles.memberNameRow}>
                          <Text style={styles.memberName}>{member.display_name}</Text>
                          {member.user_id === circle.owner_id && (
                            <View style={[styles.ownerTag, { backgroundColor: circle.color }]}>
                              <Ionicons name="star" size={10} color={colors.textInverse} />
                            </View>
                          )}
                        </View>
                        <Text style={styles.memberUsername}>@{member.username}</Text>
                      </View>
                      <View style={styles.memberScore}>
                        <Text style={styles.memberScoreValue}>{member.oomf_score || 0}</Text>
                        <Text style={styles.memberScoreLabel}>pts</Text>
                      </View>
                    </Pressable>
                  </MotiView>
                );
              })}
            </View>
          )}
        </View>

        {/* Hint for removing members */}
        {circle.is_owner && members.length > 1 && (
          <Text style={styles.hintText}>
            Long press on a member to remove them
          </Text>
        )}
      </ScrollView>

      <AddMemberModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddMember}
        existingMemberIds={members.map((m) => m.user_id)}
      />
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    marginLeft: spacing.md,
  },
  circleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  circleEmoji: {
    fontSize: 24,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.error}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },

  // Add Member Card
  addMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  addMemberCardPressed: {
    backgroundColor: colors.cardHover,
    transform: [{ scale: 0.98 }],
  },
  addMemberIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMemberText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  addMemberTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  addMemberSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Members Section
  membersSection: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  membersList: {
    gap: spacing.sm,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberAvatarContainer: {
    position: 'relative',
  },
  memberLevelBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  memberLevelEmoji: {
    fontSize: 10,
  },
  memberInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  memberName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  ownerTag: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberUsername: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  memberScore: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  memberScoreValue: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  memberScoreLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },

  // Loading & Empty
  loadingText: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  emptyMembers: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyMembersText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  hintText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Not Found
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  notFoundEmoji: {
    fontSize: 64,
  },
  notFoundText: {
    fontSize: fontSize.lg,
    color: colors.textMuted,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  addMemberModal: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    maxHeight: '70%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  noFriendsContainer: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  noFriendsEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  noFriendsText: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    textAlign: 'center',
  },
  friendsList: {
    maxHeight: 300,
    marginBottom: spacing.lg,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  friendAvatarContainer: {
    position: 'relative',
  },
  friendLevelBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  friendLevelEmoji: {
    fontSize: 9,
  },
  friendInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  friendName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  friendUsername: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  addIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addingText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
});
