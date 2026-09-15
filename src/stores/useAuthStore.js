// --- IMPORTS ---
import { create } from 'zustand';
import { authService } from '../services';


// --- STORE ---
const useAuthStore = create((set) => ({
    // STATES
    currentUser: null,
    isLoading: true,
    error: null,

    // CORE
    loginWithUniversityId: async (universityId, password, options = {}) => {
        set({ error: null });

        try {
            const user = await authService.loginWithUniversityId(universityId, password, options);
            set({ currentUser: user, error: null });
            
            return user;
        } catch (error) {
            const message = error?.message ?? 'Failed to authenticate with University ID.';
            set({ error: message });
            throw error;
        }
    },

    loginWithGoogle: async (options = {}) => {
        set({ error: null });

        try {
            const user = await authService.loginWithGoogle(options);
            set({ currentUser: user, error: null });

            return user;
        } catch (error) {
            const message = error?.message ?? 'Google authentication failed.';
            set({ error: message });
            throw error;
        }
    },

    requestPasswordReset: async (email) => {
        set({ error: null });

        try {
            await authService.requestPasswordReset(email);
        } catch (error) {
            const message = error?.message ?? 'Failed to send password reset email.';
            set({ error: message });
            throw error;
        }
    },

    logout: async () => {
        set({ error: null });

        try {
            await authService.logout();
            set({ currentUser: null, error: null });
        } catch (error) {
            const message = error?.message ?? 'Sign out failed.';
            set({ error: message });
            throw error;
        }
    },

    // LISTENERS
    initializeAuthListener: () => {
        const unsubscribe = authService.onAuthStateChanged((user) => {
            set({
                currentUser: user,
                isLoading: false,
                error: null,
            });
        });

        return unsubscribe;
    },

    // CONTROLS
    clearError: () => {
        set({ error: null });
    },
}));


// --- EXPORTS ---
export { useAuthStore };
