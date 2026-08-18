// --- IMPORTS ---
import { useState, useEffect } from 'react';

// --- HOOKS ---
function useDarkMode() {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window === 'undefined') {
            return false;
        }

        const storedPreference = localStorage.getItem('theme');
        if (storedPreference) {
            return storedPreference === 'dark';
        }

        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        const rootElement = document.documentElement;

        if (isDarkMode) {
            rootElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            rootElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    const toggleDarkMode = () => {
        setIsDarkMode((previousState) => !previousState);
    };

    return [isDarkMode, toggleDarkMode];
}

export default useDarkMode;
