// --- IMPORTS ---
import { useEffect, useRef, cloneElement, isValidElement } from 'react';
import { X } from 'lucide-react';
import { CardContainer } from './Container';
import { PrimaryButton, SecondaryButton, DestructiveButton } from './Button';

// --- CONFIGURATIONS ---
const ICON_STYLE = 'h-5 w-5 shrink-0';
const CLOSE_ICON_STYLE = 'h-4 w-4 shrink-0';

const BASE_BACKDROP_STYLE = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto select-none';

const SIZE_STYLE = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-5xl',
};

const ICON_CONTAINER_STYLE = {
    accent: 'p-2 rounded-lg bg-accent-background text-accent shrink-0 mt-1',
    destructive: 'p-2 rounded-lg bg-error-background text-error shrink-0 mt-1',
    danger: 'p-2 rounded-lg bg-error-background text-error shrink-0 mt-1',
    warning: 'p-2 rounded-lg bg-warning-background text-warning shrink-0 mt-1',
};

// --- COMPONENTS ---
const Modal = ({
    isOpen = false,
    title,
    description,
    icon,
    size = 'md',
    variant = 'accent',
    primaryAction = null,
    secondaryAction = null,
    actions = null,
    onConfirm = null,
    confirmLabel = 'Confirm',
    confirmLoading = false,
    confirmDisabled = false,
    onCancel = null,
    cancelLabel = 'Cancel',
    showCloseButton = true,
    closeOnBackdrop = true,
    onClose,
    className,
    children,
    ...props
}) => {
    // REFS
    const modalCardReference = useRef(null);

    // HOOKS
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleKeyDown = (keyboardEvent) => {
            if (keyboardEvent.key === 'Escape') {
                onClose?.(keyboardEvent);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    // GUARD CLAUSES
    if (!isOpen) {
        return null;
    }

    // HANDLERS
    const handleBackdropClick = (event) => {
        if (!closeOnBackdrop) {
            return;
        }

        if (modalCardReference.current && !modalCardReference.current.contains(event.target)) {
            onClose?.(event);
        }
    };

    const handleCloseClick = (event) => {
        onClose?.(event);
    };

    // DERIVED VALUES
    const sizeStyle = SIZE_STYLE[size] ?? SIZE_STYLE.md;
    const isDestructive = variant === 'destructive' || variant === 'danger' || primaryAction?.variant === 'destructive';
    const iconContainerStyle = isDestructive
        ? ICON_CONTAINER_STYLE.destructive
        : (ICON_CONTAINER_STYLE[variant] ?? ICON_CONTAINER_STYLE.accent);

    const hasHeader = Boolean(title || description || icon || showCloseButton);

    const effectivePrimaryAction = primaryAction ?? (onConfirm ? {
        label: confirmLabel,
        onClick: onConfirm,
        loading: confirmLoading,
        disabled: confirmDisabled,
        variant: isDestructive ? 'destructive' : 'primary',
    } : null);

    const effectiveSecondaryAction = secondaryAction ?? (onClose || onCancel ? {
        label: cancelLabel,
        onClick: onCancel ?? onClose,
    } : null);

    const hasFooter = Boolean(actions || effectivePrimaryAction || effectiveSecondaryAction);

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
                ref={modalCardReference}
                className={`w-full ${sizeStyle} ${className ?? ''}`.trim()}
            >
                <CardContainer className="p-6 gap-6 bg-surface border-surface-border shadow-2xl flex flex-col animate-toast-in select-text">
                    {/* MODAL HEADER */}
                    {hasHeader && (
                        <div className="flex items-start justify-between gap-4 border-b border-surface-border pb-4 shrink-0">
                            <div className="flex items-start gap-3">
                                {icon && (
                                    <div className={iconContainerStyle}>
                                        {renderIcon(icon)}
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

                            {showCloseButton && (
                                <button
                                    type="button"
                                    onClick={handleCloseClick}
                                    className="h-8 w-8 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
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
                                            <SecondaryButton
                                                onClick={effectiveSecondaryAction.onClick}
                                                disabled={effectiveSecondaryAction.disabled}
                                                leadingIcon={effectiveSecondaryAction.leadingIcon}
                                            >
                                                {effectiveSecondaryAction.label ?? 'Cancel'}
                                            </SecondaryButton>
                                        )
                                    )}
                                    {effectivePrimaryAction && (
                                        isValidElement(effectivePrimaryAction) ? (
                                            effectivePrimaryAction
                                        ) : isDestructive ? (
                                            <DestructiveButton
                                                onClick={effectivePrimaryAction.onClick}
                                                disabled={effectivePrimaryAction.disabled}
                                                loading={effectivePrimaryAction.loading}
                                                leadingIcon={effectivePrimaryAction.leadingIcon}
                                            >
                                                {effectivePrimaryAction.label ?? 'Confirm'}
                                            </DestructiveButton>
                                        ) : (
                                            <PrimaryButton
                                                onClick={effectivePrimaryAction.onClick}
                                                disabled={effectivePrimaryAction.disabled}
                                                loading={effectivePrimaryAction.loading}
                                                leadingIcon={effectivePrimaryAction.leadingIcon}
                                            >
                                                {effectivePrimaryAction.label ?? 'Confirm'}
                                            </PrimaryButton>
                                        )
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </CardContainer>
            </div>
        </div>
    );
};

export {
    Modal,
};

export default Modal;

// --- HELPERS ---
function renderIcon(icon) {
    if (!icon) {
        return null;
    }

    if (isValidElement(icon)) {
        const iconClassName = `${ICON_STYLE} ${icon.props.className ?? ''}`.trim();
        return cloneElement(icon, { className: iconClassName });
    }

    const IconComponent = icon;
    return <IconComponent className={ICON_STYLE} />;
}
