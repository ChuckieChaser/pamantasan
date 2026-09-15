// --- IMPORTS ---
import { useState, useMemo, useEffect } from 'react';
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
    UsersPage,
    DepartmentsPage,
    RequestsPage,
} from './pages';
import { MainLayout } from './layouts';
import {
    Inspector,
    ToastProvider,
    ProtectedRoute,
    PublicRoute,
} from './components';
import { useAuth, useToast } from './hooks';
import {
    useCoordinatorStore,
    useDepartmentStore,
    useDocumentStore,
    useNotificationStore,
    useUserStore,
} from './stores';
import { constants } from './constants';


// --- CONFIGURATIONS ---
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
    // STATES: WORKSPACE & INSPECTOR
    const [selectedItem, setSelectedItem] = useState(null);
    const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);

    // HOOKS
    const location = useLocation();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const {
        currentUser,
        isLoading,
        initializeAuthListener,
        loginWithUniversityId,
        loginWithGoogle,
        logout,
    } = useAuth();

    // LISTENERS
    useEffect(() => {
        const unsubscribe = initializeAuthListener();

        return () => {
            unsubscribe?.();
        };
    }, [initializeAuthListener]);

    // STORES
    const notifications = useNotificationStore((state) => state.notifications);
    const unreadNotificationCount = notifications.filter((item) => !item.is_read).length;
    const fetchDepartments = useDepartmentStore((state) => state.fetchDepartments);
    const fetchUsers = useUserStore((state) => state.fetchUsers);
    const fetchDocuments = useDocumentStore((state) => state.fetchDocuments);

    useEffect(() => {
        if (currentUser) {
            fetchDepartments().catch(() => {});
            fetchUsers().catch(() => {});
            fetchDocuments().catch(() => {});
        }
    }, [currentUser, fetchDepartments, fetchUsers, fetchDocuments]);

    // DERIVED VALUES: NAVIGATION & PERMISSIONS
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

    const userRole = currentUser?.role ?? constants.USERS_ROLE.MEMBER;
    const isAdmin = userRole === constants.USERS_ROLE.ADMINISTRATOR;
    const isCoordinator = userRole === constants.USERS_ROLE.COORDINATOR;
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
        if (actionKey === 'revert_version') {
            try {
                const activeDocId = item?.document_id ?? item?.documentId ?? selectedItem?.id;
                if (!activeDocId) {
                    throw new Error('Document identifier not found.');
                }
                const reverted = await useDocumentStore.getState().revertDocumentVersion(
                    activeDocId,
                    item,
                    currentUser?.id ?? 'f1000001-0000-4000-8000-000000000001'
                );
                showToast({
                    type: 'success',
                    title: 'Version Reverted',
                    description: `Successfully restored version v${item.version}.0 as latest snapshot v${reverted.version}.0.`,
                });
            } catch (error) {
                showToast({
                    type: 'error',
                    title: 'Revert Failed',
                    description: error?.message ?? 'Could not revert document version.',
                });
            }
            return;
        }

        if (actionKey === 'download' || actionKey === 'download_version') {
            const downloadUrl = item?.path ?? item?.url ?? item?.downloadUrl;
            if (downloadUrl && downloadUrl.startsWith('http')) {
                window.open(downloadUrl, '_blank');
            }
            showToast({
                type: 'success',
                title: 'Download Initiated',
                description: `Downloading ${item?.name ?? item?.title ?? item?.path ?? 'document version'}...`,
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
            try {
                if (item?.id) {
                    await useDocumentStore.getState().updateDocument(item.id, { isArchived: true });
                }
                showToast({
                    type: 'warning',
                    title: 'Document Archived',
                    description: `${item?.name ?? item?.title} has been moved to archive storage.`,
                });
            } catch (error) {
                showToast({
                    type: 'error',
                    title: 'Archive Failed',
                    description: error?.message ?? 'Could not archive document.',
                });
            }
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
            try {
                if (item?.id) {
                    await useUserStore.getState().updateUser(item.id, { status: constants.USERS_STATUS.VERIFIED });
                }
                showToast({
                    type: 'success',
                    title: 'Account Verified',
                    description: `${item?.first_name ?? item?.firstName ?? item?.name ?? 'User'} is now verified.`,
                });
            } catch (error) {
                showToast({
                    type: 'error',
                    title: 'Verification Failed',
                    description: error?.message ?? 'Could not verify user.',
                });
            }
            return;
        }

        if (actionKey === 'suspend') {
            try {
                if (item?.id) {
                    await useUserStore.getState().updateUser(item.id, { status: constants.USERS_STATUS.SUSPENDED });
                }
                showToast({
                    type: 'warning',
                    title: 'Account Suspended',
                    description: `${item?.first_name ?? item?.firstName ?? item?.name ?? 'User'} account suspended.`,
                });
            } catch (error) {
                showToast({
                    type: 'error',
                    title: 'Suspension Failed',
                    description: error?.message ?? 'Could not suspend user.',
                });
            }
            return;
        }

        if (actionKey === 'delete') {
            showToast({
                type: 'error',
                title: 'Deletion Requested',
                description: `Deletion action triggered for ${item?.name ?? item?.code ?? 'record'}.`,
            });
            return;
        }

        if (actionKey === 'approve') {
            if (item?.action && item?.data) {
                try {
                    const approved = await useCoordinatorStore.getState().updateCoordinatorRequest(
                        item.id,
                        {
                            reviewerId: currentUser?.id ?? 'f1000001-0000-4000-8000-000000000001',
                            status: constants.COORDINATOR_REQUESTS_STATUS.APPROVED,
                        }
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
                    const rejected = await useCoordinatorStore.getState().updateCoordinatorRequest(
                        item.id,
                        {
                            reviewerId: currentUser?.id ?? 'f1000001-0000-4000-8000-000000000001',
                            status: constants.COORDINATOR_REQUESTS_STATUS.REJECTED,
                            rejectionReason: 'Declined by administrator during record review.',
                        }
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

            if (item?.subject) {
                try {
                    await useDocumentStore.getState().updateDocumentRequest(
                        item.id,
                        {
                            status: constants.DOCUMENT_REQUESTS_STATUS.REJECTED,
                        }
                    );
                    showToast({
                        type: 'warning',
                        title: 'Document Request Rejected',
                        description: 'Request marked as rejected.',
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
            try {
                if (item?.id) {
                    await useDocumentStore.getState().updateDocumentRequest(
                        item.id,
                        {
                            status: constants.DOCUMENT_REQUESTS_STATUS.RESOLVED,
                        }
                    );
                }
                showToast({
                    type: 'success',
                    title: 'Request Resolved',
                    description: 'Document clearance request marked as resolved.',
                });
            } catch (error) {
                showToast({
                    type: 'error',
                    title: 'Resolve Failed',
                    description: error?.message ?? 'Could not resolve request.',
                });
            }
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

    // RENDER
    return (
        <Routes>
            {/* 1. PUBLIC-ONLY ROUTES (LOGGED IN USERS AUTO-REDIRECT TO /dashboard) */}
            <Route
                element={
                    <PublicRoute
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
                        <RequestsPage
                            currentUser={currentUser}
                            initialTab="document"
                            onSelectRequest={handleSelectActivity}
                        />
                    }
                />

                {/* ADMINISTRATIVE PROTECTED SUB-ROUTES (ADMINISTRATOR & COORDINATOR ONLY) */}
                <Route
                    element={
                        <ProtectedRoute
                            currentUser={currentUser}
                            allowedRoles={[constants.USERS_ROLE.ADMINISTRATOR, constants.USERS_ROLE.COORDINATOR]}
                            requiredRoleLabel="Administrator or Coordinator"
                        />
                    }
                >
                    <Route
                        path="/departments"
                        element={
                            <DepartmentsPage
                                onSelectDepartment={handleSelectActivity}
                            />
                        }
                    />
                    <Route
                        path="/users"
                        element={
                            <UsersPage
                                onSelectUser={handleSelectActivity}
                            />
                        }
                    />
                    <Route
                        path="/requests"
                        element={
                            <RequestsPage
                                currentUser={currentUser}
                                initialTab="coordinator"
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

const App = () => {
    return (
        <ToastProvider>
            <BrowserRouter>
                <AppContent />
            </BrowserRouter>
        </ToastProvider>
    );
};


// --- EXPORTS ---
export { App };
export default App;
