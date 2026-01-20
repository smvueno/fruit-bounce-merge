import { supabase } from './supabaseClient';
import { LeaderboardEntry } from '../types';

export const getGlobalLeaderboard = async (limit = 50): Promise<LeaderboardEntry[]> => {
  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }

    return data.map((row: any) => ({
      name: row.name,
      score: row.score,
      timePlayed: row.time_played,
      maxTier: row.max_tier,
      date: row.created_at,
    }));
  } catch (e) {
    console.error('Unexpected error fetching leaderboard:', e);
    return [];
  }
};

export const submitScore = async (entry: LeaderboardEntry): Promise<boolean> => {
  try {
    const { error } = await supabase.from('leaderboard').insert([
      {
        name: entry.name,
        score: entry.score,
        time_played: entry.timePlayed,
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
