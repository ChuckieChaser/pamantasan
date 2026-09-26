// --- IMPORTS ---
import { useEffect, useRef } from 'react';


// --- HOOK ---
/**
 * Triggers a callback when clicking or touching outside the referenced DOM element.
 */
export const useOnClickOutside = (ref, callback) => {
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        const handleClick = (event) => {
            if (!ref?.current || ref.current.contains(event.target)) {
                return;
            }
            callbackRef.current?.(event);
        };

        document.addEventListener('mousedown', handleClick, { passive: true });
        document.addEventListener('touchstart', handleClick, { passive: true });

        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('touchstart', handleClick);
        };
    }, [ref]);
};
