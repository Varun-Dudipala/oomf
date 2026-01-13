import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from '../../lib/moti-shim';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Button, Input, Avatar } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { uploadAvatar } from '../../lib/supabase';
import { colors, spacing, fontSize, fontWeight, limits } from '../../lib/constants';

export default function ProfileSetupScreen() {
  const { supabaseUser, user, updateProfile, fetchUserProfile } = useAuthStore();
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSubmit = async () => {
    if (!displayName.trim()) {
      setError('Please enter a display name');
      return;
    }

    if (displayName.length > limits.displayNameMaxLength) {
      setError(`Display name must be less than ${limits.displayNameMaxLength} characters`);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      let avatarUrl: string | undefined;

      // Upload avatar if selected
      if (avatarUri && user?.id) {
        setIsUploadingAvatar(true);
        const { url, error: uploadError } = await uploadAvatar(user.id, avatarUri);
        if (uploadError) {
          console.error('Avatar upload error:', uploadError);
          // Don't fail the whole process, just skip avatar
        } else {
          avatarUrl = url || undefined;
        }
        setIsUploadingAvatar(false);
      }

      await updateProfile({
        display_name: displayName.trim(),
        ...(avatarUrl && { avatar_url: avatarUrl }),
      });

      // Fetch updated profile
      await fetchUserProfile();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Navigate to add friends screen
      router.push('/(auth)/add-friends');
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
      setIsUploadingAvatar(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            {/* Header */}
            <MotiView
              from={{ opacity: 0, translateY: -20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 400 }}
            >
              <Text style={styles.title}>What should we call you?</Text>
              <Text style={styles.subtitle}>
                This is your display name that friends will see
              </Text>
            </MotiView>

            {/* Avatar Preview */}
            <MotiView
              from={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 15, delay: 100 }}
              style={styles.avatarContainer}
            >
              <Pressable onPress={handlePickImage} style={styles.avatarPressable}>
                <Avatar
                  source={avatarUri || undefined}
                  name={displayName || supabaseUser?.email || '?'}
                  size="xl"
                />
                <View style={styles.editAvatarBadge}>
                  <Ionicons name="camera" size={16} color={colors.textInverse} />
                </View>
              </Pressable>
              <Text style={styles.avatarHint}>
                {avatarUri ? 'Tap to change photo' : 'Tap to add a photo (optional)'}
              </Text>
            </MotiView>

            {/* Input */}
            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 400, delay: 150 }}
              style={styles.inputContainer}
            >
              <Input
                label="Display name"
                placeholder="Your name"
                value={displayName}
                onChangeText={(text) => {
                  setDisplayName(text);
                  setError('');
                }}
                error={error}
                autoCapitalize="words"
                autoCorrect={false}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                maxLength={limits.displayNameMaxLength}
              />
              <Text style={styles.characterCount}>
                {displayName.length}/{limits.displayNameMaxLength}
              </Text>
            </MotiView>
          </View>
        </ScrollView>

        {/* CTA */}
        <MotiView
          from={{ opacity: 0, translateY: 30 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 200 }}
          style={styles.cta}
        >
          <Button
            onPress={handleSubmit}
            size="lg"
            fullWidth
            loading={isSubmitting}
            disabled={!displayName.trim()}
          >
            Continue
          </Button>
        </MotiView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
  avatarContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatarPressable: {
    position: 'relative',
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
    borderColor: colors.background,
  },
  avatarHint: {
    fontSize: fontSize.sm,
    color: colors.textSubtle,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  inputContainer: {
    marginTop: spacing.md,
  },
  characterCount: {
    fontSize: fontSize.xs,
    color: colors.textSubtle,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  cta: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
