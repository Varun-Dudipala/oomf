import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MotiView, AnimatePresence } from '../../lib/moti-shim';
import * as Haptics from 'expo-haptics';
import { Avatar } from '../../components/ui';
import { useSecretAdmirerChat, type SecretAdmirerMessage } from '../../hooks/useSecretAdmirerChat';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, fontSize, fontWeight } from '../../lib/constants';

const MAX_MESSAGE_LENGTH = 280;

function MessageBubble({
  message,
  isOwn,
  isRevealed,
  showAvatar,
  avatarUrl,
  displayName,
}: {
  message: SecretAdmirerMessage;
  isOwn: boolean;
  isRevealed: boolean;
  showAvatar: boolean;
  avatarUrl: string | null;
  displayName: string;
}) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 200 }}
      style={[
        styles.messageRow,
        isOwn ? styles.messageRowOwn : styles.messageRowOther,
      ]}
    >
      {!isOwn && showAvatar && (
        <View style={styles.avatarContainer}>
          {isRevealed ? (
            <Avatar source={avatarUrl} name={displayName} size="sm" />
          ) : (
            <View style={styles.mysteryAvatar}>
              <Ionicons name="help" size={16} color={colors.secondary} />
            </View>
          )}
        </View>
      )}
      {!isOwn && !showAvatar && <View style={styles.avatarSpacer} />}
      <View
        style={[
          styles.messageBubble,
          isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther,
        ]}
      >
        <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>
          {message.message}
        </Text>
      </View>
      {isOwn && <View style={styles.avatarSpacer} />}
    </MotiView>
  );
}

function RevealBanner({ senderName, receiverName }: { senderName: string; receiverName: string }) {
  return (
    <MotiView
      from={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', damping: 15 }}
      style={styles.revealBanner}
    >
      <View style={styles.revealIconContainer}>
        <Ionicons name="heart" size={32} color={colors.secondary} />
      </View>
      <Text style={styles.revealTitle}>Identity Revealed!</Text>
      <Text style={styles.revealSubtitle}>
        {senderName} was your Secret Admirer
      </Text>
    </MotiView>
  );
}

export default function SecretAdmirerChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const { chat, isLoading, isSending, error, sendReply } = useSecretAdmirerChat(id);

  const [message, setMessage] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (chat?.messages.length) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chat?.messages.length]);

  const handleSend = async () => {
    if (!message.trim() || isSending) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const messageToSend = message;
    setMessage('');

    const result = await sendReply(messageToSend);

    if (!result.success) {
      setMessage(messageToSend);
      Alert.alert('Error', result.error || 'Failed to send message');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (result.isRevealed) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Identity Revealed!',
        'You have exchanged enough messages - your secret admirer is now revealed!',
        [{ text: 'Awesome!' }]
      );
    }
  };

  if (isLoading || !chat) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingIcon}>
            <Ionicons name="chatbubbles" size={32} color={colors.secondary} />
          </View>
          <Text style={styles.loadingText}>Loading chat...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const otherUser = chat.is_sender ? chat.receiver : chat.sender;
  const canReply = !chat.is_revealed || true; // Can always reply once revealed

  // Group messages by showing avatar only for first message in a sequence from same sender
  const messagesWithAvatars = chat.messages.map((msg, index) => {
    const prevMsg = chat.messages[index - 1];
    const showAvatar = !prevMsg || prevMsg.sender_id !== msg.sender_id;
    return { ...msg, showAvatar };
  });

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
          {chat.is_revealed ? (
            <Avatar source={otherUser.avatar_url} name={otherUser.display_name} size="sm" />
          ) : (
            <View style={styles.headerMysteryAvatar}>
              <Ionicons name="help" size={20} color={colors.secondary} />
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>
              {chat.is_revealed ? otherUser.display_name : 'Secret Admirer'}
            </Text>
            {!chat.is_revealed && (
              <Text style={styles.headerSubtitle}>
                {chat.messages_until_reveal} messages until reveal
              </Text>
            )}
          </View>
        </View>
        <View style={styles.backButton} />
      </View>

      {/* Progress indicator */}
      {!chat.is_revealed && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${(chat.exchange_count / 6) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {chat.exchange_count}/6 messages to reveal
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Reveal banner if revealed */}
          {chat.is_revealed && (
            <RevealBanner
              senderName={chat.sender.display_name}
              receiverName={chat.receiver.display_name}
            />
          )}

          {/* Messages */}
          {messagesWithAvatars.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.is_own}
              isRevealed={chat.is_revealed}
              showAvatar={msg.showAvatar}
              avatarUrl={chat.is_revealed ? chat.sender.avatar_url : null}
              displayName={chat.sender.display_name}
            />
          ))}
        </ScrollView>

        {/* Input area */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor={colors.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={MAX_MESSAGE_LENGTH}
              editable={!isSending}
            />
            {message.length > 0 && (
              <Text style={styles.charCount}>
                {message.length}/{MAX_MESSAGE_LENGTH}
              </Text>
            )}
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.sendButton,
              (!message.trim() || isSending) && styles.sendButtonDisabled,
              pressed && message.trim() && !isSending && styles.sendButtonPressed,
            ]}
            onPress={handleSend}
            disabled={!message.trim() || isSending}
          >
            <Ionicons
              name={isSending ? 'hourglass' : 'send'}
              size={20}
              color={message.trim() && !isSending ? colors.textInverse : colors.textMuted}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    backgroundColor: `${colors.secondary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: fontSize.base,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  headerMysteryAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${colors.secondary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    alignItems: 'flex-start',
  },
  headerName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: fontSize.xs,
    color: colors.secondary,
  },

  // Progress
  progressContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: `${colors.secondary}10`,
    alignItems: 'center',
    gap: spacing.xs,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.secondary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: fontSize.xs,
    color: colors.secondary,
  },

  // Messages
  keyboardView: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
    alignItems: 'flex-end',
  },
  messageRowOwn: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginRight: spacing.xs,
  },
  avatarSpacer: {
    width: 32,
    marginRight: spacing.xs,
  },
  mysteryAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${colors.secondary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 18,
  },
  messageBubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: fontSize.base,
    color: colors.text,
    lineHeight: 22,
  },
  messageTextOwn: {
    color: colors.textInverse,
  },

  // Reveal banner
  revealBanner: {
    alignItems: 'center',
    padding: spacing.xl,
    marginBottom: spacing.lg,
    backgroundColor: `${colors.secondary}10`,
    borderRadius: 16,
  },
  revealIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${colors.secondary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  revealTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.secondary,
    marginBottom: spacing.xs,
  },
  revealSubtitle: {
    fontSize: fontSize.base,
    color: colors.text,
  },

  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
    maxHeight: 120,
  },
  input: {
    fontSize: fontSize.base,
    color: colors.text,
    maxHeight: 80,
  },
  charCount: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.surface,
  },
  sendButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
});
