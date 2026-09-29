// --- IMPORTS ---
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Shield, Settings as SettingsIcon, LogOut, CheckCircle2, X } from 'lucide-react';
import logoImage from '../../assets/logo.jpg';
import { Avatar, resolveUserAvatar } from '../Avatar';
import { Badge } from '../Badge';
import { Container } from '../Container';
import { constants } from '../../constants';

// --- CONFIGURATIONS ---
const DESKTOP_CONTAINER_STYLE = 'hidden md:flex h-screen sticky top-0 bg-surface border-r border-surface-border flex-col justify-between shrink-0 z-30 transition-[width] duration-200 ease-in-out will-change-[width] select-none overflow-hidden items-stretch';

// --- COMPONENTS ---
const Sidebar = ({
    currentUser = null,
    navigationItems = [],
    adminNavigationItems = [],
    activeNavigationKey = 'dashboard',
    isMobileOpen = false,
    onCloseMobile,
    onNavigationChange,
    onAccountClick,
    onSettingsClick,
    onSignOut,
    className,
    ...props
}) => {
    // REFS
    const accountReference = useRef(null);
    const mobileAccountReference = useRef(null);
    const mobileDrawerRef = useRef(null);

    // STATES
    const [isAccountFlyoutOpen, setIsAccountFlyoutOpen] = useState(false);
    const [flyoutPosition, setFlyoutPosition] = useState({ left: 12, bottom: 12, width: 288 });
    const [isDesktopExpanded, setIsDesktopExpanded] = useState(() => {
        if (typeof window === 'undefined') return true;
        const stored = localStorage.getItem('pamantasan_desktop_sidebar_expanded');
        return stored === null ? true : stored === 'true';
    });

    // AUTO-DISMISS POPUP ON RESIZE
    useEffect(() => {
        if (!isAccountFlyoutOpen) return;
        const handleResize = () => {
            setIsAccountFlyoutOpen(false);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isAccountFlyoutOpen]);

    // HANDLERS
    const handleNavigationClick = (navigationKey) => {
        onNavigationChange?.(navigationKey);
        onCloseMobile?.();
    };

    const handleToggleDesktopDrawer = () => {
        setIsAccountFlyoutOpen(false);
        setIsDesktopExpanded((prev) => {
            const next = !prev;
            try {
                localStorage.setItem('pamantasan_desktop_sidebar_expanded', String(next));
            } catch {
                // Ignore storage write issues
            }
            return next;
        });
    };

    const handleToggleAccountFlyout = (isMobileTrigger = false) => {
        const triggerElement = isMobileTrigger ? mobileAccountReference.current : accountReference.current;
        if (!isAccountFlyoutOpen && triggerElement) {
            const rect = triggerElement.getBoundingClientRect();
            const spaceRight = window.innerWidth - rect.right;
            const flyoutWidth = 288;

            if (isMobileTrigger && spaceRight < flyoutWidth + 16) {
                // Narrow mobile: keep inside viewport
                setFlyoutPosition({
                    left: Math.max(12, Math.min(rect.left, window.innerWidth - flyoutWidth - 12)),
                    bottom: Math.max(12, window.innerHeight - rect.top + 8),
                    width: Math.min(flyoutWidth, window.innerWidth - 24),
                });
            } else {
                // Desktop (expanded and collapsed) & wide viewports: ALWAYS BESIDE IT
                setFlyoutPosition({
                    left: rect.right + 12,
                    bottom: Math.max(12, window.innerHeight - rect.bottom),
                    width: flyoutWidth,
                });
            }
        }
        setIsAccountFlyoutOpen((previousState) => !previousState);
    };

    const handleAccountClick = (event) => {
        setIsAccountFlyoutOpen(false);
        onAccountClick?.(event);
        onCloseMobile?.();
    };

    const handleSettingsClick = (event) => {
        setIsAccountFlyoutOpen(false);
        onSettingsClick?.(event);
        onCloseMobile?.();
    };

    const handleSignOutClick = (event) => {
        setIsAccountFlyoutOpen(false);
        onSignOut?.(event);
        onCloseMobile?.();
    };

    // REACTIVE AVATAR PREFERENCE
    const [avatarVersion, setAvatarVersion] = useState(0);

    useEffect(() => {
        const handler = () => setAvatarVersion((v) => v + 1);
        window.addEventListener('pamantasan-avatar-changed', handler);
        return () => window.removeEventListener('pamantasan-avatar-changed', handler);
    }, []);

    // DERIVED VALUES
    const desktopWidthClass = isDesktopExpanded
        ? 'w-60 lg:w-64 p-3'
        : 'w-16 p-3';
    const composedClassName = `${DESKTOP_CONTAINER_STYLE} ${desktopWidthClass} ${className ?? ''}`.trim();

    const userName = `${currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''}`.trim() || currentUser?.email || 'User';
    const userUniversityId = currentUser?.universityId ?? '';
    const userEmail = currentUser?.email ?? '';
    const userRole = currentUser?.role ?? constants.USERS_ROLE.MEMBER;
    const userAvatar = resolveUserAvatar(currentUser);

    // REUSABLE ACCOUNT FLYOUT PORTAL (RENDERED DIRECTLY INTO DOCUMENT.BODY OUTSIDE SIDEBAR)
    const renderPortalFlyout = () => {
        if (!isAccountFlyoutOpen || typeof document === 'undefined') return null;

        return createPortal(
            <>
                {/* BACKDROP TO CATCH CLICKS OUTSIDE */}
                <div
                    className="fixed inset-0 z-[9998] bg-transparent"
                    onClick={() => setIsAccountFlyoutOpen(false)}
                />

                {/* FLOATING POPOVER CARD BESIDE THE ACCOUNT BUTTON */}
                <div
                    style={{
                        position: 'fixed',
                        left: `${flyoutPosition.left}px`,
                        bottom: `${flyoutPosition.bottom}px`,
                        width: `${flyoutPosition.width}px`,
                        zIndex: 9999,
                    }}
                    className="animate-toast-in pointer-events-auto select-none"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Container
                        variant="card"
                        className="p-3 gap-2.5 bg-surface border-surface-border shadow-2xl rounded-xl"
                    >
                        {/* USER PROFILE SUMMARY */}
                        <div className="flex flex-col items-center text-center gap-2 p-2.5 rounded-lg bg-surface-hover/60 border border-surface-border/80">
                            <div className="relative">
                                <Avatar
                                    src={userAvatar}
                                    user={currentUser}
                                    alt={userName}
                                    size="large"
                                    className="h-11 w-11 shadow-xs ring-2 ring-accent/20"
                                />
                                {currentUser?.status === constants.USERS_STATUS.VERIFIED && (
                                    <div
                                        className="absolute -bottom-1 -right-1 p-0.5 bg-surface rounded-full shadow-xs"
                                        title="Verified Account"
                                    >
                                        <CheckCircle2 className="h-3.5 w-3.5 text-accent fill-accent/15" />
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col items-center gap-0.5 w-full min-w-0">
                                <span className="font-bold text-xs text-text truncate max-w-full font-serif tracking-tight">
                                    {userName}
                                </span>
                                <div className="flex items-center gap-1.5 text-[10px] text-text-muted font-medium">
                                    <span className="font-mono text-text font-semibold">{userUniversityId || '—'}</span>
                                    {currentUser?.departmentCode && (
                                        <>
                                            <span>·</span>
                                            <span className="uppercase tracking-wider">{currentUser.departmentCode}</span>
                                        </>
                                    )}
                                </div>
                                <span className="text-[11px] text-text-muted truncate max-w-full" title={userEmail}>
                                    {userEmail}
                                </span>
                                <div className="pt-0.5 flex items-center gap-1">
                                    <Badge
                                        variant="neutral"
                                        size="xs"
                                        label={userRole}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* SEMANTIC MENU ACTIONS */}
                        <div className="flex flex-col gap-0.5">
                            {/* MAJOR ACTION: ACCENT */}
                            <button
                                type="button"
                                onClick={handleAccountClick}
                                className="w-full h-8 px-2.5 rounded-lg flex items-center gap-2.5 text-xs font-semibold text-accent hover:bg-accent/10 transition-colors cursor-pointer text-left"
                            >
                                <Shield className="h-4 w-4 text-accent shrink-0" />
                                <span>Account Profile</span>
                            </button>

                            {/* NORMAL ACTION: TEXT */}
                            <button
                                type="button"
                                onClick={handleSettingsClick}
                                className="w-full h-8 px-2.5 rounded-lg flex items-center gap-2.5 text-xs font-medium text-text hover:bg-surface-hover transition-colors cursor-pointer text-left"
                            >
                                <SettingsIcon className="h-4 w-4 text-text-muted shrink-0" />
                                <span>System Settings</span>
                            </button>

                            {/* DESTRUCTIVE ACTION: ERROR */}
                            <button
                                type="button"
                                onClick={handleSignOutClick}
                                className="w-full h-8 px-2.5 rounded-lg flex items-center gap-2.5 text-xs font-semibold text-error hover:bg-error-background transition-colors cursor-pointer text-left"
                            >
                                <LogOut className="h-4 w-4 text-error shrink-0" />
                                <span>Sign Out</span>
                            </button>
                        </div>
                    </Container>
                </div>
            </>,
            document.body
        );
    };

    // RENDER
    return (
        <>
            {/* GLOBAL FLOATING PORTAL FOR ACCOUNT MODAL / FLYOUT */}
            {renderPortalFlyout()}

            {/* MOBILE BACKDROP & SLIDE-OUT DRAWER */}
            {isMobileOpen && (
                <div className="fixed inset-0 z-50 md:hidden bg-background/80 backdrop-blur-xs transition-opacity flex">
                    <div
                        ref={mobileDrawerRef}
                        className="w-72 max-w-[85vw] h-full bg-surface border-r border-surface-border shadow-2xl flex flex-col justify-between p-4 overflow-y-auto"
                    >
                        {/* DRAWER TOP HEADER */}
                        <div className="h-12 flex items-center justify-between pb-3 border-b border-surface-border shrink-0 min-h-[48px] max-h-[48px] overflow-hidden">
                            <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
                                <img
                                    src={logoImage}
                                    alt="Pamantasan Records Logo"
                                    className="h-8 w-8 rounded-full object-cover bg-surface shadow-xs shrink-0"
                                />
                                <div className="flex flex-col min-w-0 overflow-hidden">
                                    <span className="font-serif font-bold text-sm text-text leading-tight truncate whitespace-nowrap select-none">
                                        Pamantasan
                                    </span>
                                    <span className="text-[10px] text-text-muted font-mono leading-none truncate whitespace-nowrap select-none">
                                        Records System
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onCloseMobile}
                                className="h-8 w-8 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-hover cursor-pointer shrink-0"
                                title="Close navigation menu"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* MOBILE DRAWER NAVIGATION: ADMINISTRATION FIRST, WORKSPACE SECOND */}
                        <div className="flex-1 py-2 flex flex-col gap-1 overflow-y-auto">
                            {adminNavigationItems && adminNavigationItems.length > 0 && (
                                <>
                                    <div className="h-5 flex items-center gap-2 px-1 select-none shrink-0">
                                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">
                                            Administration
                                        </span>
                                        <div className="flex-1 h-px bg-surface-border/80" />
                                    </div>
                                    {adminNavigationItems.map((item) => {
                                        const ItemIcon = item.icon;
                                        const isItemActive = activeNavigationKey === (item.key ?? item.value);

                                        return (
                                            <button
                                                key={item.key ?? item.value}
                                                type="button"
                                                onClick={() => handleNavigationClick(item.key ?? item.value)}
                                                className={`w-full h-9 px-2.5 rounded-md flex items-center gap-3 text-xs font-medium transition-colors cursor-pointer text-left ${
                                                    isItemActive
                                                        ? 'bg-accent/15 text-accent font-semibold border-l-2 border-accent'
                                                        : 'text-text-muted hover:text-text hover:bg-surface-hover'
                                                }`}
                                            >
                                                {ItemIcon && <ItemIcon className="h-4.5 w-4.5 shrink-0" />}
                                                <span className="truncate">{item.label}</span>
                                            </button>
                                        );
                                    })}
                                </>
                            )}

                            <div className="h-5 flex items-center gap-2 px-1 select-none shrink-0">
                                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">
                                    Workspace
                                </span>
                                <div className="flex-1 h-px bg-surface-border/80" />
                            </div>
                            {navigationItems.map((item) => {
                                const ItemIcon = item.icon;
                                const isItemActive = activeNavigationKey === (item.key ?? item.value);

                                return (
                                    <button
                                        key={item.key ?? item.value}
                                        type="button"
                                        onClick={() => handleNavigationClick(item.key ?? item.value)}
                                        className={`w-full h-9 px-2.5 rounded-md flex items-center gap-3 text-xs font-medium transition-colors cursor-pointer text-left ${
                                            isItemActive
                                                ? 'bg-accent/15 text-accent font-semibold border-l-2 border-accent'
                                                : 'text-text-muted hover:text-text hover:bg-surface-hover'
                                        }`}
                                    >
                                        {ItemIcon && <ItemIcon className="h-4.5 w-4.5 shrink-0" />}
                                        <span className="truncate">{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* DRAWER USER PROFILE BUTTON [ ( ICON ) NAME / ID ] */}
                        <div ref={mobileAccountReference} className="relative pt-3 border-t border-surface-border shrink-0">
                            <button
                                type="button"
                                onClick={() => handleToggleAccountFlyout(true)}
                                className={`w-full p-2 rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer text-left ${
                                    isAccountFlyoutOpen
                                        ? 'bg-surface-hover ring-1 ring-accent'
                                        : 'hover:bg-surface-hover'
                                }`}
                                title="Account profile & settings"
                            >
                                <Avatar
                                    src={userAvatar}
                                    user={currentUser}
                                    alt={userName}
                                    size="small"
                                    className="h-8 w-8 shrink-0 ring-1 ring-accent/20"
                                />
                                <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                                    <span className="font-semibold text-xs text-text truncate leading-tight">
                                        {userName}
                                    </span>
                                    <span className="text-[10px] text-text-muted font-mono truncate leading-none mt-0.5">
                                        {userUniversityId || userEmail}
                                    </span>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DESKTOP SIDEBAR (EXPANDED OR COLLAPSED WITH EXACT GEOMETRIC PARITY) */}
            <aside
                className={composedClassName}
                {...props}
            >
                {/* TOP HEADER: BESIDE LOGO COLLAPSE (<) ON OPEN, LOGO TRIGGER (>) ON CLOSED */}
                {isDesktopExpanded ? (
                    <div className="h-12 flex items-center justify-between pb-3 border-b border-surface-border shrink-0 min-h-[48px] max-h-[48px] overflow-hidden">
                        <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
                            <button
                                type="button"
                                onClick={handleToggleDesktopDrawer}
                                className="rounded-full transition-transform hover:scale-105 cursor-pointer shrink-0"
                                title="Collapse sidebar"
                            >
                                <img
                                    src={logoImage}
                                    alt="Pamantasan Records Logo"
                                    className="h-8 w-8 rounded-full object-cover bg-surface shadow-xs shrink-0"
                                />
                            </button>
                            <div className="flex flex-col min-w-0 overflow-hidden">
                                <span className="font-serif font-bold text-sm text-text leading-tight truncate whitespace-nowrap select-none">
                                    Pamantasan
                                </span>
                                <span className="text-[10px] text-text-muted font-mono leading-none truncate whitespace-nowrap select-none">
                                    Records System
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleToggleDesktopDrawer}
                            className="h-7 w-7 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
                            title="Collapse sidebar"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                    </div>
                ) : (
                    <div className="h-12 flex items-center pb-3 border-b border-surface-border shrink-0 min-h-[48px] max-h-[48px] overflow-hidden">
                        <button
                            type="button"
                            onClick={handleToggleDesktopDrawer}
                            className="h-8 w-8 rounded-full flex items-center justify-center relative group cursor-pointer shrink-0"
                            title="Expand sidebar"
                        >
                            <img
                                src={logoImage}
                                alt="Pamantasan Records Logo"
                                className="h-8 w-8 rounded-full object-cover bg-surface shadow-xs shrink-0"
                            />
                            <div className="absolute inset-0 bg-accent/20 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <ChevronRight className="h-4 w-4 text-accent" />
                            </div>
                        </button>
                    </div>
                )}

                {/* NAVIGATION (EXACT IDENTICAL GEOMETRY: ADMINISTRATION FIRST, WORKSPACE SECOND) */}
                <div className="flex-1 py-2 flex flex-col gap-1 overflow-y-auto w-full">
                    {/* SECTION 1: ADMINISTRATION (HEADER -------- ON OPEN, ---- ON CLOSE) */}
                    {adminNavigationItems && adminNavigationItems.length > 0 && (
                        <>
                            <div
                                className="h-5 flex items-center gap-2 px-1 select-none shrink-0"
                                title={!isDesktopExpanded ? 'Administration' : undefined}
                            >
                                {isDesktopExpanded && (
                                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider whitespace-nowrap select-none">
                                        Administration
                                    </span>
                                )}
                                <div className="flex-1 h-px bg-surface-border/80" />
                            </div>
                            {adminNavigationItems.map((item) => {
                                const ItemIcon = item.icon;
                                const isItemActive = activeNavigationKey === (item.key ?? item.value);

                                return (
                                    <button
                                        key={item.key ?? item.value}
                                        type="button"
                                        onClick={() => handleNavigationClick(item.key ?? item.value)}
                                        title={!isDesktopExpanded ? item.label : undefined}
                                        className={`w-full h-9 px-2.5 rounded-md flex items-center gap-3 text-xs font-medium transition-colors cursor-pointer text-left overflow-hidden shrink-0 ${
                                            isItemActive
                                                ? 'bg-accent/15 text-accent font-semibold border-l-2 border-accent'
                                                : 'text-text-muted hover:text-text hover:bg-surface-hover'
                                        }`}
                                    >
                                        {ItemIcon && <ItemIcon className="h-4.5 w-4.5 shrink-0" />}
                                        {isDesktopExpanded && <span className="truncate whitespace-nowrap">{item.label}</span>}
                                    </button>
                                );
                            })}
                        </>
                    )}

                    {/* SECTION 2: WORKSPACE (HEADER -------- ON OPEN, ---- ON CLOSE, ZERO EXTRA PADDING) */}
                    <div
                        className="h-5 flex items-center gap-2 px-1 select-none shrink-0"
                        title={!isDesktopExpanded ? 'Workspace' : undefined}
                    >
                        {isDesktopExpanded && (
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider whitespace-nowrap select-none">
                                Workspace
                            </span>
                        )}
                        <div className="flex-1 h-px bg-surface-border/80" />
                    </div>
                    {navigationItems.map((item) => {
                        const ItemIcon = item.icon;
                        const isItemActive = activeNavigationKey === (item.key ?? item.value);

                        return (
                            <button
                                key={item.key ?? item.value}
                                type="button"
                                onClick={() => handleNavigationClick(item.key ?? item.value)}
                                title={!isDesktopExpanded ? item.label : undefined}
                                className={`w-full h-9 px-2.5 rounded-md flex items-center gap-3 text-xs font-medium transition-colors cursor-pointer text-left overflow-hidden shrink-0 ${
                                    isItemActive
                                        ? 'bg-accent/15 text-accent font-semibold border-l-2 border-accent'
                                        : 'text-text-muted hover:text-text hover:bg-surface-hover'
                                }`}
                            >
                                {ItemIcon && <ItemIcon className="h-4.5 w-4.5 shrink-0" />}
                                {isDesktopExpanded && <span className="truncate whitespace-nowrap">{item.label}</span>}
                            </button>
                        );
                    })}
                </div>

                {/* BOTTOM ACCOUNT BUTTON [ ( ICON ) NAME / ID ] */}
                <div ref={accountReference} className="relative pt-3 border-t border-surface-border shrink-0 w-full">
                    <button
                        type="button"
                        onClick={() => handleToggleAccountFlyout(false)}
                        className={`w-full ${isDesktopExpanded ? 'p-2' : 'p-1'} rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer text-left overflow-hidden ${
                            isAccountFlyoutOpen
                                ? 'bg-surface-hover ring-1 ring-accent'
                                : 'hover:bg-surface-hover'
                        }`}
                        title={!isDesktopExpanded ? `${userName} (${userUniversityId || 'Account'})` : 'Account profile & settings'}
                    >
                        <Avatar
                            src={userAvatar}
                            user={currentUser}
                            alt={userName}
                            size="small"
                            className="h-8 w-8 shrink-0 ring-1 ring-accent/20"
                        />
                        {isDesktopExpanded && (
                            <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                                <span className="font-semibold text-xs text-text truncate leading-tight">
                                    {userName}
                                </span>
                                <span className="text-[10px] text-text-muted font-mono truncate leading-none mt-0.5">
                                    {userUniversityId || userEmail}
                                </span>
                            </div>
                        )}
                    </button>
                </div>
            </aside>
        </>
    );
};

// --- EXPORTS ---
export { Sidebar };
