// --- IMPORTS ---
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FileText,
    Clock,
    Building2,
    Sparkles,
    Activity,
    CheckCircle2,
    Inbox,
    Eye,
    TrendingUp,
    BarChart3,
    ChevronLeft,
    ChevronRight,
    Filter,
    Folder,
    FolderTree,
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
    Copy,
    FileCheck,
} from 'lucide-react';
import {
    Avatar,
    Badge,
    Button,
    ComboField,
    Container,
    Modal,
    ReadershipChart,
    SearchField,
    SelectField,
    compute7DaySlots,
    computeAllTimeSlots,
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
import {
    constants,
    isStaffRole,
    isOfficerRole,
    isDirectorRole,
    isMemberRole,
} from '../constants';


// --- CONFIGURATIONS ---
const DEFAULT_AUDIT_PAGE_SIZE = 15;

const AUDIT_SORT_OPTIONS = [
    { value: 'date-desc', label: 'Recently Added' },
    { value: 'date-asc', label: 'Oldest Added' },
    { value: 'name-asc', label: 'Actor Name (A-Z)' },
    { value: 'name-desc', label: 'Actor Name (Z-A)' },
];

const ROLE_BADGE_STYLES = {
    ADMINISTRATOR: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
    COORDINATOR: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
    DIRECTOR: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    OFFICER: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    MEMBER: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
};

const ACTION_VERB_STYLES = {
    CREATED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    READ: 'bg-accent-background text-accent border-accent-border',
    UPDATED: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',
    DELETED: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
};

const toCanonicalAction = (rawAction = '') => {
    const act = String(rawAction || '').toUpperCase().trim();
    if (['UPLOAD', 'UPLOADED', 'CREATE', 'CREATED', 'ADD', 'ADDED', 'REGISTER', 'REGISTERED'].includes(act)) {
        return 'CREATED';
    }
    if (['READ', 'VIEW', 'VIEWED', 'ACCESS', 'ACCESSED', 'DOWNLOAD', 'DOWNLOADED'].includes(act)) {
        return 'READ';
    }
    if (['DELETE', 'DELETED', 'REMOVE', 'REMOVED', 'REVOKE', 'REVOKED', 'REJECT', 'REJECTED', 'PURGE', 'PURGED'].includes(act)) {
        return 'DELETED';
    }
    return 'UPDATED';
};

const toCanonicalEntity = (rawEntity = '') => {
    const ent = String(rawEntity || '').toUpperCase().trim();
    if (ent.includes('DOCUMENT_REQUEST')) {
        return {
            key: 'DOCUMENT_REQUEST',
            label: 'Document Request',
            style: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
        };
    }
    if (ent.includes('COORDINATOR')) {
        return {
            key: 'COORDINATOR_REQUEST',
            label: 'Coordinator Request',
            style: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
        };
    }
    if (ent.includes('DEPARTMENT')) {
        return {
            key: 'DEPARTMENTS',
            label: 'Department',
            style: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
        };
    }
    if (ent.includes('USER')) {
        return {
            key: 'USERS',
            label: 'User',
            style: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
        };
    }
    return {
        key: 'DOCUMENTS',
        label: 'Document',
        style: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    };
};

const CLASSIFICATION_STYLES = {
    PUBLIC: 'bg-accent-background text-accent border-accent-border',
    CONFIDENTIAL: 'bg-warning-background text-warning border-warning-border',
    RESTRICTED: 'bg-error-background text-error border-error-border',
    PRIVATE: 'bg-information-background text-information border-information-border',
    UNCLASSIFIED: 'bg-surface-hover text-text-muted border-surface-border',
};

const CLASSIFICATION_LABELS = {
    PUBLIC: 'Public',
    RESTRICTED: 'Restricted',
    CONFIDENTIAL: 'Confidential',
    PRIVATE: 'Private',
    UNCLASSIFIED: 'Unclassified',
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

const toCrudVerb = (canonicalAction = '') => {
    const act = String(canonicalAction || '').toUpperCase().trim();
    if (act.includes('CREATE') || act.includes('UPLOAD') || act.includes('ADD') || act.includes('REGISTER')) return 'CREATE';
    if (act.includes('READ') || act.includes('VIEW') || act.includes('ACCESS') || act.includes('DOWNLOAD')) return 'READ';
    if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('MODIFY')) return 'UPDATE';
    if (act.includes('DELETE') || act.includes('REMOVE') || act.includes('REVOKE') || act.includes('PURGE')) return 'DELETE';
    return act || 'READ';
};

const isRmoUser = (user, safeDepts = []) => {
    if (!user) return false;
    if (isStaffRole(user.role)) return true;

    const deptId = user.departmentId || user.department?.id;
    if (deptId && Array.isArray(safeDepts)) {
        const d = safeDepts.find((item) => String(item.id) === String(deptId));
        if (d) {
            const name = String(d.name || '').toLowerCase();
            const code = String(d.code || '').toLowerCase();
            if (name.includes('records management') || code === 'rmo') return true;
        }
    }

    const deptName = String(user.department || user.departmentName || '').toLowerCase();
    if (deptName.includes('records management') || deptName === 'rmo') return true;

    return false;
};

const resolveTargetEntityName = (auditLog, { documents = [], departments = [], users = [], requests = [], coordinatorRequests = [] } = {}) => {
    if (!auditLog) return '—';
    const parsed = auditLog.parsedData || {};
    const ent = String(auditLog.entityType || '').toUpperCase();
    const id = auditLog.entityId;

    // 1. Direct explicit name fields in payload
    if (parsed.name && typeof parsed.name === 'string' && parsed.name.trim()) return parsed.name.trim();
    if (parsed.title && typeof parsed.title === 'string' && parsed.title.trim()) return parsed.title.trim();
    if (parsed.subject && typeof parsed.subject === 'string' && parsed.subject.trim()) return parsed.subject.trim();
    if (parsed.documentName && typeof parsed.documentName === 'string' && parsed.documentName.trim()) return parsed.documentName.trim();
    if (parsed.userName && typeof parsed.userName === 'string' && parsed.userName.trim()) return parsed.userName.trim();
    if (parsed.departmentName && typeof parsed.departmentName === 'string' && parsed.departmentName.trim()) return parsed.departmentName.trim();

    // 2. Nested new/old changes
    if (parsed.new && typeof parsed.new === 'object') {
        const n = parsed.new.name || parsed.new.title || parsed.new.subject || parsed.new.code;
        if (n && typeof n === 'string' && n.trim()) return n.trim();
    }
    if (parsed.old && typeof parsed.old === 'object') {
        const o = parsed.old.name || parsed.old.title || parsed.old.subject || parsed.old.code;
        if (o && typeof o === 'string' && o.trim()) return o.trim();
    }

    // 3. Search store based on entityType
    if (id) {
        if (ent.includes('DOCUMENT_REQUEST')) {
            const match = requests.find((r) => r.id === id);
            if (match?.subject) return match.subject;
        } else if (ent.includes('COORDINATOR')) {
            const match = coordinatorRequests.find((c) => c.id === id);
            if (match?.subject) return match.subject;
            if (match?.action) return match.action.replace(/_/g, ' ');
        } else if (ent.includes('DEPARTMENT')) {
            const match = departments.find((d) => d.id === id);
            if (match?.name) return match.name;
            if (match?.code) return match.code;
        } else if (ent.includes('USER')) {
            const match = users.find((u) => u.id === id);
            if (match) {
                const fullName = `${match.firstName ?? ''} ${match.lastName ?? ''}`.trim();
                if (fullName) return fullName;
                if (match.name) return match.name;
                if (match.email) return match.email;
            }
        } else if (ent.includes('DOCUMENT')) {
            const match = documents.find((d) => d.id === id);
            if (match?.name) return match.name;
            if (match?.title) return match.title;
        }

        // 3b. Fallback cross-store entity matching for UUIDs
        const cleanId = (raw) => (typeof raw === 'string' ? raw.replace(/-/g, '').toLowerCase() : raw);
        const idClean = cleanId(id);
        const docMatch = documents.find((d) => cleanId(d.id) === idClean);
        if (docMatch?.name || docMatch?.title) return docMatch.name || docMatch.title;
        const deptMatch = departments.find((d) => cleanId(d.id) === idClean);
        if (deptMatch?.name) return deptMatch.name;
        const userMatch = users.find((u) => cleanId(u.id) === idClean);
        if (userMatch) {
            const fullName = `${userMatch.firstName ?? ''} ${userMatch.lastName ?? ''}`.trim();
            if (fullName) return fullName;
        }
    }

    // 4. Clean human title from auditLog if available
    if (auditLog.title && !auditLog.title.includes(' on ')) {
        const cleaned = auditLog.title.replace(/^"/, '').replace(/"$/, '').trim();
        if (cleaned) return cleaned;
    }

    return auditLog.entityBadge?.label || 'Institutional Record';
};

const IGNORED_AUDIT_DIFF_KEYS = new Set([
    'actorId',
    'actorRole',
    'actorEmail',
    'actorName',
    'actorDepartment',
    'actorDepartmentId',
    'actor',
    'id',
    'uuid',
    'updatedAt',
    'createdAt',
    'timestamp',
    'targetRoles',
    'targetUserIds',
    'isMajor',
    'excludeActor',
]);

const formatAuditValue = (val, key = '', lookupContext = {}) => {
    if (val === undefined || val === null || val === '') return '—';
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (typeof val === 'object') {
        if (val.name || val.title) return val.name || val.title;
        if (val.firstName || val.lastName) {
            return `${val.firstName || ''} ${val.lastName || ''}`.trim() + (val.role ? ` (${val.role})` : '');
        }
        return JSON.stringify(val);
    }

    const valStr = String(val).trim();
    const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
    const valClean = cleanId(valStr);

    const { documents = [], departments = [], users = [] } = lookupContext;
    const lowerKey = String(key || '').toLowerCase();

    // 1. Department match
    if (lowerKey.includes('dept') || lowerKey.includes('department')) {
        const foundDept = departments.find(
            (d) => cleanId(d.id) === valClean || d.code?.toLowerCase() === valStr.toLowerCase() || d.name?.toLowerCase() === valStr.toLowerCase()
        );
        if (foundDept) return `${foundDept.name}${foundDept.code ? ` (${foundDept.code})` : ''}`;
    }

    // 2. Document match
    if (lowerKey.includes('doc') || lowerKey.includes('document') || lowerKey.includes('file')) {
        const foundDoc = documents.find((d) => cleanId(d.id) === valClean);
        if (foundDoc) return foundDoc.name || foundDoc.title || 'Institutional Record';
    }

    // 3. User / Actor / Reviewer / Rejecter match
    if (
        lowerKey.includes('user') ||
        lowerKey.includes('actor') ||
        lowerKey.includes('reviewer') ||
        lowerKey.includes('rejecter') ||
        lowerKey.includes('recipient') ||
        lowerKey.includes('uploader') ||
        lowerKey.includes('creator') ||
        lowerKey.includes('requester')
    ) {
        const foundUser = users.find((u) => cleanId(u.id) === valClean || u.universityId === valStr);
        if (foundUser) {
            const name = `${foundUser.firstName || ''} ${foundUser.lastName || ''}`.trim() || foundUser.email;
            return name + (foundUser.role ? ` (${foundUser.role})` : '');
        }
    }

    // 4. General UUID matching fallback
    const isUuidLike = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(valStr);
    if (isUuidLike) {
        const foundDept = departments.find((d) => cleanId(d.id) === valClean);
        if (foundDept) return `${foundDept.name}${foundDept.code ? ` (${foundDept.code})` : ''}`;

        const foundDoc = documents.find((d) => cleanId(d.id) === valClean);
        if (foundDoc) return foundDoc.name || foundDoc.title || 'Institutional Record';

        const foundUser = users.find((u) => cleanId(u.id) === valClean);
        if (foundUser) {
            const name = `${foundUser.firstName || ''} ${foundUser.lastName || ''}`.trim() || foundUser.email;
            return name + (foundUser.role ? ` (${foundUser.role})` : '');
        }
    }

    return valStr;
};

const formatKeyLabel = (key) => {
    if (!key) return '';
    let clean = String(key).replace(/^_+/, '');
    if (clean.toLowerCase().endsWith('id') && clean.length > 2) {
        clean = clean.slice(0, -2);
    }
    return clean
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase());
};

