// --- IMPORTS ---
import { useEffect, useMemo, useState } from 'react';
import {
    FileText,
    Clock,
    Building2,
    Sparkles,
    Activity,
    CheckCircle2,
    Inbox,
    Eye,
    EyeOff,
    TrendingUp,
    BarChart3,
    ChevronLeft,
    ChevronRight,
    Filter,
    Folder,
    LayoutGrid,
    List,
    Shield,
    Users,
    ArrowUpRight,
} from 'lucide-react';
import {
    Badge,
    Button,
    Container,
    ReadershipChart,
    compute7DaySlots,
} from '../components';
import {
    useDocumentStore,
    useDepartmentStore,
    useAuditStore,
    useUserStore,
    useCoordinatorStore,
    useAuthStore,
    getRecursiveDescendantDocIds,
} from '../stores';
import { useAuth } from '../hooks';
import { constants, isStaffRole } from '../constants';

// --- CONFIGURATIONS ---
const METRIC_THEMES = {
    positive: {
        container: 'hover:border-accent/40',
        iconContainer: 'bg-accent-background text-accent',
    },
    warning: {
        container: 'hover:border-warning/40',
        iconContainer: 'bg-warning-background text-warning',
    },
    information: {
        container: 'hover:border-information/40',
        iconContainer: 'bg-information-background text-information',
    },
    neutral: {
        container: 'hover:border-surface-border',
        iconContainer: 'bg-surface-hover text-text-muted',
    },
};

const PAGE_SIZE = 10;

// --- HELPERS ---
const parseLogData = (data) => {
    if (!data) return {};
    if (typeof data === 'object') return data;
    try {
        return JSON.parse(data);
    } catch {
        return { raw: data };
    }
};

