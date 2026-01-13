// Design System Constants for Oomf
// Warm color palette with amber/orange accents

export const colors = {
  // Backgrounds
  background: '#0F0D0C',
  surface: '#1C1917',
  card: '#292524',
  cardHover: '#323130',
  border: '#44403C',
  borderLight: '#57534E',

  // Primary (Amber)
  primary: '#F59E0B',
  primaryHover: '#D97706',
  primaryLight: '#FCD34D',
  primaryDark: '#B45309',

  // Secondary (Orange)
  secondary: '#FB923C',
  secondaryHover: '#F97316',
  secondaryLight: '#FDBA74',

  // Accent (Gold)
  accent: '#FBBF24',
  accentHover: '#F59E0B',

  // Text
  text: '#FAFAF9',
  textMuted: '#A8A29E',
  textSubtle: '#78716C',
  textInverse: '#0F0D0C',

  // Status
  success: '#22C55E',
  successLight: '#4ADE80',
  error: '#EF4444',
  errorLight: '#F87171',
  warning: '#F59E0B',
  info: '#3B82F6',

  // Gradients
  gradientStart: '#F59E0B',
  gradientEnd: '#FB923C',

  // Overlays
  overlay: 'rgba(15, 13, 12, 0.8)',
  overlayLight: 'rgba(15, 13, 12, 0.5)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
} as const;

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const lineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
} as const;

// Animation durations (ms)
export const duration = {
  fast: 150,
  normal: 250,
  slow: 400,
} as const;

// Level thresholds
export const levels = [
  { level: 1, name: 'Newcomer', emoji: '🌱', minPoints: 0 },
  { level: 2, name: 'Rising', emoji: '⭐', minPoints: 25 },
  { level: 3, name: 'On Fire', emoji: '🔥', minPoints: 75 },
  { level: 4, name: 'Oomf Lord', emoji: '👑', minPoints: 150 },
  { level: 5, name: 'Legendary', emoji: '💫', minPoints: 300 },
] as const;

// Points system
export const points = {
  receiveCompliment: 3,
  sendCompliment: 1,
  correctGuess: 5,
  dailyStreakBonus: 2,
  weeklyTop3: 20,
} as const;

// App limits
export const limits = {
  maxFriends: 150,
  maxComplimentsPerDay: 10,
  cooldownPerFriendHours: 12,
  maxGuessAttempts: 3,
  usernameMinLength: 3,
  usernameMaxLength: 20,
  displayNameMaxLength: 30,
  bioMaxLength: 150,
} as const;

// Template categories (must match database constraint)
export const templateCategories = [
  { id: 'vibes', name: 'Vibes', emoji: '✨' },
  { id: 'funny', name: 'Funny', emoji: '😂' },
  { id: 'looks', name: 'Looks', emoji: '😍' },
  { id: 'smart', name: 'Smart', emoji: '🧠' },
  { id: 'skills', name: 'Skills', emoji: '💪' },
  { id: 'trust', name: 'Trust', emoji: '🤝' },
] as const;

export type TemplateCategory = typeof templateCategories[number]['id'];
