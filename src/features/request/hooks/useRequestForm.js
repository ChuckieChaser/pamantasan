// --- IMPORTS ---
import { useCallback, useState } from 'react';
import { useRequest } from './useRequest';


// --- HOOK ---
export const useRequestForm = ({
    currentUserId,
    onSuccess,
    onClose,
} = {}) => {
    // --- HOOKS & STATE ---
    const { handleCreateRequest, handleCreateMessage, isMutating } = useRequest();

    const [subject, setSubject] = useState('');
    const [initialMessage, setInitialMessage] = useState('');
    const [error, setError] = useState('');

    const validate = useCallback(() => {
        if (!subject.trim()) {
            setError('Request subject is required');
            return false;
        }
        setError('');
        return true;
    }, [subject]);

    const handleSubmit = useCallback(async (event) => {
        event?.preventDefault?.();
        if (!validate()) return;

        const requestId = crypto.randomUUID();

        // 1. Create the request record
        const request = await handleCreateRequest({
            id: requestId,
            requesterId: currentUserId,
            subject: subject.trim(),
        });

        // 2. If initial message provided, create first message entry
        if (initialMessage.trim()) {
            await handleCreateMessage({
                id: crypto.randomUUID(),
                requestId: requestId,
                userId: currentUserId,
                message: initialMessage.trim(),
            });
        }

        setSubject('');
        setInitialMessage('');
        setError('');
        onSuccess?.(request);
        onClose?.();
        return request;
    }, [validate, handleCreateRequest, currentUserId, subject, initialMessage, handleCreateMessage, onSuccess, onClose]);

    const resetForm = useCallback(() => {
        setSubject('');
        setInitialMessage('');
        setError('');
    }, []);

    return {
        // State
        subject,
        initialMessage,
        error,
        isSubmitting: isMutating,

        // Mutators
        setSubject,
        setInitialMessage,
        setError,

        // Handlers
        handleSubmit,
        resetForm,
    };
};
