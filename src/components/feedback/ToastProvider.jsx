// --- IMPORTS ---
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
    AlertCircle,
    AlertTriangle,
    Check,
    CheckCircle2,
    Copy,
    Info,
    Loader2,
    X,
} from 'lucide-react';


// --- CONFIGURATIONS ---
const DEFAULT_DURATION_MS = 5000;

const VARIANT_CONFIG = {
    success: {
        icon:          CheckCircle2,
        iconStyle:     'text-accent',
        borderStyle:   'border-accent-border',
        progressStyle: 'bg-accent',
    },
    error: {
        icon:          AlertCircle,
        iconStyle:     'text-error',
        borderStyle:   'border-error-border',
        progressStyle: 'bg-error',
    },
    warning: {
        icon:          AlertTriangle,
        iconStyle:     'text-warning',
        borderStyle:   'border-warning-border',
        progressStyle: 'bg-warning',
    },
    information: {
        icon:          Info,
        iconStyle:     'text-information',
        borderStyle:   'border-information-border',
        progressStyle: 'bg-information',
    },
    loading: {
        icon:          Loader2,
        iconStyle:     'text-accent animate-spin',
        borderStyle:   'border-surface-border',
        progressStyle: 'bg-accent',
    },
};


// --- CONTEXT ---
export const ToastContext = createContext(null);


