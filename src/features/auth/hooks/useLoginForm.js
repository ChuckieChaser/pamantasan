// --- IMPORTS ---
import { useCallback, useState } from 'react';
import { useAuth } from './useAuth';
import { LoginSchema, OtpSchema } from '../authSchema';
import { AUTH_STEP } from '../authConstants';


// --- HOOK ---
export const useLoginForm = ({ onSuccess } = {}) => {
    // --- HOOKS & STATE ---
    const { handleLogin, handleGoogleLogin, isLoading, error: authError, clearError } = useAuth();

    const [step, setStep] = useState(AUTH_STEP.CREDENTIALS);
    const [universityId, setUniversityId] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [stepUpToken, setStepUpToken] = useState(null);
    const [maskedEmail, setMaskedEmail] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- FORMATTERS ---
    const formatUniversityId = (value) => {
        const digits = value.replace(/\D/g, '');
        if (digits.length <= 4) return digits;
        if (digits.length <= 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
        return `${digits.slice(0, 4)}-${digits.slice(4, 9)}`;
    };

    // --- HANDLERS ---
    const handleUniversityIdChange = useCallback((valueOrEvent) => {
        const value = typeof valueOrEvent === 'string' ? valueOrEvent : valueOrEvent?.target?.value ?? '';
        setUniversityId(formatUniversityId(value));
        setFieldErrors((prev) => ({ ...prev, universityId: undefined }));
        clearError();
    }, [clearError]);

    const handlePasswordChange = useCallback((valueOrEvent) => {
        const value = typeof valueOrEvent === 'string' ? valueOrEvent : valueOrEvent?.target?.value ?? '';
        setPassword(value);
        setFieldErrors((prev) => ({ ...prev, password: undefined }));
        clearError();
    }, [clearError]);

    const handleOtpChange = useCallback((valueOrEvent) => {
        const value = typeof valueOrEvent === 'string' ? valueOrEvent : valueOrEvent?.target?.value ?? '';
        const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
        setOtp(digitsOnly);
        setFieldErrors((prev) => ({ ...prev, otp: undefined }));
        clearError();
    }, [clearError]);

    const handleBackToCredentials = useCallback(() => {
        setStep(AUTH_STEP.CREDENTIALS);
        setOtp('');
        setStepUpToken(null);
        setFieldErrors({});
        clearError();
    }, [clearError]);

    const validateCredentials = useCallback(() => {
        const result = LoginSchema.safeParse({ identifier: universityId, password });
        if (!result.success) {
            const formatted = {};
            result.error.issues.forEach((issue) => {
                const path = issue.path[0];
                const key = path === 'identifier' ? 'universityId' : path;
                if (key && !formatted[key]) {
                    formatted[key] = issue.message;
                }
            });
            setFieldErrors(formatted);
            return false;
        }
        setFieldErrors({});
        return true;
    }, [universityId, password]);

    const validateOtp = useCallback(() => {
        const result = OtpSchema.safeParse(otp);
        if (!result.success) {
            setFieldErrors({ otp: result.error.issues[0]?.message ?? 'Invalid verification code' });
            return false;
        }
        setFieldErrors({});
        return true;
    }, [otp]);

    const submit = useCallback(async (event) => {
        event?.preventDefault?.();

        if (step === AUTH_STEP.CREDENTIALS) {
            if (!validateCredentials()) return;

            setIsSubmitting(true);
            try {
                const result = await handleLogin({ universityId, password });
                if (result?.requiresStepUp) {
                    setStepUpToken(result.token);
                    setMaskedEmail(result.maskedEmail ?? '');
                    setStep(AUTH_STEP.OTP);
                    return result;
                }

                onSuccess?.(result);
                return result;
            } finally {
                setIsSubmitting(false);
            }
        }

        if (step === AUTH_STEP.OTP) {
            if (!validateOtp()) return;

            setIsSubmitting(true);
            try {
                const user = await handleLogin({
                    universityId,
                    password,
                    otp,
                    token: stepUpToken,
                });
                onSuccess?.(user);
                return user;
            } finally {
                setIsSubmitting(false);
            }
        }
    }, [step, validateCredentials, validateOtp, handleLogin, universityId, password, otp, stepUpToken, onSuccess]);

    const submitGoogle = useCallback(async () => {
        setIsSubmitting(true);
        try {
            const user = await handleGoogleLogin();
            onSuccess?.(user);
            return user;
        } finally {
            setIsSubmitting(false);
        }
    }, [handleGoogleLogin, onSuccess]);

    return {
        // State
        step,
        universityId,
        password,
        otp,
        maskedEmail,
        fieldErrors,
        isSubmitting: isSubmitting || isLoading,
        error: authError,

        // Handlers
        handleUniversityIdChange,
        handlePasswordChange,
        handleOtpChange,
        handleBackToCredentials,
        submit,
        submitGoogle,
        setUniversityId,
        setPassword,
        setOtp,
    };
};
