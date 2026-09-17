// --- IMPORTS ---
import { isValidElement, useRef } from 'react';
import { X } from 'lucide-react';
import { useKeyPress } from '../hooks';
import { Button } from './Button';
import { Container } from './Container';
import { renderIcon } from './common';


// --- CONFIGURATIONS ---
const ICON_STYLE = 'h-5 w-5 shrink-0';
const CLOSE_ICON_STYLE = 'h-4 w-4 shrink-0';

const BASE_BACKDROP_STYLE = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto select-none';

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
    onConfirm = null,
    onCancel = null,
    onClose,
    className,
    children,
    ...props
}) => {
    // REFS
    const modalRef = useRef(null);

    // HOOKS
    useKeyPress('Escape', (event) => {
        if (isOpen) {
            onClose?.(event);
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
            onClose?.(event);
        }
    };

    const handleCloseClick = (event) => {
        onClose?.(event);
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
        onClick: onCancel ?? onClose,
        variant: 'secondary',
    } : null);

    const hasFooter = Boolean(actions || effectivePrimaryAction || effectiveSecondaryAction);
    const renderedIcon = renderIcon(icon, ICON_STYLE);

    // RENDER
    return (
        <div
            onClick={handleBackdropClick}
            onDragOver={(event) => {
                event.stopPropagation();
            }}
            onDrop={(event) => {
                event.stopPropagation();
            }}
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
                    className="p-6 gap-5 shadow-2xl flex flex-col animate-toast-in select-text"
                >
                    {/* MODAL HEADER: [ icon ] [ header ] */}
                    {hasHeader && (
                        <div className="flex items-center justify-between gap-4 border-b border-surface-border pb-4 shrink-0">
                            <div className="flex items-center gap-3">
                                {renderedIcon && (
                                    <div className={iconContainerStyle}>
                                        {renderedIcon}
                                    </div>
                                )}
                                {title && (
                                    <h2 className="text-base font-bold text-text font-serif">
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
                    <div className="flex flex-col gap-3.5 text-text min-h-0 overflow-y-auto">
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
                        <div className="flex items-center justify-end gap-3 border-t border-surface-border pt-4 shrink-0">
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
                                            />
                                        )
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </Container>
            </div>
        </div>
    );
};


// --- EXPORTS ---
export { Modal, ModalCallout };

