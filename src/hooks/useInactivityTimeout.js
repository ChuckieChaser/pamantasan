// --- IMPORTS ---
import { useEffect, useRef } from 'react';

// --- CONSTANTS ---
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes of inactivity
const STORAGE_KEY = 'pamantasan_last_active_time';

// --- HOOK ---
/**
 * Monitors user activity (mouse, keyboard, touches, scrolling) and triggers an auto-logout callback
 * when the user has been inactive for the specified timeout duration (10 minutes default).
 * Synchronized across open browser tabs using localStorage.
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
                // Ignore localStorage errors
            }
        };

        // Reset or refresh timestamp when hook activates
        updateActivity();

        // Throttle updates to avoid excessive storage writes
        let lastThrottle = Date.now();
        const handleUserActivity = () => {
            const now = Date.now();
            if (now - lastThrottle > 2000) {
                lastThrottle = now;
                updateActivity();
            }
        };

        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
        events.forEach((eventName) => {
            window.addEventListener(eventName, handleUserActivity, { passive: true });
        });

        // Periodic checker
        const intervalId = setInterval(() => {
            let lastActive = Date.now();
            try {
                const stored = localStorage.getItem(STORAGE_KEY);
                if (stored) {
                    lastActive = parseInt(stored, 10);
                }
            } catch {
                // Fallback to in-memory check
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
        }, 5000);

        return () => {
            events.forEach((eventName) => {
                window.removeEventListener(eventName, handleUserActivity);
            });
            clearInterval(intervalId);
        };
    }, [enabled, timeoutMs]);
};
