/**
 * IndexedDB Wrapper for future scalability
 * 
 * This module provides a future-proof storage solution using IndexedDB.
 * Currently, the app uses localStorage which is sufficient for current data volume.
 * As the app grows, this wrapper can replace localStorage without breaking changes.
 * 
 * Features:
 * - Automatic fallback to localStorage if IndexedDB is unavailable
 * - Promise-based API for consistency with modern async code
 * - Migration helper from localStorage to IndexedDB
 */

const DB_NAME = 'FruitBounceDB';
const DB_VERSION = 1;
const STORE_NAME = 'gameData';

/**
 * Initialize IndexedDB
 */
const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !window.indexedDB) {
            reject(new Error('IndexedDB not supported'));
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            reject(new Error('Failed to open IndexedDB'));
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Create object store if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
};

/**
 * Get data from IndexedDB
 */
export const getFromIndexedDB = async <T>(key: string): Promise<T | null> => {
    try {
        const db = await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                reject(new Error('Failed to get data from IndexedDB'));
            };
        });
    } catch (error) {
        console.warn('IndexedDB get failed, falling back to localStorage:', error);
        // Fallback to localStorage
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    }
};

/**
 * Set data in IndexedDB
 */
export const setToIndexedDB = async <T>(key: string, value: T): Promise<void> => {
    try {
        const db = await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(value, key);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(new Error('Failed to set data in IndexedDB'));
            };
        });
    } catch (error) {
        console.warn('IndexedDB set failed, falling back to localStorage:', error);
        // Fallback to localStorage
        localStorage.setItem(key, JSON.stringify(value));
    }
};

/**
 * Remove data from IndexedDB
 */
export const removeFromIndexedDB = async (key: string): Promise<void> => {
    try {
        const db = await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(key);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(new Error('Failed to remove data from IndexedDB'));
            };
        });
    } catch (error) {
        console.warn('IndexedDB remove failed, falling back to localStorage:', error);
        // Fallback to localStorage
        localStorage.removeItem(key);
    }
};

/**
 * Migrate data from localStorage to IndexedDB
 * Call this during app initialization to migrate existing users
 */
export const migrateFromLocalStorage = async (key: string): Promise<void> => {
    try {
        const localData = localStorage.getItem(key);
        if (localData) {
            const parsedData = JSON.parse(localData);
            await setToIndexedDB(key, parsedData);
            console.log(`Migrated ${key} from localStorage to IndexedDB`);
        }
    } catch (error) {
        console.error('Failed to migrate data from localStorage:', error);
    }
};

/**
 * Check if IndexedDB is available
 */
export const isIndexedDBAvailable = (): boolean => {
    try {
        return typeof window !== 'undefined' && !!window.indexedDB;
    } catch {
        return false;
    }
};
