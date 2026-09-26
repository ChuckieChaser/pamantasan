// --- IMPORTS ---
import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from './components/feedback/ToastProvider';
import { DialogProvider } from './components/feedback/DialogProvider';
import { useAuth } from './features/auth/hooks/useAuth';
import { useInactivityTimeout } from './features/auth/hooks/useInactivityTimeout';
import { AppRoutes } from './routes/AppRoutes';


// --- ROOT APP CONTENT ---
const AppContent = () => {
    // --- HOOKS & STATE ---
    const { toast } = useToast();
    const { isAuthenticated, handleLogout, initializeAuthListener } = useAuth();

    // Initialize Firebase Auth listener on mount
    useEffect(() => {
        const unsubscribe = initializeAuthListener();
        return () => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, [initializeAuthListener]);

    // Active session inactivity monitor & concurrent session termination binding
    const onSessionTimeout = async (reason) => {
        await handleLogout();
        if (reason === 'SESSION_REVOKED') {
            toast.error('Session Terminated', 'Your account was logged into on another device.');
        } else {
            toast.information('Session Expired', 'You have been logged out due to 5 minutes of inactivity.');
        }
    };

    useInactivityTimeout({
        enabled: isAuthenticated,
        onTimeout: onSessionTimeout,
    });

    // --- RENDER ---
    return <AppRoutes />;
};


// --- ROOT APP SHELL ---
export const App = () => {
    return (
        <BrowserRouter>
            <ToastProvider>
                <DialogProvider>
                    <AppContent />
                </DialogProvider>
            </ToastProvider>
        </BrowserRouter>
    );
};
