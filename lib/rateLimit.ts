// Rate Limiting using AsyncStorage (client-side)
// For production, consider using Upstash Redis for server-side rate limiting

import AsyncStorage from '@react-native-async-storage/async-storage';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
}

interface RateLimitEntry {
  count: number;
  firstRequest: number;
}

const RATE_LIMIT_PREFIX = 'oomf_rate_limit_';

// Rate limit configurations
export const rateLimits = {
  sendCompliment: { maxRequests: 10, windowMs: 24 * 60 * 60 * 1000 }, // 10 per day
  sendFriendRequest: { maxRequests: 20, windowMs: 24 * 60 * 60 * 1000 }, // 20 per day
  magicLink: { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
  guessAttempt: { maxRequests: 100, windowMs: 60 * 60 * 1000 }, // 100 per hour (soft limit)
} as const;

export type RateLimitAction = keyof typeof rateLimits;

// Cooldown configurations (per-target limits)
export const cooldowns = {
  complimentToFriend: 12 * 60 * 60 * 1000, // 12 hours between compliments to same friend
} as const;

async function getStorageKey(action: RateLimitAction, userId: string): Promise<string> {
  return `${RATE_LIMIT_PREFIX}${action}_${userId}`;
}

async function getCooldownKey(userId: string, targetId: string): Promise<string> {
  return `${RATE_LIMIT_PREFIX}cooldown_${userId}_${targetId}`;
}

/**
 * Check if an action is rate limited
 * Returns { allowed: boolean, remaining: number, resetTime: number }
 */
export async function checkRateLimit(
  action: RateLimitAction,
  userId: string
): Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: number | null;
  message: string | null;
}> {
  const config = rateLimits[action];
  const key = await getStorageKey(action, userId);

  try {
    const stored = await AsyncStorage.getItem(key);
    const now = Date.now();

    if (!stored) {
      // First request, allow it
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: null,
        message: null,
      };
    }

    const entry: RateLimitEntry = JSON.parse(stored);
    const windowStart = entry.firstRequest;
    const windowEnd = windowStart + config.windowMs;

    // Check if we're still in the same window
    if (now < windowEnd) {
      // Within window - check count
      if (entry.count >= config.maxRequests) {
        const resetInMs = windowEnd - now;
        const resetInMinutes = Math.ceil(resetInMs / (60 * 1000));
        const resetInHours = Math.ceil(resetInMs / (60 * 60 * 1000));

        let timeMessage: string;
        if (resetInMinutes < 60) {
          timeMessage = `${resetInMinutes} minute${resetInMinutes === 1 ? '' : 's'}`;
        } else {
          timeMessage = `${resetInHours} hour${resetInHours === 1 ? '' : 's'}`;
        }

        return {
          allowed: false,
          remaining: 0,
          resetTime: windowEnd,
          message: `Rate limit exceeded. Try again in ${timeMessage}.`,
        };
      }

      return {
        allowed: true,
        remaining: config.maxRequests - entry.count - 1,
        resetTime: null,
        message: null,
      };
    }

    // Window expired - allow and reset
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: null,
      message: null,
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // On error, allow the action but log it
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetTime: null,
      message: null,
    };
  }
}

/**
 * Record a rate-limited action
 */
export async function recordRateLimitAction(
  action: RateLimitAction,
  userId: string
): Promise<void> {
  const config = rateLimits[action];
  const key = await getStorageKey(action, userId);
  const now = Date.now();

  try {
    const stored = await AsyncStorage.getItem(key);

    if (!stored) {
      // First request
      const entry: RateLimitEntry = { count: 1, firstRequest: now };
      await AsyncStorage.setItem(key, JSON.stringify(entry));
      return;
    }

    const entry: RateLimitEntry = JSON.parse(stored);
    const windowEnd = entry.firstRequest + config.windowMs;

    if (now >= windowEnd) {
      // Window expired - reset
      const newEntry: RateLimitEntry = { count: 1, firstRequest: now };
      await AsyncStorage.setItem(key, JSON.stringify(newEntry));
    } else {
      // Within window - increment
      entry.count += 1;
      await AsyncStorage.setItem(key, JSON.stringify(entry));
    }
  } catch (error) {
    console.error('Rate limit record error:', error);
  }
}

/**
 * Check cooldown for sending compliment to a specific friend
 */
export async function checkFriendCooldown(
  userId: string,
  targetId: string
): Promise<{
  allowed: boolean;
  remainingMs: number | null;
  message: string | null;
}> {
  const key = await getCooldownKey(userId, targetId);

  try {
    const stored = await AsyncStorage.getItem(key);
    const now = Date.now();

    if (!stored) {
      return { allowed: true, remainingMs: null, message: null };
    }

    const lastSent = parseInt(stored, 10);
    const cooldownEnd = lastSent + cooldowns.complimentToFriend;

    if (now < cooldownEnd) {
      const remainingMs = cooldownEnd - now;
      const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));

      return {
        allowed: false,
        remainingMs,
        message: `You can send another oomf to this friend in ${remainingHours} hour${remainingHours === 1 ? '' : 's'}.`,
      };
    }

    return { allowed: true, remainingMs: null, message: null };
  } catch (error) {
    console.error('Cooldown check error:', error);
    return { allowed: true, remainingMs: null, message: null };
  }
}

/**
 * Record that a compliment was sent to a friend (for cooldown)
 */
export async function recordFriendCompliment(
  userId: string,
  targetId: string
): Promise<void> {
  const key = await getCooldownKey(userId, targetId);
  const now = Date.now();

  try {
    await AsyncStorage.setItem(key, now.toString());
  } catch (error) {
    console.error('Cooldown record error:', error);
  }
}

/**
 * Get remaining compliments for today
 */
export async function getRemainingCompliments(userId: string): Promise<number> {
  const result = await checkRateLimit('sendCompliment', userId);
  return result.allowed ? result.remaining + 1 : 0;
}

/**
 * Clear all rate limit data (for testing or account reset)
 */
export async function clearRateLimits(userId: string): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const rateLimitKeys = allKeys.filter(
      (key) => key.startsWith(RATE_LIMIT_PREFIX) && key.includes(userId)
    );
    await AsyncStorage.multiRemove(rateLimitKeys);
  } catch (error) {
    console.error('Clear rate limits error:', error);
  }
}
