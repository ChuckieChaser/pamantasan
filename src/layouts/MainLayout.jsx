// --- IMPORTS ---
import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
    LayoutDashboard,
    Files,
    Inbox,
    Archive,
    Building2,
    Users,
    UserCheck,
    Sun,
    Moon,
    Bell,
    Mail,
    ShieldCheck,
    IdCard,
    LogOut,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/feedback/Modal';
import { NotificationCenter } from '../features/notification/components/NotificationCenter';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useNotification } from '../features/notification/hooks/useNotification';
import { USER_ROLE, USER_STATUS } from '../features/user/userConstants';


// --- CONFIGURATIONS ---
const NAVIGATION_ITEMS = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'documents', label: 'Documents', icon: Files },
    { key: 'requests', label: 'Requests', icon: Inbox },
    { key: 'archives', label: 'Archives', icon: Archive },
];

const ADMIN_NAVIGATION_ITEMS = [
    { key: 'departments', label: 'Departments', icon: Building2 },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'coordinator', label: 'Coordinator', icon: UserCheck },
];

const PAGE_TITLES = {
    dashboard: 'Dashboard',
    documents: 'Manage Documents',
    requests: 'Manage Document Requests',
    archives: 'Archived Documents',
    departments: 'Manage Departments',
    users: 'Manage Users',
    coordinator: 'Coordinator Review Queue',
};


