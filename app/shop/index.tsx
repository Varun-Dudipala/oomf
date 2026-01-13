import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from '../../lib/moti-shim';
import * as Haptics from 'expo-haptics';
import { Card } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { useIAP, type TokenPackage } from '../../hooks/useIAP';
import { colors, spacing, fontSize, fontWeight } from '../../lib/constants';

function PackageCard({
  pkg,
  onPurchase,
  isPurchasing,
}: {
  pkg: TokenPackage;
  onPurchase: (pkg: TokenPackage) => void;
  isPurchasing: boolean;
}) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPurchase(pkg);
  };

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', damping: 15 }}
    >
      <Pressable
        onPress={handlePress}
        disabled={isPurchasing}
        style={({ pressed }) => [
          styles.packageCard,
          pkg.popular && styles.packageCardPopular,
          pkg.bestValue && styles.packageCardBestValue,
          pressed && styles.packageCardPressed,
        ]}
      >
        {pkg.popular && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>POPULAR</Text>
          </View>
        )}
        {pkg.bestValue && (
          <View style={[styles.badge, styles.badgeBestValue]}>
            <Text style={styles.badgeText}>BEST VALUE</Text>
          </View>
        )}

        <View style={styles.packageContent}>
          <View style={styles.tokenAmount}>
            <Ionicons name="flash" size={24} color={colors.secondary} />
            <Text style={styles.tokenCount}>{pkg.tokens}</Text>
          </View>
          <Text style={styles.packageName}>{pkg.name}</Text>
          <Text style={styles.packagePrice}>{pkg.price}</Text>
          <Text style={styles.perToken}>
            {(pkg.priceValue / pkg.tokens * 100).toFixed(1)}¢ per token
          </Text>
        </View>
      </Pressable>
    </MotiView>
  );
}

export default function TokenShopScreen() {
  const { user } = useAuthStore();
  const { packages, isLoading, isPurchasing, purchaseTokens, restorePurchases } = useIAP();

  const handlePurchase = async (pkg: TokenPackage) => {
    await purchaseTokens(pkg);
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
        <Text style={styles.headerTitle}>Token Shop</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Current Balance */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400 }}
        >
          <Card variant="elevated" style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Your Balance</Text>
            <View style={styles.balanceRow}>
              <Ionicons name="flash" size={32} color={colors.secondary} />
              <Text style={styles.balanceValue}>{user?.tokens || 0}</Text>
              <Text style={styles.balanceUnit}>tokens</Text>
            </View>
          </Card>
        </MotiView>

        {/* What tokens are for */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 100 }}
          style={styles.infoSection}
        >
          <Text style={styles.sectionTitle}>What can you do with tokens?</Text>
          <View style={styles.infoList}>
            <View style={styles.infoItem}>
              <View style={styles.infoIcon}>
                <Ionicons name="eye-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoTitle}>Get Hints (1 token each)</Text>
                <Text style={styles.infoDesc}>First letter, join date, or level</Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <View style={styles.infoIcon}>
                <Ionicons name="person-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoTitle}>Full Reveal (3 tokens)</Text>
                <Text style={styles.infoDesc}>See who sent the compliment</Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <View style={styles.infoIcon}>
                <Ionicons name="heart-outline" size={20} color={colors.secondary} />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoTitle}>Secret Admirer (3 tokens)</Text>
                <Text style={styles.infoDesc}>Send a custom anonymous message</Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <View style={styles.infoIcon}>
                <Ionicons name="snow-outline" size={20} color={colors.accent} />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoTitle}>Streak Freeze (5 tokens)</Text>
                <Text style={styles.infoDesc}>Protect your streak for a day</Text>
              </View>
            </View>
          </View>
        </MotiView>

        {/* Token Packages */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 200 }}
          style={styles.packagesSection}
        >
          <Text style={styles.sectionTitle}>Get Tokens</Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading packages...</Text>
            </View>
          ) : (
            <View style={styles.packagesGrid}>
              {packages.map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  onPurchase={handlePurchase}
                  isPurchasing={isPurchasing}
                />
              ))}
            </View>
          )}
        </MotiView>

        {/* Restore Purchases */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 400, delay: 300 }}
          style={styles.restoreSection}
        >
          <Pressable
            onPress={restorePurchases}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.restoreButton,
              pressed && styles.restoreButtonPressed,
            ]}
          >
            <Text style={styles.restoreText}>Restore Purchases</Text>
          </Pressable>
        </MotiView>

        {/* Purchasing Overlay */}
        {isPurchasing && (
          <View style={styles.purchasingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.purchasingText}>Processing purchase...</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Purchases are processed securely through the App Store.
          </Text>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPressed: {
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
  balanceCard: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  balanceLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  balanceValue: {
    fontSize: 48,
    fontWeight: fontWeight.bold,
    color: colors.secondary,
  },
  balanceUnit: {
    fontSize: fontSize.lg,
    color: colors.textMuted,
  },
  infoSection: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  infoList: {
    gap: spacing.md,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
  },
  infoTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  infoDesc: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  packagesSection: {
    gap: spacing.md,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  packagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  packageCard: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
  },
  packageCardPopular: {
    borderColor: colors.primary,
  },
  packageCardBestValue: {
    borderColor: colors.secondary,
  },
  packageCardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: -24,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 2,
    transform: [{ rotate: '45deg' }],
  },
  badgeBestValue: {
    backgroundColor: colors.secondary,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: 0.5,
  },
  packageContent: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  tokenAmount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  tokenCount: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  packageName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
  },
  packagePrice: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  perToken: {
    fontSize: fontSize.xs,
    color: colors.textSubtle,
  },
  restoreSection: {
    alignItems: 'center',
  },
  restoreButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  restoreButtonPressed: {
    opacity: 0.7,
  },
  restoreText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  purchasingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  purchasingText: {
    fontSize: fontSize.base,
    color: colors.text,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  footerText: {
    fontSize: fontSize.xs,
    color: colors.textSubtle,
    textAlign: 'center',
  },
});
