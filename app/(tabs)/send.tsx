import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Dimensions, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { router } from 'expo-router';
import { MotiView, AnimatePresence } from '../../lib/moti-shim';
import * as Haptics from 'expo-haptics';
import { Card, Avatar, Button } from '../../components/ui';
import { useFriends } from '../../hooks/useFriends';
import { useTemplates } from '../../hooks/useTemplates';
import { useCompliments } from '../../hooks/useCompliments';
import { useDailyDrops } from '../../hooks/useDailyDrops';
import { useSecretAdmirer, SECRET_ADMIRER_COST, SECRET_ADMIRER_MAX_LENGTH } from '../../hooks/useSecretAdmirer';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, fontSize, fontWeight } from '../../lib/constants';
import type { User, Template } from '../../types/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FRIEND_CARD_WIDTH = (SCREEN_WIDTH - spacing.lg * 2 - spacing.md) / 2;

type Step = 'friend' | 'template' | 'secretAdmirer' | 'confirm' | 'success';

const STEP_TITLES: Record<Step, { title: string; subtitle: string }> = {
  friend: { title: 'Who gets the hype?', subtitle: 'Pick a friend to brighten their day' },
  template: { title: "What's the vibe?", subtitle: 'Choose the perfect compliment' },
  secretAdmirer: { title: 'Secret Admirer', subtitle: 'Write your own message' },
  confirm: { title: 'Ready to send?', subtitle: "They won't know it's from you" },
  success: { title: 'Sent!', subtitle: 'You just made someone smile' },
};

function StepIndicator({ currentStep, isSecretAdmirer }: { currentStep: Step; isSecretAdmirer?: boolean }) {
  const steps: Step[] = isSecretAdmirer
    ? ['friend', 'secretAdmirer', 'confirm']
    : ['friend', 'template', 'confirm'];

  // Map current step to index
  let currentIndex = steps.indexOf(currentStep);
  if (currentStep === 'secretAdmirer' && !isSecretAdmirer) {
    currentIndex = 1; // Treat as template step position
  }

  if (currentStep === 'success') return null;

  return (
    <View style={styles.stepIndicator}>
      {steps.map((s, i) => (
        <View key={s} style={styles.stepDotContainer}>
          <View
            style={[
              styles.stepDot,
              i <= currentIndex && styles.stepDotActive,
              i < currentIndex && styles.stepDotCompleted,
            ]}
          >
            {i < currentIndex && <Text style={styles.stepCheck}>✓</Text>}
          </View>
          {i < steps.length - 1 && (
            <View style={[styles.stepLine, i < currentIndex && styles.stepLineActive]} />
          )}
        </View>
      ))}
    </View>
  );
}

