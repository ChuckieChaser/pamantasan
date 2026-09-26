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
    verifySessionHeartbeat,
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
            const result = await loginWithUniversityId(payload);
            // If concurrent session step-up is required, return result directly without setting currentUser
            if (result?.requiresStepUp) {
                return result;
            }
            const activeUser = result?.user ?? result;
            set({ currentUser: activeUser, error: null });
            return activeUser;
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
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                try {
                    localStorage.removeItem('pamantasan_session_id');
                    localStorage.removeItem('pamantasan_last_active_time');
                } catch {
                    // Ignore storage errors
                }
                set({ currentUser: null, isLoading: false, error: null });
                return;
            }

            // Session Binding: Verify active session ID is present
            const sessionId = localStorage.getItem('pamantasan_session_id');
            if (!sessionId) {
                // If the session record was deleted, immediately terminate actual user session
                await logout().catch(() => {});
                set({ currentUser: null, isLoading: false, error: null });
                return;
            }

            // Verify with backend that this session record is intact and unrevoked
            try {
                const check = await verifySessionHeartbeat({ sessionId, userId: user.uid });
                if (check && check.valid === false) {
                    // Backend session was deleted (concurrency logout or timeout)
                    await logout().catch(() => {});
                    set({ currentUser: null, isLoading: false, error: null });
                    return;
                }
            } catch {
                // Network failure during initialization, preserve offline state
            }

            set({ currentUser: user, isLoading: false, error: null });
        });
        return unsubscribe;
    },


    // --- CONTROLS ---

    setCurrentUser: (user) => set({ currentUser: user, isLoading: false }),

    clearError: () => set({ error: null }),
}));
