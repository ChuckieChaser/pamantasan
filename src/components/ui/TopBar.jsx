// --- IMPORTS ---
import { Bell, Menu, PanelRight } from 'lucide-react';
import { SearchField } from '../Fields';
import { ToggleSelection } from '../Selections';

// --- CONFIGURATIONS ---
const BASE_STYLE = 'h-12 sm:h-14 px-2.5 sm:px-4 bg-background/90 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between gap-2 shrink-0 border-b border-surface-border/60 transition-all';

// --- COMPONENTS ---
const TopBar = ({
    pageTitle = 'Dashboard',
    headerActions = null,
    hasSearch = true,
    searchQuery = '',
    searchPlaceholder = 'Search documents, records...',
    searchContainerRef = null,
    searchContent = null,
    onSearchChange,
    onSearchClear,
    onSearchFocus,
    hasDetailPanel = true,
    isDetailPanelOpen = false,
    onToggleDetailPanel,
    isNotificationActive = false,
    onToggleNotifications,
    notificationTriggerRef,
    notificationContent = null,
    onToggleMobileSidebar,
    className,
    ...props
}) => {
    // HANDLERS
    const handleSearchChange = (event) => {
        onSearchChange?.(event);
    };

    const handleSearchClear = () => {
        onSearchClear?.();
    };

    const handleToggleNotifications = (event) => {
        onToggleNotifications?.(event);
    };

    const handleToggleDetailPanel = (event) => {
        onToggleDetailPanel?.(event);
    };

    // DERIVED VALUES
    const composedClassName = `${BASE_STYLE} ${className ?? ''}`.trim();

    // RENDER
    return (
        <header
            className={composedClassName}
            {...props}
        >
            {/* LEFT: MOBILE MENU HAMBURGER & SEARCH BAR */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 flex-1 min-w-0 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg">
                {onToggleMobileSidebar && (
                    <button
                        type="button"
                        onClick={onToggleMobileSidebar}
                        className="md:hidden h-8 w-8 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-hover cursor-pointer shrink-0 transition-colors"
                        title="Toggle navigation menu"
                    >
                        <Menu className="h-4 w-4" />
                    </button>
                )}

                {hasSearch && (
                    <div
                        ref={searchContainerRef}
                        className="flex-1 relative min-w-0"
                    >
                        <SearchField
                            value={searchQuery}
                            placeholder={searchPlaceholder}
                            onChange={handleSearchChange}
                            onClear={handleSearchClear}
                            onFocus={onSearchFocus}
                            size="sm"
                        />

                        {searchContent}
                    </div>
                )}
            </div>

            {/* RIGHT: ACTION CONTROLS & UTILITIES */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {headerActions}

                {/* NOTIFICATION TOGGLE WITH POPOVER SLOT */}
                <div
                    ref={notificationTriggerRef}
                    className="relative"
                >
                    <ToggleSelection
                        isPressed={isNotificationActive}
                        icon={Bell}
                        onChange={handleToggleNotifications}
                        title="Notifications"
                    />

                    {notificationContent}
                </div>

                {/* DETAIL PANEL TOGGLE */}
                {hasDetailPanel && (
                    <ToggleSelection
                        isPressed={isDetailPanelOpen}
                        icon={PanelRight}
                        onChange={handleToggleDetailPanel}
                        title={isDetailPanelOpen ? 'Close detail panel' : 'Open detail panel'}
                    />
                )}
            </div>
        </header>
    );
};

// --- EXPORTS ---
export { TopBar };
