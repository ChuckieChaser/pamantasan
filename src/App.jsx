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
    AlertTriangle,
    Archive,
    UserCheck,
} from 'lucide-react';
import {
    LoginPage,
    ForgotPasswordPage,
    DashboardPage,
    DocumentsPage,
    ArchivesPage,
    UsersPage,
    DepartmentsPage,
    RequestsPage,
    CoordinatorPage,
    OnboardingPage,
} from './pages';
import { MainLayout } from './layouts';
import {
    Inspector,
    Modal,
    ToastProvider,
    ProtectedRoute,
    PublicRoute,
} from './components';
import { useAuth, useToast, useInactivityTimeout } from './hooks';
import {
    useAuditStore,
    useAuthStore,
    useCoordinatorStore,
    useDepartmentStore,
    useDocumentStore,
    useNotificationStore,
    useUserStore,
} from './stores';
import { authService, storageService, coordinatorApprovalService } from './services';
import { constants } from './constants';


// --- CONFIGURATIONS ---
const PAGE_TITLES = {
    dashboard: 'Dashboard',
    documents: 'Manage Documents',
    archives: 'Manage Archives',
    request_document: 'Manage Document Requests',
    departments: 'Manage Departments',
    users: 'Manage Users',
    requests: 'Manage Document Requests',
    coordinator: 'Coordinator Requests',
};


