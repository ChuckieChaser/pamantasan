// --- IMPORTS ---
import { useState } from 'react';
import {
    Lock,
    User,
    DoorOpen,
} from 'lucide-react';
import { AuthLayout } from '../layouts';
import {
    Button,
    TextField,
    PasswordField,
    formatUniversityId,
} from '../components';
import { useToast } from '../hooks';
import { constants } from '../constants';

const GoogleIcon = ({ className = 'h-4 w-4 shrink-0' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
    </svg>
);

// --- COMPONENTS ---
const LoginPage = ({
    onLoginSuccess,
    onGoogleLogin,
    onForgotPasswordClick,
}) => {
    // STATES
    const [universityId, setUniversityId] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [universityIdError, setUniversityIdError] = useState('');
    const [passwordError, setPasswordError] = useState('');

    // HOOKS
    const { showToast } = useToast();

    // HANDLERS
    const handleUniversityIdChange = (event) => {
        const rawValue = event.target.value;
        const formatted = formatUniversityId(rawValue);
        setUniversityId(formatted);

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

    const handleForgotPassword = (event) => {
        event.preventDefault();
        onForgotPasswordClick?.();
    };

    const handleFormSubmit = async (event) => {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        // Validate fields simultaneously
        const trimmedUniversityId = universityId.trim();
        let hasError = false;

        if (!trimmedUniversityId) {
            setUniversityIdError('University ID is required.');
            hasError = true;
        } else if (!constants.VALIDATION_PATTERNS.UNIVERSITY_ID.test(trimmedUniversityId)) {
            setUniversityIdError('Enter valid ID format (e.g. 20-00001).');
            hasError = true;
        }

        if (!password) {
            setPasswordError('Password is required.');
            hasError = true;
        }

        if (hasError) {
            return;
        }

        setIsSubmitting(true);
        setPasswordError('');

        try {
            if (onLoginSuccess) {
                await onLoginSuccess({
                    universityId: trimmedUniversityId,
                    password,
                });
            }
            // User requirement: "no pop up toast login" - do not trigger toast on login
        } catch (error) {
            let errorMessage = 'Invalid University ID or password.';

            if (
                error?.code === 'ERR_CONCURRENT_SESSION' ||
                error?.message?.includes('active in another session') ||
                error?.message?.includes('Concurrent logins are not permitted')
            ) {
                errorMessage = 'Account active in another session.';
            } else if (
                error?.code === 'auth/invalid-credential' ||
                error?.code === 'auth/user-not-found' ||
                error?.code === 'auth/wrong-password'
            ) {
                errorMessage = 'Invalid credentials.';
            } else if (error?.code === 'auth/too-many-requests') {
                errorMessage = 'Too many attempts. Try again later.';
            } else if (error?.message) {
                errorMessage = error.message;
            }

            setPasswordError(errorMessage);
            showToast({
                title: error?.code === 'ERR_CONCURRENT_SESSION' ? 'Access Restricted' : 'Authentication Failed',
                description: errorMessage,
                variant: error?.code === 'ERR_CONCURRENT_SESSION' ? 'warning' : 'error',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGoogleSSOClick = async () => {
        if (isGoogleLoading || isSubmitting) return;

        setIsGoogleLoading(true);
        setPasswordError('');

        try {
            if (onGoogleLogin) {
                await onGoogleLogin();
                return;
            }
        } catch (error) {
            console.error('Google Sign-In Error:', error);
            if (
                error?.code === 'auth/popup-closed-by-user' ||
                error?.message?.includes('cancelled')
            ) {
                // User closed the popup, immediately return without error toast
                return;
            }

            let errorMessage = 'Google authentication failed.';
            if (
                error?.code === 'ERR_CONCURRENT_SESSION' ||
                error?.message?.includes('active in another session') ||
                error?.message?.includes('Concurrent logins are not permitted')
            ) {
                errorMessage = 'Account active in another session.';
            } else if (error?.message) {
                errorMessage = error.message;
            }

            setPasswordError(errorMessage);
            showToast({
                title: error?.code === 'ERR_CONCURRENT_SESSION' ? 'Access Restricted' : 'Authentication Failed',
                description: errorMessage,
                variant: error?.code === 'ERR_CONCURRENT_SESSION' ? 'warning' : 'error',
            });
        } finally {
            setIsGoogleLoading(false);
        }
    };

    // RENDER
    return (
        <AuthLayout
            title="Sign In"
            description="Enter your official University ID and password to access your account."
        >
            {/* FORM FIELDS */}
            <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
                <TextField
                    label="University ID"
                    placeholder="Enter your university id"
                    value={universityId}
                    onChange={handleUniversityIdChange}
                    error={universityIdError}
                    leadingIcon={User}
                    maxLength={8}
                    inputMode="numeric"
                    autoComplete="username"
                    required
                />

                <PasswordField
                    label="Password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={handlePasswordChange}
                    error={passwordError}
                    leadingIcon={Lock}
                    autoComplete="current-password"
                    required
                />

                <div className="flex items-center justify-end text-xs pt-1">
                    <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-accent hover:text-accent-hover font-medium cursor-pointer transition-colors"
                    >
                        Forgot password?
                    </button>
                </div>

                <Button
                    type="submit"
                    variant="primary"
                    label={isSubmitting ? 'Logging In...' : 'Log In'}
                    leadingIcon={DoorOpen}
                    isLoading={isSubmitting}
                    isDisabled={isSubmitting || isGoogleLoading}
                    className="w-full mt-2"
                />
            </form>

            {/* DIVIDER */}
            <div className="relative flex items-center justify-center my-1 gap-3">
                <div className="border-t border-surface-border flex-1" />
                <span className="text-xs text-text-muted uppercase tracking-wider font-semibold shrink-0">
                    or continue with
                </span>
                <div className="border-t border-surface-border flex-1" />
            </div>

            {/* GOOGLE SINGLE SIGN ON BUTTON */}
            <Button
                variant="secondary"
                label={isGoogleLoading ? 'Connecting...' : 'Sign in with Google'}
                leadingIcon={GoogleIcon}
                onClick={handleGoogleSSOClick}
                isLoading={isGoogleLoading}
                isDisabled={isSubmitting || isGoogleLoading}
                className="w-full justify-center"
            />
        </AuthLayout>
    );
};

// --- EXPORTS ---
export { LoginPage };
export default LoginPage;
