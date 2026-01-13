import { View, Text, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { colors, spacing, fontSize, fontWeight } from '../lib/constants';

type QRCodeDisplayProps = {
  username: string;
  displayName?: string;
  size?: number;
};

export function QRCodeDisplay({ username, displayName, size = 200 }: QRCodeDisplayProps) {
  const qrValue = `oomf://user/${username}`;

  return (
    <View style={styles.container}>
      <View style={styles.qrContainer}>
        <QRCode
          value={qrValue}
          size={size}
          color={colors.text}
          backgroundColor={colors.card}
          logo={undefined}
          logoSize={50}
          logoBackgroundColor="transparent"
        />
      </View>
      {displayName && (
        <View style={styles.nameContainer}>
          <Text style={styles.displayName}>{displayName}</Text>
          <Text style={styles.username}>@{username}</Text>
        </View>
      )}
      <Text style={styles.hint}>Scan to add as friend</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  qrContainer: {
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  nameContainer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  displayName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  username: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  hint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
});
