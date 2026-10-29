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
    MobileSyncCapturePage,
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
import { authService, storageService, coordinatorApprovalService, realtimeSyncService, systemEventService } from './services';
import { constants } from './constants';
import { findRootSharedFolder } from './components/browser/common';


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
    const [selectedItems, setSelectedItems] = useState([]);
    const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
    const [inspectorTab, setInspectorTab] = useState(null);
    const [restoreConflictModalItem, setRestoreConflictModalItem] = useState(null);

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

    // REALTIME AUTO-FETCH & MULTI-BROWSER SYNC
    useEffect(() => {
        if (!currentUser) return;

        const handleRealtimeSync = (syncData) => {
            const ent = String(syncData?.entityType || '').toUpperCase();
            if (ent.includes('DOCUMENT') || ent.includes('SHARE')) {
                fetchDocuments().catch(() => {});
            }
            if (ent.includes('USER')) {
                fetchUsers().catch(() => {});
            }
            if (ent.includes('DEPARTMENT')) {
                fetchDepartments().catch(() => {});
            }
            if (ent.includes('COORDINATOR')) {
                useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});
            }
            if (ent.includes('AUDIT')) {
                fetchAuditLogs().catch(() => {});
            }
            if (currentUser.id) {
                fetchNotifications(currentUser.id).catch(() => {});
            }
        };

        const unsubscribeBroadcast = realtimeSyncService.subscribe(handleRealtimeSync);

        const unsubscribeAutoSync = realtimeSyncService.initAutoSync(() => {
            fetchDocuments().catch(() => {});
            fetchUsers().catch(() => {});
            fetchDepartments().catch(() => {});
            fetchAuditLogs().catch(() => {});
            if (currentUser.id) {
                fetchNotifications(currentUser.id).catch(() => {});
            }
            useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});
        });

        return () => {
            unsubscribeBroadcast();
            unsubscribeAutoSync();
        };
    }, [currentUser, fetchDepartments, fetchUsers, fetchDocuments, fetchAuditLogs, fetchNotifications]);

    useEffect(() => {
        if (currentUser && departments.length > 0 && typeof syncAllDocumentShares === 'function') {
            syncAllDocumentShares(currentUser, departments).catch(() => {});
        }
    }, [currentUser, departments, syncAllDocumentShares]);

    const documents = useDocumentStore((state) => state.documents);
    const documentShares = useDocumentStore((state) => state.documentShares);
    const documentVersions = useDocumentStore((state) => state.documentVersions);
    const documentRequests = useDocumentStore((state) => state.documentRequests);
    const coordinatorRequests = useCoordinatorStore((state) => state.coordinatorRequests);

    // REACTIVE SYNC FOR SELECTED ITEM WHEN STORE DEPARTMENTS UPDATE
    useEffect(() => {
        if (!selectedItem?.id) {
            return;
        }

        const matchingDepartment = departments.find((dept) => dept?.id === selectedItem.id);
        if (matchingDepartment) {
            queueMicrotask(() => {
                setSelectedItem((previous) => {
                    if (!previous || previous.id !== matchingDepartment.id) {
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
            queueMicrotask(() => {
                setSelectedItem((previous) => {
                    if (!previous || previous.id !== matchingUser.id) {
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
                        previous.avatarPath === matchingUser.avatarPath &&
                        previous.signaturePath === matchingUser.signaturePath &&
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
                        signaturePath: matchingUser.signaturePath ?? previous.signaturePath ?? null,
                        createdAt: matchingUser.createdAt ?? previous.createdAt,
                        updatedAt: matchingUser.updatedAt ?? previous.updatedAt,
                    };
                });
            });
        }
    }, [users, selectedItem?.id]);

    // REACTIVE SYNC FOR SELECTED ITEM WHEN STORE DOCUMENTS / SHARES / VERSIONS UPDATE
    useEffect(() => {
        if (!selectedItem?.id) {
            return;
        }

        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
        const selCleanId = cleanId(selectedItem.id);

        const matchingDoc = (documents || []).find((doc) => cleanId(doc?.id) === selCleanId);
        if (matchingDoc) {
            queueMicrotask(() => {
                setSelectedItem((previous) => {
                    if (!previous || cleanId(previous.id) !== selCleanId) {
                        return previous;
                    }

                    const shares = (documentShares || []).filter((s) => {
                        const sDocId = cleanId(s.document?.id ?? s.documentId);
                        return sDocId === selCleanId;
                    });

                    const isShared = shares.length > 0;
                    const primaryShare = shares[0] || null;

                    const matchingVersions = (documentVersions || []).filter(
                        (v) => cleanId(v.document?.id ?? v.documentId) === selCleanId
                    );
                    const sortedVersions = [...matchingVersions].sort(
                        (a, b) => (b.versionNumber ?? b.version ?? 0) - (a.versionNumber ?? a.version ?? 0)
                    );
                    const latestVer = sortedVersions[0];

                    const newName = matchingDoc.name ?? previous.name ?? previous.title;
                    const newStatus = isShared
                        ? (primaryShare?.status || 'SHARED')
                        : (matchingDoc.isArchived ? 'ARCHIVED' : (matchingDoc.status === 'SHARED' ? 'PRIVATE' : (matchingDoc.status || 'PRIVATE')));

                    return {
                        ...previous,
                        ...matchingDoc,
                        name: newName,
                        title: newName,
                        status: newStatus,
                        shares: shares,
                        share: primaryShare,
                        latestVersion: latestVer || previous.latestVersion,
                        updatedAt: matchingDoc.updatedAt ?? previous.updatedAt,
                    };
                });
            });
            return;
        }

        const matchingDocReq = (documentRequests || []).find((req) => cleanId(req?.id) === selCleanId);
        if (matchingDocReq) {
            queueMicrotask(() => {
                setSelectedItem((previous) => {
                    if (!previous || cleanId(previous.id) !== selCleanId) return previous;
                    return {
                        ...previous,
                        ...matchingDocReq,
                        status: matchingDocReq.status ?? previous.status,
                        updatedAt: matchingDocReq.updatedAt ?? previous.updatedAt,
                    };
                });
            });
            return;
        }

        const matchingCoordReq = (coordinatorRequests || []).find((req) => cleanId(req?.id) === selCleanId);
        if (matchingCoordReq) {
            queueMicrotask(() => {
                setSelectedItem((previous) => {
                    if (!previous || cleanId(previous.id) !== selCleanId) return previous;
                    return {
                        ...previous,
                        ...matchingCoordReq,
                        status: matchingCoordReq.status ?? previous.status,
                        updatedAt: matchingCoordReq.updatedAt ?? previous.updatedAt,
                    };
                });
            });
            return;
        }
    }, [documents, documentShares, documentVersions, documentRequests, coordinatorRequests, selectedItem?.id]);

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
            ...(constants.isStaffRole(currentUser?.role) ? [{
                key: 'archives',
                value: 'archives',
                label: 'Archives',
                title: 'Archived Documents',
                icon: Archive,
            }] : []),
            {
                key: 'requests',
                value: 'requests',
                label: 'Document Requests',
                title: 'Manage Document Requests',
                icon: FilePlus,
            },
        ];
    }, [currentUser?.role]);

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

        if (
            authenticatedUser?.status === constants.USERS_STATUS.PENDING_PASSWORD ||
            authenticatedUser?.status === constants.USERS_STATUS.PENDING_SIGNATURE
        ) {
            navigate('/onboarding', { replace: true });
            return;
        }
        if (authenticatedUser?.status === constants.USERS_STATUS.PENDING_SSO) {
            if (!authService.hasSkippedSSOOnboarding(authenticatedUser.id)) {
                navigate('/onboarding', { replace: true });
                return;
            }
        }

        // Prefetch records before navigating so dashboard loads populated
        await Promise.allSettled([
            fetchDepartments(),
            fetchUsers(),
            fetchDocuments(),
        ]);

        const isLogout = Boolean(location.state?.isLogout);
        const fromPath = location.state?.from?.pathname;
        const destination = (!isLogout && fromPath && fromPath !== '/login' && fromPath !== '/')
            ? fromPath
            : '/dashboard';
        navigate(destination, { replace: true });
    };

    const handleGoogleLogin = async () => {
        const minDelay = new Promise((resolve) => setTimeout(resolve, 400));
        const [authenticatedUser] = await Promise.all([
            loginWithGoogle(),
            minDelay,
        ]);

        if (
            authenticatedUser?.status === constants.USERS_STATUS.PENDING_PASSWORD ||
            authenticatedUser?.status === constants.USERS_STATUS.PENDING_SIGNATURE
        ) {
            navigate('/onboarding', { replace: true });
            return;
        }
        if (authenticatedUser?.status === constants.USERS_STATUS.PENDING_SSO) {
            if (!authService.hasSkippedSSOOnboarding(authenticatedUser.id)) {
                navigate('/onboarding', { replace: true });
                return;
            }
        }

        // Prefetch records before navigating
        await Promise.allSettled([
            fetchDepartments(),
            fetchUsers(),
            fetchDocuments(),
        ]);

        const isLogout = Boolean(location.state?.isLogout);
        const fromPath = location.state?.from?.pathname;
        const destination = (!isLogout && fromPath && fromPath !== '/login' && fromPath !== '/')
            ? fromPath
            : '/dashboard';
        navigate(destination, { replace: true });
    };

    const handleSignOut = async () => {
        try {
            setSelectedItem(null);
            setSelectedItems([]);
            setIsDetailPanelOpen(false);
            navigate('/login', { replace: true, state: { isLogout: true, from: null } });
            await logout();
        } catch (error) {
            console.error('Sign out error:', error);
            navigate('/login', { replace: true, state: { isLogout: true, from: null } });
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

    const handleNavigationChange = (navigationKey, navState = null) => {
        setSelectedItem(null);
        setSelectedItems([]);
        setInspectorTab('information');
        const targetPath =
            navigationKey === 'request_document' || navigationKey === 'requests'
                ? '/requests'
                : `/${navigationKey}`;
        navigate(targetPath, navState ? { state: navState } : undefined);
    };

    const handleToggleDetailPanel = () => {
        setIsDetailPanelOpen((previousState) => !previousState);
    };

    const handleCloseDetailPanel = () => {
        setIsDetailPanelOpen(false);
    };

    const handleSelectActivity = (activityItem, targetTab = null) => {
        setSelectedItem(activityItem);
        setSelectedItems([]);
        if (targetTab) {
            setInspectorTab(targetTab);
        } else if (activityItem?._targetTab) {
            setInspectorTab(activityItem._targetTab);
        }
        if (activityItem) {
            setIsDetailPanelOpen(true);
        } else {
            setIsDetailPanelOpen(false);
        }
    };

    const handleSelectMultiple = (items) => {
        const safeItems = Array.isArray(items) ? items : [];
        setSelectedItems(safeItems);
        if (safeItems.length > 1) {
            setSelectedItem(null);
            setIsDetailPanelOpen(true);
        } else if (safeItems.length === 1) {
            setSelectedItem(safeItems[0]);
            setIsDetailPanelOpen(true);
        } else {
            setSelectedItem((prev) => {
                if (prev) return prev;
                setIsDetailPanelOpen(false);
                return null;
            });
        }
    };

    const handleUnstageItem = (itemToUnstage) => {
        setSelectedItems((prev) => {
            const next = prev.filter((i) => i.id !== itemToUnstage.id);
            if (next.length === 1) {
                setSelectedItem(next[0]);
            } else if (next.length === 0) {
                setSelectedItem(null);
                setIsDetailPanelOpen(false);
            }
            return next;
        });
    };

    const handleClearSelection = () => {
        setSelectedItems([]);
        setSelectedItem(null);
        setIsDetailPanelOpen(false);
    };

    const handleDetailAction = async (actionKey, item) => {
        if (actionKey === 'select_item') {
            handleSelectActivity(item);
            return;
        }

        const targetItem = item || selectedItem;
        const isCoordinatorReq = Array.isArray(targetItem)
            ? targetItem.some((i) => i.action && typeof i.action === 'string')
            : Boolean(
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
                if (window.location.pathname.includes('/coordinator')) {
                    window.dispatchEvent(new CustomEvent('pamantasan:approve-coordinator-request', { detail: targetItem }));
                    return;
                } else {
                    navigate('/coordinator');
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('pamantasan:approve-coordinator-request', { detail: targetItem }));
                    }, 100);
                    return;
                }
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
                if (window.location.pathname.includes('/coordinator')) {
                    window.dispatchEvent(new CustomEvent('pamantasan:reject-coordinator-request', { detail: targetItem }));
                    return;
                } else {
                    navigate('/coordinator');
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('pamantasan:reject-coordinator-request', { detail: targetItem }));
                    }, 100);
                    return;
                }
            }

            if (actionKey === 'delete') {
                if (targetItem?.status && targetItem.status !== constants.COORDINATOR_REQUESTS_STATUS.PENDING) {
                    showToast({
                        type: 'error',
                        title: 'Action Prohibited',
                        description: 'Only pending coordinator requests can be deleted. Finalized requests cannot be removed.',
                    });
                    return;
                }
                if (window.location.pathname.includes('/coordinator')) {
                    window.dispatchEvent(new CustomEvent('pamantasan:delete-coordinator-request', { detail: targetItem }));
                    return;
                } else {
                    navigate('/coordinator');
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('pamantasan:delete-coordinator-request', { detail: targetItem }));
                    }, 100);
                    return;
                }
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
                if (constants.isCoordinatorRole(currentUser?.role)) {
                    const targetDoc = useDocumentStore.getState().documents.find((d) => d.id === activeDocId);
                    const docName = targetDoc?.name || targetDoc?.title || 'Document';
                    await coordinatorApprovalService.submitCoordinatorRequest({
                        action: constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_VERSION_REVERT,
                        requesterId: currentUser.id,
                        data: {
                            documentId: activeDocId,
                            documentName: docName,
                            currentVersion: targetDoc?.currentVersion ?? 1,
                            targetVersion: item.version,
                        },
                    });
                    showToast({
                        type: 'information',
                        title: 'Coordinator Request Submitted',
                        description: `Reverting "${docName}" to version v${item.version}.0 has been queued for Administrator approval.`,
                    });
                    return;
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
            const itemsToDownload = Array.isArray(item) ? item : [item];
            if (itemsToDownload.length > 1) {
                showToast({
                    type: 'information',
                    title: 'Batch Download Started',
                    description: `Packaging ${itemsToDownload.length} items into ZIP archive...`,
                });
                try {
                    const allDocs = useDocumentStore.getState().documents ?? [];
                    const allVersions = useDocumentStore.getState().documentVersions ?? [];
                    const zipName = await storageService.downloadMultipleAsZip(
                        itemsToDownload,
                        allDocs,
                        allVersions
                    );
                    showToast({
                        type: 'success',
                        title: 'Batch Download Complete',
                        description: `Packaged ${itemsToDownload.length} items into ${zipName}.`,
                    });
                } catch (err) {
                    console.error('Batch zip download failed:', err);
                    showToast({
                        type: 'error',
                        title: 'Download Failed',
                        description: err?.message || 'Could not download zip archive.',
                    });
                }
                return;
            }

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
                    const childFiles = (allDocs || []).filter(
                        (d) => !d.isFolder && (d.parentId === targetDocId || d.parentFolderId === targetDocId)
                    );
                    childFiles.forEach((file) => {
                        systemEventService.recordDocumentRead({
                            document: file,
                            user: currentUser,
                        }).catch(() => {});
                    });
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
                    const docToRecord = matchedDoc || (targetDocId ? { id: targetDocId, name: fileName } : (item?.id ? item : null));
                    const isDocReqContext = Boolean(
                        item?.documentRequestId ||
                        item?.documentRequest ||
                        (selectedItem?.subject && (selectedItem?.requesterId || selectedItem?.requester))
                    );
                    const reqRequesterId = item?.documentRequest?.requester?.id ??
                        item?.documentRequest?.requesterId ??
                        selectedItem?.requesterId ??
                        selectedItem?.requester?.id ??
                        selectedItem?.requester;
                    const isRequester = !isDocReqContext || (currentUser?.id && String(currentUser.id).replace(/-/g, '').toLowerCase() === String(reqRequesterId).replace(/-/g, '').toLowerCase());

                    if (isRequester && docToRecord && currentUser?.id) {
                        systemEventService.recordDocumentRead({
                            document: docToRecord,
                            user: currentUser,
                            version: latestVer?.version,
                            isDocumentRequest: isDocReqContext,
                        }).catch(() => {});
                    }
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

        if (actionKey === 'select_root_folder') {
            const target = item || selectedItem;
            if (target) {
                setSelectedItem(target);
                setSelectedItems([target]);
                setIsDetailPanelOpen(true);
                setInspectorTab('shares');
            }
            return;
        }

        if (actionKey === 'share' || actionKey === 're_share') {
            const target = item || selectedItem;
            if (target) {
                const allDocs = useDocumentStore.getState().documents ?? [];
                const allShares = useDocumentStore.getState().documentShares ?? [];
                const rootShared = !Array.isArray(target) ? findRootSharedFolder(target, allDocs, allShares) : null;
                useDocumentStore.getState().setShareModalDocument(rootShared || target);
            }
            return;
        }

        if (actionKey === 'publish' || actionKey === 're_publish') {
            const target = item || selectedItem;
            if (target) {
                // Officers and Directors publish individual files directly
                useDocumentStore.getState().setPublishModalDocument(target);
            }
            return;
        }

        const isDocRequest = Array.isArray(targetItem)
            ? targetItem.some((i) => i.subject || i.requestNumber)
            : Boolean(
                targetItem?.subject ||
                targetItem?.requestNumber ||
                item?.subject ||
                selectedItem?.subject
            );

        if (!isCoordinatorReq && !isDocRequest && actionKey === 'approve' && constants.isOfficerRole(currentUser?.role)) {
            const targetDocs = Array.isArray(item) ? item : (item ? [item] : (selectedItem ? [selectedItem] : []));
            if (targetDocs.length === 0) return;
            const target = targetDocs.length === 1 ? targetDocs[0] : targetDocs;
            if (location.pathname !== '/documents') {
                navigate('/documents');
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('pamantasan:document-action', {
                        detail: { actionKey: 'approve', item: target }
                    }));
                }, 100);
            } else {
                window.dispatchEvent(new CustomEvent('pamantasan:document-action', {
                    detail: { actionKey: 'approve', item: target }
                }));
            }
            return;
        }

        if (!isCoordinatorReq && !isDocRequest && ['approve', 'unapprove', 'reject', 'unreject', 'publish', 'unpublish', 'stash', 'unstash', 'unshare'].includes(actionKey)) {
            const targetDocs = Array.isArray(item) ? item : (item ? [item] : (selectedItem ? [selectedItem] : []));
            if (targetDocs.length === 0) return;

            const cleanId = (uid) => (typeof uid === 'string' ? uid.replace(/-/g, '').toLowerCase() : uid);
            const userDeptClean = currentUser?.departmentId ? cleanId(currentUser.departmentId) : null;

            if (targetDocs.length > 1) {
                let successCount = 0;
                const store = useDocumentStore.getState();
                const allShares = store.documentShares || [];

                for (const doc of targetDocs) {
                    try {
                        let shareRecord = doc?.share;
                        if (!shareRecord) {
                            const docClean = cleanId(doc?.id);
                            if (userDeptClean) {
                                shareRecord = allShares.find(
                                    (s) =>
                                        cleanId(s.document?.id ?? s.documentId) === docClean &&
                                        cleanId(s.department?.id ?? s.departmentId) === userDeptClean
                                );
                            } else {
                                shareRecord = allShares.find((s) => cleanId(s.document?.id ?? s.documentId) === docClean);
                            }
                        }
                        const shareId = shareRecord?.id;
                        const deptId = shareRecord?.department?.id ?? shareRecord?.departmentId ?? currentUser?.departmentId;

                        const docStatus = String(shareRecord?.status ?? doc?.status ?? '').toUpperCase();
                        if (
                            constants.isOfficerRole(currentUser?.role) &&
                            (docStatus === constants.DOCUMENT_SHARES_STATUS.PUBLISHED || docStatus === constants.DOCUMENT_SHARES_STATUS.STASHED) &&
                            ['approve', 'unapprove', 'reject', 'unreject'].includes(actionKey)
                        ) {
                            continue;
                        }
                        if (actionKey === 'reject' && docStatus === constants.DOCUMENT_SHARES_STATUS.APPROVED) {
                            continue;
                        }
                        if (actionKey === 'approve' && docStatus === constants.DOCUMENT_SHARES_STATUS.REJECTED) {
                            continue;
                        }

                        if (actionKey === 'approve') {
                            if (doc?.isFolder && deptId) {
                                await store.updateShareStatusRecursive(doc.id, deptId, constants.DOCUMENT_SHARES_STATUS.APPROVED);
                            } else if (shareId) {
                                await store.approveShare(shareId);
                            }
                            successCount++;
                        } else if (actionKey === 'unapprove') {
                            if (doc?.isFolder && deptId) {
                                await store.updateShareStatusRecursive(doc.id, deptId, constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL);
                            } else if (shareId) {
                                await store.unapproveShare(shareId);
                            }
                            successCount++;
                        } else if (actionKey === 'reject') {
                            const bulkReason = (Array.isArray(item) ? (item[0]?.rejectionReason || item?.rejectionReason) : item?.rejectionReason) || 'Rejected in bulk';
                            if (doc?.isFolder && deptId) {
                                await store.updateShareStatusRecursive(doc.id, deptId, constants.DOCUMENT_SHARES_STATUS.REJECTED);
                            } else if (shareId) {
                                await store.rejectShare(shareId, bulkReason, currentUser?.id);
                            }
                            successCount++;
                        } else if (actionKey === 'unreject') {
                            if (doc?.isFolder && deptId) {
                                await store.updateShareStatusRecursive(doc.id, deptId, constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL);
                            } else if (shareId) {
                                await store.unrejectShare(shareId);
                            }
                            successCount++;
                        } else if (actionKey === 'publish') {
                            if (doc?.isFolder && deptId) {
                                await store.updateShareStatusRecursive(doc.id, deptId, constants.DOCUMENT_SHARES_STATUS.PUBLISHED);
                            } else if (shareId) {
                                await store.publishShare(shareId);
                            }
                            successCount++;
                        } else if (actionKey === 'unpublish') {
                            if (doc?.isFolder && deptId) {
                                await store.updateShareStatusRecursive(doc.id, deptId, constants.DOCUMENT_SHARES_STATUS.APPROVED);
                            } else if (shareId) {
                                await store.unpublishShare(shareId);
                            }
                            successCount++;
                        } else if (actionKey === 'stash') {
                            if (doc?.isFolder && deptId) {
                                await store.updateShareStatusRecursive(doc.id, deptId, constants.DOCUMENT_SHARES_STATUS.STASHED);
                            } else if (shareId) {
                                await store.stashShare(shareId);
                            }
                            successCount++;
                        } else if (actionKey === 'unstash') {
                            if (doc?.isFolder && deptId) {
                                await store.updateShareStatusRecursive(doc.id, deptId, constants.DOCUMENT_SHARES_STATUS.APPROVED);
                            } else if (shareId) {
                                await store.unstashShare(shareId);
                            }
                            successCount++;
                        } else if (actionKey === 'unshare') {
                            if (constants.isCoordinatorRole(currentUser?.role)) {
                                const unsharePayload = {
                                    documentId: doc?.id,
                                    allDepartments: true,
                                    isRecursive: Boolean(doc?.isFolder),
                                };
                                const requesterId = currentUser?.id ?? useAuthStore.getState().currentUser?.id;
                                await coordinatorApprovalService.submitCoordinatorRequest({
                                    action: constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_UNSHARE,
                                    requesterId,
                                    data: unsharePayload,
                                });
                            } else {
                                await store.unshareDocumentFromAllDepartments(doc.id);
                            }
                            successCount++;
                        }
                    } catch (err) {
                        console.error('Batch document action error:', err);
                    }
                }

                showToast({
                    type: 'success',
                    title: 'Batch Action Completed',
                    description: `Processed ${successCount} of ${targetDocs.length} items.`,
                });
                handleClearSelection();
                return;
            }

            const targetDoc = targetDocs[0];
            const allShares = useDocumentStore.getState().documentShares || [];

            if (actionKey === 'unshare') {
                const store = useDocumentStore.getState();
                const docTitle = targetDoc?.name || targetDoc?.title || selectedItem?.name || selectedItem?.title || 'document';
                const isExplicitShareRecord = Boolean(targetDoc?.documentId && targetDoc?.departmentId && targetDoc?.id !== targetDoc?.documentId);

                if (isExplicitShareRecord) {
                    if (constants.isCoordinatorRole(currentUser?.role)) {
                        const unsharePayload = {
                            shareId: targetDoc.id,
                            documentId: targetDoc.documentId,
                            departmentId: targetDoc.departmentId,
                            isRecursive: false,
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
                            description: `Unshare request for departmental share sent for Administrator approval.`,
                        });
                        return;
                    }

                    await store.unshareDocument(targetDoc.id);
                    showToast({
                        type: 'success',
                        title: 'Share Deleted',
                        description: `Deleted departmental share.`,
                    });
                    if (currentUser) {
                        store.syncAllDocumentShares(currentUser, departments).catch(() => {});
                    }
                    return;
                }

                if (constants.isCoordinatorRole(currentUser?.role)) {
                    const unsharePayload = {
                        documentId: targetDoc?.id,
                        allDepartments: true,
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

                await store.unshareDocumentFromAllDepartments(targetDoc.id);
                showToast({
                    type: 'success',
                    title: 'Document Unshared',
                    description: targetDoc?.isFolder
                        ? `Deleted all departmental and member shares for folder "${docTitle}" and all nested contents.`
                        : `Deleted all departmental and member shares for "${docTitle}".`,
                });
                if (currentUser) {
                    store.syncAllDocumentShares(currentUser, departments).catch(() => {});
                }
                return;
            }

            let shareRecord = targetDoc?.share;

            if (!shareRecord) {
                if ((actionKey === 'unshare' || actionKey === 'unpublish') && (targetDoc?.departmentId || targetDoc?.department || targetDoc?.recipientId || targetDoc?.recipient)) {
                    shareRecord = targetDoc;
                } else if (currentUser?.departmentId) {
                    const docClean = cleanId(targetDoc?.id);
                    const userDeptClean = cleanId(currentUser.departmentId);
                    shareRecord = allShares.find(
                        (s) =>
                            cleanId(s.document?.id ?? s.documentId) === docClean &&
                            cleanId(s.department?.id ?? s.departmentId) === userDeptClean
                    );
                } else {
                    const docClean = cleanId(targetDoc?.id);
                    shareRecord = allShares.find((s) => cleanId(s.document?.id ?? s.documentId) === docClean);
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

                const currentStatus = String(shareRecord?.status ?? targetDoc?.status ?? '').toUpperCase();
                if (
                    constants.isOfficerRole(currentUser?.role) &&
                    (currentStatus === constants.DOCUMENT_SHARES_STATUS.PUBLISHED || currentStatus === constants.DOCUMENT_SHARES_STATUS.STASHED) &&
                    ['approve', 'unapprove', 'reject', 'unreject'].includes(actionKey)
                ) {
                    showToast({
                        type: 'error',
                        title: 'Action Prohibited',
                        description: `This document is already ${currentStatus.toLowerCase()} by the Director and cannot be modified by an Officer.`,
                    });
                    return;
                }
                if (actionKey === 'reject' && currentStatus === constants.DOCUMENT_SHARES_STATUS.APPROVED) {
                    showToast({
                        type: 'error',
                        title: 'Action Prohibited',
                        description: 'You cannot directly reject an approved document. Please revoke approval (unapprove) first.',
                    });
                    return;
                }
                if (actionKey === 'approve' && currentStatus === constants.DOCUMENT_SHARES_STATUS.REJECTED) {
                    showToast({
                        type: 'error',
                        title: 'Action Prohibited',
                        description: 'You cannot directly approve a rejected document. Please unreject it first.',
                    });
                    return;
                }

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
                    const reason = item?.rejectionReason || 'Document does not meet requirements';
                    if (targetDoc?.isFolder && deptId) {
                        await store.updateShareStatusRecursive(targetDoc.id, deptId, constants.DOCUMENT_SHARES_STATUS.REJECTED);
                    } else {
                        await store.rejectShare(shareId, reason, currentUser?.id);
                    }
                    showToast({
                        type: 'warning',
                        title: targetDoc?.isFolder ? 'Folder Rejected' : 'Document Rejected',
                        description: `Rejected "${docTitle}". The item remains in your repository as Rejected.`,
                    });
                } else if (actionKey === 'unreject') {
                    if (targetDoc?.isFolder && deptId) {
                        await store.updateShareStatusRecursive(targetDoc.id, deptId, constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL);
                    } else {
                        await store.unrejectShare(shareId);
                    }
                    showToast({
                        type: 'success',
                        title: targetDoc?.isFolder ? 'Folder Restored' : 'Document Restored',
                        description: `Restored "${docTitle}" to pending approval.`,
                    });
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
                }
                if (currentUser) {
                    store.syncAllDocumentShares(currentUser, departments).catch(() => {});
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
                await performRestoreItem(item);
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
            const itemsToRestore = Array.isArray(item) ? item : (item?.id ? [item] : (selectedItems.length > 0 ? selectedItems : (selectedItem ? [selectedItem] : [])));
            if (itemsToRestore.length === 0) return;

            const allDocs = useDocumentStore.getState().documents || [];
            for (const single of itemsToRestore) {
                const targetParentId = single?.parentId && single.parentId !== 'root' ? single.parentId : null;
                const parentDoc = targetParentId ? allDocs.find((d) => d.id === targetParentId) : null;
                if (parentDoc && parentDoc.isArchived) {
                    setRestoreConflictModalItem({ item: single, parentFolder: parentDoc });
                    return;
                }
            }

            await performRestoreItem(itemsToRestore);
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
            if (location.pathname !== '/users') {
                navigate('/users');
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('pamantasan:suspend-user', { detail: item }));
                }, 100);
            } else {
                window.dispatchEvent(new CustomEvent('pamantasan:suspend-user', { detail: item }));
            }
            return;
        }

        if (actionKey === 'delete') {
            if (item?.code && !item?.universityId && !item?.size && !item?.sizeBytes) {
                if (location.pathname !== '/departments') {
                    navigate('/departments');
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('pamantasan:delete-department', { detail: item }));
                    }, 100);
                } else {
                    window.dispatchEvent(new CustomEvent('pamantasan:delete-department', { detail: item }));
                }
                return;
            }
            if (item?.subject || targetItem?.subject) {
                const reqItem = item?.subject ? item : targetItem;
                const isClosed = reqItem.status === constants.DOCUMENT_REQUESTS_STATUS.RESOLVED || reqItem.status === constants.DOCUMENT_REQUESTS_STATUS.REJECTED;
                const isAdmin = constants.isAdminRole(currentUser?.role);
                if (isClosed && !isAdmin) {
                    showToast({
                        type: 'error',
                        title: 'Action Prohibited',
                        description: 'Closed and resolved document requests cannot be deleted for compliance and auditing.',
                    });
                    return;
                }
                if (location.pathname !== '/requests') {
                    navigate('/requests');
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('pamantasan:delete-document-request', { detail: item }));
                    }, 100);
                } else {
                    window.dispatchEvent(new CustomEvent('pamantasan:delete-document-request', { detail: item }));
                }
                return;
            }
            if (item?.universityId || (item?.email && item?.role)) {
                if (location.pathname !== '/users') {
                    navigate('/users');
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('pamantasan:delete-user', { detail: item }));
                    }, 100);
                } else {
                    window.dispatchEvent(new CustomEvent('pamantasan:delete-user', { detail: item }));
                }
                return;
            }

            // Document or Folder deletion
            const targetDoc = item || selectedItem;
            if (location.pathname === '/archives') {
                window.dispatchEvent(new CustomEvent('pamantasan:delete-document', { detail: targetDoc }));
            } else if (location.pathname !== '/documents') {
                navigate('/documents');
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('pamantasan:delete-document', { detail: targetDoc }));
                }, 100);
            } else {
                window.dispatchEvent(new CustomEvent('pamantasan:delete-document', { detail: targetDoc }));
            }
            return;
        }

        if (actionKey === 'approve') {
            const targetDoc = item || selectedItem;
            const isDoc = Boolean(
                targetDoc &&
                !targetDoc.subject &&
                !targetDoc.universityId &&
                !targetDoc.code &&
                (targetDoc.fileName || targetDoc.mimeType || targetDoc.isFolder !== undefined || targetDoc.sizeBytes !== undefined)
            );

            if (isDoc && targetDoc?.id) {
                try {
                    const cleanId = (uid) => (typeof uid === 'string' ? uid.replace(/-/g, '').toLowerCase() : uid);
                    const rawUserDept = currentUser?.departmentId || currentUser?.department?.id || currentUser?.department;
                    const userDeptClean = cleanId(rawUserDept);
                    const docClean = cleanId(targetDoc.id);
                    const freshShares = useDocumentStore.getState().documentShares || [];

                    const directShare = freshShares.find((s) => {
                        const sDocClean = cleanId(s.document?.id ?? s.documentId);
                        const sDeptClean = cleanId(s.department?.id ?? s.departmentId);
                        const isBase = !s.recipientId && !s.recipient?.id;
                        return sDocClean === docClean && (!userDeptClean || sDeptClean === userDeptClean) && isBase;
                    }) || freshShares.find((s) => {
                        const sDocClean = cleanId(s.document?.id ?? s.documentId);
                        const sDeptClean = cleanId(s.department?.id ?? s.departmentId);
                        return sDocClean === docClean && (!userDeptClean || sDeptClean === userDeptClean);
                    });

                    if (directShare) {
                        await useDocumentStore.getState().approveShare(directShare.id);
                    } else if (rawUserDept) {
                        await useDocumentStore.getState().insertDocumentShare({
                            documentId: targetDoc.id,
                            departmentId: rawUserDept,
                            sharerId: currentUser?.id,
                            recipientId: null,
                            status: constants.DOCUMENT_SHARES_STATUS.APPROVED,
                        });
                    }
                    await useDocumentStore.getState().fetchDocumentShares(targetDoc.id).catch(() => {});
                    if (currentUser) {
                        useDocumentStore.getState().syncAllDocumentShares(currentUser, departments, true).catch(() => {});
                    }
                    showToast({
                        type: 'success',
                        title: targetDoc.isFolder ? 'Folder Approved' : 'Document Approved',
                        description: `Approved "${targetDoc.title || targetDoc.name || 'document'}" for director review.`,
                    });
                } catch (err) {
                    console.error('Failed to approve document share:', err);
                    showToast({
                        type: 'error',
                        title: 'Approval Failed',
                        description: err?.message || 'Could not approve document share.',
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
            const reqItem = item?.subject ? item : (selectedItem?.subject ? selectedItem : targetItem);
            if (reqItem?.subject) {
                if (location.pathname !== '/requests') {
                    navigate('/requests');
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('pamantasan:reject-document-request', { detail: reqItem }));
                    }, 100);
                } else {
                    window.dispatchEvent(new CustomEvent('pamantasan:reject-document-request', { detail: reqItem }));
                }
                return;
            }

            const targetDoc = item || selectedItem;
            const isDoc = Boolean(
                targetDoc &&
                !targetDoc.subject &&
                !targetDoc.universityId &&
                !targetDoc.code &&
                (targetDoc.fileName || targetDoc.mimeType || targetDoc.isFolder !== undefined || targetDoc.sizeBytes !== undefined)
            );

            if (isDoc && targetDoc?.id) {
                try {
                    const cleanId = (uid) => (typeof uid === 'string' ? uid.replace(/-/g, '').toLowerCase() : uid);
                    const rawUserDept = currentUser?.departmentId || currentUser?.department?.id || currentUser?.department;
                    const userDeptClean = cleanId(rawUserDept);
                    const docClean = cleanId(targetDoc.id);
                    const reason = targetDoc.rejectionReason || 'Rejected by Officer';
                    const freshShares = useDocumentStore.getState().documentShares || [];

                    const directShare = freshShares.find((s) => {
                        const sDocClean = cleanId(s.document?.id ?? s.documentId);
                        const sDeptClean = cleanId(s.department?.id ?? s.departmentId);
                        const isBase = !s.recipientId && !s.recipient?.id;
                        return sDocClean === docClean && (!userDeptClean || sDeptClean === userDeptClean) && isBase;
                    }) || freshShares.find((s) => {
                        const sDocClean = cleanId(s.document?.id ?? s.documentId);
                        const sDeptClean = cleanId(s.department?.id ?? s.departmentId);
                        return sDocClean === docClean && (!userDeptClean || sDeptClean === userDeptClean);
                    });

                    if (directShare) {
                        await useDocumentStore.getState().rejectShare(directShare.id, reason, currentUser?.id);
                    } else if (rawUserDept) {
                        await useDocumentStore.getState().insertDocumentShare({
                            documentId: targetDoc.id,
                            departmentId: rawUserDept,
                            sharerId: currentUser?.id,
                            recipientId: null,
                            status: constants.DOCUMENT_SHARES_STATUS.REJECTED,
                            rejectionReason: reason,
                            rejecterId: currentUser?.id,
                        });
                        const docVers = (useDocumentStore.getState().documentVersions || []).filter(
                            (v) => (v.document?.id ?? v.documentId) === targetDoc.id
                        );
                        const latestVer = [...docVers].sort((a, b) => (b.version || 0) - (a.version || 0))[0];
                        if (latestVer?.id) {
                            await useDocumentStore.getState().updateDocumentVersion(latestVer.id, {
                                rejectionReason: reason,
                                rejecterId: currentUser?.id,
                                updatedAt: new Date().toISOString(),
                            });
                        }
                    }
                    await useDocumentStore.getState().fetchDocumentShares(targetDoc.id).catch(() => {});
                    if (currentUser) {
                        useDocumentStore.getState().syncAllDocumentShares(currentUser, departments, true).catch(() => {});
                    }
                    showToast({
                        type: 'warning',
                        title: targetDoc.isFolder ? 'Folder Rejected' : 'Document Rejected',
                        description: `Rejected "${targetDoc.title || targetDoc.name || 'document'}". Item remains in repository as Rejected.`,
                    });
                } catch (err) {
                    console.error('Failed to reject document share:', err);
                    showToast({
                        type: 'error',
                        title: 'Rejection Failed',
                        description: err?.message || 'Could not reject document share.',
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

        if (actionKey === 'publish') {
            const targetDoc = item || selectedItem;
            if (targetDoc) {
                useDocumentStore.getState().setPublishModalDocument(targetDoc);
            }
            return;
        }

        if (['unpublish', 'stash', 'unstash', 'unapprove', 'unreject'].includes(actionKey)) {
            const targetDoc = item || selectedItem;
            const isDoc = Boolean(
                targetDoc &&
                !targetDoc.subject &&
                !targetDoc.universityId &&
                !targetDoc.code &&
                (targetDoc.fileName || targetDoc.mimeType || targetDoc.isFolder !== undefined || targetDoc.sizeBytes !== undefined)
            );

            if (isDoc && targetDoc?.id) {
                try {
                    const cleanId = (uid) => (typeof uid === 'string' ? uid.replace(/-/g, '').toLowerCase() : uid);
                    const rawUserDept = currentUser?.departmentId || currentUser?.department?.id || currentUser?.department;
                    const userDeptClean = cleanId(rawUserDept);
                    const docClean = cleanId(targetDoc.id);
                    const freshShares = useDocumentStore.getState().documentShares || [];

                    const directShare = freshShares.find((s) => {
                        const sDocClean = cleanId(s.document?.id ?? s.documentId);
                        const sDeptClean = cleanId(s.department?.id ?? s.departmentId);
                        const isBase = !s.recipientId && !s.recipient?.id;
                        return sDocClean === docClean && (!userDeptClean || sDeptClean === userDeptClean) && isBase;
                    }) || freshShares.find((s) => {
                        const sDocClean = cleanId(s.document?.id ?? s.documentId);
                        const sDeptClean = cleanId(s.department?.id ?? s.departmentId);
                        return sDocClean === docClean && (!userDeptClean || sDeptClean === userDeptClean);
                    });

                    if (actionKey === 'stash') {
                        if (targetDoc.isFolder && rawUserDept) {
                            await useDocumentStore.getState().updateShareStatusRecursive(targetDoc.id, rawUserDept, constants.DOCUMENT_SHARES_STATUS.STASHED);
                        } else if (directShare) {
                            await useDocumentStore.getState().stashShare(directShare.id);
                        } else if (rawUserDept) {
                            await useDocumentStore.getState().insertDocumentShare({
                                documentId: targetDoc.id,
                                departmentId: rawUserDept,
                                sharerId: currentUser?.id,
                                recipientId: null,
                                status: constants.DOCUMENT_SHARES_STATUS.STASHED,
                            });
                        }
                    } else if (actionKey === 'unstash') {
                        if (targetDoc.isFolder && rawUserDept) {
                            await useDocumentStore.getState().updateShareStatusRecursive(targetDoc.id, rawUserDept, constants.DOCUMENT_SHARES_STATUS.APPROVED);
                        } else if (directShare) {
                            await useDocumentStore.getState().unstashShare(directShare.id);
                        } else if (rawUserDept) {
                            await useDocumentStore.getState().insertDocumentShare({
                                documentId: targetDoc.id,
                                departmentId: rawUserDept,
                                sharerId: currentUser?.id,
                                recipientId: null,
                                status: constants.DOCUMENT_SHARES_STATUS.APPROVED,
                            });
                        }
                    } else if (actionKey === 'unpublish') {
                        if (targetDoc.isFolder && rawUserDept) {
                            await useDocumentStore.getState().updateShareStatusRecursive(targetDoc.id, rawUserDept, constants.DOCUMENT_SHARES_STATUS.APPROVED);
                        } else if (directShare) {
                            await useDocumentStore.getState().unpublishShare(directShare.id);
                        }
                    } else if (actionKey === 'unapprove') {
                        if (targetDoc.isFolder && rawUserDept) {
                            await useDocumentStore.getState().updateShareStatusRecursive(targetDoc.id, rawUserDept, constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL);
                        } else if (directShare) {
                            await useDocumentStore.getState().unapproveShare(directShare.id);
                        } else if (rawUserDept) {
                            await useDocumentStore.getState().insertDocumentShare({
                                documentId: targetDoc.id,
                                departmentId: rawUserDept,
                                sharerId: currentUser?.id,
                                recipientId: null,
                                status: constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL,
                            });
                        }
                    } else if (actionKey === 'unreject') {
                        if (targetDoc.isFolder && rawUserDept) {
                            await useDocumentStore.getState().updateShareStatusRecursive(targetDoc.id, rawUserDept, constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL);
                        } else if (directShare) {
                            await useDocumentStore.getState().unrejectShare(directShare.id);
                        } else if (rawUserDept) {
                            await useDocumentStore.getState().insertDocumentShare({
                                documentId: targetDoc.id,
                                departmentId: rawUserDept,
                                sharerId: currentUser?.id,
                                recipientId: null,
                                status: constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL,
                            });
                        }
                    }

                    await useDocumentStore.getState().fetchDocumentShares(targetDoc.id).catch(() => {});
                    if (currentUser) {
                        useDocumentStore.getState().syncAllDocumentShares(currentUser, departments, true).catch(() => {});
                    }

                    const titleMap = {
                        stash: 'Document Stashed',
                        unstash: 'Document Unstashed',
                        unpublish: 'Document Unpublished',
                        unapprove: 'Approval Revoked',
                        unreject: 'Document Restored',
                    };
                    const descMap = {
                        stash: `Stashed "${targetDoc.title || targetDoc.name || 'document'}" at upper management level.`,
                        unstash: `Restored "${targetDoc.title || targetDoc.name || 'document'}" to approved state.`,
                        unpublish: `Unpublished "${targetDoc.title || targetDoc.name || 'document'}" and returned it to approved status.`,
                        unapprove: `Reverted "${targetDoc.title || targetDoc.name || 'document'}" to pending approval.`,
                        unreject: `Restored "${targetDoc.title || targetDoc.name || 'document'}" to pending approval.`,
                    };

                    showToast({
                        type: 'information',
                        title: titleMap[actionKey] || 'Action Completed',
                        description: descMap[actionKey] || `Completed ${actionKey}.`,
                    });
                } catch (err) {
                    console.error(`Failed to execute ${actionKey} in Inspector:`, err);
                    showToast({
                        type: 'error',
                        title: 'Action Failed',
                        description: err?.message || `Could not complete ${actionKey}.`,
                    });
                }
                return;
            }
        }

        if (actionKey === 'resolve') {
            const reqItem = item?.subject ? item : (selectedItem?.subject ? selectedItem : targetItem);
            if (reqItem?.subject) {
                if (location.pathname !== '/requests') {
                    navigate('/requests');
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('pamantasan:resolve-document-request', { detail: reqItem }));
                    }, 100);
                } else {
                    window.dispatchEvent(new CustomEvent('pamantasan:resolve-document-request', { detail: reqItem }));
                }
                return;
            }
        }

        if (actionKey === 'reopen') {
            if (isDocRequest || targetItem?.subject || item?.subject) {
                showToast({
                    type: 'warning',
                    title: 'Action Prohibited',
                    description: 'Closed and resolved document requests cannot be reopened for compliance and auditing.',
                });
                return;
            }
            showToast({
                type: 'information',
                title: 'Request Reopened',
                description: 'Governance request reopened for re-evaluation.',
            });
            return;
        }
    };



    const performRestoreItem = async (item) => {
        const itemsToRestore = Array.isArray(item) ? item : (item?.id ? [item] : []);
        if (itemsToRestore.length === 0) return;
        try {
            for (const single of itemsToRestore) {
                if (single?.id) {
                    await useDocumentStore.getState().archiveDocument(single.id, false);
                }
            }
            const restoredIds = new Set(itemsToRestore.map((it) => it.id));
            setSelectedItems((prev) => (Array.isArray(prev) ? prev.filter((p) => !restoredIds.has(p.id)) : []));
            setSelectedItem((prev) => (prev && restoredIds.has(prev.id) ? null : prev));
            showToast({
                type: 'success',
                title: itemsToRestore.length > 1 ? 'Items Restored' : (itemsToRestore[0]?.isFolder ? 'Folder Restored' : 'Document Restored'),
                description: itemsToRestore.length > 1
                    ? `${itemsToRestore.length} items restored to active repository.`
                    : `"${itemsToRestore[0]?.name ?? itemsToRestore[0]?.title}" restored to active repository.`,
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

            setSelectedItems([]);
            setSelectedItem(null);
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

            {/* 1.5. PUBLIC MOBILE SCAN SYNC ROUTE (Direct camera pairing from phone) */}
            <Route
                path="/mobile-sync/:sessionId"
                element={<MobileSyncCapturePage />}
            />

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
                            selectedItem={selectedItem}
                            isDetailPanelOpen={isDetailPanelOpen}
                            detailPanelTitle={
                                selectedItems.length > 1
                                    ? `You select multiple files (${selectedItems.length})`
                                    : selectedItems.length === 1
                                    ? `Selected item (${selectedItems.length})`
                                    : selectedItem
                                    ? 'Record Inspector'
                                    : 'Inspector'
                            }
                            detailPanelContent={
                                <Inspector
                                    item={selectedItem}
                                    selectedItems={selectedItems}
                                    currentUser={currentUser}
                                    targetTab={inspectorTab}
                                    onTabChange={(tab) => setInspectorTab(tab)}
                                    onClose={handleCloseDetailPanel}
                                    onAction={handleDetailAction}
                                    onUnstageItem={handleUnstageItem}
                                    onClearSelection={handleClearSelection}
                                />
                            }
                            onNavigationChange={handleNavigationChange}
                            onToggleDetailPanel={handleToggleDetailPanel}
                            onCloseDetailPanel={handleCloseDetailPanel}
                            onSelectRecord={handleSelectActivity}
                            onSignOut={handleSignOut}
                            onDetailAction={handleDetailAction}
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
                            selectedItem={selectedItem}
                            selectedItems={selectedItems}
                            onSelectDocument={handleSelectActivity}
                            onSelectMultiple={handleSelectMultiple}
                        />
                    }
                />
                <Route
                    path="/archives"
                    element={
                        constants.isStaffRole(currentUser?.role) ? (
                            <ArchivesPage
                                currentUser={currentUser}
                                selectedItem={selectedItem}
                                selectedItems={selectedItems}
                                onSelectDocument={handleSelectActivity}
                                onSelectMultiple={handleSelectMultiple}
                            />
                        ) : (
                            <Navigate to="/documents" replace />
                        )
                    }
                />
                <Route
                    path="/requests"
                    element={
                        <RequestsPage
                            currentUser={currentUser}
                            selectedItem={selectedItem}
                            selectedItems={selectedItems}
                            onSelectRequest={handleSelectActivity}
                            onSelectMultiple={handleSelectMultiple}
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
                                selectedItem={selectedItem}
                                selectedItems={selectedItems}
                                onSelectDepartment={handleSelectActivity}
                                onSelectMultiple={handleSelectMultiple}
                            />
                        }
                    />
                    <Route
                        path="/users"
                        element={
                            <UsersPage
                                currentUser={currentUser}
                                selectedItem={selectedItem}
                                selectedItems={selectedItems}
                                onSelectUser={handleSelectActivity}
                                onSelectMultiple={handleSelectMultiple}
                            />
                        }
                    />
                    <Route
                        path="/coordinator"
                        element={
                            <CoordinatorPage
                                currentUser={currentUser}
                                selectedItem={selectedItem}
                                selectedItems={selectedItems}
                                onSelectRequest={handleSelectActivity}
                                onSelectMultiple={handleSelectMultiple}
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
                description={`The original parent folder "${restoreConflictModalItem.parentFolder?.name || restoreConflictModalItem.parentFolder?.title || 'Parent Folder'}" is currently archived. To restore this item, its parent folder must also be restored.`}
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
                confirmLabel="Restore Parent & File"
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
