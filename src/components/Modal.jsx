// --- IMPORTS ---
import { isValidElement, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';
import { useKeyPress } from '../hooks';
import { Button } from './Button';
import { Container } from './Container';
import { renderIcon } from './common';


// --- CONFIGURATIONS ---
const ICON_STYLE = 'h-5 w-5 shrink-0';
const CLOSE_ICON_STYLE = 'h-4 w-4 shrink-0';

const BASE_BACKDROP_STYLE = 'fixed inset-0 bg-black/60 backdrop-blur-xs z-[50000] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto select-none';

const SIZE_STYLE = {
    sm:   'max-w-md',
    md:   'max-w-lg',
    lg:   'max-w-2xl',
    xl:   'max-w-4xl',
    full: 'max-w-5xl',
};

const ICON_CONTAINER_STYLE = {
    accent:      'p-2 rounded-lg bg-accent-background text-accent shrink-0',
    destructive: 'p-2 rounded-lg bg-error-background text-error shrink-0',
    warning:     'p-2 rounded-lg bg-warning-background text-warning shrink-0',
    information: 'p-2 rounded-lg bg-information-background text-information shrink-0',
};

const CALLOUT_CONTAINER_STYLE = {
    accent:      'bg-accent-background border-accent-border text-accent',
    destructive: 'bg-error-background border-error-border text-error',
    warning:     'bg-warning-background border-warning-border text-warning',
    information: 'bg-information-background border-information-border text-information',
    neutral:     'bg-surface-hover border-surface-border text-text-muted',
};

// HELPER: DETECT DIRTY/MODIFIED FORM VALUES AGAINST INITIAL CAPTURE
const checkHasDirtyFields = (container) => {
    if (!container) return false;
    const inputs = container.querySelectorAll(
        'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), textarea'
    );
    for (const input of inputs) {
        if (input.disabled || input.readOnly) continue;
        if (input.type === 'file') {
            if (input.files && input.files.length > 0) return true;
        } else {
            const currentVal = typeof input.value === 'string' ? input.value : '';
            const initialVal = input.dataset.initialValue;
            if (initialVal !== undefined) {
                // If initial value was recorded, dirty only if value actually changed
                if (currentVal !== initialVal) {
                    return true;
                }
            } else if (currentVal.trim().length > 0) {
                // Fallback for inputs without snapshot: dirty if non-empty
                return true;
            }
        }
    }
    return false;
};


// --- COMPONENTS ---
const ModalCallout = ({
    variant = 'neutral',
    className = '',
    children,
    ...props
}) => {
    const variantStyle = CALLOUT_CONTAINER_STYLE[variant] ?? CALLOUT_CONTAINER_STYLE.neutral;

    return (
        <div
            className={`p-3 rounded-md border text-xs leading-relaxed select-text ${variantStyle} ${className}`.trim()}
            {...props}
        >
            {children}
        </div>
    );
};

const Modal = ({
    isOpen = false,
    variant = 'accent',
    size = 'md',
    title,
    description,
    callout = null,
    calloutVariant = null,
    icon,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    primaryAction = null,
    secondaryAction = null,
    actions = null,
    isConfirmLoading = false,
    isConfirmDisabled = false,
    hasCloseButton = true,
    shouldCloseOnBackdrop = true,
    confirmOnClose = true,
    isDirty = undefined,
    onConfirm = null,
    onCancel = null,
    onClose,
    className,
    children,
    ...props
}) => {
    // REFS
    const modalRef = useRef(null);

    // STATES: CONFIRM EXIT IF DIRTY
    const [isConfirmCloseOpen, setIsConfirmCloseOpen] = useState(false);

    // EFFECTS: CAPTURE INITIAL VALUES FOR DIRTY TRACKING & DISMISS DANGLING DROPDOWNS
    useEffect(() => {
        if (!isOpen) {
            setIsConfirmCloseOpen(false);
            return;
        }

        // Dismiss any dangling select/combo dropdowns in the page behind the modal
        if (typeof document !== 'undefined') {
            document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        }

        const snapshotInitialValues = () => {
            if (!modalRef.current) return;
            const inputs = modalRef.current.querySelectorAll(
                'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), textarea'
            );
            inputs.forEach((input) => {
                if (input.dataset.initialValue === undefined) {
                    input.dataset.initialValue = input.value ?? '';
                }
            });
        };

        const timer1 = setTimeout(snapshotInitialValues, 30);
        const timer2 = setTimeout(snapshotInitialValues, 100);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, [isOpen]);

    const handleFocusCapture = (event) => {
        const target = event.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
            if (target.dataset.initialValue === undefined) {
                target.dataset.initialValue = target.value ?? '';
            }
        }
    };

    // DERIVED DIRTY CHECK
    const isFormDirty = () => {
        if (confirmOnClose === false) return false;
        if (isDirty !== undefined) return Boolean(isDirty);
        return checkHasDirtyFields(modalRef.current);
    };

    // HANDLER: SAFE CLOSE CHECK
    const handleAttemptClose = (event) => {
        if (isFormDirty()) {
            setIsConfirmCloseOpen(true);
            return;
        }
        setIsConfirmCloseOpen(false);
        onClose?.(event);
    };

    // HOOKS
    useKeyPress('Escape', (event) => {
        if (isOpen) {
            if (isConfirmCloseOpen) {
                setIsConfirmCloseOpen(false);
            } else {
                handleAttemptClose(event);
            }
        }
    });

    // GUARD CLAUSES
    if (!isOpen) {
        return null;
    }

    // HANDLERS
    const handleBackdropClick = (event) => {
        if (!shouldCloseOnBackdrop) {
            return;
        }

        if (event.target === event.currentTarget) {
            handleAttemptClose(event);
        }
    };

    const handleCloseClick = (event) => {
        handleAttemptClose(event);
    };

    // DERIVED VALUES
    const sizeStyle = SIZE_STYLE[size] ?? SIZE_STYLE.md;
    const isDestructive = variant === 'destructive' || primaryAction?.variant === 'destructive';
    const iconContainerStyle = isDestructive
        ? ICON_CONTAINER_STYLE.destructive
        : (ICON_CONTAINER_STYLE[variant] ?? ICON_CONTAINER_STYLE.accent);

    const effectiveCalloutVariant = calloutVariant ?? (isDestructive ? 'destructive' : variant);

    const hasHeader = Boolean(title || icon || hasCloseButton);

    const effectivePrimaryAction = primaryAction ?? (onConfirm ? {
        label:       confirmLabel,
        onClick:     onConfirm,
        isLoading:   isConfirmLoading,
        isDisabled:  isConfirmDisabled,
        variant:     isDestructive ? 'destructive' : 'primary',
    } : null);

    const effectiveSecondaryAction = secondaryAction ?? (onClose || onCancel ? {
        label:   cancelLabel,
        onClick: (event) => {
            if (onCancel) {
                if (isFormDirty()) {
                    setIsConfirmCloseOpen(true);
                    return;
                }
                onCancel(event);
            } else {
                handleAttemptClose(event);
            }
        },
        variant: 'secondary',
    } : null);

    const hasFooter = Boolean(actions || effectivePrimaryAction || effectiveSecondaryAction);
    const renderedIcon = renderIcon(icon, ICON_STYLE);

    // MODAL DIALOG ELEMENT
    const modalElement = (
        <div
            onClick={handleBackdropClick}
            onDragOver={(event) => {
                event.stopPropagation();
            }}
            onDrop={(event) => {
                event.stopPropagation();
            }}
            onFocusCapture={handleFocusCapture}
            className={BASE_BACKDROP_STYLE}
            role="dialog"
            aria-modal="true"
            {...props}
        >
            <div
                ref={modalRef}
                className={`w-full ${sizeStyle} ${className ?? ''}`.trim()}
            >
                <Container
                    variant="panel"
                    className="relative z-[50001] p-3.5 sm:p-5 gap-3 sm:gap-4 shadow-2xl flex flex-col select-text max-h-[90vh] sm:max-h-[85vh] rounded-t-2xl sm:rounded-xl overflow-hidden"
                >
                    {/* MOBILE DRAG HANDLE BAR */}
                    <div className="w-10 h-1 rounded-full bg-surface-border mx-auto -mt-1 mb-1 sm:hidden shrink-0" />

                    {/* MODAL HEADER: [ icon ] [ header ] */}
                    {hasHeader && (
                        <div className="flex items-center justify-between gap-3 border-b border-surface-border pb-2.5 sm:pb-3 shrink-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                                {renderedIcon && (
                                    <div className={iconContainerStyle}>
                                        {renderedIcon}
                                    </div>
                                )}
                                {title && (
                                    <h2 className="text-sm sm:text-base font-bold text-text font-serif truncate">
                                        {title}
                                    </h2>
                                )}
                            </div>

                            {hasCloseButton && (
                                <button
                                    type="button"
                                    onClick={handleCloseClick}
                                    className="h-7 w-7 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
                                    title="Close modal"
                                    aria-label="Close modal"
                                >
                                    <X className={CLOSE_ICON_STYLE} />
                                </button>
                            )}
                        </div>
                    )}

                    {/* MODAL BODY: [ message ] -> [ optional semantically colored variant box ] -> children */}
                    <div className="flex flex-col gap-2.5 sm:gap-3 text-text min-h-0 overflow-y-auto">
                        {description && (
                            <p className="text-xs text-text-muted leading-relaxed">
                                {description}
                            </p>
                        )}

                        {callout && (
                            <ModalCallout variant={effectiveCalloutVariant}>
                                {callout}
                            </ModalCallout>
                        )}

                        {children}
                    </div>

                    {/* MODAL FOOTER: [ actions 1 ] [ action 2 ] ... (right aligned) */}
                    {hasFooter && (
                        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 border-t border-surface-border pt-2.5 sm:pt-3 shrink-0">
                            {actions ? (
                                actions
                            ) : (
                                <>
                                    {effectiveSecondaryAction && (
                                        isValidElement(effectiveSecondaryAction) ? (
                                            effectiveSecondaryAction
                                        ) : (
                                            <Button
                                                variant={effectiveSecondaryAction.variant ?? 'secondary'}
                                                onClick={effectiveSecondaryAction.onClick}
                                                isDisabled={effectiveSecondaryAction.isDisabled ?? effectiveSecondaryAction.disabled}
                                                leadingIcon={effectiveSecondaryAction.leadingIcon}
                                                label={effectiveSecondaryAction.label ?? 'Cancel'}
                                                className="w-full sm:w-auto"
                                            />
                                        )
                                    )}
                                    {effectivePrimaryAction && (
                                        isValidElement(effectivePrimaryAction) ? (
                                            effectivePrimaryAction
                                        ) : (
                                            <Button
                                                variant={effectivePrimaryAction.variant ?? (isDestructive ? 'destructive' : 'primary')}
                                                onClick={effectivePrimaryAction.onClick}
                                                isDisabled={effectivePrimaryAction.isDisabled ?? effectivePrimaryAction.disabled}
                                                isLoading={effectivePrimaryAction.isLoading ?? effectivePrimaryAction.loading}
                                                leadingIcon={effectivePrimaryAction.leadingIcon}
                                                label={effectivePrimaryAction.label ?? 'Confirm'}
                                                className="w-full sm:w-auto"
                                            />
                                        )
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* CONFIRM DISCARD MODAL OVERLAY */}
                    {isConfirmCloseOpen && (
                        <div className="absolute inset-0 bg-background/85 backdrop-blur-xs z-[50002] rounded-xl flex items-center justify-center p-4 animate-fade-in select-none">
                            <div className="bg-surface border border-surface-border rounded-xl p-5 shadow-2xl max-w-sm w-full flex flex-col gap-3.5 text-center">
                                <div className="mx-auto p-2.5 rounded-full bg-warning-background text-warning w-fit">
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <h4 className="text-sm font-bold text-text">Discard Unsaved Changes?</h4>
                                    <p className="text-xs text-text-muted leading-relaxed">
                                        You have entered information in this form. If you close now, your changes will be discarded.
                                    </p>
                                </div>
                                <div className="flex items-center justify-center gap-2 pt-1.5">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setIsConfirmCloseOpen(false)}
                                        label="Keep Editing"
                                    />
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => {
                                            setIsConfirmCloseOpen(false);
                                            onClose?.();
                                        }}
                                        label="Discard & Close"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </Container>
            </div>
        </div>
    );

    // PORTAL TO BODY SO MODAL IS NEVER TRAPPED UNDER SIBLINGS OR OVERFLOW CONTAINERS
    if (typeof document !== 'undefined') {
        return createPortal(modalElement, document.body);
    }

    return modalElement;
};


// --- EXPORTS ---
export { Modal, ModalCallout };


