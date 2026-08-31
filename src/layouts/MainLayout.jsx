// --- IMPORTS ---
import { useState, useRef, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import {
    Bell,
    PanelRight,
    X,
    User,
    LayoutDashboard,
    LogOut,
    Settings,
    Shield,
    CheckCircle2,
    Building2,
    Sun,
    Laptop,
    Key,
    Lock,
    Mail,
    HardDrive,
    Camera,
    Edit3,
    Save,
    Loader2,
    Upload,
} from 'lucide-react';
import logoImage from '../assets/logo.jpg';
import {
    NavigationSelection,
    ToggleSelection,
    SegmentSelection,
    SwitchSelection,
    SearchField,
    CardContainer,
    SecondaryButton,
    TextField,
    RoleBadge,
    SuccessBadge,
    WarningBadge,
    InformationBadge,
    Modal,
    UserAvatar,
    useToast,
} from '../components';
import { useClickOutside } from '../hooks';
import { useNotificationStore, useUserStore, useAuthenticationStore } from '../stores';
import { storageService } from '../services';
import { USER_ROLES, USER_STATUSES } from '../constants';

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

const SETTINGS_SECTIONS = [
    {
        id: 'appearance',
        label: 'Appearance & Theme',
        icon: Sun,
    },
    {
        id: 'notifications',
        label: 'Notification Tiers',
        icon: Bell,
    },
    {
        id: 'security',
        label: 'Security & Sessions',
        icon: Shield,
    },
    {
        id: 'system',
        label: 'Institutional Policy',
        icon: Building2,
    },
];

const THEME_OPTIONS = [
    { value: 'SYSTEM', label: 'System' },
    { value: 'LIGHT', label: 'Light' },
    { value: 'DARK', label: 'Dark' },
];

const NOTIFICATION_SCOPE_OPTIONS = [
    { value: 'ALL', label: 'All Alerts' },
    { value: 'SYSTEM', label: 'System Only' },
    { value: 'IMPORTANT', label: 'Important Only' },
];

const SIDEBAR_BASE_STYLE = 'w-16 h-screen sticky top-0 bg-surface border-r border-surface-border flex flex-col justify-between items-center py-4 shrink-0 z-30 transition-transform duration-200';
const TOP_BAR_BASE_STYLE = 'h-16 px-4 sm:px-6 bg-background/80 backdrop-blur-sm sticky top-0 z-20 flex items-center justify-between gap-4 shrink-0';
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
    showSearch = true,
    isDetailPanelOpen = undefined,
    detailPanelTitle = 'Details',
    detailPanelContent = null,
    showSidebar = true,
    showTopBar = true,
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
    // INTERNAL STATES
    const [internalDetailPanelOpen, setInternalDetailPanelOpen] = useState(false);
    const [isAccountPanelOpen, setIsAccountPanelOpen] = useState(false);
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);

    // SETTINGS PANEL STATES
    const [activeSettingsSection, setActiveSettingsSection] = useState('appearance');
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
    // NOTIFICATION STORE
    const notifications = useNotificationStore((state) => state.notifications);
    const markNotificationAsRead = useNotificationStore((state) => state.markNotificationAsRead);
    const markAllNotificationsAsRead = useNotificationStore((state) => state.markAllNotificationsAsRead);
    const storeUnreadCount = notifications.filter((item) => !item.is_read).length;
    const unreadNotificationsCount = notificationCount > 0 ? notificationCount : storeUnreadCount;
    const hasUnread = hasUnreadNotifications || unreadNotificationsCount > 0;

    // PROFILE EDITING STATES
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [profileFirstName, setProfileFirstName] = useState('');
    const [profileMiddleName, setProfileMiddleName] = useState('');
    const [profileLastName, setProfileLastName] = useState('');
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const avatarInputReference = useRef(null);
    const { showToast } = useToast();

    // REFS FOR POPUP DISMISSAL
    const accountReference = useRef(null);
    const notificationReference = useRef(null);

    // HOOKS
    useClickOutside(accountReference, () => {
        setIsAccountPanelOpen(false);
    });

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

        // SYSTEM THEME
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (systemPrefersDark) {
            rootElement.classList.add('dark');
        } else {
            rootElement.classList.remove('dark');
        }
        localStorage.removeItem('theme');
    }, [selectedTheme]);

    // HANDLERS
    const handleNavigationClick = (navigationKey) => {
        onNavigationChange?.(navigationKey);
    };

    const handleSearchChange = (event) => {
        onSearchChange?.(event);
    };

    const handleSearchClear = () => {
        onSearchClear?.();
    };

    const handleToggleAccountPanel = () => {
        setIsAccountPanelOpen((previousState) => !previousState);
    };

    const handleToggleNotificationPanel = () => {
        setIsNotificationPanelOpen((previousState) => !previousState);
    };

    const handleOpenAccountModal = (event) => {
        setIsAccountPanelOpen(false);
        setProfileFirstName(currentUser?.first_name ?? currentUser?.firstName ?? 'Carl');
        setProfileMiddleName(currentUser?.middle_name ?? currentUser?.middleName ?? '');
        setProfileLastName(currentUser?.last_name ?? currentUser?.lastName ?? 'Avecilla');
        setIsEditingProfile(false);
        setIsAccountModalOpen(true);
        onAccountClick?.(event);
    };

    const handleTriggerAvatarUpload = () => {
        avatarInputReference.current?.click();
    };

    const handleAvatarFileChange = async (changeEvent) => {
        const file = changeEvent.target.files?.[0];
        if (!file) {
            return;
        }

        const activeId = currentUser?.id ?? 'f1000001-0000-4000-8000-000000000001';
        setIsUploadingAvatar(true);

        try {
            const uploadResult = await storageService.uploadAvatar(activeId, file);
            const storagePointer = uploadResult.path;
            await useUserStore.getState().updateUser(activeId, {
                avatar_path: storagePointer,
            });
            useAuthenticationStore.getState().updateProfile({
                avatar_path: storagePointer,
                avatarPath: storagePointer,
            });
            showToast({
                type: 'success',
                title: 'Avatar Updated',
                description: 'Profile avatar has been uploaded and stored in Firebase Storage.',
            });
        } catch (error) {
            console.error('Avatar upload error:', error);
            showToast({
                type: 'error',
                title: 'Avatar Upload Failed',
                description: error?.message ?? 'Could not upload avatar.',
            });
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!profileFirstName.trim() || !profileLastName.trim()) {
            showToast({
                type: 'error',
                title: 'Validation Error',
                description: 'First name and last name are required.',
            });
            return;
        }

        try {
            const activeId = currentUser?.id ?? 'f1000001-0000-4000-8000-000000000001';
            await useUserStore.getState().updateUser(activeId, {
                first_name: profileFirstName.trim(),
                middle_name: profileMiddleName.trim() || null,
                last_name: profileLastName.trim(),
            });
            useAuthenticationStore.getState().updateProfile({
                first_name: profileFirstName.trim(),
                firstName: profileFirstName.trim(),
                middle_name: profileMiddleName.trim() || null,
                middleName: profileMiddleName.trim() || null,
                last_name: profileLastName.trim(),
                lastName: profileLastName.trim(),
                name: `${profileFirstName.trim()} ${profileLastName.trim()}`,
            });
            setIsEditingProfile(false);
            showToast({
                type: 'success',
                title: 'Profile Updated',
                description: 'Your legal name has been successfully updated.',
            });
        } catch (error) {
            showToast({
                type: 'error',
                title: 'Update Failed',
                description: error?.message ?? 'Could not update profile.',
            });
        }
    };

    const handleCloseAccountModal = () => {
        setIsAccountModalOpen(false);
        setIsEditingProfile(false);
    };

    const handleOpenSettingsModal = (event) => {
        setIsAccountPanelOpen(false);
        setIsSettingsModalOpen(true);
        onSettingsClick?.(event);
    };

    const handleCloseSettingsModal = () => {
        setIsSettingsModalOpen(false);
    };

    const handleSignOutClick = (event) => {
        setIsAccountPanelOpen(false);
        onSignOut?.(event);
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

    const handleThemeChange = (newThemeValue) => {
        setSelectedTheme(newThemeValue);
    };

    const handleNotificationScopeChange = (newScopeValue) => {
        setNotificationScope(newScopeValue);
    };

    const handleToggleEmailDigest = () => {
        setIsEmailDigestEnabled((previousState) => !previousState);
    };

    const handleToggleCompactMode = () => {
        setIsCompactModeEnabled((previousState) => !previousState);
    };

    // DERIVED VALUES
    const effectiveIsDetailPanelOpen = isDetailPanelOpen !== undefined
        ? isDetailPanelOpen
        : internalDetailPanelOpen;

    const isNotificationActive = isNotificationPanelOpen || hasUnread;

    const userName = currentUser?.name ?? `${currentUser?.first_name ?? 'Carl'} ${currentUser?.last_name ?? 'Avecilla'}`;
    const userFirstName = currentUser?.first_name ?? 'Carl';
    const userMiddleName = currentUser?.middle_name ?? null;
    const userLastName = currentUser?.last_name ?? 'Avecilla';
    const userUniversityId = currentUser?.university_id ?? currentUser?.universityId ?? '20-00001';
    const userEmail = currentUser?.email ?? 'admin.rmo@plpasig.edu.ph';
    const userDepartment = currentUser?.department ?? 'Records Management Office (RMO)';
    const userRole = (currentUser?.role ?? USER_ROLES.ADMINISTRATOR).toLowerCase();
    const userStatus = currentUser?.status ?? USER_STATUSES.VERIFIED;

    // RENDER
    return (
        <div
            className={`h-screen overflow-hidden bg-background text-text flex w-full relative ${className ?? ''}`.trim()}
            {...props}
        >
            {/* 1. LEFT COLUMN: SLIM ICON-ONLY SIDEBAR NAVIGATION */}
            {showSidebar && (
                <aside className={SIDEBAR_BASE_STYLE}>
                    {/* TOP: LOGO */}
                    <div className="flex flex-col items-center justify-center shrink-0">
                        <img
                            src={logoImage}
                            alt="Pamantasan Records Logo"
                            className="h-10 w-10 rounded-full object-cover bg-surface shadow-sm shrink-0"
                        />
                    </div>

                    {/* CENTER: VERTICAL ICON NAVIGATION SELECTION WITH SEPARATION */}
                    <div className="my-auto flex flex-col items-center justify-center gap-2">
                        {/* 1. MAIN / GENERAL PAGES */}
                        <NavigationSelection
                            value={activeNavigationKey}
                            options={navigationItems.map((item) => ({
                                value: item.key ?? item.value,
                                label: item.label,
                                title: item.title ?? item.label,
                                icon: item.icon,
                                disabled: item.disabled,
                            }))}
                            onChange={handleNavigationClick}
                        />

                        {/* 2. STANDALONE SEPARATOR */}
                        {adminNavigationItems && adminNavigationItems.length > 0 && (
                            <div className="w-8 border-t border-surface-border my-1" />
                        )}

                        {/* 3. ADMIN ACCESS NAVIGATION */}
                        {adminNavigationItems && adminNavigationItems.length > 0 && (
                            <NavigationSelection
                                value={activeNavigationKey}
                                options={adminNavigationItems.map((item) => ({
                                    value: item.key ?? item.value,
                                    label: item.label,
                                    title: item.title ?? item.label,
                                    icon: item.icon,
                                    disabled: item.disabled,
                                }))}
                                onChange={handleNavigationClick}
                            />
                        )}
                    </div>

                    {/* BOTTOM: USER ACCOUNT ICON & TOGGLE POPUP CONTAINER (NO TOP BORDER) */}
                    <div ref={accountReference} className="relative flex flex-col items-center w-full shrink-0">
                        <button
                            type="button"
                            onClick={handleToggleAccountPanel}
                            className={`rounded-full transition-colors flex items-center justify-center cursor-pointer shrink-0 ${
                                isAccountPanelOpen
                                    ? 'ring-2 ring-accent'
                                    : 'hover:ring-2 hover:ring-accent-border'
                            }`}
                            title="Account profile & settings"
                        >
                            <UserAvatar
                                src={currentUser?.avatar_path}
                                name={userName}
                                size="md"
                                className="h-10 w-10"
                            />
                        </button>

                        {/* ACCOUNT PANEL POPOVER */}
                        {isAccountPanelOpen && (
                            <div className="absolute left-16 bottom-0 z-50 w-72">
                                <CardContainer className="p-4 gap-3 bg-surface border-surface-border shadow-xl">
                                    {/* USER PROFILE INFO - CENTER ALIGNED WITH ICON AT START */}
                                    <div className="flex flex-col items-center text-center gap-2 border-b border-surface-border pb-3">
                                        <UserAvatar
                                            src={currentUser?.avatar_path}
                                            name={userName}
                                            size="lg"
                                            className="h-12 w-12 shadow-sm"
                                        />
                                        <div className="flex flex-col items-center gap-1 w-full">
                                            <span className="font-semibold text-sm text-text truncate max-w-full">
                                                {userName}
                                            </span>
                                            <span className="text-xs text-text-muted font-medium">
                                                ID: {userUniversityId}
                                            </span>
                                            <span className="text-xs text-text-muted truncate max-w-full">
                                                {userEmail}
                                            </span>
                                            <div className="pt-1">
                                                <RoleBadge role={userRole} size="sm" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* MENU OPTIONS */}
                                    <div className="flex flex-col gap-1">
                                        <button
                                            type="button"
                                            onClick={handleOpenAccountModal}
                                            className="w-full h-8 px-3 rounded-md flex items-center gap-2 text-xs font-medium text-text hover:bg-surface-hover transition-colors cursor-pointer"
                                        >
                                            <Shield className="h-4 w-4 text-text-muted" />
                                            <span>Account Profile</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleOpenSettingsModal}
                                            className="w-full h-8 px-3 rounded-md flex items-center gap-2 text-xs font-medium text-text hover:bg-surface-hover transition-colors cursor-pointer"
                                        >
                                            <Settings className="h-4 w-4 text-text-muted" />
                                            <span>System Settings</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleSignOutClick}
                                            className="w-full h-8 px-3 rounded-md flex items-center gap-2 text-xs font-medium text-text-muted hover:text-error hover:bg-error-background transition-colors cursor-pointer"
                                        >
                                            <LogOut className="h-4 w-4" />
                                            <span>Sign Out</span>
                                        </button>
                                    </div>
                                </CardContainer>
                            </div>
                        )}
                    </div>
                </aside>
            )}

            {/* 2. CENTER COLUMN: SEAMLESS HEADER & MAIN CONTENT */}
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
                {/* SEAMLESS PERMANENTLY FIXED TOP BAR */}
                {showTopBar && (
                    <header className={TOP_BAR_BASE_STYLE}>
                        {/* LEFT: CURRENT PAGE TITLE ONLY */}
                        <div className="flex items-center min-w-0">
                            <h1 className="text-xl font-bold font-serif text-text truncate tracking-tight">
                                {pageTitle}
                            </h1>
                        </div>

                        {/* RIGHT: SEARCH FIELD & ACTION TOGGLE SELECTIONS */}
                        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                            {headerActions}

                            {/* SEARCH FIELD PRECEDING THE TOGGLE BUTTONS */}
                            {showSearch && (
                                <div className="w-48 sm:w-64 md:w-80">
                                    <SearchField
                                        value={searchQuery}
                                        placeholder={searchPlaceholder}
                                        onChange={handleSearchChange}
                                        onClear={handleSearchClear}
                                    />
                                </div>
                            )}

                            {/* NOTIFICATION TOGGLE SELECTION WITH POPOVER */}
                            <div ref={notificationReference} className="relative">
                                <ToggleSelection
                                    pressed={isNotificationActive}
                                    icon={Bell}
                                    onChange={handleToggleNotificationPanel}
                                    title="Notifications"
                                />

                                {/* NOTIFICATION PANEL CONTAINER */}
                                {isNotificationPanelOpen && (
                                    <div className="absolute right-0 top-full mt-2 z-50 w-80 sm:w-96">
                                        <CardContainer className="p-4 gap-3 bg-surface border-surface-border shadow-xl">
                                            <div className="flex items-center justify-between border-b border-surface-border pb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm text-text">
                                                        Notifications
                                                    </span>
                                                    {unreadNotificationsCount > 0 && (
                                                        <span className="px-2 py-0.5 rounded-full text-xs bg-accent text-text-inverted font-medium">
                                                            {unreadNotificationsCount} New
                                                        </span>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => markAllNotificationsAsRead(currentUser?.id)}
                                                    className="text-xs text-accent hover:underline cursor-pointer"
                                                >
                                                    Mark all read
                                                </button>
                                            </div>

                                            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                                                {notifications.length === 0 ? (
                                                    <div className="text-center py-6 text-xs text-text-muted">
                                                        No notifications right now
                                                    </div>
                                                ) : (
                                                    notifications.map((notification) => {
                                                        const actionType = (notification.action ?? '').toUpperCase();
                                                        const iconStyle = actionType.includes('REJECT') || actionType.includes('DELETE') || actionType.includes('FAIL')
                                                            ? 'bg-error-background text-error'
                                                            : actionType.includes('PENDING') || actionType.includes('REQUEST') || actionType.includes('WARN')
                                                            ? 'bg-warning-background text-warning'
                                                            : actionType.includes('INFO') || actionType.includes('MESSAGE')
                                                            ? 'bg-information-background text-information'
                                                            : 'bg-accent-background text-accent';

                                                        return (
                                                            <div
                                                                key={notification.id}
                                                                onClick={() => markNotificationAsRead(notification.id)}
                                                                className={`flex items-start gap-3 p-2 rounded-lg border transition-colors cursor-pointer text-xs ${
                                                                    notification.is_read
                                                                        ? 'bg-surface border-surface-border opacity-70'
                                                                        : 'bg-surface-hover border-accent/30'
                                                                }`}
                                                            >
                                                                <div className={`p-2 rounded-md ${iconStyle} shrink-0 mt-0.5`}>
                                                                    <Bell className="h-3.5 w-3.5" />
                                                                </div>
                                                                <div className="flex flex-col min-w-0 flex-1">
                                                                    <div className="flex items-center justify-between gap-1">
                                                                        <span className="font-semibold text-text truncate capitalize">
                                                                            {notification.action?.toLowerCase()?.replace('_', ' ')}: {notification.entity_type}
                                                                        </span>
                                                                        {!notification.is_read && (
                                                                            <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                                                                        )}
                                                                    </div>
                                                                    <span className="text-text-muted line-clamp-2 mt-0.5">
                                                                        Entity: {notification.entity_id}
                                                                    </span>
                                                                    <span className="text-xs text-text-muted mt-1">
                                                                        {new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </CardContainer>
                                    </div>
                                )}
                            </div>

                            {/* DETAIL PANEL TOGGLE SELECTION */}
                            {showDetailPanel && (
                                <ToggleSelection
                                    pressed={effectiveIsDetailPanelOpen}
                                    icon={PanelRight}
                                    onChange={handleToggleDetailPanel}
                                    title={effectiveIsDetailPanelOpen ? 'Close detail panel' : 'Open detail panel'}
                                />
                            )}
                        </div>
                    </header>
                )}

                {/* MAIN WORKSPACE CONTENT CONTAINER */}
                <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 overflow-y-auto">
                    {children ?? <Outlet />}
                </main>
            </div>

            {/* 3. RIGHT COLUMN: DETAIL PANEL (COLLAPSIBLE / CLOSABLE) */}
            {showDetailPanel && effectiveIsDetailPanelOpen && (
                <aside className={DETAIL_PANEL_BASE_STYLE}>
                    {/* DETAIL PANEL HEADER */}
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

                    {/* DETAIL PANEL BODY */}
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

            {/* 4. ACCOUNT PROFILE OVERVIEW / EDIT MODAL */}
            <Modal
                isOpen={isAccountModalOpen}
                onClose={handleCloseAccountModal}
                title={isEditingProfile ? 'Edit Account Profile' : 'Account Profile'}
                description={isEditingProfile ? 'Update legal identity information' : 'Official university credentials and profile identity'}
                size="lg"
                primaryAction={
                    isEditingProfile
                        ? {
                              label: 'Save Profile Changes',
                              leadingIcon: Save,
                              onClick: handleSaveProfile,
                          }
                        : {
                              label: 'Edit Profile',
                              leadingIcon: Edit3,
                              onClick: () => setIsEditingProfile(true),
                          }
                }
                secondaryAction={{
                    label: isEditingProfile ? 'Cancel' : 'Close',
                    onClick: isEditingProfile ? () => setIsEditingProfile(false) : handleCloseAccountModal,
                }}
            >
                {/* HIDDEN AVATAR FILE INPUT */}
                <input
                    type="file"
                    ref={avatarInputReference}
                    onChange={handleAvatarFileChange}
                    accept="image/*"
                    className="hidden"
                />

                {/* USER HERO PROFILE CARD WITH INTERACTIVE AVATAR UPLOAD */}
                <div className="p-5 rounded-xl bg-surface-hover/50 border border-surface-border flex flex-col sm:flex-row items-center sm:items-start gap-4">
                    <div className="relative group shrink-0">
                        <UserAvatar
                            src={currentUser?.avatar_path}
                            name={userName}
                            size="xl"
                            className="h-16 w-16 shadow-sm border-2 border-accent"
                        />
                        <button
                            type="button"
                            onClick={handleTriggerAvatarUpload}
                            disabled={isUploadingAvatar}
                            className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center text-text-inverted opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:opacity-50"
                            title="Upload New Avatar to Firebase Storage"
                        >
                            {isUploadingAvatar ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    <Camera className="h-5 w-5" />
                                    <span className="text-[9px] font-bold mt-0.5">Upload</span>
                                </>
                            )}
                        </button>
                    </div>

                    <div className="flex flex-col items-center sm:items-start gap-1 flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <h3 className="text-base font-bold font-serif text-text">
                                {userName}
                            </h3>
                            <RoleBadge role={userRole} size="sm" />
                        </div>

                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-text-muted">
                            <span className="font-semibold text-text">
                                {userUniversityId}
                            </span>
                            <span>·</span>
                            <span>{userEmail}</span>
                        </div>

                        <div className="pt-2 flex items-center gap-2">
                            {userStatus === 'VERIFIED' ? (
                                <SuccessBadge label="Verified Account" />
                            ) : userStatus === 'SUSPENDED' ? (
                                <WarningBadge label="Account Suspended" />
                            ) : (
                                <InformationBadge label={userStatus} />
                            )}
                            <button
                                type="button"
                                onClick={handleTriggerAvatarUpload}
                                className="text-xs text-accent hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                            >
                                <Upload className="h-3.5 w-3.5" /> Change Photo
                            </button>
                        </div>
                    </div>
                </div>

                {isEditingProfile ? (
                    <div className="flex flex-col gap-3 pt-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <TextField
                                label="First Name"
                                value={profileFirstName}
                                onChange={(event) => setProfileFirstName(event.target.value)}
                                placeholder="Given name"
                                required
                            />
                            <TextField
                                label="Middle Name (Optional)"
                                value={profileMiddleName}
                                onChange={(event) => setProfileMiddleName(event.target.value)}
                                placeholder="Middle name"
                            />
                        </div>
                        <TextField
                            label="Last Name"
                            value={profileLastName}
                            onChange={(event) => setProfileLastName(event.target.value)}
                            placeholder="Family name"
                            required
                        />
                    </div>
                ) : (
                    /* 2-COLUMN INSTITUTIONAL DETAILS GRID */
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-lg bg-surface border border-surface-border flex items-start gap-3">
                            <div className="p-2 rounded-md bg-accent-background text-accent shrink-0 mt-1">
                                <Key className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1 gap-1">
                                <span className="text-text-muted font-medium">University ID</span>
                                <span className="font-semibold text-text truncate">{userUniversityId}</span>
                                <span className="text-text-muted">Official Identifier</span>
                            </div>
                        </div>

                        <div className="p-3 rounded-lg bg-surface border border-surface-border flex items-start gap-3">
                            <div className="p-2 rounded-md bg-accent-background text-accent shrink-0 mt-1">
                                <Building2 className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1 gap-1">
                                <span className="text-text-muted font-medium">Assigned Department</span>
                                <span className="font-semibold text-text truncate">{userDepartment}</span>
                                <span className="text-text-muted">Academic Unit</span>
                            </div>
                        </div>

                        <div className="p-3 rounded-lg bg-surface border border-surface-border flex items-start gap-3">
                            <div className="p-2 rounded-md bg-accent-background text-accent shrink-0 mt-1">
                                <User className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1 gap-1">
                                <span className="text-text-muted font-medium">Full Legal Name</span>
                                <span className="font-semibold text-text truncate">
                                    {userFirstName} {userMiddleName ? `${userMiddleName} ` : ''}{userLastName}
                                </span>
                                <span className="text-text-muted">Primary Record Name</span>
                            </div>
                        </div>

                        <div className="p-3 rounded-lg bg-surface border border-surface-border flex items-start gap-3">
                            <div className="p-2 rounded-md bg-accent-background text-accent shrink-0 mt-1">
                                <Mail className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1 gap-1">
                                <span className="text-text-muted font-medium">University Email</span>
                                <span className="font-semibold text-text truncate">{userEmail}</span>
                                <span className="text-text-muted">Official Mailbox</span>
                            </div>
                        </div>

                        <div className="p-3 rounded-lg bg-surface border border-surface-border flex items-start gap-3">
                            <div className="p-2 rounded-md bg-accent-background text-accent shrink-0 mt-1">
                                <Shield className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1 gap-1">
                                <span className="text-text-muted font-medium">Authentication Method</span>
                                <span className="font-semibold text-text truncate">University SSO / Password</span>
                                <span className="text-text-muted">Security Standard</span>
                            </div>
                        </div>

                        <div className="p-3 rounded-lg bg-surface border border-surface-border flex items-start gap-3">
                            <div className="p-2 rounded-md bg-accent-background text-accent shrink-0 mt-1">
                                <CheckCircle2 className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1 gap-1">
                                <span className="text-text-muted font-medium">Access Status</span>
                                <span className="font-semibold text-accent truncate">{userStatus}</span>
                                <span className="text-text-muted">Institutional Clearance</span>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* 5. SYSTEM SETTINGS 2-PANE MODAL */}
            {isSettingsModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <CardContainer className="max-w-5xl w-full p-6 gap-6 bg-surface border-surface-border shadow-2xl flex flex-col animate-toast-in">
                        {/* MODAL HEADER */}
                        <div className="flex items-center justify-between border-b border-surface-border pb-4 shrink-0">
                            <div className="flex flex-col gap-1">
                                <h2 className="text-base font-bold text-text">
                                    System Settings
                                </h2>
                                <span className="text-xs text-text-muted">
                                    Preferences, appearance, notifications, and security controls
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={handleCloseSettingsModal}
                                className="h-8 w-8 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
                                title="Close modal"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* MODAL 2-PANE BODY */}
                        <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
                            {/* PANE 1: SETTINGS SIDEBAR */}
                            <div className="w-full md:w-48 shrink-0 flex flex-col gap-1">
                                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider px-3 py-1">
                                    Categories
                                </span>
                                {SETTINGS_SECTIONS.map((section) => {
                                    const isActive = activeSettingsSection === section.id;
                                    const IconComponent = section.icon;

                                    return (
                                        <button
                                            key={section.id}
                                            type="button"
                                            onClick={() => setActiveSettingsSection(section.id)}
                                            className={`w-full h-9 px-3 rounded-md flex items-center gap-2 text-xs font-medium transition-colors cursor-pointer ${
                                                isActive
                                                    ? 'bg-accent text-text-inverted font-semibold shadow-xs'
                                                    : 'text-text-muted hover:text-text hover:bg-surface-hover'
                                            }`}
                                        >
                                            <IconComponent className="h-4 w-4 shrink-0" />
                                            <span>{section.label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* PANE 2: SETTINGS CONTENT DETAIL PANE */}
                            <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto p-4 rounded-xl bg-surface-hover/30 border border-surface-border">
                                {/* SECTION 1: APPEARANCE & THEME */}
                                {activeSettingsSection === 'appearance' && (
                                    <div className="flex flex-col gap-4">
                                        <div className="flex flex-col gap-1 border-b border-surface-border pb-3">
                                            <h3 className="text-sm font-bold text-text">
                                                Appearance & Interface Theme
                                            </h3>
                                            <p className="text-xs text-text-muted">
                                                Configure visual tone, dark mode defaults, and workspace control density.
                                            </p>
                                        </div>

                                        {/* THEME MODE SEGMENT SELECTION */}
                                        <div className="p-4 rounded-lg bg-surface border border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex flex-col gap-1 min-w-0 flex-1">
                                                <span className="text-sm font-semibold text-text">
                                                    Interface Theme
                                                </span>
                                                <span className="text-xs text-text-muted leading-relaxed">
                                                    Select light, dark, or automatic system visual preference.
                                                </span>
                                            </div>

                                            <div className="shrink-0">
                                                <SegmentSelection
                                                    value={selectedTheme}
                                                    options={THEME_OPTIONS}
                                                    onChange={handleThemeChange}
                                                />
                                            </div>
                                        </div>

                                        {/* COMPACT VIEW DENSITY SWITCH */}
                                        <div className="p-4 rounded-lg bg-surface border border-surface-border flex items-center justify-between gap-4">
                                            <div className="flex flex-col gap-1 min-w-0 flex-1">
                                                <span className="text-sm font-semibold text-text">
                                                    Compact Workspace Layout
                                                </span>
                                                <span className="text-xs text-text-muted leading-relaxed">
                                                    Condense table row paddings and control gaps for dense records.
                                                </span>
                                            </div>

                                            <div className="shrink-0">
                                                <SwitchSelection
                                                    checked={isCompactModeEnabled}
                                                    onChange={handleToggleCompactMode}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* SECTION 2: NOTIFICATION TIERS */}
                                {activeSettingsSection === 'notifications' && (
                                    <div className="flex flex-col gap-4">
                                        <div className="flex flex-col gap-1 border-b border-surface-border pb-3">
                                            <h3 className="text-sm font-bold text-text">
                                                Notification Preferences
                                            </h3>
                                            <p className="text-xs text-text-muted">
                                                Manage delivery rules, urgent notifications, and summary digest frequency.
                                            </p>
                                        </div>

                                        {/* NOTIFICATION SCOPE SEGMENT SELECTION */}
                                        <div className="p-4 rounded-lg bg-surface border border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex flex-col gap-1 min-w-0 flex-1">
                                                <span className="text-sm font-semibold text-text">
                                                    Notification Delivery Scope
                                                </span>
                                                <span className="text-xs text-text-muted leading-relaxed">
                                                    Choose whether to receive all updates, system notices, or urgent only.
                                                </span>
                                            </div>

                                            <div className="shrink-0">
                                                <SegmentSelection
                                                    value={notificationScope}
                                                    options={NOTIFICATION_SCOPE_OPTIONS}
                                                    onChange={handleNotificationScopeChange}
                                                />
                                            </div>
                                        </div>

                                        {/* EMAIL DIGEST SWITCH */}
                                        <div className="p-4 rounded-lg bg-surface border border-surface-border flex items-center justify-between gap-4">
                                            <div className="flex flex-col gap-1 min-w-0 flex-1">
                                                <span className="text-sm font-semibold text-text">
                                                    Daily Activity Digest Email
                                                </span>
                                                <span className="text-xs text-text-muted leading-relaxed">
                                                    Send end-of-day summary of pending approval queues to {userEmail}.
                                                </span>
                                            </div>

                                            <div className="shrink-0">
                                                <SwitchSelection
                                                    checked={isEmailDigestEnabled}
                                                    onChange={handleToggleEmailDigest}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* SECTION 3: SECURITY & SESSIONS */}
                                {activeSettingsSection === 'security' && (
                                    <div className="flex flex-col gap-4">
                                        <div className="flex flex-col gap-1 border-b border-surface-border pb-3">
                                            <h3 className="text-sm font-bold text-text">
                                                Security & Active Sessions
                                            </h3>
                                            <p className="text-xs text-text-muted">
                                                Manage credential authentication, password policies, and login sessions.
                                            </p>
                                        </div>

                                        {/* CREDENTIAL VERIFICATION */}
                                        <div className="p-4 rounded-lg bg-surface border border-surface-border flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-surface-hover border border-surface-border text-accent">
                                                    <Key className="h-5 w-5" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-text">
                                                        University ID Password
                                                    </span>
                                                    <span className="text-xs text-text-muted">
                                                        Last rotated during semester enrollment.
                                                    </span>
                                                </div>
                                            </div>

                                            <SecondaryButton
                                                label="Change Password"
                                            />
                                        </div>

                                        {/* ACTIVE SESSIONS */}
                                        <div className="flex flex-col gap-2">
                                            <span className="text-xs font-semibold text-text uppercase tracking-wider">
                                                Active Sessions
                                            </span>

                                            <div className="p-4 rounded-lg bg-surface border border-surface-border flex items-center justify-between gap-4 text-xs">
                                                <div className="flex items-center gap-3">
                                                    <Laptop className="h-5 w-5 text-accent" />
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-text">
                                                            Current Session · Chrome on Windows
                                                        </span>
                                                        <span className="text-text-muted">
                                                            IP: 192.168.1.45 · Authenticated via Institutional SSO
                                                        </span>
                                                    </div>
                                                </div>
                                                <SuccessBadge label="Active Now" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* SECTION 4: INSTITUTIONAL POLICY */}
                                {activeSettingsSection === 'system' && (
                                    <div className="flex flex-col gap-4">
                                        <div className="flex flex-col gap-1 border-b border-surface-border pb-3">
                                            <h3 className="text-sm font-bold text-text">
                                                Institutional Record Policy
                                            </h3>
                                            <p className="text-xs text-text-muted">
                                                Compliance and preservation rules across university colleges.
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                            <div className="p-4 rounded-lg bg-surface border border-surface-border flex flex-col gap-2">
                                                <div className="flex items-center gap-2 font-semibold text-text">
                                                    <Lock className="h-4 w-4 text-accent" />
                                                    <span>Encryption Standard</span>
                                                </div>
                                                <span className="text-text-muted leading-relaxed">
                                                    AES-256 GCM Cloud Storage with university access controls.
                                                </span>
                                            </div>

                                            <div className="p-4 rounded-lg bg-surface border border-surface-border flex flex-col gap-2">
                                                <div className="flex items-center gap-2 font-semibold text-text">
                                                    <Mail className="h-4 w-4 text-accent" />
                                                    <span>Domain Enforcement</span>
                                                </div>
                                                <span className="text-text-muted leading-relaxed">
                                                    Restricted to official @plpasig.edu.ph institutional addresses.
                                                </span>
                                            </div>

                                            <div className="p-4 rounded-lg bg-surface border border-surface-border flex flex-col gap-2">
                                                <div className="flex items-center gap-2 font-semibold text-text">
                                                    <HardDrive className="h-4 w-4 text-accent" />
                                                    <span>Retention Schedule</span>
                                                </div>
                                                <span className="text-text-muted leading-relaxed">
                                                    10-year archival retention with automated checksum verification.
                                                </span>
                                            </div>

                                            <div className="p-4 rounded-lg bg-surface border border-surface-border flex flex-col gap-2">
                                                <div className="flex items-center gap-2 font-semibold text-text">
                                                    <Building2 className="h-4 w-4 text-accent" />
                                                    <span>Connected College</span>
                                                </div>
                                                <span className="text-text-muted leading-relaxed">
                                                    {userDepartment}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* MODAL FOOTER */}
                        <div className="flex items-center justify-end border-t border-surface-border pt-4 shrink-0">
                            <SecondaryButton
                                label="Close"
                                onClick={handleCloseSettingsModal}
                            />
                        </div>
                    </CardContainer>
                </div>
            )}
        </div>
    );
};

export default MainLayout;
