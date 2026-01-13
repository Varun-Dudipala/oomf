// Temporary shim to replace Moti with regular Views for Expo Go compatibility
import React from 'react';
import { View, ViewProps } from 'react-native';

// Simple replacement for MotiView - just renders children without animation
export function MotiView({ children, style, ...props }: ViewProps & {
  from?: any;
  animate?: any;
  exit?: any;
  transition?: any;
}) {
  return <View style={style} {...props}>{children}</View>;
}

// AnimatePresence replacement - just renders children
export function AnimatePresence({ children, exitBeforeEnter }: {
  children: React.ReactNode;
  exitBeforeEnter?: boolean;
}) {
  return <>{children}</>;
}