const extractAuditDiff = (parsedData) => {
    if (!parsedData || typeof parsedData !== 'object') {
        return { diffs: [], staticFields: [] };
    }

    const oldObj = (parsedData.old || parsedData.previous || parsedData.before) ?? null;
    const newObj = (parsedData.new || parsedData.current || parsedData.after) ?? null;

    const diffs = [];

    // 1. Explicit old / new pair
    if (oldObj && typeof oldObj === 'object' && newObj && typeof newObj === 'object') {
        const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
        for (const k of allKeys) {
            if (IGNORED_AUDIT_DIFF_KEYS.has(k)) continue;
            const oldVal = oldObj[k];
            const newVal = newObj[k];

            const oldStr = typeof oldVal === 'object' && oldVal !== null ? JSON.stringify(oldVal) : String(oldVal ?? '');
            const newStr = typeof newVal === 'object' && newVal !== null ? JSON.stringify(newVal) : String(newVal ?? '');

            // Only include affected / modified properties
            if (oldStr !== newStr) {
                diffs.push({
                    key: k,
                    oldValue: oldVal,
                    newValue: newVal,
                });
            }
        }
    }

    // 2. Paired keys (e.g. previousStatus / newStatus, oldRole / newRole)
    if (diffs.length === 0) {
        const entries = Object.entries(parsedData);
        for (const [k, val] of entries) {
            if (IGNORED_AUDIT_DIFF_KEYS.has(k)) continue;
            if (k.startsWith('new') || k.startsWith('after') || k.startsWith('current')) {
                const baseKey = k.replace(/^(new|after|current)_?/, '');
                const oldCandidates = [
                    `old${baseKey.charAt(0).toUpperCase()}${baseKey.slice(1)}`,
                    `previous${baseKey.charAt(0).toUpperCase()}${baseKey.slice(1)}`,
                    `before${baseKey.charAt(0).toUpperCase()}${baseKey.slice(1)}`,
                    `old_${baseKey.toLowerCase()}`,
                    `previous_${baseKey.toLowerCase()}`,
                ];
                const matchedOldKey = oldCandidates.find((cand) => parsedData[cand] !== undefined);
                if (matchedOldKey) {
                    diffs.push({
                        key: baseKey || k,
                        oldValue: parsedData[matchedOldKey],
                        newValue: val,
                    });
                }
            }
        }
    }

    // 3. Static/supplementary attributes (excluding old/new envelopes and diffed keys)
    const staticFields = Object.entries(parsedData).filter(([k]) => {
        if (IGNORED_AUDIT_DIFF_KEYS.has(k)) return false;
        if (['old', 'new', 'before', 'after', 'previous', 'current'].includes(k)) return false;
        if (diffs.some((d) => d.key === k)) return false;
        return true;
    });

    return { diffs, staticFields };
};


