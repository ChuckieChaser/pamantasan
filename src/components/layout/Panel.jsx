// --- IMPORTS ---
import { PanelRightClose, X } from 'lucide-react';


// --- CONFIGURATIONS ---
const DESKTOP_PANEL_STYLE = 'hidden sm:flex w-96 lg:w-[26rem] xl:w-[28rem] h-screen sticky top-0 bg-surface border-l border-surface-border flex-col shrink-0 z-20 overflow-hidden select-text transition-all duration-200';
const MOBILE_PANEL_STYLE = 'fixed inset-x-0 bottom-0 z-40 bg-surface border-t border-surface-border rounded-t-2xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200 select-text';


// --- COMPONENTS ---
export const Panel = ({
    isOpen = false,
    onClose,
    title = 'Details',
    subtitle,
    icon: Icon,
    children,
    footer,
    className = '',
    ...props
}) => {
    // Guard: Hidden when closed
    if (!isOpen) {
        return null;
    }

    // --- RENDER CONTENT ---
    const renderPanelContent = (isMobile = false) => (
        <>
            {/* Mobile Drag Indicator */}
            {isMobile && (
                <div className="pt-2.5 pb-1 flex justify-center shrink-0">
                    <span className="h-1 w-10 rounded-full bg-surface-border" />
                </div>
            )}

            {/* Header */}
            <div className="h-14 px-4 sm:px-5 border-b border-surface-border flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                    {Icon && (
                        <span className="text-text-muted shrink-0">
                            {typeof Icon === 'function' ? <Icon className="h-4 w-4" /> : Icon}
                        </span>
                    )}

                    <div className="flex flex-col min-w-0">
                        <h3 className="text-sm font-semibold text-text truncate">
                            {title}
                        </h3>
                        {subtitle && (
                            <span className="text-[11px] text-text-muted truncate">
                                {subtitle}
                            </span>
                        )}
                    </div>
                </div>

                <button
                    type="button"
                    aria-label="Close details panel"
                    onClick={onClose}
                    className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-hover inline-flex items-center justify-center transition-colors cursor-pointer touch-manipulation"
                >
                    {isMobile ? <X className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 text-sm text-text no-scrollbar">
                {children}
            </div>

            {/* Footer */}
            {footer && (
                <div className="p-3 sm:p-4 border-t border-surface-border bg-surface-hover/30 shrink-0">
                    {footer}
                </div>
            )}
        </>
    );

    // --- RENDER ---
    return (
        <>
            {/* Desktop Panel */}
            <aside
                className={`${DESKTOP_PANEL_STYLE} ${className}`.trim()}
                {...props}
            >
                {renderPanelContent(false)}
            </aside>

            {/* Mobile Sheet (with backdrop) */}
            <div className="sm:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-end animate-in fade-in duration-200">
                <div
                    onClick={onClose}
                    className="fixed inset-0"
                />
                <div className={MOBILE_PANEL_STYLE}>
                    {renderPanelContent(true)}
                </div>
            </div>
        </>
    );
};
