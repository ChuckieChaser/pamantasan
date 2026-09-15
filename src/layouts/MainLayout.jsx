// --- IMPORTS ---
import { useState, useRef, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { LayoutDashboard, PanelRight, X } from 'lucide-react';
import {
    Account,
    Notifications,
    Settings,
    Sidebar,
    TopBar,
} from '../components/ui';
import { useClickOutside } from '../hooks';
import { useNotificationStore } from '../stores';

// --- CONFIGURATIONS ---
const DEFAULT_NAVIGATION_ITEMS = [
    {
        key: 'dashboard',
        value: 'dashboard',
        label: 'Dashboard',
        title: 'Dashboard',
        icon: LayoutDashboard,
    },
];

const DETAIL_PANEL_BASE_STYLE = 'w-96 lg:w-[26rem] xl:w-[30rem] h-screen sticky top-0 bg-surface border-l border-surface-border flex flex-col shrink-0 z-20 transition-all duration-200';

// --- COMPONENTS ---
const MainLayout = ({
    currentUser = null,
    navigationItems = DEFAULT_NAVIGATION_ITEMS,
    adminNavigationItems = [],
    activeNavigationKey = 'dashboard',
    pageTitle = 'Dashboard',
    headerActions = null,
    searchQuery = '',
    searchPlaceholder = 'Search documents, records...',
    hasSearch = true,
    showSearch = true,
    isDetailPanelOpen = undefined,
    detailPanelTitle = 'Details',
    detailPanelContent = null,
    hasSidebar = true,
    showSidebar = true,
    hasTopBar = true,
    showTopBar = true,
    hasDetailPanel = true,
    showDetailPanel = true,
    notificationCount = 0,
    hasUnreadNotifications = false,
    onSearchChange,
    onSearchClear,
    onNavigationChange,
    onAccountClick,
    onSettingsClick,
    onToggleDetailPanel,
    onCloseDetailPanel,
    onSignOut,
    className,
    children,
    ...props
}) => {
    // REFS
    const notificationReference = useRef(null);

    // STATES
    const [internalDetailPanelOpen, setInternalDetailPanelOpen] = useState(false);
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);

    const [selectedTheme, setSelectedTheme] = useState(() => {
        if (typeof window === 'undefined') {
            return 'DARK';
        }
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme === 'light') {
            return 'LIGHT';
        }
        if (storedTheme === 'dark') {
            return 'DARK';
        }
        return 'SYSTEM';
    });

    const [notificationScope, setNotificationScope] = useState('ALL');
    const [isEmailDigestEnabled, setIsEmailDigestEnabled] = useState(true);
    const [isCompactModeEnabled, setIsCompactModeEnabled] = useState(false);

    // HOOKS
    const notifications = useNotificationStore((state) => state.notifications);
    const markNotificationAsRead = useNotificationStore((state) => state.markNotificationAsRead);
    const markAllNotificationsAsRead = useNotificationStore((state) => state.markAllNotificationsAsRead);

    useClickOutside(notificationReference, () => {
        setIsNotificationPanelOpen(false);
    });

    useEffect(() => {
        const rootElement = document.documentElement;
        if (selectedTheme === 'DARK') {
            rootElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            return;
        }

        if (selectedTheme === 'LIGHT') {
            rootElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            return;
        }

        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (systemPrefersDark) {
            rootElement.classList.add('dark');
        } else {
            rootElement.classList.remove('dark');
        }
        localStorage.removeItem('theme');
    }, [selectedTheme]);

    // HANDLERS
    const handleNavigationChange = (navigationKey) => {
        onNavigationChange?.(navigationKey);
    };

    const handleSearchChange = (event) => {
        onSearchChange?.(event);
    };

    const handleSearchClear = () => {
        onSearchClear?.();
    };

    const handleOpenAccountModal = (event) => {
        setIsAccountModalOpen(true);
        onAccountClick?.(event);
    };

    const handleCloseAccountModal = () => {
        setIsAccountModalOpen(false);
    };

    const handleOpenSettingsModal = (event) => {
        setIsSettingsModalOpen(true);
        onSettingsClick?.(event);
    };

    const handleCloseSettingsModal = () => {
        setIsSettingsModalOpen(false);
    };

    const handleToggleNotificationPanel = () => {
        setIsNotificationPanelOpen((previousState) => !previousState);
    };

    const handleToggleDetailPanel = (event) => {
        if (onToggleDetailPanel) {
            onToggleDetailPanel(event);
            return;
        }

        setInternalDetailPanelOpen((previousState) => !previousState);
    };

    const handleCloseDetailPanel = (event) => {
        if (onCloseDetailPanel) {
            onCloseDetailPanel(event);
            return;
        }

        setInternalDetailPanelOpen(false);
    };

    const handleThemeChange = (newTheme) => {
        setSelectedTheme(newTheme);
    };

    const handleNotificationScopeChange = (newScope) => {
        setNotificationScope(newScope);
    };

    const handleToggleEmailDigest = () => {
        setIsEmailDigestEnabled((previousState) => !previousState);
    };

    const handleToggleCompactMode = () => {
        setIsCompactModeEnabled((previousState) => !previousState);
    };

    const handleSignOut = (event) => {
        onSignOut?.(event);
    };

    // DERIVED VALUES
    const effectiveIsDetailPanelOpen = isDetailPanelOpen !== undefined
        ? isDetailPanelOpen
        : internalDetailPanelOpen;

    const storeUnreadCount = notifications.filter((item) => !item.is_read).length;
    const unreadNotificationsCount = notificationCount > 0 ? notificationCount : storeUnreadCount;
    const hasUnread = hasUnreadNotifications || unreadNotificationsCount > 0;
    const isNotificationActive = isNotificationPanelOpen || hasUnread;

    const shouldRenderSidebar = hasSidebar && showSidebar;
    const shouldRenderTopBar = hasTopBar && showTopBar;
    const shouldRenderDetailPanel = hasDetailPanel && showDetailPanel;
    const shouldRenderSearch = hasSearch && showSearch;

    // RENDER
    return (
        <div
            className={`h-screen overflow-hidden bg-background text-text flex w-full relative ${className ?? ''}`.trim()}
            {...props}
        >
            {/* SIDEBAR NAVIGATION */}
            {shouldRenderSidebar && (
                <Sidebar
                    currentUser={currentUser}
                    navigationItems={navigationItems}
                    adminNavigationItems={adminNavigationItems}
                    activeNavigationKey={activeNavigationKey}
                    onNavigationChange={handleNavigationChange}
                    onAccountClick={handleOpenAccountModal}
                    onSettingsClick={handleOpenSettingsModal}
                    onSignOut={handleSignOut}
                />
            )}

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
                {shouldRenderTopBar && (
                    <TopBar
                        pageTitle={pageTitle}
                        headerActions={headerActions}
                        hasSearch={shouldRenderSearch}
                        searchQuery={searchQuery}
                        searchPlaceholder={searchPlaceholder}
                        onSearchChange={handleSearchChange}
                        onSearchClear={handleSearchClear}
                        hasDetailPanel={shouldRenderDetailPanel}
                        isDetailPanelOpen={effectiveIsDetailPanelOpen}
                        onToggleDetailPanel={handleToggleDetailPanel}
                        isNotificationActive={isNotificationActive}
                        onToggleNotifications={handleToggleNotificationPanel}
                        notificationTriggerRef={notificationReference}
                        notificationContent={
                            <Notifications
                                isOpen={isNotificationPanelOpen}
                                notifications={notifications}
                                unreadCount={unreadNotificationsCount}
                                onMarkAsRead={markNotificationAsRead}
                                onMarkAllAsRead={() => markAllNotificationsAsRead(currentUser?.id)}
                            />
                        }
                    />
                )}

                <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 overflow-y-auto">
                    {children ?? <Outlet />}
                </main>
            </div>

            {/* DETAIL PANEL / INSPECTOR CONTAINER */}
            {shouldRenderDetailPanel && effectiveIsDetailPanelOpen && (
                <aside className={DETAIL_PANEL_BASE_STYLE}>
                    <div className="h-16 px-5 border-b border-surface-border flex items-center justify-between shrink-0 bg-surface">
                        <div className="flex items-center gap-2">
                            <PanelRight className="h-4 w-4 text-accent" />
                            <h2 className="text-sm font-bold text-text">
                                {detailPanelTitle}
                            </h2>
                        </div>

                        <button
                            type="button"
                            onClick={handleCloseDetailPanel}
                            className="h-8 w-8 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
                            title="Close detail panel"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
                        {detailPanelContent ?? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-text-muted gap-2">
                                <PanelRight className="h-8 w-8 text-surface-border stroke-1" />
                                <span className="text-xs font-medium text-text">
                                    No item selected
                                </span>
                                <p className="text-xs text-text-muted max-w-xs">
                                    Select a document, request, or record from the main workspace to inspect its properties.
                                </p>
                            </div>
                        )}
                    </div>
                </aside>
            )}

            {/* ACCOUNT MODAL */}
            <Account
                isOpen={isAccountModalOpen}
                onClose={handleCloseAccountModal}
                currentUser={currentUser}
            />

            {/* SETTINGS MODAL */}
            <Settings
                isOpen={isSettingsModalOpen}
                onClose={handleCloseSettingsModal}
                selectedTheme={selectedTheme}
                onThemeChange={handleThemeChange}
                notificationScope={notificationScope}
                onNotificationScopeChange={handleNotificationScopeChange}
                isEmailDigestEnabled={isEmailDigestEnabled}
                onToggleEmailDigest={handleToggleEmailDigest}
                isCompactModeEnabled={isCompactModeEnabled}
                onToggleCompactMode={handleToggleCompactMode}
                currentUser={currentUser}
            />
        </div>
    );
};

// --- EXPORTS ---
export { MainLayout };
