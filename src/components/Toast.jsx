// --- IMPORTS ---
import { useState, useEffect, useRef, createContext, useContext } from 'react';
import {
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Info,
    Loader2,
    ChevronDown,
    ChevronUp,
    X,
} from 'lucide-react';
import { CardContainer } from './Container';

// --- CONFIGURATIONS ---
const ICON_STYLE = 'h-5 w-5 shrink-0';
const ACTION_ICON_STYLE = 'h-4 w-4 shrink-0';
const ITEM_ICON_STYLE = 'h-3.5 w-3.5 shrink-0';

const AUTO_DISMISS_DURATION_MILLISECONDS = 5000;

const VARIANT_ICON = {
    information: Info,
    success: CheckCircle2,
    warning: AlertTriangle,
    error: XCircle,
};

const VARIANT_ICON_STYLE = {
    information: 'text-information',
    success: 'text-accent',
    warning: 'text-warning',
    error: 'text-error',
};

const VARIANT_PROGRESS_STYLE = {
    information: 'bg-information',
    success: 'bg-accent',
    warning: 'bg-warning',
    error: 'bg-error',
};

const ToastContext = createContext(null);

// --- COMPONENTS ---

// 1. AUTO-DISMISS TOAST
const AutoDismissToast = ({
    title,
    description,
    variant = 'success',
    duration = AUTO_DISMISS_DURATION_MILLISECONDS,
    onDismiss,
    className,
    ...props
}) => {
    // STATES
    const [isHovered, setIsHovered] = useState(false);

    // REFS
    const timerReference = useRef(null);
    const remainingTimeReference = useRef(duration);
    const startTimeReference = useRef(Date.now());

    // HOOKS
    useEffect(() => {
        if (isHovered) {
            return;
        }

        startTimeReference.current = Date.now();

        timerReference.current = setTimeout(() => {
            handleTriggerDismiss();
        }, remainingTimeReference.current);

        return () => {
            if (timerReference.current) {
                clearTimeout(timerReference.current);
            }
        };
    }, [isHovered]);

    // HANDLERS
    const handleTriggerDismiss = () => {
        if (timerReference.current) {
            clearTimeout(timerReference.current);
        }

        onDismiss?.();
    };

    const handleMouseEnter = () => {
        if (timerReference.current) {
            clearTimeout(timerReference.current);
        }

        const elapsedTime = Date.now() - startTimeReference.current;
        remainingTimeReference.current = Math.max(0, remainingTimeReference.current - elapsedTime);
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
    };

    const handleClick = () => {
        handleTriggerDismiss();
    };

    // STYLES
    const IconComponent = VARIANT_ICON[variant] ?? VARIANT_ICON.information;
    const iconColorStyle = VARIANT_ICON_STYLE[variant] ?? VARIANT_ICON_STYLE.information;
    const progressColorStyle = VARIANT_PROGRESS_STYLE[variant] ?? VARIANT_PROGRESS_STYLE.information;
    const progressAnimationClassName = `h-full ${progressColorStyle} animate-toast-progress ${isHovered ? 'pause-animation' : ''}`.trim();

    // RENDER
    return (
        <CardContainer
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`relative overflow-hidden cursor-pointer select-none animate-toast-in p-4 gap-3 border-surface-border ${className ?? ''}`.trim()}
            {...props}
        >
            <div className="flex items-start gap-3">
                <IconComponent className={`${ICON_STYLE} ${iconColorStyle}`} />
                <div className="flex flex-col flex-1 gap-1">
                    {title && <span className="text-sm font-semibold text-text">{title}</span>}
                    {description && <span className="text-xs text-text-muted">{description}</span>}
                </div>
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        handleTriggerDismiss();
                    }}
                    className="text-text-muted hover:text-text transition-colors p-1 cursor-pointer"
                    title="Dismiss toast"
                >
                    <X className={ACTION_ICON_STYLE} />
                </button>
            </div>

            {/* PROGRESS BAR DIRECTLY INSIDE CARD CONTAINER */}
            <div className="absolute inset-x-0 bottom-0 h-1 bg-transparent overflow-hidden rounded-b-xl pointer-events-none">
                <div className={progressAnimationClassName} />
            </div>
        </CardContainer>
    );
};

