// --- IMPORTS ---
import { Lock, LogIn, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormField } from '../components/forms/FormField';
import { Input } from '../components/forms/Input';
import { useToast } from '../components/feedback/ToastProvider';
import { useLoginForm } from '../features/auth/hooks/useLoginForm';
import backgroundImage from '../assets/background.jpg';
import logoImage from '../assets/logo.jpg';


// --- COMPONENTS ---
const GoogleIcon = ({ className = 'h-4 w-4 shrink-0' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
    </svg>
);

export const LoginPage = () => {
    const navigate = useNavigate();
    const { toast } = useToast();

    const {
        universityId,
        password,
        fieldErrors,
        isSubmitting,
        error: authError,
        handleUniversityIdChange,
        handlePasswordChange,
        submit,
        submitGoogle,
    } = useLoginForm({
        onSuccess: (user) => {
            toast.success('Signed in', `Welcome back, ${user?.givenName || 'Colleague'}!`);
            navigate('/dashboard');
        },
    });

    const onSubmit = async (e) => {
        e?.preventDefault?.();
        try {
            await submit(e);
        } catch (err) {
            toast.error('Authentication failed', err?.message || 'Invalid university credentials.', err);
        }
    };

    const onGoogleSubmit = async () => {
        try {
            await submitGoogle();
        } catch (err) {
            toast.error('Google Sign-In failed', err?.message || 'Could not authenticate via Google.', err);
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

            {/* Login Card */}
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
                            Pamantasan EDMS
                        </h1>
                        <p className="text-xs text-text-muted mt-1">
                            Electronic Document Management System
                        </p>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={onSubmit} className="flex flex-col gap-4">
                    <FormField
                        label="University ID"
                        isRequired
                        errorMessage={fieldErrors.universityId}
                    >
                        <Input
                            value={universityId}
                            onChange={handleUniversityIdChange}
                            placeholder="e.g. 2024-00001"
                            leadingIcon={User}
                            hasError={Boolean(fieldErrors.universityId)}
                            autoFocus
                        />
                    </FormField>

                    <FormField
                        label="Password"
                        isRequired
                        errorMessage={fieldErrors.password}
                    >
                        <Input
                            type="password"
                            value={password}
                            onChange={handlePasswordChange}
                            placeholder="Enter account password"
                            leadingIcon={Lock}
                            hasError={Boolean(fieldErrors.password)}
                        />
                    </FormField>

                    <div className="flex items-center justify-end -mt-1">
                        <Link
                            to="/forgot-password"
                            className="text-xs text-accent hover:underline focus:outline-none focus:ring-1 focus:ring-accent rounded"
                        >
                            Forgot password?
                        </Link>
                    </div>

                    <Button
                        type="submit"
                        variant="primary"
                        leadingIcon={LogIn}
                        isLoading={isSubmitting}
                        className="w-full mt-1"
                    >
                        Sign In
                    </Button>
                </form>

                <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-surface-border" />
                    </div>
                    <span className="relative bg-surface px-3 text-[11px] font-medium text-text-muted uppercase tracking-wider">
                        Or continue with
                    </span>
                </div>

                <Button
                    variant="secondary"
                    leadingIcon={GoogleIcon}
                    onClick={onGoogleSubmit}
                    isLoading={isSubmitting}
                    className="w-full"
                >
                    Sign in with Google
                </Button>
            </Card>
        </div>
    );
};
