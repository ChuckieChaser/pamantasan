// --- AUTH STORE ---
import { create } from 'zustand';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../services/firebase';
import {
    loginWithUniversityId,
    loginWithGoogle,
    logout,
    requestPasswordReset,
    verifyPasswordResetOtp,
    resetPasswordWithOtp,
    changePassword,
    linkGoogleAccount,
} from './authService';


// --- STORE ---

export const useAuthStore = create((set) => ({
    // --- STATE ---
    currentUser: null,
    isLoading: true,
    error: null,


    // --- AUTH ---

    loginWithUniversityId: async (payload) => {
        set({ error: null });
        try {
            const user = await loginWithUniversityId(payload);
            set({ currentUser: user, error: null });
            return user;
        } catch (error) {
            set({ error: error?.message ?? 'Failed to authenticate with University ID.' });
            throw error;
        }
    },

    loginWithGoogle: async () => {
        set({ error: null });
        try {
            const user = await loginWithGoogle();
            set({ currentUser: user, error: null });
            return user;
        } catch (error) {
            set({ error: error?.message ?? 'Google authentication failed.' });
            throw error;
        }
    },

    logout: async () => {
        set({ error: null });
        try {
            await logout();
            set({ currentUser: null, error: null });
        } catch (error) {
            set({ error: error?.message ?? 'Sign out failed.' });
            throw error;
        }
    },


    // --- PASSWORD RECOVERY ---

    requestPasswordReset: async (payload) => {
        set({ error: null });
        try {
            return await requestPasswordReset(payload);
        } catch (error) {
            set({ error: error?.message ?? 'Failed to send password reset email.' });
            throw error;
        }
    },

    verifyPasswordResetOtp: async (payload) => {
        set({ error: null });
        try {
            return await verifyPasswordResetOtp(payload);
        } catch (error) {
            set({ error: error?.message ?? 'OTP verification failed.' });
            throw error;
        }
    },

    resetPasswordWithOtp: async (payload) => {
        set({ error: null });
        try {
            return await resetPasswordWithOtp(payload);
        } catch (error) {
            set({ error: error?.message ?? 'Password reset failed.' });
            throw error;
        }
    },


    // --- ACCOUNT ---

    changePassword: async (payload) => {
        set({ error: null });
        try {
            return await changePassword(payload);
        } catch (error) {
            set({ error: error?.message ?? 'Password change failed.' });
            throw error;
        }
    },

    linkGoogleAccount: async (targetEmail) => {
        set({ error: null });
        try {
            return await linkGoogleAccount(targetEmail);
        } catch (error) {
            set({ error: error?.message ?? 'Google account linking failed.' });
            throw error;
        }
    },


    // --- LISTENER ---

    initializeAuthListener: () => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            set({ currentUser: user, isLoading: false, error: null });
        });
        return unsubscribe;
    },


    // --- CONTROLS ---

    setCurrentUser: (user) => set({ currentUser: user, isLoading: false }),

    clearError: () => set({ error: null }),
}));