// 2. PROCESSING TOAST (ALWAYS USES UNIFIED ITEM LIST MODEL WITH STAGE HELPER TEXT)
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
              id: 'item-default',
              name: title ?? 'Processing Document',
              progress: progress ?? 0,
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
              ) / (totalItemsCount || 1)
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
        }, 500);

        return () => {
            clearTimeout(finishTimer);
        };
    }, [isAllCompleted, onFinish]);

    // HANDLERS
    const handleCardClick = () => {
        setIsMinimized((previousState) => !previousState);
    };

    // RENDER
    if (isMinimized) {
        return (
            <div
                onClick={handleCardClick}
                className={`animate-toast-in cursor-pointer select-none inline-flex self-end ${className ?? ''}`.trim()}
                title="Click to expand"
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
                    <ChevronUp className={`${ACTION_ICON_STYLE} text-text-muted`} />
                </div>
            </div>
        );
    }

    return (
        <CardContainer
            onClick={handleCardClick}
            className={`animate-toast-in cursor-pointer select-none p-4 gap-3 border-surface-border ${className ?? ''}`.trim()}
            title="Click to minimize"
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
                    <ChevronDown className={ACTION_ICON_STYLE} />
                </div>
            </div>

            {/* OVERALL PROGRESS BAR */}
            <div className="w-full h-1.5 bg-surface-hover rounded-full overflow-hidden">
                <div
                    className="h-full bg-accent rounded-full transition-all duration-200 ease-out"
                    style={{ width: `${Math.min(100, Math.max(0, computedOverallProgress))}%` }}
                />
            </div>

            {/* CONSOLIDATED ITEM BREAKDOWN LIST WITH STAGE HELPER TEXT */}
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pt-1">
                {resolvedItems.map((item) => {
                    const isItemDone = item.isFinished || (item.progress ?? 0) >= 100;
                    const stageHelperText = item.statusText ?? getItemStageDescription(item.progress, item.isFinished);

                    return (
                        <div
                            key={item.id}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded bg-surface-hover text-xs gap-3"
                        >
                            <div className="flex flex-col min-w-0 flex-1">
                                <span className="truncate text-text font-medium">
                                    {item.name}
                                </span>
                                <span className="text-xs text-text-muted truncate">
                                    {stageHelperText}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
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
        </CardContainer>
    );
};

// 3. TOAST VIEWPORT CONTAINER
const ToastViewport = ({ children, className, ...props }) => {
    return (
        <div
            className={`fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none [&>*]:pointer-events-auto ${className ?? ''}`.trim()}
            {...props}
        >
            {children}
        </div>
    );
};

// 4. TOAST PROVIDER & CONTEXT MANAGER (GUARANTEES EXACTLY 1 PROCESSING TOAST ALWAYS AT THE BOTTOM)
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

        const itemsCount = toast.items?.length ?? 1;
        const defaultTitle = itemsCount > 1
            ? `${itemsCount} files uploaded successfully`
            : `${toast.items?.[0]?.name ?? toast.title ?? 'File'} uploaded successfully`;

        const completedToast = {
            id: `completed-${Date.now()}`,
            variant: 'success',
            title: toast.completionTitle ?? defaultTitle,
            description: toast.completionDescription ?? 'All items were scanned, processed, and indexed in the repository.',
        };

        setAutoDismissToasts((previousToasts) => [...previousToasts, completedToast]);
    };

    const addAutoDismissToast = ({ title, description, variant = 'success', duration }) => {
        const toastId = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const newToast = {
            id: toastId,
            title,
            description,
            variant,
            duration,
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
                  id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  name: fileName ?? title ?? 'Document_Upload.pdf',
                  progress: progress ?? 0,
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
                toasts: autoDismissToasts,
                processingToast,
                showToast: addAutoDismissToast,
                showProcessing: addProcessingToast,
                dismissToast: handleDismissAutoToast,
            }}
        >
            {children}
            <ToastViewport>
                {/* 1. AUTO-DISMISS NOTIFICATION TOASTS RENDERED FIRST (STACKED AT TOP/MIDDLE) */}
                {autoDismissToasts.map((toast) => (
                    <AutoDismissToast
                        key={toast.id}
                        title={toast.title}
                        description={toast.description}
                        variant={toast.variant}
                        duration={toast.duration}
                        onDismiss={() => handleDismissAutoToast(toast.id)}
                    />
                ))}

                {/* 2. PROCESSING TOAST ALWAYS AT THE BOTTOM (EXACTLY 1 AT A TIME) */}
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

const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export {
    AutoDismissToast,
    ProcessingToast,
    ToastViewport,
    ToastProvider,
    useToast,
};

export default {
    AutoDismissToast,
    ProcessingToast,
    ToastViewport,
    ToastProvider,
    useToast,
};

// --- HELPERS ---
function getItemStageDescription(progress = 0, isFinished = false) {
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
}
