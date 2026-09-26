// --- IMPORTS ---
import { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Key, Mail, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormField } from '../components/forms/FormField';
import { Input } from '../components/forms/Input';
import { useToast } from '../components/feedback/ToastProvider';
import { useAuth } from '../features/auth/hooks/useAuth';
import backgroundImage from '../assets/background.jpg';
import logoImage from '../assets/logo.jpg';


// --- COMPONENTS ---
export const ForgotPasswordPage = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { handlePasswordReset, verifyPasswordResetOtp, resetPasswordWithOtp } = useAuth();

    // Step state: 'EMAIL' | 'OTP' | 'PASSWORD' | 'SUCCESS'
    const [step, setStep] = useState('EMAIL');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});

    // Step 1: Request Password Reset OTP
    const handleSendOtp = async (e) => {
        e?.preventDefault?.();
        if (!email.trim() || !email.includes('@')) {
            setFieldErrors({ email: 'A valid university email is required.' });
            return;
        }

        setIsLoading(true);
        setFieldErrors({});
        try {
            await handlePasswordReset({ email: email.trim().toLowerCase() });
            toast.success('Code sent', `A 6-digit verification code was dispatched to ${email}.`);
            setStep('OTP');
        } catch (err) {
            toast.error('Request failed', err?.message || 'Could not send verification code.', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Step 2: Verify OTP
    const handleVerifyOtp = async (e) => {
        e?.preventDefault?.();
        if (!otp.trim()) {
            setFieldErrors({ otp: 'Verification code is required.' });
            return;
        }

        setIsLoading(true);
        setFieldErrors({});
        try {
            await verifyPasswordResetOtp({ email: email.trim().toLowerCase(), otp: otp.trim() });
            toast.success('Code verified', 'Please create your new password.');
            setStep('PASSWORD');
        } catch (err) {
            toast.error('Invalid code', err?.message || 'The verification code is incorrect or expired.', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Step 3: Set New Password
    const handleSetNewPassword = async (e) => {
        e?.preventDefault?.();
        const errors = {};
        if (newPassword.length < 8) errors.newPassword = 'Password must be at least 8 characters.';
        if (newPassword !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }

        setIsLoading(true);
        setFieldErrors({});
        try {
            await resetPasswordWithOtp({
                email: email.trim().toLowerCase(),
                otp: otp.trim(),
                newPassword: newPassword,
            });
            toast.success('Password updated', 'Your account credentials have been reset.');
            setStep('SUCCESS');
        } catch (err) {
            toast.error('Reset failed', err?.message || 'Failed to update account password.', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 overflow-hidden select-none bg-background text-text">
            {/* Campus Background with ambient overlays */}
            <img
                src={backgroundImage}
                alt="Pamantasan Campus Background"
                className="absolute inset-0 h-full w-full object-cover object-center scale-105 filter brightness-50 contrast-125"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-zinc-950/90 via-zinc-900/60 to-emerald-950/70 backdrop-blur-sm" />
            <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-information/15 blur-3xl pointer-events-none" />

            {/* Card */}
            <Card className="relative z-10 max-w-md w-full p-6 sm:p-8 flex flex-col gap-6 shadow-2xl bg-surface/95 backdrop-blur-md border-surface-border">
                {/* Header */}
                <div className="flex flex-col items-center text-center gap-3">
                    <img
                        src={logoImage}
                        alt="Pamantasan Logo"
                        className="h-12 w-12 rounded-xl object-cover ring-2 ring-accent/30 shadow-md"
                    />
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-text">
                            Reset Password
                        </h1>
                        <p className="text-xs text-text-muted mt-1">
                            {step === 'EMAIL' && 'Enter your university email to receive a recovery code.'}
                            {step === 'OTP' && `Enter the 6-digit code sent to ${email}.`}
                            {step === 'PASSWORD' && 'Create a new secure password for your account.'}
                            {step === 'SUCCESS' && 'Password successfully updated.'}
                        </p>
                    </div>
                </div>

                {/* Step 1: Email Form */}
                {step === 'EMAIL' && (
                    <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
                        <FormField
                            label="University Email"
                            isRequired
                            errorMessage={fieldErrors.email}
                        >
                            <Input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="e.g. user@pamantasan.edu.ph"
                                leadingIcon={Mail}
                                hasError={Boolean(fieldErrors.email)}
                                autoFocus
                            />
                        </FormField>

                        <Button
                            type="submit"
                            variant="primary"
                            leadingIcon={ArrowRight}
                            isLoading={isLoading}
                            className="w-full mt-1"
                        >
                            Send Recovery Code
                        </Button>
                    </form>
                )}

                {/* Step 2: OTP Form */}
                {step === 'OTP' && (
                    <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
                        <FormField
                            label="Verification Code (OTP)"
                            isRequired
                            errorMessage={fieldErrors.otp}
                        >
                            <Input
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                placeholder="Enter 6-digit code"
                                leadingIcon={ShieldCheck}
                                hasError={Boolean(fieldErrors.otp)}
                                autoFocus
                            />
                        </FormField>

                        <Button
                            type="submit"
                            variant="primary"
                            leadingIcon={ArrowRight}
                            isLoading={isLoading}
                            className="w-full mt-1"
                        >
                            Verify Code
                        </Button>

                        <button
                            type="button"
                            onClick={() => setStep('EMAIL')}
                            className="text-xs text-text-muted hover:text-text transition-colors text-center"
                        >
                            Change email address
                        </button>
                    </form>
                )}

                {/* Step 3: Password Form */}
                {step === 'PASSWORD' && (
                    <form onSubmit={handleSetNewPassword} className="flex flex-col gap-4">
                        <FormField
                            label="New Password"
                            isRequired
                            errorMessage={fieldErrors.newPassword}
                        >
                            <Input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="At least 8 characters"
                                leadingIcon={Key}
                                hasError={Boolean(fieldErrors.newPassword)}
                                autoFocus
                            />
                        </FormField>

                        <FormField
                            label="Confirm New Password"
                            isRequired
                            errorMessage={fieldErrors.confirmPassword}
                        >
                            <Input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Re-enter new password"
                                leadingIcon={Key}
                                hasError={Boolean(fieldErrors.confirmPassword)}
                            />
                        </FormField>

                        <Button
                            type="submit"
                            variant="primary"
                            leadingIcon={CheckCircle2}
                            isLoading={isLoading}
                            className="w-full mt-1"
                        >
                            Save New Password
                        </Button>
                    </form>
                )}

                {/* Step 4: Success View */}
                {step === 'SUCCESS' && (
                    <div className="flex flex-col items-center text-center gap-4 py-2">
                        <div className="h-14 w-14 rounded-full bg-accent/10 text-accent flex items-center justify-center">
                            <CheckCircle2 className="h-7 w-7" />
                        </div>
                        <p className="text-sm text-text-muted">
                            Your password has been changed successfully. You may now sign in using your new credentials.
                        </p>
                        <Button
                            variant="primary"
                            onClick={() => navigate('/login')}
                            className="w-full"
                        >
                            Proceed to Sign In
                        </Button>
                    </div>
                )}

                {step !== 'SUCCESS' && (
                    <div className="flex items-center justify-center pt-2 border-t border-surface-border">
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Back to Sign In
                        </Link>
                    </div>
                )}
            </Card>
        </div>
    );
};
