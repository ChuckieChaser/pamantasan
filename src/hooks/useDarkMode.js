// --- IMPORTS ---
import { useState, useEffect, useCallback, useMemo } from 'react';

import { constants } from '../constants';
import { useAuthStore, useUserStore } from '../stores';


// --- HOOK ---
const useDarkMode = () => {
    // STORES
    const currentUser = useAuthStore((state) => state.currentUser);
    const userSettings = useUserStore((state) => state.userSettings);
    const updateUserSetting = useUserStore((state) => state.updateUserSetting);

    // STATES
    const [guestTheme, setGuestTheme] = useState(constants.USER_SETTINGS_THEME.SYSTEM);

    const [isSystemDark, setIsSystemDark] = useState(() => {
        if (typeof window === 'undefined') {
            return false;
        }

        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    const activeTheme = useMemo(() => {
        if (currentUser && userSettings?.theme) {
            return userSettings.theme;
        }

        return guestTheme;
    }, [currentUser, userSettings?.theme, guestTheme]);

    const isDark = useMemo(() => {
        if (activeTheme === constants.USER_SETTINGS_THEME.DARK) {
            return true;
        }

        if (activeTheme === constants.USER_SETTINGS_THEME.LIGHT) {
            return false;
        }

        return isSystemDark;
    }, [activeTheme, isSystemDark]);

    // LISTENERS
    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleChange = (event) => {
            setIsSystemDark(event.matches);
        };

        mediaQuery.addEventListener('change', handleChange);

        return () => {
            mediaQuery.removeEventListener('change', handleChange);
        };
    }, []);

    useEffect(() => {
        const root = document.documentElement;

        if (isDark) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    }, [isDark]);

    // CONTROLS
    const setTheme = useCallback(
        async (newTheme) => {
            setGuestTheme(newTheme);

            if (currentUser?.id) {
                try {
                    await updateUserSetting(currentUser.id, { theme: newTheme });
                } catch (error) {
                    console.error('Failed to persist theme setting:', error);
                }
            }
        },
        [currentUser?.id, updateUserSetting],
    );

    const toggleTheme = useCallback(() => {
        const nextTheme = isDark
            ? constants.USER_SETTINGS_THEME.LIGHT
            : constants.USER_SETTINGS_THEME.DARK;

        return setTheme(nextTheme);
    }, [isDark, setTheme]);

    return {
        theme: activeTheme,
        isDark,
        setTheme,
        toggleTheme,
    };
};


// --- EXPORTS ---
export { useDarkMode };
