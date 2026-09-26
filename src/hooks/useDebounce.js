// --- IMPORTS ---
import { useEffect, useState } from 'react';


// --- CONFIGURATIONS ---
const DEFAULT_DELAY_MS = 300;


// --- HOOK ---
export const useDebounce = (value, delay = DEFAULT_DELAY_MS) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timerId = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(timerId);
        };
    }, [value, delay]);

    return debouncedValue;
};
