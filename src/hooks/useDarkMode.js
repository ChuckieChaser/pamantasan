// --- IMPORTS ---
import { useState, useEffect } from 'react';
import { THEME_MODES } from '../constants';

// --- CONFIGURATIONS ---
const STORAGE_KEY = 'theme';

// --- HOOKS ---
function useDarkMode() {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window === 'undefined') {
            return true;
        }

        const storedPreference = localStorage.getItem(STORAGE_KEY);

        if (storedPreference !== null) {
            return storedPreference === THEME_MODES.DARK.toLowerCase();
        }

        return true;
    });

    useEffect(() => {
        const rootElement = document.documentElement;

        if (isDarkMode) {
            rootElement.classList.add(THEME_MODES.DARK.toLowerCase());
            localStorage.setItem(STORAGE_KEY, THEME_MODES.DARK.toLowerCase());
        } else {
            rootElement.classList.remove(THEME_MODES.DARK.toLowerCase());
            localStorage.setItem(STORAGE_KEY, THEME_MODES.LIGHT.toLowerCase());
        }
    }, [isDarkMode]);

    const toggleDarkMode = () => {
        setIsDarkMode((previousState) => !previousState);
    };

    return [isDarkMode, toggleDarkMode];
}

export default useDarkMode;
