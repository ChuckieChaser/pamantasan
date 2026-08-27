// --- IMPORTS ---
import { useState, useEffect } from 'react';
import { authService } from '../services';

// --- HOOK ---
const useAuth = () => {
    // STATES
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // HOOKS
    useEffect(() => {
        const unsubscribe = authService.onAuthStateChanged((user) => {
            setCurrentUser(user);
            setIsLoading(false);
        });

        return () => {
            unsubscribe();
        };
    }, []);

    // HANDLERS
    const loginWithEmail = async (email, password) => {
        setIsLoading(true);
        try {
            const authenticatedUser = await authService.loginWithEmail(email, password);
            setCurrentUser(authenticatedUser);
            return authenticatedUser;
        } finally {
            setIsLoading(false);
        }
    };

    const loginWithUniversityId = async (universityId, password) => {
        setIsLoading(true);
        try {
            const authenticatedUser = await authService.loginWithUniversityId(universityId, password);
            setCurrentUser(authenticatedUser);
            return authenticatedUser;
        } finally {
            setIsLoading(false);
        }
    };

    const loginWithGoogle = async () => {
        setIsLoading(true);
        try {
            const authenticatedUser = await authService.loginWithGoogle();
            setCurrentUser(authenticatedUser);
            return authenticatedUser;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        setIsLoading(true);
        try {
            await authService.logout();
            setCurrentUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    return {
        currentUser,
        isLoading,
        loginWithEmail,
        loginWithUniversityId,
        loginWithGoogle,
        logout,
    };
};

export default useAuth;
