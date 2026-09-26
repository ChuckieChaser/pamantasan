// --- IMPORTS ---
import { LogOut, Settings as SettingsIcon, Shield, X } from 'lucide-react';
import logoImage from '../../assets/logo.jpg';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Navigation } from './Navigation';


// --- CONFIGURATIONS ---
const DESKTOP_SIDEBAR_STYLE = 'hidden sm:flex w-16 lg:w-60 h-screen sticky top-0 bg-surface border-r border-surface-border flex-col justify-between py-4 px-2.5 shrink-0 z-30 transition-all select-none';
const MOBILE_DRAWER_STYLE = 'fixed inset-y-0 left-0 z-50 w-72 bg-surface border-r border-surface-border flex flex-col justify-between p-4 shadow-2xl animate-in slide-in-from-left duration-200 select-none';


// --- COMPONENTS ---
export const Sidebar = ({
    currentUser = null,
    navigationItems = [],
    adminNavigationItems = [],
    activeNavigationKey = 'dashboard',
    onNavigationChange,
    onAccountClick,
    onSettingsClick,
    onSignOut,
    isMobileOpen = false,
    onMobileClose,
    className = '',
    ...props
}) => {
    // --- DERIVED VALUES ---
    const userName = `${currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''}`.trim() || currentUser?.email || 'User';
    const userEmail = currentUser?.email ?? '';
    const userRole = currentUser?.role ?? 'MEMBER';
    const userAvatarUrl = currentUser?.googlePhotoUrl ?? currentUser?.avatarPath ?? null;

    // --- RENDER CONTENT (Shared by desktop and mobile) ---
    const renderSidebarContent = (isMobile = false) => (
        <>
            {/* Top Logo & App Title */}
            <div className="flex items-center gap-3 px-1 mb-6 shrink-0">
                <img
                    src={logoImage}
                    alt="Pamantasan Logo"
                    className="h-10 w-10 rounded-full object-cover bg-surface shadow-xs shrink-0"
                />

                {(isMobile || !isMobile) && (
                    <div className={`${isMobile ? 'flex' : 'hidden lg:flex'} flex-col min-w-0`}>
                        <span className="text-sm font-bold text-text truncate">
                            Pamantasan
                        </span>
                        <span className="text-[11px] text-text-muted truncate">
                            Enterprise Records
                        </span>
                    </div>
                )}

                {isMobile && (
                    <button
                        type="button"
                        onClick={onMobileClose}
                        aria-label="Close sidebar"
                        className="ml-auto p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-hover cursor-pointer"
                    >
                        <X className="h-5 w-5" />
                    </button>
                )}
            </div>

            {/* Navigation Lists */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-6 no-scrollbar">
                <Navigation
                    items={navigationItems}
                    activeKey={activeNavigationKey}
                    onChange={(key) => {
                        onNavigationChange?.(key);
                        if (isMobile) onMobileClose?.();
                    }}
                    isCollapsed={!isMobile}
                    className={isMobile ? '' : 'items-center lg:items-stretch'}
                />

                {adminNavigationItems?.length > 0 && (
                    <div className="flex flex-col gap-1 pt-4 border-t border-surface-border">
                        {(isMobile || !isMobile) && (
                            <span className={`${isMobile ? 'block' : 'hidden lg:block'} px-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1`}>
                                Administration
                            </span>
                        )}
                        <Navigation
                            items={adminNavigationItems}
                            activeKey={activeNavigationKey}
                            onChange={(key) => {
                                onNavigationChange?.(key);
                                if (isMobile) onMobileClose?.();
                            }}
                            isCollapsed={!isMobile}
                            className={isMobile ? '' : 'items-center lg:items-stretch'}
                        />
                    </div>
                )}
            </div>

            {/* Bottom Profile / Account Area */}
            <div className="pt-4 border-t border-surface-border shrink-0 flex flex-col gap-2">
                <div
                    onClick={onAccountClick}
                    className={`h-11 px-2 rounded-lg flex items-center gap-2.5 hover:bg-surface-hover cursor-pointer transition-colors ${
                        isMobile ? 'justify-start' : 'justify-center lg:justify-start'
                    }`}
                >
                    <Avatar
                        src={userAvatarUrl}
                        alt={userName}
                        size="md"
                    />

                    <div className={`${isMobile ? 'flex' : 'hidden lg:flex'} flex-col min-w-0 flex-1`}>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-text truncate">
                                {userName}
                            </span>
                            {userRole === 'ADMIN' && (
                                <Badge variant="accent" size="sm">
                                    Admin
                                </Badge>
                            )}
                        </div>
                        <span className="text-[11px] text-text-muted truncate">
                            {userEmail}
                        </span>
                    </div>
                </div>

                {/* Mobile Quick Action Buttons */}
                {isMobile && (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                        <button
                            type="button"
                            onClick={onSettingsClick}
                            className="h-9 px-3 text-xs font-medium rounded-md border border-surface-border bg-surface text-text hover:bg-surface-hover inline-flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <SettingsIcon className="h-3.5 w-3.5 text-text-muted" />
                            <span>Settings</span>
                        </button>

                        <button
                            type="button"
                            onClick={onSignOut}
                            className="h-9 px-3 text-xs font-medium rounded-md border border-surface-border bg-surface text-error hover:bg-error-background/50 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <LogOut className="h-3.5 w-3.5" />
                            <span>Sign Out</span>
                        </button>
                    </div>
                )}
            </div>
        </>
    );

    // --- RENDER ---
    return (
        <>
            {/* Desktop Sidebar */}
            <aside
                className={`${DESKTOP_SIDEBAR_STYLE} ${className}`.trim()}
                {...props}
            >
                {renderSidebarContent(false)}
            </aside>

            {/* Mobile Drawer (with backdrop) */}
            {isMobileOpen && (
                <div className="sm:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex animate-in fade-in duration-200">
                    <div
                        onClick={onMobileClose}
                        className="fixed inset-0"
                    />
                    <div className={MOBILE_DRAWER_STYLE}>
                        {renderSidebarContent(true)}
                    </div>
                </div>
            )}
        </>
    );
};
