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
    accent:      'p-2 rounded-lg bg-accent-background text-accent shrink-0 mt-1',
    destructive: 'p-2 rounded-lg bg-error-background text-error shrink-0 mt-1',
    warning:     'p-2 rounded-lg bg-warning-background text-warning shrink-0 mt-1',
    information: 'p-2 rounded-lg bg-information-background text-information shrink-0 mt-1',
};


// --- COMPONENTS ---
const Modal = ({
    isOpen = false,
    variant = 'accent',
    size = 'md',
    title,
    description,
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

        if (modalRef.current && !modalRef.current.contains(event.target)) {
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

    const hasHeader = Boolean(title || description || icon || hasCloseButton);

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
                    className="p-6 gap-6 shadow-2xl flex flex-col animate-toast-in select-text"
                >
                    {/* MODAL HEADER */}
                    {hasHeader && (
                        <div className="flex items-start justify-between gap-4 border-b border-surface-border pb-4 shrink-0">
                            <div className="flex items-start gap-3">
                                {renderedIcon && (
                                    <div className={iconContainerStyle}>
                                        {renderedIcon}
                                    </div>
                                )}
                                <div className="flex flex-col gap-1">
                                    {title && (
                                        <h2 className="text-base font-bold text-text font-serif">
                                            {title}
                                        </h2>
                                    )}
                                    {description && (
                                        <p className="text-xs text-text-muted leading-relaxed">
                                            {description}
                                        </p>
                                    )}
                                </div>
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

                    {/* MODAL BODY */}
                    <div className="flex flex-col gap-4 text-text min-h-0 overflow-y-auto">
                        {children}
                    </div>

                    {/* MODAL FOOTER */}
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
export { Modal };
