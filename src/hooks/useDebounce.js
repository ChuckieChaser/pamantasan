// --- IMPORTS ---
import { useState, useEffect } from 'react';


// --- CONFIGURATIONS ---
const DEFAULT_DELAY_MS = 300;


// --- HOOK ---
const useDebounce = (value, delay = DEFAULT_DELAY_MS) => {
    // STATES
    const [debouncedValue, setDebouncedValue] = useState(value);

    // LISTENERS
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


// --- EXPORTS ---
export { useDebounce };
