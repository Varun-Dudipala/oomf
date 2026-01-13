import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Dimensions } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MotiView, AnimatePresence } from '../../lib/moti-shim';
import * as Haptics from 'expo-haptics';
import { Card, Avatar, Button } from '../../components/ui';
import { useCompliments } from '../../hooks/useCompliments';
import { useFriends } from '../../hooks/useFriends';
import { useTokens, HINT_COST, FULL_REVEAL_COST, type Hint } from '../../hooks/useTokens';
import { useReactions, REACTIONS, getReactionEmoji, type ReactionType } from '../../hooks/useReactions';
import { useSecretAdmirerChat } from '../../hooks/useSecretAdmirerChat';
import { colors, spacing, fontSize, fontWeight } from '../../lib/constants';
import type { ComplimentWithDetails } from '../../hooks/useCompliments';
import type { User } from '../../types/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FRIEND_CARD_WIDTH = (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm * 2) / 3;

type GameState = 'viewing' | 'guessing' | 'correct' | 'wrong' | 'revealed' | 'out_of_guesses';

export default function ComplimentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getCompliment, markAsRead, makeGuess } = useCompliments();
  const { friends } = useFriends();
  const { balance: tokenBalance, getHint, revealWithTokens, canAffordHint, canAffordReveal } = useTokens();
  const { reactToCompliment } = useReactions();
  const { fetchChatByCompliment } = useSecretAdmirerChat();

  const [compliment, setCompliment] = useState<ComplimentWithDetails | null>(null);
  const [secretAdmirerChatId, setSecretAdmirerChatId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>('viewing');
  const [selectedFriend, setSelectedFriend] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuessing, setIsGuessing] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [isGettingHint, setIsGettingHint] = useState(false);
  const [isReacting, setIsReacting] = useState(false);
  const [currentReaction, setCurrentReaction] = useState<ReactionType>(null);

  // Hints state
  const [hints, setHints] = useState<Hint[]>([]);
  const [hintsUsed, setHintsUsed] = useState(0);

  // Fetch compliment details
  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const data = await getCompliment(id);
        setCompliment(data);
        setHintsUsed((data as any).hints_used || 0);
        setCurrentReaction((data as any).reaction || null);

        // Mark as read
        if (!data.is_read) {
          await markAsRead(id);
        }

        // Set initial game state
        if (data.is_revealed) {
          setGameState('revealed');
        } else if (data.guesses_remaining <= 0) {
          setGameState('out_of_guesses');
        }

        // Check for secret admirer chat
        if ((data as any).is_secret_admirer) {
          const chat = await fetchChatByCompliment(id);
          if (chat) {
            setSecretAdmirerChatId(chat.id);
          }
        }
      } catch (err) {
        console.error('Error fetching compliment:', err);
        Alert.alert('Error', 'Failed to load compliment');
        router.back();
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleStartGuessing = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGameState('guessing');
  };

  const handleSelectFriend = (friend: User) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFriend(friend);
  };

  const handleSubmitGuess = async () => {
    if (!selectedFriend || !id) return;

    setIsGuessing(true);

    try {
      const isCorrect = await makeGuess(id, selectedFriend.id);

      // Refresh compliment data
      const updatedCompliment = await getCompliment(id);
      setCompliment(updatedCompliment);

      if (isCorrect) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setGameState('correct');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

        if (updatedCompliment.guesses_remaining <= 0) {
          setGameState('out_of_guesses');
        } else {
          setGameState('wrong');
          // Reset after showing wrong state
          setTimeout(() => {
            setSelectedFriend(null);
            setGameState('guessing');
          }, 1500);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsGuessing(false);
    }
  };

  const handleSkip = () => {
    router.back();
  };

  const handleDone = () => {
    router.back();
  };

  const handleOpenChat = () => {
    if (secretAdmirerChatId) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.push(`/secret-admirer/${secretAdmirerChatId}`);
    }
  };

  const handleGetHint = async (hintNumber: 1 | 2 | 3) => {
    if (!id || !canAffordHint()) {
      Alert.alert(
        'Not Enough Tokens',
        'Send more oomfs to earn tokens! You earn 1 token for every 5 compliments sent.',
        [{ text: 'OK' }]
      );
      return;
    }

    const hintNames = ['First letter of username', 'When they joined', 'Their level'];

    Alert.alert(
      `Get Hint ${hintNumber}?`,
      `Spend ${HINT_COST} token to get: ${hintNames[hintNumber - 1]}?\n\nYour balance: ${tokenBalance} token${tokenBalance === 1 ? '' : 's'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Get Hint',
          onPress: async () => {
            setIsGettingHint(true);
            try {
              const hint = await getHint(id, hintNumber);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setHints(prev => [...prev, hint]);
              setHintsUsed(hintNumber);
            } catch (err: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', err.message);
            } finally {
              setIsGettingHint(false);
            }
          },
        },
      ]
    );
  };

  const handleReaction = async (reaction: ReactionType) => {
    if (!id || isReacting) return;

    setIsReacting(true);
    try {
      // Toggle reaction if same one is tapped
      const newReaction = currentReaction === reaction ? null : reaction;
      await reactToCompliment(id, newReaction);
      setCurrentReaction(newReaction);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.message);
    } finally {
      setIsReacting(false);
    }
  };

  const handleRevealWithTokens = async () => {
    if (!id || !canAffordReveal()) {
      Alert.alert(
        'Not Enough Tokens',
        `Need ${FULL_REVEAL_COST} tokens for full reveal. Send more oomfs to earn tokens!`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Full Reveal?',
      `Spend ${FULL_REVEAL_COST} tokens to reveal who sent this?\n\nYour balance: ${tokenBalance} token${tokenBalance === 1 ? '' : 's'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reveal',
          onPress: async () => {
            setIsRevealing(true);
            try {
              await revealWithTokens(id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

              // Refresh compliment data
              const updatedCompliment = await getCompliment(id);
              setCompliment(updatedCompliment);
              setGameState('revealed');
            } catch (err: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', err.message);
            } finally {
              setIsRevealing(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading || !compliment) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingIcon}>
            <Ionicons name="heart" size={32} color={colors.primary} />
          </View>
          <Text style={styles.loadingText}>Loading oomf...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Get the message content (template or custom)
  const messageEmoji = compliment.template?.emoji || '💌';
  const messageText = (compliment as any).custom_message || compliment.template?.text || '';
  const isSecretAdmirer = (compliment as any).is_secret_admirer;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.closeButtonPressed,
          ]}
        >
          <Ionicons name="close" size={24} color={colors.textMuted} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Ionicons
            name={gameState === 'guessing' ? 'help-circle' : isSecretAdmirer ? 'heart' : 'heart'}
            size={18}
            color={isSecretAdmirer ? colors.secondary : colors.primary}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.headerTitle}>
            {gameState === 'guessing' ? 'Who sent this?' : isSecretAdmirer ? 'Secret Admirer' : 'Someone thinks...'}
          </Text>
        </View>
        <View style={styles.closeButton} />
      </View>

      {/* Main Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Compliment Card */}
        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 15 }}
        >
          <Card style={[styles.complimentCard, isSecretAdmirer && styles.secretAdmirerCard]} variant="elevated">
            <View style={[styles.emojiContainer, isSecretAdmirer && styles.secretAdmirerEmojiContainer]}>
              <Text style={styles.complimentEmoji}>{messageEmoji}</Text>
            </View>
            <Text style={styles.complimentText}>{messageText}</Text>

            {/* Category badge */}
            {isSecretAdmirer ? (
              <View style={[styles.categoryBadge, styles.secretAdmirerBadge]}>
                <Text style={[styles.categoryText, styles.secretAdmirerCategoryText]}>Secret Admirer</Text>
              </View>
            ) : compliment.template?.category && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>
                  {compliment.template.category.charAt(0).toUpperCase() + compliment.template.category.slice(1)}
                </Text>
              </View>
            )}

            {/* Reactions */}
            <View style={styles.reactionsContainer}>
              <Text style={styles.reactionsLabel}>React</Text>
              <View style={styles.reactionButtons}>
                {REACTIONS.map((r) => (
                  <Pressable
                    key={r.type}
                    onPress={() => handleReaction(r.type)}
                    disabled={isReacting}
                    style={({ pressed }) => [
                      styles.reactionButton,
                      currentReaction === r.type && styles.reactionButtonActive,
                      pressed && styles.reactionButtonPressed,
                    ]}
                  >
                    <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                  </Pressable>
                ))}
              </View>
              {currentReaction && (
                <MotiView
                  from={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', damping: 15 }}
                  style={styles.currentReactionBadge}
                >
                  <Text style={styles.currentReactionText}>
                    You reacted {getReactionEmoji(currentReaction)}
                  </Text>
                </MotiView>
              )}
            </View>

            {/* Secret Admirer Reply Button */}
            {isSecretAdmirer && secretAdmirerChatId && (
              <Pressable
                style={({ pressed }) => [
                  styles.replyButton,
                  pressed && styles.replyButtonPressed,
                ]}
                onPress={handleOpenChat}
              >
                <Ionicons name="chatbubbles" size={18} color={colors.secondary} />
                <Text style={styles.replyButtonText}>
                  Reply to Secret Admirer
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.secondary} />
              </Pressable>
            )}

            {/* Show hints if any */}
            {hints.length > 0 && gameState !== 'revealed' && gameState !== 'correct' && (
              <View style={styles.hintsContainer}>
                <View style={styles.hintsDivider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.hintsLabel}>Hints</Text>
                  <View style={styles.dividerLine} />
                </View>
                {hints.map((hint, index) => (
                  <MotiView
                    key={index}
                    from={{ opacity: 0, translateX: -10 }}
                    animate={{ opacity: 1, translateX: 0 }}
                    transition={{ type: 'timing', delay: index * 100 }}
                    style={styles.hintItem}
                  >
                    <View style={styles.hintIcon}>
                      <Ionicons
                        name={hint.hint_type === 'first_letter' ? 'text' : hint.hint_type === 'join_date' ? 'calendar' : 'trophy'}
                        size={16}
                        color={colors.secondary}
                      />
                    </View>
                    <View style={styles.hintContent}>
                      <Text style={styles.hintLabel}>{hint.hint_text}</Text>
                      <Text style={styles.hintValue}>{hint.hint_value}</Text>
                    </View>
                  </MotiView>
                ))}
              </View>
            )}

            {/* Show sender if revealed */}
            {(gameState === 'revealed' || gameState === 'correct') && compliment.sender && (
              <MotiView
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', delay: 300 }}
                style={styles.senderReveal}
              >
                <View style={styles.revealDivider}>
                  <View style={styles.dividerLine} />
                  <Ionicons name="heart" size={16} color={colors.primary} />
                  <View style={styles.dividerLine} />
                </View>
                <Text style={styles.fromText}>From</Text>
                <Avatar
                  source={compliment.sender.avatar_url}
                  name={compliment.sender.display_name}
                  size="lg"
                />
                <Text style={styles.senderName}>{compliment.sender.display_name}</Text>
                <Text style={styles.senderUsername}>@{compliment.sender.username}</Text>
              </MotiView>
            )}
          </Card>
        </MotiView>

        {/* Game States */}
        <AnimatePresence>
          {/* Initial viewing state */}
          {gameState === 'viewing' && (
            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={{ opacity: 0, translateY: -20 }}
              transition={{ type: 'timing', duration: 300 }}
              style={styles.actions}
            >
              <View style={styles.guessesContainer}>
                <Ionicons name="help-circle-outline" size={18} color={colors.textMuted} />
                <Text style={styles.guessesText}>
                  {compliment.guesses_remaining} guesses remaining
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.guessButton,
                  pressed && styles.guessButtonPressed,
                ]}
                onPress={handleStartGuessing}
              >
                <Ionicons name="search" size={22} color={colors.textInverse} />
                <Text style={styles.guessButtonText}>Guess Who</Text>
                <Ionicons name="arrow-forward" size={20} color={colors.textInverse} />
              </Pressable>

              {/* Hint/Reveal Options */}
              <View style={styles.tokenOptionsContainer}>
                <Text style={styles.tokenOptionsTitle}>
                  <Ionicons name="flash" size={14} color={colors.secondary} /> Token Options
                </Text>

                {/* Hint Buttons */}
                <View style={styles.hintButtons}>
                  {[1, 2, 3].map((num) => {
                    const isUnlocked = hintsUsed >= num;
                    const isNext = hintsUsed === num - 1;
                    const hintLabels = ['1st Letter', 'Join Date', 'Level'];
                    const hintIcons: Array<keyof typeof Ionicons.glyphMap> = ['text', 'calendar', 'trophy'];

                    return (
                      <Pressable
                        key={num}
                        style={({ pressed }) => [
                          styles.hintButton,
                          isUnlocked && styles.hintButtonUnlocked,
                          isNext && styles.hintButtonNext,
                          !isNext && !isUnlocked && styles.hintButtonLocked,
                          pressed && isNext && styles.hintButtonPressed,
                        ]}
                        onPress={() => isNext && handleGetHint(num as 1 | 2 | 3)}
                        disabled={!isNext || isGettingHint}
                      >
                        <Ionicons
                          name={isUnlocked ? 'checkmark-circle' : hintIcons[num - 1]}
                          size={18}
                          color={isUnlocked ? colors.success : isNext ? colors.secondary : colors.textMuted}
                        />
                        <Text style={[
                          styles.hintButtonText,
                          isUnlocked && styles.hintButtonTextUnlocked,
                          isNext && styles.hintButtonTextNext,
                        ]}>
                          {hintLabels[num - 1]}
                        </Text>
                        {!isUnlocked && (
                          <Text style={[
                            styles.hintCost,
                            isNext && styles.hintCostActive,
                          ]}>
                            {HINT_COST}🪙
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                {/* Full Reveal Button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.tokenRevealButton,
                    !canAffordReveal() && styles.tokenRevealButtonDisabled,
                    pressed && canAffordReveal() && styles.tokenRevealButtonPressed,
                  ]}
                  onPress={handleRevealWithTokens}
                  disabled={isRevealing || !canAffordReveal()}
                >
                  <View style={styles.tokenIcon}>
                    <Ionicons name="eye" size={16} color={canAffordReveal() ? colors.secondary : colors.textMuted} />
                  </View>
                  <Text style={[
                    styles.tokenRevealButtonText,
                    !canAffordReveal() && styles.tokenRevealButtonTextDisabled,
                  ]}>
                    {isRevealing ? 'Revealing...' : `Full Reveal (${FULL_REVEAL_COST} tokens)`}
                  </Text>
                  <Text style={styles.tokenBalance}>Balance: {tokenBalance}🪙</Text>
                </Pressable>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.skipButton,
                  pressed && styles.skipButtonPressed,
                ]}
                onPress={handleSkip}
              >
                <Ionicons name="sparkles-outline" size={18} color={colors.textMuted} />
                <Text style={styles.skipButtonText}>Just vibe</Text>
              </Pressable>
            </MotiView>
          )}

          {/* Guessing state */}
          {gameState === 'guessing' && (
            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={{ opacity: 0, translateY: -20 }}
              transition={{ type: 'timing', duration: 300 }}
              style={styles.guessingContainer}
            >
              <View style={styles.guessHeader}>
                <View style={styles.guessesIndicator}>
                  {[...Array(3)].map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.guessDot,
                        i < compliment.guesses_remaining && styles.guessDotActive,
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.guessesTextSmall}>
                  {compliment.guesses_remaining} of 3 guesses left
                </Text>
              </View>

              <View style={styles.selectHeader}>
                <Ionicons name="people" size={20} color={colors.text} />
                <Text style={styles.selectPrompt}>Who do you think sent this?</Text>
              </View>

              <View style={styles.friendGrid}>
                {friends.map((f, index) => (
                  <MotiView
                    key={f.friend.id}
                    from={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', delay: index * 50 }}
                  >
                    <Pressable
                      style={({ pressed }) => [
                        styles.friendOption,
                        selectedFriend?.id === f.friend.id && styles.friendOptionSelected,
                        pressed && styles.friendOptionPressed,
                      ]}
                      onPress={() => handleSelectFriend(f.friend)}
                    >
                      <View style={styles.friendAvatarWrapper}>
                        <Avatar
                          source={f.friend.avatar_url}
                          name={f.friend.display_name}
                          size="md"
                        />
                        {selectedFriend?.id === f.friend.id && (
                          <View style={styles.selectedCheck}>
                            <Ionicons name="checkmark" size={12} color={colors.textInverse} />
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.friendOptionName,
                          selectedFriend?.id === f.friend.id && styles.friendOptionNameSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {f.friend.display_name}
                      </Text>
                    </Pressable>
                  </MotiView>
                ))}
              </View>

              <View style={styles.guessActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.lockInButton,
                    !selectedFriend && styles.lockInButtonDisabled,
                    pressed && selectedFriend && styles.lockInButtonPressed,
                  ]}
                  onPress={handleSubmitGuess}
                  disabled={!selectedFriend || isGuessing}
                >
                  {isGuessing ? (
                    <Text style={styles.lockInButtonText}>Checking...</Text>
                  ) : (
                    <>
                      <Ionicons name="lock-closed" size={20} color={colors.textInverse} />
                      <Text style={styles.lockInButtonText}>Lock in guess</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.skipButton,
                    pressed && styles.skipButtonPressed,
                  ]}
                  onPress={() => setGameState('viewing')}
                >
                  <Text style={styles.skipButtonText}>Back</Text>
                </Pressable>
              </View>
            </MotiView>
          )}

          {/* Wrong guess state */}
          {gameState === 'wrong' && (
            <MotiView
              from={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring' }}
              style={styles.resultContainer}
            >
              <View style={[styles.resultIconContainer, styles.resultIconWrong]}>
                <Ionicons name="close" size={48} color={colors.error} />
              </View>
              <Text style={styles.resultTitle}>Not quite...</Text>
              <Text style={styles.resultSubtitle}>
                {compliment.guesses_remaining} {compliment.guesses_remaining === 1 ? 'guess' : 'guesses'} left
              </Text>
            </MotiView>
          )}

          {/* Correct guess state */}
          {gameState === 'correct' && (
            <MotiView
              from={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring' }}
              style={styles.resultContainer}
            >
              <View style={[styles.resultIconContainer, styles.resultIconCorrect]}>
                <Ionicons name="checkmark" size={48} color={colors.success} />
              </View>
              <Text style={styles.resultTitle}>You got it!</Text>
              <View style={styles.pointsBadge}>
                <Ionicons name="star" size={16} color={colors.primary} />
                <Text style={styles.pointsText}>+5 oomf points</Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.doneButton,
                  pressed && styles.doneButtonPressed,
                ]}
                onPress={handleDone}
              >
                <Ionicons name="checkmark-circle" size={20} color={colors.textInverse} />
                <Text style={styles.doneButtonText}>Done</Text>
              </Pressable>
            </MotiView>
          )}

          {/* Out of guesses state */}
          {gameState === 'out_of_guesses' && (
            <MotiView
              from={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring' }}
              style={styles.resultContainer}
            >
              <View style={[styles.resultIconContainer, styles.resultIconMystery]}>
                <Ionicons name="help" size={48} color={colors.textMuted} />
              </View>
              <Text style={styles.resultTitle}>Out of guesses</Text>
              <Text style={styles.resultSubtitle}>
                The mystery remains unsolved...
              </Text>

              {/* Still offer token reveal */}
              {canAffordReveal() && (
                <Pressable
                  style={({ pressed }) => [
                    styles.tokenRevealButtonSmall,
                    pressed && styles.tokenRevealButtonPressed,
                  ]}
                  onPress={handleRevealWithTokens}
                  disabled={isRevealing}
                >
                  <Ionicons name="eye" size={16} color={colors.secondary} />
                  <Text style={styles.tokenRevealButtonTextSmall}>
                    {isRevealing ? 'Revealing...' : `Reveal for ${FULL_REVEAL_COST} tokens`}
                  </Text>
                </Pressable>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.doneButton,
                  pressed && styles.doneButtonPressed,
                ]}
                onPress={handleDone}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </Pressable>
            </MotiView>
          )}

          {/* Already revealed state */}
          {gameState === 'revealed' && (
            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300 }}
              style={styles.actions}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.doneButton,
                  pressed && styles.doneButtonPressed,
                ]}
                onPress={handleDone}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </Pressable>
            </MotiView>
          )}
        </AnimatePresence>
      </ScrollView>
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
    backgroundColor: `${colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: fontSize.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  closeButtonPressed: {
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },

  // Compliment Card
  complimentCard: {
    alignItems: 'center',
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  secretAdmirerCard: {
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  emojiContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 3,
    borderColor: colors.border,
  },
  secretAdmirerEmojiContainer: {
    borderColor: colors.secondary,
    backgroundColor: `${colors.secondary}10`,
  },
  complimentEmoji: {
    fontSize: 48,
  },
  complimentText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 32,
  },
  categoryBadge: {
    marginTop: spacing.md,
    backgroundColor: `${colors.primary}20`,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  secretAdmirerBadge: {
    backgroundColor: `${colors.secondary}20`,
  },
  categoryText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  secretAdmirerCategoryText: {
    color: colors.secondary,
  },

  // Reactions
  reactionsContainer: {
    width: '100%',
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  reactionsLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  reactionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  reactionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  reactionButtonActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}15`,
  },
  reactionButtonPressed: {
    transform: [{ scale: 0.9 }],
  },
  reactionEmoji: {
    fontSize: 24,
  },
  currentReactionBadge: {
    marginTop: spacing.sm,
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  currentReactionText: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },

  // Reply Button
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    backgroundColor: `${colors.secondary}15`,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  replyButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  replyButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.secondary,
  },

  // Hints Container
  hintsContainer: {
    width: '100%',
    marginTop: spacing.lg,
  },
  hintsDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  hintsLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.secondary,
  },
  hintItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.secondary}10`,
    padding: spacing.sm,
    borderRadius: 10,
    marginBottom: spacing.xs,
  },
  hintIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${colors.secondary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  hintContent: {
    flex: 1,
  },
  hintLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  hintValue: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.secondary,
  },

  // Sender Reveal
  senderReveal: {
    alignItems: 'center',
    marginTop: spacing.xl,
    width: '100%',
  },
  revealDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  fromText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  senderName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.sm,
  },
  senderUsername: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  // Actions
  actions: {
    gap: spacing.md,
  },
  guessesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  guessesText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  guessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  guessButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  guessButtonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: 12,
  },
  skipButtonPressed: {
    backgroundColor: colors.surface,
  },
  skipButtonText: {
    fontSize: fontSize.base,
    color: colors.textMuted,
  },

  // Token Options
  tokenOptionsContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tokenOptionsTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  hintButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  hintButton: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.surface,
    gap: 4,
  },
  hintButtonUnlocked: {
    backgroundColor: `${colors.success}15`,
  },
  hintButtonNext: {
    backgroundColor: `${colors.secondary}15`,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  hintButtonLocked: {
    opacity: 0.5,
  },
  hintButtonPressed: {
    transform: [{ scale: 0.95 }],
  },
  hintButtonText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },
  hintButtonTextUnlocked: {
    color: colors.success,
  },
  hintButtonTextNext: {
    color: colors.secondary,
  },
  hintCost: {
    fontSize: 10,
    color: colors.textMuted,
  },
  hintCostActive: {
    color: colors.secondary,
  },
  tokenRevealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  tokenRevealButtonDisabled: {
    borderColor: colors.border,
    opacity: 0.6,
  },
  tokenRevealButtonPressed: {
    backgroundColor: colors.card,
    transform: [{ scale: 0.98 }],
  },
  tokenIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: `${colors.secondary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenRevealButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.secondary,
  },
  tokenRevealButtonTextDisabled: {
    color: colors.textMuted,
  },
  tokenBalance: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  tokenRevealButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: `${colors.secondary}20`,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    marginTop: spacing.md,
  },
  tokenRevealButtonTextSmall: {
    fontSize: fontSize.sm,
    color: colors.secondary,
    fontWeight: fontWeight.medium,
  },

  // Guessing
  guessingContainer: {
    gap: spacing.md,
  },
  guessHeader: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  guessesIndicator: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  guessDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  guessDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  guessesTextSmall: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  selectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  selectPrompt: {
    fontSize: fontSize.base,
    color: colors.text,
    fontWeight: fontWeight.semibold,
  },
  friendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  friendOption: {
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    width: FRIEND_CARD_WIDTH,
  },
  friendOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.card,
  },
  friendOptionPressed: {
    opacity: 0.7,
  },
  friendAvatarWrapper: {
    position: 'relative',
  },
  selectedCheck: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  friendOptionName: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  friendOptionNameSelected: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  guessActions: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  lockInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 12,
  },
  lockInButtonDisabled: {
    backgroundColor: colors.surface,
    opacity: 0.5,
  },
  lockInButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  lockInButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },

  // Result States
  resultContainer: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  resultIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  resultIconWrong: {
    backgroundColor: `${colors.error}20`,
  },
  resultIconCorrect: {
    backgroundColor: `${colors.success}20`,
  },
  resultIconMystery: {
    backgroundColor: colors.surface,
  },
  resultTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  resultSubtitle: {
    fontSize: fontSize.base,
    color: colors.textMuted,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: `${colors.primary}20`,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    marginTop: spacing.xs,
  },
  pointsText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 12,
    marginTop: spacing.lg,
    minWidth: 150,
  },
  doneButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  doneButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },
});
