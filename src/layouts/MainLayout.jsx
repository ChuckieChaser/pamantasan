// --- IMPORTS ---
import { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, PanelRight, X, ChevronUp, ChevronDown, MoreVertical } from 'lucide-react';
import {
    Account,
    GlobalSearchDropdown,
    Notifications,
    Settings,
    Sidebar,
    TopBar,
} from '../components/ui';
import { Menu } from '../components/browser/Menu';
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

const DETAIL_PANEL_BASE_STYLE = 'hidden lg:flex w-[420px] lg:w-[460px] xl:w-[500px] 2xl:w-[540px] max-w-[45vw] h-screen sticky top-0 bg-surface border-l border-surface-border flex-col shrink-0 z-20 transition-all duration-200';

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
    selectedItem = null,
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
    onDetailAction,
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
    const [inspectorActionMenu, setInspectorActionMenu] = useState(null);
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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
    const documentRequests = useDocumentStore((state) => state.documentRequests);

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
        if (!inspectorActionMenu) return;

        const handleDismiss = () => {
            setInspectorActionMenu(null);
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setInspectorActionMenu(null);
            }
        };

        window.addEventListener('click', handleDismiss);
        window.addEventListener('scroll', handleDismiss, true);
        window.addEventListener('resize', handleDismiss);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('click', handleDismiss);
            window.removeEventListener('scroll', handleDismiss, true);
            window.removeEventListener('resize', handleDismiss);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [inspectorActionMenu]);

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
        setMobileSheetSnap('low');
        setInspectorActionMenu(null);
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

    // MOBILE INSPECTOR 3-SNAP POINTS: 'low' | 'mid' | 'high'
    const [mobileSheetSnap, setMobileSheetSnap] = useState('low');
    const [isDraggingSheet, setIsDraggingSheet] = useState(false);
    const [dragOffsetY, setDragOffsetY] = useState(0);

    const touchStartYRef = useRef(0);
    const currentSnapRef = useRef('low');
    const hasDraggedRef = useRef(false);
    const isFirstMountOpenRef = useRef(true);

    useEffect(() => {
        currentSnapRef.current = mobileSheetSnap;
    }, [mobileSheetSnap]);

    // Whenever inspector opens or re-opens, always default to 'low' snap level with transition suppression
    useEffect(() => {
        if (!effectiveIsDetailPanelOpen) {
            setMobileSheetSnap('low');
            isFirstMountOpenRef.current = true;
        } else {
            setMobileSheetSnap('low');
            const timer = setTimeout(() => {
                isFirstMountOpenRef.current = false;
            }, 60);
            return () => clearTimeout(timer);
        }
    }, [effectiveIsDetailPanelOpen]);

    const LOW_HEIGHT = 74;
    const getMidHeight = () => (typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.5) : 400);
    const getHighHeight = () => (typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.92) : 750);

    const getDynamicSheetHeight = () => {
        if (!isDraggingSheet) {
            if (mobileSheetSnap === 'low') return `${LOW_HEIGHT}px`;
            if (mobileSheetSnap === 'mid') return '50vh';
            return '92vh';
        }
        let base = LOW_HEIGHT;
        if (mobileSheetSnap === 'mid') base = getMidHeight();
        if (mobileSheetSnap === 'high') base = getHighHeight();
        const targetH = base - dragOffsetY;
        const clampedH = Math.max(LOW_HEIGHT, Math.min(getHighHeight(), targetH));
        return `${clampedH}px`;
    };

    const handleSheetTouchStart = (event) => {
        if (event.touches?.length) {
            touchStartYRef.current = event.touches[0].clientY;
            hasDraggedRef.current = false;
            setIsDraggingSheet(true);
            setDragOffsetY(0);
        }
    };

    const handleSheetTouchMove = (event) => {
        if (!isDraggingSheet || !event.touches?.length) return;
        const currentY = event.touches[0].clientY;
        const delta = currentY - touchStartYRef.current;
        if (Math.abs(delta) > 5) {
            hasDraggedRef.current = true;
        }
        setDragOffsetY(delta);
    };

    const handleSheetTouchEnd = () => {
        if (!isDraggingSheet) return;
        setIsDraggingSheet(false);
        const delta = dragOffsetY;
        setDragOffsetY(0);

        const currentSnap = currentSnapRef.current;
        let baseHeight = LOW_HEIGHT;
        if (currentSnap === 'mid') {
            baseHeight = getMidHeight();
        } else if (currentSnap === 'high') {
            baseHeight = getHighHeight();
        }

        // Dragging up makes delta negative, so current height increases
        const currentHeight = baseHeight - delta;

        const hLow = LOW_HEIGHT;
        const hMid = getMidHeight();
        const hHigh = getHighHeight();

        const distLow = Math.abs(currentHeight - hLow);
        const distMid = Math.abs(currentHeight - hMid);
        const distHigh = Math.abs(currentHeight - hHigh);

        const minDist = Math.min(distLow, distMid, distHigh);
        if (minDist === distLow) {
            setMobileSheetSnap('low');
        } else if (minDist === distMid) {
            setMobileSheetSnap('mid');
        } else {
            setMobileSheetSnap('high');
        }

        setTimeout(() => {
            hasDraggedRef.current = false;
        }, 120);
    };

    const getEffectiveResourceName = (it) => {
        const path = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
        if (path.includes('/departments') || it?.isDepartment || (it?.code && it?.head)) {
            return 'departments';
        }
        if (path.includes('/users') || it?.isUser || it?.universityId || it?.email || it?.firstName) {
            return 'users';
        }
        if (path.includes('/coordinator') || it?.isCoordinatorRequest || (it?.coordinator && it?.action)) {
            return 'coordinator_requests';
        }
        if (path.includes('/requests') || it?.isDocumentRequest || it?.requester || it?.urgency) {
            return 'document_requests';
        }
        if (path.includes('/archives') || it?.isArchived) {
            return 'archives';
        }
        return 'documents';
    };

    const handleToggleInspectorMenu = (e) => {
        e?.stopPropagation?.();
        if (inspectorActionMenu) {
            setInspectorActionMenu(null);
        } else if (selectedItem) {
            const rect = e.currentTarget.getBoundingClientRect();
            setInspectorActionMenu({ item: selectedItem, anchorRect: rect });
        }
    };

    const handleInspectorActionClick = async (event, actionKey, it) => {
        event?.stopPropagation?.();
        setInspectorActionMenu(null);
        const targetItem = it || selectedItem;
        if (!targetItem) return;

        if (onDetailAction) {
            await onDetailAction(actionKey, targetItem);
            return;
        }

        if (actionKey === 'open' || actionKey === 'open_folder') {
            if (targetItem.isFolder) {
                window.dispatchEvent(new CustomEvent('pamantasan:open-folder', { detail: targetItem }));
            } else {
                window.dispatchEvent(new CustomEvent('pamantasan:open-file', { detail: targetItem }));
            }
            return;
        }
        if (actionKey === 'archive') {
            window.dispatchEvent(new CustomEvent('pamantasan:archive-document', { detail: targetItem }));
            return;
        }
        if (actionKey === 'delete') {
            window.dispatchEvent(new CustomEvent('pamantasan:delete-document', { detail: targetItem }));
            return;
        }
    };

    const storeUnreadCount = notifications.filter((item) => !item.isRead).length;
    const unreadNotificationsCount = notificationCount > 0 ? notificationCount : storeUnreadCount;
    const hasUnread = hasUnreadNotifications || unreadNotificationsCount > 0;
    const isNotificationActive = isNotificationPanelOpen;

    const shouldRenderSidebar = hasSidebar && showSidebar;
    const shouldRenderTopBar = hasTopBar && showTopBar;
    const shouldRenderDetailPanel = hasDetailPanel && showDetailPanel;
    const shouldRenderSearch = hasSearch && showSearch;

    // RENDER
    return (
        <div
            className={`h-screen h-[100dvh] overflow-hidden bg-background text-text flex w-full relative ${className ?? ''}`.trim()}
            {...props}
        >
            {/* SIDEBAR NAVIGATION */}
            {shouldRenderSidebar && (
                <Sidebar
                    currentUser={currentUser}
                    navigationItems={navigationItems}
                    adminNavigationItems={adminNavigationItems}
                    activeNavigationKey={activeNavigationKey}
                    isMobileOpen={isMobileSidebarOpen}
                    onCloseMobile={() => setIsMobileSidebarOpen(false)}
                    onNavigationChange={(key) => {
                        setIsMobileSidebarOpen(false);
                        handleNavigationChange(key);
                    }}
                    onAccountClick={handleOpenAccountModal}
                    onSettingsClick={handleOpenSettingsModal}
                    onSignOut={handleSignOut}
                />
            )}

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col min-w-0 h-screen h-[100dvh] overflow-hidden relative">
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
                        onToggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
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
                                coordinatorRequests={coordinatorRequests}
                                documentRequests={documentRequests}
                            />
                        }
                        hasDetailPanel={shouldRenderDetailPanel}
                        isDetailPanelOpen={effectiveIsDetailPanelOpen}
                        onToggleDetailPanel={handleToggleDetailPanel}
                        isNotificationActive={isNotificationActive}
                        hasUnreadNotifications={hasUnread}
                        onToggleNotifications={handleToggleNotificationPanel}
                        notificationTriggerRef={notificationReference}
                        notificationContent={
                            <Notifications
                                isOpen={isNotificationPanelOpen}
                                onClose={() => setIsNotificationPanelOpen(false)}
                                notifications={notifications}
                                unreadCount={unreadNotificationsCount}
                                onMarkAsRead={markNotificationAsRead}
                                onMarkAllAsRead={() => markAllNotificationsAsRead(currentUser?.id)}
                                onSelectRecord={onSelectRecord}
                            />
                        }
                    />
                )}

                <main className="flex-1 p-2 sm:p-3 md:p-4 lg:p-5 flex flex-col gap-2.5 sm:gap-3.5 overflow-y-auto">
                    {children ?? <Outlet />}
                </main>
            </div>

            {/* DESKTOP DETAIL PANEL / INSPECTOR CONTAINER */}
            {shouldRenderDetailPanel && effectiveIsDetailPanelOpen && (
                <aside className={DETAIL_PANEL_BASE_STYLE}>
                    <div className="h-14 px-4 border-b border-surface-border flex items-center justify-between shrink-0 bg-surface">
                        <div className="flex items-center gap-2">
                            <PanelRight className="h-4 w-4 text-accent" />
                            <h2 className="text-sm font-bold text-text truncate">
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

                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
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

            {/* MOBILE & TABLET DETAIL PANEL BOTTOM SHEET OVERLAY (3 SNAP POINTS: LOW, MID, HIGH) */}
            {shouldRenderDetailPanel && effectiveIsDetailPanelOpen && (
                <div
                    className={`fixed inset-0 z-50 lg:hidden flex flex-col justify-end transition-colors duration-300 ${
                        mobileSheetSnap === 'low'
                            ? 'pointer-events-none bg-transparent'
                            : mobileSheetSnap === 'mid'
                            ? 'pointer-events-auto bg-black/35'
                            : 'pointer-events-auto bg-black/60'
                    }`}
                    onClick={(e) => {
                        // Tapping the backdrop above the sheet in mid/high smoothly docks back down to low
                        if (e.target === e.currentTarget && mobileSheetSnap !== 'low') {
                            setMobileSheetSnap('low');
                        }
                    }}
                >
                    <div
                        className={`w-full bg-surface border-t border-surface-border rounded-t-2xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto ${
                            isDraggingSheet || isFirstMountOpenRef.current ? 'transition-none' : 'transition-[height] duration-300 ease-out'
                        }`}
                        style={{ height: getDynamicSheetHeight() }}
                        onTouchStart={handleSheetTouchStart}
                        onTouchMove={handleSheetTouchMove}
                        onTouchEnd={handleSheetTouchEnd}
                    >
                        {/* DRAG HANDLE BAR (TOUCH GRAB ZONE) */}
                        <div
                            className="w-full flex flex-col items-center justify-center pt-2 pb-1 shrink-0 cursor-grab active:cursor-grabbing select-none touch-none bg-surface"
                            onTouchStart={handleSheetTouchStart}
                            onTouchMove={handleSheetTouchMove}
                            onTouchEnd={handleSheetTouchEnd}
                            onClick={() => {
                                if (hasDraggedRef.current) return;
                                // Tapping the handle cycles snap: low -> mid -> high -> low
                                setMobileSheetSnap((prev) => (prev === 'low' ? 'mid' : prev === 'mid' ? 'high' : 'low'));
                            }}
                            title="Drag or tap to snap (Low, Mid, High)"
                        >
                            <div className="w-12 h-1.5 rounded-full bg-surface-border hover:bg-text-muted active:scale-95 transition-all" />
                        </div>

                        {/* HEADER */}
                        <div
                            className="h-12 px-3 sm:px-4 border-b border-surface-border flex items-center justify-between shrink-0 bg-surface select-none touch-none"
                            onTouchStart={handleSheetTouchStart}
                            onTouchMove={handleSheetTouchMove}
                            onTouchEnd={handleSheetTouchEnd}
                        >
                            <div
                                className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                                onClick={() => {
                                    if (hasDraggedRef.current) return;
                                    if (mobileSheetSnap === 'low') setMobileSheetSnap('mid');
                                }}
                            >
                                <PanelRight className="h-4 w-4 text-accent shrink-0" />
                                <h2 className="text-xs sm:text-sm font-bold text-text truncate">
                                    {detailPanelTitle}
                                </h2>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                                {/* CONTEXTUAL ACTION MENU TRIGGER (3-DOT) */}
                                {selectedItem && (
                                    <button
                                        type="button"
                                        onClick={handleToggleInspectorMenu}
                                        className="h-7 w-7 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-hover active:scale-95 transition-all cursor-pointer"
                                        title="Actions"
                                        aria-label="Actions"
                                    >
                                        <MoreVertical className="h-4 w-4" />
                                    </button>
                                )}

                                {/* TOGGLE EXPAND / COLLAPSE */}
                                {mobileSheetSnap === 'low' ? (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setMobileSheetSnap('mid');
                                        }}
                                        className="h-7 w-7 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
                                        title="Expand inspector"
                                    >
                                        <ChevronUp className="h-4 w-4" />
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setMobileSheetSnap('low');
                                        }}
                                        className="h-7 w-7 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
                                        title="Minimize to bottom (Low)"
                                    >
                                        <ChevronDown className="h-4 w-4" />
                                    </button>
                                )}

                                {/* CLOSE / DESELECT */}
                                <button
                                    type="button"
                                    onClick={handleCloseDetailPanel}
                                    className="h-7 w-7 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
                                    title="Close details"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* CONTENT (VISIBLE IN MID & HIGH, CLIPPED SMOOTHLY IN LOW) */}
                        <div
                            className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3 min-h-0"
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchMove={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                        >
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
                    </div>
                </div>
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

            {/* PORTAL-MOUNTED CONTEXTUAL ACTION MENU FOR INSPECTOR */}
            {inspectorActionMenu && (
                <Menu
                    item={inspectorActionMenu.item}
                    resourceName={getEffectiveResourceName(inspectorActionMenu.item)}
                    anchorRect={inspectorActionMenu.anchorRect}
                    onActionClick={handleInspectorActionClick}
                />
            )}
        </div>
    );
};

// --- EXPORTS ---
export { MainLayout };
