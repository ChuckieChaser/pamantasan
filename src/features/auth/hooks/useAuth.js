// --- USE AUTH HOOK ---
import { useCallback } from 'react';
import { useAuthStore } from './authStore';


// --- HOOK ---

export const useAuth = () => {
    const currentUser = useAuthStore((s) => s.currentUser);
    const isLoading = useAuthStore((s) => s.isLoading);
    const error = useAuthStore((s) => s.error);

    const loginWithUniversityId = useAuthStore((s) => s.loginWithUniversityId);
    const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
    const logout = useAuthStore((s) => s.logout);
    const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset);
    const verifyPasswordResetOtp = useAuthStore((s) => s.verifyPasswordResetOtp);
    const resetPasswordWithOtp = useAuthStore((s) => s.resetPasswordWithOtp);
    const changePassword = useAuthStore((s) => s.changePassword);
    const linkGoogleAccount = useAuthStore((s) => s.linkGoogleAccount);
    const initializeAuthListener = useAuthStore((s) => s.initializeAuthListener);
    const setCurrentUser = useAuthStore((s) => s.setCurrentUser);
    const clearError = useAuthStore((s) => s.clearError);

    const isAuthenticated = Boolean(currentUser);


    // --- DERIVED ---

    const handleLogin = useCallback(
        async (payload) => loginWithUniversityId(payload),
        [loginWithUniversityId],
    );

    const handleGoogleLogin = useCallback(
        async () => loginWithGoogle(),
        [loginWithGoogle],
    );

    const handleLogout = useCallback(
        async () => logout(),
        [logout],
    );

    const handlePasswordReset = useCallback(
        async (payload) => requestPasswordReset(payload),
        [requestPasswordReset],
    );

    const handleChangePassword = useCallback(
        async (payload) => changePassword(payload),
        [changePassword],
    );

    const handleLinkGoogle = useCallback(
        async (email) => linkGoogleAccount(email),
        [linkGoogleAccount],
    );


    return {
        // State
        currentUser,
        isLoading,
        isAuthenticated,
        error,

        // Handlers
        handleLogin,
        handleGoogleLogin,
        handleLogout,
        handlePasswordReset,
        handleChangePassword,
        handleLinkGoogle,

        // Direct actions (for flows needing fine-grained control)
        verifyPasswordResetOtp,
        resetPasswordWithOtp,
        initializeAuthListener,
        setCurrentUser,
        clearError,
    };
};
