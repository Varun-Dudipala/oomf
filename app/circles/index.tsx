import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from '../../lib/moti-shim';
import * as Haptics from 'expo-haptics';
import { Card, Button } from '../../components/ui';
import { useCircles, type Circle } from '../../hooks/useCircles';
import { colors, spacing, fontSize, fontWeight } from '../../lib/constants';

const EMOJI_OPTIONS = ['👥', '💜', '🔥', '⭐', '🎯', '💪', '🎮', '🎵', '📚', '💼', '🏀', '🎨'];

function CreateCircleModal({
  visible,
  onClose,
  onCreate,
  circleColors,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, emoji: string, color: string) => Promise<void>;
  circleColors: string[];
}) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('👥');
  const [color, setColor] = useState(circleColors[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Please enter a circle name');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await onCreate(name.trim(), emoji, color);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setName('');
      setEmoji('👥');
      setColor(circleColors[0]);
      onClose();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err.message || 'Failed to create circle');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setEmoji('👥');
    setColor(circleColors[0]);
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
            <Text style={styles.modalTitle}>Create Circle</Text>
            <Text style={styles.modalSubtitle}>
              Group your friends together
            </Text>
          </View>

          {/* Emoji Selector */}
          <View style={styles.emojiSection}>
            <Text style={styles.sectionLabel}>Choose an emoji</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.emojiList}
            >
              {EMOJI_OPTIONS.map((e) => (
                <Pressable
                  key={e}
                  style={[
                    styles.emojiOption,
                    emoji === e && styles.emojiOptionSelected,
                  ]}
                  onPress={() => setEmoji(e)}
                >
                  <Text style={styles.emojiOptionText}>{e}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Name Input */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionLabel}>Circle name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Close Friends, Study Group"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={(text) => {
                setName(text);
                setError('');
              }}
              maxLength={50}
              autoFocus
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          {/* Color Selector */}
          <View style={styles.colorSection}>
            <Text style={styles.sectionLabel}>Pick a color</Text>
            <View style={styles.colorList}>
              {circleColors.map((c) => (
                <Pressable
                  key={c}
                  style={[
                    styles.colorOption,
                    { backgroundColor: c },
                    color === c && styles.colorOptionSelected,
                  ]}
                  onPress={() => setColor(c)}
                />
              ))}
            </View>
          </View>

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
              onPress={handleCreate}
              size="md"
              style={styles.modalButton}
              loading={isLoading}
            >
              Create
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CircleCard({ circle, onPress }: { circle: Circle; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.circleCard,
        { borderLeftColor: circle.color },
        pressed && styles.circleCardPressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.circleEmoji, { backgroundColor: `${circle.color}20` }]}>
        <Text style={styles.circleEmojiText}>{circle.emoji}</Text>
      </View>
      <View style={styles.circleInfo}>
        <View style={styles.circleNameRow}>
          <Text style={styles.circleName}>{circle.name}</Text>
          {circle.is_owner && (
            <View style={styles.ownerBadge}>
              <Text style={styles.ownerBadgeText}>Owner</Text>
            </View>
          )}
        </View>
        <Text style={styles.circleMemberCount}>
          {circle.member_count} member{circle.member_count !== 1 ? 's' : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

export default function CirclesScreen() {
  const { circles, isLoading, refetch, createCircle, circleColors } = useCircles();
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleCreate = async (name: string, emoji: string, color: string) => {
    const { error } = await createCircle(name, emoji, undefined, color);
    if (error) throw new Error(error);
  };

  const handleCirclePress = (circle: Circle) => {
    router.push(`/circles/${circle.id}` as any);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={styles.title}>Circles</Text>
          <Text style={styles.subtitle}>Your friend groups</Text>
        </View>
        <Pressable
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={24} color={colors.primary} />
        </Pressable>
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
        {/* Info Card */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400 }}
        >
          <Card style={styles.infoCard} variant="elevated">
            <View style={styles.infoIconContainer}>
              <Ionicons name="people-circle-outline" size={32} color={colors.primary} />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoTitle}>Organize your friends</Text>
              <Text style={styles.infoDescription}>
                Create circles to group friends for quick compliments. Perfect for close friends, teammates, or study groups!
              </Text>
            </View>
          </Card>
        </MotiView>

        {/* Circles List */}
        {isLoading ? (
          <Text style={styles.loadingText}>Loading circles...</Text>
        ) : circles.length === 0 ? (
          <MotiView
            from={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', delay: 200 }}
          >
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>🎯</Text>
              <Text style={styles.emptyTitle}>No circles yet</Text>
              <Text style={styles.emptySubtitle}>
                Create your first circle to organize your friends
              </Text>
              <Button
                onPress={() => setShowCreateModal(true)}
                size="md"
                style={styles.emptyButton}
              >
                Create Circle
              </Button>
            </Card>
          </MotiView>
        ) : (
          <View style={styles.circlesList}>
            {circles.map((circle, index) => (
              <MotiView
                key={circle.id}
                from={{ opacity: 0, translateX: -20 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'timing', duration: 200, delay: index * 50 }}
              >
                <CircleCard
                  circle={circle}
                  onPress={() => handleCirclePress(circle)}
                />
              </MotiView>
            ))}
          </View>
        )}
      </ScrollView>

      <CreateCircleModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
        circleColors={circleColors}
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
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.primary}20`,
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

  // Info Card
  infoCard: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
  },
  infoIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  infoDescription: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    lineHeight: 20,
  },

  // Circles List
  circlesList: {
    gap: spacing.sm,
  },
  circleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  circleCardPressed: {
    backgroundColor: colors.cardHover,
    transform: [{ scale: 0.98 }],
  },
  circleEmoji: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleEmojiText: {
    fontSize: 24,
  },
  circleInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  circleNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  circleName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  ownerBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ownerBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },
  circleMemberCount: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Loading & Empty
  loadingText: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
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
    minWidth: 160,
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
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  emojiSection: {
    marginBottom: spacing.lg,
  },
  emojiList: {
    gap: spacing.sm,
  },
  emojiOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  emojiOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}20`,
  },
  emojiOptionText: {
    fontSize: 22,
  },
  inputSection: {
    marginBottom: spacing.lg,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: fontSize.base,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorText: {
    fontSize: fontSize.xs,
    color: colors.error,
    marginTop: spacing.xs,
  },
  colorSection: {
    marginBottom: spacing.lg,
  },
  colorList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  modalButton: {
    flex: 1,
  },
});
