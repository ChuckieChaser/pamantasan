// --- IMPORTS ---
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bell,
    BellOff,
    CheckCheck,
    Check,
    ChevronDown,
    Inbox,
    FileText,
    Building2,
    User,
    Shield,
} from 'lucide-react';
import { Badge } from '../Badge';
import { Container } from '../Container';
import { SegmentSelection } from '../Selections';
import { useToast } from '../../hooks';
import { useDocumentStore } from '../../stores/useDocumentStore';
import { useDepartmentStore } from '../../stores/useDepartmentStore';
import { useUserStore } from '../../stores/useUserStore';
import { useCoordinatorStore } from '../../stores/useCoordinatorStore';
import { useAuditStore } from '../../stores/useAuditStore';
import { useAuthStore } from '../../stores/useAuthStore';

// --- CONFIGURATIONS ---
const BASE_STYLE = 'absolute right-0 top-full mt-2 z-[100] w-[calc(100vw-2rem)] sm:w-96 md:w-[32rem] max-w-[95vw]';
const INITIAL_NOTIFICATION_LIMIT = 15;

// --- HELPERS ---
const normalizeAction = (action) => {
    const act = String(action || '').toUpperCase().trim();
    if (act.includes('DELETE') || act.includes('REMOVE')) return 'DELETED';
    if (act.includes('READ') || act.includes('VIEW')) return 'READ';
    if (act.includes('CREATE') || act.includes('UPLOAD') || act.includes('ATTACH') || act === 'NEW') return 'CREATED';
    return 'UPDATED';
};

const normalizeEntityType = (entityType) => {
    const ent = String(entityType || '').toUpperCase().replace(/_/g, ' ').trim();
    if (ent.includes('COORDINATOR')) return 'COORDINATOR REQUESTS';
    if (ent.includes('DOCUMENT REQUEST')) return 'DOCUMENT REQUESTS';
    if (ent.includes('DOCUMENT')) return 'DOCUMENTS';
    if (ent.includes('USER')) return 'USERS';
    if (ent.includes('DEPARTMENT')) return 'DEPARTMENTS';
    return 'DOCUMENTS';
};

const getEntityIcon = (entityType) => {
    switch (entityType) {
        case 'DEPARTMENTS':
            return Building2;
        case 'USERS':
            return User;
        case 'COORDINATOR REQUESTS':
            return Shield;
        case 'DOCUMENT REQUESTS':
            return Inbox;
        case 'DOCUMENTS':
        default:
            return FileText;
    }
};

const getActionBadgeVariant = (action) => {
    switch (action) {
        case 'CREATED':
            return 'success';
        case 'READ':
            return 'neutral';
        case 'UPDATED':
            return 'warning';
        case 'DELETED':
            return 'error';
        default:
            return 'neutral';
    }
};

