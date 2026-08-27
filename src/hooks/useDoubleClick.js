// --- IMPORTS ---
import { useRef, useEffect, useCallback } from 'react';

// --- CONFIGURATIONS ---
const DEFAULT_LATENCY_MILLISECONDS = 250;

// --- HOOKS ---
const useDoubleClick = ({
    onClick,
    onDoubleClick,
    latency = DEFAULT_LATENCY_MILLISECONDS,
} = {}) => {
    // REFS
    const clickTimeoutReference = useRef(null);

    // CLEANUP TIMER ON COMPONENT UNMOUNT
    useEffect(() => {
        return () => {
            if (clickTimeoutReference.current !== null) {
                clearTimeout(clickTimeoutReference.current);
            }
        };
    }, []);

    // HANDLER
    const handleClick = useCallback(
        (item, clickEvent) => {
            if (clickTimeoutReference.current !== null) {
                clearTimeout(clickTimeoutReference.current);
                clickTimeoutReference.current = null;
                onDoubleClick?.(item, clickEvent);
                return;
            }

            clickTimeoutReference.current = setTimeout(() => {
                clickTimeoutReference.current = null;
                onClick?.(item, clickEvent);
            }, latency);
        },
        [onClick, onDoubleClick, latency],
    );

    return handleClick;
};

export default useDoubleClick;
