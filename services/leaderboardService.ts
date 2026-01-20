import { supabase } from './supabaseClient';
import { LeaderboardEntry } from '../types';

// Cache for leaderboard data
let cachedLeaderboard: LeaderboardEntry[] = [];
let lastFetchTime: number | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get when leaderboard was last fetched
 */
export const getLastFetchTime = (): number | null => lastFetchTime;

/**
 * Check if leaderboard cache is stale
 */
export const shouldRefreshLeaderboard = (): boolean => {
  if (!lastFetchTime) return true;
  return Date.now() - lastFetchTime > CACHE_DURATION;
};

export const getGlobalLeaderboard = async (limit = 50, force = false): Promise<LeaderboardEntry[]> => {
  // Return cached data if fresh and not forced
  if (!force && !shouldRefreshLeaderboard() && cachedLeaderboard.length > 0) {
    return cachedLeaderboard;
  }

  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching leaderboard:', error);
      // Return cached data if fetch fails
      return cachedLeaderboard;
    }

    const entries = data.map((row: any) => ({
      name: row.name,
      score: row.score,
      timePlayed: row.time_played,
      maxTier: row.max_tier,
      date: row.created_at,
    }));

    // Update cache
    cachedLeaderboard = entries;
    lastFetchTime = Date.now();

    return entries;
  } catch (e) {
    console.error('Unexpected error fetching leaderboard:', e);
    // Return cached data on error
    return cachedLeaderboard;
  }
};

export const submitScore = async (entry: LeaderboardEntry): Promise<boolean> => {
  try {
    const { error } = await supabase.from('leaderboard').insert([
      {
        name: entry.name,
        score: Math.floor(entry.score), // Ensure integer
        time_played: Math.floor(entry.timePlayed), // Ensure integer (it's often a float from dt)
        max_tier: entry.maxTier,
        created_at: entry.date, // Use the original creation date
      },
    ]);

    if (error) {
      console.warn('Error submitting score to Supabase:', error.message);
      return false;
    }

    return true;
  } catch (e) {
    console.warn('Network error or Supabase not configured:', e);
    return false;
  }
};

/**
 * Tries to upload pending scores.
 * Returns the list of scores that STILL failed to upload (or all of them if offline).
 */
export const uploadPendingScores = async (pending: LeaderboardEntry[]): Promise<LeaderboardEntry[]> => {
  if (pending.length === 0) return [];

  const remaining: LeaderboardEntry[] = [];

  // Try to process them one by one (or Promise.all, but one by one is safer for rate limits/errors)
  for (const entry of pending) {
    const success = await submitScore(entry);
    if (!success) {
      remaining.push(entry);
    }
  }

  return remaining;
};
