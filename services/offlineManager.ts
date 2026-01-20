import { SavedData, LeaderboardEntry } from '../types';
import { STORAGE_KEY } from '../constants';

/**
 * Offline Manager - Handles local storage with sync state tracking
 * Provides connection monitoring and sync coordination
 */

export interface SyncStatus {
    lastSyncTime: number | null;
    pendingCount: number;
    isOnline: boolean;
    isSyncing: boolean;
}

type ConnectionListener = (isOnline: boolean) => void;

class OfflineManager {
    private connectionListeners: Set<ConnectionListener> = new Set();
    private syncInProgress = false;
    private lastSyncTime: number | null = null;

    constructor() {
        // Monitor online/offline events
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => this.notifyConnectionChange(true));
            window.addEventListener('offline', () => this.notifyConnectionChange(false));
        }
    }

    /**
     * Get current connection status
     */
    isOnline(): boolean {
        return typeof navigator !== 'undefined' ? navigator.onLine : true;
    }

    /**
     * Subscribe to connection changes
     */
    onConnectionChange(listener: ConnectionListener): () => void {
        this.connectionListeners.add(listener);
        return () => this.connectionListeners.delete(listener);
    }

    private notifyConnectionChange(isOnline: boolean) {
        this.connectionListeners.forEach(listener => {
            try {
                listener(isOnline);
            } catch (e) {
                console.error('Error in connection listener:', e);
            }
        });
    }

    /**
     * Get sync status
     */
    getSyncStatus(data: SavedData): SyncStatus {
        return {
            lastSyncTime: this.lastSyncTime,
            pendingCount: data.pendingScores?.length || 0,
            isOnline: this.isOnline(),
            isSyncing: this.syncInProgress,
        };
    }

    /**
     * Mark sync as started/completed
     */
    setSyncInProgress(inProgress: boolean) {
        this.syncInProgress = inProgress;
        if (!inProgress) {
            this.lastSyncTime = Date.now();
        }
    }

    /**
     * Safe localStorage get with error handling
     */
    getItem(key: string): string | null {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.error('Failed to read from localStorage:', e);
            return null;
        }
    }

    /**
     * Safe localStorage set with error handling
     */
    setItem(key: string, value: string): boolean {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            console.error('Failed to write to localStorage:', e);
            // Handle quota exceeded
            if (e instanceof DOMException && e.name === 'QuotaExceededError') {
                console.warn('localStorage quota exceeded. Attempting cleanup...');
                // Could implement cleanup logic here
            }
            return false;
        }
    }

    /**
     * Safe localStorage remove
     */
    removeItem(key: string): boolean {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Failed to remove from localStorage:', e);
            return false;
        }
    }

    /**
     * Get the last sync timestamp
     */
    getLastSyncTime(): number | null {
        return this.lastSyncTime;
    }
}

// Singleton instance
export const offlineManager = new OfflineManager();
