// --- IMPORTS ---
import { useAuthStore } from '../stores';


// --- HOOK ---
const useAuth = () => {
    // STATES
    const currentUser = useAuthStore((state) => state.currentUser);
    const isLoading = useAuthStore((state) => state.isLoading);
    const error = useAuthStore((state) => state.error);

    // CORE
    const loginWithUniversityId = useAuthStore((state) => state.loginWithUniversityId);
    const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle);
    const requestPasswordReset = useAuthStore((state) => state.requestPasswordReset);
    const logout = useAuthStore((state) => state.logout);

    // LISTENERS
    const initializeAuthListener = useAuthStore((state) => state.initializeAuthListener);

    // CONTROLS
    const clearError = useAuthStore((state) => state.clearError);

    return {
        currentUser,
        isLoading,
        error,
        loginWithUniversityId,
        loginWithGoogle,
        requestPasswordReset,
        logout,
        initializeAuthListener,
        clearError,
    };
};


// --- EXPORTS ---
export { useAuth };

