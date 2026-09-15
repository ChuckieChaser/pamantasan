// --- IMPORTS ---
import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Info,
    Loader2,
    X,
    XCircle,
    Copy,
    Check,
} from 'lucide-react';
import { Container } from './Container';


// --- CONFIGURATIONS ---
const ICON_STYLE = 'h-5 w-5 shrink-0';
const ACTION_ICON_STYLE = 'h-4 w-4 shrink-0';
const ITEM_ICON_STYLE = 'h-4 w-4 shrink-0';

const DEFAULT_TOAST_DURATION_MS = 5000;

const VARIANT_ICON = {
    information: Info,
    success:     CheckCircle2,
    warning:     AlertTriangle,
    error:       XCircle,
};

const VARIANT_ICON_STYLE = {
    information: 'text-information',
    success:     'text-accent',
    warning:     'text-warning',
    error:       'text-error',
};

const VARIANT_PROGRESS_STYLE = {
    information: 'bg-information',
    success:     'bg-accent',
    warning:     'bg-warning',
    error:       'bg-error',
};

const ToastContext = createContext(null);


// --- COMPONENTS ---
const AutoDismissToast = ({
    title,
    description,
    variant,
    type,
    duration = DEFAULT_TOAST_DURATION_MS,
    rawError,
    onDismiss,
    className,
    ...props
}) => {
    const resolvedVariant = variant || type || 'success';
    const isError = resolvedVariant === 'error';

    // REFS
    const timerRef = useRef(null);
    const remainingTimeRef = useRef(duration);
    const startTimeRef = useRef(null);
    const onDismissRef = useRef(onDismiss);

    useEffect(() => {
        onDismissRef.current = onDismiss;
    }, [onDismiss]);

    // STATES
    const [isHovered, setIsHovered] = useState(false);
    const [hasCopied, setHasCopied] = useState(false);
    const [isDismissing, setIsDismissing] = useState(false);

    // HANDLERS
    const handleTriggerDismiss = useCallback(() => {
        if (isDismissing) return;
        setIsDismissing(true);

        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        setTimeout(() => {
            onDismissRef.current?.();
        }, 150);
    }, [isDismissing]);

    const handleMouseEnter = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        if (startTimeRef.current) {
            const elapsedTime = Date.now() - startTimeRef.current;
            remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsedTime);
            startTimeRef.current = null;
        }
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
    };

    const handleClick = () => {
        handleTriggerDismiss();
    };

    const handleCopyError = (event) => {
        event.stopPropagation();
        const textToCopy = rawError || description || title || 'An error occurred';
        if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                setHasCopied(true);
                setTimeout(() => setHasCopied(false), 2000);
            }).catch(() => {
                fallbackCopy(textToCopy);
            });
        } else {
            fallbackCopy(textToCopy);
        }
    };

    const fallbackCopy = (text) => {
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setHasCopied(true);
            setTimeout(() => setHasCopied(false), 2000);
        } catch {}
    };

    // HOOKS: Independent toast dismissal timer that is unaffected by parent re-renders
    useEffect(() => {
        if (isHovered) {
            return;
        }

        startTimeRef.current = Date.now();
        const currentRemaining = remainingTimeRef.current;

        timerRef.current = setTimeout(() => {
            handleTriggerDismiss();
        }, currentRemaining);

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            if (startTimeRef.current) {
                const elapsed = Date.now() - startTimeRef.current;
                remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
                startTimeRef.current = null;
            }
        };
    }, [isHovered, handleTriggerDismiss]);

    // DERIVED VALUES
    const IconComponent = VARIANT_ICON[resolvedVariant] ?? VARIANT_ICON.information;
    const iconColorStyle = VARIANT_ICON_STYLE[resolvedVariant] ?? VARIANT_ICON_STYLE.information;
    const progressColorStyle = VARIANT_PROGRESS_STYLE[resolvedVariant] ?? VARIANT_PROGRESS_STYLE.information;
    const progressAnimationClassName = `h-full ${progressColorStyle} animate-toast-progress ${isHovered ? 'pause-animation' : ''}`.trim();

    // RENDER
    return (
        <Container
            variant="card"
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`relative overflow-hidden cursor-pointer select-none pointer-events-auto ${isDismissing ? 'animate-toast-out' : 'animate-toast-in'} ${className ?? ''}`.trim()}
            {...props}
        >
            <div className="flex items-start gap-3">
                <IconComponent className={`${ICON_STYLE} ${iconColorStyle}`} />
                <div className="flex flex-col flex-1 gap-1 min-w-0">
                    {title && <span className="text-sm font-semibold text-text">{title}</span>}
                    {description && <span className="text-xs text-text-muted break-words leading-relaxed">{description}</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0 -mr-1 -mt-1">
                    {isError && (
                        <button
                            type="button"
                            onClick={handleCopyError}
                            className="text-text-muted hover:text-text transition-colors p-1 cursor-pointer rounded hover:bg-surface-hover"
                            title={hasCopied ? 'Copied to clipboard' : 'Copy error details'}
                        >
                            {hasCopied ? (
                                <Check className={`${ACTION_ICON_STYLE} text-accent`} />
                            ) : (
                                <Copy className={ACTION_ICON_STYLE} />
                            )}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            handleTriggerDismiss();
                        }}
                        className="text-text-muted hover:text-text transition-colors p-1 cursor-pointer rounded hover:bg-surface-hover"
                        title="Dismiss toast"
                    >
                        <X className={ACTION_ICON_STYLE} />
                    </button>
                </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 h-1 bg-transparent overflow-hidden rounded-b-xl pointer-events-none">
                <div
                    className={progressAnimationClassName}
                    style={{
                        '--toast-duration': `${duration}ms`,
                        animationDuration: `${duration}ms`,
                    }}
                    onAnimationEnd={handleTriggerDismiss}
                />
            </div>
        </Container>
    );
};

