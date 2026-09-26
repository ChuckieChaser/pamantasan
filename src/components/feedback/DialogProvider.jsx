// --- IMPORTS ---
import { createContext, useCallback, useContext, useState } from 'react';
import { Modal } from './Modal';


// --- CONTEXT ---
export const DialogContext = createContext(null);


// --- PROVIDER ---
export const DialogProvider = ({ children }) => {
    // --- HOOKS & STATE ---
    const [dialogState, setDialogState] = useState(null);

    // --- HANDLERS ---
    const closeDialog = useCallback(() => {
        setDialogState((prev) => {
            if (prev?.resolve) {
                prev.resolve(false);
            }
            return null;
        });
    }, []);

    const openDialog = useCallback((config) => {
        setDialogState({
            isOpen: true,
            ...config,
        });
    }, []);

    const confirm = useCallback(({
        title = 'Confirm Action',
        description,
        confirmLabel = 'Confirm',
        cancelLabel = 'Cancel',
        variant = 'primary',
        icon,
        size = 'sm',
    }) => {
        return new Promise((resolve) => {
            setDialogState({
                isOpen: true,
                title,
                description,
                confirmLabel,
                cancelLabel,
                variant,
                icon,
                size,
                resolve,
                onConfirm: () => {
                    resolve(true);
                    setDialogState(null);
                },
                onCancel: () => {
                    resolve(false);
                    setDialogState(null);
                },
                onClose: () => {
                    resolve(false);
                    setDialogState(null);
                },
            });
        });
    }, []);

    const alert = useCallback(({
        title = 'Notice',
        description,
        confirmLabel = 'Understood',
        variant = 'info',
        icon,
        size = 'sm',
    }) => {
        return new Promise((resolve) => {
            setDialogState({
                isOpen: true,
                title,
                description,
                confirmLabel,
                cancelLabel: null,
                variant,
                icon,
                size,
                resolve,
                onConfirm: () => {
                    resolve(true);
                    setDialogState(null);
                },
                onClose: () => {
                    resolve(true);
                    setDialogState(null);
                },
            });
        });
    }, []);

    // --- CONTEXT VALUE ---
    const contextValue = {
        openDialog,
        closeDialog,
        confirm,
        alert,
    };

    // --- RENDER ---
    return (
        <DialogContext.Provider value={contextValue}>
            {children}

            {dialogState && (
                <Modal
                    isOpen={dialogState.isOpen}
                    onClose={dialogState.onClose ?? closeDialog}
                    title={dialogState.title}
                    description={dialogState.description}
                    icon={dialogState.icon}
                    variant={dialogState.variant}
                    size={dialogState.size}
                    confirmLabel={dialogState.confirmLabel}
                    cancelLabel={dialogState.cancelLabel}
                    onConfirm={dialogState.onConfirm}
                    onCancel={dialogState.onCancel}
                    isConfirmLoading={dialogState.isConfirmLoading}
                    isConfirmDisabled={dialogState.isConfirmDisabled}
                >
                    {dialogState.content ?? dialogState.children}
                </Modal>
            )}
        </DialogContext.Provider>
    );
};


// --- HOOK ---
export const useDialog = () => {
    const context = useContext(DialogContext);

    if (!context) {
        throw new Error('useDialog must be used within a DialogProvider');
    }

    return context;
};
