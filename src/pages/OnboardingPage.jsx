// --- IMPORTS ---
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Key,
    Globe,
    ArrowRight,
    ShieldCheck,
} from 'lucide-react';
import { AuthLayout } from '../layouts';
import { Button, PasswordField } from '../components';
import { useAuth, useToast } from '../hooks';
import { authService } from '../services';
import { constants } from '../constants';


// --- COMPONENTS ---
const OnboardingPage = ({
    currentUser: propUser = null,
    onComplete = null,
}) => {
    // HOOKS
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { currentUser: authUser, isLoading: isAuthLoading } = useAuth();

    // RESOLVE ACTIVE USER
    const activeUser = propUser || authUser;
    const activeUserId = activeUser?.id || (typeof localStorage !== 'undefined' ? localStorage.getItem('pamantasan_auth_user_id') : null);
    const targetEmail = activeUser?.email || (typeof localStorage !== 'undefined' ? localStorage.getItem('pamantasan_auth_user_email') : null);

    // DERIVED STATUS
    const currentStatus = activeUser?.status ?? constants.USERS_STATUS.VERIFIED;
    const isPendingPassword = currentStatus === constants.USERS_STATUS.PENDING_PASSWORD;
    const isPendingSSO = currentStatus === constants.USERS_STATUS.PENDING_SSO;

    // STATES FOR PASSWORD SETUP
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordErrors, setPasswordErrors] = useState({});
    const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

    // STATES FOR SSO LINKING
    const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
    const [dontShowAgain, setDontShowAgain] = useState(false);

    // AUTO-REDIRECT
    useEffect(() => {
        if (isAuthLoading && !activeUser) {
            return;
        }

        if (!activeUser && !activeUserId) {
            navigate('/login', { replace: true });
            return;
        }

        if (currentStatus === constants.USERS_STATUS.VERIFIED) {
            navigate('/dashboard', { replace: true });
            return;
        }

        if (isPendingSSO && activeUserId) {
            const hasSkipped = authService.hasSkippedSSOOnboarding(activeUserId);
            if (hasSkipped) {
                navigate('/dashboard', { replace: true });
            }
        }
    }, [activeUser, activeUserId, currentStatus, isPendingSSO, isAuthLoading, navigate]);

    // HANDLERS: PASSWORD CHANGE
    const handlePasswordSubmit = async (event) => {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        const errors = {};
        if (!currentPassword) {
            errors.current = 'Temporary password is required.';
        }
        if (!newPassword) {
            errors.new = 'New password is required.';
        } else if (newPassword.length < 8) {
            errors.new = 'Must be at least 8 characters.';
        } else if (newPassword === currentPassword) {
            errors.new = 'Must be different from temporary password.';
        }
        if (!confirmPassword) {
            errors.confirm = 'Confirm password is required.';
        } else if (newPassword && newPassword !== confirmPassword) {
            errors.confirm = 'Passwords do not match.';
        }

        if (Object.keys(errors).length > 0) {
            setPasswordErrors(errors);
            return;
        }

        setPasswordErrors({});
        setIsSubmittingPassword(true);

        try {
            await authService.changePassword(currentPassword, newPassword);
            showToast({
                title: 'Password Updated',
                description: 'Password updated successfully.',
                variant: 'success',
            });
            // Automatically advances to PENDING_SSO step in view
        } catch (error) {
            const message = error?.message || 'Failed to update password.';
            setPasswordErrors({ current: message });
            showToast({
                title: 'Password Update Failed',
                description: message,
                variant: 'error',
            });
        } finally {
            setIsSubmittingPassword(false);
        }
    };

    // HANDLERS: SSO LINKING
    const handleLinkGoogle = async () => {
        if (!targetEmail) {
            showToast({
                title: 'Linking Failed',
                description: 'Email missing.',
                variant: 'error',
            });
            return;
        }

        setIsLinkingGoogle(true);

        try {
            await authService.linkGoogleAccount(targetEmail);
            showToast({
                title: 'Google SSO Linked',
                description: 'Account linked successfully.',
                variant: 'success',
            });
            if (onComplete) {
                await onComplete();
            } else {
                navigate('/dashboard', { replace: true });
            }
        } catch (error) {
            let desc = 'Link failed.';
            if (error?.message?.includes('mismatch')) {
                desc = 'Account email mismatch.';
            } else if (error?.message?.includes('cancelled') || error?.code === 'auth/popup-closed-by-user') {
                desc = 'Linking cancelled.';
            } else if (error?.message) {
                desc = error.message;
            }
            showToast({
                title: 'Linking Failed',
                description: desc,
                variant: 'error',
            });
        } finally {
            setIsLinkingGoogle(false);
        }
    };

    const handleSkipSSO = async () => {
        if (activeUserId) {
            authService.setSkippedSSOOnboarding(activeUserId, dontShowAgain);
        }

        if (onComplete) {
            await onComplete();
        } else {
            navigate('/dashboard', { replace: true });
        }
    };

    // RENDER: PASSWORD ONBOARDING
    if (isPendingPassword) {
        return (
            <AuthLayout
                title="Set Account Password"
                description="Your account was provisioned with a temporary password. Please set your personal password to continue."
            >
                <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
                    <PasswordField
                        label="Temporary / Initial Password"
                        placeholder="Enter your current password"
                        value={currentPassword}
                        onChange={(e) => {
                            setCurrentPassword(e.target.value);
                            if (passwordErrors.current) setPasswordErrors((prev) => ({ ...prev, current: '' }));
                        }}
                        error={passwordErrors.current}
                        leadingIcon={Key}
                        required
                        autoFocus
                    />

                    <PasswordField
                        label="New Password"
                        placeholder="Enter your new password"
                        value={newPassword}
                        onChange={(e) => {
                            setNewPassword(e.target.value);
                            if (passwordErrors.new) setPasswordErrors((prev) => ({ ...prev, new: '' }));
                        }}
                        error={passwordErrors.new}
                        leadingIcon={Key}
                        required
                    />

                    <PasswordField
                        label="Confirm New Password"
                        placeholder="Enter your confirm new password"
                        value={confirmPassword}
                        onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            if (passwordErrors.confirm) setPasswordErrors((prev) => ({ ...prev, confirm: '' }));
                        }}
                        error={passwordErrors.confirm}
                        leadingIcon={Key}
                        required
                    />

                    <Button
                        type="submit"
                        variant="primary"
                        label={isSubmittingPassword ? 'Updating Password...' : 'Save Password & Proceed'}
                        leadingIcon={ArrowRight}
                        isLoading={isSubmittingPassword}
                        className="w-full mt-2"
                    />
                </form>
            </AuthLayout>
        );
    }

    // RENDER: SSO ONBOARDING
    return (
        <AuthLayout
            title="Google Single Sign On (SSO)"
            description="Connect your institutional Google account for seamless authentication."
        >
            <div className="flex flex-col gap-5">
                <div className="p-4 rounded-xl bg-surface-hover/50 border border-surface-border flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-surface border border-surface-border text-accent shrink-0 mt-0.5">
                        <Globe className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <span className="text-sm font-semibold text-text">
                            Institutional Account
                        </span>
                        <span className="text-xs text-text-muted leading-relaxed">
                            Link <span className="font-semibold text-text">{targetEmail || 'your institutional email'}</span> to enable one-click Google sign-in.
                        </span>
                    </div>
                </div>

                <Button
                    variant="primary"
                    label={isLinkingGoogle ? 'Connecting Account...' : 'Link Google Account'}
                    leadingIcon={ShieldCheck}
                    onClick={handleLinkGoogle}
                    isLoading={isLinkingGoogle}
                    className="w-full justify-center"
                />

                <div className="flex flex-col gap-3 pt-2 border-t border-surface-border">
                    <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer hover:text-text transition-colors select-none">
                        <input
                            type="checkbox"
                            checked={dontShowAgain}
                            onChange={(e) => setDontShowAgain(e.target.checked)}
                            className="rounded border-surface-border text-accent focus:ring-accent accent-accent h-4 w-4"
                        />
                        <span>Don't show SSO on login for this PC</span>
                    </label>

                    <Button
                        variant="secondary"
                        label="Skip for Now"
                        onClick={handleSkipSSO}
                        disabled={isLinkingGoogle}
                        className="w-full justify-center"
                    />
                </div>
            </div>
        </AuthLayout>
    );
};

// --- EXPORTS ---
export { OnboardingPage };
export default OnboardingPage;
