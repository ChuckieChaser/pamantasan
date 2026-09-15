// --- IMPORTS ---
import { useEffect, useState } from 'react';
import {
    Mail,
    ArrowRight,
    Key,
    ShieldCheck,
    CheckCircle2,
    RefreshCw,
} from 'lucide-react';
import { AuthLayout } from '../layouts';
import {
    Button,
    TextField,
    PasswordField,
} from '../components';
import { useToast } from '../hooks';
import { authService } from '../services';
import { constants } from '../constants';

// --- CONSTANTS ---
const RESEND_COOLDOWN_SECONDS = 60;

// --- COMPONENTS ---
const ForgotPasswordPage = ({ onBackToLogin }) => {
    // STEP STATE: 'EMAIL' | 'OTP' | 'PASSWORD' | 'SUCCESS'
    const [step, setStep] = useState('EMAIL');

    // FORM FIELDS
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // FORM ERRORS (Field-level errors rendered below inputs)
    const [fieldErrors, setFieldErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // RESEND COUNTDOWN
    const [countdown, setCountdown] = useState(0);
    const [isResending, setIsResending] = useState(false);

    // HOOKS
    const { showToast } = useToast();

    // COUNTDOWN TIMER EFFECT
    useEffect(() => {
        if (countdown <= 0) return;

        const timer = setInterval(() => {
            setCountdown((prev) => Math.max(0, prev - 1));
        }, 1000);

        return () => clearInterval(timer);
    }, [countdown]);

    // HANDLERS: STEP 1 (EMAIL REQUEST)
    const handleEmailSubmit = async (event) => {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        const trimmedEmail = email.trim().toLowerCase();
        const errors = {};

        if (!trimmedEmail) {
            errors.email = 'Email is required.';
        } else if (!constants.VALIDATION_PATTERNS.EMAIL.test(trimmedEmail)) {
            errors.email = `Must be ${constants.INSTITUTIONAL_CONFIGURATION.EMAIL_DOMAIN}`;
        }

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }

        setIsSubmitting(true);
        setFieldErrors({});

        try {
            await authService.sendPasswordResetOtp(trimmedEmail);
            setStep('OTP');
            setCountdown(RESEND_COOLDOWN_SECONDS);
            showToast({
                title: 'Code Sent',
                description: 'Verification code sent to your email.',
                variant: 'success',
            });
        } catch (error) {
            const message = error?.message || 'Failed to dispatch verification code.';
            setFieldErrors({ email: message });
            showToast({
                title: 'Request Failed',
                description: message,
                variant: 'error',
                rawError: error?.stack || error?.message || String(error),
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // HANDLERS: RESEND OTP
    const handleResendOtp = async () => {
        if (countdown > 0 || isResending) return;

        setIsResending(true);
        setFieldErrors({});

        try {
            await authService.sendPasswordResetOtp(email.trim().toLowerCase());
            setCountdown(RESEND_COOLDOWN_SECONDS);
            showToast({
                title: 'Code Resent',
                description: 'A new verification code was sent to your email.',
                variant: 'success',
            });
        } catch (error) {
            const message = error?.message || 'Failed to resend code.';
            setFieldErrors({ otp: message });
            showToast({
                title: 'Resend Failed',
                description: message,
                variant: 'error',
                rawError: error?.stack || error?.message || String(error),
            });
        } finally {
            setIsResending(false);
        }
    };

    // HANDLERS: STEP 2 (OTP VERIFICATION)
    const handleOtpSubmit = async (event) => {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        const trimmedOtp = otp.trim();
        const errors = {};

        if (!trimmedOtp) {
            errors.otp = 'Verification code is required.';
        } else if (trimmedOtp.length !== 6 || !/^\d{6}$/.test(trimmedOtp)) {
            errors.otp = 'Enter the 6-digit code.';
        }

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }

        setIsSubmitting(true);
        setFieldErrors({});

        try {
            await authService.verifyPasswordResetOtp(email.trim().toLowerCase(), trimmedOtp);
            setStep('PASSWORD');
            showToast({
                title: 'Code Verified',
                description: 'Please enter your new password.',
                variant: 'success',
            });
        } catch (error) {
            const message = error?.message || 'Invalid or expired verification code.';
            setFieldErrors({ otp: message });
            showToast({
                title: 'Verification Failed',
                description: message,
                variant: 'error',
                rawError: error?.stack || error?.message || String(error),
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // HANDLERS: STEP 3 (NEW PASSWORD UPDATE)
    const handlePasswordSubmit = async (event) => {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        const errors = {};

        if (!newPassword) {
            errors.newPassword = 'New password is required.';
        } else if (newPassword.length < 8) {
            errors.newPassword = 'Must be at least 8 characters.';
        }

        if (!confirmPassword) {
            errors.confirmPassword = 'Confirm password is required.';
        } else if (newPassword && confirmPassword && newPassword !== confirmPassword) {
            errors.confirmPassword = 'Passwords do not match.';
        }

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }

        setIsSubmitting(true);
        setFieldErrors({});

        try {
            await authService.resetPasswordWithOtp(
                email.trim().toLowerCase(),
                otp.trim(),
                newPassword
            );
            setStep('SUCCESS');
            showToast({
                title: 'Password Updated',
                description: 'Your password was reset successfully.',
                variant: 'success',
            });
        } catch (error) {
            const message = error?.message || 'Failed to update password.';
            setFieldErrors({ newPassword: message });
            showToast({
                title: 'Update Failed',
                description: message,
                variant: 'error',
                rawError: error?.stack || error?.message || String(error),
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBackToSignIn = (event) => {
        event?.preventDefault();
        onBackToLogin?.();
    };

    // RENDER: STEP 4 (SUCCESS CONFIRMATION)
    if (step === 'SUCCESS') {
        return (
            <AuthLayout
                title="Password Reset Complete"
                description="Your password has been successfully updated. You may now sign in."
                onBack={handleBackToSignIn}
                backButtonLabel="Return to sign in"
            >
                <div className="flex flex-col items-center gap-4 text-center py-4">
                    <div className="h-14 w-14 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                        <CheckCircle2 className="h-7 w-7" />
                    </div>

                    <p className="text-xs text-text-muted leading-relaxed max-w-sm">
                        Your account credentials have been secured with your new password.
                    </p>

                    <Button
                        variant="primary"
                        label="Sign In to Your Account"
                        onClick={handleBackToSignIn}
                        className="w-full mt-2"
                        leadingIcon={ArrowRight}
                    />
                </div>
            </AuthLayout>
        );
    }

    // RENDER: STEP 3 (NEW PASSWORD)
    if (step === 'PASSWORD') {
        return (
            <AuthLayout
                title="Create New Password"
                description="Enter and confirm your new personal password to regain access."
                onBack={() => setStep('OTP')}
                backButtonLabel="Back to verification"
            >
                <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
                    <PasswordField
                        label="New Password"
                        placeholder="Enter your new password"
                        value={newPassword}
                        onChange={(e) => {
                            setNewPassword(e.target.value);
                            if (fieldErrors.newPassword) setFieldErrors((p) => ({ ...p, newPassword: '' }));
                        }}
                        error={fieldErrors.newPassword}
                        helper="Min. 8 characters."
                        leadingIcon={Key}
                        required
                        autoFocus
                    />

                    <PasswordField
                        label="Confirm New Password"
                        placeholder="Enter your confirm new password"
                        value={confirmPassword}
                        onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            if (fieldErrors.confirmPassword) setFieldErrors((p) => ({ ...p, confirmPassword: '' }));
                        }}
                        error={fieldErrors.confirmPassword}
                        leadingIcon={Key}
                        required
                    />

                    <Button
                        type="submit"
                        variant="primary"
                        label={isSubmitting ? 'Updating Password...' : 'Save Password & Sign In'}
                        leadingIcon={ArrowRight}
                        isLoading={isSubmitting}
                        className="w-full mt-2"
                    />

                    <Button
                        variant="secondary"
                        label="Cancel"
                        onClick={handleBackToSignIn}
                        className="w-full justify-center"
                    />
                </form>
            </AuthLayout>
        );
    }

    // RENDER: STEP 2 (OTP ENTRY)
    if (step === 'OTP') {
        return (
            <AuthLayout
                title="Enter Verification Code"
                description={`A 6-digit verification code was sent to ${email}.`}
                onBack={() => setStep('EMAIL')}
                backButtonLabel="Use a different email"
            >
                <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
                    <TextField
                        label="Verification Code"
                        placeholder="Enter 6-digit code"
                        value={otp}
                        onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setOtp(val);
                            if (fieldErrors.otp) setFieldErrors((p) => ({ ...p, otp: '' }));
                        }}
                        error={fieldErrors.otp}
                        leadingIcon={ShieldCheck}
                        maxLength={6}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        helper="Check your inbox or spam folder."
                        required
                        autoFocus
                    />

                    <div className="flex items-center justify-between text-xs pt-0.5">
                        <span className="text-text-muted">Didn't receive the code?</span>
                        {countdown > 0 ? (
                            <span className="text-text-muted font-medium">
                                Resend in {countdown}s
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={handleResendOtp}
                                disabled={isResending}
                                className="text-accent hover:text-accent-hover font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                            >
                                <RefreshCw className={`h-3 w-3 ${isResending ? 'animate-spin' : ''}`} />
                                Resend Code
                            </button>
                        )}
                    </div>

                    <Button
                        type="submit"
                        variant="primary"
                        label={isSubmitting ? 'Verifying Code...' : 'Verify Code'}
                        leadingIcon={ArrowRight}
                        isLoading={isSubmitting}
                        className="w-full mt-2"
                    />

                    <Button
                        variant="secondary"
                        label="Use a Different Email"
                        onClick={() => {
                            setStep('EMAIL');
                            setFieldErrors({});
                        }}
                        className="w-full justify-center"
                    />
                </form>
            </AuthLayout>
        );
    }

    // RENDER: STEP 1 (EMAIL REQUEST)
    return (
        <AuthLayout
            title="Reset Password"
            description="Enter your registered institutional email to receive a 6-digit verification code."
            onBack={handleBackToSignIn}
            backButtonLabel="Back to sign in"
        >
            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
                <TextField
                    label="Email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => {
                        setEmail(e.target.value);
                        if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: '' }));
                    }}
                    error={fieldErrors.email}
                    leadingIcon={Mail}
                    type="email"
                    autoComplete="email"
                    helper="Must be @plpasig.edu.ph"
                    required
                    autoFocus
                />

                <Button
                    type="submit"
                    variant="primary"
                    label={isSubmitting ? 'Sending Code...' : 'Send Verification Code'}
                    leadingIcon={ArrowRight}
                    isLoading={isSubmitting}
                    className="w-full mt-2"
                />

                <Button
                    variant="secondary"
                    label="Cancel and Sign In"
                    onClick={handleBackToSignIn}
                    className="w-full justify-center"
                />
            </form>
        </AuthLayout>
    );
};

// --- EXPORTS ---
export { ForgotPasswordPage };
export default ForgotPasswordPage;
