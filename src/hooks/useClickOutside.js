// --- IMPORTS ---
import { useEffect, useRef } from 'react';


// --- HOOK ---
const useClickOutside = (ref, callback) => {
    // REFS
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    // LISTENERS
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


// --- EXPORTS ---
export { useClickOutside };