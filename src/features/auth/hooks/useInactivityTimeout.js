// --- IMPORTS ---
import { useEffect, useRef } from 'react';
import { verifySessionHeartbeat, terminateSession } from '../authService';
import { useAuthStore } from '../authStore';
import { SESSION_CONFIG, SESSION_STORAGE_KEY, ACTIVITY_EVENTS } from '../authConstants';


// --- CONFIGURATIONS ---
const DEFAULT_TIMEOUT_MS = SESSION_CONFIG.TIMEOUT_MS;
const HEARTBEAT_INTERVAL_MS = SESSION_CONFIG.HEARTBEAT_INTERVAL_MS;
const THROTTLE_INTERVAL_MS = SESSION_CONFIG.THROTTLE_INTERVAL_MS;
const CHECK_INTERVAL_MS = SESSION_CONFIG.CHECK_INTERVAL_MS;
const STORAGE_LAST_ACTIVE_KEY = SESSION_STORAGE_KEY.LAST_ACTIVE;
const STORAGE_SESSION_ID_KEY = SESSION_STORAGE_KEY.SESSION_ID;


// --- HOOK ---
/**
 * Monitors user activity, dispatches a 30s session heartbeat to keep expiredAt fresh,
 * enforces a strict 5-minute inactivity watchdog (auto-logout on laptop lid close / idle),
 * and creates a binding that terminates the local user session if the session record was deleted.
 */
export const useInactivityTimeout = ({
    timeoutMs = DEFAULT_TIMEOUT_MS,
    onTimeout,
    enabled = true,
} = {}) => {
    const onTimeoutReference = useRef(onTimeout);
    const currentUser = useAuthStore((s) => s.currentUser);

    useEffect(() => {
        onTimeoutReference.current = onTimeout;
    }, [onTimeout]);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const updateActivity = () => {
            const now = Date.now();
            try {
                localStorage.setItem(STORAGE_LAST_ACTIVE_KEY, now.toString());
            } catch {
                // Ignore storage quota errors
            }
        };

        // Reset or refresh timestamp when hook activates
        updateActivity();

        // Throttle activity event handlers
        let lastThrottle = Date.now();
        const handleUserActivity = () => {
            const now = Date.now();
            if (now - lastThrottle > THROTTLE_INTERVAL_MS) {
                lastThrottle = now;
                updateActivity();
            }
        };

        ACTIVITY_EVENTS.forEach((eventName) => {
            window.addEventListener(eventName, handleUserActivity, { passive: true });
        });

        // --- 30s HEARTBEAT DISPATCHER ---
        const heartbeatIntervalId = setInterval(async () => {
            let lastActive = Date.now();
            try {
                const stored = localStorage.getItem(STORAGE_LAST_ACTIVE_KEY);
                if (stored) lastActive = parseInt(stored, 10);
            } catch {
                lastActive = lastThrottle;
            }

            const elapsed = Date.now() - lastActive;
            const sessionId = localStorage.getItem(STORAGE_SESSION_ID_KEY);
            const userId = currentUser?.id || currentUser?.uid;

            // Binding: If session ID was removed/deleted while user is logged in, immediately terminate
            if (userId && !sessionId) {
                await terminateSession();
                onTimeoutReference.current?.('SESSION_REVOKED');
                return;
            }

            // Only send beat if user was active recently (under the 5-minute timeout)
            if (elapsed < timeoutMs) {
                if (sessionId && userId) {
                    const result = await verifySessionHeartbeat({ sessionId, userId });
                    // Binding: If session record was deleted in DB (e.g. concurrent takeover), immediately log out!
                    if (result && result.valid === false) {
                        await terminateSession();
                        onTimeoutReference.current?.('SESSION_REVOKED');
                    }
                }
            }
        }, HEARTBEAT_INTERVAL_MS);

        // --- 5-MINUTE INACTIVITY WATCHDOG ---
        const checkWatchdog = async () => {
            let lastActive = Date.now();
            try {
                const stored = localStorage.getItem(STORAGE_LAST_ACTIVE_KEY);
                if (stored) lastActive = parseInt(stored, 10);
            } catch {
                lastActive = lastThrottle;
            }

            const elapsed = Date.now() - lastActive;
            if (elapsed >= timeoutMs) {
                await terminateSession();
                onTimeoutReference.current?.('INACTIVITY_TIMEOUT');
            }
        };

        // Periodic watchdog interval
        const watchdogIntervalId = setInterval(checkWatchdog, CHECK_INTERVAL_MS);

        // Instant check when waking from sleep (lid opened / tab refocused)
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible') {
                await checkWatchdog();

                // Also immediately verify session state if not timed out
                const sessionId = localStorage.getItem(STORAGE_SESSION_ID_KEY);
                const userId = currentUser?.id || currentUser?.uid;
                if (userId && !sessionId) {
                    await terminateSession();
                    onTimeoutReference.current?.('SESSION_REVOKED');
                    return;
                }
                if (sessionId && userId) {
                    const result = await verifySessionHeartbeat({ sessionId, userId });
                    if (result && result.valid === false) {
                        await terminateSession();
                        onTimeoutReference.current?.('SESSION_REVOKED');
                    }
                }
            }
        };

        const handleFocus = async () => {
            await checkWatchdog();
        };

        // Multi-tab Session Binding: If another tab terminates or clears the session
        const handleStorage = (event) => {
            if (event.key === STORAGE_SESSION_ID_KEY && !event.newValue) {
                terminateSession();
                onTimeoutReference.current?.('SESSION_REVOKED');
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);
        window.addEventListener('storage', handleStorage);

        return () => {
            ACTIVITY_EVENTS.forEach((eventName) => {
                window.removeEventListener(eventName, handleUserActivity);
            });
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('storage', handleStorage);
            clearInterval(heartbeatIntervalId);
            clearInterval(watchdogIntervalId);
        };
    }, [enabled, timeoutMs, currentUser?.id, currentUser?.uid]);
};
