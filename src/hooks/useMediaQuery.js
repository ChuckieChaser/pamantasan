// --- IMPORTS ---
import { useEffect, useState } from 'react';


// --- HOOK ---
/**
 * Subscribes to a CSS media query and reactively returns a boolean match state.
 * Useful for responsive breakpoints, orientation, and color-scheme detection.
 */
export const useMediaQuery = (query) => {
    const getMatches = (mediaQuery) => {
        if (typeof window === 'undefined') {
            return false;
        }
        return window.matchMedia(mediaQuery).matches;
    };

    const [matches, setMatches] = useState(() => getMatches(query));

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const matchMediaList = window.matchMedia(query);
        const handleChange = () => {
            setMatches(matchMediaList.matches);
        };

        // Trigger on mount in case query changed
        handleChange();

        matchMediaList.addEventListener('change', handleChange);

        return () => {
            matchMediaList.removeEventListener('change', handleChange);
        };
    }, [query]);

    return matches;
};
