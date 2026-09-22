// --- IMPORTS ---
import { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, PanelRight, X } from 'lucide-react';
import {
    Account,
    GlobalSearchDropdown,
    Notifications,
    Settings,
    Sidebar,
    TopBar,
} from '../components/ui';
import { useClickOutside, useToast } from '../hooks';
import {
    useNotificationStore,
    useDocumentStore,
    useDepartmentStore,
    useUserStore,
    useCoordinatorStore,
} from '../stores';
import { userService, authService } from '../services';
import { constants } from '../constants';

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
    searchQuery: controlledSearchQuery,
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
    onSelectRecord,
    onSignOut,
    className,
    children,
    ...props
}) => {
    // ROUTING
    const navigate = useNavigate();

    // REFS
    const notificationReference = useRef(null);
    const searchContainerReference = useRef(null);

    // STATES
    const [internalSearchQuery, setInternalSearchQuery] = useState('');
    const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
    const [internalDetailPanelOpen, setInternalDetailPanelOpen] = useState(false);
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);

    const [selectedTheme, setSelectedTheme] = useState(() => {
        if (typeof window === 'undefined') {
            return constants.USER_SETTINGS_THEME.DARK;
        }
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme === 'light') {
            return constants.USER_SETTINGS_THEME.LIGHT;
        }
        if (storedTheme === 'dark') {
            return constants.USER_SETTINGS_THEME.DARK;
        }
        return constants.USER_SETTINGS_THEME.SYSTEM;
    });

    const [notificationScope, setNotificationScope] = useState(constants.USER_SETTINGS_NOTIFICATION.ALL);

    // STORES: GLOBAL SEARCH DATA
    const documents = useDocumentStore((state) => state.documents);
    const documentVersions = useDocumentStore((state) => state.documentVersions);
    const departments = useDepartmentStore((state) => state.departments);
    const users = useUserStore((state) => state.users);
    const coordinatorRequests = useCoordinatorStore((state) => state.coordinatorRequests);

    // HOOKS
    const { showToast } = useToast();
    const notifications = useNotificationStore((state) => state.notifications);
    const markNotificationAsRead = useNotificationStore((state) => state.markNotificationAsRead);
    const markAllNotificationsAsRead = useNotificationStore((state) => state.markAllNotificationsAsRead);

    useClickOutside(notificationReference, () => {
        setIsNotificationPanelOpen(false);
    });

    useClickOutside(searchContainerReference, () => {
        setIsSearchDropdownOpen(false);
    });

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsSearchDropdownOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        const rootElement = document.documentElement;
        if (selectedTheme === constants.USER_SETTINGS_THEME.DARK) {
            rootElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            return;
        }

        if (selectedTheme === constants.USER_SETTINGS_THEME.LIGHT) {
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

    // SYNC USER SETTINGS FROM DATABASE
    useEffect(() => {
        if (!currentUser?.id) return;
        let isCancelled = false;

        userService.fetchUserSettingsByUserId(currentUser.id).then((settings) => {
            if (!isCancelled && settings) {
                if (settings.theme) {
                    setSelectedTheme(settings.theme);
                }
                if (settings.notification) {
                    setNotificationScope(settings.notification);
                }
            }
        }).catch(() => {});

        return () => {
            isCancelled = true;
        };
    }, [currentUser?.id]);

    // PERIODIC LIVE SESSION INTEGRITY CHECK (CONCURRENCY WATCHDOG & SESSION TIED TO ACCOUNT)
    useEffect(() => {
        if (!currentUser?.id) return;
        let isCancelled = false;

        const checkSessionValidity = async () => {
            // Guard: Never perform session invalidation checks if the client is currently offline
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                return;
            }

            const currentSessionId = authService.getCurrentSessionId();
            if (!currentSessionId) return;

            try {
                // Fetch both user account and active sessions from database
                const [dbUser, sessions] = await Promise.all([
                    userService.fetchUserById(currentUser.id),
                    userService.fetchUserSessionsByUserId(currentUser.id),
                ]);
                if (isCancelled) return;

                // If offline or network error caused dbUser to be null, do not log out
                if (!dbUser) {
                    if (typeof navigator !== 'undefined' && !navigator.onLine) {
                        return;
                    }
                    return;
                }

                // 1. If user account was explicitly suspended in database
                if (dbUser.status === constants.USERS_STATUS.SUSPENDED) {
                    showToast({
                        title: 'Account Inactive',
                        description: 'Your account is no longer active or has been suspended.',
                        variant: 'error',
                    });
                    if (onSignOut) {
                        onSignOut();
                    } else {
                        await authService.logout();
                    }
                    return;
                }

                // If sessions is empty array due to network blip, verify before proceeding
                if (!sessions || sessions.length === 0) {
                    if (typeof navigator !== 'undefined' && !navigator.onLine) {
                        return;
                    }
                }

                // 2. Check if active user session exists in database and matches this client
                const storedToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('pamantasan_session_token') : null;
                const hasValidSession = (sessions || []).some(
                    (s) => s.id === currentSessionId || s.tokenHash === currentSessionId || (storedToken && s.tokenHash === storedToken)
                );

                // User requirement: if the user session of the active user is deleted or superseded by another device, terminate
                // Only terminate if the database returned active sessions and this client's session is explicitly missing
                if (sessions && sessions.length > 0 && !hasValidSession) {
                    showToast({
                        title: 'Session Terminated',
                        description: 'Your account was signed into from another browser or device.',
                        variant: 'warning',
                    });
                    if (onSignOut) {
                        onSignOut();
                    } else {
                        await authService.logout();
                    }
                }
            } catch {
                // Ignore background network blips
            }
        };

        // Check every 10 seconds, on window focus, and on visibility change
        const intervalId = setInterval(checkSessionValidity, 10000);
        window.addEventListener('focus', checkSessionValidity);
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkSessionValidity();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            isCancelled = true;
            clearInterval(intervalId);
            window.removeEventListener('focus', checkSessionValidity);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [currentUser?.id, onSignOut, showToast]);

    // HANDLERS
    const handleNavigationChange = (navigationKey) => {
        onNavigationChange?.(navigationKey);
    };

    const activeSearchQuery = controlledSearchQuery !== undefined ? controlledSearchQuery : internalSearchQuery;

    const handleSearchChange = (event) => {
        const val = event?.target?.value ?? '';
        if (controlledSearchQuery === undefined) {
            setInternalSearchQuery(val);
        }
        setIsSearchDropdownOpen(Boolean(val.trim()));
        onSearchChange?.(event);
    };

    const handleSearchClear = () => {
        if (controlledSearchQuery === undefined) {
            setInternalSearchQuery('');
        }
        setIsSearchDropdownOpen(false);
        onSearchClear?.();
    };

    const handleSearchFocus = () => {
        if (activeSearchQuery.trim()) {
            setIsSearchDropdownOpen(true);
        }
    };

    const handleSelectSearchResult = (result) => {
        setIsSearchDropdownOpen(false);
        setInternalSearchQuery('');

        if (result.type === 'document') {
            if (result.isArchived) {
                navigate('/archives');
            } else {
                navigate('/documents');
            }
            onSelectRecord?.(result.raw);
        } else if (result.type === 'department') {
            navigate('/departments');
            onSelectRecord?.(result.raw);
        } else if (result.type === 'user') {
            navigate('/users');
            onSelectRecord?.(result.raw);
        } else if (result.type === 'request') {
            navigate('/requests');
            onSelectRecord?.(result.raw);
        }
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
        if (currentUser?.id) {
            userService.upsertUserSetting(currentUser.id, { theme: newTheme }).catch((error) => {
                console.warn('Failed to persist theme to database:', error);
            });
        }
    };

    const handleNotificationScopeChange = (newScope) => {
        setNotificationScope(newScope);
        if (currentUser?.id) {
            userService.upsertUserSetting(currentUser.id, { notification: newScope }).catch((error) => {
                console.warn('Failed to persist notification scope to database:', error);
            });
        }
    };

    const handleSignOut = (event) => {
        onSignOut?.(event);
    };

    // DERIVED VALUES
    const effectiveIsDetailPanelOpen = isDetailPanelOpen !== undefined
        ? isDetailPanelOpen
        : internalDetailPanelOpen;

    const storeUnreadCount = notifications.filter((item) => !item.isRead).length;
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
                        searchQuery={activeSearchQuery}
                        searchPlaceholder={searchPlaceholder}
                        searchContainerRef={searchContainerReference}
                        onSearchChange={handleSearchChange}
                        onSearchClear={handleSearchClear}
                        onSearchFocus={handleSearchFocus}
                        searchContent={
                            <GlobalSearchDropdown
                                isOpen={isSearchDropdownOpen}
                                query={activeSearchQuery}
                                onClose={() => setIsSearchDropdownOpen(false)}
                                onSelectResult={handleSelectSearchResult}
                                documents={documents}
                                documentVersions={documentVersions}
                                departments={departments}
                                users={users}
                                requests={coordinatorRequests}
                            />
                        }
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
                currentUser={currentUser}
                onSignOut={onSignOut}
            />
        </div>
    );
};

// --- EXPORTS ---
export { MainLayout };
