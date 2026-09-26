// --- IMPORTS ---
import { useState } from 'react';
import { ArrowRight, CheckCircle2, Key, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormField } from '../components/forms/FormField';
import { Input } from '../components/forms/Input';
import { useToast } from '../components/feedback/ToastProvider';
import { useAuth } from '../features/auth/hooks/useAuth';
import backgroundImage from '../assets/background.jpg';
import logoImage from '../assets/logo.jpg';


// --- COMPONENTS ---
export const OnboardingPage = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { currentUser, handleChangePassword, handleLinkGoogle } = useAuth();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e?.preventDefault?.();
        const errs = {};
        if (!currentPassword) errs.currentPassword = 'Temporary password is required.';
        if (newPassword.length < 8) errs.newPassword = 'New password must be at least 8 characters.';
        if (newPassword !== confirmPassword) errs.confirmPassword = 'Passwords do not match.';

        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }

        setIsLoading(true);
        setErrors({});
        try {
            await handleChangePassword({
                currentPassword,
                newPassword,
            });
            toast.success('Onboarding complete', 'Your permanent password has been set.');
            navigate('/dashboard');
        } catch (err) {
            toast.error('Setup failed', err?.message || 'Could not update password.', err);
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

            <Card className="relative z-10 max-w-md w-full p-6 sm:p-8 flex flex-col gap-6 shadow-2xl bg-surface/95 backdrop-blur-md border-surface-border">
                <div className="flex flex-col items-center text-center gap-3">
                    <img
                        src={logoImage}
                        alt="Pamantasan Logo"
                        className="h-12 w-12 rounded-xl object-cover ring-2 ring-accent/30 shadow-md"
                    />
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-text">
                            Account Onboarding
                        </h1>
                        <p className="text-xs text-text-muted mt-1">
                            Welcome, {currentUser?.givenName || 'Colleague'}. Please initialize your permanent credentials to activate your account.
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <FormField
                        label="Temporary Password"
                        isRequired
                        errorMessage={errors.currentPassword}
                    >
                        <Input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Enter temporary password"
                            leadingIcon={Key}
                            hasError={Boolean(errors.currentPassword)}
                            autoFocus
                        />
                    </FormField>

                    <FormField
                        label="New Permanent Password"
                        isRequired
                        errorMessage={errors.newPassword}
                    >
                        <Input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="At least 8 characters"
                            leadingIcon={ShieldCheck}
                            hasError={Boolean(errors.newPassword)}
                        />
                    </FormField>

                    <FormField
                        label="Confirm Permanent Password"
                        isRequired
                        errorMessage={errors.confirmPassword}
                    >
                        <Input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                            leadingIcon={CheckCircle2}
                            hasError={Boolean(errors.confirmPassword)}
                        />
                    </FormField>

                    <Button
                        type="submit"
                        variant="primary"
                        leadingIcon={ArrowRight}
                        isLoading={isLoading}
                        className="w-full mt-2"
                    >
                        Complete Onboarding
                    </Button>
                </form>
            </Card>
        </div>
    );
};
