import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { colors, borderRadius, fontSize, fontWeight } from '../../lib/constants';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  source?: string | null;
  name?: string;
  size?: AvatarSize;
  style?: ViewStyle;
}

const sizeMap: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

const fontSizeMap: Record<AvatarSize, number> = {
  xs: 10,
  sm: 12,
  md: 18,
  lg: 24,
  xl: 36,
};

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getColorFromName(name?: string): string {
  if (!name) return colors.primary;
  const warmColors = [
    '#F59E0B', // amber-500
    '#FB923C', // orange-400
    '#F97316', // orange-500
    '#EA580C', // orange-600
    '#D97706', // amber-600
    '#B45309', // amber-700
    '#FBBF24', // amber-400
    '#FCD34D', // amber-300
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return warmColors[Math.abs(hash) % warmColors.length];
}

export function Avatar({ source, name, size = 'md', style }: AvatarProps) {
  const dimension = sizeMap[size];
  const textSize = fontSizeMap[size];
  const backgroundColor = getColorFromName(name);

  const containerStyle: ViewStyle = {
    width: dimension,
    height: dimension,
    borderRadius: dimension / 2,
    backgroundColor,
    overflow: 'hidden',
  };

  if (source) {
    return (
      <View style={[containerStyle, style]}>
        <Image
          source={{ uri: source }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
      </View>
    );
  }

  return (
    <View style={[containerStyle, styles.fallback, style]}>
      <Text style={[styles.initials, { fontSize: textSize }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.textInverse,
    fontWeight: fontWeight.semibold,
  },
});
