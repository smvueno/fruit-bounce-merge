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

const checkIfScoreExists = async (entry: LeaderboardEntry): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('id')
      .eq('name', entry.name)
      .eq('score', Math.floor(entry.score))
      .eq('created_at', entry.date)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found"
      console.warn('Error checking for duplicate score:', error);
      return false;
    }

    return !!data;
  } catch (e) {
    console.warn('Error checking duplicate:', e);
    return false;
  }
};

export const submitScore = async (entry: LeaderboardEntry): Promise<boolean> => {
  try {
    // Check for duplicates first to avoid double submission on sync race conditions
    const exists = await checkIfScoreExists(entry);
    if (exists) {
      console.log('Score already exists in DB, skipping upload but marking as success.');
      return true;
    }

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

import { loadData, saveData } from '../utils/storage';
import { offlineManager } from './offlineManager';

/**
 * Sync scores helper - uploads pending and fetches latest global
 * Returns the latest global leaderboard if successful
 */
export const performFullSync = async (): Promise<LeaderboardEntry[] | null> => {
  // 1. Check connectivity
  if (!offlineManager.isOnline()) {
    console.log('Offline - skipping sync');
    return null;
  }

  // 2. Prevent overlapping syncs
  if (offlineManager.isSyncing()) {
    console.log('Sync already in progress - skipping');
    return null;
  }

  offlineManager.setSyncInProgress(true);

  try {
    // 3. Load FRESH data from storage
    // We grab the snapshot of pending scores to attempt uploading
    const initialLoad = loadData();
    const pendingToUpload = initialLoad.pendingScores || [];

    if (pendingToUpload.length > 0) {
      console.log(`Syncing ${pendingToUpload.length} pending scores...`);

      // Keep track of which specific entries (by unique props) succeeded
      const successIndices: number[] = [];

      for (let i = 0; i < pendingToUpload.length; i++) {
        const entry = pendingToUpload[i];
        const success = await submitScore(entry);
        if (success) {
          successIndices.push(i);
        }
      }

      if (successIndices.length > 0) {
        // Critical: Re-load data to ensure we don't overwrite any NEW pending scores 
        // that were added while we were awaiting the uploads above.
        const currentData = loadData();
        const currentPending = currentData.pendingScores || [];

        // We identify items to remove based on the objects we tried to upload.
        // Since objects are by reference in memory but by value in storage, 
        // we filtered based on content matching or we assumes FIFO?
        // Safest is to filter out the exact entries we succeeded with.
        // We use date+score+name as a unique-ish signature or strict object equality if not reloaded?
        // Strict equality won't work because we re-loaded.
        // Let's filter by matching properties.

        const successfullyUploaded = pendingToUpload.filter((_, index) => successIndices.includes(index));

        const newPending = currentPending.filter(currentEntry => {
          // Keep this entry IF it was NOT one of the successfully uploaded ones
          const isUploaded = successfullyUploaded.some(uploaded =>
            uploaded.date === currentEntry.date &&
            uploaded.name === currentEntry.name &&
            uploaded.score === currentEntry.score
          );
          return !isUploaded;
        });

        console.log(`Successfully synced ${successIndices.length} scores. Remaining pending: ${newPending.length}`);
        saveData({ pendingScores: newPending });
      }
    }

    // 4. Fetch Global (force refresh)
    const global = await getGlobalLeaderboard(50, true);
    return global;
  } catch (e) {
    console.error('Error during sync:', e);
    return null;
  } finally {
    offlineManager.setSyncInProgress(false);
  }

};

/**
 * Supabase Realtime subscription for live leaderboard updates
 */
let realtimeChannel: any = null;
let lastRealtimeFetch = 0; // Timestamp of last fetch triggered by Realtime

/**
 * Subscribe to live leaderboard updates via Supabase Realtime
 * This reduces the need for polling and provides instant updates
 * @param callback Function to call when leaderboard updates
 */
export const subscribeToLeaderboard = (callback: (newScores: LeaderboardEntry[]) => void): void => {
  if (realtimeChannel) {
    console.log('Already subscribed to leaderboard updates');
    return;
  }

  console.log('Subscribing to leaderboard Realtime updates...');

  realtimeChannel = supabase
    .channel('leaderboard-changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'leaderboard'
      },
      (payload) => {
        console.log('New score detected via Realtime:', payload);

        // Throttle fetches to once every 10 seconds max, even if multiple INSERTs occur
        const now = Date.now();
        if (now - lastRealtimeFetch > 10000) { // 10 second throttle
          lastRealtimeFetch = now;
          // Fetch updated leaderboard and call callback
          getGlobalLeaderboard(50, true).then(scores => {
            callback(scores);
          }).catch(err => {
            console.error('Failed to fetch leaderboard after Realtime event:', err);
          });
        } else {
          console.log('Throttling Realtime fetch - too soon since last fetch');
        }
      }
    )
    .subscribe((status) => {
      console.log('Realtime subscription status:', status);
    });
};

/**
 * Unsubscribe from leaderboard Realtime updates
 */
export const unsubscribeFromLeaderboard = (): void => {
  if (realtimeChannel) {
    console.log('Unsubscribing from leaderboard Realtime updates...');
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
};