// --- COMPONENTS ---
const AppContent = () => {
    // STATES: WORKSPACE & INSPECTOR
    const [selectedItem, setSelectedItem] = useState(null);
    const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
    const [inspectorTab, setInspectorTab] = useState('information');
    const [restoreConflictModalItem, setRestoreConflictModalItem] = useState(null);

    // HOOKS
    const location = useLocation();
    const navigate = useNavigate();
    const { showToast, showProcessing } = useToast();
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
    const unreadNotificationCount = notifications.filter((item) => !item.isRead).length;
    const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);
    const fetchAuditLogs = useAuditStore((state) => state.fetchAuditLogs);
    const departments = useDepartmentStore((state) => state.departments);
    const fetchDepartments = useDepartmentStore((state) => state.fetchDepartments);
    const users = useUserStore((state) => state.users);
    const fetchUsers = useUserStore((state) => state.fetchUsers);
    const fetchDocuments = useDocumentStore((state) => state.fetchDocuments);
    const syncAllDocumentShares = useDocumentStore((state) => state.syncAllDocumentShares);

    useEffect(() => {
        if (currentUser) {
            fetchDepartments().catch(() => {});
            fetchUsers().catch(() => {});
            fetchDocuments().catch(() => {});
            fetchAuditLogs().catch(() => {});
            if (currentUser.id) {
                fetchNotifications(currentUser.id).catch(() => {});
            }
        }
    }, [currentUser, fetchDepartments, fetchUsers, fetchDocuments, fetchAuditLogs, fetchNotifications]);

    useEffect(() => {
        if (currentUser) {
            syncAllDocumentShares(currentUser, departments).catch(() => {});
        }
    }, [currentUser?.id, currentUser?.departmentId, currentUser?.role, departments?.length, syncAllDocumentShares]);

    // REACTIVE SYNC FOR SELECTED ITEM WHEN STORE DEPARTMENTS UPDATE
    useEffect(() => {
        if (!selectedItem?.id) {
            return;
        }

        const matchingDepartment = departments.find((dept) => dept?.id === selectedItem.id);
        if (matchingDepartment) {
            setSelectedItem((previous) => {
                if (!previous) {
                    return previous;
                }

                if (
                    previous.name === matchingDepartment.name &&
                    previous.code === matchingDepartment.code &&
                    previous.updatedAt === matchingDepartment.updatedAt
                ) {
                    return previous;
                }

                return {
                    ...previous,
                    ...matchingDepartment,
                    title: matchingDepartment.name,
                    name: matchingDepartment.name,
                    code: matchingDepartment.code,
                    subtitle: matchingDepartment.code,
                    createdAt: matchingDepartment.createdAt ?? previous.createdAt,
                    updatedAt: matchingDepartment.updatedAt ?? previous.updatedAt,
                };
            });
        }
    }, [departments, selectedItem?.id]);

    // REACTIVE SYNC FOR SELECTED ITEM WHEN STORE USERS UPDATE
    useEffect(() => {
        if (!selectedItem?.id) {
            return;
        }

        const matchingUser = users.find((user) => user?.id === selectedItem.id);
        if (matchingUser) {
            setSelectedItem((previous) => {
                if (!previous) {
                    return previous;
                }

                const firstName = matchingUser.firstName ?? previous.firstName ?? '';
                const lastName = matchingUser.lastName ?? previous.lastName ?? '';
                const fullName = `${firstName} ${lastName}`.trim() || previous.title || previous.name;

                if (
                    previous.firstName === matchingUser.firstName &&
                    previous.lastName === matchingUser.lastName &&
                    previous.role === matchingUser.role &&
                    previous.status === matchingUser.status &&
                    previous.departmentId === matchingUser.departmentId &&
                    previous.updatedAt === matchingUser.updatedAt
                ) {
                    return previous;
                }

                return {
                    ...previous,
                    ...matchingUser,
                    title: fullName,
                    name: fullName,
                    firstName,
                    lastName,
                    middleName: matchingUser.middleName ?? previous.middleName ?? null,
                    universityId: matchingUser.universityId ?? previous.universityId,
                    email: matchingUser.email ?? previous.email,
                    role: matchingUser.role ?? previous.role,
                    status: matchingUser.status ?? previous.status,
                    departmentId: matchingUser.departmentId ?? previous.departmentId,
                    avatarPath: matchingUser.avatarPath ?? previous.avatarPath ?? null,
                    createdAt: matchingUser.createdAt ?? previous.createdAt,
                    updatedAt: matchingUser.updatedAt ?? previous.updatedAt,
                };
            });
        }
    }, [users, selectedItem?.id]);

    // DERIVED VALUES: NAVIGATION & PERMISSIONS
    const activeNavigationKey = useMemo(() => {
        const path = location.pathname;
        if (path.startsWith('/documents')) {
            return 'documents';
        }
        if (path.startsWith('/archives')) {
            return 'archives';
        }
        if (path.startsWith('/coordinator')) {
            return 'coordinator';
        }
        if (path.startsWith('/request-document') || path.startsWith('/requests')) {
            return 'requests';
        }
        if (path.startsWith('/departments')) {
            return 'departments';
        }
        if (path.startsWith('/users')) {
            return 'users';
        }
        return 'dashboard';
    }, [location.pathname]);

    const userRole = currentUser?.role ?? constants.USERS_ROLE.MEMBER;
    const isAdmin = constants.isAdminRole(currentUser?.role);
    const isCoordinator = constants.isCoordinatorRole(currentUser?.role);
    const pageTitle = PAGE_TITLES[activeNavigationKey] ?? 'Dashboard';

    const generalNavigationItems = useMemo(() => {
        return [
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
            {
                key: 'archives',
                value: 'archives',
                label: 'Archives',
                title: 'Archived Documents',
                icon: Archive,
            },
            {
                key: 'requests',
                value: 'requests',
                label: 'Document Requests',
                title: 'Manage Document Requests',
                icon: FilePlus,
            },
        ];
    }, []);

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
                key: 'coordinator',
                value: 'coordinator',
                label: 'Coordinator Requests',
                title: 'Coordinator Requests',
                icon: UserCheck,
            },
        ];
    }, [isAdmin, isCoordinator]);

    // HANDLERS
    const handleLoginSuccess = async ({ universityId, email, password }) => {
        const identifier = universityId ?? email;
        const minDelay = new Promise((resolve) => setTimeout(resolve, 400));
        const [authenticatedUser] = await Promise.all([
            loginWithUniversityId(identifier, password),
            minDelay,
        ]);

        if (authenticatedUser?.status === constants.USERS_STATUS.PENDING_PASSWORD) {
            navigate('/onboarding');
            return;
        }
        if (authenticatedUser?.status === constants.USERS_STATUS.PENDING_SSO) {
            if (!authService.hasSkippedSSOOnboarding(authenticatedUser.id)) {
                navigate('/onboarding');
                return;
            }
        }

        // Prefetch records before navigating so dashboard loads populated
        await Promise.allSettled([
            fetchDepartments(),
            fetchUsers(),
            fetchDocuments(),
        ]);

        navigate('/dashboard');
    };

    const handleGoogleLogin = async () => {
        const minDelay = new Promise((resolve) => setTimeout(resolve, 400));
        const [authenticatedUser] = await Promise.all([
            loginWithGoogle(),
            minDelay,
        ]);

        if (authenticatedUser?.status === constants.USERS_STATUS.PENDING_PASSWORD) {
            navigate('/onboarding');
            return;
        }
        if (authenticatedUser?.status === constants.USERS_STATUS.PENDING_SSO) {
            if (!authService.hasSkippedSSOOnboarding(authenticatedUser.id)) {
                navigate('/onboarding');
                return;
            }
        }

        // Prefetch records before navigating
        await Promise.allSettled([
            fetchDepartments(),
            fetchUsers(),
            fetchDocuments(),
        ]);

        navigate('/dashboard');
    };

    const handleSignOut = async () => {
        try {
            await logout();
            setSelectedItem(null);
            setIsDetailPanelOpen(false);
            navigate('/login');
        } catch (error) {
            console.error('Sign out error:', error);
        }
    };

    const handleInactivityLogout = async () => {
        showToast({
            title: 'Session Expired',
            description: 'You have been automatically logged out due to 10 minutes of inactivity.',
            variant: 'warning',
        });
        await handleSignOut();
    };

    useInactivityTimeout({
        timeoutMs: 10 * 60 * 1000,
        onTimeout: handleInactivityLogout,
        enabled: Boolean(currentUser?.id),
    });

    const handleNavigationChange = (navigationKey) => {
        setSelectedItem(null);
        setInspectorTab('information');
        const targetPath =
            navigationKey === 'request_document' || navigationKey === 'requests'
                ? '/requests'
                : `/${navigationKey}`;
        navigate(targetPath);
    };

    const handleToggleDetailPanel = () => {
        setIsDetailPanelOpen((previousState) => !previousState);
    };

    const handleCloseDetailPanel = () => {
        setIsDetailPanelOpen(false);
    };

    const handleSelectActivity = (activityItem, targetTab = null) => {
        setSelectedItem(activityItem);
        if (targetTab) {
            setInspectorTab(targetTab);
        } else if (activityItem?._targetTab) {
            setInspectorTab(activityItem._targetTab);
        } else {
            setInspectorTab('information');
        }
        if (activityItem) {
            setIsDetailPanelOpen(true);
        }
    };

    const handleDetailAction = async (actionKey, item) => {
        const targetItem = item || selectedItem;
        const isCoordinatorReq = Boolean(
            targetItem?.action &&
            typeof targetItem.action === 'string' &&
            (targetItem.action.startsWith('USER_') ||
             targetItem.action.startsWith('DEPARTMENT_') ||
             targetItem.action.startsWith('DOCUMENT_'))
        );

        if (isCoordinatorReq) {
            if (actionKey === 'approve') {
                if (!currentUser?.id) {
                    showToast({
                        type: 'error',
                        title: 'Approval Failed',
                        description: 'Authentication required to approve request.',
                    });
                    return;
                }
                if (!constants.isAdminRole(currentUser?.role)) {
                    showToast({
                        type: 'error',
                        title: 'Permission Denied',
                        description: 'Only administrators can approve coordinator requests.',
                    });
                    return;
                }
                try {
                    const approved = await coordinatorApprovalService.executeApprovedRequest(targetItem, currentUser);
                    setSelectedItem(approved);
                    showToast({
                        type: 'success',
                        title: 'Request Approved & Executed',
                        description: `Action "${String(targetItem.action).replace(/_/g, ' ')}" has been executed with Administrator privileges.`,
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

            if (actionKey === 'reject') {
                if (!currentUser?.id) {
                    showToast({
                        type: 'error',
                        title: 'Rejection Failed',
                        description: 'Authentication required to reject request.',
                    });
                    return;
                }
                if (!constants.isAdminRole(currentUser?.role)) {
                    showToast({
                        type: 'error',
                        title: 'Permission Denied',
                        description: 'Only administrators can reject coordinator requests.',
                    });
                    return;
                }
                try {
                    await coordinatorApprovalService.rejectCoordinatorRequest(targetItem);
                    setSelectedItem(null);
                    showToast({
                        type: 'success',
                        title: 'Request Rejected & Removed',
                        description: `Action "${String(targetItem.action).replace(/_/g, ' ')}" request was removed.`,
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

            if (actionKey === 'delete') {
                if (window.location.pathname.includes('/coordinator')) {
                    window.dispatchEvent(new CustomEvent('pamantasan:delete-coordinator-request', { detail: targetItem }));
                    return;
                }
                try {
                    await useCoordinatorStore.getState().deleteCoordinatorRequest(targetItem.id);
                    setSelectedItem(null);
                    showToast({
                        type: 'success',
                        title: 'Request Deleted',
                        description: 'Coordinator request removed from queue.',
                    });
                } catch (error) {
                    showToast({
                        type: 'error',
                        title: 'Deletion Failed',
                        description: error?.message ?? 'Could not delete request.',
                    });
                }
                return;
            }
        }

        if (actionKey === 'revert_version') {
            try {
                const activeDocId = item?.documentId ?? item?.document?.id ?? selectedItem?.id;
                if (!activeDocId) {
                    throw new Error('Document identifier not found.');
                }
                if (!currentUser?.id) {
                    throw new Error('Authentication required to revert version.');
                }
                const reverted = await useDocumentStore.getState().revertDocumentVersion(
                    activeDocId,
                    item,
                    currentUser.id
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
            const targetDocId = item?.documentId ?? item?.document?.id ?? item?.id;
            const allDocs = useDocumentStore.getState().documents ?? [];
            const matchedDoc = allDocs.find((d) => d.id === targetDocId);
            const fileName = item?.name || matchedDoc?.name || item?.title || item?.document?.name || (item?.path ? item.path.split('/').pop() : 'document');

            try {
                if (item?.isFolder) {
                    await storageService.downloadFolder(
                        item,
                        useDocumentStore.getState().documents,
                        useDocumentStore.getState().documentVersions
                    );
                } else {
                    let allVersions = useDocumentStore.getState().documentVersions ?? [];
                    let vers = allVersions.filter(
                        (v) => (v.document?.id ?? v.documentId) === targetDocId
                    );

                    if (vers.length === 0 && targetDocId) {
                        try {
                            const fetched = await useDocumentStore.getState().fetchDocumentVersions(targetDocId);
                            if (fetched && fetched.length > 0) {
                                vers = fetched;
                            }
                        } catch (e) {
                            console.warn('Failed to fetch document versions:', e);
                        }
                    }

                    if (vers.length === 0) {
                        try {
                            const allFetched = await useDocumentStore.getState().fetchAllDocumentVersions();
                            if (allFetched && allFetched.length > 0) {
                                vers = allFetched.filter((v) => (v.document?.id ?? v.documentId) === targetDocId);
                            }
                        } catch (e) {
                            console.warn('Failed to fetch all document versions:', e);
                        }
                    }

                    const latestVer = vers.length > 0
                        ? [...vers].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0]
                        : null;
                    const rawPath = item?.path ?? latestVer?.path ?? item?.url ?? item?.downloadUrl ?? matchedDoc?.path;

                    if (!rawPath) {
                        throw new Error(`Could not find storage path for "${fileName}".`);
                    }

                    await storageService.downloadDocument(
                        rawPath,
                        fileName
                    );
                }
            } catch (err) {
                console.error('Failed to download item:', err);
                showToast({
                    type: 'error',
                    title: 'Download Failed',
                    description: err?.message || 'Could not download item.',
                });
            }
            return;
        }

        if (actionKey === 'share') {
            const target = item || selectedItem;
            if (target) {
                useDocumentStore.getState().setShareModalDocument(target);
            }
            return;
        }

        if (!isCoordinatorReq && ['approve', 'unapprove', 'reject', 'publish', 'unpublish', 'stash', 'unstash', 'unshare'].includes(actionKey)) {
            const targetDoc = item || selectedItem;
            const allShares = useDocumentStore.getState().documentShares || [];
            let shareRecord = targetDoc?.share;

            if (!shareRecord) {
                if ((actionKey === 'unshare' || actionKey === 'unpublish') && (targetDoc?.departmentId || targetDoc?.department || targetDoc?.recipientId || targetDoc?.recipient)) {
                    shareRecord = targetDoc;
                } else if (currentUser?.departmentId) {
                    shareRecord = allShares.find(
                        (s) =>
                            (s.document?.id ?? s.documentId) === targetDoc?.id &&
                            (s.department?.id ?? s.departmentId) === currentUser.departmentId
                    );
                } else {
                    shareRecord = allShares.find((s) => (s.document?.id ?? s.documentId) === targetDoc?.id);
                }
            }

            const shareId = shareRecord?.id;
            if (!shareId) {
                showToast({
                    type: 'error',
                    title: 'Action Failed',
                    description: 'No associated departmental share record found for this document.',
                });
                return;
            }

            try {
                const store = useDocumentStore.getState();
                const docTitle = targetDoc?.name || targetDoc?.title || selectedItem?.name || selectedItem?.title || 'document';
                const deptId = shareRecord?.department?.id ?? shareRecord?.departmentId ?? currentUser?.departmentId;
                const isUserShare = Boolean(shareRecord?.recipientId || shareRecord?.recipient);

                if (actionKey === 'approve') {
                    if (targetDoc?.isFolder && deptId) {
                        await store.updateShareStatusRecursive(targetDoc.id, deptId, constants.DOCUMENT_SHARES_STATUS.APPROVED);
                    } else {
                        await store.approveShare(shareId);
                    }
                    showToast({
                        type: 'success',
                        title: targetDoc?.isFolder ? 'Folder Approved' : 'Document Approved',
                        description: `Approved "${docTitle}" for department director review.`,
                    });
                } else if (actionKey === 'unapprove') {
                    if (targetDoc?.isFolder && deptId) {
                        await store.updateShareStatusRecursive(targetDoc.id, deptId, constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL);
                    } else {
                        await store.unapproveShare(shareId);
                    }
                    showToast({
                        type: 'information',
                        title: 'Approval Revoked',
                        description: `Reverted "${docTitle}" to pending approval.`,
                    });
                } else if (actionKey === 'reject') {
                    if (targetDoc?.isFolder && deptId) {
                        await store.unshareDocumentRecursive(targetDoc.id, deptId);
                    } else {
                        await store.rejectShare(shareId);
                    }
                    showToast({
                        type: 'warning',
                        title: targetDoc?.isFolder ? 'Folder Rejected' : 'Document Rejected',
                        description: `Rejected "${docTitle}" and removed from department view.`,
                    });
                    setSelectedItem(null);
                } else if (actionKey === 'publish') {
                    store.setPublishModalDocument(targetDoc);
                    return;
                } else if (actionKey === 'unpublish') {
                    if (isUserShare) {
                        await store.unshareDocument(shareId);
                        showToast({
                            type: 'success',
                            title: 'User Unpublished',
                            description: `Unpublished "${docTitle}" for recipient.`,
                        });
                    } else if (targetDoc?.isFolder && deptId) {
                        await store.updateShareStatusRecursive(targetDoc.id, deptId, constants.DOCUMENT_SHARES_STATUS.APPROVED);
                        showToast({
                            type: 'information',
                            title: targetDoc?.isFolder ? 'Folder Unpublished' : 'Document Unpublished',
                            description: `Unpublished "${docTitle}" from department members.`,
                        });
                    } else {
                        await store.unpublishShare(shareId);
                        showToast({
                            type: 'information',
                            title: targetDoc?.isFolder ? 'Folder Unpublished' : 'Document Unpublished',
                            description: `Unpublished "${docTitle}" from department members.`,
                        });
                    }
                } else if (actionKey === 'stash') {
                    if (targetDoc?.isFolder && deptId) {
                        await store.updateShareStatusRecursive(targetDoc.id, deptId, constants.DOCUMENT_SHARES_STATUS.STASHED);
                    } else {
                        await store.stashShare(shareId);
                    }
                    showToast({
                        type: 'information',
                        title: targetDoc?.isFolder ? 'Folder Stashed' : 'Document Stashed',
                        description: `Stashed "${docTitle}" at upper management level.`,
                    });
                } else if (actionKey === 'unstash') {
                    if (targetDoc?.isFolder && deptId) {
                        await store.updateShareStatusRecursive(targetDoc.id, deptId, constants.DOCUMENT_SHARES_STATUS.APPROVED);
                    } else {
                        await store.unstashShare(shareId);
                    }
                    showToast({
                        type: 'success',
                        title: targetDoc?.isFolder ? 'Folder Unstashed' : 'Document Unstashed',
                        description: `Restored "${docTitle}" to approved state.`,
                    });
                } else if (actionKey === 'unshare') {
                    if (constants.isCoordinatorRole(currentUser?.role)) {
                        const unsharePayload = {
                            shareId: shareId,
                            documentId: targetDoc?.id,
                            departmentId: deptId,
                            isRecursive: Boolean(targetDoc?.isFolder),
                        };

                        const requesterId = currentUser?.id ?? useAuthStore.getState().currentUser?.id;
                        await coordinatorApprovalService.submitCoordinatorRequest({
                            action: constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_UNSHARE,
                            requesterId,
                            data: unsharePayload,
                        });
                        useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});

                        showToast({
                            type: 'success',
                            title: 'Request Submitted',
                            description: `Unshare request for "${docTitle}" sent for Administrator approval.`,
                        });
                        return;
                    }

                    if (targetDoc?.isFolder && deptId) {
                        await store.unshareDocumentRecursive(targetDoc.id, deptId);
                        showToast({
                            type: 'success',
                            title: 'Share Removed',
                            description: `Removed folder "${docTitle}" and all nested contents from department.`,
                        });
                    } else {
                        await store.unshareDocument(shareId);
                        showToast({
                            type: 'success',
                            title: 'Share Removed',
                            description: isUserShare
                                ? `Removed user share for "${docTitle}".`
                                : `Removed department share for "${docTitle}".`,
                        });
                    }
                }
            } catch (err) {
                console.error(`Failed to execute ${actionKey}:`, err);
                showToast({
                    type: 'error',
                    title: 'Action Failed',
                    description: err?.message || `Could not complete ${actionKey} action.`,
                });
            }
            return;
        }

        if (actionKey === 'archive') {
            if (item?.isArchived) {
                handleConfirmRestoreDirectly(item);
                return;
            }
            if (location.pathname !== '/documents') {
                navigate('/documents');
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('pamantasan:archive-document', { detail: item }));
                }, 100);
            } else {
                window.dispatchEvent(new CustomEvent('pamantasan:archive-document', { detail: item }));
            }
            return;
        }

        if (actionKey === 'restore') {
            const allDocs = useDocumentStore.getState().documents || [];
            const targetParentId = item?.parentId && item.parentId !== 'root' ? item.parentId : null;
            const parentDoc = targetParentId ? allDocs.find((d) => d.id === targetParentId) : null;

            // CHILD RESTORE GUARD: If parent folder is archived, prompt modal
            if (parentDoc && parentDoc.isArchived) {
                setRestoreConflictModalItem({ item, parentFolder: parentDoc });
                return;
            }

            await performRestoreItem(item);
            return;
        }

        if (actionKey === 'open' || actionKey === 'open_folder') {
            if (item?.action) {
                navigate('/coordinator');
                return;
            }
            if (item?.subject) {
                navigate('/requests');
                return;
            }
            if (item?.isFolder) {
                if (item?.isArchived) {
                    showToast({
                        type: 'warning',
                        title: 'Archived Folder',
                        description: 'Cannot browse contents of an archived folder. Restore the folder to view its contents.',
                    });
                    return;
                }
                setSelectedItem(item);
                window.dispatchEvent(new CustomEvent('pamantasan:open-folder', { detail: item }));
                return;
            }
            if (item?.isArchived) {
                showToast({
                    type: 'warning',
                    title: 'Archived Document',
                    description: 'Cannot view an archived document.',
                });
                return;
            }
            setSelectedItem(item);
            window.dispatchEvent(new CustomEvent('pamantasan:open-file', { detail: item }));
            return;
        }

        if (actionKey === 'edit_department_success') {
            if (selectedItem && item && selectedItem.id === item.id) {
                setSelectedItem((prev) => ({
                    ...prev,
                    ...item,
                    code: item.code,
                    title: item.name,
                    name: item.name,
                    subtitle: item.code,
                }));
            }
            return;
        }

        if (actionKey === 'edit_user_success' || actionKey === 'suspend_user_success') {
            if (selectedItem && item && selectedItem.id === item.id) {
                const firstName = item.firstName ?? selectedItem.firstName ?? '';
                const lastName = item.lastName ?? selectedItem.lastName ?? '';
                const fullName = `${firstName} ${lastName}`.trim() || item.name || item.title;
                setSelectedItem((prev) => ({
                    ...prev,
                    ...item,
                    title: fullName,
                    name: fullName,
                }));
            }
            return;
        }

        if (actionKey === 'delete_department_success') {
            setSelectedItem(null);
            setIsDetailPanelOpen(false);
            return;
        }

        if (actionKey === 'edit') {
            if (item?.code && !item?.universityId && !item?.size && !item?.sizeBytes) {
                return;
            }
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
                    description: `${item?.firstName ?? item?.name ?? 'User'} is now verified.`,
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
            window.dispatchEvent(new CustomEvent('pamantasan:suspend-user', { detail: item }));
            return;
        }

        if (actionKey === 'delete') {
            if (item?.code && !item?.universityId && !item?.size && !item?.sizeBytes) {
                window.dispatchEvent(new CustomEvent('pamantasan:delete-department', { detail: item }));
                return;
            }
            if (item?.subject) {
                window.dispatchEvent(new CustomEvent('pamantasan:delete-document-request', { detail: item }));
                return;
            }
            showToast({
                type: 'error',
                title: 'Deletion Requested',
                description: `Deletion action triggered for ${item?.name ?? item?.code ?? 'record'}.`,
            });
            return;
        }

        if (actionKey === 'approve') {
            showToast({
                type: 'success',
                title: 'Request Approved',
                description: 'Governance request has been approved.',
            });
            return;
        }

        if (actionKey === 'reject') {

            if (item?.subject) {
                const isCoordinator = constants.isCoordinatorRole(currentUser?.role);
                if (isCoordinator) {
                    try {
                        const requesterId = currentUser?.id ?? useAuthStore.getState().currentUser?.id;
                        await coordinatorApprovalService.submitCoordinatorRequest({
                            action: constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_REJECT,
                            requesterId,
                            data: {
                                documentRequestId: item.id,
                                subject: item.subject || item.title || 'Document Request',
                                requesterName: item.requesterName || 'Member',
                                status: constants.DOCUMENT_REQUESTS_STATUS.REJECTED,
                            },
                        });
                        useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});
                        showToast({
                            type: 'success',
                            title: 'Request Submitted',
                            description: 'Document request rejection sent for Administrator approval.',
                        });
                        return;
                    } catch (error) {
                        showToast({
                            type: 'error',
                            title: 'Request Failed',
                            description: error?.message ?? 'Could not submit rejection request.',
                        });
                        return;
                    }
                }

                try {
                    const minTimer = new Promise((resolve) => setTimeout(resolve, 500));
                    const [updated] = await Promise.all([
                        useDocumentStore.getState().updateDocumentRequest(
                            item.id,
                            {
                                status: constants.DOCUMENT_REQUESTS_STATUS.REJECTED,
                            }
                        ),
                        minTimer,
                    ]);
                    setSelectedItem((prev) => (prev && String(prev.id) === String(item.id) ? { ...prev, ...updated, status: constants.DOCUMENT_REQUESTS_STATUS.REJECTED } : prev));
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
            const isCoordinator = constants.isCoordinatorRole(currentUser?.role);
            if (isCoordinator && item?.id) {
                try {
                    const requesterId = currentUser?.id ?? useAuthStore.getState().currentUser?.id;
                    await coordinatorApprovalService.submitCoordinatorRequest({
                        action: constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_RESOLVE,
                        requesterId,
                        data: {
                            documentRequestId: item.id,
                            subject: item.subject || item.title || 'Document Request',
                            requesterName: item.requesterName || 'Member',
                            status: constants.DOCUMENT_REQUESTS_STATUS.RESOLVED,
                        },
                    });
                    useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});
                    showToast({
                        type: 'success',
                        title: 'Request Submitted',
                        description: 'Document request resolution sent for Administrator approval.',
                    });
                    return;
                } catch (error) {
                    showToast({
                        type: 'error',
                        title: 'Request Failed',
                        description: error?.message ?? 'Could not submit resolution request.',
                    });
                    return;
                }
            }

            try {
                if (item?.id) {
                    const minTimer = new Promise((resolve) => setTimeout(resolve, 500));
                    const [updated] = await Promise.all([
                        useDocumentStore.getState().updateDocumentRequest(
                            item.id,
                            {
                                status: constants.DOCUMENT_REQUESTS_STATUS.RESOLVED,
                            }
                        ),
                        minTimer,
                    ]);
                    setSelectedItem((prev) => (prev && String(prev.id) === String(item.id) ? { ...prev, ...updated, status: constants.DOCUMENT_REQUESTS_STATUS.RESOLVED } : prev));
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

        if (actionKey === 'open_request' || (actionKey === 'reopen' && item?.subject)) {
            const isCoordinator = constants.isCoordinatorRole(currentUser?.role);
            const isReopen = item?.status === constants.DOCUMENT_REQUESTS_STATUS.RESOLVED || item?.status === constants.DOCUMENT_REQUESTS_STATUS.REJECTED;

            if (isCoordinator && isReopen) {
                try {
                    const requesterId = currentUser?.id ?? useAuthStore.getState().currentUser?.id;
                    await coordinatorApprovalService.submitCoordinatorRequest({
                        action: constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_REOPEN,
                        requesterId,
                        data: {
                            documentRequestId: item.id,
                            subject: item.subject || item.title || 'Document Request',
                            requesterName: item.requesterName || 'Member',
                            status: constants.DOCUMENT_REQUESTS_STATUS.OPEN,
                        },
                    });
                    useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});
                    showToast({
                        type: 'success',
                        title: 'Request Submitted',
                        description: 'Document request reopening sent for Administrator approval.',
                    });
                    return;
                } catch (error) {
                    showToast({
                        type: 'error',
                        title: 'Request Failed',
                        description: error?.message ?? 'Could not submit reopen request.',
                    });
                    return;
                }
            }

            try {
                if (item?.id) {
                    const minTimer = new Promise((resolve) => setTimeout(resolve, 500));
                    const [updated] = await Promise.all([
                        useDocumentStore.getState().updateDocumentRequest(
                            item.id,
                            {
                                status: constants.DOCUMENT_REQUESTS_STATUS.OPEN,
                            }
                        ),
                        minTimer,
                    ]);
                    setSelectedItem((prev) => (prev && prev.id === item.id ? { ...prev, ...updated, status: constants.DOCUMENT_REQUESTS_STATUS.OPEN } : prev));
                    showToast({
                        type: 'success',
                        title: 'Request Reopened',
                        description: 'Document request status set to OPEN.',
                    });
                }
            } catch (error) {
                showToast({
                    type: 'error',
                    title: 'Reopen Failed',
                    description: error?.message ?? 'Could not reopen request.',
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



    const performRestoreItem = async (item) => {
        try {
            if (item?.id) {
                await useDocumentStore.getState().archiveDocument(item.id, false);
            }
            setSelectedItem((prev) => (prev ? { ...prev, isArchived: false } : null));
            showToast({
                type: 'success',
                title: item?.isFolder ? 'Folder Restored' : 'Document Restored',
                description: `${item?.name ?? item?.title} restored to active repository.`,
            });
        } catch (error) {
            showToast({
                type: 'error',
                title: 'Restore Failed',
                description: error?.message ?? 'Could not update archive state.',
            });
        }
    };

    const handleRestoreWithParent = async (item, parentFolder) => {
        try {
            const allDocs = useDocumentStore.getState().documents || [];
            let curr = parentFolder;
            const chain = [];
            while (curr && curr.isArchived) {
                chain.unshift(curr);
                const pId = curr.parentId ?? curr.parentFolderId;
                if (!pId || pId === 'root') break;
                curr = allDocs.find((d) => d.id === pId);
            }

            for (const folder of chain) {
                await useDocumentStore.getState().archiveDocument(folder.id, false);
            }
            if (item?.id) {
                await useDocumentStore.getState().archiveDocument(item.id, false);
            }

            setSelectedItem((prev) => (prev ? { ...prev, isArchived: false } : null));
            showToast({
                type: 'success',
                title: 'Items Restored',
                description: `"${parentFolder.name || parentFolder.title}" and "${item?.name ?? item?.title}" restored to active repository.`,
            });
        } catch (error) {
            showToast({
                type: 'error',
                title: 'Restore Failed',
                description: error?.message ?? 'Could not restore items.',
            });
        }
    };

    const handleUploadDocument = () => {
        navigate('/documents');
    };

    const handleRequestDocument = () => {
        navigate('/requests');
    };

    // RENDER
    return (
        <>
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

            {/* 2. ONBOARDING ROUTE (REQUIRES AUTH, ACCESSIBLE IN PENDING STATUS) */}
            <Route
                path="/onboarding"
                element={
                    <ProtectedRoute
                        currentUser={currentUser}
                        isLoading={isLoading}
                        allowPending={true}
                    >
                        <OnboardingPage
                            currentUser={currentUser}
                            onComplete={async () => {
                                await Promise.allSettled([
                                    fetchDepartments(),
                                    fetchUsers(),
                                    fetchDocuments(),
                                ]);
                                navigate('/dashboard', { replace: true });
                            }}
                        />
                    </ProtectedRoute>
                }
            />

            {/* 3. AUTHENTICATED PROTECTED SHELL (REQUIRES LOGGED IN USER) */}
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
                                    targetTab={inspectorTab}
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
                    path="/archives"
                    element={
                        <ArchivesPage
                            currentUser={currentUser}
                            onSelectDocument={handleSelectActivity}
                        />
                    }
                />
                <Route
                    path="/requests"
                    element={
                        <RequestsPage
                            currentUser={currentUser}
                            selectedItem={selectedItem}
                            onSelectRequest={handleSelectActivity}
                        />
                    }
                />
                <Route
                    path="/request-document"
                    element={<Navigate to="/requests" replace />}
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
                        path="/coordinator"
                        element={
                            <CoordinatorPage
                                currentUser={currentUser}
                                selectedItem={selectedItem}
                                onSelectRequest={handleSelectActivity}
                            />
                        }
                    />
                </Route>

                {/* CATCH-ALL REDIRECT TO DASHBOARD */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
        </Routes>

        {restoreConflictModalItem && (
            <Modal
                isOpen={Boolean(restoreConflictModalItem)}
                onClose={() => setRestoreConflictModalItem(null)}
                title="Archived Parent Folder Conflict"
                description={`The original parent folder "${restoreConflictModalItem.parentFolder?.name || restoreConflictModalItem.parentFolder?.title || 'Parent Folder'}" is currently archived. To unarchive this item, its parent folder must also be restored.`}
                icon={AlertTriangle}
                variant="warning"
                size="sm"
                callout={`Restoring "${restoreConflictModalItem.item?.name || restoreConflictModalItem.item?.title}" will restore parent folder "${restoreConflictModalItem.parentFolder?.name || restoreConflictModalItem.parentFolder?.title}" first into its original repository location.`}
                calloutVariant="warning"
                onConfirm={async () => {
                    const { item, parentFolder } = restoreConflictModalItem;
                    setRestoreConflictModalItem(null);
                    await handleRestoreWithParent(item, parentFolder);
                }}
                confirmLabel="Unarchive Parent & File"
                cancelLabel="Cancel"
            />
        )}
        </>
    );
};

const App = () => {
    return (
        <BrowserRouter>
            <ToastProvider>
                <AppContent />
            </ToastProvider>
        </BrowserRouter>
    );
};


// --- EXPORTS ---
export { App };
export default App;