export default function SendScreen() {
  const { friends, isLoading: friendsLoading } = useFriends();
  const { templatesByCategory, categories, isLoading: templatesLoading } = useTemplates();
  const { dailyDrops, hasActiveDrop } = useDailyDrops();
  const { sendCompliment } = useCompliments();
  const { sendSecretAdmirer, canAfford: canAffordSecretAdmirer } = useSecretAdmirer();
  const { user, fetchUserProfile } = useAuthStore();

  const [step, setStep] = useState<Step>('friend');
  const [selectedFriend, setSelectedFriend] = useState<User | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('vibes');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [isSecretAdmirerMode, setIsSecretAdmirerMode] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);

  const handleSelectFriend = (friend: User) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFriend(friend);
    setStep('template');
  };

  const handleSelectTemplate = (template: Template) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTemplate(template);
    setStep('confirm');
  };

  const handleSecretAdmirerSelect = () => {
    if (!canAffordSecretAdmirer()) {
      Alert.alert(
        'Not Enough Tokens',
        `Secret Admirer costs ${SECRET_ADMIRER_COST} tokens. Earn more by sending compliments!`
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSecretAdmirerMode(true);
    setStep('secretAdmirer');
  };

  const handleSecretAdmirerConfirm = () => {
    if (customMessage.trim().length < 5) {
      Alert.alert('Too Short', 'Your message must be at least 5 characters.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep('confirm');
  };

  const handleSend = async () => {
    if (!selectedFriend) return;

    // Require either template or custom message
    if (!isSecretAdmirerMode && !selectedTemplate) return;
    if (isSecretAdmirerMode && customMessage.trim().length < 5) return;

    setIsSending(true);

    try {
      if (isSecretAdmirerMode) {
        const { error } = await sendSecretAdmirer(selectedFriend.id, customMessage);
        if (error) throw new Error(error);
        setPointsEarned(15); // Secret Admirer gives more points
      } else {
        await sendCompliment(selectedFriend.id, selectedTemplate!.id);
        setPointsEarned(1);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('success');
      await fetchUserProfile();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.message || 'Failed to send compliment');
    } finally {
      setIsSending(false);
    }
  };

  const handleBack = () => {
    if (step === 'template') {
      setSelectedFriend(null);
      setStep('friend');
    } else if (step === 'secretAdmirer') {
      setIsSecretAdmirerMode(false);
      setCustomMessage('');
      setStep('template');
    } else if (step === 'confirm') {
      if (isSecretAdmirerMode) {
        setStep('secretAdmirer');
      } else {
        setSelectedTemplate(null);
        setStep('template');
      }
    }
  };

  const handleSendAnother = () => {
    setSelectedFriend(null);
    setSelectedTemplate(null);
    setCustomMessage('');
    setIsSecretAdmirerMode(false);
    setPointsEarned(0);
    setStep('friend');
  };

  const handleDone = () => {
    setSelectedFriend(null);
    setSelectedTemplate(null);
    setCustomMessage('');
    setIsSecretAdmirerMode(false);
    setPointsEarned(0);
    setStep('friend');
    router.push('/(tabs)');
  };

  const currentTemplates = templatesByCategory[selectedCategory as keyof typeof templatesByCategory] || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {step !== 'friend' && step !== 'success' ? (
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
          ) : (
            <View style={styles.backButton} />
          )}
          <StepIndicator currentStep={step} isSecretAdmirer={isSecretAdmirerMode} />
          <View style={styles.backButton} />
        </View>
        <Text style={styles.title}>{STEP_TITLES[step].title}</Text>
        <Text style={styles.subtitle}>{STEP_TITLES[step].subtitle}</Text>
      </View>

      <AnimatePresence exitBeforeEnter>
        {/* Step 1: Select Friend */}
        {step === 'friend' && (
          <MotiView
            key="friend-step"
            from={{ opacity: 0, translateX: -50 }}
            animate={{ opacity: 1, translateX: 0 }}
            exit={{ opacity: 0, translateX: 50 }}
            transition={{ type: 'timing', duration: 250 }}
            style={styles.stepContainer}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {friendsLoading ? (
                <Text style={styles.loadingText}>Loading friends...</Text>
              ) : friends.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <Text style={styles.emptyEmoji}>👥</Text>
                  <Text style={styles.emptyTitle}>No friends yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Add some friends to start sending oomfs
                  </Text>
                  <Button
                    onPress={() => router.push('/(tabs)/friends')}
                    size="md"
                    style={styles.addFriendsButton}
                  >
                    Add Friends
                  </Button>
                </Card>
              ) : (
                <View style={styles.friendGrid}>
                  {friends.map((f, index) => (
                    <MotiView
                      key={f.friend.id}
                      from={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', delay: index * 50 }}
                      style={styles.friendCardWrapper}
                    >
                      <Pressable
                        style={({ pressed }) => [
                          styles.friendCard,
                          pressed && styles.friendCardPressed,
                        ]}
                        onPress={() => handleSelectFriend(f.friend)}
                      >
                        <View style={styles.friendAvatarContainer}>
                          <Avatar
                            source={f.friend.avatar_url}
                            name={f.friend.display_name}
                            size="lg"
                          />
                          <View style={styles.sendIndicator}>
                            <Text style={styles.sendIndicatorText}>✨</Text>
                          </View>
                        </View>
                        <Text style={styles.friendName} numberOfLines={1}>
                          {f.friend.display_name}
                        </Text>
                        <Text style={styles.friendUsername}>@{f.friend.username}</Text>
                      </Pressable>
                    </MotiView>
                  ))}
                </View>
              )}
            </ScrollView>
          </MotiView>
        )}

        {/* Step 2: Select Template */}
        {step === 'template' && (
          <MotiView
            key="template-step"
            from={{ opacity: 0, translateX: 50 }}
            animate={{ opacity: 1, translateX: 0 }}
            exit={{ opacity: 0, translateX: -50 }}
            transition={{ type: 'timing', duration: 250 }}
            style={styles.stepContainer}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Daily Drops Banner */}
              {hasActiveDrop() && dailyDrops.length > 0 && (
                <MotiView
                  from={{ opacity: 0, translateY: -10 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  style={styles.dailyDropBanner}
                >
                  <View style={styles.dailyDropHeader}>
                    <Text style={styles.dailyDropIcon}>🔥</Text>
                    <Text style={styles.dailyDropTitle}>Daily Drops</Text>
                    <Text style={styles.dailyDropBadge}>LIMITED</Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.dailyDropList}
                  >
                    {dailyDrops.slice(0, 5).map((template) => (
                      <Pressable
                        key={template.id}
                        style={({ pressed }) => [
                          styles.dailyDropItem,
                          pressed && styles.dailyDropItemPressed,
                        ]}
                        onPress={() => handleSelectTemplate(template)}
                      >
                        <Text style={styles.dailyDropEmoji}>{template.emoji}</Text>
                        <Text style={styles.dailyDropText} numberOfLines={2}>
                          {template.text}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </MotiView>
              )}

              {/* Secret Admirer Card */}
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300, delay: 100 }}
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.secretAdmirerCard,
                    pressed && styles.secretAdmirerCardPressed,
                    !canAffordSecretAdmirer() && styles.secretAdmirerCardDisabled,
                  ]}
                  onPress={handleSecretAdmirerSelect}
                >
                  <View style={styles.secretAdmirerIcon}>
                    <Text style={styles.secretAdmirerEmoji}>💌</Text>
                  </View>
                  <View style={styles.secretAdmirerContent}>
                    <View style={styles.secretAdmirerHeader}>
                      <Text style={styles.secretAdmirerTitle}>Secret Admirer</Text>
                      <View style={styles.secretAdmirerCost}>
                        <Text style={styles.secretAdmirerCostIcon}>🪙</Text>
                        <Text style={styles.secretAdmirerCostText}>{SECRET_ADMIRER_COST}</Text>
                      </View>
                    </View>
                    <Text style={styles.secretAdmirerDescription}>
                      Write your own custom message
                    </Text>
                  </View>
                  <View style={styles.secretAdmirerArrow}>
                    <Text style={styles.secretAdmirerArrowText}>→</Text>
                  </View>
                </Pressable>
              </MotiView>

              {/* Category Tabs */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryTabs}
              >
                {categories.map((category) => (
                  <Pressable
                    key={category.id}
                    style={[
                      styles.categoryTab,
                      selectedCategory === category.id && styles.categoryTabActive,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedCategory(category.id);
                    }}
                  >
                    <Text style={styles.categoryEmoji}>{category.emoji}</Text>
                    <Text
                      style={[
                        styles.categoryName,
                        selectedCategory === category.id && styles.categoryNameActive,
                      ]}
                    >
                      {category.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Templates */}
              {templatesLoading ? (
                <Text style={styles.loadingText}>Loading templates...</Text>
              ) : currentTemplates.length === 0 ? (
                <View style={styles.noTemplates}>
                  <Text style={styles.noTemplatesEmoji}>📝</Text>
                  <Text style={styles.noTemplatesText}>No templates in this category yet</Text>
                </View>
              ) : (
                <View style={styles.templateList}>
                  {currentTemplates.map((template, index) => (
                    <MotiView
                      key={template.id}
                      from={{ opacity: 0, translateY: 10 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      transition={{ type: 'timing', duration: 200, delay: index * 40 }}
                    >
                      <Pressable
                        style={({ pressed }) => [
                          styles.templateCard,
                          pressed && styles.templateCardPressed,
                        ]}
                        onPress={() => handleSelectTemplate(template)}
                      >
                        <View style={styles.templateEmojiContainer}>
                          <Text style={styles.templateEmoji}>{template.emoji}</Text>
                        </View>
                        <View style={styles.templateContent}>
                          <Text style={styles.templateText}>{template.text}</Text>
                        </View>
                        <View style={styles.templateArrow}>
                          <Text style={styles.templateArrowText}>→</Text>
                        </View>
                      </Pressable>
                    </MotiView>
                  ))}
                </View>
              )}
            </ScrollView>
          </MotiView>
        )}

        {/* Step 2.5: Secret Admirer - Write Message */}
        {step === 'secretAdmirer' && selectedFriend && (
          <MotiView
            key="secret-admirer-step"
            from={{ opacity: 0, translateX: 50 }}
            animate={{ opacity: 1, translateX: 0 }}
            exit={{ opacity: 0, translateX: -50 }}
            transition={{ type: 'timing', duration: 250 }}
            style={styles.stepContainer}
          >
            <KeyboardAvoidingView
              style={styles.secretAdmirerContainer}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={150}
            >
              <View style={styles.secretAdmirerWriteSection}>
                <View style={styles.secretAdmirerWriteHeader}>
                  <Text style={styles.secretAdmirerWriteEmoji}>💌</Text>
                  <View>
                    <Text style={styles.secretAdmirerWriteTitle}>Write to {selectedFriend.display_name}</Text>
                    <Text style={styles.secretAdmirerWriteSubtitle}>
                      Make it personal, but keep it anonymous
                    </Text>
                  </View>
                </View>

                <View style={styles.messageInputContainer}>
                  <TextInput
                    style={styles.messageInput}
                    placeholder="Type your message..."
                    placeholderTextColor={colors.textMuted}
                    value={customMessage}
                    onChangeText={setCustomMessage}
                    multiline
                    maxLength={SECRET_ADMIRER_MAX_LENGTH}
                    autoFocus
                  />
                  <Text style={styles.messageCounter}>
                    {customMessage.length}/{SECRET_ADMIRER_MAX_LENGTH}
                  </Text>
                </View>

                <View style={styles.secretAdmirerTips}>
                  <View style={styles.tipItem}>
                    <Text style={styles.tipIcon}>💡</Text>
                    <Text style={styles.tipText}>Be genuine and kind</Text>
                  </View>
                  <View style={styles.tipItem}>
                    <Text style={styles.tipIcon}>🎯</Text>
                    <Text style={styles.tipText}>Mention something specific</Text>
                  </View>
                  <View style={styles.tipItem}>
                    <Text style={styles.tipIcon}>🔒</Text>
                    <Text style={styles.tipText}>Don't reveal your identity</Text>
                  </View>
                </View>
              </View>

              <View style={styles.secretAdmirerActions}>
                <Button
                  onPress={handleSecretAdmirerConfirm}
                  size="lg"
                  fullWidth
                  disabled={customMessage.trim().length < 5}
                >
                  Continue
                </Button>
              </View>
            </KeyboardAvoidingView>
          </MotiView>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && selectedFriend && (selectedTemplate || isSecretAdmirerMode) && (
          <MotiView
            key="confirm-step"
            from={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 15 }}
            style={styles.confirmContainer}
          >
            <ScrollView
              contentContainerStyle={styles.confirmScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Preview Card */}
              <View style={[
                styles.previewCard,
                isSecretAdmirerMode && styles.previewCardSecretAdmirer
              ]}>
                <View style={styles.previewHeader}>
                  <Text style={styles.previewLabel}>Preview</Text>
                  <View style={[
                    styles.anonymousBadge,
                    isSecretAdmirerMode && styles.secretAdmirerBadge
                  ]}>
                    <Text style={[
                      styles.anonymousBadgeText,
                      isSecretAdmirerMode && styles.secretAdmirerBadgeText
                    ]}>
                      {isSecretAdmirerMode ? 'Secret Admirer' : 'Anonymous'}
                    </Text>
                  </View>
                </View>

                <View style={styles.previewContent}>
                  <View style={[
                    styles.previewEmojiContainer,
                    isSecretAdmirerMode && styles.previewEmojiContainerSecretAdmirer
                  ]}>
                    <Text style={styles.previewEmoji}>
                      {isSecretAdmirerMode ? '💌' : selectedTemplate?.emoji}
                    </Text>
                  </View>
                  <Text style={styles.previewText}>
                    {isSecretAdmirerMode ? customMessage : selectedTemplate?.text}
                  </Text>
                </View>

                <View style={styles.previewFooter}>
                  <Text style={styles.previewFooterText}>Sending to</Text>
                  <View style={styles.previewRecipient}>
                    <Avatar
                      source={selectedFriend.avatar_url}
                      name={selectedFriend.display_name}
                      size="sm"
                    />
                    <Text style={styles.previewRecipientName}>{selectedFriend.display_name}</Text>
                  </View>
                </View>
              </View>

              {/* Info */}
              <View style={styles.confirmInfo}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoIcon}>🔒</Text>
                  <Text style={styles.infoText}>Your identity stays hidden</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoIcon}>✨</Text>
                  <Text style={styles.infoText}>
                    +{isSecretAdmirerMode ? '15' : '1'} oomf point{isSecretAdmirerMode ? 's' : ''} for you
                  </Text>
                </View>
                {isSecretAdmirerMode && (
                  <View style={styles.infoItem}>
                    <Text style={styles.infoIcon}>🪙</Text>
                    <Text style={styles.infoText}>
                      Costs {SECRET_ADMIRER_COST} tokens
                    </Text>
                  </View>
                )}
                <View style={styles.infoItem}>
                  <Text style={styles.infoIcon}>🎯</Text>
                  <Text style={styles.infoText}>They get 3 guesses to find out who sent it</Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.confirmActions}>
              <Button
                onPress={handleSend}
                size="lg"
                fullWidth
                loading={isSending}
              >
                {isSecretAdmirerMode ? 'Send Secret Message 💌' : 'Send Anonymously ✨'}
              </Button>
              <Button
                onPress={handleBack}
                variant="ghost"
                size="md"
                fullWidth
              >
                {isSecretAdmirerMode ? 'Edit message' : 'Change template'}
              </Button>
            </View>
          </MotiView>
        )}

        {/* Step 4: Success */}
        {step === 'success' && (
          <MotiView
            key="success-step"
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 300 }}
            style={styles.successContainer}
          >
            <View style={styles.successContent}>
              <MotiView
                from={{ scale: 0, rotate: '-30deg' }}
                animate={{ scale: 1, rotate: '0deg' }}
                transition={{ type: 'spring', delay: 100, damping: 10 }}
                style={styles.successEmojiContainer}
              >
                <Text style={styles.successEmoji}>✨</Text>
              </MotiView>

              <MotiView
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300, delay: 200 }}
              >
                <Text style={styles.successTitle}>Oomf sent!</Text>
                <Text style={styles.successSubtitle}>You just brightened someone's day</Text>
              </MotiView>

              <MotiView
                from={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', delay: 400 }}
                style={styles.pointsEarnedContainer}
              >
                <Text style={styles.pointsEarnedLabel}>You earned</Text>
                <View style={styles.pointsBadge}>
                  <Text style={styles.pointsValue}>+{pointsEarned}</Text>
                  <Text style={styles.pointsLabel}>oomf point</Text>
                </View>
              </MotiView>
            </View>

            <View style={styles.successActions}>
              <Button onPress={handleSendAnother} size="lg" fullWidth>
                Send Another ✨
              </Button>
              <Button onPress={handleDone} variant="secondary" size="md" fullWidth>
                Back to Home
              </Button>
            </View>
          </MotiView>
        )}
      </AnimatePresence>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  backButton: {
    minWidth: 60,
    height: 24,
    justifyContent: 'center',
  },
  backText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
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

  // Step Indicator
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  stepDotCompleted: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepCheck: {
    fontSize: 12,
    color: colors.textInverse,
    fontWeight: fontWeight.bold,
  },
  stepLine: {
    width: 24,
    height: 2,
    backgroundColor: colors.border,
  },
  stepLineActive: {
    backgroundColor: colors.primary,
  },

  stepContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
  loadingText: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },

  // Friend Grid
  friendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  friendCardWrapper: {
    width: FRIEND_CARD_WIDTH,
  },
  friendCard: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  friendCardPressed: {
    backgroundColor: colors.cardHover,
    transform: [{ scale: 0.97 }],
    borderColor: colors.primary,
  },
  friendAvatarContainer: {
    position: 'relative',
  },
  sendIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  sendIndicatorText: {
    fontSize: 12,
  },
  friendName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  friendUsername: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  // Empty State
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  addFriendsButton: {
    minWidth: 150,
  },

  // Daily Drops
  dailyDropBanner: {
    marginBottom: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  dailyDropHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  dailyDropIcon: {
    fontSize: 18,
  },
  dailyDropTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.secondary,
  },
  dailyDropBadge: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    backgroundColor: colors.secondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  dailyDropList: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  dailyDropItem: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.sm,
    width: 140,
    alignItems: 'center',
    gap: spacing.xs,
  },
  dailyDropItemPressed: {
    backgroundColor: colors.cardHover,
    transform: [{ scale: 0.98 }],
  },
  dailyDropEmoji: {
    fontSize: 24,
  },
  dailyDropText: {
    fontSize: fontSize.xs,
    color: colors.text,
    textAlign: 'center',
  },

  // Category Tabs
  categoryTabs: {
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 20,
    gap: spacing.xs,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  categoryTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryEmoji: {
    fontSize: 16,
  },
  categoryName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  categoryNameActive: {
    color: colors.textInverse,
  },

  // No Templates
  noTemplates: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  noTemplatesEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  noTemplatesText: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // Template Cards
  templateList: {
    gap: spacing.sm,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  templateCardPressed: {
    backgroundColor: colors.cardHover,
    borderColor: colors.primary,
    transform: [{ scale: 0.98 }],
  },
  templateEmojiContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateEmoji: {
    fontSize: 22,
  },
  templateContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  templateText: {
    fontSize: fontSize.base,
    color: colors.text,
    lineHeight: 22,
  },
  templateArrow: {
    marginLeft: spacing.sm,
    opacity: 0.5,
  },
  templateArrowText: {
    fontSize: fontSize.lg,
    color: colors.textMuted,
  },

  // Confirm Screen
  confirmContainer: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  confirmScrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.lg,
  },

  // Preview Card
  previewCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  previewLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  anonymousBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  anonymousBadgeText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },
  previewContent: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  previewEmojiContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  previewEmoji: {
    fontSize: 40,
  },
  previewText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 26,
  },
  previewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  previewFooterText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  previewRecipient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 16,
  },
  previewRecipientName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },

  // Confirm Info
  confirmInfo: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 12,
  },
  infoIcon: {
    fontSize: 20,
  },
  infoText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    flex: 1,
  },

  confirmActions: {
    gap: spacing.md,
    paddingTop: spacing.md,
  },

  // Success Screen
  successContainer: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  successContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  successEmojiContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  successEmoji: {
    fontSize: 64,
  },
  successTitle: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  pointsEarnedContainer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  pointsEarnedLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 20,
    gap: spacing.xs,
  },
  pointsValue: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },
  pointsLabel: {
    fontSize: fontSize.sm,
    color: colors.textInverse,
    fontWeight: fontWeight.medium,
  },
  successActions: {
    width: '100%',
    gap: spacing.md,
  },

  // Secret Admirer Card (in template selection)
  secretAdmirerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.secondary,
    marginBottom: spacing.md,
  },
  secretAdmirerCardPressed: {
    backgroundColor: colors.cardHover,
    transform: [{ scale: 0.98 }],
  },
  secretAdmirerCardDisabled: {
    opacity: 0.5,
    borderColor: colors.border,
  },
  secretAdmirerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: `${colors.secondary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secretAdmirerEmoji: {
    fontSize: 26,
  },
  secretAdmirerContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  secretAdmirerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  secretAdmirerTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  secretAdmirerCost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  secretAdmirerCostIcon: {
    fontSize: 12,
  },
  secretAdmirerCostText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.secondary,
  },
  secretAdmirerDescription: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  secretAdmirerArrow: {
    marginLeft: spacing.sm,
    opacity: 0.5,
  },
  secretAdmirerArrowText: {
    fontSize: fontSize.lg,
    color: colors.secondary,
  },

  // Secret Admirer Write Step
  secretAdmirerContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  secretAdmirerWriteSection: {
    flex: 1,
    padding: spacing.lg,
  },
  secretAdmirerWriteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  secretAdmirerWriteEmoji: {
    fontSize: 48,
  },
  secretAdmirerWriteTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  secretAdmirerWriteSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  messageInputContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 150,
  },
  messageInput: {
    fontSize: fontSize.base,
    color: colors.text,
    lineHeight: 24,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  messageCounter: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: spacing.sm,
  },
  secretAdmirerTips: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 10,
  },
  tipIcon: {
    fontSize: 16,
  },
  tipText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  secretAdmirerActions: {
    padding: spacing.lg,
    paddingTop: 0,
  },

  // Secret Admirer Preview Card Styles
  previewCardSecretAdmirer: {
    borderColor: colors.secondary,
  },
  secretAdmirerBadge: {
    backgroundColor: `${colors.secondary}20`,
  },
  secretAdmirerBadgeText: {
    color: colors.secondary,
  },
  previewEmojiContainerSecretAdmirer: {
    backgroundColor: `${colors.secondary}20`,
  },
});
