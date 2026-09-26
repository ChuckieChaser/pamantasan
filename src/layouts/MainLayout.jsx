// --- IMPORTS ---
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
    LayoutDashboard,
    Files,
    Inbox,
    Archive,
    Building2,
    Users,
    UserCheck,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { useAuth } from '../features/auth/hooks/useAuth';
import { USER_ROLE } from '../features/user/userConstants';


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

    const activeNavigationKey = location.pathname.split('/')[1] || 'dashboard';
    const pageTitle = PAGE_TITLES[activeNavigationKey] || 'Pamantasan EDMS';

    // Role-filtered administrative navigation
    const isAdminOrStaff = [
        USER_ROLE.ADMINISTRATOR,
        USER_ROLE.COORDINATOR,
        USER_ROLE.DIRECTOR,
        USER_ROLE.OFFICER,
    ].includes(currentUser?.role);

    const visibleAdminItems = isAdminOrStaff ? ADMIN_NAVIGATION_ITEMS : [];

    // --- HANDLERS ---
    const handleNavigationChange = (key) => {
        navigate(`/${key}`);
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

    return (
        <AppShell
            currentUser={currentUser}
            navigationItems={NAVIGATION_ITEMS}
            adminNavigationItems={visibleAdminItems}
            activeNavigationKey={activeNavigationKey}
            onNavigationChange={handleNavigationChange}
            onSignOut={handleSignOut}
            pageTitle={pageTitle}
        >
            <Outlet />
        </AppShell>
    );
};
