// --- IMPORTS ---
import {
    GraduationCap,
    LogOut,
    Sun,
    Moon,
} from 'lucide-react';
import LoginPage from './pages/LoginPage';
import { RoleBadge } from './components/Badge';
import { SecondaryButton } from './components/Button';
import { ToggleSelection } from './components/Selections';
import { ToastProvider, useToast } from './components/Toast';
import useAuth from './hooks/useAuth';
import useDarkMode from './hooks/useDarkMode';

// --- COMPONENTS ---
const AppContent = () => {
    // HOOKS
    const { showToast } = useToast();
    const [isDarkMode, toggleDarkMode] = useDarkMode();
    const { currentUser, isLoading, loginWithUniversityId, loginWithGoogle, logout } = useAuth();

    // HANDLERS
    const handleLoginSuccess = async ({ universityId, password }) => {
        const user = await loginWithUniversityId(universityId, password);
        showToast({
            title: 'Authentication Successful',
            description: `Welcome to PLP DMS, ${user.name || user.email}.`,
            variant: 'success',
        });
    };

    const handleGoogleLogin = async () => {
        const user = await loginWithGoogle();
        showToast({
            title: 'Google SSO Verified',
            description: `Signed in with ${user.email}.`,
            variant: 'success',
        });
    };

    const handleSignOut = async () => {
        try {
            await logout();
            showToast({
                title: 'Signed Out',
                description: 'You have been safely signed out.',
                variant: 'information',
            });
        } catch (error) {
            showToast({
                title: 'Sign Out Error',
                description: error?.message || 'Failed to sign out.',
                variant: 'error',
            });
        }
    };

    // RENDER: LOADING STATE
    if (isLoading && !currentUser) {
        return (
            <div className="min-h-screen bg-background text-text flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white animate-pulse">
                        <GraduationCap className="h-6 w-6" />
                    </div>
                    <span className="text-xs text-text-muted">Connecting to Firebase Auth...</span>
                </div>
            </div>
        );
    }

    // RENDER: UNAUTHENTICATED LOGIN SCREEN
    if (!currentUser) {
        return (
            <LoginPage
                onLoginSuccess={handleLoginSuccess}
                onGoogleLogin={handleGoogleLogin}
            />
        );
    }

    // RENDER: AUTHENTICATED APPLICATION SHELL
    return (
        <div className="min-h-screen bg-background text-text flex flex-col">
            {/* APPLICATION TOP BAR */}
            <header className="border-b border-surface-border bg-surface px-6 py-3 flex items-center justify-between sticky top-0 z-40 shadow-xs">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm">
                        <GraduationCap className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-bold tracking-tight">Pamantasan ng Lungsod ng Pasig</span>
                        <span className="text-xs text-text-muted">Document Management System</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* USER PROFILE & ROLE BADGE */}
                    <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-surface-hover border border-surface-border">
                        <div className="flex flex-col text-right">
                            <span className="text-xs font-semibold text-text">{currentUser.name}</span>
                            <span className="text-xs text-text-muted">{currentUser.department || currentUser.email}</span>
                        </div>
                        <RoleBadge role={currentUser.role || 'faculty'} size="sm" />
                    </div>

                    <div className="h-5 w-px bg-surface-border shrink-0" />

                    <ToggleSelection
                        pressed={isDarkMode}
                        icon={isDarkMode ? Sun : Moon}
                        onChange={toggleDarkMode}
                        title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    />

                    <SecondaryButton
                        label="Sign Out"
                        leadingIcon={LogOut}
                        onClick={handleSignOut}
                    />
                </div>
            </header>

            {/* MAIN WORKSPACE CONTENT */}
            <main className="flex-1 py-12 px-4 sm:px-6 max-w-5xl w-full mx-auto flex flex-col items-center justify-center text-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-accent-background border border-accent-border flex items-center justify-center text-accent shadow-inner">
                    <GraduationCap className="h-9 w-9" />
                </div>
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold font-serif">Workspace Ready</h1>
                    <p className="text-sm text-text-muted max-w-md">
                        Signed in as <span className="font-semibold text-text">{currentUser.name}</span> (<span className="text-xs text-text-muted">{currentUser.email}</span>) with role <RoleBadge role={currentUser.role || 'faculty'} size="sm" className="inline-flex align-middle mx-1" />.
                    </p>
                </div>
            </main>
        </div>
    );
};

const App = () => {
    return (
        <ToastProvider>
            <AppContent />
        </ToastProvider>
    );
};

export default App;
