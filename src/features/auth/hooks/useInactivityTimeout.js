// --- IMPORTS ---
import { useEffect, useRef } from 'react';


// --- CONFIGURATIONS ---
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes of inactivity
const STORAGE_KEY = 'pamantasan_last_active_time';
const THROTTLE_INTERVAL_MS = 2000;
const CHECK_INTERVAL_MS = 5000;
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];


// --- HOOK ---
/**
 * Monitors user activity and triggers a session timeout callback
 * when the user has been idle for the configured duration.
 * Synchronized across active browser tabs via localStorage.
 */
export const useInactivityTimeout = ({
    timeoutMs = DEFAULT_TIMEOUT_MS,
    onTimeout,
    enabled = true,
} = {}) => {
    const onTimeoutReference = useRef(onTimeout);

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
                localStorage.setItem(STORAGE_KEY, now.toString());
            } catch {
                // Ignore storage write errors (e.g. private browsing quota)
            }
        };

        // Reset or refresh timestamp when hook activates
        updateActivity();

        // Throttle updates to avoid high-frequency storage writes
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

        // Periodic idle interval check
        const intervalId = setInterval(() => {
            let lastActive = Date.now();
            try {
                const stored = localStorage.getItem(STORAGE_KEY);
                if (stored) {
                    lastActive = parseInt(stored, 10);
                }
            } catch {
                lastActive = lastThrottle;
            }

            const elapsed = Date.now() - lastActive;
            if (elapsed >= timeoutMs) {
                try {
                    localStorage.removeItem(STORAGE_KEY);
                } catch {
                    // Ignore
                }
                onTimeoutReference.current?.();
            }
        }, CHECK_INTERVAL_MS);

        return () => {
            ACTIVITY_EVENTS.forEach((eventName) => {
                window.removeEventListener(eventName, handleUserActivity);
            });
            clearInterval(intervalId);
        };
    }, [enabled, timeoutMs]);
};