// --- TOAST ITEM COMPONENT ---
const ToastItem = ({
    id,
    title,
    description,
    variant = 'information',
    duration = DEFAULT_DURATION_MS,
    rawError = null,
    progress = null,
    onDismiss,
}) => {
    // --- HOOKS & STATE ---
    const [isHovered, setIsHovered] = useState(false);
    const [remainingTime, setRemainingTime] = useState(duration);
    const [hasCopiedError, setHasCopiedError] = useState(false);
    const [touchStartX, setTouchStartX] = useState(null);
    const [dragOffset, setDragOffset] = useState(0);

    const timerRef = useRef(null);
    const startTimeRef = useRef(null);

    const config = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG.information;
    const Icon = config.icon;
    const isAutoDismiss = duration > 0 && variant !== 'loading';

    // --- TIMERS ---
    useEffect(() => {
        if (!isAutoDismiss || isHovered) {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            return;
        }

        startTimeRef.current = Date.now();
        timerRef.current = setTimeout(() => {
            onDismiss(id);
        }, remainingTime);

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [id, isAutoDismiss, isHovered, onDismiss, remainingTime]);

    // --- HANDLERS ---
    const handleMouseEnter = () => {
        if (!isAutoDismiss) return;
        setIsHovered(true);
        if (startTimeRef.current) {
            const elapsed = Date.now() - startTimeRef.current;
            setRemainingTime((prev) => Math.max(0, prev - elapsed));
        }
    };

    const handleMouseLeave = () => {
        if (!isAutoDismiss) return;
        setIsHovered(false);
    };

    // Mobile Swipe-to-Dismiss
    const handleTouchStart = (e) => {
        setTouchStartX(e.touches[0].clientX);
    };

    const handleTouchMove = (e) => {
        if (touchStartX === null) return;
        const currentX = e.touches[0].clientX;
        const diff = currentX - touchStartX;
        if (diff > 0) {
            setDragOffset(diff);
        }
    };

    const handleTouchEnd = () => {
        if (dragOffset > 100) {
            onDismiss(id);
        } else {
            setDragOffset(0);
        }
        setTouchStartX(null);
    };

    const handleCopyError = (event) => {
        event.stopPropagation();
        if (!rawError) return;

        const errorText = typeof rawError === 'object'
            ? JSON.stringify(rawError, Object.getOwnPropertyNames(rawError), 2)
            : String(rawError);

        navigator.clipboard?.writeText?.(errorText);
        setHasCopiedError(true);
        setTimeout(() => setHasCopiedError(false), 2000);
    };

    // --- RENDER ---
    return (
        <div
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
                transform: dragOffset > 0 ? `translateX(${dragOffset}px)` : undefined,
                opacity: dragOffset > 0 ? Math.max(0.2, 1 - dragOffset / 200) : 1,
            }}
            className={`pointer-events-auto relative w-full overflow-hidden rounded-xl border bg-surface p-3.5 shadow-lg select-text transition-all duration-150 ${config.borderStyle}`}
        >
            <div className="flex items-start gap-3">
                <span className={`shrink-0 mt-0.5 ${config.iconStyle}`}>
                    <Icon className="h-5 w-5" />
                </span>

                <div className="flex-1 min-w-0 pr-1">
                    {title && (
                        <h4 className="text-sm font-semibold text-text leading-tight">
                            {title}
                        </h4>
                    )}
                    {description && (
                        <p className="text-xs text-text-muted mt-1 leading-relaxed break-words">
                            {description}
                        </p>
                    )}

                    {rawError && (
                        <button
                            type="button"
                            onClick={handleCopyError}
                            className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-surface-hover text-[11px] font-medium text-text-muted hover:text-text cursor-pointer transition-colors"
                        >
                            {hasCopiedError ? (
                                <>
                                    <Check className="h-3 w-3 text-accent" />
                                    <span>Copied error trace</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="h-3 w-3" />
                                    <span>Copy error trace</span>
                                </>
                            )}
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    aria-label="Dismiss toast"
                    onClick={() => onDismiss(id)}
                    className="shrink-0 p-1 -mr-1 -mt-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* Optional Progress Bar */}
            {typeof progress === 'number' && (
                <div className="mt-2.5 h-1 w-full rounded-full bg-surface-hover overflow-hidden">
                    <div
                        className={`h-full transition-all duration-300 ${config.progressStyle}`}
                        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                    />
                </div>
            )}
        </div>
    );
};


// --- PROVIDER ---
export const ToastProvider = ({ children }) => {
    // --- HOOKS & STATE ---
    const [toasts, setToasts] = useState([]);

    // --- HANDLERS ---
    const dismiss = useCallback((id) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const dismissAll = useCallback(() => {
        setToasts([]);
    }, []);

    const toast = useCallback(({
        title,
        description,
        variant = 'information',
        duration = DEFAULT_DURATION_MS,
        rawError = null,
        progress = null,
    }) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const newToast = {
            id,
            title,
            description,
            variant,
            duration,
            rawError,
            progress,
        };

        setToasts((prev) => [...prev, newToast]);
        return id;
    }, []);

    // Convenience Helpers
    toast.success = useCallback((title, description, options = {}) => {
        return toast({ title, description, variant: 'success', ...options });
    }, [toast]);

    toast.error = useCallback((title, description, rawError = null, options = {}) => {
        return toast({ title, description, variant: 'error', rawError, ...options });
    }, [toast]);

    toast.warning = useCallback((title, description, options = {}) => {
        return toast({ title, description, variant: 'warning', ...options });
    }, [toast]);

    toast.info = useCallback((title, description, options = {}) => {
        return toast({ title, description, variant: 'information', ...options });
    }, [toast]);

    toast.loading = useCallback((title, description, options = {}) => {
        return toast({ title, description, variant: 'loading', duration: 0, ...options });
    }, [toast]);

    toast.dismiss = dismiss;
    toast.dismissAll = dismissAll;

    // --- CONTEXT VALUE ---
    const contextValue = {
        toast,
        dismiss,
        dismissAll,
        showToast: toast,
    };

    // --- RENDER ---
    return (
        <ToastContext.Provider value={contextValue}>
            {children}

            {/* Responsive Viewport (Bottom-Right on Desktop, Bottom Full-Width on Mobile) */}
            <div
                aria-live="polite"
                aria-atomic="true"
                className="fixed bottom-3 inset-x-3 sm:inset-x-auto sm:right-4 sm:bottom-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none select-none"
            >
                {toasts.map((item) => (
                    <ToastItem
                        key={item.id}
                        {...item}
                        onDismiss={dismiss}
                    />
                ))}
            </div>
        </ToastContext.Provider>
    );
};


// --- HOOK ---
export const useToast = () => {
    const context = useContext(ToastContext);

    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }

    return context;
};
