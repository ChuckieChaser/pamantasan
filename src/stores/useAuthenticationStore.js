// --- IMPORTS ---
import { create } from 'zustand';
import { authService } from '../services';
import {
    UserSchema,
    UserSettingSchema,
} from '../schemas';

// --- STORE DEFINITION ---
const useAuthenticationStore = create((set, get) => ({
    // STATE
    currentUser: null,
    userSettings: null,
    isLoading: false,
    error: null,

    // ACTIONS
    initializeAuthListener: () => {
        set({ isLoading: true });

        const unsubscribe = authService.onAuthStateChanged((user) => {
            set({
                currentUser: user,
                isLoading: false,
                error: null,
            });
        });

        return unsubscribe;
    },

    loginWithUniversityId: async (universityId, password) => {
        set({ isLoading: true, error: null });

        try {
            const authenticatedUser = await authService.loginWithUniversityId(universityId, password);
            set({
                currentUser: authenticatedUser,
                isLoading: false,
                error: null,
            });
            return authenticatedUser;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to authenticate with University ID.';
            set({
                isLoading: false,
                error: errorMessage,
            });
            throw error;
        }
    },

    loginWithEmail: async (email, password) => {
        return get().loginWithUniversityId(email, password);
    },

    loginWithGoogle: async () => {
        set({ isLoading: true, error: null });

        try {
            const authenticatedUser = await authService.loginWithGoogle();
            set({
                currentUser: authenticatedUser,
                isLoading: false,
                error: null,
            });
            return authenticatedUser;
        } catch (error) {
            const errorMessage = error?.message ?? 'Google authentication failed.';
            set({
                isLoading: false,
                error: errorMessage,
            });
            throw error;
        }
    },

    logout: async () => {
        set({ isLoading: true, error: null });

        try {
            await authService.logout();
            set({
                currentUser: null,
                userSettings: null,
                isLoading: false,
                error: null,
            });
        } catch (error) {
            const errorMessage = error?.message ?? 'Sign out failed.';
            set({
                isLoading: false,
                error: errorMessage,
            });
            throw error;
        }
    },

    setCurrentUser: (user) => {
        set({ currentUser: user });
    },

    setUserSettings: (settings) => {
        set({ userSettings: settings });
    },

    clearError: () => {
        set({ error: null });
    },
}));

export {
    useAuthenticationStore,
};

export default useAuthenticationStore;
