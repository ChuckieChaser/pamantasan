// --- IMPORTS ---
import { useEffect, useRef } from 'react';


// --- HOOK ---
const useKeyPress = (targetKey, callback) => {
    // REFS
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    // LISTENERS
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


// --- EXPORTS ---
export { useKeyPress };
