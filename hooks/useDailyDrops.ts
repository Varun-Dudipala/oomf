import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Template } from '../types/database';

export function useDailyDrops() {
  const [dailyDrops, setDailyDrops] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDailyDrops = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.rpc('get_daily_drops' as any);

      if (fetchError) {
        // If the function doesn't exist yet, try direct query
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('templates')
          .select('*')
          .eq('is_daily_drop', true)
          .eq('is_active', true);

        if (fallbackError) throw fallbackError;
        setDailyDrops((fallbackData || []) as Template[]);
      } else {
        setDailyDrops((data || []) as Template[]);
      }
    } catch (err: any) {
      console.error('Error fetching daily drops:', err);
      setError(err.message);
      // Return empty on error
      setDailyDrops([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get a random daily drop
  const getRandomDrop = useCallback(() => {
    if (dailyDrops.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * dailyDrops.length);
    return dailyDrops[randomIndex];
  }, [dailyDrops]);

  // Check if there are active daily drops
  const hasActiveDrop = useCallback(() => {
    return dailyDrops.length > 0;
  }, [dailyDrops]);

  // Initial fetch
  useEffect(() => {
    fetchDailyDrops();
  }, [fetchDailyDrops]);

  return {
    dailyDrops,
    isLoading,
    error,
    refetch: fetchDailyDrops,
    getRandomDrop,
    hasActiveDrop,
  };
}
