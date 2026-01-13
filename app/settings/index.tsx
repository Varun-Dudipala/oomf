import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from '../../lib/moti-shim';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Card, Avatar, Button, Input } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { useBlock } from '../../hooks/useBlock';
import { uploadAvatar, deleteUserData, supabase } from '../../lib/supabase';
import { clearRateLimits } from '../../lib/rateLimit';
import { colors, spacing, fontSize, fontWeight } from '../../lib/constants';

export default function SettingsScreen() {
  const { user, updateProfile, signOut } = useAuthStore();
  const { blockedUsers, unblockUser } = useBlock();

  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Notification preferences (stored locally for now)
  const [notifyNewOomf, setNotifyNewOomf] = useState(true);
  const [notifyFriendRequest, setNotifyFriendRequest] = useState(true);
  const [notifyStreak, setNotifyStreak] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUnblocking, setIsUnblocking] = useState<string | null>(null);

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Display name is required');
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({
        display_name: displayName.trim(),
        bio: bio.trim() || null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated!');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setIsUploadingAvatar(true);
      try {
        const { url, error } = await uploadAvatar(user!.id, result.assets[0].uri);

        if (error) {
          throw error;
        }

        if (url) {
          await updateProfile({ avatar_url: url });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Success', 'Avatar updated!');
        }
      } catch (err: any) {
        console.error('Avatar upload error:', err);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', err.message || 'Failed to upload avatar');
      } finally {
        setIsUploadingAvatar(false);
      }
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
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await signOut();
            router.replace('/(auth)');
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted including:\n\n- Your profile\n- All compliments sent and received\n- All friendships\n- Your avatar',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: () => {
            // Second confirmation
            Alert.alert(
              'Are you absolutely sure?',
              'Type "DELETE" to confirm account deletion.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete My Account',
                  style: 'destructive',
                  onPress: performAccountDeletion,
                },
              ]
            );
          },
        },
      ]
    );
  };

  const performAccountDeletion = async () => {
    if (!user) return;

    setIsDeleting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    try {
      // Delete all user data from database
      const { error: dataError } = await deleteUserData(user.id);
      if (dataError) throw dataError;

      // Clear rate limit data
      await clearRateLimits(user.id);

      // Sign out the user (this removes the session)
      await supabase.auth.signOut();

      // Navigate to auth screen
      router.replace('/(auth)');

      // Show success message
      Alert.alert(
        'Account Deleted',
        'Your account and all associated data have been permanently deleted.'
      );
    } catch (err: any) {
      console.error('Account deletion error:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.message || 'Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUnblock = async (blockedId: string, username: string) => {
    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock @${username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setIsUnblocking(blockedId);
            try {
              await unblockUser(blockedId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', err.message || 'Failed to unblock user');
            } finally {
              setIsUnblocking(null);
            }
          },
        },
      ]
    );
  };

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
        <Text style={styles.title}>Settings</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400 }}
        >
          <Card style={styles.profileCard} variant="elevated">
            <Pressable onPress={handlePickImage} style={styles.avatarContainer} disabled={isUploadingAvatar}>
              <Avatar
                source={user?.avatar_url}
                name={user?.display_name}
                size="xl"
              />
              {isUploadingAvatar ? (
                <View style={styles.avatarLoadingOverlay}>
                  <ActivityIndicator size="small" color={colors.textInverse} />
                </View>
              ) : (
                <View style={styles.editAvatarBadge}>
                  <Ionicons name="camera" size={16} color={colors.textInverse} />
                </View>
              )}
            </Pressable>

            {isEditing ? (
              <View style={styles.editForm}>
                <Input
                  label="Display Name"
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Your name"
                  maxLength={30}
                />
                <Input
                  label="Bio"
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Something about you..."
                  multiline
                  maxLength={150}
                />
                <View style={styles.editActions}>
                  <Button
                    onPress={() => {
                      setDisplayName(user?.display_name || '');
                      setBio(user?.bio || '');
                      setIsEditing(false);
                    }}
                    variant="secondary"
                    size="md"
                    style={styles.editButton}
                  >
                    Cancel
                  </Button>
                  <Button
                    onPress={handleSave}
                    size="md"
                    style={styles.editButton}
                    loading={isSaving}
                  >
                    Save
                  </Button>
                </View>
              </View>
            ) : (
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user?.display_name}</Text>
                <Text style={styles.profileUsername}>@{user?.username}</Text>
                {user?.bio && <Text style={styles.profileBio}>{user.bio}</Text>}
                <Button
                  onPress={() => setIsEditing(true)}
                  variant="secondary"
                  size="sm"
                  style={styles.editProfileButton}
                >
                  Edit Profile
                </Button>
              </View>
            )}
          </Card>
        </MotiView>

        {/* Notifications Section */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 100 }}
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>Notifications</Text>
          <Card style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>New Oomfs</Text>
                <Text style={styles.settingDescription}>Get notified when someone sends you a compliment</Text>
              </View>
              <Switch
                value={notifyNewOomf}
                onValueChange={setNotifyNewOomf}
                trackColor={{ false: colors.surface, true: colors.primary }}
                thumbColor={colors.text}
              />
            </View>

            <View style={styles.settingDivider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Friend Requests</Text>
                <Text style={styles.settingDescription}>Get notified when someone adds you</Text>
              </View>
              <Switch
                value={notifyFriendRequest}
                onValueChange={setNotifyFriendRequest}
                trackColor={{ false: colors.surface, true: colors.primary }}
                thumbColor={colors.text}
              />
            </View>

            <View style={styles.settingDivider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Streak Reminders</Text>
                <Text style={styles.settingDescription}>Remind me to keep my streak going</Text>
              </View>
              <Switch
                value={notifyStreak}
                onValueChange={setNotifyStreak}
                trackColor={{ false: colors.surface, true: colors.primary }}
                thumbColor={colors.text}
              />
            </View>
          </Card>
        </MotiView>

        {/* Blocked Users Section */}
        {blockedUsers.length > 0 && (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 150 }}
            style={styles.section}
          >
            <Text style={styles.sectionTitle}>Blocked Users</Text>
            <Card style={styles.settingsCard}>
              {blockedUsers.map((blocked, index) => (
                <View key={blocked.id}>
                  {index > 0 && <View style={styles.settingDivider} />}
                  <View style={styles.blockedUserRow}>
                    <View style={styles.blockedUserInfo}>
                      <Avatar
                        source={blocked.user?.avatar_url}
                        name={blocked.user?.display_name}
                        size="sm"
                      />
                      <View>
                        <Text style={styles.blockedUserName}>{blocked.user?.display_name}</Text>
                        <Text style={styles.blockedUserUsername}>@{blocked.user?.username}</Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => handleUnblock(blocked.blocked_id, blocked.user?.username)}
                      disabled={isUnblocking === blocked.blocked_id}
                      style={({ pressed }) => [
                        styles.unblockButton,
                        pressed && styles.unblockButtonPressed,
                      ]}
                    >
                      {isUnblocking === blocked.blocked_id ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Text style={styles.unblockButtonText}>Unblock</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ))}
            </Card>
          </MotiView>
        )}

        {/* Account Section */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 200 }}
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>Account</Text>
          <Card style={styles.settingsCard}>
            <Pressable
              style={({ pressed }) => [
                styles.settingRow,
                pressed && styles.settingRowPressed,
              ]}
              onPress={handleSignOut}
            >
              <View style={styles.settingRowLeft}>
                <View style={styles.settingIconContainer}>
                  <Ionicons name="log-out-outline" size={20} color={colors.text} />
                </View>
                <Text style={styles.settingLabel}>Sign Out</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>

            <View style={styles.settingDivider} />

            <Pressable
              style={({ pressed }) => [
                styles.settingRow,
                pressed && styles.settingRowPressed,
                isDeleting && styles.settingRowDisabled,
              ]}
              onPress={handleDeleteAccount}
              disabled={isDeleting}
            >
              <View style={styles.settingRowLeft}>
                <View style={[styles.settingIconContainer, styles.dangerIconContainer]}>
                  {isDeleting ? (
                    <ActivityIndicator size="small" color={colors.error} />
                  ) : (
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  )}
                </View>
                <Text style={[styles.settingLabel, styles.dangerText]}>
                  {isDeleting ? 'Deleting...' : 'Delete Account'}
                </Text>
              </View>
              {!isDeleting && <Ionicons name="chevron-forward" size={20} color={colors.error} />}
            </Pressable>
          </Card>
        </MotiView>

        {/* App Info */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 300 }}
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>About</Text>
          <Card style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingRowLeft}>
                <View style={styles.settingIconContainer}>
                  <Ionicons name="information-circle-outline" size={20} color={colors.text} />
                </View>
                <Text style={styles.settingLabel}>Version</Text>
              </View>
              <Text style={styles.settingValue}>1.0.0</Text>
            </View>

            <View style={styles.settingDivider} />

            <Pressable
              style={({ pressed }) => [
                styles.settingRow,
                pressed && styles.settingRowPressed,
              ]}
              onPress={() => Alert.alert('Privacy Policy', 'Coming soon!')}
            >
              <View style={styles.settingRowLeft}>
                <View style={styles.settingIconContainer}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={colors.text} />
                </View>
                <Text style={styles.settingLabel}>Privacy Policy</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>

            <View style={styles.settingDivider} />

            <Pressable
              style={({ pressed }) => [
                styles.settingRow,
                pressed && styles.settingRowPressed,
              ]}
              onPress={() => Alert.alert('Terms of Service', 'Coming soon!')}
            >
              <View style={styles.settingRowLeft}>
                <View style={styles.settingIconContainer}>
                  <Ionicons name="document-text-outline" size={20} color={colors.text} />
                </View>
                <Text style={styles.settingLabel}>Terms of Service</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          </Card>
        </MotiView>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Made with 💛 by the Oomf team</Text>
        </View>
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
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  profileCard: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.card,
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    alignItems: 'center',
  },
  profileName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  profileUsername: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  profileBio: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
    maxWidth: 280,
  },
  editProfileButton: {
    marginTop: spacing.lg,
  },
  editForm: {
    width: '100%',
    gap: spacing.md,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  editButton: {
    flex: 1,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: spacing.xs,
  },
  settingsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  settingRowPressed: {
    backgroundColor: colors.surface,
  },
  settingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  settingIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerIconContainer: {
    backgroundColor: `${colors.error}20`,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  settingDescription: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  settingValue: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  settingDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  dangerText: {
    color: colors.error,
  },
  settingRowDisabled: {
    opacity: 0.6,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  footerText: {
    fontSize: fontSize.sm,
    color: colors.textSubtle,
  },
  blockedUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  blockedUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  blockedUserName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  blockedUserUsername: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  unblockButton: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unblockButtonPressed: {
    backgroundColor: colors.border,
  },
  unblockButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.primary,
  },
});
