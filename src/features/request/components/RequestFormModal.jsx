// --- IMPORTS ---
import { FilePlus } from 'lucide-react';
import { Modal } from '../../../components/feedback/Modal';
import { FormField } from '../../../components/forms/FormField';
import { Input } from '../../../components/forms/Input';
import { useToast } from '../../../components/feedback/ToastProvider';
import { useRequestForm } from '../hooks/useRequestForm';


// --- COMPONENTS ---
export const RequestFormModal = ({
    isOpen = false,
    onClose,
    currentUserId,
}) => {
    // --- HOOKS & STATE ---
    const { toast } = useToast();

    const {
        subject,
        initialMessage,
        error,
        isSubmitting,
        setSubject,
        setInitialMessage,
        handleSubmit,
    } = useRequestForm({
        currentUserId,
        onSuccess: () => {
            toast.success('Request submitted', 'Your document request has been queued for review.');
        },
        onClose,
    });

    const onSubmit = async (event) => {
        try {
            await handleSubmit(event);
        } catch (err) {
            toast.error('Failed to submit request', err?.message, err);
        }
    };

    // --- RENDER ---
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="New Document Request"
            description="Submit an official inquiry, transcript request, or credential certificate."
            icon={FilePlus}
            confirmLabel="Submit Request"
            onConfirm={onSubmit}
            isConfirmLoading={isSubmitting}
            size="md"
        >
            <form onSubmit={onSubmit} className="flex flex-col gap-4 py-1">
                <FormField
                    label="Subject / Purpose"
                    isRequired
                    errorMessage={error}
                >
                    <Input
                        value={subject}
                        onChange={(e) => {
                            setSubject(e.target.value);
                            if (error) setError('');
                        }}
                        placeholder="e.g. Request for Official Transcript of Records (TOR)"
                        hasError={Boolean(error)}
                        autoFocus
                    />
                </FormField>

                <FormField label="Details & Purpose of Request">
                    <textarea
                        value={initialMessage}
                        onChange={(e) => setInitialMessage(e.target.value)}
                        placeholder="Provide details regarding the intended use, recipient office, or special instructions..."
                        rows={4}
                        className="w-full p-3 rounded-md border border-surface-border bg-surface hover:bg-surface-hover/60 focus:bg-surface focus:border-accent text-sm text-text placeholder:text-text-muted outline-none transition-colors resize-none"
                    />
                </FormField>
            </form>
        </Modal>
    );
};
