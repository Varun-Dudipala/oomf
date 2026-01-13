import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from '../../lib/moti-shim';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Share } from 'react-native';
import { Card, Avatar, Button, Input } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { useFriends, type FriendWithProfile } from '../../hooks/useFriends';
import { colors, spacing, fontSize, fontWeight, levels } from '../../lib/constants';
import { QRScanner } from '../../components/QRScanner';
import { QRCodeDisplay } from '../../components/QRCodeDisplay';

function getLevelInfo(oomfScore: number) {
  const level = levels.find((l, i) => {
    const nextLevel = levels[i + 1];
    return !nextLevel || oomfScore < nextLevel.minPoints;
  }) || levels[0];
  return level;
}

function AddFriendModal({
  visible,
  onClose,
  onSendRequest,
}: {
  visible: boolean;
  onClose: () => void;
  onSendRequest: (username: string) => Promise<void>;
}) {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await onSendRequest(username.trim().toLowerCase());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setUsername('');
      onClose();
      Alert.alert('Success', 'Friend request sent!');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err.message || 'Failed to send request');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setUsername('');
    setError('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.modalOverlay} onPress={handleClose}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="person-add" size={32} color={colors.primary} />
            </View>
            <Text style={styles.modalTitle}>Add Friend</Text>
            <Text style={styles.modalSubtitle}>
              Enter their username to send a friend request
            </Text>
          </View>

          <Input
            placeholder="username"
            prefix="@"
            value={username}
            onChangeText={(text) => {
              setUsername(text.replace(/[^a-zA-Z0-9_]/g, ''));
              setError('');
            }}
            error={error}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />

          <View style={styles.modalActions}>
            <Button
              onPress={handleClose}
              variant="secondary"
              size="md"
              style={styles.modalButton}
            >
              Cancel
            </Button>
            <Button
              onPress={handleSubmit}
              size="md"
              style={styles.modalButton}
              loading={isLoading}
            >
              Send Request
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FriendRequestCard({
  request,
  onAccept,
  onReject,
}: {
  request: FriendWithProfile;
  onAccept: () => void;
  onReject: () => void;
}) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await onAccept();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await onReject();
    } finally {
      setIsRejecting(false);
    }
  };

  const level = getLevelInfo(request.friend.oomf_score || 0);

  return (
    <Card style={styles.requestCard} variant="glow">
      <View style={styles.requestTop}>
        <View style={styles.requestInfo}>
          <View style={styles.requestAvatarContainer}>
            <Avatar
              source={request.friend.avatar_url}
              name={request.friend.display_name}
              size="md"
            />
            <View style={styles.requestLevelBadge}>
              <Text style={styles.requestLevelEmoji}>{level.emoji}</Text>
            </View>
          </View>
          <View style={styles.requestText}>
            <Text style={styles.requestName}>{request.friend.display_name}</Text>
            <Text style={styles.requestUsername}>@{request.friend.username}</Text>
          </View>
        </View>
        <Text style={styles.requestNewBadge}>NEW</Text>
      </View>
      <View style={styles.requestActions}>
        <Button
          onPress={handleAccept}
          size="sm"
          loading={isAccepting}
          style={styles.acceptButton}
        >
          Accept
        </Button>
        <Button
          onPress={handleReject}
          variant="secondary"
          size="sm"
          loading={isRejecting}
          style={styles.declineButton}
        >
          Decline
        </Button>
      </View>
    </Card>
  );
}

