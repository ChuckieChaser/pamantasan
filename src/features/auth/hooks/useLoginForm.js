// --- IMPORTS ---
import { useCallback, useState } from 'react';
import { useAuth } from './useAuth';
import { loginSchema } from '../authSchema';


// --- HOOK ---
export const useLoginForm = ({ onSuccess } = {}) => {
    // --- HOOKS & STATE ---
    const { handleLogin, handleGoogleLogin, isLoading, error: authError, clearError } = useAuth();

    const [universityId, setUniversityId] = useState('');
    const [password, setPassword] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- FORMATTERS ---
    const formatUniversityId = (value) => {
        // Strip out non-digits
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

    const validate = useCallback(() => {
        const result = loginSchema.safeParse({ universityId, password });
        if (!result.success) {
            const formatted = {};
            result.error.issues.forEach((issue) => {
                const path = issue.path[0];
                if (path && !formatted[path]) {
                    formatted[path] = issue.message;
                }
            });
            setFieldErrors(formatted);
            return false;
        }
        setFieldErrors({});
        return true;
    }, [universityId, password]);

    const submit = useCallback(async (event) => {
        event?.preventDefault?.();
        if (!validate()) return;

        setIsSubmitting(true);
        try {
            const user = await handleLogin({ universityId, password });
            onSuccess?.(user);
            return user;
        } finally {
            setIsSubmitting(false);
        }
    }, [validate, handleLogin, universityId, password, onSuccess]);

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
        universityId,
        password,
        fieldErrors,
        isSubmitting: isSubmitting || isLoading,
        error: authError,

        // Handlers
        handleUniversityIdChange,
        handlePasswordChange,
        submit,
        submitGoogle,
        setUniversityId,
        setPassword,
    };
};
