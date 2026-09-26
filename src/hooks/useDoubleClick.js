// --- IMPORTS ---
import { useCallback, useEffect, useRef } from 'react';


// --- CONFIGURATIONS ---
const DEFAULT_DELAY_MS = 250;


// --- HOOK ---
export const useDoubleClick = ({ onClick, onDoubleClick, delay = DEFAULT_DELAY_MS } = {}) => {
    const timerRef = useRef(null);
    const onClickRef = useRef(onClick);
    const onDoubleClickRef = useRef(onDoubleClick);

    useEffect(() => {
        onClickRef.current = onClick;
        onDoubleClickRef.current = onDoubleClick;
    }, [onClick, onDoubleClick]);

    useEffect(() => {
        return () => {
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current);
            }
        };
    }, []);

    const handleClick = useCallback(
        (item, event) => {
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
                onDoubleClickRef.current?.(item, event);
                return;
            }

            timerRef.current = setTimeout(() => {
                timerRef.current = null;
                onClickRef.current?.(item, event);
            }, delay);
        },
        [delay],
    );

    return handleClick;
};
