// --- IMPORTS ---
import { useEffect, useMemo } from 'react';
import {
    FileText,
    Clock,
    Building2,
    Sparkles,
    Activity,
    CheckCircle2,
    Inbox,
} from 'lucide-react';
import {
    Badge,
    Button,
    Container,
} from '../components';
import {
    useDocumentStore,
    useDepartmentStore,
    useAuditStore,
    useUserStore,
    useCoordinatorStore,
} from '../stores';
import { constants } from '../constants';

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

    const fetchDocuments = useDocumentStore((state) => state.fetchDocuments);
    const fetchDocumentRequests = useDocumentStore((state) => state.fetchDocumentRequests);
    const fetchDepartments = useDepartmentStore((state) => state.fetchDepartments);
    const fetchUsers = useUserStore((state) => state.fetchUsers);
    const fetchCoordinatorRequests = useCoordinatorStore((state) => state.fetchCoordinatorRequests);
    const fetchAuditLogs = useAuditStore((state) => state.fetchAuditLogs);

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

    // DERIVED VALUES
    const dynamicMetrics = useMemo(() => {
        const safeDocs = Array.isArray(documents) ? documents : [];
        const safeRequests = Array.isArray(requests) ? requests : [];
        const safeCoordinator = Array.isArray(coordinatorRequests) ? coordinatorRequests : [];
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
                label: 'Pending Requests',
                value: totalPendingCount.toString(),
                change: totalPendingCount > 0 ? `${totalPendingCount} requires clearance` : 'All resolved',
                icon: Clock,
                trend: totalPendingCount > 0 ? 'warning' : 'positive',
            },
            {
                id: 'metric-departments',
                label: 'Connected Units',
                value: totalUnitsCount.toString(),
                change: '100% operational',
                icon: Building2,
                trend: 'neutral',
            },
            {
                id: 'metric-ai',
                label: 'AI Indexed Records',
                value: `${totalDocsCount > 0 ? '100%' : '0%'}`,
                change: 'OCR & semantic vector active',
                icon: Sparkles,
                trend: 'information',
            },
        ];
    }, [documents, requests, coordinatorRequests, departments]);

    const pendingActionItems = useMemo(() => {
        const safeRequests = Array.isArray(requests) ? requests : [];
        const safeCoordinatorReqs = Array.isArray(coordinatorRequests) ? coordinatorRequests : [];
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
                    subtitle: requesterName || 'Department Coordinator',
                    badge: 'Coordinator Approval',
                    date: formattedDate,
                };
            });

        return [...openDocRequests, ...pendingCoordRequests].slice(0, 5);
    }, [requests, coordinatorRequests, users]);

    const formattedActivities = useMemo(() => {
        const safeAuditLogs = Array.isArray(auditLogs) ? auditLogs : [];
        const safeUsers = Array.isArray(users) ? users : [];
        const safeDepts = Array.isArray(departments) ? departments : [];

        return safeAuditLogs.slice(0, 5).map((log) => {
            const actorId = typeof log?.actor === 'object' ? log.actor?.id : (log?.actorId ?? log?.actor);
            const actor = safeUsers.find((item) => item?.id === actorId);
            const actorName = actor ? `${actor.firstName ?? ''} ${actor.lastName ?? ''}`.trim() || actor.name || 'Institutional System' : 'Institutional System';
            const actorRole = actor?.role ?? constants.USERS_ROLE.MEMBER;
            const actorDepartment = safeDepts.find((item) => item?.id === actor?.departmentId)?.name ?? 'Central Administration';
            const actionFormatted = log?.action ? log.action.replace(/_/g, ' ') : 'System Action';
            const entityTypeFormatted = log?.entityType ? log.entityType.replace(/_/g, ' ') : 'Record';

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
                title: `${actionFormatted} • ${entityTypeFormatted}`,
                action: `Entity: ${log?.entityId ?? '—'}`,
                user: actorName,
                role: actorRole,
                department: actorDepartment,
                description: `Audit event: ${actionFormatted} executed by ${actorName} (${actorRole}) on ${entityTypeFormatted} [${log?.entityId ?? '—'}].`,
                createdAt: log?.createdAt,
                timestamp: formattedDate,
                status: 'Logged',
            };
        });
    }, [auditLogs, users, departments]);

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
                        <span className="text-xs text-text-muted">
                            Pamantasan Central Document Management
                        </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold font-serif text-text tracking-tight">
                        Welcome back, {currentUser?.firstName ?? 'Faculty Member'}!
                    </h2>
                    <p className="text-sm text-text-muted leading-relaxed">
                        Access university charters, board resolutions, curriculum blueprints, and manage your department's secure academic records.
                    </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <Button
                        variant="secondary"
                        label="Request Document"
                        onClick={() => (onRequestDocument ? onRequestDocument() : onNavigate?.('request_document'))}
                    />
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

            {/* TWO-COLUMN SPLIT: RECENT ACTIVITY & DEADLINES */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT 2 COLS: RECENT REPOSITORY ACTIVITY */}
                <Container
                    variant="card"
                    className="lg:col-span-2 p-6 flex flex-col gap-4 bg-surface border border-surface-border rounded-xl"
                >
                    <div className="flex items-center justify-between border-b border-surface-border pb-3">
                        <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-accent" />
                            <h3 className="font-bold text-base text-text">
                                Recent System Activity
                            </h3>
                        </div>
                        <span className="text-xs text-text-muted">
                            Live Audit Trail
                        </span>
                    </div>

                    <div className="flex flex-col divide-y divide-surface-border">
                        {formattedActivities.length === 0 ? (
                            <div className="py-8 text-center text-xs text-text-muted">
                                No activity recorded yet.
                            </div>
                        ) : (
                            formattedActivities.map((activity) => (
                                <div
                                    key={activity.id}
                                    onClick={() => onSelectActivity?.(activity)}
                                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 first:pt-0 last:pb-0 hover:bg-surface-hover/50 px-2 rounded-md transition-colors cursor-pointer"
                                >
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs font-semibold text-text capitalize">
                                            {activity.title}
                                        </span>
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
                                    onClick={() => onNavigate?.('requests')}
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
