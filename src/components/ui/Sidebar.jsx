// --- IMPORTS ---
import { useState, useRef } from 'react';
import { Shield, Settings as SettingsIcon, LogOut } from 'lucide-react';
import logoImage from '../../assets/logo.jpg';
import {
    Avatar,
    Badge,
    Container,
    NavigationSelection,
} from '../../components';
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

    // DERIVED VALUES
    const composedClassName = `${BASE_STYLE} ${className ?? ''}`.trim();
    const userName = currentUser?.name ?? `${currentUser?.first_name ?? currentUser?.firstName ?? 'Carl'} ${currentUser?.last_name ?? currentUser?.lastName ?? 'Avecilla'}`.trim();
    const userUniversityId = currentUser?.university_id ?? currentUser?.universityId ?? '20-00001';
    const userEmail = currentUser?.email ?? 'admin.rmo@plpasig.edu.ph';
    const userRole = (currentUser?.role ?? constants?.USERS_ROLE?.ADMINISTRATOR ?? 'ADMINISTRATOR').toLowerCase();
    const userAvatar = currentUser?.avatar_path ?? currentUser?.avatarPath ?? null;

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
                            {/* USER PROFILE INFO */}
                            <div className="flex flex-col items-center text-center gap-2 border-b border-surface-border pb-3">
                                <Avatar
                                    src={userAvatar}
                                    alt={userName}
                                    size="extraLarge"
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