// --- HOOK: MEASURE CONTAINER WIDTH & RESOLVE RESPONSIVE TIER ---
const useContainerTier = ({ full = 800, half = 600, quarter = 440 } = {}) => {
    const ref = useRef(null);
    const [tier, setTier] = useState('full');
    const [width, setWidth] = useState(null);

    useEffect(() => {
        if (!ref.current) return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.contentRect) {
                    const w = entry.contentRect.width;
                    setWidth(w);
                    if (w < quarter) {
                        setTier('mobile');
                    } else if (w < half) {
                        setTier('quarter');
                    } else if (w < full) {
                        setTier('half');
                    } else {
                        setTier('full');
                    }
                }
            }
        });
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, [full, half, quarter]);

    return [ref, tier, width];
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
    const documentVersions = useDocumentStore((state) => state.documentVersions ?? state.versions ?? []);

    const fetchDocuments = useDocumentStore((state) => state.fetchDocuments);
    const fetchAllDocumentVersions = useDocumentStore((state) => state.fetchAllDocumentVersions);
    const fetchDocumentRequests = useDocumentStore((state) => state.fetchDocumentRequests);
    const fetchDepartments = useDepartmentStore((state) => state.fetchDepartments);
    const fetchUsers = useUserStore((state) => state.fetchUsers);
    const fetchCoordinatorRequests = useCoordinatorStore((state) => state.fetchCoordinatorRequests);
    const fetchAuditLogs = useAuditStore((state) => state.fetchAuditLogs);
    const syncAllDocumentShares = useDocumentStore((state) => state.syncAllDocumentShares);

    // NAVIGATION
    const navigate = useNavigate();

    // LOCAL STATE FOR LIVE AUDIT TRAIL & ANALYTICS VIEW
    const [auditFilters, setAuditFilters] = useState([]);
    const [auditSearch, setAuditSearch] = useState('');
    const [auditSort, setAuditSort] = useState('date-desc');
    const [auditPage, setAuditPage] = useState(1);
    const [auditPageSize, setAuditPageSize] = useState(DEFAULT_AUDIT_PAGE_SIZE);
    const [viewingAuditLog, setViewingAuditLog] = useState(null);
    const [showRawJson, setShowRawJson] = useState(false);
    const [hasCopiedJson, setHasCopiedJson] = useState(false);
    const [analyticsSortBy, setAnalyticsSortBy] = useState('READS'); // 'READS' | 'RECENT'
    const [analysisSearch, setAnalysisSearch] = useState('');
    const [pendingRequestType, setPendingRequestType] = useState('DOCUMENT'); // 'DOCUMENT' | 'COORDINATOR'
    const [pendingSearch, setPendingSearch] = useState('');
    const [specializedSearch, setSpecializedSearch] = useState('');

    // RESPONSIVE CONTAINER TIERS FOR CARDS (CONTAINER-QUERY BEHAVIOR LIKE BROWSER)
    const [bannerRef, bannerTier] = useContainerTier({ full: 960, half: 520, quarter: 520 });
    const [pendingCardRef, pendingTier] = useContainerTier({ full: 620, half: 480, quarter: 360 });
    const [analysisCardRef, analysisTier] = useContainerTier({ full: 620, half: 480, quarter: 360 });
    const [auditCardRef, auditTier, auditWidth] = useContainerTier({ full: 1040, half: 720, quarter: 500 });
    const [specializedCardRef, specializedTier] = useContainerTier({ full: 620, half: 480, quarter: 360 });

    // DERIVED VALUES
    const { currentUser: authUser } = useAuth();
    const storeUser = useAuthStore((state) => state.currentUser);
    const activeUser = currentUser ?? authUser ?? storeUser ?? useAuthStore.getState().currentUser;
    const isStaff = isStaffRole(activeUser?.role);
    const isAdmin = constants.isAdminRole(activeUser?.role);
    const isOfficer = isOfficerRole(activeUser?.role);
    const isDirector = isDirectorRole(activeUser?.role);
    const isMember = isMemberRole(activeUser?.role);
    const isSpecializedRole = isOfficer || isDirector || isMember;
    const activeUserId = activeUser?.id;
    const userDeptId = activeUser?.departmentId || activeUser?.department?.id;
    const greeting = useMemo(() => getTimeOfDayGreeting(), []);

    // FETCH DATA (ONLY FETCH UNINITIALIZED STORES TO PREVENT NETWORK THRASHING & LAG)
    useEffect(() => {
        if (!documents || documents.length === 0) fetchDocuments().catch(() => {});
        if (!documentVersions || documentVersions.length === 0) fetchAllDocumentVersions().catch(() => {});
        if (!requests || requests.length === 0) fetchDocumentRequests().catch(() => {});
        if (!departments || departments.length === 0) fetchDepartments().catch(() => {});
        if (!users || users.length === 0) fetchUsers().catch(() => {});
        if (!coordinatorRequests || coordinatorRequests.length === 0) fetchCoordinatorRequests().catch(() => {});
        if (!auditLogs || auditLogs.length === 0) fetchAuditLogs().catch(() => {});
        if (activeUser && typeof syncAllDocumentShares === 'function') {
            syncAllDocumentShares(activeUser, departments).catch(() => {});
        }
    }, [
        fetchDocuments,
        fetchAllDocumentVersions,
        fetchDocumentRequests,
        fetchDepartments,
        fetchUsers,
        fetchCoordinatorRequests,
        fetchAuditLogs,
        activeUser,
        departments,
        syncAllDocumentShares,
    ]);

    // DEPARTMENT FACULTY COUNT
    const departmentFacultyCount = useMemo(() => {
        if (!userDeptId) return 0;
        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
        const cleanUserDept = cleanId(userDeptId);
        const safeUsers = Array.isArray(users) ? users : [];
        return safeUsers.filter((u) => {
            const uDept = u.departmentId || u.department?.id;
            return uDept && cleanId(uDept) === cleanUserDept;
        }).length;
    }, [users, userDeptId]);

    // DEPARTMENTAL SHARED DOCUMENTS RESOLVER (FOR OFFICER, DIRECTOR, MEMBER)
    const {
        departmentSharedDocs,
        officerPendingDocs,
        directorPendingDocs,
        memberPublishedDocs,
    } = useMemo(() => {
        if (isStaff || !userDeptId) {
            return {
                departmentSharedDocs: [],
                officerPendingDocs: [],
                directorPendingDocs: [],
                memberPublishedDocs: [],
            };
        }

        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
        const userDeptClean = cleanId(userDeptId);
        const safeDocs = Array.isArray(documents) ? documents.filter((d) => !d?.isArchived && !d?.isFolder) : [];
        const allDocs = Array.isArray(documents) ? documents : [];
        const safeShares = Array.isArray(documentShares) ? documentShares : [];
        const safeVersions = Array.isArray(documentVersions) ? documentVersions : [];

        const sharedList = [];
        const pendingApprovalList = [];
        const approvedPendingPubList = [];
        const publishedList = [];

        safeDocs.forEach((doc) => {
            const docClean = cleanId(doc.id);

            // Direct departmental shares
            const directShares = safeShares.filter((s) => {
                const sDocId = s.document?.id ?? s.documentId;
                const sDeptId = s.department?.id ?? s.departmentId;
                const status = String(s.status || '').toUpperCase();
                if (['REVOKED', 'DELETED', 'UNSHARED'].includes(status)) return false;
                return cleanId(sDocId) === docClean && cleanId(sDeptId) === userDeptClean;
            });

            let effectiveShares = [...directShares];
            let isInherited = false;
            let parentFolderName = null;

            if (effectiveShares.length === 0) {
                let currParentId = doc.parentId ?? doc.parent?.id ?? doc.parentFolderId;
                while (currParentId && currParentId !== 'root') {
                    const parentDoc = allDocs.find((d) => cleanId(d.id) === cleanId(currParentId));
                    if (!parentDoc) break;
                    const parentDeptShares = safeShares.filter((s) => {
                        const sDocId = s.document?.id ?? s.documentId;
                        const sDeptId = s.department?.id ?? s.departmentId;
                        const status = String(s.status || '').toUpperCase();
                        if (['REVOKED', 'DELETED', 'UNSHARED'].includes(status)) return false;
                        return cleanId(sDocId) === cleanId(parentDoc.id) && cleanId(sDeptId) === userDeptClean;
                    });
                    if (parentDeptShares.length > 0) {
                        effectiveShares = parentDeptShares;
                        isInherited = true;
                        parentFolderName = parentDoc.name || parentDoc.title || 'Institutional Folder';
                        break;
                    }
                    currParentId = parentDoc.parentId ?? parentDoc.parent?.id ?? parentDoc.parentFolderId;
                }
            }

            if (effectiveShares.length === 0) {
                return;
            }

            // Status resolution priority: PUBLISHED > STASHED > APPROVED > PENDING_APPROVAL
            let resolvedStatus = constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL;
            if (effectiveShares.some((s) => s.status === constants.DOCUMENT_SHARES_STATUS.PUBLISHED)) {
                resolvedStatus = constants.DOCUMENT_SHARES_STATUS.PUBLISHED;
            } else if (effectiveShares.some((s) => s.status === constants.DOCUMENT_SHARES_STATUS.STASHED)) {
                resolvedStatus = constants.DOCUMENT_SHARES_STATUS.STASHED;
            } else if (effectiveShares.some((s) => s.status === constants.DOCUMENT_SHARES_STATUS.APPROVED)) {
                resolvedStatus = constants.DOCUMENT_SHARES_STATUS.APPROVED;
            } else if (effectiveShares.some((s) => s.status === constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL)) {
                resolvedStatus = constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL;
            } else {
                resolvedStatus = effectiveShares[0]?.status || constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL;
            }

            const primaryShare = effectiveShares.find((s) => s.status === resolvedStatus) || effectiveShares[0];

            // Resolve latest version & classification
            const docVers = safeVersions.filter((v) => cleanId(v.document?.id ?? v.documentId) === docClean);
            const latestVer = docVers.length > 0
                ? [...docVers].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0]
                : (Array.isArray(doc.versions) && doc.versions.length > 0 ? doc.versions[0] : (doc.latestVersion ?? null));
            const rawClassification = String(
                latestVer?.classification || doc.classification || constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED
            ).toUpperCase();
            const classification = CLASSIFICATION_STYLES[rawClassification] ? rawClassification : 'UNCLASSIFIED';
            const classificationLabel = CLASSIFICATION_LABELS[classification] || 'Unclassified';

            // Resolve sharer name
            const sharerUser = primaryShare?.sharer;
            const sharerName = sharerUser
                ? `${sharerUser.firstName ?? ''} ${sharerUser.lastName ?? ''}`.trim() || sharerUser.name
                : 'Central Records Office';

            // Format date
            const shareDateRaw = primaryShare?.updatedAt || primaryShare?.createdAt || doc.updatedAt || doc.createdAt;
            const shareDateObj = shareDateRaw ? new Date(shareDateRaw) : null;
            const formattedDate = shareDateObj && !isNaN(shareDateObj.getTime())
                ? (shareDateObj.toDateString() === new Date().toDateString()
                    ? shareDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : shareDateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }))
                : 'Recent';

            const itemPayload = {
                id: doc.id,
                title: doc.name || doc.title || 'Institutional Record',
                extension: doc.name ? doc.name.split('.').pop() : 'pdf',
                parentFolderName,
                isInherited,
                status: resolvedStatus,
                primaryShare,
                effectiveShares,
                sharerName,
                timestamp: formattedDate,
                rawDate: shareDateObj ? shareDateObj.getTime() : 0,
                classification,
                classificationLabel,
                documentItem: {
                    ...doc,
                    classification,
                    latestVersion: latestVer,
                    versions: docVers,
                },
            };

            sharedList.push(itemPayload);

            if (resolvedStatus === constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL) {
                pendingApprovalList.push(itemPayload);
            }
            if (resolvedStatus === constants.DOCUMENT_SHARES_STATUS.APPROVED) {
                approvedPendingPubList.push(itemPayload);
            }
            if (resolvedStatus === constants.DOCUMENT_SHARES_STATUS.PUBLISHED) {
                if (isMember) {
                    const memberSpecificShares = effectiveShares.filter((s) => s.recipient?.id ?? s.recipientId);
                    if (memberSpecificShares.length > 0) {
                        const userShare = memberSpecificShares.find(
                            (s) => cleanId(s.recipient?.id ?? s.recipientId) === cleanId(activeUser?.id)
                        );
                        if (userShare && userShare.status === constants.DOCUMENT_SHARES_STATUS.PUBLISHED) {
                            publishedList.push(itemPayload);
                        }
                    } else {
                        publishedList.push(itemPayload);
                    }
                } else {
                    publishedList.push(itemPayload);
                }
            }
        });

        // Sort descending by date
        sharedList.sort((a, b) => b.rawDate - a.rawDate);
        pendingApprovalList.sort((a, b) => b.rawDate - a.rawDate);
        approvedPendingPubList.sort((a, b) => b.rawDate - a.rawDate);
        publishedList.sort((a, b) => b.rawDate - a.rawDate);

        return {
            departmentSharedDocs: sharedList,
            officerPendingDocs: pendingApprovalList,
            directorPendingDocs: approvedPendingPubList,
            memberPublishedDocs: publishedList,
        };
    }, [documents, documentShares, documentVersions, isStaff, isMember, userDeptId, activeUser?.id]);

    const activeSpecializedList = useMemo(() => {
        let sourceList = [];
        if (isOfficer) sourceList = officerPendingDocs;
        else if (isDirector) sourceList = directorPendingDocs;
        else sourceList = memberPublishedDocs;

        const query = specializedSearch.trim().toLowerCase();
        if (!query) return sourceList;

        return sourceList.filter((item) => {
            return (
                (item.title || '').toLowerCase().includes(query) ||
                (item.parentFolderName || '').toLowerCase().includes(query) ||
                (item.sharerName || '').toLowerCase().includes(query) ||
                (item.classificationLabel || '').toLowerCase().includes(query) ||
                (item.extension || '').toLowerCase().includes(query)
            );
        });
    }, [isOfficer, isDirector, officerPendingDocs, directorPendingDocs, memberPublishedDocs, specializedSearch]);

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
            if (!['READ', 'VIEW', 'VIEWED', 'DOWNLOAD', 'DOWNLOADED', 'ACCESS', 'ACCESSED'].includes(act)) return;

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

            // Filter docLogs to ONLY non-Records Management Office faculty reads
            const nonRmoLogs = docLogs.filter((log) => {
                const actorId = log?.actor?.id || log?.actorId;
                let actorUser = safeUsers.find((u) => String(u.id) === String(actorId)) || log?.actor;
                if (!actorUser && typeof log?.data === 'string') {
                    try {
                        const parsed = JSON.parse(log.data);
                        actorUser = { id: actorId, role: parsed.role, departmentId: parsed.departmentId };
                    } catch {}
                }
                return !isRmoUser(actorUser, safeDepts);
            });

            // Count readership once per user only ("only 1 of this should work, count readership up once per user only")
            const userFirstReadMap = new Map();
            nonRmoLogs.forEach((log) => {
                const actorId = String(log?.actor?.id || log?.actorId || '');
                if (!actorId) return;
                const logTime = log.createdAt ? new Date(log.createdAt).getTime() : 0;
                if (!userFirstReadMap.has(actorId)) {
                    userFirstReadMap.set(actorId, log);
                } else {
                    const existingLog = userFirstReadMap.get(actorId);
                    const existingTime = existingLog.createdAt ? new Date(existingLog.createdAt).getTime() : 0;
                    if (logTime < existingTime) {
                        userFirstReadMap.set(actorId, log);
                    }
                }
            });

            const uniqueUserReadLogs = Array.from(userFirstReadMap.values());
            uniqueUserReadLogs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

            const totalReads = uniqueUserReadLogs.length;
            const totalUniqueReaders = totalReads;

            const now = new Date();
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const weekUniqueUserLogs = uniqueUserReadLogs.filter(
                (l) => l.createdAt && new Date(l.createdAt) >= sevenDaysAgo
            );
            const weekReads = weekUniqueUserLogs.length;
            const weekUniqueReaders = weekReads;

            const slots = compute7DaySlots(uniqueUserReadLogs);
            const allTimeSlots = computeAllTimeSlots(uniqueUserReadLogs);

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
            uniqueUserReadLogs.forEach((l) => {
                const actorUser = safeUsers.find((u) => String(u.id) === String(l?.actor?.id ?? l?.actorId));
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

            const lastLog = uniqueUserReadLogs[0];
            const lastReadAt = lastLog?.createdAt ? new Date(lastLog.createdAt) : null;

            const versionsForDoc = (documentVersions || []).filter(
                (v) => cleanId(v.document?.id ?? v.documentId) === cleanId(doc.id)
            );
            const latestVer = versionsForDoc.length > 0
                ? [...versionsForDoc].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0]
                : (Array.isArray(doc.versions) && doc.versions.length > 0
                    ? doc.versions[0]
                    : (doc.latestVersion ?? null));
            const rawClassification = String(
                latestVer?.classification || doc.classification || constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED
            ).toUpperCase();
            const classification = CLASSIFICATION_STYLES[rawClassification] ? rawClassification : 'UNCLASSIFIED';
            const classificationLabel = CLASSIFICATION_LABELS[classification] || 'Unclassified';

            const deptObj = safeDepts.find((d) => d.id === doc.departmentId);
            const departmentName = deptObj?.name || null;

            return {
                id: doc.id,
                title: doc.name || doc.title || 'Institutional Record',
                extension: doc.name ? doc.name.split('.').pop() : 'pdf',
                parentFolderName,
                departmentId: doc.departmentId,
                departmentName,
                classification,
                classificationLabel,
                weekReads,
                totalReads,
                weekUniqueReaders,
                totalUniqueReaders,
                slots,
                allTimeSlots,
                topDeptName,
                lastReadAt,
                documentItem: {
                    ...doc,
                    classification,
                    latestVersion: latestVer,
                    versions: versionsForDoc,
                },
            };
        });

        // Filter by analysisSearch query
        const q = analysisSearch.trim().toLowerCase();
        const searchFiltered = q
            ? analyticsList.filter((item) =>
                  item.title.toLowerCase().includes(q) ||
                  (item.departmentName && item.departmentName.toLowerCase().includes(q)) ||
                  (item.parentFolderName && item.parentFolderName.toLowerCase().includes(q)) ||
                  item.classificationLabel.toLowerCase().includes(q)
              )
            : analyticsList;

        if (analyticsSortBy === 'READS') {
            searchFiltered.sort((a, b) => b.weekReads - a.weekReads || b.totalReads - a.totalReads || b.weekUniqueReaders - a.weekUniqueReaders);
        } else {
            searchFiltered.sort((a, b) => {
                const timeA = a.lastReadAt ? a.lastReadAt.getTime() : 0;
                const timeB = b.lastReadAt ? b.lastReadAt.getTime() : 0;
                return timeB - timeA || b.weekReads - a.weekReads;
            });
        }

        return searchFiltered.slice(0, 8);
    }, [documents, documentVersions, documentShares, auditLogs, users, departments, analyticsSortBy, analysisSearch]);

    // PENDING ACTION ITEMS (SEGMENTED: DOCUMENT vs COORDINATOR)
    const { pendingActionItems, pendingDocCount, pendingCoordCount } = useMemo(() => {
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
                const formattedTime = dateObj && !isNaN(dateObj.getTime())
                    ? (dateObj.toDateString() === new Date().toDateString()
                        ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }))
                    : 'Open';

                return {
                    id: item?.id,
                    name: requesterName,
                    subject: item?.subject || 'Document Request',
                    requesterUser,
                    badge: 'Document Request',
                    badgeStyle: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
                    time: formattedTime,
                    createdAt: item?.createdAt,
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

                const parsedData = parseLogData(item?.data);
                const actionName = item?.action ? item.action.replace(/_/g, ' ') : 'Coordinator Request';
                const subject = parsedData?.title || parsedData?.name || actionName;

                const dateObj = item?.createdAt ? new Date(item.createdAt) : null;
                const formattedTime = dateObj && !isNaN(dateObj.getTime())
                    ? (dateObj.toDateString() === new Date().toDateString()
                        ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }))
                    : 'Pending';

                return {
                    id: item?.id,
                    name: requesterName,
                    subject,
                    requesterUser,
                    badge: 'Coordinator Request',
                    badgeStyle: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
                    time: formattedTime,
                    createdAt: item?.createdAt,
                    item,
                    type: 'coordinator_request',
                };
            });

        openDocRequests.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        pendingCoordRequests.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        const activeList = pendingRequestType === 'COORDINATOR' ? pendingCoordRequests : openDocRequests;

        const filteredList = pendingSearch.trim()
            ? activeList.filter((item) => {
                const query = pendingSearch.toLowerCase().trim();
                return (
                    (item.name || '').toLowerCase().includes(query) ||
                    (item.subject || '').toLowerCase().includes(query) ||
                    (item.badge || '').toLowerCase().includes(query)
                );
            })
            : activeList;

        return {
            pendingActionItems: filteredList.slice(0, 10),
            pendingDocCount: openDocRequests.length,
            pendingCoordCount: pendingCoordRequests.length,
        };
    }, [requests, visibleCoordinatorRequests, users, pendingRequestType, pendingSearch]);

    // AUDIT FILTER OPTIONS (COMBOFIELD)
    const auditFilterOptions = useMemo(() => {
        const options = [
            // Entity
            { value: 'entity:DOCUMENTS', label: 'Documents', category: 'Entity' },
            { value: 'entity:DEPARTMENTS', label: 'Departments', category: 'Entity' },
            { value: 'entity:USERS', label: 'Users', category: 'Entity' },
            { value: 'entity:DOCUMENT_REQUEST', label: 'Document Request', category: 'Entity' },
            { value: 'entity:COORDINATOR_REQUEST', label: 'Coordinator Request', category: 'Entity' },

            // Action
            { value: 'action:CREATED', label: 'Create', category: 'Action' },
            { value: 'action:READ', label: 'Read', category: 'Action' },
            { value: 'action:UPDATED', label: 'Update', category: 'Action' },
            { value: 'action:DELETED', label: 'Delete', category: 'Action' },
        ];

        // Departments
        const safeDepts = Array.isArray(departments) ? departments : [];
        safeDepts.forEach((dept) => {
            if (dept?.id && dept?.name) {
                options.push({
                    value: `dept:${dept.id}`,
                    label: dept.name,
                    category: 'Departments',
                });
            }
        });

        return options;
    }, [departments]);

    // FILTERED & PAGINATED AUDIT LOGS
    const {
        paginatedAuditLogs,
        totalAuditPages,
        totalAuditCount,
        auditStartIndex = 0,
        auditSafePage = 1,
    } = useMemo(() => {
        const safeAuditLogs = Array.isArray(auditLogs) ? auditLogs : [];
        const safeUsers = Array.isArray(users) ? users : [];
        const safeDepts = Array.isArray(departments) ? departments : [];

        // Parse active filter selections
        const selectedEntities = [];
        const selectedActions = [];
        const selectedDepts = [];

        (auditFilters || []).forEach((filterValue) => {
            if (filterValue.startsWith('entity:')) selectedEntities.push(filterValue.replace('entity:', ''));
            if (filterValue.startsWith('action:')) selectedActions.push(filterValue.replace('action:', ''));
            if (filterValue.startsWith('dept:')) selectedDepts.push(filterValue.replace('dept:', ''));
        });

        // Build O(1) lookup maps for instant resolution of actors and departments
        const userById = new Map();
        const userByUnivId = new Map();
        const userByEmail = new Map();
        safeUsers.forEach((u) => {
            if (u?.id) userById.set(String(u.id), u);
            if (u?.universityId) userByUnivId.set(String(u.universityId), u);
            if (u?.email) userByEmail.set(String(u.email).toLowerCase(), u);
        });

        const deptById = new Map();
        safeDepts.forEach((d) => {
            if (d?.id) deptById.set(String(d.id), d);
        });

        const filtered = safeAuditLogs.filter((log) => {
            const canonicalAction = toCanonicalAction(log?.action);
            const canonicalEntity = toCanonicalEntity(log?.entityType);

            // 1. ACTION FILTERING (Canonical: CREATED, READ, UPDATED, DELETED)
            if (selectedActions.length > 0 && !selectedActions.includes(canonicalAction)) {
                return false;
            }

            // 2. ENTITY FILTERING (Canonical: DOCUMENTS, DEPARTMENTS, USERS, DOCUMENT_REQUEST, COORDINATOR_REQUEST)
            if (selectedEntities.length > 0 && !selectedEntities.includes(canonicalEntity.key)) {
                return false;
            }

            // 3. DEPARTMENT FILTERING
            if (selectedDepts.length > 0) {
                const rawActor = log?.actor && typeof log.actor === 'object' ? log.actor : null;
                const actorId = rawActor?.id || log?.actorId || (typeof log?.actor === 'string' ? log.actor : null);
                const actor = actorId ? userById.get(String(actorId)) : null;
                const parsedData = parseLogData(log?.data);
                const logDeptId = actor?.departmentId || log?.departmentId || parsedData?.departmentId || parsedData?.actorDepartmentId;
                if (!logDeptId || !selectedDepts.includes(logDeptId)) {
                    return false;
                }
            }

            return true;
        });

        const formatted = filtered.map((log) => {
            const parsedData = parseLogData(log?.data);
            const rawActor = log?.actor && typeof log.actor === 'object' ? log.actor : null;

            const actorId =
                rawActor?.id ||
                log?.actorId ||
                (typeof log?.actor === 'string' ? log.actor : null) ||
                parsedData?.actorId ||
                parsedData?.actor?.id ||
                null;

            const actorFromUsers = actorId
                ? (userById.get(String(actorId)) || userByUnivId.get(String(actorId)) || (parsedData?.actorEmail ? userByEmail.get(String(parsedData.actorEmail).toLowerCase()) : null))
                : (parsedData?.actorEmail ? userByEmail.get(String(parsedData.actorEmail).toLowerCase()) : null);

            const activeUserMatch = (activeUser?.id && actorId === activeUser.id) ||
                (activeUser?.email && (parsedData?.actorEmail === activeUser.email || rawActor?.email === activeUser.email))
                ? activeUser
                : null;

            const actor = actorFromUsers || activeUserMatch || rawActor || parsedData?.actor || null;

            const rawName = actor ? `${actor.firstName ?? ''} ${actor.lastName ?? ''}`.trim() || actor.name : null;
            const actorName =
                rawName ||
                parsedData?.actorName ||
                parsedData?.userName ||
                (rawActor ? `${rawActor.firstName ?? ''} ${rawActor.lastName ?? ''}`.trim() || rawActor.name : null) ||
                (actor?.email ? actor.email.split('@')[0] : null) ||
                'Institutional System';

            const actorRole =
                actor?.role ||
                parsedData?.actorRole ||
                parsedData?.role ||
                rawActor?.role ||
                activeUserMatch?.role ||
                (actorName !== 'Institutional System' ? constants.USERS_ROLE.ADMINISTRATOR : constants.USERS_ROLE.MEMBER);

            const deptMatch = deptById.get(String(actor?.departmentId || parsedData?.actorDepartmentId));
            const actorDepartment =
                deptMatch?.name ||
                actor?.department ||
                parsedData?.actorDepartment ||
                'Records Management Office';
            const canonicalAction = toCanonicalAction(log?.action);
            const canonicalEntity = toCanonicalEntity(log?.entityType);

            const subjectOrTitle = parsedData.title || parsedData.subject || parsedData.name || null;

            let humanDescription = '';
            if (subjectOrTitle) {
                humanDescription = `"${subjectOrTitle}"`;
            } else {
                humanDescription = `${canonicalAction.toLowerCase()} on ${canonicalEntity.label.toLowerCase()}`;
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
                category: canonicalEntity.label,
                action: canonicalAction,
                canonicalAction,
                entityBadge: canonicalEntity,
                user: actorName,
                actorUser: actor,
                role: actorRole,
                department: actorDepartment,
                timestamp: formattedDate,
                parsedData,
            };
        });

        // 4. SEARCH QUERY FILTERING
        const q = auditSearch.trim().toLowerCase();
        const searchFiltered = q
            ? formatted.filter((item) =>
                  item.user.toLowerCase().includes(q) ||
                  item.title.toLowerCase().includes(q) ||
                  item.canonicalAction.toLowerCase().includes(q) ||
                  item.entityBadge.label.toLowerCase().includes(q) ||
                  item.department.toLowerCase().includes(q) ||
                  item.role.toLowerCase().includes(q)
              )
            : formatted;

        // 5. SORTING
        searchFiltered.sort((a, b) => {
            if (auditSort === 'date-desc') {
                return new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0);
            }
            if (auditSort === 'date-asc') {
                return new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0);
            }
            if (auditSort === 'name-asc') {
                return (a.user || '').localeCompare(b.user || '');
            }
            if (auditSort === 'name-desc') {
                return (b.user || '').localeCompare(a.user || '');
            }
            return 0;
        });

        const totalCount = searchFiltered.length;
        const totalPages = Math.max(1, Math.ceil(totalCount / auditPageSize));
        const safePage = Math.min(Math.max(1, auditPage), totalPages);
        const startIndex = (safePage - 1) * auditPageSize;
        const pageSlice = searchFiltered.slice(startIndex, startIndex + auditPageSize);

        return {
            paginatedAuditLogs: pageSlice,
            totalAuditPages: totalPages,
            totalAuditCount: totalCount,
            auditSafePage: safePage,
            auditStartIndex: startIndex,
        };
    }, [auditLogs, users, departments, auditFilters, auditSearch, auditSort, auditPage, auditPageSize]);

    // HANDLERS (AUDIT TRAIL SELECTION OPENS COMPLIANCE PAYLOAD MODAL, DECOUPLED FROM INSPECTOR)
    const handleActivityClick = (activity) => {
        if (!activity) return;
        setViewingAuditLog(activity);
        setShowRawJson(false);
        setHasCopiedJson(false);
    };

    // RENDER
    return (
        <div className={`flex flex-col gap-3.5 sm:gap-4.5 w-full ${className ?? ''}`} {...props}>
            {/* 1. EXECUTIVE WELCOME COMMAND HERO (ADAPTIVE RESPONSIVE BANNER) */}
            <div ref={bannerRef} className="relative overflow-hidden rounded-2xl border border-surface-border bg-surface p-4 sm:p-5 shadow-xs">
                {(() => {
                    const isFull = bannerTier === 'full';
                    const isMobile = bannerTier === 'mobile';

                    const leftContentNode = (
                        <div className="flex flex-col gap-1.5 flex-1 min-w-0 w-full">
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

                            <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                                {isOfficer
                                    ? 'Welcome to your department governance console. Review pending document clearances, monitor shared institutional records, and collaborate with your academic unit.'
                                    : isDirector
                                    ? 'Welcome to your executive department console. Inspect officer-approved institutional records, authorize publications, and manage departmental distributions.'
                                    : isMember
                                    ? 'Welcome to your academic records repository. Access published circulars, review departmental documentation, and consult institutional guidelines.'
                                    : 'Welcome to the institutional records repository. Browse charters, review clearances, inspect real-time departmental readership, and monitor authenticated compliance logs.'}
                            </p>
                        </div>
                    );

                    const actionButtonsNode = (
                        <div className={`flex items-center gap-2.5 ${
                            isFull
                                ? 'shrink-0 w-auto'
                                : (isMobile ? 'flex-col w-full' : 'w-full')
                        }`}>
                            {!isStaff ? (
                                <Button
                                    variant="secondary"
                                    leadingIcon={Plus}
                                    label="Request Clearance"
                                    onClick={() => (onRequestDocument ? onRequestDocument() : onNavigate?.('requests'))}
                                    className={`${
                                        isFull
                                            ? 'w-auto justify-center'
                                            : (isMobile ? 'w-full justify-center' : 'flex-1 justify-center')
                                    }`}
                                />
                            ) : (
                                <Button
                                    variant="secondary"
                                    leadingIcon={FileUp}
                                    label="Upload Document"
                                    onClick={() => (onUploadDocument ? onUploadDocument() : onNavigate?.('documents'))}
                                    className={`${
                                        isFull
                                            ? 'w-auto justify-center'
                                            : (isMobile ? 'w-full justify-center' : 'flex-1 justify-center')
                                    }`}
                                />
                            )}

                            <Button
                                variant="primary"
                                leadingIcon={Folder}
                                label="Browse Repository"
                                onClick={() => onNavigate?.('documents')}
                                className={`${
                                    isFull
                                        ? 'w-auto justify-center'
                                        : (isMobile ? 'w-full justify-center' : 'flex-1 justify-center')
                                } shadow-xs hover:shadow-md transition-shadow`}
                            />
                        </div>
                    );

                    // FULL WINDOW: Side-by-side with generous breathing space
                    if (isFull) {
                        return (
                            <div className="relative flex items-center justify-between gap-4 w-full">
                                {leftContentNode}
                                {actionButtonsNode}
                            </div>
                        );
                    }

                    // HALF WINDOW: Actions immediately go down below the text and take the remaining space
                    // MOBILE VIEW: The other button goes down (stacked vertically)
                    return (
                        <div className="relative flex flex-col gap-3.5 w-full">
                            {leftContentNode}
                            <div className="w-full pt-1.5 border-t border-surface-border/50">
                                {actionButtonsNode}
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* 2. BENTO-GRID KPI METRIC CARDS */}
            {isMember ? (
                /* MEMBER: EXACTLY 2 METRIC CARDS */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {/* CARD 1: PUBLISHED DOCUMENTS */}
                    <div
                        onClick={() => onNavigate?.('documents')}
                        className="p-3.5 sm:p-4 rounded-xl bg-surface border border-surface-border hover:border-accent/50 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2.5 group"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                                Published Documents
                            </span>
                            <div className="p-2 rounded-lg bg-accent-background text-accent group-hover:scale-105 transition-transform">
                                <FileText className="h-4 w-4" />
                            </div>
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className="text-2xl sm:text-3xl font-bold text-text font-serif tracking-tight">
                                {memberPublishedDocs.length}
                            </span>
                            <span className="text-xs text-text-muted">
                                Available in {userUnitName}
                            </span>
                        </div>

                        <div className="pt-2 border-t border-surface-border flex items-center justify-between text-[11px] text-text-muted">
                            <span className="flex items-center gap-1 text-accent font-semibold">
                                <Zap className="h-3 w-3" /> Live Repository
                            </span>
                            <span>{memberPublishedDocs.length} published {memberPublishedDocs.length === 1 ? 'file' : 'files'}</span>
                        </div>
                    </div>

                    {/* CARD 2: DEPARTMENT FACULTY */}
                    <div
                        className="p-3.5 sm:p-4 rounded-xl bg-surface border border-surface-border hover:border-information/50 hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-2.5 group"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                                Department Faculty
                            </span>
                            <div className="p-2 rounded-lg bg-information-background text-information group-hover:scale-105 transition-transform">
                                <Users className="h-4 w-4" />
                            </div>
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className="text-2xl sm:text-3xl font-bold text-text font-serif tracking-tight">
                                {departmentFacultyCount}
                            </span>
                            <span className="text-xs text-text-muted">
                                Faculty colleagues in {userUnitName}
                            </span>
                        </div>

                        <div className="pt-2 border-t border-surface-border flex items-center justify-between text-[11px] text-text-muted">
                            <span className="text-information font-semibold flex items-center gap-1">
                                <Users className="h-3 w-3" /> Institutional Directory
                            </span>
                            <span>Active Roster</span>
                        </div>
                    </div>
                </div>
            ) : isOfficer ? (
                /* OFFICER: EXACTLY 3 METRIC CARDS */
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                    {/* CARD 1: SHARED DOCUMENTS */}
                    <div
                        onClick={() => onNavigate?.('documents')}
                        className="p-3.5 sm:p-4 rounded-xl bg-surface border border-surface-border hover:border-accent/50 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2.5 group"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                                Shared Documents
                            </span>
                            <div className="p-2 rounded-lg bg-accent-background text-accent group-hover:scale-105 transition-transform">
                                <FileText className="h-4 w-4" />
                            </div>
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className="text-2xl sm:text-3xl font-bold text-text font-serif tracking-tight">
                                {departmentSharedDocs.length}
                            </span>
                            <span className="text-xs text-text-muted">
                                Shared with {userUnitName}
                            </span>
                        </div>

                        <div className="pt-2 border-t border-surface-border flex items-center justify-between text-[11px] text-text-muted">
                            <span className="flex items-center gap-1 text-accent font-semibold">
                                <Zap className="h-3 w-3" /> Department Catalog
                            </span>
                            <span>{departmentSharedDocs.length} total shared</span>
                        </div>
                    </div>

                    {/* CARD 2: PENDING APPROVAL */}
                    <div
                        className="p-3.5 sm:p-4 rounded-xl bg-surface border border-surface-border hover:border-warning/50 hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-2.5 group"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                                Pending Approval
                            </span>
                            <div className={`p-2 rounded-lg ${officerPendingDocs.length > 0 ? 'bg-warning-background text-warning' : 'bg-accent-background text-accent'} group-hover:scale-105 transition-transform`}>
                                <Clock className="h-4 w-4" />
                            </div>
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className="text-2xl sm:text-3xl font-bold text-text font-serif tracking-tight">
                                {officerPendingDocs.length}
                            </span>
                            <span className="text-xs text-text-muted">
                                {officerPendingDocs.length > 0
                                    ? `${officerPendingDocs.length} ${officerPendingDocs.length === 1 ? 'document' : 'documents'} awaiting officer review`
                                    : 'All approvals resolved'}
                            </span>
                        </div>

                        <div className="pt-2 border-t border-surface-border flex items-center justify-between text-[11px]">
                            {officerPendingDocs.length > 0 ? (
                                <span className="text-warning font-semibold flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
                                    Action Needed
                                </span>
                            ) : (
                                <span className="text-accent font-semibold flex items-center gap-1">
                                    <Check className="h-3.5 w-3.5" /> All Clear
                                </span>
                            )}
                            <span className="text-text-muted">Officer Queue</span>
                        </div>
                    </div>

                    {/* CARD 3: DEPARTMENT FACULTY */}
                    <div
                        className="p-3.5 sm:p-4 rounded-xl bg-surface border border-surface-border hover:border-information/50 hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-2.5 group sm:col-span-2 xl:col-span-1"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                                Department Faculty
                            </span>
                            <div className="p-2 rounded-lg bg-information-background text-information group-hover:scale-105 transition-transform">
                                <Users className="h-4 w-4" />
                            </div>
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className="text-2xl sm:text-3xl font-bold text-text font-serif tracking-tight">
                                {departmentFacultyCount}
                            </span>
                            <span className="text-xs text-text-muted">
                                Faculty members in {userUnitName}
                            </span>
                        </div>

                        <div className="pt-2 border-t border-surface-border flex items-center justify-between text-[11px] text-text-muted">
                            <span className="text-information font-semibold flex items-center gap-1">
                                <Users className="h-3 w-3" /> Institutional Directory
                            </span>
                            <span>Active Roster</span>
                        </div>
                    </div>
                </div>
            ) : isDirector ? (
                /* DIRECTOR: EXACTLY 3 METRIC CARDS */
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                    {/* CARD 1: SHARED DOCUMENTS */}
                    <div
                        onClick={() => onNavigate?.('documents')}
                        className="p-3.5 sm:p-4 rounded-xl bg-surface border border-surface-border hover:border-accent/50 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2.5 group"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                                Shared Documents
                            </span>
                            <div className="p-2 rounded-lg bg-accent-background text-accent group-hover:scale-105 transition-transform">
                                <FileText className="h-4 w-4" />
                            </div>
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className="text-2xl sm:text-3xl font-bold text-text font-serif tracking-tight">
                                {departmentSharedDocs.length}
                            </span>
                            <span className="text-xs text-text-muted">
                                Shared with {userUnitName}
                            </span>
                        </div>

                        <div className="pt-2 border-t border-surface-border flex items-center justify-between text-[11px] text-text-muted">
                            <span className="flex items-center gap-1 text-accent font-semibold">
                                <Zap className="h-3 w-3" /> Department Catalog
                            </span>
                            <span>{departmentSharedDocs.length} total shared</span>
                        </div>
                    </div>

                    {/* CARD 2: PENDING PUBLICATION */}
                    <div
                        className="p-3.5 sm:p-4 rounded-xl bg-surface border border-surface-border hover:border-sky-500/50 hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-2.5 group"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                                Pending Publication
                            </span>
                            <div className={`p-2 rounded-lg ${directorPendingDocs.length > 0 ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400' : 'bg-accent-background text-accent'} group-hover:scale-105 transition-transform`}>
                                <FileCheck className="h-4 w-4" />
                            </div>
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className="text-2xl sm:text-3xl font-bold text-text font-serif tracking-tight">
                                {directorPendingDocs.length}
                            </span>
                            <span className="text-xs text-text-muted">
                                {directorPendingDocs.length > 0
                                    ? `${directorPendingDocs.length} ${directorPendingDocs.length === 1 ? 'document' : 'documents'} ready for publication`
                                    : 'All approved documents published'}
                            </span>
                        </div>

                        <div className="pt-2 border-t border-surface-border flex items-center justify-between text-[11px]">
                            {directorPendingDocs.length > 0 ? (
                                <span className="text-sky-600 dark:text-sky-400 font-semibold flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                                    Ready to Publish
                                </span>
                            ) : (
                                <span className="text-accent font-semibold flex items-center gap-1">
                                    <Check className="h-3.5 w-3.5" /> All Clear
                                </span>
                            )}
                            <span className="text-text-muted">Director Queue</span>
                        </div>
                    </div>

                    {/* CARD 3: DEPARTMENT FACULTY */}
                    <div
                        className="p-3.5 sm:p-4 rounded-xl bg-surface border border-surface-border hover:border-information/50 hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-2.5 group sm:col-span-2 xl:col-span-1"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                                Department Faculty
                            </span>
                            <div className="p-2 rounded-lg bg-information-background text-information group-hover:scale-105 transition-transform">
                                <Users className="h-4 w-4" />
                            </div>
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className="text-2xl sm:text-3xl font-bold text-text font-serif tracking-tight">
                                {departmentFacultyCount}
                            </span>
                            <span className="text-xs text-text-muted">
                                Faculty members in {userUnitName}
                            </span>
                        </div>

                        <div className="pt-2 border-t border-surface-border flex items-center justify-between text-[11px] text-text-muted">
                            <span className="text-information font-semibold flex items-center gap-1">
                                <Users className="h-3 w-3" /> Institutional Directory
                            </span>
                            <span>Active Roster</span>
                        </div>
                    </div>
                </div>
            ) : (
                /* ADMINISTRATIVE ROLES: EXISTING 3 CARDS */
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
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

                    {/* CARD 3: CONNECTED UNITS (SPANS 2 COLS IN HALF-WINDOW FOR BALANCED PROPORTIONS) */}
                    <div
                        onClick={() => onNavigate?.('departments')}
                        className="p-3.5 sm:p-4 rounded-xl bg-surface border border-surface-border hover:border-information/50 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2.5 group sm:col-span-2 xl:col-span-1"
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
            )}

            {isSpecializedRole ? (
                /* SPECIALIZED ROLES (OFFICER, DIRECTOR, MEMBER): DEDICATED QUEUE HUB */
                <div ref={specializedCardRef} className="p-4 sm:p-5 rounded-2xl bg-surface border border-surface-border flex flex-col gap-3.5 shadow-xs">
                    {/* SPECIALIZED HEADER & CONTROLS */}
                    {(() => {
                        let iconNode = null;
                        let titleText = '';
                        let countBadge = 0;
                        let badgeColorClass = '';
                        let searchPlaceholder = '';

                        if (isOfficer) {
                            iconNode = (
                                <div className="p-2 rounded-lg bg-warning-background text-warning shrink-0">
                                    <Clock className="h-4 w-4" />
                                </div>
                            );
                            titleText = 'Pending Approvals';
                            countBadge = officerPendingDocs.length;
                            badgeColorClass = 'bg-warning-background text-warning border-warning-border';
                            searchPlaceholder = 'Search pending approvals...';
                        } else if (isDirector) {
                            iconNode = (
                                <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 shrink-0">
                                    <FileCheck className="h-4 w-4" />
                                </div>
                            );
                            titleText = 'Pending Publication';
                            countBadge = directorPendingDocs.length;
                            badgeColorClass = 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20';
                            searchPlaceholder = 'Search pending publications...';
                        } else {
                            iconNode = (
                                <div className="p-2 rounded-lg bg-accent-background text-accent shrink-0">
                                    <Sparkles className="h-4 w-4" />
                                </div>
                            );
                            titleText = 'Recent Published Documents';
                            countBadge = memberPublishedDocs.length;
                            badgeColorClass = 'bg-accent-background text-accent border-accent-border';
                            searchPlaceholder = 'Search published documents...';
                        }

                        const headerLeft = (
                            <div className="flex items-center gap-2.5 shrink-0 min-w-0">
                                {iconNode}
                                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                    <h2 className="text-base font-bold text-text truncate">
                                        {titleText}
                                    </h2>
                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badgeColorClass} shrink-0`}>
                                        {countBadge} {countBadge === 1 ? 'document' : 'documents'}
                                    </span>
                                </div>
                            </div>
                        );

                        const searchBox = (
                            <SearchField
                                placeholder={searchPlaceholder}
                                value={specializedSearch}
                                onChange={(e) => setSpecializedSearch(e.target.value)}
                                onClear={() => setSpecializedSearch('')}
                                size="sm"
                            />
                        );

                        if (specializedTier === 'full' || specializedTier === 'half') {
                            return (
                                <div className="flex items-center justify-between gap-3 border-b border-surface-border pb-3">
                                    {headerLeft}
                                    <div className="w-56 sm:w-64 md:w-72 shrink-0">{searchBox}</div>
                                </div>
                            );
                        }

                        return (
                            <div className="flex flex-col gap-2.5 border-b border-surface-border pb-3 w-full">
                                <div className="w-full flex items-center justify-between">
                                    {headerLeft}
                                </div>
                                <div className="w-full">{searchBox}</div>
                            </div>
                        );
                    })()}

                    {/* SPECIALIZED SCROLLABLE LIST */}
                    <div className="min-h-[360px] max-h-[520px] overflow-y-auto pr-1 flex flex-col gap-2">
                        {activeSpecializedList.length === 0 ? (
                            <div className="h-full min-h-[260px] flex flex-col items-center justify-center gap-2.5 text-center text-text-muted border border-dashed border-surface-border rounded-xl p-6">
                                <div className={`p-3 rounded-full ${
                                    specializedSearch
                                        ? 'bg-surface-hover text-text-muted'
                                        : (isOfficer
                                            ? 'bg-accent-background text-accent'
                                            : isDirector
                                            ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400')
                                }`}>
                                    {specializedSearch ? <Search className="h-5 w-5" /> : <CheckCircle2 className="h-6 w-6" />}
                                </div>
                                <span className="text-sm font-bold text-text">
                                    {specializedSearch
                                        ? 'No Matching Documents'
                                        : isOfficer
                                        ? 'All Clear — No Pending Approvals'
                                        : isDirector
                                        ? 'All Clear — No Pending Publications'
                                        : 'No Published Documents Yet'}
                                </span>
                                <span className="text-xs text-text-muted max-w-sm">
                                    {specializedSearch
                                        ? `No documents found matching "${specializedSearch}".`
                                        : isOfficer
                                        ? 'All institutional documents shared to your department have been reviewed and approved.'
                                        : isDirector
                                        ? 'There are currently no officer-approved documents awaiting publication in your department.'
                                        : 'No institutional records or circulars have been published to your department repository yet.'}
                                </span>
                            </div>
                        ) : (
                            activeSpecializedList.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => {
                                        navigate('/documents');
                                        onSelectActivity?.({
                                            ...item.documentItem,
                                            _targetTab: (isOfficer || isDirector) ? 'share' : 'information',
                                        });
                                    }}
                                    className="py-2.5 px-3.5 sm:py-3 sm:px-4 rounded-xl border border-surface-border bg-surface hover:bg-surface-hover/70 hover:border-accent/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 cursor-pointer group shadow-2xs shrink-0"
                                >
                                    {/* Left: Document Icon + Name & Folder/Sharer details */}
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className="p-2 rounded-lg bg-surface-hover/80 border border-surface-border text-text-muted group-hover:text-accent group-hover:border-accent/40 transition-colors shrink-0">
                                            <FileText className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                <span className="text-xs sm:text-sm font-bold text-text truncate group-hover:text-accent transition-colors" title={item.title}>
                                                    {item.title}
                                                </span>
                                                <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-surface-hover text-text-muted border border-surface-border shrink-0">
                                                    {item.extension}
                                                </span>
                                                {item.classification && (
                                                    <span className={`text-[10px] font-semibold px-2 py-0.2 rounded-full border shrink-0 ${CLASSIFICATION_STYLES[item.classification] || CLASSIFICATION_STYLES.UNCLASSIFIED}`}>
                                                        {item.classificationLabel}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-text-muted truncate">
                                                {item.parentFolderName && (
                                                    <>
                                                        <span className="truncate flex items-center gap-1 font-medium text-text/80">
                                                            📁 {item.parentFolderName}
                                                        </span>
                                                        <span>•</span>
                                                    </>
                                                )}
                                                <span className="truncate">
                                                    {isOfficer ? `Shared by ${item.sharerName}` : isDirector ? `Reviewed by ${item.sharerName}` : `Shared with ${userUnitName}`}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Status badge + timestamp + arrow */}
                                    <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 self-end sm:self-center">
                                        {isOfficer && (
                                            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border bg-warning-background text-warning border-warning-border flex items-center gap-1">
                                                <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
                                                Pending Approval
                                            </span>
                                        )}
                                        {isDirector && (
                                            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20 flex items-center gap-1">
                                                <Check className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                                                Approved • Ready to Publish
                                            </span>
                                        )}
                                        {isMember && (
                                            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 flex items-center gap-1">
                                                <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                                Published
                                            </span>
                                        )}
                                        <span className="text-[11px] text-text-muted font-mono bg-surface-hover/70 px-2 py-0.5 rounded-md border border-surface-border/50 shrink-0">
                                            {item.timestamp}
                                        </span>
                                        <ArrowRight className="h-4 w-4 text-text-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0 hidden sm:inline" />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                /* ADMINISTRATIVE ROLES (ADMIN & COORDINATOR): EXISTING 2-COLUMN + AUDIT LOG SECTIONS */
                <>
                    {/* 3. TWO-COLUMN ROW: PENDING REQUESTS + DOCUMENT ANALYSIS */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5 sm:gap-4.5">
                {/* LEFT COLUMN: PENDING REQUESTS */}
                <div ref={pendingCardRef} className="p-4 sm:p-5 rounded-2xl bg-surface border border-surface-border flex flex-col gap-3.5 shadow-xs">
                    {/* PENDING HEADER & CONTROLS (RESPONSIVE TIERS) */}
                    {(() => {
                        const headerNode = (
                            <div className="flex items-center gap-2.5 shrink-0 min-w-0">
                                <div className="p-2 rounded-lg bg-warning-background text-warning shrink-0">
                                    <Inbox className="h-4 w-4" />
                                </div>
                                <h2 className="text-base font-bold text-text truncate">
                                    Pending Requests
                                </h2>
                            </div>
                        );

                        const searchNode = (
                            <SearchField
                                placeholder="Search requests..."
                                value={pendingSearch}
                                onChange={(e) => setPendingSearch(e.target.value)}
                                onClear={() => setPendingSearch('')}
                                size="sm"
                            />
                        );

                        const toggleNode = (
                            <div className={`flex items-center bg-surface-hover/70 p-0.5 rounded-lg border border-surface-border shrink-0 ${
                                pendingTier === 'mobile' ? 'w-full grid grid-cols-2' : ''
                            }`}>
                                <button
                                    type="button"
                                    onClick={() => setPendingRequestType('DOCUMENT')}
                                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                                        pendingRequestType === 'DOCUMENT'
                                            ? 'bg-accent text-text-inverted font-semibold shadow-2xs'
                                            : 'text-text-muted hover:text-text'
                                    }`}
                                >
                                    <span>Document</span>
                                    {pendingDocCount > 0 && (
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                                            pendingRequestType === 'DOCUMENT'
                                                ? 'bg-text-inverted/20 text-text-inverted'
                                                : 'bg-surface-border text-text-muted'
                                        }`}>
                                            {pendingDocCount}
                                        </span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPendingRequestType('COORDINATOR')}
                                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                                        pendingRequestType === 'COORDINATOR'
                                            ? 'bg-accent text-text-inverted font-semibold shadow-2xs'
                                            : 'text-text-muted hover:text-text'
                                    }`}
                                >
                                    <span>Coordinator</span>
                                    {pendingCoordCount > 0 && (
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                                            pendingRequestType === 'COORDINATOR'
                                                ? 'bg-text-inverted/20 text-text-inverted'
                                                : 'bg-surface-border text-text-muted'
                                        }`}>
                                            {pendingCoordCount}
                                        </span>
                                    )}
                                </button>
                            </div>
                        );

                        if (pendingTier === 'full') {
                            return (
                                <div className="flex items-center justify-between gap-3 border-b border-surface-border pb-3">
                                    {headerNode}
                                    <div className="flex items-center gap-2 shrink-0 ml-auto">
                                        <div className="w-40 sm:w-48 shrink-0">{searchNode}</div>
                                        {toggleNode}
                                    </div>
                                </div>
                            );
                        }

                        if (pendingTier === 'half') {
                            return (
                                <div className="flex items-center gap-2.5 border-b border-surface-border pb-3 w-full">
                                    {headerNode}
                                    <div className="flex-1 min-w-[120px]">{searchNode}</div>
                                    {toggleNode}
                                </div>
                            );
                        }

                        if (pendingTier === 'quarter') {
                            return (
                                <div className="flex flex-col gap-2.5 border-b border-surface-border pb-3 w-full">
                                    <div className="w-full flex items-center justify-between">
                                        {headerNode}
                                    </div>
                                    <div className="flex items-center gap-2 w-full">
                                        <div className="flex-1 min-w-0">{searchNode}</div>
                                        {toggleNode}
                                    </div>
                                </div>
                            );
                        }

                        // Mobile tier
                        return (
                            <div className="flex flex-col gap-2 border-b border-surface-border pb-3 w-full">
                                <div className="w-full flex items-center">
                                    {headerNode}
                                </div>
                                <div className="w-full">{searchNode}</div>
                                <div className="w-full">{toggleNode}</div>
                            </div>
                        );
                    })()}

                    {/* MATCHING FIXED HEIGHT WITH SCROLL */}
                    <div className="h-[380px] sm:h-[420px] overflow-y-auto pr-1 flex flex-col gap-2">
                        {pendingActionItems.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center gap-2.5 text-center text-text-muted border border-dashed border-surface-border rounded-xl p-4">
                                <div className="p-2.5 rounded-full bg-accent-background text-accent">
                                    <CheckCircle2 className="h-5 w-5" />
                                </div>
                                <span className="text-xs sm:text-sm font-bold text-text">
                                    {pendingSearch
                                        ? 'No Matching Requests'
                                        : (pendingRequestType === 'COORDINATOR' ? 'No Coordinator Requests' : 'No Document Requests')}
                                </span>
                                <span className="text-xs text-text-muted max-w-xs">
                                    {pendingSearch
                                        ? `No pending requests matching "${pendingSearch}".`
                                        : (pendingRequestType === 'COORDINATOR'
                                            ? 'No elevated coordinator approvals or departmental reviews awaiting clearance.'
                                            : 'All student and faculty clearance inquiries are currently resolved.')}
                                </span>
                            </div>
                        ) : (
                            pendingActionItems.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => {
                                        if (item.type === 'coordinator_request') {
                                            onNavigate?.('coordinator');
                                        } else {
                                            if (onSelectActivity && item.item) {
                                                onSelectActivity({ ...item.item, _targetTab: 'messages' });
                                            } else {
                                                onNavigate?.('requests');
                                            }
                                        }
                                    }}
                                    className="py-2.5 px-3 rounded-xl border border-surface-border bg-surface hover:bg-surface-hover/70 hover:border-accent/40 transition-all flex items-center justify-between gap-3 cursor-pointer group shadow-2xs shrink-0"
                                >
                                    {/* [ Name / Subject ] */}
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <Avatar
                                            src={item.requesterUser ? resolveUserAvatar(item.requesterUser, activeUser) : null}
                                            alt={item.name}
                                            size="small"
                                            className="h-7 w-7 shrink-0 text-xs border border-surface-border group-hover:border-accent/40 transition-colors"
                                        />
                                        <div className="flex items-center gap-1.5 min-w-0 truncate">
                                            <span className="text-xs font-bold text-text truncate group-hover:text-accent transition-colors">
                                                {item.name}
                                            </span>
                                            <span className="text-text-muted text-xs shrink-0">•</span>
                                            <span className="text-xs text-text-muted truncate capitalize">
                                                {item.subject}
                                            </span>
                                        </div>
                                    </div>

                                    {/* [ coordinator or document request ] [ Time ] */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${item.badgeStyle}`}>
                                            {item.badge}
                                        </span>
                                        <span className="text-[11px] text-text-muted font-mono bg-surface-hover/70 px-2 py-0.5 rounded-md border border-surface-border/50 shrink-0">
                                            {item.time}
                                        </span>
                                        <ArrowRight className="h-3.5 w-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hidden sm:inline" />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: DOCUMENT ANALYSIS (LOCKED TO GRID, MAX 3 CARDS VISIBLE BEFORE SCROLL) */}
                <div ref={analysisCardRef} className="p-4 sm:p-5 rounded-2xl bg-surface border border-surface-border flex flex-col gap-3.5 shadow-xs">
                    {/* HUB HEADER & CONTROLS (RESPONSIVE TIERS) */}
                    {(() => {
                        const headerNode = (
                            <div className="flex items-center gap-2.5 min-w-0 shrink-0">
                                <div className="p-2 rounded-lg bg-accent-background text-accent shrink-0">
                                    <TrendingUp className="h-4 w-4" />
                                </div>
                                <h2 className="text-base font-bold font-serif text-text truncate">
                                    Document Analysis
                                </h2>
                            </div>
                        );

                        const searchNode = (
                            <SearchField
                                placeholder="Search analysis..."
                                value={analysisSearch}
                                onChange={(e) => setAnalysisSearch(e.target.value)}
                                onClear={() => setAnalysisSearch('')}
                                size="sm"
                            />
                        );

                        const toggleNode = (
                            <div className={`flex items-center bg-surface-hover/70 p-0.5 rounded-lg border border-surface-border shrink-0 ${
                                analysisTier === 'mobile' ? 'w-full grid grid-cols-2' : ''
                            }`}>
                                <button
                                    type="button"
                                    onClick={() => setAnalyticsSortBy('READS')}
                                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer text-center ${
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
                                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer text-center ${
                                        analyticsSortBy === 'RECENT'
                                            ? 'bg-accent text-text-inverted font-semibold shadow-2xs'
                                            : 'text-text-muted hover:text-text'
                                    }`}
                                >
                                    Recent Reads
                                </button>
                            </div>
                        );

                        if (analysisTier === 'full') {
                            return (
                                <div className="flex items-center justify-between gap-3 border-b border-surface-border pb-3">
                                    {headerNode}
                                    <div className="flex items-center gap-2 shrink-0 ml-auto">
                                        <div className="w-40 sm:w-48 shrink-0">{searchNode}</div>
                                        {toggleNode}
                                    </div>
                                </div>
                            );
                        }

                        if (analysisTier === 'half') {
                            return (
                                <div className="flex items-center gap-2.5 border-b border-surface-border pb-3 w-full">
                                    {headerNode}
                                    <div className="flex-1 min-w-[120px]">{searchNode}</div>
                                    {toggleNode}
                                </div>
                            );
                        }

                        if (analysisTier === 'quarter') {
                            return (
                                <div className="flex flex-col gap-2.5 border-b border-surface-border pb-3 w-full">
                                    <div className="w-full flex items-center justify-between">
                                        {headerNode}
                                    </div>
                                    <div className="flex items-center gap-2 w-full">
                                        <div className="flex-1 min-w-0">{searchNode}</div>
                                        {toggleNode}
                                    </div>
                                </div>
                            );
                        }

                        // Mobile tier
                        return (
                            <div className="flex flex-col gap-2 border-b border-surface-border pb-3 w-full">
                                <div className="w-full flex items-center">
                                    {headerNode}
                                </div>
                                <div className="w-full">{searchNode}</div>
                                <div className="w-full">{toggleNode}</div>
                            </div>
                        );
                    })()}

                    {/* MATCHING FIXED HEIGHT WITH SCROLL (SHOWS MAX 3 GRID CARDS BEFORE SCROLLING) */}
                    <div className="h-[380px] sm:h-[420px] overflow-y-auto pr-1">
                        {documentAnalyticsList.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center gap-2.5 text-center text-text-muted border border-dashed border-surface-border rounded-xl p-4">
                                <div className="p-2.5 rounded-full bg-surface-hover text-text-muted">
                                    <BarChart3 className="h-5 w-5" />
                                </div>
                                <span className="text-xs sm:text-sm font-bold text-text">No Shared Document Activity</span>
                                <span className="text-xs text-text-muted max-w-xs">
                                    {analysisSearch
                                        ? `No records found matching "${analysisSearch}".`
                                        : 'Only documents shared with colleges or located inside shared folders appear in readership analytics.'}
                                </span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                {documentAnalyticsList.map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => {
                                            if (item.documentItem) {
                                                if (item.documentItem.isArchived) {
                                                    navigate('/archives');
                                                } else {
                                                    navigate('/documents');
                                                }
                                                onSelectActivity?.({ ...item.documentItem, _targetTab: 'information' });
                                            }
                                        }}
                                        className="p-3.5 rounded-xl border border-surface-border bg-surface-hover/20 hover:bg-surface-hover/50 hover:border-accent/40 transition-all flex flex-col gap-3 cursor-pointer group shadow-2xs shrink-0"
                                    >
                                        {/* DOCUMENT HEADER TITLE & INLINE META BADGES */}
                                        <div className="flex items-center justify-between gap-2.5 min-w-0">
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <div className="p-1.5 rounded-lg bg-accent-background text-accent shrink-0">
                                                    <FileText className="h-3.5 w-3.5" />
                                                </div>
                                                <span
                                                    className="font-bold text-xs text-text truncate group-hover:text-accent transition-colors"
                                                    title={item.title}
                                                >
                                                    {item.title}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {item.parentFolderName && (
                                                    <span
                                                        className="text-[10px] font-medium bg-surface-hover px-1.5 py-0.5 rounded border border-surface-border text-text-muted truncate max-w-[120px] sm:max-w-[160px]"
                                                        title={item.parentFolderName}
                                                    >
                                                        📁 {item.parentFolderName}
                                                    </span>
                                                )}
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${CLASSIFICATION_STYLES[item.classification] || CLASSIFICATION_STYLES.UNCLASSIFIED}`}>
                                                    {item.classificationLabel}
                                                </span>
                                                <ArrowUpRight className="h-3.5 w-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hidden sm:inline" />
                                            </div>
                                        </div>

                                        {/* MODERN DUAL-GRAPH PANEL */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-surface-border">
                                            {/* GRAPH 1: READ OF THE WEEK */}
                                            <div className="p-2.5 rounded-lg bg-surface border border-surface-border flex flex-col gap-1.5">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-semibold text-text flex items-center gap-1 text-[11px]">
                                                        <Eye className="h-3 w-3 text-accent" />
                                                        <span>Weekly Reads</span>
                                                    </span>
                                                    <span className="text-[10px] text-text-muted font-medium">
                                                        {item.weekUniqueReaders} {item.weekUniqueReaders === 1 ? 'reader' : 'readers'}
                                                    </span>
                                                </div>

                                                <div className="w-full pt-0.5">
                                                    <ReadershipChart precomputedSlots={item.slots} compact={true} showPeak={false} />
                                                </div>

                                                <div className="flex items-center justify-between text-[10px] text-text-muted pt-0.5 border-t border-surface-border/50">
                                                    <span className="truncate">Top: {item.topDeptName}</span>
                                                    <span className="font-mono text-[9px] uppercase tracking-wider text-accent font-semibold">SUN – SAT</span>
                                                </div>
                                            </div>

                                            {/* GRAPH 2: ALL TIME READ */}
                                            <div className="p-2.5 rounded-lg bg-surface border border-surface-border flex flex-col gap-1.5">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-semibold text-text flex items-center gap-1 text-[11px]">
                                                        <BarChart3 className="h-3 w-3 text-sky-500" />
                                                        <span>All Time Reads</span>
                                                    </span>
                                                    <span className="text-[10px] text-text-muted font-medium">
                                                        {item.totalUniqueReaders} {item.totalUniqueReaders === 1 ? 'reader' : 'readers'}
                                                    </span>
                                                </div>

                                                <div className="w-full pt-0.5">
                                                    <ReadershipChart precomputedSlots={item.allTimeSlots} compact={true} showPeak={false} color="#0ea5e9" />
                                                </div>

                                                <div className="flex items-center justify-between text-[10px] text-text-muted pt-0.5 border-t border-surface-border/50">
                                                    <span className="truncate">Cumulative History</span>
                                                    <span className="font-mono text-[9px] uppercase tracking-wider text-sky-600 dark:text-sky-400 font-semibold">ALL TIME</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 4. AUDIT LOGS (FULL WIDTH) */}
            <div ref={auditCardRef} className="p-4 sm:p-5 rounded-2xl bg-surface border border-surface-border flex flex-col gap-3.5 shadow-xs">
                {/* AUDIT HEADER & CONTROLS (RESPONSIVE TIERS) */}
                {(() => {
                    const headerNode = (
                        <div className="flex items-center gap-2.5 shrink-0 min-w-0">
                            <div className="p-2 rounded-lg bg-accent-background text-accent shrink-0">
                                <Activity className="h-4 w-4" />
                            </div>
                            <h2 className="text-base font-bold text-text truncate">
                                Audit Logs
                            </h2>
                        </div>
                    );

                    const searchNode = (
                        <SearchField
                            placeholder="Search audit trail..."
                            value={auditSearch}
                            onChange={(e) => {
                                setAuditSearch(e.target.value);
                                setAuditPage(1);
                            }}
                            onClear={() => {
                                setAuditSearch('');
                                setAuditPage(1);
                            }}
                        />
                    );

                    const sortNode = (
                        <SelectField
                            value={auditSort}
                            options={AUDIT_SORT_OPTIONS}
                            onChange={(newSort) => {
                                setAuditSort(newSort);
                                setAuditPage(1);
                            }}
                            leadingIcon={Clock}
                            placeholder="Sort by..."
                            dropdownAlign="right"
                        />
                    );

                    const filterNode = (
                        <ComboField
                            options={auditFilterOptions}
                            value={auditFilters}
                            onChange={(newFilters) => {
                                setAuditFilters(newFilters);
                                setAuditPage(1);
                            }}
                            isMultiple={true}
                            leadingIcon={Filter}
                            placeholder="Filter activities..."
                            dropdownAlign="right"
                        />
                    );

                    if (auditTier === 'full') {
                        return (
                            <div className="flex items-center justify-between gap-3 border-b border-surface-border pb-3">
                                {headerNode}
                                <div className="flex items-center gap-2.5 shrink-0 ml-auto">
                                    <div className="w-56 sm:w-64 md:w-72 shrink-0">{searchNode}</div>
                                    <div className="w-48 sm:w-52 md:w-56 shrink-0">{sortNode}</div>
                                    <div className="w-52 sm:w-60 md:w-64 shrink-0">{filterNode}</div>
                                </div>
                            </div>
                        );
                    }

                    if (auditTier === 'half') {
                        return (
                            <div className="flex flex-col gap-2.5 border-b border-surface-border pb-3 w-full">
                                <div className="flex items-center justify-between w-full">
                                    {headerNode}
                                    <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full bg-surface-hover/90 text-text-muted font-medium border border-surface-border shrink-0 shadow-2xs">
                                        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                                        <span>{totalAuditCount} {totalAuditCount === 1 ? 'entry' : 'entries'}</span>
                                    </span>
                                </div>
                                <div className="flex items-center gap-2.5 w-full">
                                    <div className="flex-1 min-w-[180px]">{searchNode}</div>
                                    <div className="w-48 sm:w-52 shrink-0">{sortNode}</div>
                                    <div className="w-52 sm:w-60 shrink-0">{filterNode}</div>
                                </div>
                            </div>
                        );
                    }

                    if (auditTier === 'quarter') {
                        return (
                            <div className="flex flex-col gap-2.5 border-b border-surface-border pb-3 w-full">
                                <div className="flex items-center justify-between w-full">
                                    {headerNode}
                                    <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full bg-surface-hover/90 text-text-muted font-medium border border-surface-border shrink-0 shadow-2xs">
                                        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                                        <span>{totalAuditCount} {totalAuditCount === 1 ? 'entry' : 'entries'}</span>
                                    </span>
                                </div>
                                <div className="w-full">{searchNode}</div>
                                <div className="flex items-center gap-2.5 w-full">
                                    <div className="flex-1 min-w-0">{sortNode}</div>
                                    <div className="flex-1 min-w-0">{filterNode}</div>
                                </div>
                            </div>
                        );
                    }

                    // Mobile tier
                    return (
                        <div className="flex flex-col gap-2 border-b border-surface-border pb-3 w-full">
                            <div className="w-full flex items-center justify-between">
                                {headerNode}
                                <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-surface-hover/90 text-text-muted font-medium border border-surface-border shrink-0">
                                    <span>{totalAuditCount}</span>
                                </span>
                            </div>
                            <div className="w-full">{searchNode}</div>
                            <div className="w-full">{sortNode}</div>
                            <div className="w-full">{filterNode}</div>
                        </div>
                    );
                })()}

                {/* AUDIT LOG ITEMS (FIXED HEIGHT WITH SCROLL) */}
                <div className="h-[380px] sm:h-[420px] overflow-y-auto pr-1 flex flex-col gap-2">
                    {paginatedAuditLogs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-xs text-text-muted text-center p-4">
                            No audit activity matching your filter and search criteria.
                        </div>
                    ) : (
                        paginatedAuditLogs.map((activity) => (
                            <div
                                key={activity.id}
                                onClick={() => handleActivityClick(activity)}
                                className="py-2.5 px-3 rounded-xl border border-surface-border bg-surface hover:bg-surface-hover/70 hover:border-accent/40 transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs"
                            >
                                {/* ACTOR & ACTION DESCRIPTION WITH [ role ] [ entity ] [ action ] */}
                                <div className="flex items-center gap-3 min-w-0">
                                    <Avatar
                                        src={activity.actorUser ? resolveUserAvatar(activity.actorUser, activeUser) : null}
                                        alt={activity.user}
                                        size="small"
                                        className="h-8 w-8 shrink-0 text-xs border border-surface-border group-hover:border-accent/40 transition-colors"
                                    />

                                    <div className="flex flex-col gap-1 min-w-0">
                                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                            <span className="text-xs font-bold text-text truncate group-hover:text-accent transition-colors">
                                                {activity.user}
                                            </span>

                                            {/* [ role ] */}
                                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ROLE_BADGE_STYLES[activity.role] || 'bg-surface-hover text-text-muted border-surface-border'}`}>
                                                {activity.role}
                                            </span>

                                            {/* [ entity ] */}
                                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${activity.entityBadge?.style || 'bg-surface-hover text-text-muted border-surface-border'}`}>
                                                {activity.entityBadge?.label || 'Documents'}
                                            </span>

                                            {/* [ action ] */}
                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${ACTION_VERB_STYLES[activity.canonicalAction] || 'bg-surface-hover text-text-muted border-surface-border'}`}>
                                                {activity.canonicalAction}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5 text-xs text-text-muted truncate">
                                            <span className="truncate font-medium text-text/80">{activity.title}</span>
                                            <span>•</span>
                                            <span className="truncate">{activity.department}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* TIMESTAMP */}
                                <div className="text-[11px] text-text-muted shrink-0 self-end sm:self-center font-mono bg-surface-hover/60 px-2 py-1 rounded-md border border-surface-border/50">
                                    {activity.timestamp}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* PAGINATION CONTROLS */}
                {totalAuditCount > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2.5 border-t border-surface-border text-xs text-text-muted mt-auto">
                        <div className="flex items-center gap-2">
                            <span>
                                Showing <span className="font-semibold text-text">{auditStartIndex + 1}</span>–<span className="font-semibold text-text">{Math.min(auditStartIndex + auditPageSize, totalAuditCount)}</span> of <span className="font-semibold text-text">{totalAuditCount}</span> entries
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                disabled={auditSafePage <= 1}
                                onClick={() => setAuditPage((prev) => Math.max(1, prev - 1))}
                                className="px-2.5 py-1 rounded-md border border-surface-border bg-surface hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-1 font-medium"
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                                <span>Previous</span>
                            </button>

                            <span className="px-2 font-mono font-medium text-text">
                                {auditSafePage} / {totalAuditPages}
                            </span>

                            <button
                                type="button"
                                disabled={auditSafePage >= totalAuditPages}
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
                </>
            )}

            {/* AUDIT LOG DETAILS MODAL (PAYLOAD & STATE SNAPSHOT INSPECTION, SAFE READ-ONLY) */}
            {viewingAuditLog && (() => {
                const crudAction = toCrudVerb(viewingAuditLog.canonicalAction);
                const entityLabel = (viewingAuditLog.entityBadge?.label || viewingAuditLog.entityType || 'ENTITY').toUpperCase();
                const modalTitle = `${entityLabel} ${crudAction}`;
                const targetEntityName = resolveTargetEntityName(viewingAuditLog, {
                    documents,
                    departments,
                    users,
                    requests,
                    coordinatorRequests,
                });

                return (
                    <Modal
                        isOpen={Boolean(viewingAuditLog)}
                        onClose={() => {
                            setViewingAuditLog(null);
                            setShowRawJson(false);
                            setHasCopiedJson(false);
                        }}
                        size="lg"
                        title={modalTitle}
                        description={`Entry #${viewingAuditLog.id ? viewingAuditLog.id.slice(0, 8) : 'RECORD'} • Recorded on ${viewingAuditLog.timestamp || formatDateTime(viewingAuditLog.createdAt)}`}
                        icon={Shield}
                        callout={null}
                        actions={
                            <div className="flex items-center justify-end gap-2 w-full">
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        setViewingAuditLog(null);
                                        setShowRawJson(false);
                                        setHasCopiedJson(false);
                                    }}
                                    label="Close"
                                    className="w-full sm:w-auto"
                                />
                            </div>
                        }
                    >
                        <div className="flex flex-col gap-4 py-2 text-text">
                            {/* ACTOR & ACTION OVERVIEW CARD */}
                            <div className="flex flex-col gap-2 p-3.5 bg-surface-hover/70 rounded-xl border border-surface-border text-xs shadow-2xs">
                                {/* Actor => Name + Role */}
                                <div className="flex items-center justify-between py-1 border-b border-surface-border/60">
                                    <span className="font-medium text-text-muted">Actor:</span>
                                    <div className="flex items-center gap-1.5">
                                        <Avatar
                                            src={viewingAuditLog.actorUser ? resolveUserAvatar(viewingAuditLog.actorUser, activeUser) : null}
                                            alt={viewingAuditLog.user}
                                            size="small"
                                            className="h-5 w-5 text-[10px]"
                                        />
                                        <span className="font-semibold text-text">{viewingAuditLog.user}</span>
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ROLE_BADGE_STYLES[viewingAuditLog.role] || 'bg-surface-hover text-text-muted border-surface-border'}`}>
                                            {viewingAuditLog.role}
                                        </span>
                                    </div>
                                </div>

                                {/* Department => Name of the Department of the actor */}
                                <div className="flex items-center justify-between py-1 border-b border-surface-border/60">
                                    <span className="font-medium text-text-muted">Department:</span>
                                    <span className="font-semibold text-text">{viewingAuditLog.department}</span>
                                </div>

                                {/* Entity => EntityType badge [ name of the actual target entity rather than an id ] */}
                                <div className="flex items-center justify-between py-1 border-b border-surface-border/60">
                                    <span className="font-medium text-text-muted">Entity:</span>
                                    <div className="flex items-center gap-2 max-w-[70%] justify-end">
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${viewingAuditLog.entityBadge?.style || 'bg-surface-hover text-text-muted border-surface-border'}`}>
                                            {viewingAuditLog.entityBadge?.label || viewingAuditLog.entityType}
                                        </span>
                                        <span className="font-semibold text-text truncate text-xs" title={targetEntityName}>
                                            {targetEntityName}
                                        </span>
                                    </div>
                                </div>

                                {/* Action => CRUD (do not CRUD [ CRUD ]) */}
                                <div className="flex items-center justify-between py-1">
                                    <span className="font-medium text-text-muted">Action:</span>
                                    <span className={`font-bold px-2 py-0.5 rounded border text-[11px] ${ACTION_VERB_STYLES[viewingAuditLog.canonicalAction] || 'bg-surface-hover text-text-muted border-surface-border'}`}>
                                        {crudAction}
                                    </span>
                                </div>
                            </div>

                        {/* PAYLOAD / STATE DETAILS (COORDINATOR STYLE) */}
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-text">Event</span>
                                <button
                                    type="button"
                                    onClick={() => setShowRawJson((prev) => !prev)}
                                    className="text-[11px] text-accent hover:underline cursor-pointer flex items-center gap-1"
                                >
                                    {showRawJson ? 'View Structured' : 'View Raw JSON'}
                                </button>
                            </div>

                            {showRawJson ? (
                                <div className="relative">
                                    <pre className="p-3 rounded-xl bg-surface border border-surface-border text-[11px] font-mono text-text overflow-x-auto max-h-64 overflow-y-auto shadow-2xs select-text">
                                        {JSON.stringify(viewingAuditLog.parsedData, null, 2)}
                                    </pre>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            navigator.clipboard?.writeText(JSON.stringify(viewingAuditLog.parsedData, null, 2));
                                            setHasCopiedJson(true);
                                            setTimeout(() => setHasCopiedJson(false), 2000);
                                        }}
                                        className="absolute top-2 right-2 px-2 py-1 rounded bg-surface-hover text-text-muted hover:text-text border border-surface-border text-[10px] font-medium flex items-center gap-1 cursor-pointer"
                                    >
                                        {hasCopiedJson ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
                                        <span>{hasCopiedJson ? 'Copied' : 'Copy'}</span>
                                    </button>
                                </div>
                            ) : (() => {
                                const { diffs, staticFields } = extractAuditDiff(viewingAuditLog.parsedData);
                                const parsed = viewingAuditLog.parsedData || {};

                                let oldState = (parsed.old || parsed.previous || parsed.before) ?? null;
                                let newState = (parsed.new || parsed.after || parsed.current) ?? null;

                                if (!oldState && (crudAction === 'UPDATE' || crudAction === 'DELETE')) {
                                    if (diffs.length > 0) {
                                        oldState = Object.fromEntries(diffs.map((d) => [d.key, d.oldValue]));
                                        newState = Object.fromEntries(diffs.map((d) => [d.key, d.newValue]));
                                    } else if (crudAction === 'DELETE') {
                                        oldState = Object.fromEntries(
                                            Object.entries(parsed).filter(([k]) => !IGNORED_AUDIT_DIFF_KEYS.has(k) && !['title', 'description', 'actorId', 'actorName', 'actorRole', 'actorEmail', 'actorDepartment', 'actorDepartmentId'].includes(k))
                                        );
                                    }
                                }

                                if (!newState) {
                                    if (crudAction === 'DELETE') {
                                        newState = { status: 'DELETED' };
                                    } else if (crudAction === 'CREATE') {
                                        newState = Object.fromEntries(
                                            Object.entries(parsed).filter(([k]) => !IGNORED_AUDIT_DIFF_KEYS.has(k) && !['title', 'description', 'actorId', 'actorName', 'actorRole', 'actorEmail', 'actorDepartment', 'actorDepartmentId'].includes(k))
                                        );
                                    }
                                }

                                return (
                                    <div className="flex flex-col gap-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {/* CARD 1: CURRENT STATE (DATABASE) */}
                                            <div className="flex flex-col gap-2 p-3 rounded-xl border border-surface-border bg-surface">
                                                <div className="flex items-center justify-between pb-2 border-b border-surface-border">
                                                    <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                                                        Current State (Database)
                                                    </span>
                                                    <span className="text-xs text-text-muted">
                                                        {crudAction === 'CREATE'
                                                            ? 'None (New Entry)'
                                                            : crudAction === 'READ'
                                                            ? 'None (Read Event)'
                                                            : oldState && Object.keys(oldState).length > 0
                                                            ? 'Existing Record'
                                                            : 'None'}
                                                    </span>
                                                </div>

                                                {crudAction === 'CREATE' ? (
                                                    <div className="py-4 text-center text-xs text-text-muted italic">
                                                        No previous database record (Provisioning new entry)
                                                    </div>
                                                ) : crudAction === 'READ' ? (
                                                    <div className="py-4 text-center text-xs text-text-muted italic">
                                                        Read-only access event — no previous state modified.
                                                    </div>
                                                ) : oldState && Object.keys(oldState).length > 0 ? (
                                                    <div className="flex flex-col divide-y divide-surface-border text-xs max-h-56 overflow-y-auto">
                                                        {Object.entries(oldState).map(([fieldKey, fieldValue]) => (
                                                            <div key={fieldKey} className="flex items-center justify-between py-1.5 gap-2">
                                                                <span className="text-text-muted font-medium capitalize shrink-0">
                                                                    {formatKeyLabel(fieldKey)}:
                                                                </span>
                                                                <span className="font-medium text-text-muted text-right line-through truncate max-w-[180px]">
                                                                    {formatAuditValue(fieldValue, fieldKey, { documents, departments, users })}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="py-4 text-center text-xs text-text-muted italic">
                                                        No previous database record
                                                    </div>
                                                )}
                                            </div>

                                            {/* CARD 2: RESULTING / APPLIED STATE (DATABASE) */}
                                            <div className="flex flex-col gap-2 p-3 rounded-xl border border-accent-border bg-accent-background/30">
                                                <div className="flex items-center justify-between pb-2 border-b border-accent-border">
                                                    <span className="text-xs font-bold text-accent uppercase tracking-wider">
                                                        {crudAction === 'READ' ? 'Access Information' : 'Applied State (Database)'}
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-accent text-text-inverted">
                                                        {crudAction === 'CREATE'
                                                            ? 'New Record'
                                                            : crudAction === 'READ'
                                                            ? 'Accessed'
                                                            : crudAction === 'DELETE'
                                                            ? 'Purged'
                                                            : 'Committed'}
                                                    </span>
                                                </div>

                                                {crudAction === 'READ' ? (
                                                    <div className="py-3 px-2 text-center text-xs text-accent italic flex flex-col gap-1 items-center">
                                                        <Eye className="h-4 w-4 text-accent" />
                                                        <span>Special Document Event: Official university document was securely viewed and accessed. No state mutations applied.</span>
                                                    </div>
                                                ) : newState && Object.keys(newState).length > 0 ? (
                                                    <div className="flex flex-col divide-y divide-accent-border/60 text-xs max-h-56 overflow-y-auto">
                                                        {Object.entries(newState).map(([fieldKey, fieldValue]) => (
                                                            <div key={fieldKey} className="flex items-center justify-between py-1.5 gap-2">
                                                                <span className="text-text-muted font-medium capitalize shrink-0">
                                                                    {formatKeyLabel(fieldKey)}:
                                                                </span>
                                                                <span className="font-semibold text-accent text-right truncate max-w-[180px]">
                                                                    {formatAuditValue(fieldValue, fieldKey, { documents, departments, users })}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="py-4 text-center text-xs text-text-muted italic">
                                                        No state modifications recorded
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* EVENT CONTEXT / ATTRIBUTES (SUPPLEMENTARY) */}
                                        {staticFields.length > 0 && (
                                            <div className="p-3 rounded-xl border border-surface-border bg-surface-hover/40 flex flex-col gap-1.5 text-xs">
                                                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                                                    Record Metadata
                                                </span>
                                                <div className="flex flex-col gap-1">
                                                    {staticFields.map(([k, v]) => {
                                                        if (k === 'attachments' && Array.isArray(v)) {
                                                            return (
                                                                <div key={k} className="flex items-center justify-between gap-2 py-1 border-b border-surface-border/50">
                                                                    <span className="font-semibold text-text-muted capitalize shrink-0">Attachments:</span>
                                                                    <div className="flex flex-col gap-1 items-end">
                                                                        {v.map((att, idx) => (
                                                                            <span key={idx} className="text-right text-accent font-medium truncate inline-flex items-center gap-1 px-2 py-0.5 rounded bg-accent/10">
                                                                                📎 {att.name || att.title || `Document #${idx + 1}`}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        return (
                                                            <div key={k} className="flex items-center justify-between gap-2 py-0.5 border-b border-surface-border/40 last:border-0">
                                                                <span className="font-medium text-text-muted capitalize shrink-0">{formatKeyLabel(k)}:</span>
                                                                <span className="font-semibold text-text text-right font-mono truncate max-w-[280px]">
                                                                    {formatAuditValue(v, k, { documents, departments, users })}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </Modal>
                );
            })()}
        </div>
    );
};

// --- EXPORTS ---
export { DashboardPage };
export default DashboardPage;