const formatRelativeTime = (timestamp) => {
    if (!timestamp) return 'Recent';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Recent';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);

    if (diffSec < 45) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24 && date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const resolveTargetId = (notification) => {
    if (!notification) return 'unknown';
    if (notification.entityId) return String(notification.entityId);
    if (notification.targetId) return String(notification.targetId);
    if (notification.documentId) return String(notification.documentId);
    if (notification.userId) return String(notification.userId);
    if (notification.departmentId) return String(notification.departmentId);
    if (notification.requestId) return String(notification.requestId);

    let dataObj = notification.data;
    if (typeof dataObj === 'string') {
        try {
            dataObj = JSON.parse(dataObj);
        } catch {
            /* ignore */
        }
    }
    if (dataObj && typeof dataObj === 'object') {
        const idVal = dataObj.entityId || dataObj.id || dataObj.targetId || dataObj.documentId;
        if (idVal) return String(idVal);
        const nameVal = dataObj.name || dataObj.title || dataObj.fileName || dataObj.subject;
        if (nameVal) return String(nameVal);
    }

    if (notification.title && !notification.title.toUpperCase().includes('NOTIF')) {
        return String(notification.title);
    }

    return String(notification.id || 'unknown');
};

const resolveTargetName = (entityType, targetId, rawItems = [], stores = {}) => {
    const {
        documents = [],
        departments = [],
        users = [],
        coordinatorRequests = [],
        documentRequests = [],
        auditLogs = [],
    } = stores;

    // 1. Check in client stores
    if (entityType === 'DOCUMENTS') {
        const found = documents.find(
            (d) => String(d.id) === String(targetId) || String(d.uuid) === String(targetId)
        );
        if (found?.name || found?.title) return found.name || found.title;
    } else if (entityType === 'USERS') {
        const found = users.find((u) => String(u.id) === String(targetId));
        if (found) {
            const fullName = `${found.firstName || ''} ${found.lastName || ''}`.trim();
            if (fullName) return fullName;
            if (found.email) return found.email;
        }
    } else if (entityType === 'DEPARTMENTS') {
        const found = departments.find((d) => String(d.id) === String(targetId));
        if (found?.name) return found.name;
        if (found?.code) return found.code;
    } else if (entityType === 'COORDINATOR REQUESTS') {
        const found = coordinatorRequests.find((r) => String(r.id) === String(targetId));
        if (found?.title || found?.purpose) return found.title || found.purpose;
        if (found?.data) {
            let dataObj = found.data;
            if (typeof dataObj === 'string') {
                try {
                    dataObj = JSON.parse(dataObj);
                } catch {
                    /* ignore */
                }
            }
            if (dataObj?.departmentName) return dataObj.departmentName;
            if (dataObj?.documentName) return dataObj.documentName;
            if (dataObj?.name) return dataObj.name;
        }
    } else if (entityType === 'DOCUMENT REQUESTS') {
        const found = documentRequests.find((r) => String(r.id) === String(targetId));
        if (found?.subject || found?.purpose || found?.title) return found.subject || found.purpose || found.title;
    }

    // 2. Check in auditLogs by entityId (which retains historical human name even if deleted)
    if (auditLogs && auditLogs.length > 0 && targetId) {
        const matchingLog = auditLogs.find((l) => String(l.entityId) === String(targetId));
        if (matchingLog?.data) {
            let logData = matchingLog.data;
            if (typeof logData === 'string') {
                try {
                    logData = JSON.parse(logData);
                } catch {
                    /* ignore */
                }
            }
            if (logData && typeof logData === 'object') {
                if (logData.name || logData.title || logData.documentTitle || logData.fileName) {
                    return logData.name || logData.title || logData.documentTitle || logData.fileName;
                }
                if (logData.departmentName) return logData.departmentName;
                if (logData.subject) return logData.subject;
                if (logData.firstName) {
                    return `${logData.firstName} ${logData.lastName || ''}`.trim();
                }
                if (logData.actorName && entityType === 'USERS') {
                    return logData.actorName;
                }
            }
        }
    }

    // 3. Check within item data payloads
    for (const item of rawItems) {
        let dataObj = item?.data;
        if (typeof dataObj === 'string') {
            try {
                dataObj = JSON.parse(dataObj);
            } catch {
                /* ignore */
            }
        }
        if (dataObj && typeof dataObj === 'object') {
            if (dataObj.name || dataObj.title || dataObj.documentTitle || dataObj.fileName) {
                return dataObj.name || dataObj.title || dataObj.documentTitle || dataObj.fileName;
            }
            if (dataObj.departmentName) return dataObj.departmentName;
            if (dataObj.subject) return dataObj.subject;
            if (dataObj.firstName) {
                return `${dataObj.firstName} ${dataObj.lastName || ''}`.trim();
            }
            if (dataObj.userName || dataObj.userEmail) return dataObj.userName || dataObj.userEmail;
            if (dataObj.purpose) return dataObj.purpose;
        }
        if (item.targetName) return item.targetName;
        if (item.name) return item.name;
        if (item.title && !item.title.toUpperCase().includes('NOTIF') && !item.title.includes(':')) {
            return item.title;
        }
    }

    // 4. Clean, human default fallback by entityType — NEVER a raw UUID or hash
    switch (entityType) {
        case 'DEPARTMENTS':
            return 'Academic Department';
        case 'USERS':
            return 'University Member';
        case 'COORDINATOR REQUESTS':
            return 'Coordinator Clearance Request';
        case 'DOCUMENT REQUESTS':
            return 'Document Clearance Request';
        case 'DOCUMENTS':
        default:
            return 'Institutional Document';
    }
};

const resolveGroupActorsText = (rawItems) => {
    const actorNames = new Set();
    rawItems.forEach((item) => {
        let name = null;
        if (item.actor) {
            name = `${item.actor.firstName || ''} ${item.actor.lastName || ''}`.trim() || item.actor.name;
        }
        if (!name && item.data) {
            let dataObj = item.data;
            if (typeof dataObj === 'string') {
                try {
                    dataObj = JSON.parse(dataObj);
                } catch {
                    /* ignore */
                }
            }
            name = dataObj?.actorName;
        }
        if (name) actorNames.add(name);
    });

    const list = Array.from(actorNames);
    if (list.length === 0) return null;
    if (list.length === 1) return `by ${list[0]}`;
    if (list.length === 2) return `by ${list[0]} and ${list[1]}`;
    return `by ${list[0]} and ${list.length - 1} others`;
};

// --- COMPONENT ---
const Notifications = ({
    isOpen = false,
    onClose,
    notifications = [],
    unreadCount = 0,
    onMarkAsRead,
    onMarkAllAsRead,
    onSelectRecord,
    className,
    ...props
}) => {
    const navigate = useNavigate();
    const { showToast } = useToast();

    // STATES
    const [activeFilter, setActiveFilter] = useState('all');
    const [visibleLimit, setVisibleLimit] = useState(INITIAL_NOTIFICATION_LIMIT);

    // STORE SUBSCRIPTIONS FOR TARGET RESOLUTION
    const documents = useDocumentStore((state) => state.documents) || [];
    const departments = useDepartmentStore((state) => state.departments) || [];
    const users = useUserStore((state) => state.users) || [];
    const coordinatorRequests = useCoordinatorStore((state) => state.coordinatorRequests) || [];
    const documentRequests = useDocumentStore((state) => state.documentRequests) || [];
    const auditLogs = useAuditStore((state) => state.auditLogs) || [];
    const currentAuthUser = useAuthStore((state) => state.currentUser);

    // 1. FILTER: ONLY GIVE NOTIFICATIONS TO AFFECTED USERS AND NOT YOURSELF (THE ACTOR)
    const validNotifications = useMemo(() => {
        const currentUserId = currentAuthUser?.id;
        return (notifications || []).filter((n) => {
            if (!currentUserId) return true;
            const actorId = n.actorId || n.actor?.id;
            if (actorId && String(actorId).toLowerCase() === String(currentUserId).toLowerCase()) {
                return false; // Do not shout notifications for actions you performed yourself
            }
            if (n.recipientId && String(n.recipientId).toLowerCase() !== String(currentUserId).toLowerCase()) {
                return false; // Not addressed to you
            }
            return true;
        });
    }, [notifications, currentAuthUser?.id]);

    // 2. CONGEST ONLY UNREAD NOTIFICATIONS; ONCE READ, THEY GO BACK TO NORMAL AS IF READ ONE BY ONE
    const displayNotifications = useMemo(() => {
        const stores = {
            documents,
            departments,
            users,
            coordinatorRequests,
            documentRequests,
            auditLogs,
        };

        const unreadItems = validNotifications.filter((n) => !n.isRead);
        const readItems = validNotifications.filter((n) => Boolean(n.isRead));

        // CONGEST UNREAD ITEMS
        const unreadGroupsMap = new Map();
        unreadItems.forEach((notification) => {
            const entityType = normalizeEntityType(notification.entityType);
            const action = normalizeAction(notification.action);
            const targetId = resolveTargetId(notification);
            const groupKey = `unread:${entityType}:${targetId}:${action}`;

            const itemTimestamp = notification.createdAt ? new Date(notification.createdAt).getTime() : 0;

            if (!unreadGroupsMap.has(groupKey)) {
                unreadGroupsMap.set(groupKey, {
                    groupKey,
                    entityType,
                    action,
                    targetId,
                    latestTimestamp: itemTimestamp,
                    items: [notification],
                });
            } else {
                const group = unreadGroupsMap.get(groupKey);
                group.items.push(notification);
                if (itemTimestamp > group.latestTimestamp) {
                    group.latestTimestamp = itemTimestamp;
                }
            }
        });

        const unreadCongestedList = Array.from(unreadGroupsMap.values()).map((group) => {
            const targetName = resolveTargetName(group.entityType, group.targetId, group.items, stores);
            const notificationIds = group.items.map((n) => n.id).filter(Boolean);
            const actorsText = resolveGroupActorsText(group.items);

            return {
                id: group.items[0]?.id || group.groupKey,
                groupKey: group.groupKey,
                entityType: group.entityType,
                action: group.action,
                targetId: group.targetId,
                targetName,
                count: group.items.length,
                latestTimestamp: group.latestTimestamp,
                isRead: false,
                notificationIds,
                actorsText,
                rawItems: group.items,
            };
        });

        // READ ITEMS: INDIVIDUAL AS IF READ ONE BY ONE
        const readIndividualList = readItems.map((notification) => {
            const entityType = normalizeEntityType(notification.entityType);
            const action = normalizeAction(notification.action);
            const targetId = resolveTargetId(notification);
            const targetName = resolveTargetName(entityType, targetId, [notification], stores);
            const itemTimestamp = notification.createdAt ? new Date(notification.createdAt).getTime() : 0;
            const actorsText = resolveGroupActorsText([notification]);

            return {
                id: notification.id,
                groupKey: `read:${notification.id}`,
                entityType,
                action,
                targetId,
                targetName,
                count: 1, // Single notification
                latestTimestamp: itemTimestamp,
                isRead: true,
                notificationIds: [notification.id],
                actorsText,
                rawItems: [notification],
            };
        });

        // Combined: Unread always strictly before read items; within each partition, sorted by timestamp descending
        return [...unreadCongestedList, ...readIndividualList].sort((a, b) => {
            if (!a.isRead && b.isRead) return -1;
            if (a.isRead && !b.isRead) return 1;
            return b.latestTimestamp - a.latestTimestamp;
        });
    }, [validNotifications, documents, departments, users, coordinatorRequests, documentRequests, auditLogs]);

    // 3. COUNTS PER CATEGORY
    const counts = useMemo(() => {
        let departmentsCount = 0;
        let usersCount = 0;
        let documentsCount = 0;
        let coordinatorRequestsCount = 0;
        let documentRequestsCount = 0;

        displayNotifications.forEach((item) => {
            if (item.entityType === 'DEPARTMENTS') departmentsCount += 1;
            else if (item.entityType === 'USERS') usersCount += 1;
            else if (item.entityType === 'DOCUMENTS') documentsCount += 1;
            else if (item.entityType === 'COORDINATOR REQUESTS') coordinatorRequestsCount += 1;
            else if (item.entityType === 'DOCUMENT REQUESTS') documentRequestsCount += 1;
        });

        return {
            all: displayNotifications.length,
            departments: departmentsCount,
            users: usersCount,
            documents: documentsCount,
            coordinatorRequests: coordinatorRequestsCount,
            documentRequests: documentRequestsCount,
        };
    }, [displayNotifications]);

    // 4. 6 FILTER OPTIONS WITH ACCURATE NUMBERS
    const filterOptions = [
        { value: 'all', label: `All (${counts.all})` },
        { value: 'departments', label: `Departments (${counts.departments})` },
        { value: 'users', label: `Users (${counts.users})` },
        { value: 'documents', label: `Documents (${counts.documents})` },
        { value: 'coordinator requests', label: `Coordinator Requests (${counts.coordinatorRequests})` },
        { value: 'document requests', label: `Document Requests (${counts.documentRequests})` },
    ];

    // 5. FILTERED LIST
    const filteredNotifications = useMemo(() => {
        if (activeFilter === 'all') return displayNotifications;
        const targetEntity = activeFilter.toUpperCase();
        return displayNotifications.filter((g) => g.entityType === targetEntity);
    }, [displayNotifications, activeFilter]);

    // 6. PAGINATION QUOTA: SHOW 15 ITEMS AT BEST WITH SHOW MORE BUTTON
    const visibleNotifications = useMemo(() => {
        return filteredNotifications.slice(0, visibleLimit);
    }, [filteredNotifications, visibleLimit]);

    const hasMore = filteredNotifications.length > visibleLimit;
    const remainingCount = filteredNotifications.length - visibleLimit;

    // GUARD CLAUSES
    if (!isOpen) {
        return null;
    }

    // HANDLERS
    const handleFilterChange = (filterKey) => {
        setActiveFilter(filterKey);
        setVisibleLimit(INITIAL_NOTIFICATION_LIMIT);
    };

    const handleMarkAsRead = (notificationIds) => {
        onMarkAsRead?.(notificationIds);
    };

    const handleMarkAllAsRead = () => {
        onMarkAllAsRead?.();
    };

    const handleShowMore = () => {
        setVisibleLimit((prev) => prev + INITIAL_NOTIFICATION_LIMIT);
    };

    const formatEntitySingular = (entityType) => {
        switch (entityType) {
            case 'DEPARTMENTS':
                return 'Department';
            case 'USERS':
                return 'User';
            case 'COORDINATOR REQUESTS':
                return 'Coordinator Request';
            case 'DOCUMENT REQUESTS':
                return 'Document Request';
            case 'DOCUMENTS':
            default:
                return 'Document';
        }
    };

    // ON CLICK ON NOTIFICATION: NAVIGATE TO TARGET AND FOCUS/SELECT RECORD (OR SHOW TOAST IF DELETED)
    const handleItemClick = async (item) => {
        // 1. Mark as read
        if (!item.isRead) {
            handleMarkAsRead(item.notificationIds);
        }

        const entitySingular = formatEntitySingular(item.entityType);

        // 2. If the action is DELETED, simply give a toast and do not navigate
        if (item.action === 'DELETED') {
            showToast({
                title: `${entitySingular} Deleted`,
                description: `The requested ${item.targetName || 'record'} has been deleted and is no longer accessible.`,
                variant: 'neutral',
            });
            return;
        }

        // 3. Check if target entity actually exists in active state before navigating
        const entityType = item.entityType;
        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : String(id || ''));
        const targetClean = cleanId(item.targetId);

        if (entityType === 'DOCUMENTS') {
            let activeDocs = useDocumentStore.getState().documents || [];
            try {
                const refreshed = await useDocumentStore.getState().fetchDocuments();
                if (Array.isArray(refreshed)) {
                    activeDocs = refreshed;
                }
            } catch (e) {}
            const doc = activeDocs.find(
                (d) => cleanId(d.id) === targetClean || cleanId(d.uuid) === targetClean
            );
            if (!doc) {
                showToast({
                    title: `${entitySingular} Deleted`,
                    description: `"${item.targetName || 'This document'}" has been deleted and is no longer accessible.`,
                    variant: 'neutral',
                });
                return;
            }
            onClose?.();
            useDocumentStore.getState().setSelectedDocument?.(doc);
            onSelectRecord?.(doc);

            if (doc.isArchived) {
                navigate('/archives');
            } else {
                navigate('/documents');
            }
        } else if (entityType === 'DEPARTMENTS') {
            let activeDepts = useDepartmentStore.getState().departments || [];
            try {
                const refreshed = await useDepartmentStore.getState().fetchDepartments();
                if (Array.isArray(refreshed)) {
                    activeDepts = refreshed;
                }
            } catch (e) {}
            const dept = activeDepts.find(
                (d) => cleanId(d.id) === targetClean || cleanId(d.uuid) === targetClean
            );
            if (!dept) {
                showToast({
                    title: `${entitySingular} Deleted`,
                    description: `"${item.targetName || 'This department'}" has been deleted and is no longer accessible.`,
                    variant: 'neutral',
                });
                return;
            }
            onClose?.();
            useDepartmentStore.getState().setSelectedDepartment?.(dept);
            onSelectRecord?.(dept);
            navigate('/departments');
        } else if (entityType === 'USERS') {
            let activeUsers = useUserStore.getState().users || [];
            try {
                const refreshed = await useUserStore.getState().fetchUsers();
                if (Array.isArray(refreshed)) {
                    activeUsers = refreshed;
                }
            } catch (e) {}
            const user = activeUsers.find(
                (u) => cleanId(u.id) === targetClean || cleanId(u.uuid) === targetClean
            );
            if (!user) {
                showToast({
                    title: `${entitySingular} Deleted`,
                    description: `"${item.targetName || 'This user'}" has been deleted and is no longer accessible.`,
                    variant: 'neutral',
                });
                return;
            }
            onClose?.();
            useUserStore.getState().setSelectedUser?.(user);
            onSelectRecord?.(user);
            navigate('/users');
        } else if (entityType === 'COORDINATOR REQUESTS') {
            let activeReqs = useCoordinatorStore.getState().coordinatorRequests || [];
            try {
                const refreshed = await useCoordinatorStore.getState().fetchCoordinatorRequests();
                if (Array.isArray(refreshed)) {
                    activeReqs = refreshed;
                }
            } catch (e) {}
            const req = activeReqs.find(
                (r) => cleanId(r.id) === targetClean || cleanId(r.uuid) === targetClean
            );
            if (!req) {
                showToast({
                    title: `${entitySingular} Deleted`,
                    description: `"${item.targetName || 'This coordinator request'}" has been deleted or is no longer accessible.`,
                    variant: 'neutral',
                });
                return;
            }
            onClose?.();
            useCoordinatorStore.getState().setSelectedCoordinatorRequest?.(req);
            onSelectRecord?.(req);
            navigate('/coordinator');
        } else if (entityType === 'DOCUMENT REQUESTS') {
            let activeReqs = useDocumentStore.getState().documentRequests || [];
            try {
                const refreshed = await useDocumentStore.getState().fetchDocumentRequests();
                if (Array.isArray(refreshed)) {
                    activeReqs = refreshed;
                }
            } catch (e) {}
            const req = activeReqs.find(
                (r) => cleanId(r.id) === targetClean || cleanId(r.uuid) === targetClean
            );
            if (!req) {
                showToast({
                    title: `${entitySingular} Deleted`,
                    description: `"${item.targetName || 'This document request'}" has been deleted or is no longer accessible.`,
                    variant: 'neutral',
                });
                return;
            }
            onClose?.();
            useDocumentStore.getState().setSelectedDocumentRequest?.(req);
            onSelectRecord?.(req);
            navigate('/requests');
        }
    };

    // DERIVED VALUES
    const unreadTotalCount = displayNotifications.filter((n) => !n.isRead).length;
    const composedClassName = `${BASE_STYLE} ${className ?? ''}`.trim();

    return (
        <div className={composedClassName} {...props}>
            <Container
                variant="card"
                className="p-2 gap-2 bg-surface border border-surface-border rounded-lg overflow-hidden animate-toast-in shadow-[0_12px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.75)] ring-1 ring-black/5 dark:ring-white/10"
            >
                {/* 1. HEADER BAR WITH INLINE MARK ALL AS READ AT THE END */}
                <div className="flex items-center justify-between px-2.5 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-lg bg-accent/10 text-accent shrink-0">
                            <Bell className="h-4 w-4" />
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="font-bold text-xs sm:text-sm text-text truncate">
                                Notifications
                            </span>
                            {unreadTotalCount > 0 && (
                                <Badge variant="warning" size="xs">
                                    {unreadTotalCount} new
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* MARK ALL AS READ INLINE AT THE END OF THE HEADER */}
                    <button
                        type="button"
                        onClick={handleMarkAllAsRead}
                        disabled={unreadTotalCount === 0}
                        className={`text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors shrink-0 ${
                            unreadTotalCount > 0
                                ? 'text-accent hover:text-accent-hover hover:bg-surface-hover cursor-pointer'
                                : 'text-text-muted/40 cursor-not-allowed'
                        }`}
                        title="Mark all notifications as read"
                    >
                        <CheckCheck className="h-3.5 w-3.5" />
                        <span>Mark all read</span>
                    </button>
                </div>

                {/* 2. ACTUAL SEGMENTED CONTROL IN SCROLLABLE BAR */}
                <div className="overflow-x-auto scrollbar-none pb-1 pt-0.5">
                    <SegmentSelection
                        value={activeFilter}
                        options={filterOptions}
                        onChange={handleFilterChange}
                        className="w-max"
                    />
                </div>

                {/* 3. NOTIFICATIONS LIST BODY */}
                <div className="max-h-96 sm:max-h-[28rem] overflow-y-auto flex flex-col gap-1 p-0.5">
                    {/* EMPTY STATE */}
                    {filteredNotifications.length === 0 && (
                        <div className="p-8 flex flex-col items-center justify-center text-center gap-2 rounded-lg border border-dashed border-surface-border">
                            <div className="p-3 rounded-full bg-surface-hover text-text-muted">
                                <BellOff className="h-6 w-6" />
                            </div>
                            <span className="font-semibold text-sm text-text">
                                No notifications
                            </span>
                            <span className="text-xs text-text-muted max-w-xs leading-relaxed">
                                You&apos;re all caught up! New institutional activity and updates will appear here.
                            </span>
                        </div>
                    )}

                    {/* NOTIFICATION ITEMS */}
                    {visibleNotifications.map((item) => {
                        const Icon = getEntityIcon(item.entityType);
                        const badgeVariant = getActionBadgeVariant(item.action);
                        const timeString = formatRelativeTime(item.latestTimestamp);
                        const title = `${item.entityType} ${item.action}${item.count > 1 ? ` (${item.count})` : ''}`;

                        return (
                            <div
                                key={item.groupKey}
                                onClick={() => handleItemClick(item)}
                                className={`p-2.5 sm:p-3 rounded-lg transition-all cursor-pointer flex items-start justify-between gap-3 group border shadow-2xs ${
                                    !item.isRead
                                        ? 'bg-accent/5 border-accent/40 hover:border-accent hover:bg-accent/10'
                                        : 'bg-surface border-surface-border hover:border-accent/40 hover:bg-surface-hover'
                                }`}
                            >
                                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                    {/* Categorized entity icon container */}
                                    <div className="p-2 rounded-lg bg-accent/10 text-accent group-hover:bg-accent/15 transition-colors shrink-0 mt-0.5">
                                        <Icon className="h-4 w-4" />
                                    </div>

                                    {/* Text content */}
                                    <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-text truncate group-hover:text-accent transition-colors">
                                                {title}
                                            </span>
                                            {!item.isRead && (
                                                <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0 animate-pulse" />
                                            )}
                                        </div>

                                        {/* Real human target name */}
                                        {item.targetName && (
                                            <p className="text-[11px] font-medium text-text-muted line-clamp-1 leading-snug truncate">
                                                Target: <span className="text-text font-semibold">{item.targetName}</span>
                                            </p>
                                        )}

                                        <div className="flex items-center gap-1.5 text-[10px] text-text-muted/90 mt-0.5">
                                            <span>{timeString}</span>
                                            {item.actorsText && (
                                                <>
                                                    <span>•</span>
                                                    <span className="truncate">{item.actorsText}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right action badge & quick mark-as-read button */}
                                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                                    <Badge
                                        variant={badgeVariant}
                                        label={item.action}
                                        className="text-[10px] uppercase font-semibold"
                                    />

                                    {!item.isRead && (
                                        <button
                                            type="button"
                                            title="Mark as read"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleMarkAsRead(item.notificationIds);
                                            }}
                                            className="p-1 rounded-lg text-text-muted hover:text-accent hover:bg-surface transition-colors cursor-pointer"
                                        >
                                            <Check className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* 4. SHOW MORE BUTTON (DISPLAYED WHEN MORE THAN 15 ITEMS EXIST) */}
                    {hasMore && (
                        <div className="p-1.5 pt-2">
                            <button
                                type="button"
                                onClick={handleShowMore}
                                className="w-full py-2.5 px-3 text-xs font-semibold text-accent hover:text-text hover:bg-surface-hover bg-surface-hover/40 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-surface-border/60 hover:border-surface-border shadow-2xs"
                            >
                                <span>Show more ({remainingCount} remaining)</span>
                                <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}
                </div>
            </Container>
        </div>
    );
};

// --- EXPORTS ---
export { Notifications };
export default Notifications;
