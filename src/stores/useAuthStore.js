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
    loginWithUniversityId: async (universityId, password) => {
        set({ isLoading: true, error: null });

        try {
            const user = await authService.loginWithUniversityId(universityId, password);
            set({ currentUser: user, isLoading: false, error: null });
            
            return user;
        } catch (error) {
            const message = error?.message ?? 'Failed to authenticate with University ID.';
            set({ isLoading: false, error: message });
            throw error;
        }
    },

    loginWithGoogle: async () => {
        set({ isLoading: true, error: null });

        try {
            const user = await authService.loginWithGoogle();
            set({ currentUser: user, isLoading: false, error: null });

            return user;
        } catch (error) {
            const message = error?.message ?? 'Google authentication failed.';
            set({ isLoading: false, error: message });
            throw error;
        }
    },

    requestPasswordReset: async (email) => {
        set({ isLoading: true, error: null });

        try {
            await authService.requestPasswordReset(email);
            set({ isLoading: false });
        } catch (error) {
            const message = error?.message ?? 'Failed to send password reset email.';
            set({ isLoading: false, error: message });
            throw error;
        }
    },

    logout: async () => {
        set({ isLoading: true, error: null });

        try {
            await authService.logout();
            set({ currentUser: null, isLoading: false, error: null });
        } catch (error) {
            const message = error?.message ?? 'Sign out failed.';
            set({ isLoading: false, error: message });
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