export default function FriendsScreen() {
  const { user } = useAuthStore();
  const {
    friends,
    pendingIncoming,
    pendingOutgoing,
    isLoading,
    refetch,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
  } = useFriends();

  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showMyQRCode, setShowMyQRCode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const profileLink = `oomf.app/${user?.username || ''}`;

  const handleQRScan = async (username: string) => {
    setShowQRScanner(false);

    // Check if trying to add self
    if (username.toLowerCase() === user?.username?.toLowerCase()) {
      Alert.alert('Oops', "You can't add yourself as a friend!");
      return;
    }

    try {
      await sendFriendRequest(username);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', `Friend request sent to @${username}!`);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.message || 'Failed to send friend request');
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

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

  const handleRemoveFriend = (friendship: FriendWithProfile) => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friendship.friend.display_name}?`,
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
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const filteredFriends = friends.filter((f) =>
    searchQuery
      ? f.friend.username.includes(searchQuery.toLowerCase()) ||
        f.friend.display_name.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Friends</Text>
          <Text style={styles.subtitle}>
            {friends.length} friend{friends.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.circlesButton}
            onPress={() => router.push('/circles' as any)}
          >
            <Ionicons name="people-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.circlesButtonText}>Circles</Text>
          </Pressable>
          <Button onPress={() => setShowAddModal(true)} size="sm">
            Add +
          </Button>
        </View>
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
        {/* QR Code Actions */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400 }}
        >
          <View style={styles.qrActionsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.qrActionCard,
                pressed && styles.qrActionCardPressed,
              ]}
              onPress={() => setShowQRScanner(true)}
            >
              <View style={styles.qrActionIcon}>
                <Ionicons name="scan" size={28} color={colors.primary} />
              </View>
              <Text style={styles.qrActionTitle}>Scan QR</Text>
              <Text style={styles.qrActionSubtitle}>Add a friend</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.qrActionCard,
                pressed && styles.qrActionCardPressed,
              ]}
              onPress={() => setShowMyQRCode(true)}
            >
              <View style={styles.qrActionIcon}>
                <Ionicons name="qr-code" size={28} color={colors.primary} />
              </View>
              <Text style={styles.qrActionTitle}>My QR</Text>
              <Text style={styles.qrActionSubtitle}>Show code</Text>
            </Pressable>
          </View>
        </MotiView>

        {/* Share Link Card */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 50 }}
        >
          <Card style={styles.shareCard} variant="elevated">
            <View style={styles.shareIconRow}>
              <View style={styles.shareIconContainer}>
                <Ionicons name="link" size={24} color={colors.primary} />
              </View>
              <View style={styles.shareTitleSection}>
                <Text style={styles.shareTitle}>Invite friends</Text>
                <Text style={styles.shareSubtitle}>Share your profile link</Text>
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

        {/* Search */}
        {friends.length > 3 && (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 50 }}
          >
            <Input
              placeholder="Search friends..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </MotiView>
        )}

        {/* Pending Incoming Requests */}
        {pendingIncoming.length > 0 && (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 100 }}
            style={styles.section}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Friend Requests</Text>
              <View style={styles.requestBadge}>
                <Text style={styles.requestBadgeText}>{pendingIncoming.length}</Text>
              </View>
            </View>
            {pendingIncoming.map((request) => (
              <FriendRequestCard
                key={request.friendship_id}
                request={request}
                onAccept={() => acceptFriendRequest(request.friendship_id)}
                onReject={() => rejectFriendRequest(request.friendship_id)}
              />
            ))}
          </MotiView>
        )}

        {/* Pending Outgoing Requests */}
        {pendingOutgoing.length > 0 && (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 150 }}
            style={styles.section}
          >
            <Text style={styles.sectionTitle}>Pending Requests</Text>
            {pendingOutgoing.map((request) => (
              <Card key={request.friendship_id} style={styles.pendingCard}>
                <View style={styles.pendingInfo}>
                  <Avatar
                    source={request.friend.avatar_url}
                    name={request.friend.display_name}
                    size="sm"
                  />
                  <View>
                    <Text style={styles.pendingName}>{request.friend.display_name}</Text>
                    <Text style={styles.pendingStatus}>Awaiting response...</Text>
                  </View>
                </View>
              </Card>
            ))}
          </MotiView>
        )}

        {/* Friends List */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 200 }}
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>Your Friends</Text>

          {isLoading ? (
            <Text style={styles.loadingText}>Loading friends...</Text>
          ) : filteredFriends.length === 0 ? (
            <Card style={styles.emptyCard} variant="elevated">
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No matches found' : 'No friends yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'Try a different search'
                  : 'Share your link to add friends'}
              </Text>
              {!searchQuery && (
                <Button
                  onPress={handleShare}
                  size="md"
                  style={styles.emptyButton}
                >
                  Share Your Link
                </Button>
              )}
            </Card>
          ) : (
            <View style={styles.friendsList}>
              {filteredFriends.map((friendship, index) => {
                const level = getLevelInfo(friendship.friend.oomf_score || 0);
                return (
                  <MotiView
                    key={friendship.friendship_id}
                    from={{ opacity: 0, translateX: -20 }}
                    animate={{ opacity: 1, translateX: 0 }}
                    transition={{ type: 'timing', duration: 200, delay: index * 30 }}
                  >
                    <Pressable
                      style={({ pressed }) => [
                        styles.friendCard,
                        pressed && styles.friendCardPressed,
                      ]}
                      onLongPress={() => handleRemoveFriend(friendship)}
                    >
                      <View style={styles.friendAvatarContainer}>
                        <Avatar
                          source={friendship.friend.avatar_url}
                          name={friendship.friend.display_name}
                          size="md"
                        />
                        <View style={styles.friendLevelBadge}>
                          <Text style={styles.friendLevelEmoji}>{level.emoji}</Text>
                        </View>
                      </View>
                      <View style={styles.friendInfo}>
                        <Text style={styles.friendName}>
                          {friendship.friend.display_name}
                        </Text>
                        <Text style={styles.friendUsername}>
                          @{friendship.friend.username}
                        </Text>
                      </View>
                      <View style={styles.friendStats}>
                        <Text style={styles.friendScore}>
                          {friendship.friend.oomf_score || 0}
                        </Text>
                        <Text style={styles.friendScoreLabel}>pts</Text>
                      </View>
                    </Pressable>
                  </MotiView>
                );
              })}
            </View>
          )}
        </MotiView>
      </ScrollView>

      {/* Add Friend Modal */}
      <AddFriendModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSendRequest={sendFriendRequest}
      />

      {/* QR Scanner Modal */}
      <Modal
        visible={showQRScanner}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowQRScanner(false)}
      >
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowQRScanner(false)}
        />
      </Modal>

      {/* My QR Code Modal */}
      <Modal
        visible={showMyQRCode}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMyQRCode(false)}
      >
        <Pressable
          style={styles.qrModalOverlay}
          onPress={() => setShowMyQRCode(false)}
        >
          <Pressable
            style={styles.qrModalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <Pressable
              style={styles.qrModalClose}
              onPress={() => setShowMyQRCode(false)}
            >
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
            <QRCodeDisplay
              username={user?.username || ''}
              displayName={user?.display_name}
              size={220}
            />
          </Pressable>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  circlesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: `${colors.primary}15`,
    borderRadius: 8,
  },
  circlesButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.primary,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },

  // Share Card
  shareCard: {
    padding: spacing.lg,
  },
  shareIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  shareIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
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

  // Sections
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
  requestBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  requestBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },

  // Request Card
  requestCard: {
    padding: spacing.md,
  },
  requestTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  requestAvatarContainer: {
    position: 'relative',
  },
  requestLevelBadge: {
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
  requestLevelEmoji: {
    fontSize: 10,
  },
  requestText: {
    flex: 1,
  },
  requestName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  requestUsername: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  requestNewBadge: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    backgroundColor: `${colors.primary}20`,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
    letterSpacing: 0.5,
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  acceptButton: {
    flex: 1,
  },
  declineButton: {
    flex: 1,
  },

  // Pending Card
  pendingCard: {
    padding: spacing.md,
  },
  pendingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pendingName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  pendingStatus: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
  },

  // Friends List
  friendsList: {
    gap: spacing.sm,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  friendCardPressed: {
    backgroundColor: colors.cardHover,
    transform: [{ scale: 0.98 }],
  },
  friendAvatarContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  friendLevelBadge: {
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
  friendLevelEmoji: {
    fontSize: 10,
  },
  friendInfo: {
    flex: 1,
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
  friendStats: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  friendScore: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  friendScoreLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },

  // Loading & Empty
  loadingText: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
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
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyButton: {
    minWidth: 180,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  modalButton: {
    flex: 1,
  },

  // QR Actions
  qrActionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  qrActionCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  qrActionCardPressed: {
    backgroundColor: colors.cardHover,
    transform: [{ scale: 0.98 }],
  },
  qrActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  qrActionTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  qrActionSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },

  // QR Modal
  qrModalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  qrModalContent: {
    backgroundColor: colors.background,
    borderRadius: 24,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  qrModalClose: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
