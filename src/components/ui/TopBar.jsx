// --- IMPORTS ---
import { Bell, PanelRight } from 'lucide-react';
import { SearchField, ToggleSelection } from '../../components';

// --- CONFIGURATIONS ---
const BASE_STYLE = 'h-16 px-4 sm:px-6 bg-background/80 backdrop-blur-sm sticky top-0 z-20 flex items-center justify-between gap-4 shrink-0';

// --- COMPONENTS ---
const TopBar = ({
    pageTitle = 'Dashboard',
    headerActions = null,
    hasSearch = true,
    searchQuery = '',
    searchPlaceholder = 'Search documents, records...',
    onSearchChange,
    onSearchClear,
    hasDetailPanel = true,
    isDetailPanelOpen = false,
    onToggleDetailPanel,
    isNotificationActive = false,
    onToggleNotifications,
    notificationTriggerRef,
    notificationContent = null,
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
            {/* CURRENT PAGE TITLE */}
            <div className="flex items-center min-w-0">
                <h1 className="text-xl font-bold font-serif text-text truncate tracking-tight">
                    {pageTitle}
                </h1>
            </div>

            {/* SEARCH FIELD & ACTION CONTROLS */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                {headerActions}

                {/* SEARCH FIELD */}
                {hasSearch && (
                    <div className="w-48 sm:w-64 md:w-80">
                        <SearchField
                            value={searchQuery}
                            placeholder={searchPlaceholder}
                            onChange={handleSearchChange}
                            onClear={handleSearchClear}
                        />
                    </div>
                )}

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
