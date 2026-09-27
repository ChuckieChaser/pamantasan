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
    FolderTree,
    LayoutGrid,
    List,
    Shield,
    Users,
    ArrowUpRight,
    ArrowRight,
    FileUp,
    Plus,
    Archive,
    Search,
    Lock,
    Zap,
    Check,
} from 'lucide-react';
import {
    Avatar,
    Badge,
    Button,
    Container,
    ReadershipChart,
    SelectField,
    compute7DaySlots,
    resolveUserAvatar,
    formatDateTime,
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
const PAGE_SIZE = 50;

const AUDIT_CATEGORY_OPTIONS = [
    { value: 'ALL', label: 'All Activities' },
    { value: 'DOCUMENTS', label: 'Documents' },
    { value: 'REQUESTS', label: 'Clearance Requests' },
    { value: 'GOVERNANCE', label: 'Governance & Shares' },
    { value: 'USERS', label: 'Users & Units' },
];

const ROLE_BADGE_STYLES = {
    ADMINISTRATOR: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
    COORDINATOR: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
    DIRECTOR: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    OFFICER: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    MEMBER: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
};

const ACTION_VERB_STYLES = {
    UPLOADED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    CREATED: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
    UPDATED: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',
    ARCHIVED: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    UNARCHIVED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    DELETED: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
    RESOLVED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    REJECTED: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
    SHARED: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
    PUBLISHED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    COMMENTED: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20',
};

const CLASSIFICATION_STYLES = {
    PUBLIC: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    RESTRICTED: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    CONFIDENTIAL: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
    UNCLASSIFIED: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/20',
};


// --- HELPERS ---
const getTimeOfDayGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
};

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
    const [analyticsViewMode, setAnalyticsViewMode] = useState('LIST'); // 'LIST' | 'GRID'
    const [suppressReadAudits, setSuppressReadAudits] = useState(false);

    // DERIVED VALUES
    const { currentUser: authUser } = useAuth();
    const storeUser = useAuthStore((state) => state.currentUser);
    const activeUser = currentUser ?? authUser ?? storeUser ?? useAuthStore.getState().currentUser;
    const isStaff = isStaffRole(activeUser?.role);
    const isAdmin = constants.isAdminRole(activeUser?.role);
    const activeUserId = activeUser?.id;
    const greeting = useMemo(() => getTimeOfDayGreeting(), []);

    // FETCH DATA
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

    // SYNC SHARES
    useEffect(() => {
        if (!activeUser) return;
        const timer = setTimeout(() => {
            syncAllDocumentShares(activeUser, departments).catch(() => {});
        }, 120);
        return () => clearTimeout(timer);
    }, [activeUser?.id, activeUser?.departmentId, activeUser?.role, departments?.length, syncAllDocumentShares]);

    // Resolve user's unit
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
        const totalFoldersCount = safeDocs.filter((item) => item?.isFolder).length;
        const pendingDocRequestsCount = safeRequests.filter((item) => (item?.status ?? '').toUpperCase() === constants.DOCUMENT_REQUESTS_STATUS.OPEN).length;
        const pendingCoordRequestsCount = safeCoordinator.filter((item) => (item?.status ?? '').toUpperCase() === constants.COORDINATOR_REQUESTS_STATUS.PENDING).length;
        const totalPendingCount = pendingDocRequestsCount + pendingCoordRequestsCount;
        const totalUnitsCount = safeDepts.length;

        return {
            totalDocsCount,
            totalFoldersCount,
            totalPendingCount,
            pendingDocRequestsCount,
            pendingCoordRequestsCount,
            totalUnitsCount,
            totalNodesCount: safeDocs.length,
            totalUsersCount: (users || []).length,
        };
    }, [documents, requests, visibleCoordinatorRequests, departments, users]);

    // DOCUMENT ANALYTICS (RESTRICTED TO SHARED REPOSITORY FILES)
    const documentAnalyticsList = useMemo(() => {
        const allDocs = Array.isArray(documents) ? documents.filter((d) => !d?.isArchived) : [];
        const safeLogs = Array.isArray(auditLogs) ? auditLogs : [];
        const safeUsers = Array.isArray(users) ? users : [];
        const safeDepts = Array.isArray(departments) ? departments : [];
        const safeShares = Array.isArray(documentShares) ? documentShares : [];

        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);

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

        const allSharedDocIds = new Set([...directlySharedIds, ...inheritedSharedDocIds]);

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

        const eligibleFiles = allDocs.filter((doc) => {
            const isFolder = Boolean(doc?.isFolder || doc?.mimeType === 'folder');
            if (isFolder) return false;

            const docId = doc.id;
            const cId = cleanId(docId);

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

            const slots = compute7DaySlots(docLogs);
            const weekReads = slots.reduce((acc, s) => acc + s.count, 0);
            const totalReads = docLogs.length;

            const weekUniqueActors = new Set();
            slots.forEach((s) => s.uniqueActors?.forEach((actorId) => weekUniqueActors.add(actorId)));
            const weekUniqueReaders = weekUniqueActors.size;
            const totalUniqueReaders = new Set(docLogs.map((l) => l?.actor?.id ?? l?.actorId).filter(Boolean)).size;

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
                extension: doc.name ? doc.name.split('.').pop() : 'pdf',
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

        return [...openDocRequests, ...pendingCoordRequests].slice(0, 6);
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
                humanDescription = `"${subjectOrTitle}"`;
            } else {
                humanDescription = `${actionFormatted.toLowerCase()} on ${entityTypeFormatted.toLowerCase()}`;
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
                actorUser: actor,
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
        <div className={`flex flex-col gap-3.5 sm:gap-4.5 w-full ${className ?? ''}`} {...props}>
            {/* 1. EXECUTIVE WELCOME COMMAND HERO */}
            <div className="relative overflow-hidden rounded-2xl border border-surface-border bg-surface p-4 sm:p-5 shadow-xs">
                {/* AMBIENT BACKGROUND GLOW */}
                <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
                <div className="pointer-events-none absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-information/10 blur-3xl" />

                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* LEFT CONTENT */}
                    <div className="flex flex-col gap-1.5 max-w-2xl">
                        {/* INSTITUTIONAL STATUS CHIP */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent-background border border-accent-border text-accent tracking-wide uppercase">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
                                </span>
                                Pamantasan Central Records
                            </span>

                            <span className="text-xs font-medium text-text-muted flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-hover/70 border border-surface-border">
                                <Shield className="h-3 w-3 text-accent" />
                                <span>{userUnitName}</span>
                            </span>

                            <span className="text-xs text-text-muted hidden sm:inline">
                                AY 2026–2027
                            </span>
                        </div>

                        {/* HEADLINE GREETING */}
                        <h1 className="text-xl sm:text-2xl font-bold font-serif text-text tracking-tight mt-0.5">
                            {greeting}, {activeUser?.firstName ?? 'Faculty Member'}!
                        </h1>

                        <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-xl">
                            Welcome to the institutional records repository. Browse charters, review clearances, inspect real-time departmental readership, and monitor authenticated compliance logs.
                        </p>
                    </div>

                    {/* RIGHT ACTION BUTTONS */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 self-stretch sm:self-auto">
                        {!isStaff ? (
                            <Button
                                variant="secondary"
                                leadingIcon={Plus}
                                label="Request Clearance"
                                onClick={() => (onRequestDocument ? onRequestDocument() : onNavigate?.('requests'))}
                                className="flex-1 sm:flex-initial"
                            />
                        ) : (
                            <Button
                                variant="secondary"
                                leadingIcon={FileUp}
                                label="Upload Document"
                                onClick={() => (onUploadDocument ? onUploadDocument() : onNavigate?.('documents'))}
                                className="flex-1 sm:flex-initial"
                            />
                        )}

                        <Button
                            variant="primary"
                            leadingIcon={Folder}
                            label="Browse Repository"
                            onClick={() => (onUploadDocument ? onUploadDocument() : onNavigate?.('documents'))}
                            className="flex-1 sm:flex-initial shadow-xs hover:shadow-md transition-shadow"
                        />
                    </div>
                </div>
            </div>

            {/* 2. BENTO-GRID KPI METRIC CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                {/* CARD 1: TOTAL DOCUMENTS */}
                <div
                    onClick={() => onNavigate?.('documents')}
                    className="p-3.5 sm:p-4 rounded-xl bg-surface border border-surface-border hover:border-accent/50 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2.5 group"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                            Active Documents
                        </span>
                        <div className="p-2 rounded-lg bg-accent-background text-accent group-hover:scale-105 transition-transform">
                            <FileText className="h-4 w-4" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-0.5">
                        <span className="text-2xl sm:text-3xl font-bold text-text font-serif tracking-tight">
                            {dynamicMetrics.totalDocsCount}
                        </span>
                        <span className="text-xs text-text-muted">
                            Across {dynamicMetrics.totalFoldersCount} organized directories
                        </span>
                    </div>

                    <div className="pt-2 border-t border-surface-border flex items-center justify-between text-[11px] text-text-muted">
                        <span className="flex items-center gap-1 text-accent font-semibold">
                            <Zap className="h-3 w-3" /> Live Catalog
                        </span>
                        <span>{dynamicMetrics.totalNodesCount} total nodes</span>
                    </div>
                </div>

                {/* CARD 2: PENDING CLEARANCES */}
                <div
                    onClick={() => onNavigate?.(isStaff ? 'coordinator' : 'requests')}
                    className="p-3.5 sm:p-4 rounded-xl bg-surface border border-surface-border hover:border-warning/50 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2.5 group"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                            Pending Clearances
                        </span>
                        <div className={`p-2 rounded-lg ${dynamicMetrics.totalPendingCount > 0 ? 'bg-warning-background text-warning' : 'bg-accent-background text-accent'} group-hover:scale-105 transition-transform`}>
                            <Clock className="h-4 w-4" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-0.5">
                        <span className="text-2xl sm:text-3xl font-bold text-text font-serif tracking-tight">
                            {dynamicMetrics.totalPendingCount}
                        </span>
                        <span className="text-xs text-text-muted">
                            {dynamicMetrics.totalPendingCount > 0
                                ? `${dynamicMetrics.pendingDocRequestsCount} requests • ${dynamicMetrics.pendingCoordRequestsCount} coordinator`
                                : 'All clearance queues resolved'}
                        </span>
                    </div>

                    <div className="pt-2 border-t border-surface-border flex items-center justify-between text-[11px]">
                        {dynamicMetrics.totalPendingCount > 0 ? (
                            <span className="text-warning font-semibold flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
                                Action Needed
                            </span>
                        ) : (
                            <span className="text-accent font-semibold flex items-center gap-1">
                                <Check className="h-3.5 w-3.5" /> All Clear
                            </span>
                        )}
                        <span className="text-text-muted">Review Queue</span>
                    </div>
                </div>

                {/* CARD 3: CONNECTED UNITS */}
                <div
                    onClick={() => onNavigate?.('departments')}
                    className="p-3.5 sm:p-4 rounded-xl bg-surface border border-surface-border hover:border-information/50 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2.5 group"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                            Academic Units
                        </span>
                        <div className="p-2 rounded-lg bg-information-background text-information group-hover:scale-105 transition-transform">
                            <Building2 className="h-4 w-4" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-0.5">
                        <span className="text-2xl sm:text-3xl font-bold text-text font-serif tracking-tight">
                            {dynamicMetrics.totalUnitsCount}
                        </span>
                        <span className="text-xs text-text-muted">
                            Colleges & administrative offices
                        </span>
                    </div>

                    <div className="pt-2 border-t border-surface-border flex items-center justify-between text-[11px] text-text-muted">
                        <span className="text-information font-semibold flex items-center gap-1">
                            <Users className="h-3 w-3" /> {dynamicMetrics.totalUsersCount} Accounts
                        </span>
                        <span>Institutional Directory</span>
                    </div>
                </div>
            </div>

            {/* 3. DOCUMENT ANALYSIS HUB */}
            <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-surface-border flex flex-col gap-3.5 shadow-xs">
                {/* HUB HEADER & CONTROLS */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-surface-border pb-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-accent-background text-accent shrink-0">
                            <TrendingUp className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-bold font-serif text-text truncate">
                                    Document Analysis
                                </h2>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent-background text-accent border border-accent-border shrink-0">
                                    Shared Records
                                </span>
                            </div>
                            <span className="text-xs text-text-muted truncate">
                                Weekly views, reader velocity, and top accessing college units across shared repository files.
                            </span>
                        </div>
                    </div>

                    {/* TOOLBAR CONTROLS */}
                    <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap sm:flex-nowrap">
                        {/* VIEW MODE TOGGLE */}
                        <div className="flex items-center bg-surface-hover/70 p-0.5 rounded-lg border border-surface-border">
                            <button
                                type="button"
                                onClick={() => setAnalyticsViewMode('LIST')}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                                    analyticsViewMode === 'LIST'
                                        ? 'bg-accent text-text-inverted shadow-2xs font-semibold'
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
                                        ? 'bg-accent text-text-inverted shadow-2xs font-semibold'
                                        : 'text-text-muted hover:text-text'
                                }`}
                                title="Grid View"
                            >
                                <LayoutGrid className="h-3.5 w-3.5" />
                                <span>Grid</span>
                            </button>
                        </div>

                        {/* SORT SELECTOR */}
                        <div className="flex items-center bg-surface-hover/70 p-0.5 rounded-lg border border-surface-border">
                            <button
                                type="button"
                                onClick={() => setAnalyticsSortBy('READS')}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                                    analyticsSortBy === 'READS'
                                        ? 'bg-accent text-text-inverted font-semibold shadow-2xs'
                                        : 'text-text-muted hover:text-text'
                                }`}
                            >
                                Most Read
                            </button>
                            <button
                                type="button"
                                onClick={() => setAnalyticsSortBy('RECENT')}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                                    analyticsSortBy === 'RECENT'
                                        ? 'bg-accent text-text-inverted font-semibold shadow-2xs'
                                        : 'text-text-muted hover:text-text'
                                }`}
                            >
                                Recent Reads
                            </button>
                        </div>
                    </div>
                </div>

                {/* ANALYTICS CONTENT: LIST vs GRID */}
                {documentAnalyticsList.length === 0 ? (
                    <div className="py-12 text-center flex flex-col items-center justify-center gap-2.5 text-text-muted border border-dashed border-surface-border rounded-xl">
                        <div className="p-3 rounded-full bg-surface-hover text-text-muted">
                            <BarChart3 className="h-6 w-6" />
                        </div>
                        <span className="text-sm font-bold text-text">No Shared Document Activity</span>
                        <p className="text-xs text-text-muted max-w-sm">
                            Only documents shared with colleges or located inside shared folders appear in readership analytics.
                        </p>
                    </div>
                ) : analyticsViewMode === 'LIST' ? (
                    /* LIST VIEW */
                    <div className="flex flex-col divide-y divide-surface-border">
                        {documentAnalyticsList.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => {
                                    if (item.documentItem) {
                                        onSelectActivity?.({ ...item.documentItem, _targetTab: 'information' });
                                    }
                                }}
                                className="py-3 px-2 sm:px-3 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-surface-hover/60 transition-colors cursor-pointer group"
                            >
                                {/* FILE TITLE & METADATA */}
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                    <div className="p-2 rounded-lg bg-surface border border-surface-border text-accent group-hover:border-accent/40 shrink-0 mt-0.5">
                                        <FileText className="h-4 w-4" />
                                    </div>
                                    <div className="flex flex-col gap-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span
                                                className="text-xs sm:text-sm font-bold text-text truncate group-hover:text-accent transition-colors"
                                                title={item.title}
                                            >
                                                {item.title}
                                            </span>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${CLASSIFICATION_STYLES[item.classification] || CLASSIFICATION_STYLES.PUBLIC}`}>
                                                {item.classification}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 text-xs text-text-muted flex-wrap">
                                            {item.parentFolderName && (
                                                <span className="flex items-center gap-1 text-[11px] font-medium text-text bg-surface-hover px-1.5 py-0.5 rounded">
                                                    📁 {item.parentFolderName}
                                                </span>
                                            )}
                                            <span className="truncate">{item.departmentName}</span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1 font-semibold text-text">
                                                <Eye className="h-3 w-3 text-accent" />
                                                {item.weekReads} reads this week
                                            </span>
                                            <span className="text-[11px]">({item.totalReads} total)</span>
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT SIDE: 7-DAY MINI GRAPH & TOP DEPT */}
                                <div className="w-full md:w-64 shrink-0 flex flex-col gap-1 pt-2 md:pt-0 border-t md:border-t-0 border-surface-border/60">
                                    <div className="flex items-center justify-between text-[10px] text-text-muted px-0.5 font-medium">
                                        <span className="truncate max-w-[140px]">Top: {item.topDeptName}</span>
                                        <span className="font-mono text-[9px] uppercase">SUN - SAT</span>
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
                                className="p-4 rounded-xl border border-surface-border bg-surface hover:bg-surface-hover hover:border-accent/40 transition-all flex flex-col justify-between gap-3 cursor-pointer group shadow-2xs"
                            >
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="p-1.5 rounded-lg bg-accent-background text-accent shrink-0">
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
                                            <span className="text-[10px] font-medium bg-surface-hover px-1.5 py-0.5 rounded border border-surface-border">
                                                📁 {item.parentFolderName}
                                            </span>
                                        )}
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${CLASSIFICATION_STYLES[item.classification] || CLASSIFICATION_STYLES.PUBLIC}`}>
                                            {item.classification}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5 pt-2 border-t border-surface-border">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-semibold text-text flex items-center gap-1">
                                            <Eye className="h-3 w-3 text-accent" />
                                            <span>{item.weekReads} Reads</span>
                                            <span className="text-text-muted font-normal text-[11px]">- {item.totalReads} total</span>
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
                                        <span className="font-mono">Weekly Trend</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 4. TWO-COLUMN SPLIT: AUDIT LOGS + ACTION ITEMS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-4.5">
                {/* LEFT 2 COLUMNS: AUDIT LOGS */}
                <div className="lg:col-span-2 p-4 sm:p-5 rounded-2xl bg-surface border border-surface-border flex flex-col gap-3.5 shadow-xs">
                    {/* AUDIT HEADER & CONTROLS */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border pb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-accent-background text-accent">
                                <Activity className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base font-bold text-text">
                                        Audit Logs
                                    </h2>
                                    <span className="text-[11px] font-semibold text-text-muted">
                                        ({totalAuditCount} events)
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* CONTROLS */}
                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                            {/* SUPPRESS READS TOGGLE */}
                            <button
                                type="button"
                                onClick={() => {
                                    setSuppressReadAudits((prev) => !prev);
                                    setAuditPage(1);
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 border ${
                                    suppressReadAudits
                                        ? 'bg-accent/15 border-accent text-accent font-semibold'
                                        : 'bg-surface border-surface-border text-text-muted hover:text-text'
                                }`}
                                title={suppressReadAudits ? 'Reads are suppressed. Click to show read events.' : 'Click to suppress read events from cluttering the audit trail.'}
                            >
                                {suppressReadAudits ? <EyeOff className="h-3.5 w-3.5 text-accent" /> : <Eye className="h-3.5 w-3.5" />}
                                <span>{suppressReadAudits ? 'Reads Suppressed' : 'Suppress Reads'}</span>
                            </button>

                            {/* SELECT FIELD CATEGORY FILTER */}
                            <div className="w-44 sm:w-48 shrink-0">
                                <SelectField
                                    value={auditCategory}
                                    options={AUDIT_CATEGORY_OPTIONS}
                                    onChange={(newVal) => {
                                        setAuditCategory(newVal);
                                        setAuditPage(1);
                                    }}
                                    leadingIcon={Filter}
                                    placeholder="Filter by category..."
                                    dropdownAlign="right"
                                    size="sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* AUDIT LOG ITEMS (FIXED HEIGHT WITH SCROLL) */}
                    <div className="h-[380px] sm:h-[420px] overflow-y-auto pr-1 flex flex-col divide-y divide-surface-border">
                        {paginatedAuditLogs.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-xs text-text-muted text-center p-4">
                                No activity recorded under "{AUDIT_CATEGORY_OPTIONS.find((o) => o.value === auditCategory)?.label ?? auditCategory}" yet.
                            </div>
                        ) : (
                            paginatedAuditLogs.map((activity) => (
                                <div
                                    key={activity.id}
                                    onClick={() => handleActivityClick(activity)}
                                    className="py-2.5 px-2 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-surface-hover/60 transition-colors cursor-pointer group"
                                >
                                    {/* ACTOR & ACTION DESCRIPTION */}
                                    <div className="flex items-start gap-2.5 min-w-0">
                                        <Avatar
                                            src={activity.actorUser ? resolveUserAvatar(activity.actorUser, activeUser) : null}
                                            alt={activity.user}
                                            size="small"
                                            className="h-7 w-7 shrink-0 text-xs mt-0.5 border border-surface-border"
                                        />

                                        <div className="flex flex-col gap-0.5 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-bold text-text truncate group-hover:text-accent transition-colors">
                                                    {activity.user}
                                                </span>
                                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ROLE_BADGE_STYLES[activity.role] || 'bg-surface-hover text-text-muted border-surface-border'}`}>
                                                    {activity.role}
                                                </span>
                                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${ACTION_VERB_STYLES[activity.action] || 'bg-surface-hover text-text-muted border-surface-border'}`}>
                                                    {activity.action}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1.5 text-xs text-text-muted truncate">
                                                <span className="truncate">{activity.title}</span>
                                                <span>•</span>
                                                <span className="truncate">{activity.department}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* TIMESTAMP */}
                                    <div className="text-[11px] text-text-muted shrink-0 self-end sm:self-center font-mono">
                                        {activity.timestamp}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* PAGINATION CONTROLS */}
                    {totalAuditPages > 1 && (
                        <div className="flex items-center justify-between pt-2.5 border-t border-surface-border text-xs text-text-muted mt-auto">
                            <span>
                                Page {auditPage} of {totalAuditPages}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    disabled={auditPage <= 1}
                                    onClick={() => setAuditPage((prev) => Math.max(1, prev - 1))}
                                    className="px-2.5 py-1 rounded-md border border-surface-border bg-surface hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-1 font-medium"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                    <span>Previous</span>
                                </button>
                                <button
                                    type="button"
                                    disabled={auditPage >= totalAuditPages}
                                    onClick={() => setAuditPage((prev) => Math.min(totalAuditPages, prev + 1))}
                                    className="px-2.5 py-1 rounded-md border border-surface-border bg-surface hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-1 font-medium"
                                >
                                    <span>Next</span>
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT 1 COLUMN: ACTION ITEMS & CLEARANCES */}
                <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-surface-border flex flex-col gap-3.5 shadow-xs">
                    <div className="flex items-center justify-between border-b border-surface-border pb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-warning-background text-warning">
                                <Inbox className="h-4 w-4" />
                            </div>
                            <h2 className="text-base font-bold text-text">
                                Action Clearances
                            </h2>
                        </div>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${pendingActionItems.length > 0 ? 'bg-warning-background text-warning border-warning-border' : 'bg-accent-background text-accent border-accent-border'}`}>
                            {pendingActionItems.length} Pending
                        </span>
                    </div>

                    {/* MATCHING FIXED HEIGHT WITH SCROLL */}
                    <div className="h-[380px] sm:h-[420px] overflow-y-auto pr-1 flex flex-col gap-2.5">
                        {pendingActionItems.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center gap-2.5 text-center text-text-muted border border-dashed border-surface-border rounded-xl p-4">
                                <div className="p-2.5 rounded-full bg-accent-background text-accent">
                                    <CheckCircle2 className="h-5 w-5" />
                                </div>
                                <span className="text-xs sm:text-sm font-bold text-text">All Clearances Resolved</span>
                                <span className="text-xs text-text-muted max-w-xs">No pending student certifications or administrative reviews awaiting action.</span>
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
                                    className="p-3 rounded-xl border border-surface-border bg-surface-hover/30 hover:bg-surface-hover hover:border-accent/40 transition-all flex flex-col gap-2 cursor-pointer group shadow-2xs shrink-0"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-bold text-text truncate capitalize group-hover:text-accent transition-colors">
                                            {item.title}
                                        </span>
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface border border-surface-border text-text-muted shrink-0">
                                            {item.badge}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-text-muted">
                                        <span className="truncate">{item.subtitle}</span>
                                        <span className="font-semibold text-accent shrink-0 flex items-center gap-1">
                                            {item.date}
                                            <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- EXPORTS ---
export { DashboardPage };
export default DashboardPage;
