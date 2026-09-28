// --- IMPORTS ---
import { constants } from '../constants';

const CHANNEL_NAME = 'pamantasan_realtime_sync';
const STORAGE_KEY = 'pamantasan_sync_event';
const POLLING_INTERVAL_MS = 45000;
const MIN_REFETCH_INTERVAL_MS = 10000;

let broadcastChannel = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
        broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    } catch (e) {
        console.warn('[realtimeSync] BroadcastChannel init error:', e);
    }
}

let lastSyncTimestamp = 0;

export const realtimeSyncService = {
    /**
     * Broadcasts a data change event across all tabs/windows.
     */
    broadcast: (entityType, action = 'MUTATED', payload = {}) => {
        if (typeof window === 'undefined') return;

        const eventData = {
            entityType: String(entityType || 'GLOBAL').toUpperCase(),
            action: String(action || 'MUTATED').toUpperCase(),
            timestamp: Date.now(),
            payload,
        };

        // 1. BroadcastChannel (modern browsers)
        if (broadcastChannel) {
            try {
                broadcastChannel.postMessage(eventData);
            } catch (err) {
                console.warn('[realtimeSync] PostMessage error:', err);
            }
        }

        // 2. LocalStorage Event (cross-tab fallback for older browsers / isolated contexts)
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(eventData));
        } catch {
            /* ignore */
        }

        // 3. Same-tab Custom Event
        try {
            window.dispatchEvent(new CustomEvent('pamantasan:realtime-sync', { detail: eventData }));
        } catch {
            /* ignore */
        }
    },

    /**
     * Subscribes to realtime sync messages from other tabs and window events.
     */
    subscribe: (callback) => {
        if (typeof window === 'undefined') return () => {};

        const handleMessage = (data) => {
            if (!data) return;
            callback(data);
        };

        // Channel listener
        const channelListener = (event) => {
            handleMessage(event.data);
        };
        if (broadcastChannel) {
            broadcastChannel.addEventListener('message', channelListener);
        }

        // Storage listener
        const storageListener = (event) => {
            if (event.key === STORAGE_KEY && event.newValue) {
                try {
                    const parsed = JSON.parse(event.newValue);
                    handleMessage(parsed);
                } catch {
                    /* ignore */
                }
            }
        };
        window.addEventListener('storage', storageListener);

        // Same-window custom event listener
        const localListener = (event) => {
            handleMessage(event.detail);
        };
        window.addEventListener('pamantasan:realtime-sync', localListener);

        return () => {
            if (broadcastChannel) {
                broadcastChannel.removeEventListener('message', channelListener);
            }
            window.removeEventListener('storage', storageListener);
            window.removeEventListener('pamantasan:realtime-sync', localListener);
        };
    },

    /**
     * Initializes automatic refresh on window focus, tab visibility, and periodic sync.
     */
    initAutoSync: (syncCallback) => {
        if (typeof window === 'undefined') return () => {};

        const executeSync = (reason) => {
            const now = Date.now();
            if (now - lastSyncTimestamp < MIN_REFETCH_INTERVAL_MS) {
                return;
            }
            lastSyncTimestamp = now;
            syncCallback?.(reason);
        };

        // Window focus
        const handleFocus = () => {
            executeSync('FOCUS');
        };
        window.addEventListener('focus', handleFocus);

        // Tab visibility change
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                executeSync('VISIBLE');
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Periodic background poll while tab is active
        const intervalId = setInterval(() => {
            if (document.visibilityState === 'visible') {
                executeSync('POLL');
            }
        }, POLLING_INTERVAL_MS);

        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(intervalId);
        };
    },
};

export default realtimeSyncService;
