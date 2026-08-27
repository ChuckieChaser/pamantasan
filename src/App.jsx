// --- IMPORTS ---
import { useState, useMemo } from 'react';
import {
    LayoutDashboard,
    Files,
    FilePlus,
    Users,
    Building2,
    UserCheck,
    Inbox,
    Calendar,
    User,
    Download,
    Share2,
} from 'lucide-react';
import logoImage from './assets/logo.jpg';
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
    PrimaryButton,
    SecondaryButton,
    Badge,
    RoleBadge,
    StatusBadge,
    ClassificationBadge,
    Inspector,
    ToastProvider,
    useToast,
} from './components';
import { useAuth } from './hooks';
import {
    useNotificationStore,
    useCoordinatorRequestStore,
} from './stores';
import { USER_ROLES, DOCUMENT_CLASSIFICATIONS } from './constants';

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
    const { showToast } = useToast();
    const { currentUser, isLoading, loginWithUniversityId, loginWithGoogle, logout } = useAuth();

    // STORES
    const notifications = useNotificationStore((state) => state.notifications);
    const unreadNotificationCount = notifications.filter((item) => !item.is_read).length;

    // NAVIGATION & WORKSPACE STATES
    const [authScreen, setAuthScreen] = useState('login');
    const [activeNavigationKey, setActiveNavigationKey] = useState('dashboard');
    const [selectedItem, setSelectedItem] = useState(null);
    const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);

    // DERIVED VALUES
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
        if (!isAdmin) {
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
    }, [isAdmin]);

    // HANDLERS
    const handleLoginSuccess = async ({ universityId, email, password }) => {
        const identifier = universityId ?? email;
        const authenticatedUser = await loginWithUniversityId(identifier, password);
        showToast({
            title: 'Authentication Successful',
            description: `Welcome to Pamantasan Records, ${authenticatedUser.name ?? authenticatedUser.email}.`,
            variant: 'success',
        });
    };

    const handleGoogleLogin = async () => {
        const authenticatedUser = await loginWithGoogle();
        showToast({
            title: 'Google SSO Verified',
            description: `Signed in with ${authenticatedUser.email}.`,
            variant: 'success',
        });
    };

    const handleForgotPasswordClick = () => {
        setAuthScreen('forgot_password');
    };

    const handleBackToLogin = () => {
        setAuthScreen('login');
    };

    const handleSignOut = async () => {
        try {
            await logout();
            setSelectedItem(null);
            setIsDetailPanelOpen(false);
            setAuthScreen('login');
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

    // HANDLERS
    const handleNavigationChange = (navigationKey) => {
        setActiveNavigationKey(navigationKey);
        setSelectedItem(null);
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
                setActiveNavigationKey('requests');
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
        showToast({
            title: 'New Document Request',
            description: 'Document request builder will be configured next.',
            variant: 'information',
        });
    };

    // RENDER: LOADING STATE
    if (isLoading && !currentUser) {
        return (
            <div className="min-h-screen bg-surface text-text flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <img
                        src={logoImage}
                        alt="Pamantasan Records"
                        className="h-12 w-12 rounded-full object-cover bg-surface shadow-md animate-pulse shrink-0"
                    />
                    <span className="text-xs text-text-muted">Loading records system...</span>
                </div>
            </div>
        );
    }

    // RENDER: UNAUTHENTICATED LOGIN / FORGOT PASSWORD FLOW
    if (!currentUser) {
        if (authScreen === 'forgot_password') {
            return <ForgotPasswordPage onBackToLogin={handleBackToLogin} />;
        }

        return (
            <LoginPage
                onLoginSuccess={handleLoginSuccess}
                onGoogleLogin={handleGoogleLogin}
                onForgotPasswordClick={handleForgotPasswordClick}
            />
        );
    }

    // RENDER: AUTHENTICATED APPLICATION SHELL WITH MAIN LAYOUT
    return (
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
        >
            {activeNavigationKey === 'dashboard' && (
                <DashboardPage
                    currentUser={currentUser}
                    onNavigate={setActiveNavigationKey}
                    onUploadDocument={handleUploadDocument}
                    onRequestDocument={handleRequestDocument}
                    onSelectActivity={handleSelectActivity}
                />
            )}

            {activeNavigationKey === 'documents' && (
                <DocumentsPage
                    currentUser={currentUser}
                    onUploadDocument={handleUploadDocument}
                    onSelectDocument={handleSelectActivity}
                />
            )}

            {activeNavigationKey === 'request_document' && (
                <RequestDocumentPage
                    currentUser={currentUser}
                    onSelectDocument={handleSelectActivity}
                />
            )}

            {activeNavigationKey === 'departments' && (
                <DepartmentsPage
                    currentUser={currentUser}
                    onSelectDepartment={handleSelectActivity}
                />
            )}

            {activeNavigationKey === 'users' && (
                <UsersPage
                    currentUser={currentUser}
                    onSelectUser={handleSelectActivity}
                />
            )}

            {activeNavigationKey === 'requests' && (
                <RequestsPage
                    currentUser={currentUser}
                    onSelectRequest={handleSelectActivity}
                />
            )}
        </MainLayout>
    );
};

const App = () => {
    return (
        <ToastProvider>
            <AppContent />
        </ToastProvider>
    );
};

export default App;