const ProcessingToast = ({
    title,
    description,
    progress,
    items = [],
    isFinished = false,
    onFinish,
    className,
    ...props
}) => {
    // STATES
    const [isMinimized, setIsMinimized] = useState(false);

    // DERIVED VALUES
    const resolvedItems = items.length > 0
        ? items
        : [{
              id:         'item-default',
              name:       title ?? 'Processing Document',
              progress:   progress ?? 0,
              isFinished,
          }];

    const totalItemsCount = resolvedItems.length;
    const completedItemsCount = resolvedItems.filter(
        (item) => item.isFinished || (item.progress ?? 0) >= 100
    ).length;

    const computedOverallProgress = typeof progress === 'number'
        ? progress
        : Math.round(
              resolvedItems.reduce(
                  (accumulator, item) =>
                      accumulator + (item.progress ?? (item.isFinished ? 100 : 0)),
                  0
              ) / Math.max(1, totalItemsCount)
          );

    const effectiveTitle = title ?? (
        totalItemsCount === 1
            ? `Uploading ${resolvedItems[0]?.name ?? 'file'}`
            : `Uploading ${totalItemsCount} files`
    );

    const effectiveDescription = description ?? `${completedItemsCount} of ${totalItemsCount} completed`;
    const isAllCompleted = isFinished || completedItemsCount === totalItemsCount;

    // HOOKS
    useEffect(() => {
        if (!isAllCompleted) {
            return;
        }

        const finishTimer = setTimeout(() => {
            onFinish?.();
        }, 5000);

        return () => {
            clearTimeout(finishTimer);
        };
    }, [isAllCompleted, onFinish]);

    // HANDLERS
    const handleCardClick = () => {
        if (isAllCompleted) {
            onFinish?.();
        } else {
            setIsMinimized((previousState) => !previousState);
        }
    };

    // RENDER
    if (isMinimized) {
        return (
            <div
                onClick={handleCardClick}
                className={`animate-toast-in cursor-pointer select-none pointer-events-auto inline-flex self-start ${className ?? ''}`.trim()}
                title={isAllCompleted ? 'Click to close' : 'Click to expand'}
                {...props}
            >
                <div className="h-8 px-3 rounded-full bg-surface border border-surface-border shadow-lg inline-flex items-center gap-2 hover:bg-surface-hover transition-colors">
                    {isAllCompleted ? (
                        <CheckCircle2 className={`${ACTION_ICON_STYLE} text-accent`} />
                    ) : (
                        <Loader2 className={`${ACTION_ICON_STYLE} animate-spin text-accent`} />
                    )}
                    <span className="text-xs font-medium text-text truncate max-w-44">
                        {effectiveTitle}
                    </span>
                    <span className="text-xs text-text-muted font-medium">
                        {Math.round(computedOverallProgress)}%
                    </span>
                    {isAllCompleted ? (
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                onFinish?.();
                            }}
                            className="text-text-muted hover:text-text transition-colors p-0.5 rounded hover:bg-surface-hover cursor-pointer"
                            title="Close"
                        >
                            <X className={ACTION_ICON_STYLE} />
                        </button>
                    ) : (
                        <ChevronUp className={`${ACTION_ICON_STYLE} text-text-muted`} />
                    )}
                </div>
            </div>
        );
    }

    return (
        <Container
            variant="card"
            onClick={handleCardClick}
            className={`relative overflow-hidden animate-toast-in cursor-pointer select-none pointer-events-auto ${className ?? ''}`.trim()}
            title={isAllCompleted ? 'Click to close' : 'Click to minimize'}
            {...props}
        >
            <div className="flex items-start gap-3">
                {isAllCompleted ? (
                    <CheckCircle2 className={`${ICON_STYLE} text-accent`} />
                ) : (
                    <Loader2 className={`${ICON_STYLE} animate-spin text-accent`} />
                )}

                <div className="flex flex-col flex-1 gap-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-text truncate">
                            {effectiveTitle}
                        </span>
                        <span className="text-xs font-semibold text-accent shrink-0">
                            {Math.round(computedOverallProgress)}%
                        </span>
                    </div>
                    {effectiveDescription && (
                        <span className="text-xs text-text-muted">
                            {effectiveDescription}
                        </span>
                    )}
                </div>

                <div className="text-text-muted p-1 shrink-0">
                    {isAllCompleted ? (
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                onFinish?.();
                            }}
                            className="text-text-muted hover:text-text transition-colors p-0.5 rounded hover:bg-surface-hover cursor-pointer"
                            title="Close"
                        >
                            <X className={ACTION_ICON_STYLE} />
                        </button>
                    ) : (
                        <ChevronDown className={ACTION_ICON_STYLE} />
                    )}
                </div>
            </div>

            <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden">
                <div
                    className="h-full bg-accent rounded-full transition-all duration-200 ease-out"
                    style={{ width: `${Math.min(100, Math.max(0, computedOverallProgress))}%` }}
                />
            </div>

            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pt-1">
                {resolvedItems.map((item) => {
                    const isItemDone = item.isFinished || (item.progress ?? 0) >= 100;
                    const stageHelperText = item.statusText ?? getItemStageDescription(item.progress, item.isFinished);

                    return (
                        <div
                            key={item.id}
                            className="flex items-center justify-between px-3 py-2 rounded bg-surface-hover text-xs gap-3"
                        >
                            <div className="flex flex-col min-w-0 flex-1">
                                <span className="truncate text-text font-medium">
                                    {item.name}
                                </span>
                                <span className="text-xs text-text-muted truncate">
                                    {stageHelperText}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {isItemDone ? (
                                    <CheckCircle2 className={`${ITEM_ICON_STYLE} text-accent`} />
                                ) : (
                                    <span className="text-text-muted font-medium">
                                        {Math.round(item.progress ?? 0)}%
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {isAllCompleted && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-surface-hover overflow-hidden rounded-b-xl pointer-events-none">
                    <div
                        className="h-full bg-accent animate-toast-progress"
                        style={{
                            '--toast-duration': '5000ms',
                            animationDuration: '5000ms',
                        }}
                    />
                </div>
            )}
        </Container>
    );
};

function simplifyErrorMessage(text) {
    if (!text || typeof text !== 'string') return text || '';
    let s = text.trim();
    // Strip common server and framework prefixes
    s = s.replace(/^(Cloud Function \w+ failed:\s*)+/i, '');
    s = s.replace(/^(FirebaseError:\s*)+/i, '');
    s = s.replace(/^([0-9]+\s+[A-Z_]+:\s*)+/, ''); // e.g. 7 PERMISSION_DENIED:
    s = s.replace(/^(Error:\s*)+/i, '');
    s = s.replace(/^(TypeError:\s*)+/i, '');
    s = s.replace(/^(Unhandled Rejection:\s*)+/i, '');

    // If it's a long technical explanation, keep only the essential first sentence
    const firstPeriod = s.indexOf('. ');
    if (firstPeriod > 10 && s.length > 90) {
        s = s.substring(0, firstPeriod + 1);
    }
    return s.trim();
}

function simplifyToastText(text) {
    if (!text || typeof text !== 'string') return text;
    let s = text.trim();
    s = s.replace(/^Successfully\s+/i, '');
    s = s.replace(/\s+has been successfully\s+/i, ' ');
    s = s.replace(/\s+was successfully\s+/i, ' ');
    s = s.replace(/\s+have been successfully\s+/i, ' ');
    s = s.replace(/Please coordinate with the IT Helpdesk at ([\w@.]+) to reset your account password\./i, 'Contact IT helpdesk at $1.');
    s = s.replace(/Access restricted:\s*/i, '');
    s = s.replace(/Concurrent logins are not permitted\.\s*/i, '');
    s = s.replace(/Please log out from the other session first\./i, '');
    s = s.replace(/All items were scanned, processed, and indexed in the repository\./i, 'Items processed and indexed.');
    s = s.replace(/Please sign in with your University ID and password first, then link your Google account in Settings > Security\./i, 'Sign in with University ID to link in Settings.');
    return s.trim();
}

const ToastViewport = ({ children, className, ...props }) => {
    let isSidebarPresent = true;
    try {
        const location = useLocation();
        const authRoutes = ['/login', '/forgot-password', '/onboarding'];
        if (location?.pathname && authRoutes.some((route) => location.pathname.startsWith(route))) {
            isSidebarPresent = false;
        }
    } catch {
        isSidebarPresent = false;
    }

    const leftPositionClass = isSidebarPresent ? 'left-6 md:left-20' : 'left-6';

    return (
        <div
            className={`fixed bottom-6 ${leftPositionClass} z-50 flex flex-col gap-3 w-[calc(100vw-3rem)] sm:w-[440px] max-w-lg pointer-events-none ${className ?? ''}`.trim()}
            {...props}
        >
            {children}
        </div>
    );
};

const ToastProvider = ({ children }) => {
    // STATES
    const [autoDismissToasts, setAutoDismissToasts] = useState([]);
    const [processingToast, setProcessingToast] = useState(null);

    // HANDLERS
    const handleDismissAutoToast = (toastId) => {
        setAutoDismissToasts((previousToasts) =>
            previousToasts.filter((toast) => toast.id !== toastId)
        );
    };

    const handleProcessFinished = (toast) => {
        setProcessingToast(null);

        // If completionTitle is explicitly null or false, suppress the extra auto-dismiss toast
        if (toast.completionTitle === null || toast.completionTitle === false) {
            return;
        }

        const itemsCount = toast.items?.length ?? 1;
        const defaultTitle = itemsCount > 1
            ? `${itemsCount} files uploaded`
            : `${toast.items?.[0]?.name ?? toast.title ?? 'File'} uploaded`;

        const completedToast = {
            id:          `completed-${Date.now()}`,
            variant:     'success',
            title:       simplifyToastText(toast.completionTitle ?? defaultTitle),
            description: simplifyToastText(toast.completionDescription ?? 'Items indexed.'),
        };

        setAutoDismissToasts((previousToasts) => [...previousToasts, completedToast]);
    };

    const addAutoDismissToast = ({ title, description, message, variant, type, duration, rawError }) => {
        const toastId = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const resolvedVariant = variant || type || 'success';
        const isError = resolvedVariant === 'error';

        // Capture full raw error text for the "Copy error" button
        const fullError = rawError || (typeof description === 'string' && description) || (typeof title === 'string' && title) || (typeof message === 'string' && message) || '';

        // Ensure every toast app-wide always has both a Header (title) and Body (description)
        let resolvedTitle = title;
        let resolvedDescription = description || message;

        if (!resolvedTitle && resolvedDescription) {
            const fallbackHeaders = {
                error: 'Action Failed',
                warning: 'Attention Needed',
                information: 'Notice',
                success: 'Success',
            };
            resolvedTitle = fallbackHeaders[resolvedVariant] || 'Notification';
        }

        const newToast = {
            id: toastId,
            title: isError ? simplifyErrorMessage(resolvedTitle) : simplifyToastText(resolvedTitle),
            description: isError ? simplifyErrorMessage(resolvedDescription) : simplifyToastText(resolvedDescription),
            variant: resolvedVariant,
            duration: duration || DEFAULT_TOAST_DURATION_MS,
            rawError: isError ? fullError : null,
        };

        setAutoDismissToasts((previousToasts) => [...previousToasts, newToast]);
        return toastId;
    };

    const addProcessingToast = ({
        title,
        description,
        progress,
        items = [],
        fileName,
        completionTitle,
        completionDescription,
    }) => {
        const initialItems = items.length > 0
            ? items
            : [{
                  id:         `file-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  name:       fileName ?? title ?? 'Document_Upload.pdf',
                  progress:   progress ?? 0,
                  isFinished: false,
              }];

        setProcessingToast((currentProcessingToast) => {
            if (currentProcessingToast && !currentProcessingToast.isFinished) {
                return {
                    ...currentProcessingToast,
                    items: [...currentProcessingToast.items, ...initialItems],
                };
            }

            return {
                id: `process-${Date.now()}`,
                title,
                description,
                progress,
                items: initialItems,
                isFinished: false,
                completionTitle,
                completionDescription,
            };
        });

        return {
            updateProgress: (updatedProgress) => {
                setProcessingToast((currentToast) =>
                    currentToast
                        ? { ...currentToast, progress: updatedProgress }
                        : null
                );
            },
            updateItem: (itemId, updates) => {
                setProcessingToast((currentToast) => {
                    if (!currentToast) {
                        return null;
                    }

                    const updatedItems = currentToast.items.map((subItem) =>
                        subItem.id === itemId
                            ? {
                                  ...subItem,
                                  ...updates,
                              }
                            : subItem
                    );

                    return {
                        ...currentToast,
                        items: updatedItems,
                    };
                });
            },
            updateItemProgress: (itemId, itemProgress, statusText) => {
                setProcessingToast((currentToast) => {
                    if (!currentToast) {
                        return null;
                    }

                    const updatedItems = currentToast.items.map((subItem) =>
                        subItem.id === itemId
                            ? {
                                  ...subItem,
                                  progress: itemProgress,
                                  isFinished: itemProgress >= 100,
                                  statusText: statusText ?? subItem.statusText,
                              }
                            : subItem
                    );

                    return {
                        ...currentToast,
                        items: updatedItems,
                    };
                });
            },
            completeItem: (itemId) => {
                setProcessingToast((currentToast) => {
                    if (!currentToast) {
                        return null;
                    }

                    const updatedItems = currentToast.items.map((subItem) =>
                        subItem.id === itemId
                            ? {
                                  ...subItem,
                                  progress: 100,
                                  isFinished: true,
                                  statusText: 'Completed and indexed',
                              }
                            : subItem
                    );

                    return {
                        ...currentToast,
                        items: updatedItems,
                    };
                });
            },
            complete: () => {
                setProcessingToast((currentToast) =>
                    currentToast
                        ? {
                              ...currentToast,
                              isFinished: true,
                              progress: 100,
                              items: currentToast.items.map((subItem) => ({
                                  ...subItem,
                                  progress: 100,
                                  isFinished: true,
                                  statusText: 'Completed and indexed',
                              })),
                          }
                        : null
                );
            },
        };
    };

    // RENDER
    return (
        <ToastContext.Provider
            value={{
                toasts:         autoDismissToasts,
                processingToast,
                showToast:      addAutoDismissToast,
                showProcessing: addProcessingToast,
                dismissToast:   handleDismissAutoToast,
            }}
        >
            {children}
            <ToastViewport>
                {autoDismissToasts.map((toast) => (
                    <AutoDismissToast
                        key={toast.id}
                        title={toast.title}
                        description={toast.description}
                        variant={toast.variant}
                        duration={toast.duration}
                        rawError={toast.rawError}
                        onDismiss={() => handleDismissAutoToast(toast.id)}
                    />
                ))}

                {processingToast && (
                    <ProcessingToast
                        key={processingToast.id}
                        title={processingToast.title}
                        description={processingToast.description}
                        progress={processingToast.progress}
                        items={processingToast.items}
                        isFinished={processingToast.isFinished}
                        onFinish={() => handleProcessFinished(processingToast)}
                    />
                )}
            </ToastViewport>
        </ToastContext.Provider>
    );
};


// --- HELPERS ---
const getItemStageDescription = (progress = 0, isFinished = false) => {
    if (isFinished || progress >= 100) {
        return 'Completed and indexed';
    }
    if (progress < 25) {
        return 'Uploading payload...';
    }
    if (progress < 50) {
        return 'Scanning security & integrity...';
    }
    if (progress < 75) {
        return 'Extracting OCR text layer...';
    }
    return 'Generating AI metadata & summary...';
};


// --- EXPORTS ---
export {
    AutoDismissToast,
    ProcessingToast,
    ToastContext,
    ToastProvider,
    ToastViewport,
};
