// --- IMPORTS ---
import { useCallback, useEffect, useState } from 'react';


// --- HOOK ---
/**
 * Synchronizes a state value with window.localStorage.
 * Updates reactively across browser tabs and frames.
 */
export const useLocalStorage = (key, initialValue) => {
    // Read stored value or fallback
    const readValue = useCallback(() => {
        if (typeof window === 'undefined') {
            return initialValue;
        }

        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch {
            return initialValue;
        }
    }, [key, initialValue]);

    const [storedValue, setStoredValue] = useState(readValue);

    // Setter that updates localStorage and state
    const setValue = useCallback(
        (value) => {
            if (typeof window === 'undefined') {
                return;
            }

            try {
                const newValue = value instanceof Function ? value(storedValue) : value;
                window.localStorage.setItem(key, JSON.stringify(newValue));
                setStoredValue(newValue);
                window.dispatchEvent(new Event('local-storage'));
            } catch {
                // Ignore write failures (quota exceeded, private mode)
            }
        },
        [key, storedValue],
    );

    // Cross-tab and window event synchronization
    useEffect(() => {
        setStoredValue(readValue());

        const handleStorageChange = (event) => {
            if (event?.key && event.key !== key) {
                return;
            }
            setStoredValue(readValue());
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('local-storage', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('local-storage', handleStorageChange);
        };
    }, [key, readValue]);

    return [storedValue, setValue];
};
