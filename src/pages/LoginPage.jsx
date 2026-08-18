// --- IMPORTS ---
import { useState } from 'react';
import {
    GraduationCap,
    Lock,
    User,
    ArrowRight,
    Sun,
    Moon,
} from 'lucide-react';
import plpImage from '../assets/plp.jpg';
import { CardContainer } from '../components/Container';
import { PrimaryButton, SecondaryButton } from '../components/Button';
import { TextField, PasswordField } from '../components/Fields';
import { ToggleSelection } from '../components/Selections';
import { useToast } from '../components/Toast';
import useDarkMode from '../hooks/useDarkMode';

// --- CONFIGURATIONS ---
const UNIVERSITY_ID_REGEX = /^[0-9]{2}-[0-9]{5}$/;
const UNIVERSITY_ID_MAX_LENGTH = 8;

// --- COMPONENTS ---
const LoginPage = ({ onLoginSuccess, onGoogleLogin }) => {
    // HOOKS
    const { showToast } = useToast();
    const [isDarkMode, toggleDarkMode] = useDarkMode();

    // STATES
    const [universityId, setUniversityId] = useState('');
    const [password, setPassword] = useState('');
    const [rememberDevice, setRememberDevice] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [universityIdError, setUniversityIdError] = useState('');
    const [passwordError, setPasswordError] = useState('');

    // HANDLERS
    const handleUniversityIdChange = (event) => {
        const formattedId = formatUniversityId(event.target.value);
        setUniversityId(formattedId);

        if (universityIdError) {
            setUniversityIdError('');
        }
    };

    const handlePasswordChange = (event) => {
        setPassword(event.target.value);
        if (passwordError) {
            setPasswordError('');
        }
    };

    const handleRememberDeviceToggle = () => {
        setRememberDevice((previousState) => !previousState);
    };

    const handleFormSubmit = async (event) => {
        event.preventDefault();

        // 1. Guard against empty inputs
        const trimmedUniversityId = universityId.trim();
        if (!trimmedUniversityId) {
            setUniversityIdError('University ID is required.');
            return;
        }

        if (!password) {
            setPasswordError('Password is required.');
            return;
        }

        // 2. Validate University ID format strictly against database constraints (^[0-9]{2}-[0-9]{5}$)
        if (!UNIVERSITY_ID_REGEX.test(trimmedUniversityId)) {
            setUniversityIdError('Enter a valid University ID format (e.g. 20-00001).');
            return;
        }

        setIsSubmitting(true);

        try {
            if (onLoginSuccess) {
                await onLoginSuccess({
                    universityId: trimmedUniversityId,
                    password,
                    rememberDevice,
                });
            } else {
                await new Promise((resolve) => setTimeout(resolve, 800));
                showToast({
                    title: 'Authentication Successful',
                    description: `Signed in as ${trimmedUniversityId}.`,
                    variant: 'success',
                });
            }
        } catch (error) {
            let errorMessage = 'Invalid University ID or password.';

            if (error?.code === 'auth/invalid-credential' || error?.code === 'auth/user-not-found' || error?.code === 'auth/wrong-password') {
                errorMessage = 'No matching account found or password was incorrect.';
            } else if (error?.code === 'auth/too-many-requests') {
                errorMessage = 'Too many failed login attempts. Please wait a moment before retrying.';
            } else if (error?.message) {
                errorMessage = error.message;
            }

            setPasswordError(errorMessage);
            showToast({
                title: 'Authentication Failed',
                description: errorMessage,
                variant: 'error',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGoogleSSOClick = async () => {
        if (onGoogleLogin) {
            await onGoogleLogin();
            return;
        }

        showToast({
            title: 'Google Workspace SSO',
            description: 'Connecting to Pamantasan Google Workspace authentication...',
            variant: 'information',
        });
    };

    const handleForgotPasswordClick = () => {
        showToast({
            title: 'Password Recovery',
            description: 'Please coordinate with the IT Helpdesk at helpdesk@plpasig.edu.ph to reset your account password.',
            variant: 'information',
        });
    };

    // RENDER
    return (
        <div className="relative min-h-screen w-full flex items-center justify-center p-4 overflow-hidden select-none">
            {/* 1. BACKGROUND UNIVERSITY IMAGE WITH FLOURISHING OVERLAYS */}
            <img
                src={plpImage}
                alt="Pamantasan ng Lungsod ng Pasig Campus"
                className="absolute inset-0 h-full w-full object-cover object-center scale-105 filter brightness-45 contrast-115 dark:brightness-25"
            />

            {/* AMBIENT GRADIENT & RADIAL VIGNETTE OVERLAYS */}
            <div className="absolute inset-0 bg-gradient-to-tr from-zinc-950/90 via-zinc-900/60 to-emerald-950/75 backdrop-blur-xs" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/15 via-transparent to-transparent pointer-events-none" />

            {/* FLOATING AMBIENT GLOW ORBS */}
            <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-information/15 blur-3xl pointer-events-none" />

            {/* TOP BAR: BRAND & DARK MODE TOGGLE */}
            <header className="absolute top-0 inset-x-0 p-6 flex items-center justify-between z-20">
                <div className="flex items-center gap-3 text-white">
                    <div className="h-10 w-10 rounded-xl bg-emerald-600/90 border border-emerald-400/30 flex items-center justify-center text-white shadow-lg backdrop-blur-md">
                        <GraduationCap className="h-6 w-6" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-sm tracking-wide">PLP DMS</span>
                        <span className="text-xs text-zinc-300">Document Management System</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <ToggleSelection
                        pressed={isDarkMode}
                        icon={isDarkMode ? Sun : Moon}
                        onChange={toggleDarkMode}
                        title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                        className="bg-surface/80 dark:bg-surface/80 backdrop-blur-md"
                    />
                </div>
            </header>

            {/* 2. MAIN AUTHENTICATION CARD CONTAINER */}
            <main className="relative z-10 max-w-md w-full">
                <CardContainer className="bg-surface/90 dark:bg-surface/90 backdrop-blur-2xl border border-surface-border shadow-2xl rounded-2xl p-8 flex flex-col gap-6 text-text">
                    {/* CARD HEADER */}
                    <div className="flex flex-col gap-2">
                        <h1 className="text-2xl font-bold font-serif tracking-tight">Sign In</h1>
                        <p className="text-xs text-text-muted leading-relaxed">
                            Enter your official University ID to access your account.
                        </p>
                    </div>

                    {/* FORM FIELDS */}
                    <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
                        <TextField
                            label="University ID"
                            placeholder="20-00001"
                            value={universityId}
                            onChange={handleUniversityIdChange}
                            error={universityIdError}
                            leadingIcon={User}
                            maxLength={UNIVERSITY_ID_MAX_LENGTH}
                            inputMode="numeric"
                            autoComplete="username"
                            required
                        />

                        <PasswordField
                            label="Account Password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={handlePasswordChange}
                            error={passwordError}
                            leadingIcon={Lock}
                            autoComplete="current-password"
                            required
                        />

                        <div className="flex items-center justify-between text-xs pt-1">
                            <label className="flex items-center gap-2 cursor-pointer select-none text-text-muted hover:text-text transition-colors">
                                <input
                                    type="checkbox"
                                    checked={rememberDevice}
                                    onChange={handleRememberDeviceToggle}
                                    className="rounded border-surface-border text-accent focus:ring-accent accent-accent h-4 w-4"
                                />
                                <span>Remember this device</span>
                            </label>
                            <button
                                type="button"
                                onClick={handleForgotPasswordClick}
                                className="text-accent hover:text-accent-hover font-medium cursor-pointer transition-colors"
                            >
                                Forgot password?
                            </button>
                        </div>

                        <PrimaryButton
                            type="submit"
                            label={isSubmitting ? 'Verifying Credentials...' : 'Sign In to DMS'}
                            leadingIcon={ArrowRight}
                            loading={isSubmitting}
                            className="w-full mt-2"
                        />
                    </form>

                    {/* DIVIDER */}
                    <div className="relative flex items-center justify-center my-1">
                        <div className="border-t border-surface-border w-full" />
                        <span className="bg-surface px-3 text-xs text-text-muted uppercase tracking-wider font-semibold shrink-0">
                            or continue with
                        </span>
                    </div>

                    {/* GOOGLE WORKSPACE SSO BUTTON */}
                    <SecondaryButton
                        label="Sign in with Google Workspace"
                        onClick={handleGoogleSSOClick}
                        className="w-full justify-center"
                    />
                </CardContainer>
            </main>

            {/* FOOTER: INSTITUTIONAL NOTICE */}
            <footer className="absolute bottom-4 inset-x-0 text-center text-xs text-zinc-400 z-20 pointer-events-none">
                <span>© 2026 Pamantasan ng Lungsod ng Pasig. Secure Institutional Document Management System.</span>
            </footer>
        </div>
    );
};

export default LoginPage;

// --- HELPERS ---
function formatUniversityId(rawInput) {
    if (!rawInput) {
        return '';
    }

    // Extract digits only and limit to 7 digits (2 for prefix + 5 for suffix)
    const digits = rawInput.replace(/\D/g, '').slice(0, 7);

    if (digits.length <= 2) {
        return digits;
    }

    return `${digits.slice(0, 2)}-${digits.slice(2, 7)}`;
}
