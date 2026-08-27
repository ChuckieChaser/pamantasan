// --- IMPORTS ---
import { useState, useMemo } from 'react';
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
    useLocation,
    useNavigate,
} from 'react-router-dom';
import {
    LayoutDashboard,
    Files,
    FilePlus,
    Users,
    Building2,
    Inbox,
} from 'lucide-react';
import {
    LoginPage,
    ForgotPasswordPage,
    DashboardPage,
    DocumentsPage,
    RequestDocumentPage,
    UsersPage,
    DepartmentsPage,
    RequestsPage,
} from './pages';
import { MainLayout } from './layouts';
import {
    Inspector,
    ToastProvider,
    ProtectedRoute,
    PublicOnlyRoute,
    useToast,
} from './components';
import { useAuth } from './hooks';
import {
    useNotificationStore,
    useCoordinatorRequestStore,
} from './stores';
import { USER_ROLES } from './constants';

// --- MODULE-LEVEL CONSTANTS ---
const PAGE_TITLES = {
    dashboard: 'Dashboard',
    documents: 'Manage Documents',
    request_document: 'Manage Document Requests',
    departments: 'Manage Departments',
    users: 'Manage Users',
    requests: 'Manage Requests',
};

// --- COMPONENTS ---
const AppContent = () => {
    // HOOKS
    const location = useLocation();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { currentUser, isLoading, loginWithUniversityId, loginWithGoogle, logout } = useAuth();

    // STORES
    const notifications = useNotificationStore((state) => state.notifications);
    const unreadNotificationCount = notifications.filter((item) => !item.is_read).length;

    // WORKSPACE & INSPECTOR STATES
    const [selectedItem, setSelectedItem] = useState(null);
    const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);

    // DERIVED VALUES: CURRENT NAVIGATION KEY
    const activeNavigationKey = useMemo(() => {
        const path = location.pathname;
        if (path.startsWith('/documents')) {
            return 'documents';
        }
        if (path.startsWith('/request-document')) {
            return 'request_document';
        }
        if (path.startsWith('/departments')) {
            return 'departments';
        }
        if (path.startsWith('/users')) {
            return 'users';
        }
        if (path.startsWith('/requests')) {
            return 'requests';
        }
        return 'dashboard';
    }, [location.pathname]);

    const userRole = currentUser?.role ?? USER_ROLES.MEMBER;
    const isAdmin = userRole === USER_ROLES.ADMINISTRATOR;
    const isCoordinator = userRole === USER_ROLES.COORDINATOR;
    const canRequestDocument = !isAdmin && !isCoordinator;
    const pageTitle = PAGE_TITLES[activeNavigationKey] ?? 'Dashboard';

    const generalNavigationItems = useMemo(() => {
        const items = [
            {
                key: 'dashboard',
                value: 'dashboard',
                label: 'Dashboard',
                title: 'Dashboard',
                icon: LayoutDashboard,
            },
            {
                key: 'documents',
                value: 'documents',
                label: 'Documents',
                title: 'Manage Documents',
                icon: Files,
            },
        ];

        if (canRequestDocument) {
            items.push({
                key: 'request_document',
                value: 'request_document',
                label: 'Document Requests',
                title: 'Manage Document Requests',
                icon: FilePlus,
            });
        }

        return items;
    }, [canRequestDocument]);

    const adminNavigationItems = useMemo(() => {
        if (!isAdmin && !isCoordinator) {
            return [];
        }

        return [
            {
                key: 'departments',
                value: 'departments',
                label: 'Departments',
                title: 'Manage Departments',
                icon: Building2,
            },
            {
                key: 'users',
                value: 'users',
                label: 'Users',
                title: 'Manage Users',
                icon: Users,
            },
            {
                key: 'requests',
                value: 'requests',
                label: 'Requests',
                title: 'Manage Requests',
                icon: Inbox,
            },
        ];
    }, [isAdmin, isCoordinator]);

    // HANDLERS
    const handleLoginSuccess = async ({ universityId, email, password }) => {
        const identifier = universityId ?? email;
        const authenticatedUser = await loginWithUniversityId(identifier, password);
        showToast({
            title: 'Authentication Successful',
            description: `Welcome to Pamantasan Records, ${authenticatedUser.name ?? authenticatedUser.email}.`,
            variant: 'success',
        });
        navigate('/dashboard');
    };

    const handleGoogleLogin = async () => {
        const authenticatedUser = await loginWithGoogle();
        showToast({
            title: 'Google SSO Verified',
            description: `Signed in with ${authenticatedUser.email}.`,
            variant: 'success',
        });
        navigate('/dashboard');
    };

    const handleSignOut = async () => {
        try {
            await logout();
            setSelectedItem(null);
            setIsDetailPanelOpen(false);
            navigate('/login');
            showToast({
                title: 'Signed Out',
                description: 'You have been safely signed out.',
                variant: 'information',
            });
        } catch (error) {
            showToast({
                title: 'Sign Out Error',
                description: error?.message || 'Failed to sign out.',
                variant: 'error',
            });
        }
    };

    const handleNavigationChange = (navigationKey) => {
        setSelectedItem(null);
        const targetPath =
            navigationKey === 'request_document'
                ? '/request-document'
                : `/${navigationKey}`;
        navigate(targetPath);
    };

    const handleToggleDetailPanel = () => {
        setIsDetailPanelOpen((previousState) => !previousState);
    };

    const handleCloseDetailPanel = () => {
        setIsDetailPanelOpen(false);
    };

    const handleSelectActivity = (activityItem) => {
        setSelectedItem(activityItem);
        if (activityItem) {
            setIsDetailPanelOpen(true);
        }
    };

    const handleDetailAction = async (actionKey, item) => {
        if (actionKey === 'download' || actionKey === 'download_version') {
            showToast({
                type: 'success',
                title: 'Download Initiated',
                description: `Downloading ${item?.name ?? item?.title ?? item?.path ?? 'file'}...`,
            });
            return;
        }

        if (actionKey === 'share') {
            showToast({
                type: 'information',
                title: 'Share Settings',
                description: `Permissions panel opened for ${item?.name ?? item?.title}.`,
            });
            return;
        }

        if (actionKey === 'archive') {
            showToast({
                type: 'warning',
                title: 'Document Archived',
                description: `${item?.name ?? item?.title} has been moved to archive storage.`,
            });
            return;
        }

        if (actionKey === 'open' || actionKey === 'open_folder') {
            if (item?.subject) {
                navigate('/requests');
                return;
            }
            showToast({
                type: 'information',
                title: 'Record Opened',
                description: `Viewing ${item?.name ?? item?.title}.`,
            });
            return;
        }

        if (actionKey === 'edit') {
            showToast({
                type: 'information',
                title: 'Edit Form',
                description: `Edit dialog opened for ${item?.name ?? item?.title ?? item?.code}.`,
            });
            return;
        }

        if (actionKey === 'verify') {
            showToast({
                type: 'success',
                title: 'Account Verified',
                description: `${item?.first_name ?? ''} ${item?.last_name ?? ''} is now verified.`,
            });
            return;
        }

        if (actionKey === 'suspend') {
            showToast({
                type: 'warning',
                title: 'Account Suspended',
                description: `${item?.first_name ?? ''} ${item?.last_name ?? ''} account suspended.`,
            });
            return;
        }

        if (actionKey === 'delete') {
            showToast({
                type: 'error',
                title: 'Deletion Pending Confirmation',
                description: `Requested deletion for ${item?.name ?? item?.code}.`,
            });
            return;
        }

        if (actionKey === 'approve') {
            if (item?.action && item?.data) {
                try {
                    const approved = await useCoordinatorRequestStore.getState().approveCoordinatorRequest(
                        item.id,
                        currentUser?.id ?? 'f1000001-0000-4000-8000-000000000001'
                    );
                    setSelectedItem(approved);
                    showToast({
                        type: 'success',
                        title: 'Request Approved & Executed',
                        description: `Action "${item.action}" has been executed with Administrator privileges.`,
                    });
                } catch (error) {
                    showToast({
                        type: 'error',
                        title: 'Approval Failed',
                        description: error?.message ?? 'Could not approve request.',
                    });
                }
                return;
            }

            showToast({
                type: 'success',
                title: 'Request Approved',
                description: 'Governance request has been approved.',
            });
            return;
        }

        if (actionKey === 'reject') {
            if (item?.action && item?.data) {
                try {
                    const rejected = await useCoordinatorRequestStore.getState().rejectCoordinatorRequest(
                        item.id,
                        'Declined by administrator during record review.',
                        currentUser?.id ?? 'f1000001-0000-4000-8000-000000000001'
                    );
                    setSelectedItem(rejected);
                    showToast({
                        type: 'warning',
                        title: 'Request Rejected',
                        description: `Action "${item.action}" was rejected.`,
                    });
                } catch (error) {
                    showToast({
                        type: 'error',
                        title: 'Rejection Failed',
                        description: error?.message ?? 'Could not reject request.',
                    });
                }
                return;
            }

            showToast({
                type: 'warning',
                title: 'Request Rejected',
                description: 'Governance request was rejected.',
            });
            return;
        }

        if (actionKey === 'resolve') {
            showToast({
                type: 'success',
                title: 'Request Resolved',
                description: 'Document clearance request marked as resolved.',
            });
            return;
        }

        if (actionKey === 'reopen') {
            showToast({
                type: 'information',
                title: 'Request Reopened',
                description: 'Governance request reopened for re-evaluation.',
            });
        }
    };

    const handleUploadDocument = () => {
        showToast({
            title: 'Upload Document',
            description: 'Document upload flow will be configured next.',
            variant: 'information',
        });
    };

    const handleRequestDocument = () => {
        navigate('/request-document');
    };

    return (
        <Routes>
            {/* 1. PUBLIC-ONLY ROUTES (LOGGED IN USERS AUTO-REDIRECT TO /dashboard) */}
            <Route
                element={
                    <PublicOnlyRoute
                        currentUser={currentUser}
                        isLoading={isLoading}
                    />
                }
            >
                <Route
                    path="/login"
                    element={
                        <LoginPage
                            onLoginSuccess={handleLoginSuccess}
                            onGoogleLogin={handleGoogleLogin}
                            onForgotPasswordClick={() => navigate('/forgot-password')}
                        />
                    }
                />
                <Route
                    path="/forgot-password"
                    element={<ForgotPasswordPage onBackToLogin={() => navigate('/login')} />}
                />
            </Route>

            {/* 2. AUTHENTICATED PROTECTED SHELL (REQUIRES LOGGED IN USER) */}
            <Route
                element={
                    <ProtectedRoute
                        currentUser={currentUser}
                        isLoading={isLoading}
                    >
                        <MainLayout
                            currentUser={currentUser}
                            navigationItems={generalNavigationItems}
                            adminNavigationItems={adminNavigationItems}
                            activeNavigationKey={activeNavigationKey}
                            pageTitle={pageTitle}
                            notificationCount={unreadNotificationCount}
                            hasUnreadNotifications={unreadNotificationCount > 0}
                            isDetailPanelOpen={isDetailPanelOpen}
                            detailPanelTitle={selectedItem ? 'Record Inspector' : 'Inspector'}
                            detailPanelContent={
                                <Inspector
                                    item={selectedItem}
                                    currentUser={currentUser}
                                    onClose={handleCloseDetailPanel}
                                    onAction={handleDetailAction}
                                />
                            }
                            onNavigationChange={handleNavigationChange}
                            onToggleDetailPanel={handleToggleDetailPanel}
                            onCloseDetailPanel={handleCloseDetailPanel}
                            onSignOut={handleSignOut}
                        />
                    </ProtectedRoute>
                }
            >
                {/* ROOT REDIRECT */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />

                {/* GENERAL AUTHENTICATED PAGES */}
                <Route
                    path="/dashboard"
                    element={
                        <DashboardPage
                            currentUser={currentUser}
                            onNavigate={handleNavigationChange}
                            onUploadDocument={handleUploadDocument}
                            onRequestDocument={handleRequestDocument}
                            onSelectActivity={handleSelectActivity}
                        />
                    }
                />
                <Route
                    path="/documents"
                    element={
                        <DocumentsPage
                            currentUser={currentUser}
                            onUploadDocument={handleUploadDocument}
                            onSelectDocument={handleSelectActivity}
                        />
                    }
                />
                <Route
                    path="/request-document"
                    element={
                        <RequestDocumentPage
                            currentUser={currentUser}
                            onSelectDocument={handleSelectActivity}
                        />
                    }
                />

                {/* ADMINISTRATIVE PROTECTED SUB-ROUTES (ADMINISTRATOR & COORDINATOR ONLY) */}
                <Route
                    element={
                        <ProtectedRoute
                            currentUser={currentUser}
                            allowedRoles={[USER_ROLES.ADMINISTRATOR, USER_ROLES.COORDINATOR]}
                            requiredRoleLabel="Administrator or Coordinator"
                        />
                    }
                >
                    <Route
                        path="/departments"
                        element={
                            <DepartmentsPage
                                currentUser={currentUser}
                                onSelectDepartment={handleSelectActivity}
                            />
                        }
                    />
                    <Route
                        path="/users"
                        element={
                            <UsersPage
                                currentUser={currentUser}
                                onSelectUser={handleSelectActivity}
                            />
                        }
                    />
                    <Route
                        path="/requests"
                        element={
                            <RequestsPage
                                currentUser={currentUser}
                                onSelectRequest={handleSelectActivity}
                            />
                        }
                    />
                </Route>

                {/* CATCH-ALL REDIRECT TO DASHBOARD */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
        </Routes>
    );
};

export default function App() {
    return (
        <ToastProvider>
            <BrowserRouter>
                <AppContent />
            </BrowserRouter>
        </ToastProvider>
    );
}