// --- COMPONENTS ---
export const MainLayout = () => {
    // --- HOOKS & ROUTE ---
    const location = useLocation();
    const navigate = useNavigate();
    const { currentUser, handleLogout } = useAuth();
    const { unreadCount, hasUnread, handleGetNotifications } = useNotification();

    // --- LOCAL STATE ---
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [isDark, setIsDark] = useState(() => {
        if (typeof window === 'undefined') return false;
        const saved = localStorage.getItem('pamantasan-theme');
        if (saved) return saved === 'dark';
        return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
    });

    const activeNavigationKey = location.pathname.split('/')[1] || 'dashboard';
    const pageTitle = PAGE_TITLES[activeNavigationKey] || 'Pamantasan EDMS';

    // --- THEME SYNC EFFECT ---
    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('pamantasan-theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('pamantasan-theme', 'light');
        }
    }, [isDark]);

    // --- NOTIFICATION INITIAL FETCH ---
    useEffect(() => {
        if (currentUser?.id) {
            handleGetNotifications({ recipientId: currentUser.id });
        }
    }, [currentUser?.id, handleGetNotifications]);

    // Role-filtered administrative navigation
    const isAdminOrStaff = [
        USER_ROLE.ADMINISTRATOR,
        USER_ROLE.COORDINATOR,
        USER_ROLE.DIRECTOR,
        USER_ROLE.OFFICER,
    ].includes(currentUser?.role);

    const visibleAdminItems = isAdminOrStaff ? ADMIN_NAVIGATION_ITEMS : [];

    // User display details
    const userName = `${currentUser?.givenName ?? currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''}`.trim() || currentUser?.email || 'User';
    const userRole = currentUser?.role ?? USER_ROLE.MEMBER;
    const userStatus = currentUser?.status ?? USER_STATUS.VERIFIED;
    const userDepartment = currentUser?.department?.name ?? currentUser?.departmentId ?? 'General Records';
    const universityId = currentUser?.universityId ?? currentUser?.id ?? 'N/A';
    const userAvatarUrl = currentUser?.googlePhotoUrl ?? currentUser?.avatarPath ?? null;

    // --- HANDLERS ---
    const handleNavigationChange = useCallback((key) => {
        navigate(`/${key}`);
    }, [navigate]);

    const handleToggleTheme = () => {
        setIsDark((prev) => !prev);
    };

    const handleSignOut = async () => {
        try {
            await handleLogout();
            navigate('/login');
        } catch (error) {
            console.error('Logout error:', error);
            navigate('/login');
        }
    };

    // --- HEADER ACTIONS ---
    const headerActions = (
        <div className="flex items-center gap-2">
            {/* Theme Toggle Button */}
            <button
                type="button"
                aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                onClick={handleToggleTheme}
                className="h-9 w-9 rounded-md border border-surface-border bg-surface text-text-muted hover:text-text hover:bg-surface-hover flex items-center justify-center cursor-pointer transition-colors"
            >
                {isDark ? (
                    <Sun className="h-4 w-4 text-warning" />
                ) : (
                    <Moon className="h-4 w-4" />
                )}
            </button>

            {/* Notification Center Trigger */}
            <button
                type="button"
                aria-label={`Notifications ${hasUnread ? `(${unreadCount} unread)` : ''}`}
                title="Notifications"
                onClick={() => setIsNotificationOpen(true)}
                className="relative h-9 w-9 rounded-md border border-surface-border bg-surface text-text-muted hover:text-text hover:bg-surface-hover flex items-center justify-center cursor-pointer transition-colors"
            >
                <Bell className="h-4 w-4" />
                {hasUnread && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-accent text-text-inverted text-[10px] font-bold leading-none shadow-xs animate-in zoom-in">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* User Profile Avatar Trigger */}
            <button
                type="button"
                aria-label="User Account and Clearance"
                title="Account & Clearance"
                onClick={() => setIsAccountModalOpen(true)}
                className="h-9 px-2 rounded-md border border-surface-border bg-surface hover:bg-surface-hover flex items-center gap-2 cursor-pointer transition-colors"
            >
                <Avatar
                    src={userAvatarUrl}
                    alt={userName}
                    size="xs"
                />
                <span className="hidden md:inline-block text-xs font-semibold text-text max-w-[120px] truncate">
                    {userName}
                </span>
            </button>
        </div>
    );

    // --- RENDER ---
    return (
        <>
            <AppShell
                currentUser={currentUser}
                navigationItems={NAVIGATION_ITEMS}
                adminNavigationItems={visibleAdminItems}
                activeNavigationKey={activeNavigationKey}
                onNavigationChange={handleNavigationChange}
                onAccountClick={() => setIsAccountModalOpen(true)}
                onSettingsClick={() => setIsAccountModalOpen(true)}
                onSignOut={handleSignOut}
                pageTitle={pageTitle}
                headerActions={headerActions}
            >
                <Outlet />
            </AppShell>

            {/* Account & Clearance Modal */}
            <Modal
                isOpen={isAccountModalOpen}
                onClose={() => setIsAccountModalOpen(false)}
                title="Account & Security Clearance"
                size="md"
                confirmLabel="Done"
                onConfirm={() => setIsAccountModalOpen(false)}
                footerActions={
                    <Button
                        variant="destructive"
                        size="md"
                        leadingIcon={LogOut}
                        label="Sign Out"
                        onClick={handleSignOut}
                    />
                }
            >
                <div className="flex flex-col gap-4 py-2">
                    {/* User Identity Header Card */}
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-hover border border-surface-border">
                        <Avatar
                            src={userAvatarUrl}
                            alt={userName}
                            size="xl"
                        />
                        <div className="flex flex-col min-w-0 flex-1">
                            <h3 className="text-base font-bold text-text truncate">
                                {userName}
                            </h3>
                            <p className="text-xs text-text-muted truncate">
                                {currentUser?.email}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                                <Badge variant="accent" size="sm">
                                    {userRole}
                                </Badge>
                                <Badge variant="neutral" size="sm">
                                    {userStatus}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {/* Security Clearance Attributes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-lg border border-surface-border bg-surface flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-text-muted">
                                <IdCard className="h-3.5 w-3.5" />
                                <span className="font-medium">University ID</span>
                            </div>
                            <span className="font-semibold text-text font-mono truncate">
                                {universityId}
                            </span>
                        </div>

                        <div className="p-3 rounded-lg border border-surface-border bg-surface flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-text-muted">
                                <Building2 className="h-3.5 w-3.5" />
                                <span className="font-medium">Department</span>
                            </div>
                            <span className="font-semibold text-text truncate">
                                {userDepartment}
                            </span>
                        </div>

                        <div className="p-3 rounded-lg border border-surface-border bg-surface flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-text-muted">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                <span className="font-medium">Clearance Level</span>
                            </div>
                            <span className="font-semibold text-text truncate">
                                {isAdminOrStaff ? 'Administrative' : 'Standard Member'}
                            </span>
                        </div>

                        <div className="p-3 rounded-lg border border-surface-border bg-surface flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-text-muted">
                                <Mail className="h-3.5 w-3.5" />
                                <span className="font-medium">Session Status</span>
                            </div>
                            <span className="font-semibold text-accent truncate">
                                Authenticated
                            </span>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Notification Center Modal */}
            <Modal
                isOpen={isNotificationOpen}
                onClose={() => setIsNotificationOpen(false)}
                title="Notifications"
                size="lg"
                confirmLabel="Done"
                onConfirm={() => setIsNotificationOpen(false)}
            >
                <div className="max-h-[60vh] overflow-y-auto pr-1">
                    <NotificationCenter recipientId={currentUser?.id} />
                </div>
            </Modal>
        </>
    );
};