// --- COMPONENTS ---
const DashboardPage = ({
    currentUser = null,
    onNavigate = null,
    onUploadDocument = null,
    onRequestDocument = null,
    onSelectActivity = null,
    className,
    ...props
}) => {
    // STORES
    const documents = useDocumentStore((state) => state.documents);
    const departments = useDepartmentStore((state) => state.departments);
    const requests = useDocumentStore((state) => state.documentRequests);
    const coordinatorRequests = useCoordinatorStore((state) => state.coordinatorRequests);
    const auditLogs = useAuditStore((state) => state.auditLogs);
    const users = useUserStore((state) => state.users);
    const documentShares = useDocumentStore((state) => state.documentShares);

    const fetchDocuments = useDocumentStore((state) => state.fetchDocuments);
    const fetchDocumentRequests = useDocumentStore((state) => state.fetchDocumentRequests);
    const fetchDepartments = useDepartmentStore((state) => state.fetchDepartments);
    const fetchUsers = useUserStore((state) => state.fetchUsers);
    const fetchCoordinatorRequests = useCoordinatorStore((state) => state.fetchCoordinatorRequests);
    const fetchAuditLogs = useAuditStore((state) => state.fetchAuditLogs);
    const syncAllDocumentShares = useDocumentStore((state) => state.syncAllDocumentShares);

    // LOCAL STATE FOR LIVE AUDIT TRAIL & ANALYTICS VIEW
    const [auditCategory, setAuditCategory] = useState('ALL');
    const [auditPage, setAuditPage] = useState(1);
    const [analyticsSortBy, setAnalyticsSortBy] = useState('READS'); // 'READS' | 'RECENT'
    const [analyticsViewMode, setAnalyticsViewMode] = useState('LIST'); // 'LIST' (DEFAULT) | 'GRID'
    const [suppressReadAudits, setSuppressReadAudits] = useState(false);

    // DERIVED VALUES
    const { currentUser: authUser } = useAuth();
    const storeUser = useAuthStore((state) => state.currentUser);
    const activeUser = currentUser ?? authUser ?? storeUser ?? useAuthStore.getState().currentUser;
    const isStaff = isStaffRole(activeUser?.role);
    const isAdmin = constants.isAdminRole(activeUser?.role);
    const activeUserId = activeUser?.id;

    // FETCH DATA: Initial repository data fetched once on mount
    useEffect(() => {
        fetchDocuments().catch(() => {});
        fetchDocumentRequests().catch(() => {});
        fetchDepartments().catch(() => {});
        fetchUsers().catch(() => {});
        fetchCoordinatorRequests().catch(() => {});
        fetchAuditLogs().catch(() => {});
    }, [
        fetchDocuments,
        fetchDocumentRequests,
        fetchDepartments,
        fetchUsers,
        fetchCoordinatorRequests,
        fetchAuditLogs,
    ]);

    // SYNC SHARES: Execute with brief delay after initial mount once user is available
    useEffect(() => {
        if (!activeUser) return;
        const timer = setTimeout(() => {
            syncAllDocumentShares(activeUser, departments).catch(() => {});
        }, 120);
        return () => clearTimeout(timer);
    }, [activeUser?.id, activeUser?.departmentId, activeUser?.role, departments?.length, syncAllDocumentShares]);

    // Resolve user's unit (RMO for Admin/Coordinator, Department for others)
    const userUnitName = useMemo(() => {
        if (isStaff) return 'Records Management Office';
        const dept = departments.find((d) => d.id === activeUser?.departmentId);
        return dept?.name || 'Academic Faculty';
    }, [isStaff, departments, activeUser?.departmentId]);

    const visibleCoordinatorRequests = useMemo(() => {
        const safe = Array.isArray(coordinatorRequests) ? coordinatorRequests : [];
        if (isAdmin) return safe;
        return safe.filter((request) => {
            if (!request) return false;
            const reqId = typeof request.requester === 'object' ? request.requester?.id : (request.requesterId ?? request.requester);
            return Boolean(activeUserId && reqId && String(reqId) === String(activeUserId));
        });
    }, [coordinatorRequests, isAdmin, activeUserId]);

    // KPI METRICS
    const dynamicMetrics = useMemo(() => {
        const safeDocs = Array.isArray(documents) ? documents : [];
        const safeRequests = Array.isArray(requests) ? requests : [];
        const safeCoordinator = visibleCoordinatorRequests;
        const safeDepts = Array.isArray(departments) ? departments : [];

        const totalDocsCount = safeDocs.filter((item) => !item?.isFolder).length;
        const pendingDocRequestsCount = safeRequests.filter((item) => (item?.status ?? '').toUpperCase() === constants.DOCUMENT_REQUESTS_STATUS.OPEN).length;
        const pendingCoordRequestsCount = safeCoordinator.filter((item) => (item?.status ?? '').toUpperCase() === constants.COORDINATOR_REQUESTS_STATUS.PENDING).length;
        const totalPendingCount = pendingDocRequestsCount + pendingCoordRequestsCount;
        const totalUnitsCount = safeDepts.length;

        return [
            {
                id: 'metric-docs',
                label: 'Total Documents',
                value: totalDocsCount.toString(),
                change: `${safeDocs.length} repository nodes`,
                icon: FileText,
                trend: 'positive',
            },
            {
                id: 'metric-pending',
                label: 'Pending Clearances',
                value: totalPendingCount.toString(),
                change: totalPendingCount > 0 ? `${totalPendingCount} awaiting clearance` : 'All requests resolved',
                icon: Clock,
                trend: totalPendingCount > 0 ? 'warning' : 'positive',
            },
            {
                id: 'metric-departments',
                label: 'Connected Units',
                value: totalUnitsCount.toString(),
                change: 'Records Office synced',
                icon: Building2,
                trend: 'neutral',
            },
            {
                id: 'metric-ai',
                label: 'Repository Vector Index',
                value: totalDocsCount > 0 ? '100%' : '0%',
                change: 'OCR & semantic vector active',
                icon: Sparkles,
                trend: 'information',
            },
        ];
    }, [documents, requests, visibleCoordinatorRequests, departments]);

    // DOCUMENT ANALYTICS (METRICS FOR SHARED REPOSITORY FILES, EXCLUDING FOLDERS & UNSHARED FILES)
    const documentAnalyticsList = useMemo(() => {
        const allDocs = Array.isArray(documents) ? documents.filter((d) => !d?.isArchived) : [];
        const safeLogs = Array.isArray(auditLogs) ? auditLogs : [];
        const safeUsers = Array.isArray(users) ? users : [];
        const safeDepts = Array.isArray(departments) ? departments : [];
        const safeShares = Array.isArray(documentShares) ? documentShares : [];

        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);

        // 1. Identify directly shared document/folder IDs strictly from active shares
        const directlySharedIds = new Set();
        safeShares.forEach((share) => {
            const status = String(share?.status || '').toUpperCase();
            if (status === 'REVOKED' || status === 'DELETED' || status === 'UNSHARED') return;
            const dId = share?.documentId || share?.document?.id;
            if (dId) {
                directlySharedIds.add(dId);
                directlySharedIds.add(cleanId(dId));
            }
        });

        // Also check if document itself carries explicit shares or isShared property
        allDocs.forEach((doc) => {
            if (
                (Array.isArray(doc.shares) && doc.shares.length > 0) ||
                (Array.isArray(doc.documentShares) && doc.documentShares.length > 0) ||
                doc.isShared === true
            ) {
                directlySharedIds.add(doc.id);
                directlySharedIds.add(cleanId(doc.id));
            }
        });

        // 2. Identify shared folders and all their descendant file IDs
        const sharedFolderIds = new Set();
        const inheritedSharedDocIds = new Set();

        allDocs.forEach((doc) => {
            const isFolder = Boolean(doc?.isFolder || doc?.mimeType === 'folder');
            if (isFolder && (directlySharedIds.has(doc.id) || directlySharedIds.has(cleanId(doc.id)))) {
                sharedFolderIds.add(doc.id);
                sharedFolderIds.add(cleanId(doc.id));
                const descendantIds = getRecursiveDescendantDocIds(doc.id, allDocs);
                descendantIds.forEach((id) => {
                    if (id !== doc.id) {
                        inheritedSharedDocIds.add(id);
                        inheritedSharedDocIds.add(cleanId(id));
                    }
                });
            }
        });

        // Combined set of all shared file IDs
        const allSharedDocIds = new Set([...directlySharedIds, ...inheritedSharedDocIds]);

        // Build read lookup per document
        const readMap = new Map();
        safeLogs.forEach((log) => {
            const act = String(log?.action || '').toUpperCase();
            if (!['READ', 'VIEW', 'VIEWED'].includes(act)) return;

            const docId = log?.entityId || log?.document?.id;
            if (!docId) return;

            const cId = cleanId(docId);
            if (!readMap.has(docId)) readMap.set(docId, []);
            readMap.get(docId).push(log);
            if (cId !== docId) {
                if (!readMap.has(cId)) readMap.set(cId, []);
                readMap.get(cId).push(log);
            }
        });

        // 3. Filter files only: exclude folders and strictly exclude unshared files
        const eligibleFiles = allDocs.filter((doc) => {
            const isFolder = Boolean(doc?.isFolder || doc?.mimeType === 'folder');
            if (isFolder) return false; // Exclude folders: mostly on the files only

            const docId = doc.id;
            const cId = cleanId(docId);

            // Check if directly shared or inside a shared folder
            if (
                allSharedDocIds.has(docId) ||
                allSharedDocIds.has(cId) ||
                directlySharedIds.has(docId) ||
                directlySharedIds.has(cId) ||
                inheritedSharedDocIds.has(docId) ||
                inheritedSharedDocIds.has(cId)
            ) {
                return true;
            }

            // Also check ancestry chain upwards to see if any parent/ancestor folder is shared
            let currParentId = doc.parentId ?? doc.parent?.id ?? doc.parentFolderId;
            while (currParentId) {
                const cParentId = cleanId(currParentId);
                if (
                    directlySharedIds.has(currParentId) ||
                    directlySharedIds.has(cParentId) ||
                    sharedFolderIds.has(currParentId) ||
                    sharedFolderIds.has(cParentId)
                ) {
                    return true;
                }
                const parentDoc = allDocs.find((d) => d.id === currParentId || cleanId(d.id) === cParentId);
                if (!parentDoc) break;
                currParentId = parentDoc.parentId ?? parentDoc.parent?.id ?? parentDoc.parentFolderId;
            }

            return false;
        });

        const analyticsList = eligibleFiles.map((doc) => {
            const docLogs = readMap.get(doc.id) || readMap.get(cleanId(doc.id)) || [];
            docLogs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

            // Compute current week slots (SUN - SAT)
            const slots = compute7DaySlots(docLogs);
            const weekReads = slots.reduce((acc, s) => acc + s.count, 0);
            const totalReads = docLogs.length;

            const weekUniqueActors = new Set();
            slots.forEach((s) => s.uniqueActors?.forEach((actorId) => weekUniqueActors.add(actorId)));
            const weekUniqueReaders = weekUniqueActors.size;

            const totalUniqueReaders = new Set(docLogs.map((l) => l?.actor?.id ?? l?.actorId).filter(Boolean)).size;

            // Resolve parent folder name
            let parentFolderName = null;
            let currParentId = doc.parentId ?? doc.parent?.id ?? doc.parentFolderId;
            while (currParentId) {
                const cParentId = cleanId(currParentId);
                const parentDoc = allDocs.find((d) => d.id === currParentId || cleanId(d.id) === cParentId);
                if (parentDoc) {
                    if (!parentFolderName) {
                        parentFolderName = parentDoc.name || parentDoc.title || 'Institutional Folder';
                    }
                    if (
                        directlySharedIds.has(currParentId) ||
                        directlySharedIds.has(cParentId) ||
                        sharedFolderIds.has(currParentId) ||
                        sharedFolderIds.has(cParentId)
                    ) {
                        parentFolderName = parentDoc.name || parentDoc.title || parentFolderName;
                        break;
                    }
                    currParentId = parentDoc.parentId ?? parentDoc.parent?.id ?? parentDoc.parentFolderId;
                } else {
                    break;
                }
            }

            // Find top accessing department
            const deptCounts = {};
            docLogs.forEach((l) => {
                const actorUser = safeUsers.find((u) => u.id === (l?.actor?.id ?? l?.actorId));
                let deptId = actorUser?.departmentId;
                if (!deptId && typeof l?.data === 'string') {
                    try {
                        const parsed = JSON.parse(l.data);
                        deptId = parsed.departmentId;
                    } catch {}
                }
                if (deptId) {
                    deptCounts[deptId] = (deptCounts[deptId] || 0) + 1;
                }
            });

            let topDeptName = 'Repository Wide';
            let topDeptMax = 0;
            Object.entries(deptCounts).forEach(([deptId, count]) => {
                if (count > topDeptMax) {
                    topDeptMax = count;
                    const d = safeDepts.find((item) => item.id === deptId);
                    if (d) topDeptName = d.name;
                }
            });

            const lastLog = docLogs[0];
            const lastReadAt = lastLog?.createdAt ? new Date(lastLog.createdAt) : null;

            return {
                id: doc.id,
                title: doc.name || doc.title || 'Institutional Record',
                extension: doc.name ? doc.name.split('.').pop() : null,
                parentFolderName,
                departmentId: doc.departmentId,
                departmentName: safeDepts.find((d) => d.id === doc.departmentId)?.name || 'Central Repository',
                classification: doc.classification || 'PUBLIC',
                weekReads,
                totalReads,
                weekUniqueReaders,
                totalUniqueReaders,
                slots,
                topDeptName,
                lastReadAt,
                documentItem: doc,
            };
        });

        // Sort analytics
        if (analyticsSortBy === 'READS') {
            analyticsList.sort((a, b) => b.weekReads - a.weekReads || b.totalReads - a.totalReads || b.weekUniqueReaders - a.weekUniqueReaders);
        } else {
            analyticsList.sort((a, b) => {
                const timeA = a.lastReadAt ? a.lastReadAt.getTime() : 0;
                const timeB = b.lastReadAt ? b.lastReadAt.getTime() : 0;
                return timeB - timeA || b.weekReads - a.weekReads;
            });
        }

        return analyticsList.slice(0, 8);
    }, [documents, documentShares, auditLogs, users, departments, analyticsSortBy]);

    // PENDING ACTION ITEMS
    const pendingActionItems = useMemo(() => {
        const safeRequests = Array.isArray(requests) ? requests : [];
        const safeCoordinatorReqs = visibleCoordinatorRequests;
        const safeUsers = Array.isArray(users) ? users : [];

        const openDocRequests = safeRequests
            .filter((item) => (item?.status ?? '').toUpperCase() === constants.DOCUMENT_REQUESTS_STATUS.OPEN)
            .map((item) => {
                const requesterId = typeof item?.requester === 'object' ? item.requester?.id : (item?.requesterId ?? item?.requester);
                const requesterUser = safeUsers.find((user) => user?.id === requesterId);
                const requesterName = requesterUser
                    ? `${requesterUser.firstName ?? ''} ${requesterUser.lastName ?? ''}`.trim() || requesterUser.name
                    : (typeof item?.requester === 'object'
                        ? `${item.requester?.firstName ?? ''} ${item.requester?.lastName ?? ''}`.trim() || item.requester?.name
                        : (typeof item?.requester === 'string' ? item.requester : 'Document Requester'));

                const dateObj = item?.createdAt ? new Date(item.createdAt) : null;
                const formattedDate = dateObj && !isNaN(dateObj.getTime())
                    ? dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' })
                    : 'Open';

                return {
                    id: item?.id,
                    title: item?.subject || 'Document Request',
                    subtitle: requesterName || 'Document Requester',
                    badge: 'Document Request',
                    date: formattedDate,
                    item,
                    type: 'document_request',
                };
            });

        const pendingCoordRequests = safeCoordinatorReqs
            .filter((item) => (item?.status ?? '').toUpperCase() === constants.COORDINATOR_REQUESTS_STATUS.PENDING)
            .map((item) => {
                const requesterId = typeof item?.requester === 'object' ? item.requester?.id : (item?.requesterId ?? item?.requester);
                const requesterUser = safeUsers.find((user) => user?.id === requesterId);
                const requesterName = requesterUser
                    ? `${requesterUser.firstName ?? ''} ${requesterUser.lastName ?? ''}`.trim() || requesterUser.name
                    : (typeof item?.requester === 'object'
                        ? `${item.requester?.firstName ?? ''} ${item.requester?.lastName ?? ''}`.trim() || item.requester?.name
                        : (typeof item?.requester === 'string' ? item.requester : 'Department Coordinator'));

                const dateObj = item?.createdAt ? new Date(item.createdAt) : null;
                const formattedDate = dateObj && !isNaN(dateObj.getTime())
                    ? dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' })
                    : 'Pending';

                return {
                    id: item?.id,
                    title: item?.action ? item.action.replace(/_/g, ' ') : 'Coordinator Request',
                    subtitle: requesterName || 'Records Coordinator',
                    badge: 'Coordinator Clearance',
                    date: formattedDate,
                    item,
                    type: 'coordinator_request',
                };
            });

        return [...openDocRequests, ...pendingCoordRequests].slice(0, 5);
    }, [requests, visibleCoordinatorRequests, users]);

    // FILTERED & PAGINATED AUDIT LOGS
    const { paginatedAuditLogs, totalAuditPages, totalAuditCount } = useMemo(() => {
        const safeAuditLogs = Array.isArray(auditLogs) ? auditLogs : [];
        const safeUsers = Array.isArray(users) ? users : [];
        const safeDepts = Array.isArray(departments) ? departments : [];

        const filtered = safeAuditLogs.filter((log) => {
            const act = String(log?.action || '').toUpperCase();
            if (suppressReadAudits && (act === 'READ' || act === 'VIEW' || act === 'VIEWED')) {
                return false;
            }
            if (auditCategory === 'ALL') return true;
            const ent = String(log?.entityType || '').toUpperCase();
            if (auditCategory === 'REQUESTS') return ent.includes('DOCUMENT_REQUEST');
            if (auditCategory === 'DOCUMENTS') return ent.includes('DOCUMENT') && !ent.includes('REQUEST');
            if (auditCategory === 'GOVERNANCE') return ent.includes('COORDINATOR') || ent.includes('SHARE');
            if (auditCategory === 'USERS') return ent.includes('USER') || ent.includes('DEPARTMENT');
            return true;
        });

        const formatted = filtered.map((log) => {
            const actorId = typeof log?.actor === 'object' ? log.actor?.id : (log?.actorId ?? log?.actor);
            const actor = safeUsers.find((item) => item?.id === actorId);
            const actorName = actor ? `${actor.firstName ?? ''} ${actor.lastName ?? ''}`.trim() || actor.name || 'Records Office' : 'Institutional System';
            const actorRole = actor?.role ?? constants.USERS_ROLE.MEMBER;
            const actorDepartment = safeDepts.find((item) => item?.id === actor?.departmentId)?.name ?? 'Records Management Office';
            const actionFormatted = log?.action ? log.action.replace(/_/g, ' ') : 'Action';
            const entityTypeFormatted = log?.entityType ? log.entityType.replace(/_/g, ' ') : 'Record';

            const parsedData = parseLogData(log?.data);
            const subjectOrTitle = parsedData.title || parsedData.subject || parsedData.name || null;

            let humanDescription = '';
            if (subjectOrTitle) {
                humanDescription = `"${subjectOrTitle}" • ${actionFormatted.toLowerCase()}`;
            } else {
                humanDescription = `${actionFormatted} executed on ${entityTypeFormatted}`;
            }

            const logDate = log?.createdAt ? new Date(log.createdAt) : null;
            const formattedDate = logDate && !isNaN(logDate.getTime())
                ? logDate.toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                  })
                : 'Recent';

            return {
                ...log,
                id: log?.id,
                title: humanDescription,
                category: entityTypeFormatted,
                action: actionFormatted,
                user: actorName,
                role: actorRole,
                department: actorDepartment,
                timestamp: formattedDate,
                parsedData,
            };
        });

        const totalCount = formatted.length;
        const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
        const safePage = Math.min(Math.max(1, auditPage), totalPages);
        const startIndex = (safePage - 1) * PAGE_SIZE;
        const pageSlice = formatted.slice(startIndex, startIndex + PAGE_SIZE);

        return {
            paginatedAuditLogs: pageSlice,
            totalAuditPages: totalPages,
            totalAuditCount: totalCount,
        };
    }, [auditLogs, users, departments, auditCategory, auditPage, suppressReadAudits]);

    // HANDLERS
    const handleActivityClick = (activity) => {
        if (!activity) return;
        // If audit belongs to a document, pass target tab
        if (activity.entityType?.includes('DOCUMENT') && !activity.entityType?.includes('REQUEST')) {
            const matchedDoc = documents.find((d) => d.id === activity.entityId);
            if (matchedDoc) {
                onSelectActivity?.({ ...matchedDoc, _targetTab: 'information' });
                return;
            }
        }
        if (activity.entityType?.includes('DOCUMENT_REQUEST')) {
            const matchedReq = requests.find((r) => r.id === activity.entityId);
            if (matchedReq) {
                onSelectActivity?.({ ...matchedReq, _targetTab: 'messages' });
                return;
            }
        }
        onSelectActivity?.(activity);
    };

    // RENDER
    return (
        <div className={`flex flex-col gap-6 w-full ${className ?? ''}`} {...props}>
            {/* WELCOME BANNER */}
            <Container
                variant="card"
                className="relative overflow-hidden bg-gradient-to-r from-accent/20 via-surface to-surface border border-surface-border p-6 sm:p-8 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
            >
                <div className="flex flex-col gap-2 max-w-2xl">
                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-accent text-text-inverted tracking-wide uppercase">
                            Academic Year 2026–2027
                        </span>
                        <span className="text-xs font-medium text-text-muted flex items-center gap-1.5">
                            <Shield className="h-3.5 w-3.5 text-accent" />
                            <span>{userUnitName}</span>
                        </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold font-serif text-text tracking-tight">
                        Welcome back, {currentUser?.firstName ?? 'Faculty Member'}!
                    </h2>
                    <p className="text-sm text-text-muted leading-relaxed">
                        Pamantasan Central Records Repository. University charters, clearance approvals, and live academic document analytics are synced institutional-wide.
                    </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    {!isStaff && (
                        <Button
                            variant="secondary"
                            label="Request Clearance"
                            onClick={() => (onRequestDocument ? onRequestDocument() : onNavigate?.('requests'))}
                        />
                    )}
                    <Button
                        variant="primary"
                        label="Browse Repository"
                        onClick={() => (onUploadDocument ? onUploadDocument() : onNavigate?.('documents'))}
                    />
                </div>
            </Container>

            {/* STATS & METRICS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {dynamicMetrics.map((metric) => {
                    const IconComponent = metric.icon;
                    const theme = METRIC_THEMES[metric.trend] ?? METRIC_THEMES.neutral;

                    return (
                        <Container
                            key={metric.id}
                            variant="card"
                            className={`p-5 flex flex-col gap-4 bg-surface border border-surface-border transition-colors rounded-xl ${theme.container}`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-text-muted">
                                    {metric.label}
                                </span>
                                <div className={`p-2 rounded-lg ${theme.iconContainer}`}>
                                    <IconComponent className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-2xl font-bold text-text">
                                    {metric.value}
                                </span>
                                <span className="text-xs text-text-muted">
                                    {metric.change}
                                </span>
                            </div>
                        </Container>
                    );
                })}
            </div>

            {/* DOCUMENT ANALYTICS (RESTRICTED TO SHARED REPOSITORY FILES) */}
            <Container
                variant="card"
                className="p-6 flex flex-col gap-4 bg-surface border border-surface-border rounded-xl"
            >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border pb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-accent-background text-accent">
                            <TrendingUp className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                            <h3 className="font-bold text-base text-text flex items-center gap-2">
                                Document Analytics
                                <Badge variant="neutral" label="Shared Files" />
                            </h3>
                            <span className="text-xs text-text-muted">
                                Real-time reads, weekly velocity, and 7-day trendlines across shared folders and records.
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
                        {/* VIEW MODE TOGGLE (LIST DEFAULT vs GRID) */}
                        <div className="flex items-center bg-surface-hover/60 p-0.5 rounded-lg border border-surface-border">
                            <button
                                type="button"
                                onClick={() => setAnalyticsViewMode('LIST')}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                                    analyticsViewMode === 'LIST'
                                        ? 'bg-accent text-text-inverted shadow-xs'
                                        : 'text-text-muted hover:text-text'
                                }`}
                                title="List View (Default)"
                            >
                                <List className="h-3.5 w-3.5" />
                                <span>List</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setAnalyticsViewMode('GRID')}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                                    analyticsViewMode === 'GRID'
                                        ? 'bg-accent text-text-inverted shadow-xs'
                                        : 'text-text-muted hover:text-text'
                                }`}
                                title="Grid View"
                            >
                                <LayoutGrid className="h-3.5 w-3.5" />
                                <span>Grid</span>
                            </button>
                        </div>

                        {/* SORT BY TOGGLE */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-text-muted font-medium hidden sm:inline">Sort:</span>
                            <button
                                type="button"
                                onClick={() => setAnalyticsSortBy('READS')}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                                    analyticsSortBy === 'READS'
                                        ? 'bg-accent text-text-inverted'
                                        : 'bg-surface-hover text-text-muted hover:text-text'
                                }`}
                            >
                                Most Read
                            </button>
                            <button
                                type="button"
                                onClick={() => setAnalyticsSortBy('RECENT')}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                                    analyticsSortBy === 'RECENT'
                                        ? 'bg-accent text-text-inverted'
                                        : 'bg-surface-hover text-text-muted hover:text-text'
                                }`}
                            >
                                Recent Reads
                            </button>
                        </div>
                    </div>
                </div>

                {documentAnalyticsList.length === 0 ? (
                    <div className="py-8 text-center flex flex-col items-center justify-center gap-2 text-text-muted">
                        <BarChart3 className="h-7 w-7 text-text-muted/40" />
                        <span className="text-xs font-semibold text-text">No shared files found</span>
                        <span className="text-[11px] text-text-muted">Only files that are shared directly or located inside shared folders are tracked in Document Analytics.</span>
                    </div>
                ) : analyticsViewMode === 'LIST' ? (
                    /* LIST VIEW (DEFAULT): COMPACT TABULAR ROW WITH GRAPH NEATLY ALIGNED BESIDE FILE DETAILS */
                    <div className="flex flex-col gap-2 pt-1">
                        {documentAnalyticsList.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => {
                                    if (item.documentItem) {
                                        onSelectActivity?.({ ...item.documentItem, _targetTab: 'information' });
                                    }
                                }}
                                className="px-3.5 py-2.5 rounded-lg border border-surface-border bg-surface-hover/20 hover:bg-surface-hover hover:border-accent/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group"
                            >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className="p-2 rounded-md bg-accent-background text-accent shrink-0">
                                        <FileText className="h-4 w-4" />
                                    </div>
                                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span
                                                className="font-semibold text-xs sm:text-sm text-text truncate group-hover:text-accent transition-colors"
                                                title={item.title}
                                            >
                                                {item.title}
                                            </span>
                                            <ArrowUpRight className="h-3 w-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                        </div>

                                        <div className="flex items-center gap-2 flex-wrap text-xs">
                                            {item.parentFolderName && (
                                                <Badge variant="information" label={`📁 ${item.parentFolderName}`} />
                                            )}
                                            <Badge variant="neutral" label={item.departmentName} />
                                            <Badge variant="neutral" label={item.classification} />

                                            {/* READ COUNTS: "10 Reads - 100 reads" */}
                                            <div className="flex items-center gap-1 font-semibold text-xs text-text ml-0.5">
                                                <Eye className="h-3 w-3 text-accent shrink-0" />
                                                <span>
                                                    {item.weekReads} {item.weekReads === 1 ? 'Read' : 'Reads'}
                                                </span>
                                                <span className="text-text-muted font-normal text-[11px]">
                                                    - {item.totalReads} {item.totalReads === 1 ? 'read' : 'reads'}
                                                </span>
                                                {item.weekUniqueReaders > 0 && (
                                                    <span className="text-[11px] text-text-muted font-normal ml-1 hidden md:inline">
                                                        ({item.weekUniqueReaders} {item.weekUniqueReaders === 1 ? 'reader' : 'readers'} this week)
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* COMPACT MINI LINE GRAPH (FIXED WIDTH COLUMN FOR CROSS-BROWSER PIXEL-PERFECT ALIGNMENT) */}
                                <div className="w-full sm:w-56 md:w-60 shrink-0 flex flex-col gap-0.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-surface-border/50">
                                    <div className="flex items-center justify-between text-[9.5px] text-text-muted px-0.5 leading-none">
                                        <span className="truncate max-w-[130px]">Top: {item.topDeptName}</span>
                                        <span className="font-mono text-[9px]">SUN - SAT</span>
                                    </div>
                                    <ReadershipChart precomputedSlots={item.slots} compact={true} showPeak={false} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* GRID VIEW */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                        {documentAnalyticsList.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => {
                                    if (item.documentItem) {
                                        onSelectActivity?.({ ...item.documentItem, _targetTab: 'information' });
                                    }
                                }}
                                className="p-4 rounded-xl border border-surface-border bg-surface-hover/20 hover:bg-surface-hover hover:border-accent/40 transition-all flex flex-col justify-between gap-3 cursor-pointer group"
                            >
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="p-1.5 rounded-md bg-accent-background text-accent shrink-0">
                                                <FileText className="h-4 w-4" />
                                            </div>
                                            <span
                                                className="font-bold text-xs text-text truncate group-hover:text-accent transition-colors"
                                                title={item.title}
                                            >
                                                {item.title}
                                            </span>
                                        </div>
                                        <ArrowUpRight className="h-3.5 w-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                    </div>

                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {item.parentFolderName && (
                                            <Badge variant="information" label={`📁 ${item.parentFolderName}`} />
                                        )}
                                        <Badge variant="neutral" label={item.departmentName} />
                                        <Badge variant="neutral" label={item.classification} />
                                    </div>
                                </div>

                                {/* 7-DAY READERSHIP LINE GRAPH */}
                                <div className="flex flex-col gap-1.5 pt-2 border-t border-surface-border/60">
                                    {/* READ COUNTS: "10 Reads - 100 reads" */}
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-semibold text-text flex items-center gap-1">
                                            <Eye className="h-3 w-3 text-accent" />
                                            <span>
                                                {item.weekReads} {item.weekReads === 1 ? 'Read' : 'Reads'}
                                            </span>
                                            <span className="text-text-muted font-normal text-[11px]">
                                                - {item.totalReads} {item.totalReads === 1 ? 'read' : 'reads'}
                                            </span>
                                        </span>
                                        <span className="text-[11px] text-text-muted">
                                            {item.weekUniqueReaders} {item.weekUniqueReaders === 1 ? 'reader' : 'readers'}
                                        </span>
                                    </div>

                                    <div className="w-full pt-1">
                                        <ReadershipChart precomputedSlots={item.slots} showPeak={false} />
                                    </div>

                                    <div className="flex items-center justify-between text-[10px] text-text-muted pt-1">
                                        <span className="truncate">Top: {item.topDeptName}</span>
                                        <span className="shrink-0 font-mono">Weekly Timeline (SUN - SAT)</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Container>

            {/* TWO-COLUMN SPLIT: RECENT ACTIVITY & ACTION ITEMS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT 2 COLS: RECENT REPOSITORY ACTIVITY (EXPANDED TO 10 ITEMS + PAGINATION) */}
                <Container
                    variant="card"
                    className="lg:col-span-2 p-6 flex flex-col gap-4 bg-surface border border-surface-border rounded-xl"
                >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border pb-3">
                        <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-accent" />
                            <h3 className="font-bold text-base text-text">
                                Live Audit Trail
                            </h3>
                            <span className="text-xs text-text-muted">
                                ({totalAuditCount} total entries)
                            </span>
                        </div>

                        {/* CONTROLS: SUPPRESS READS & CATEGORY FILTER PILLS */}
                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                            {/* SUPPRESS READS TOGGLE */}
                            <button
                                type="button"
                                onClick={() => {
                                    setSuppressReadAudits((prev) => !prev);
                                    setAuditPage(1);
                                }}
                                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 border ${
                                    suppressReadAudits
                                        ? 'bg-accent/15 border-accent text-accent font-semibold'
                                        : 'bg-surface border-surface-border text-text-muted hover:text-text'
                                }`}
                                title={suppressReadAudits ? "Reads are suppressed. Click to show read events." : "Click to suppress read events from cluttering the audit trail."}
                            >
                                {suppressReadAudits ? <EyeOff className="h-3 w-3 text-accent" /> : <Eye className="h-3 w-3" />}
                                <span>{suppressReadAudits ? "Reads Suppressed" : "Suppress Reads"}</span>
                            </button>

                            {/* CATEGORY FILTER PILLS */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {['ALL', 'REQUESTS', 'DOCUMENTS', 'GOVERNANCE', 'USERS'].map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => {
                                            setAuditCategory(cat);
                                            setAuditPage(1);
                                        }}
                                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer capitalize ${
                                            auditCategory === cat
                                                ? 'bg-accent text-text-inverted'
                                                : 'bg-surface-hover text-text-muted hover:text-text'
                                        }`}
                                    >
                                        {cat.toLowerCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col divide-y divide-surface-border">
                        {paginatedAuditLogs.length === 0 ? (
                            <div className="py-8 text-center text-xs text-text-muted">
                                No activity recorded under "{auditCategory.toLowerCase()}" yet.
                            </div>
                        ) : (
                            paginatedAuditLogs.map((activity) => (
                                <div
                                    key={activity.id}
                                    onClick={() => handleActivityClick(activity)}
                                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-hover/50 px-2.5 rounded-lg transition-colors cursor-pointer"
                                >
                                    <div className="flex flex-col gap-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-text truncate">
                                                {activity.title}
                                            </span>
                                            <Badge variant="neutral" label={activity.category} />
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-text-muted">
                                            <span>{activity.user}</span>
                                            <span>•</span>
                                            <span>{activity.department}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <Badge
                                            variant="neutral"
                                            label={activity.role}
                                        />
                                        <span className="text-xs text-text-muted">
                                            {activity.timestamp}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* PAGINATION CONTROLS (10 PER PAGE) */}
                    {totalAuditPages > 1 && (
                        <div className="flex items-center justify-between pt-3 border-t border-surface-border text-xs text-text-muted">
                            <span>
                                Page {auditPage} of {totalAuditPages}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    disabled={auditPage <= 1}
                                    onClick={() => setAuditPage((prev) => Math.max(1, prev - 1))}
                                    className="p-1.5 rounded border border-surface-border bg-surface hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-1"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                    <span>Previous</span>
                                </button>
                                <button
                                    type="button"
                                    disabled={auditPage >= totalAuditPages}
                                    onClick={() => setAuditPage((prev) => Math.min(totalAuditPages, prev + 1))}
                                    className="p-1.5 rounded border border-surface-border bg-surface hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-1"
                                >
                                    <span>Next</span>
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    )}
                </Container>

                {/* RIGHT 1 COL: PENDING ACTION ITEMS */}
                <Container
                    variant="card"
                    className="p-6 flex flex-col gap-4 bg-surface border border-surface-border rounded-xl"
                >
                    <div className="flex items-center justify-between border-b border-surface-border pb-3">
                        <div className="flex items-center gap-2">
                            <Inbox className="h-4 w-4 text-accent" />
                            <h3 className="font-bold text-base text-text">
                                Action Items & Clearances
                            </h3>
                        </div>
                        <span className="text-xs text-accent font-medium">{pendingActionItems.length} Pending</span>
                    </div>

                    <div className="flex flex-col gap-3">
                        {pendingActionItems.length === 0 ? (
                            <div className="py-8 flex flex-col items-center justify-center gap-2 text-center text-text-muted">
                                <CheckCircle2 className="h-6 w-6 text-accent" />
                                <span className="text-xs">No pending clearances or review requests.</span>
                            </div>
                        ) : (
                            pendingActionItems.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => {
                                        if (item.type === 'coordinator_request') {
                                            onNavigate?.('coordinator');
                                        } else {
                                            onNavigate?.('requests');
                                        }
                                    }}
                                    className="p-3 rounded-lg border border-surface-border bg-surface-hover/30 flex flex-col gap-2 hover:bg-surface-hover transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-semibold text-text truncate capitalize">
                                            {item.title}
                                        </span>
                                        <Badge variant="neutral" label={item.badge} />
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-text-muted">
                                        <span className="truncate">{item.subtitle}</span>
                                        <span className="font-medium text-accent shrink-0">
                                            {item.date}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Container>
            </div>
        </div>
    );
};

// --- EXPORTS ---
export { DashboardPage };
export default DashboardPage;
