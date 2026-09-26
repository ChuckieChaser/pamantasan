// --- IMPORTS ---
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';


// --- CONFIGURATIONS ---
const BACKDROP_STYLE = 'fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 select-none';

const DIALOG_BASE_STYLE = 'w-full bg-surface border-surface-border flex flex-col overflow-hidden text-text select-text transition-all duration-200 max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:border-t max-sm:max-h-[92vh] max-sm:animate-in max-sm:slide-in-from-bottom sm:rounded-xl sm:border sm:shadow-xl sm:animate-in sm:zoom-in-95';

const SIZE_STYLE = {
    sm:   'sm:max-w-sm',
    md:   'sm:max-w-md',
    lg:   'sm:max-w-xl',
    xl:   'sm:max-w-3xl',
    full: 'sm:max-w-5xl sm:h-[85vh]',
};

const VARIANT_ICON_STYLE = {
    primary:     'bg-accent-background text-accent',
    destructive: 'bg-error-background text-error',
    warning:     'bg-warning-background text-warning',
    info:        'bg-information-background text-information',
};


// --- COMPONENTS ---
export const Modal = ({
    isOpen = false,
    onClose,
    title,
    description,
    icon: Icon,
    variant = 'primary',
    size = 'md',
    confirmLabel,
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel,
    isConfirmLoading = false,
    isConfirmDisabled = false,
    hasCloseButton = true,
    shouldCloseOnBackdrop = true,
    children,
    footerActions,
    className = '',
    ...props
}) => {
    // --- REFS ---
    const dialogRef = useRef(null);

    // --- HOOKS & EFFECTS ---
    useEffect(() => {
        if (!isOpen) return;

        // Lock background body scroll
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        // Escape key listener
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose?.();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    // Guard: Do not render when closed
    if (!isOpen) {
        return null;
    }

    // --- HANDLERS ---
    const handleBackdropClick = (event) => {
        if (shouldCloseOnBackdrop && event.target === event.currentTarget) {
            onClose?.();
        }
    };

    const handleCancel = (event) => {
        if (onCancel) {
            onCancel(event);
        } else {
            onClose?.(event);
        }
    };

    const handleConfirm = (event) => {
        onConfirm?.(event);
    };

    // --- DERIVED VALUES ---
    const sizeStyle = SIZE_STYLE[size] ?? SIZE_STYLE.md;
    const composedDialogClassName = `${DIALOG_BASE_STYLE} ${sizeStyle} ${className}`.trim();
    const iconContainerStyle = VARIANT_ICON_STYLE[variant] ?? VARIANT_ICON_STYLE.primary;
    const buttonVariant = variant === 'destructive' ? 'destructive' : 'primary';

    // --- RENDER ---
    return createPortal(
        <div
            onClick={handleBackdropClick}
            className={BACKDROP_STYLE}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
            aria-describedby={description ? 'modal-description' : undefined}
            {...props}
        >
            <div
                ref={dialogRef}
                className={composedDialogClassName}
            >
                {/* Mobile Drag Indicator Handle */}
                <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
                    <span className="h-1 w-10 rounded-full bg-surface-border" />
                </div>

                {/* Header */}
                {(title || hasCloseButton) && (
                    <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-b border-surface-border flex items-start justify-between gap-3 shrink-0">
                        <div className="flex items-start gap-3 min-w-0">
                            {Icon && (
                                <div className={`p-2 rounded-lg shrink-0 ${iconContainerStyle}`}>
                                    {typeof Icon === 'function' ? <Icon className="h-5 w-5" /> : Icon}
                                </div>
                            )}

                            <div className="flex flex-col min-w-0">
                                {title && (
                                    <h2
                                        id="modal-title"
                                        className="text-base font-semibold text-text truncate"
                                    >
                                        {title}
                                    </h2>
                                )}
                                {description && (
                                    <p
                                        id="modal-description"
                                        className="text-xs text-text-muted mt-0.5"
                                    >
                                        {description}
                                    </p>
                                )}
                            </div>
                        </div>

                        {hasCloseButton && (
                            <button
                                type="button"
                                aria-label="Close dialog"
                                onClick={onClose}
                                className="h-8 w-8 p-1.5 -mr-1.5 -mt-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover inline-flex items-center justify-center transition-colors cursor-pointer touch-manipulation"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                )}

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5 text-sm text-text">
                    {children}
                </div>

                {/* Footer Actions */}
                {(confirmLabel || cancelLabel || footerActions) && (
                    <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-t border-surface-border bg-surface-hover/30 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 shrink-0">
                        {footerActions ? (
                            footerActions
                        ) : (
                            <>
                                {cancelLabel && (
                                    <Button
                                        variant="secondary"
                                        label={cancelLabel}
                                        onClick={handleCancel}
                                        isDisabled={isConfirmLoading}
                                        className="w-full sm:w-auto"
                                    />
                                )}
                                {confirmLabel && (
                                    <Button
                                        variant={buttonVariant}
                                        label={confirmLabel}
                                        onClick={handleConfirm}
                                        isLoading={isConfirmLoading}
                                        isDisabled={isConfirmDisabled}
                                        className="w-full sm:w-auto"
                                    />
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
