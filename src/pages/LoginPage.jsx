// --- IMPORTS ---
import { useState } from 'react';
import {
    Lock,
    User,
    ArrowRight,
} from 'lucide-react';
import { AuthLayout } from '../layouts';
import {
    Button,
    TextField,
    PasswordField,
} from '../components';
import { useToast } from '../hooks';
import { constants } from '../constants';

// --- COMPONENTS ---
const LoginPage = ({
    onLoginSuccess,
    onGoogleLogin,
    onForgotPasswordClick,
}) => {
    // STATES
    const [universityId, setUniversityId] = useState('');
    const [password, setPassword] = useState('');
    const [rememberDevice, setRememberDevice] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [universityIdError, setUniversityIdError] = useState('');
    const [passwordError, setPasswordError] = useState('');

    // HOOKS
    const { showToast } = useToast();

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

    const handleForgotPassword = () => {
        if (onForgotPasswordClick) {
            onForgotPasswordClick();
            return;
        }

        showToast({
            title: 'Password Recovery',
            description: 'Please coordinate with the IT Helpdesk at helpdesk@plpasig.edu.ph to reset your account password.',
            variant: 'information',
        });
    };

    const handleFormSubmit = async (event) => {
        event.preventDefault();

        // Guard against empty inputs
        const trimmedUniversityId = universityId.trim();
        if (!trimmedUniversityId) {
            setUniversityIdError('University ID is required.');
            return;
        }

        if (!password) {
            setPasswordError('Password is required.');
            return;
        }

        // Validate University ID format
        if (!constants.VALIDATION_PATTERNS.UNIVERSITY_ID.test(trimmedUniversityId)) {
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

            if (
                error?.code === 'auth/invalid-credential' ||
                error?.code === 'auth/user-not-found' ||
                error?.code === 'auth/wrong-password'
            ) {
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
                    placeholder="20-00001"
                    value={universityId}
                    onChange={handleUniversityIdChange}
                    error={universityIdError}
                    leadingIcon={User}
                    maxLength={constants.INSTITUTIONAL_CONFIGURATION.MAX_UNIVERSITY_ID_LENGTH}
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
                        onClick={handleForgotPassword}
                        className="text-accent hover:text-accent-hover font-medium cursor-pointer transition-colors"
                    >
                        Forgot password?
                    </button>
                </div>

                <Button
                    type="submit"
                    variant="primary"
                    label={isSubmitting ? 'Verifying Credentials...' : 'Sign In to Pamantasan Records'}
                    leadingIcon={ArrowRight}
                    isLoading={isSubmitting}
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
            <Button
                variant="secondary"
                label="Sign in with Google Workspace"
                onClick={handleGoogleSSOClick}
                className="w-full justify-center"
            />
        </AuthLayout>
    );
};

// --- HELPERS ---
function formatUniversityId(rawInput) {
    if (!rawInput) {
        return '';
    }

    const digits = rawInput.replace(/\D/g, '').slice(0, 7);

    if (digits.length <= 2) {
        return digits;
    }

    return `${digits.slice(0, 2)}-${digits.slice(2, 7)}`;
}

// --- EXPORTS ---
export { LoginPage };
export default LoginPage;
