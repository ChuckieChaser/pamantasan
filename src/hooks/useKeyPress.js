// --- IMPORTS ---
import { useEffect, useRef } from 'react';


// --- HOOK ---
export const useKeyPress = (targetKey, callback) => {
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            const isMatch = Array.isArray(targetKey)
                ? targetKey.includes(event.key)
                : event.key === targetKey;

            if (isMatch) {
                callbackRef.current?.(event);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [targetKey]);
};
