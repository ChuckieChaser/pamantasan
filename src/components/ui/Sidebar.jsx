// --- IMPORTS ---
import { useState, useEffect, useRef } from 'react';
import { Shield, Settings as SettingsIcon, LogOut, CheckCircle2 } from 'lucide-react';
import logoImage from '../../assets/logo.jpg';
import { Avatar, resolveUserAvatar } from '../Avatar';
import { Badge } from '../Badge';
import { Container } from '../Container';
import { NavigationSelection } from '../Selections';
import { useClickOutside } from '../../hooks';
import { constants } from '../../constants';

// --- CONFIGURATIONS ---
const BASE_STYLE = 'w-16 h-screen sticky top-0 bg-surface border-r border-surface-border flex flex-col justify-between items-center py-4 shrink-0 z-30 transition-transform duration-200';
const POPOVER_STYLE = 'absolute left-16 bottom-0 z-50 w-72';

// --- COMPONENTS ---
const Sidebar = ({
    currentUser = null,
    navigationItems = [],
    adminNavigationItems = [],
    activeNavigationKey = 'dashboard',
    onNavigationChange,
    onAccountClick,
    onSettingsClick,
    onSignOut,
    className,
    ...props
}) => {
    // REFS
    const accountReference = useRef(null);

    // STATES
    const [isAccountFlyoutOpen, setIsAccountFlyoutOpen] = useState(false);

    // HOOKS
    useClickOutside(accountReference, () => {
        setIsAccountFlyoutOpen(false);
    });

    // HANDLERS
    const handleNavigationClick = (navigationKey) => {
        onNavigationChange?.(navigationKey);
    };

    const handleToggleAccountFlyout = () => {
        setIsAccountFlyoutOpen((previousState) => !previousState);
    };

    const handleAccountClick = (event) => {
        setIsAccountFlyoutOpen(false);
        onAccountClick?.(event);
    };

    const handleSettingsClick = (event) => {
        setIsAccountFlyoutOpen(false);
        onSettingsClick?.(event);
    };

    const handleSignOutClick = (event) => {
        setIsAccountFlyoutOpen(false);
        onSignOut?.(event);
    };

    // REACTIVE AVATAR PREFERENCE
    const [avatarVersion, setAvatarVersion] = useState(0);

    useEffect(() => {
        const handler = () => setAvatarVersion((v) => v + 1);
        window.addEventListener('pamantasan-avatar-changed', handler);
        return () => window.removeEventListener('pamantasan-avatar-changed', handler);
    }, []);

    // DERIVED VALUES
    const composedClassName = `${BASE_STYLE} ${className ?? ''}`.trim();
    const userName = `${currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''}`.trim() || currentUser?.email || 'User';
    const userUniversityId = currentUser?.universityId ?? '';
    const userEmail = currentUser?.email ?? '';
    const userRole = currentUser?.role ?? constants.USERS_ROLE.MEMBER;
    const userAvatar = resolveUserAvatar(currentUser);

    // RENDER
    return (
        <aside
            className={composedClassName}
            {...props}
        >
            {/* TOP LOGO */}
            <div className="flex flex-col items-center justify-center shrink-0">
                <img
                    src={logoImage}
                    alt="Pamantasan Records Logo"
                    className="h-10 w-10 rounded-full object-cover bg-surface shadow-sm shrink-0"
                />
            </div>

            {/* CENTER NAVIGATION */}
            <div className="my-auto flex flex-col items-center justify-center gap-2">
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

                {adminNavigationItems && adminNavigationItems.length > 0 && (
                    <div className="w-8 border-t border-surface-border my-1" />
                )}

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

            {/* BOTTOM ACCOUNT FLYOUT */}
            <div
                ref={accountReference}
                className="relative flex flex-col items-center w-full shrink-0"
            >
                <button
                    type="button"
                    onClick={handleToggleAccountFlyout}
                    className={`rounded-full transition-colors flex items-center justify-center cursor-pointer shrink-0 ${
                        isAccountFlyoutOpen
                            ? 'ring-2 ring-accent'
                            : 'hover:ring-2 hover:ring-accent-border'
                    }`}
                    title="Account profile & settings"
                >
                    <Avatar
                        src={userAvatar}
                        alt={userName}
                        size="large"
                        className="h-10 w-10"
                    />
                </button>

                {isAccountFlyoutOpen && (
                    <div className={POPOVER_STYLE}>
                        <Container
                            variant="card"
                            className="p-4 gap-3 bg-surface border-surface-border shadow-xl"
                        >
                            {/* USER PROFILE CARD */}
                            <div className="flex flex-col items-center text-center gap-2.5 p-3 rounded-xl bg-surface-hover/60 border border-surface-border/80">
                                <div className="relative">
                                    <Avatar
                                        src={userAvatar}
                                        user={currentUser}
                                        alt={userName}
                                        size="extraLarge"
                                        className="h-14 w-14 shadow-sm ring-2 ring-accent/20"
                                    />
                                    {currentUser?.status === constants.USERS_STATUS.VERIFIED && (
                                        <div
                                            className="absolute -bottom-1 -right-1 p-0.5 bg-surface rounded-full shadow-xs"
                                            title="Verified Account"
                                        >
                                            <CheckCircle2 className="h-4 w-4 text-accent fill-accent/15" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col items-center gap-1 w-full min-w-0">
                                    <span className="font-bold text-sm text-text truncate max-w-full font-serif tracking-tight">
                                        {userName}
                                    </span>
                                    <div className="flex items-center gap-1.5 text-[11px] text-text-muted font-medium">
                                        <span className="font-mono text-text font-semibold">{userUniversityId || '—'}</span>
                                        {currentUser?.departmentCode && (
                                            <>
                                                <span>·</span>
                                                <span className="uppercase tracking-wider">{currentUser.departmentCode}</span>
                                            </>
                                        )}
                                    </div>
                                    <span className="text-xs text-text-muted truncate max-w-full" title={userEmail}>
                                        {userEmail}
                                    </span>
                                    <div className="pt-1 flex items-center gap-1.5">
                                        <Badge
                                            variant="neutral"
                                            label={userRole}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* MENU ACTIONS */}
                            <div className="flex flex-col gap-1">
                                <button
                                    type="button"
                                    onClick={handleAccountClick}
                                    className="w-full h-8 px-3 rounded-md flex items-center gap-2 text-xs font-medium text-text hover:bg-surface-hover transition-colors cursor-pointer"
                                >
                                    <Shield className="h-4 w-4 text-text-muted" />
                                    <span>Account Profile</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleSettingsClick}
                                    className="w-full h-8 px-3 rounded-md flex items-center gap-2 text-xs font-medium text-text hover:bg-surface-hover transition-colors cursor-pointer"
                                >
                                    <SettingsIcon className="h-4 w-4 text-text-muted" />
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
                        </Container>
                    </div>
                )}
            </div>
        </aside>
    );
};

// --- EXPORTS ---
export { Sidebar };
