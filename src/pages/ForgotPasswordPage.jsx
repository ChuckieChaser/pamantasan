// --- IMPORTS ---
import { useState } from 'react';
import {
    Mail,
    ArrowRight,
    CheckCircle2,
} from 'lucide-react';
import { AuthLayout } from '../layouts';
import {
    Button,
    TextField,
} from '../components';
import { useToast } from '../hooks';
import { constants } from '../constants';

// --- COMPONENTS ---
const ForgotPasswordPage = ({
    onBackToLogin,
    onResetRequested,
}) => {
    // STATES
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    // HOOKS
    const { showToast } = useToast();

    // HANDLERS
    const handleEmailChange = (event) => {
        setEmail(event.target.value);
        if (emailError) {
            setEmailError('');
        }
    };

    const handleFormSubmit = async (event) => {
        event.preventDefault();

        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            setEmailError('Institutional email is required.');
            return;
        }

        if (!constants.VALIDATION_PATTERNS.EMAIL.test(trimmedEmail)) {
            setEmailError('Enter a valid institutional email address (e.g. name@plpasig.edu.ph).');
            return;
        }

        setIsSubmitting(true);

        try {
            if (onResetRequested) {
                await onResetRequested(trimmedEmail);
            } else {
                await new Promise((resolve) => setTimeout(resolve, 800));
            }

            setIsSubmitted(true);
            showToast({
                title: 'Recovery Email Sent',
                description: `Password reset instructions sent to ${trimmedEmail}.`,
                variant: 'success',
            });
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to send password recovery instructions.';
            setEmailError(errorMessage);
            showToast({
                title: 'Recovery Request Failed',
                description: errorMessage,
                variant: 'error',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBackClick = (event) => {
        onBackToLogin?.(event);
    };

    // RENDER: SUBMITTED SUCCESS STATE
    if (isSubmitted) {
        return (
            <AuthLayout
                title="Check Your Email"
                description={`Password reset link has been dispatched to ${email}.`}
                onBack={handleBackClick}
                backButtonLabel="Back to sign in"
            >
                <div className="flex flex-col items-center gap-4 text-center py-2">
                    <div className="h-12 w-12 rounded-full bg-accent-background border border-accent-border flex items-center justify-center text-accent">
                        <CheckCircle2 className="h-6 w-6" />
                    </div>

                    <p className="text-xs text-text-muted leading-relaxed">
                        Please check your inbox at <span className="font-semibold text-text">{email}</span> and follow the instructions to securely reset your password.
                    </p>

                    <Button
                        variant="primary"
                        label="Return to Sign In"
                        onClick={handleBackClick}
                        className="w-full mt-2"
                    />
                </div>
            </AuthLayout>
        );
    }

    // RENDER: INITIAL REQUEST FORM
    return (
        <AuthLayout
            title="Reset Password"
            description="Enter your registered institutional email to receive password reset instructions."
            onBack={handleBackClick}
            backButtonLabel="Back to sign in"
        >
            <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
                <TextField
                    label="Institutional Email"
                    placeholder="name@plpasig.edu.ph"
                    value={email}
                    onChange={handleEmailChange}
                    error={emailError}
                    leadingIcon={Mail}
                    type="email"
                    autoComplete="email"
                    required
                />

                <Button
                    type="submit"
                    variant="primary"
                    label={isSubmitting ? 'Sending Request...' : 'Send Recovery Instructions'}
                    leadingIcon={ArrowRight}
                    isLoading={isSubmitting}
                    className="w-full mt-2"
                />

                <Button
                    variant="secondary"
                    label="Cancel and Sign In"
                    onClick={handleBackClick}
                    className="w-full justify-center"
                />
            </form>
        </AuthLayout>
    );
};

// --- EXPORTS ---
export { ForgotPasswordPage };
export default ForgotPasswordPage;
