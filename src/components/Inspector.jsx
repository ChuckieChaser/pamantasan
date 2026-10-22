// --- IMPORTS ---
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    AlertTriangle,
    Archive,
    ArrowDownAZ,
    ArrowUpAZ,
    ArrowUpDown,
    Building2,
    Calendar,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    FolderTree,
    Clock,
    Copy,
    Download,
    Edit3,
    Eye,
    EyeOff,
    FileCheck,
    FileText,
    FileType,
    Filter,
    Folder,
    FolderInput,
    FolderOpen,
    Globe,
    HardDrive,
    Hash,
    Inbox,
    Info,
    Layers,
    Lock,
    MessageSquare,
    Paperclip,
    RotateCcw,
    Search,
    Send,
    Share2,
    Shield,
    ShieldCheck,
    Sparkles,
    Tag,
    Trash2,
    Upload,
    UploadCloud,
    User,
    UserCheck,
    Users,
    UserX,
    X,
    XCircle,
} from 'lucide-react';
import { useAuth, useToast } from '../hooks';
import {
    useAuditStore,
    useAuthStore,
    useCoordinatorStore,
    useDepartmentStore,
    useDocumentStore,
    useUserStore,
    getRecursiveDescendantDocIds,
} from '../stores';
import { ReadershipChart } from './ReadershipChart';
import { Avatar, resolveUserAvatar } from './Avatar';
import { Badge } from './Badge';
import { Button } from './Button';
import { Modal } from './Modal';
import { AreaField, SelectField, TextField } from './Fields';
import { SegmentSelection } from './Selections';
import { Account } from './ui/Account';
import { formatMimeTypeLabel } from './common';
import { findRootSharedFolder, getActionConfirmationConfig } from './browser/common';
import { constants, isStaffRole } from '../constants';
import { storageService, coordinatorApprovalService, aiService } from '../services';
import { stripFileExtension } from '../utils/fileNameUtils';

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


// --- CONFIGURATIONS ---
const SECTION_TITLE_STYLE = 'text-xs font-semibold uppercase tracking-wider text-text-muted select-none';
const PROPERTY_ROW_STYLE = 'flex items-center justify-between gap-3 py-2 border-b border-surface-border text-xs';
const PROPERTY_LABEL_STYLE = 'text-text-muted flex items-center gap-2 shrink-0 font-medium';
const PROPERTY_VALUE_STYLE = 'font-medium text-text text-right break-words select-text';
const CALLOUT_BOX_STYLE = 'p-3 rounded-md bg-surface-hover border border-surface-border text-xs text-text leading-relaxed select-text';
const ERROR_CALLOUT_STYLE = 'p-3 rounded-md bg-error-background border border-error-border text-xs text-error leading-relaxed select-text';
const ICON_STYLE = 'h-4 w-4 shrink-0 text-text-muted';

const CLASSIFICATION_BADGE_VARIANT = {
    [constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC]: 'success',
    [constants.DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE]: 'information',
    [constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED]: 'neutral',
    [constants.DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL]: 'warning',
    [constants.DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED]: 'error',
};

const ATTACH_SORT_OPTIONS = [
    { value: 'name-asc',      label: 'Name (A to Z)',           icon: ArrowDownAZ },
    { value: 'name-desc',     label: 'Name (Z to A)',           icon: ArrowUpAZ },
    { value: 'date-desc',     label: 'Recently Added',          icon: Clock },
    { value: 'date-asc',      label: 'Oldest Added',            icon: Clock },
    { value: 'mimetype-asc',  label: 'File Type (Docs first)',  icon: FileText },
    { value: 'mimetype-desc', label: 'File Type (Media first)', icon: FileText },
];

const ATTACH_CLASSIFICATION_OPTIONS = [
    { value: 'all',          label: 'All Classifications' },
    { value: 'PUBLIC',       label: 'Public' },
    { value: 'INTERNAL',     label: 'Internal' },
    { value: 'CONFIDENTIAL', label: 'Confidential' },
    { value: 'RESTRICTED',   label: 'Restricted' },
    { value: 'PRIVATE',      label: 'Private' },
];

const ROLE_BADGE_VARIANT = {
    [constants.USERS_ROLE.ADMINISTRATOR]: 'neutral',
    [constants.USERS_ROLE.DIRECTOR]: 'neutral',
    [constants.USERS_ROLE.COORDINATOR]: 'neutral',
    [constants.USERS_ROLE.OFFICER]: 'neutral',
    [constants.USERS_ROLE.MEMBER]: 'neutral',
};

const STATUS_BADGE_VARIANT = {
    [constants.DOCUMENT_SHARES_STATUS.APPROVED]: 'success',
    [constants.DOCUMENT_SHARES_STATUS.PUBLISHED]: 'success',
    [constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL]: 'warning',
    [constants.DOCUMENT_SHARES_STATUS.STASHED]: 'neutral',
    [constants.DOCUMENT_SHARES_STATUS.REJECTED]: 'error',
    [constants.USERS_STATUS.VERIFIED]: 'success',
    [constants.USERS_STATUS.PENDING_PASSWORD]: 'warning',
    [constants.USERS_STATUS.PENDING_SSO]: 'information',
    [constants.USERS_STATUS.SUSPENDED]: 'error',
    [constants.DOCUMENT_REQUESTS_STATUS.OPEN]: 'information',
    [constants.DOCUMENT_REQUESTS_STATUS.RESOLVED]: 'success',
    [constants.DOCUMENT_REQUESTS_STATUS.REJECTED]: 'error',
    [constants.COORDINATOR_REQUESTS_STATUS.PENDING]: 'warning',
    [constants.COORDINATOR_REQUESTS_STATUS.APPROVED]: 'success',
    [constants.COORDINATOR_REQUESTS_STATUS.REJECTED]: 'error',
};

const RMO_DEPARTMENT_ID = 'd0000001-0000-4000-8000-000000000001';
const RMO_DEPARTMENT_RAW = 'd0000001000040008000000000000001';


// --- HELPERS ---
const normalizeTab = (tab) => {
    if (!tab) return 'information';
    if (tab === 'content' || tab === 'contents' || tab === 'view_content') return 'content';
    if (tab === 'version' || tab === 'versions' || tab === 'view_version') return 'version';
    if (tab === 'share' || tab === 'shares' || tab === 'view_share') return 'share';
    if (tab === 'view_information') return 'information';
    if (tab === 'view_message' || tab === 'message' || tab === 'messages' || tab === 'discussion') return 'messages';
    if (tab === 'view_attachment' || tab === 'attachment' || tab === 'attachments') return 'attachments';
    return tab;
};

const formatDocumentSummary = (rawSummary) => {
    if (!rawSummary || typeof rawSummary !== 'string') return '';

    let text = rawSummary.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    text = text.replace(/^["']|["']$/g, '').trim();

    // 1. Separate squished keywords where no space exists, e.g. "CommunityFROM:" or "AffairsSUBJECT:"
    text = text.replace(/([A-Za-z0-9_.,])(MEMORANDUM|OFFICE\s+ORDER|SPECIAL\s+ORDER|ADMINISTRATIVE\s+ORDER|CIRCULAR|DATE|DATED|TO|MEMORANDUM\s+FOR|FOR|ATTENTION|FROM|ISSUED\s+BY|SUBJECT)\s*[:;\u2014-]/gi, '$1\n$2:');
    
    // 2. Separate when there are spaces but no newline: "... Community FROM: ..."
    text = text.replace(/([^\n])\s+\b(DATE|DATED|TO|MEMORANDUM\s+FOR|FOR|ATTENTION|FROM|ISSUED\s+BY|SUBJECT|\bRE\b)\s*[:;\u2014-]/gi, '$1\n$2:');

    const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);

    let docNo = null;
    let docDate = null;
    let recipient = null;
    let sender = null;
    let subject = null;

    const bodyLines = [];

    for (let i = 0; i < rawLines.length; i++) {
        const l = rawLines[i];

        if (!docNo && /^(MEMORANDUM(?:\s+CIRCULAR)?|OFFICE\s+ORDER|SPECIAL\s+ORDER|ADMINISTRATIVE\s+ORDER|CIRCULAR|DOCUMENT|REF|MEMO)\s*NO\.?\s*[:\u2014-]?\s*[-A-Za-z0-9_/.,\s]+/i.test(l)) {
            docNo = l;
            continue;
        }

        if (!docDate && /^(?:DATE|DATED)\s*[:;\u2014.-]?\s*[-A-Za-z0-9\s,/]+$/i.test(l)) {
            docDate = l.replace(/^(?:DATE|DATED)\s*[:;\u2014.-]?\s*/i, 'Date: ');
            continue;
        }

        if (!recipient && /^(?:TO|MEMORANDUM\s+FOR|FOR|ATTENTION)\s*[:;\u2014.-]?\s*(.+)/i.test(l)) {
            const m = l.match(/^(?:TO|MEMORANDUM\s+FOR|FOR|ATTENTION)\s*[:;\u2014.-]?\s*(.+)/i);
            recipient = m[1].trim();
            continue;
        }

        if (!sender && /^(?:FROM|ISSUED\s+BY|OFFICE\s+OF\s+THE)\s*[:;\u2014.-]?\s*(.+)/i.test(l)) {
            const m = l.match(/^(?:FROM|ISSUED\s+BY|OFFICE\s+OF\s+THE)\s*[:;\u2014.-]?\s*(.+)/i);
            sender = m[1].trim();
            continue;
        }

        if (!subject && /^(?:SUBJECT|TITLE|\bRE\b)\s*[:;\u2014.-]?\s*(.+)/i.test(l)) {
            const m = l.match(/^(?:SUBJECT|TITLE|\bRE\b)\s*[:;\u2014.-]?\s*(.+)/i);
            const subCandidate = m[1].trim();
            // If it's a mangled word like "gistration for participating...", fix to "Registration for participating..." and put into body!
            if (/^gistration\b/i.test(subCandidate)) {
                bodyLines.push(`Re${subCandidate}`);
                continue;
            }
            subject = subCandidate;
            continue;
        }

        // Secondary check: if there is another line starting with SUBJECT: gistration..., fix it
        if (/^(?:SUBJECT|TITLE|\bRE\b)\s*[:;\u2014.-]?\s*(.+)/i.test(l)) {
            const m = l.match(/^(?:SUBJECT|TITLE|\bRE\b)\s*[:;\u2014.-]?\s*(.+)/i);
            const extra = m[1].trim();
            if (/^gistration\b/i.test(extra)) {
                bodyLines.push(`Re${extra}`);
            } else {
                bodyLines.push(extra);
            }
            continue;
        }

        bodyLines.push(l);
    }

    const topSection = [];
    if (docNo) topSection.push(docNo);
    if (docDate) topSection.push(docDate);

    const partySection = [];
    if (recipient) partySection.push(`TO: ${recipient}`);
    if (sender) partySection.push(`FROM: ${sender}`);
    if (subject) partySection.push(`SUBJECT: ${subject}`);

    const headerParts = [];
    if (topSection.length > 0) headerParts.push(topSection.join('\n'));
    if (partySection.length > 0) headerParts.push(partySection.join('\n'));

    const formattedHeader = headerParts.join('\n\n');

    // Filter and format body paragraphs (max 3 substantive paragraphs)
    const cleanedBody = bodyLines
        .filter(l => !/^(asset size|file size|preserved in repository|in institutional repository|format:|file format|asset format)/i.test(l))
        .map(l => {
            let s = l.trim();
            if (!/[.!?]$/.test(s)) s += '.';
            return s;
        });

    const formattedBody = cleanedBody.slice(0, 3).join('\n\n');

    if (formattedHeader && formattedBody) {
        return `${formattedHeader}\n\n${formattedBody}`;
    } else if (formattedHeader) {
        return formattedHeader;
    }
    return formattedBody;
};

const formatChangeSummary = (rawChangeSummary) => {
    if (!rawChangeSummary || typeof rawChangeSummary !== 'string') return '';
    let text = rawChangeSummary.replace(/\r\n/g, '\n').trim();
    // Separate bullets that are concatenated inline (e.g. "...story. - Removed all...") with double newlines
    text = text.replace(/([.!?])\s*[-*•]\s+/g, '$1\n\n- ');

    // If the text has bullets, ensure each line is prefixed with "- " and separated by \n\n
    if (text.includes('- ') || text.includes('• ') || text.includes('* ')) {
        const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
        const bullets = lines.map(line => {
            let cleaned = line.replace(/^[-*•]\s*/, '').trim();
            if (!/[.!?]$/.test(cleaned)) cleaned += '.';
            return `- ${cleaned}`;
        });
        return bullets.join('\n\n');
    }

    return text;
};


// --- COMPONENTS ---
const Inspector = ({
    item = null,
    selectedItems = [],
    currentUser = null,
    targetTab = null,
    onTabChange = null,
    onAction,
    onUnstageItem = null,
    onClearSelection = null,
    className,
    ...props
}) => {
    // REFS
    const chatEndReference = useRef(null);
    const chatTextareaRef = useRef(null);

    // STATES
    const [activeTab, setActiveTab] = useState(normalizeTab(targetTab || item?._targetTab || 'information'));
    const [copiedPropertyKey, setCopiedPropertyKey] = useState(null);
    const [chatInputText, setChatInputText] = useState('');
    const [stagedAttachments, setStagedAttachments] = useState([]);
    const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
    const [attachSearchTerm, setAttachSearchTerm] = useState('');
    const [attachSortBy, setAttachSortBy] = useState('name-asc');
    const [attachClassFilter, setAttachClassFilter] = useState('all');
    const [isSemanticSearching, setIsSemanticSearching] = useState(false);
    const [semanticScoreMap, setSemanticScoreMap] = useState({});
    const [previousItemId, setPreviousItemId] = useState(item?.id);

    // VERSION REVERT CONFIRMATION STATE
    const [revertingVersionItem, setRevertingVersionItem] = useState(null);
    const [isRevertingVersion, setIsRevertingVersion] = useState(false);

    // COORDINATOR REJECT CONFIRMATION MODAL STATES (B1 & A4)
    const [rejectingCoordinatorReq, setRejectingCoordinatorReq] = useState(null);
    const [coordinatorRejectReason, setCoordinatorRejectReason] = useState('');
    const [isSubmittingCoordinatorReject, setIsSubmittingCoordinatorReject] = useState(false);

    // DEPARTMENT MODALS & FACULTY INSPECTION STATES
    const [viewingFacultyMember, setViewingFacultyMember] = useState(null);
    const [isEditDepartmentModalOpen, setIsEditDepartmentModalOpen] = useState(false);
    const [isSavingEditDepartment, setIsSavingEditDepartment] = useState(false);
    const [deptFormCode, setDeptFormCode] = useState('');
    const [deptFormName, setDeptFormName] = useState('');
    const [deptFormErrors, setDeptFormErrors] = useState({});

    // USER MODALS & FORM STATES
    const editUserAvatarInputRef = useRef(null);
    const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
    const [isSavingEditUser, setIsSavingEditUser] = useState(false);
    const [userFormFirstName, setUserFormFirstName] = useState('');
    const [userFormMiddleName, setUserFormMiddleName] = useState('');
    const [userFormLastName, setUserFormLastName] = useState('');
    const [userFormEmail, setUserFormEmail] = useState('');
    const [userFormDepartmentId, setUserFormDepartmentId] = useState('');
    const [userFormRole, setUserFormRole] = useState(constants.USERS_ROLE.MEMBER);
    const [userFormAvatarPath, setUserFormAvatarPath] = useState(null);
    const [userFormAvatarFile, setUserFormAvatarFile] = useState(null);
    const [userFormErrors, setUserFormErrors] = useState({});
    const [activeActionLoading, setActiveActionLoading] = useState(null);
    const [hoveredActionFilter, setHoveredActionFilter] = useState(null);

    // DIRECTORY TREE STATES
    const [expandedFolderIds, setExpandedFolderIds] = useState(() => new Set());
    const [selectedTreeItemId, setSelectedTreeItemId] = useState(null);

    // SHARE CARD COLLAPSE STATE
    const [collapsedShareIds, setCollapsedShareIds] = useState(() => new Set());
    const toggleShareCollapse = (id) => setCollapsedShareIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });
    const collapseAllShares = (ids) => setCollapsedShareIds(new Set(ids));
    const expandAllShares = () => setCollapsedShareIds(new Set());

    // STATES: QUICK ACTION CONFIRMATION & REJECTION MODALS
    const [inspectorConfirmAction, setInspectorConfirmAction] = useState(null);
    const [inspectorRejectModal, setInspectorRejectModal] = useState(null);
    const [inspectorRejectReason, setInspectorRejectReason] = useState('');

    // STATES: RESHARE MODAL (NEW VERSION OR OVERWRITE)
    const [reshareModal, setReshareModal] = useState(null);
    const [reshareFile, setReshareFile] = useState(null);
    const [reshareChangeSummary, setReshareChangeSummary] = useState('');
    const [isSubmittingReshare, setIsSubmittingReshare] = useState(false);

    // HOOKS
    const { showToast } = useToast();
    const { currentUser: authUser } = useAuth();
    const storeUser = useAuthStore((state) => state.currentUser);
    const activeUser = currentUser ?? authUser ?? storeUser ?? useAuthStore.getState().currentUser;
    const isStaff = constants.isStaffRole(activeUser?.role);
    const isAdmin = constants.isAdminRole(activeUser?.role);
    const isCoordinator = constants.isCoordinatorRole(activeUser?.role);
    const isOfficer = constants.isOfficerRole(activeUser?.role);
    const isDirector = constants.isDirectorRole(activeUser?.role);
    const isMember = constants.isMemberRole(activeUser?.role);

    useEffect(() => {
        if (item?.id !== previousItemId) {
            queueMicrotask(() => {
                setPreviousItemId(item?.id);
                const explicitTab = targetTab || item?._targetTab;
                if (explicitTab) {
                    const resolvedTab = normalizeTab(explicitTab);
                    const target = (resolvedTab === 'share' && isMember) ? 'information' : resolvedTab;
                    setActiveTab(target);
                    onTabChange?.(target);
                }
                setChatInputText('');
                setStagedAttachments([]);
                setIsAttachModalOpen(false);
                setIsEditDepartmentModalOpen(false);
                setIsEditUserModalOpen(false);
                setViewingFacultyMember(null);
                setExpandedFolderIds(new Set());
                setSelectedTreeItemId(null);
            });
        }
    }, [item?.id, previousItemId, targetTab, item?._targetTab, isMember, onTabChange]);

    const allDocuments = useDocumentStore((state) => state.documents);
    const allDocumentVersions = useDocumentStore((state) => state.documentVersions ?? state.versions ?? []);
    const allDocumentShares = useDocumentStore((state) => state.documentShares ?? state.shares ?? []);
    const allDocumentRequests = useDocumentStore((state) => state.documentRequests ?? []);
    const allCoordinatorRequests = useCoordinatorStore((state) => state.coordinatorRequests ?? []);
    const allRequestMessages = useDocumentStore((state) => state.documentRequestMessages ?? []);
    const allRequestAttachments = useDocumentStore((state) => state.documentRequestAttachments ?? []);
    const addRequestMessage = useDocumentStore((state) => state.insertDocumentRequestMessage);
    const attachDocumentToRequest = useDocumentStore((state) => state.insertDocumentRequestAttachment);
    const allDepartments = useDepartmentStore((state) => state.departments);
    const allUsers = useUserStore((state) => state.users);
    const allAuditLogs = useAuditStore((state) => state.auditLogs);

    // DEBOUNCED SEMANTIC SEARCH IN REPOSITORY ATTACH MODAL
    useEffect(() => {
        const trimmed = attachSearchTerm.trim();
        if (!isAttachModalOpen || trimmed.length < 3) {
            return;
        }

        let isMounted = true;
        const timer = setTimeout(async () => {
            setIsSemanticSearching(true);
            try {
                const queryVec = await aiService.generateTextEmbedding(trimmed);
                if (!isMounted || !queryVec) {
                    setIsSemanticSearching(false);
                    return;
                }
                const map = {};
                (allDocuments || []).forEach((doc) => {
                    const vers = (allDocumentVersions || []).filter(
                        (v) => (v.document?.id ?? v.documentId) === doc.id
                    );
                    const latest = vers.length > 0
                        ? [...vers].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0]
                        : null;
                    if (latest?.embedding && Array.isArray(latest.embedding) && latest.embedding.length > 0) {
                        const sim = aiService.computeCosineSimilarity(queryVec, latest.embedding);
                        if (sim >= 0.35) {
                            map[doc.id] = {
                                similarity: sim,
                                confidencePct: Math.round(sim * 100),
                                summarySnippet: latest.summary ? latest.summary.slice(0, 110) + '...' : null,
                            };
                        }
                    }
                });
                if (isMounted) {
                    setSemanticScoreMap(map);
                }
            } catch (err) {
                console.warn('[SemanticSearch] Embedding search skipped:', err?.message);
            } finally {
                if (isMounted) {
                    setIsSemanticSearching(false);
                }
            }
        }, 380);

        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, [attachSearchTerm, isAttachModalOpen, allDocuments, allDocumentVersions]);

    const renderClassificationBadge = (classification) => {
        const norm = String(classification || 'UNCLASSIFIED').toUpperCase().trim();
        const styleMap = {
            PUBLIC: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
            INTERNAL: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30',
            CONFIDENTIAL: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
            RESTRICTED: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
            PRIVATE: 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30',
            UNCLASSIFIED: 'bg-neutral-500/15 text-text-muted border-neutral-500/30',
        };
        const classes = styleMap[norm] || styleMap.UNCLASSIFIED;
        return (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider border ${classes}`}>
                {norm}
            </span>
        );
    };

    // DERIVED ENTITY TYPES (STRICTLY MUTUALLY EXCLUSIVE)
    const isFolder = Boolean(item?.isFolder);
    const isCoordinatorRequest = Boolean(
        !isFolder &&
        item?.action &&
        typeof item.action === 'string' &&
        (item.action.startsWith('USER_') ||
            item.action.startsWith('DEPARTMENT_') ||
            item.action.startsWith('DOCUMENT_'))
    );
    const isDocumentRequest = Boolean(
        !isFolder &&
        !isCoordinatorRequest &&
        (item?.subject !== undefined ||
            item?.requesterId !== undefined ||
            item?.messages !== undefined ||
            item?.attachments !== undefined)
    );
    const isUser = Boolean(
        !isFolder &&
        !isCoordinatorRequest &&
        !isDocumentRequest &&
        (item?.universityId || (item?.role && !item?.action) || (item?.email && !item?.action))
    );
    const isDepartment = Boolean(
        !isFolder &&
        !isUser &&
        !isCoordinatorRequest &&
        !isDocumentRequest &&
        item?.code &&
        !item?.universityId
    );
    const isDocument = Boolean(
        !isFolder &&
        !isUser &&
        !isDepartment &&
        !isCoordinatorRequest &&
        !isDocumentRequest &&
        (item?.classification ||
            item?.size ||
            item?.sizeBytes ||
            item?.mimeType ||
            item?.version !== undefined ||
            item?.parentId !== undefined ||
            item?.name ||
            item?.title)
    );

    // FETCH VERSIONS & SHARES DYNAMICALLY ON SELECTION
    useEffect(() => {
        if (item?.id && isDocument) {
            useDocumentStore.getState().fetchDocumentVersions(item.id).catch(() => {});
        }
        if (item?.id && (isDocument || isFolder)) {
            useDocumentStore.getState().fetchDocumentShares(item.id).catch(() => {});
        }
    }, [item?.id, isDocument, isFolder]);

    useEffect(() => {
        if (activeTab === 'share' && item?.id && (isDocument || isFolder)) {
            useDocumentStore.getState().fetchDocumentShares(item.id).catch(() => {});
        }
    }, [activeTab, item?.id, isDocument, isFolder]);

    // REACTIVE LIVE DEPARTMENT DATA
    const activeDepartment = useMemo(() => {
        if (!item || !isDepartment) return null;
        return allDepartments.find((dept) => dept.id === item.id) ?? null;
    }, [item, isDepartment, allDepartments]);

    // REACTIVE LIVE USER DATA
    const activeUserRecord = useMemo(() => {
        if (!item || !isUser) return null;
        return allUsers.find((user) => user.id === item.id) ?? null;
    }, [item, isUser, allUsers]);

    const isSelfUser = Boolean(
        isUser &&
        activeUser && (
            item?.id === activeUser.id ||
            (activeUserRecord?.id && activeUser.id === activeUserRecord.id) ||
            (item?.universityId && activeUser.universityId === item.universityId) ||
            (activeUserRecord?.universityId && activeUser.universityId === activeUserRecord.universityId)
        )
    );

    const userDepartmentDisplay = useMemo(() => {
        if (!isUser) return '—';
        const currentU = activeUserRecord ?? item;
        const dept = allDepartments.find(
            (d) => d.id === currentU.departmentId ||
                   d.name === currentU.department ||
                   d.code === currentU.department
        );
        if (dept) {
            return `${dept.name} (${dept.code})`;
        }
        return currentU.department ?? '—';
    }, [isUser, activeUserRecord, item, allDepartments]);

    const activeItem = useMemo(() => {
        if (!item) return null;
        if (isDepartment && activeDepartment) {
            return {
                ...item,
                ...activeDepartment,
                title: activeDepartment.name ?? item.name ?? item.title,
                name: activeDepartment.name ?? item.name ?? item.title,
                code: activeDepartment.code ?? item.code,
                subtitle: activeDepartment.code ?? item.subtitle,
                createdAt: activeDepartment.createdAt ?? item.createdAt,
                updatedAt: activeDepartment.updatedAt ?? item.updatedAt,
            };
        }
        if (isUser && activeUserRecord) {
            const firstName = activeUserRecord.firstName ?? item.firstName ?? '';
            const lastName = activeUserRecord.lastName ?? item.lastName ?? '';
            const fullName = `${firstName} ${lastName}`.trim() || item.name || item.title || 'User';
            return {
                ...item,
                ...activeUserRecord,
                firstName: firstName || item.firstName,
                lastName: lastName || item.lastName,
                universityId: activeUserRecord.universityId ?? item.universityId,
                email: activeUserRecord.email ?? item.email,
                role: activeUserRecord.role ?? item.role,
                status: activeUserRecord.status ?? item.status,
                departmentId: activeUserRecord.departmentId ?? item.departmentId,
                title: fullName,
                name: fullName,
                department: userDepartmentDisplay,
                createdAt: activeUserRecord.createdAt ?? item.createdAt,
                updatedAt: activeUserRecord.updatedAt ?? item.updatedAt,
            };
        }
        if (isDocument) {
            const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
            const itemCleanId = cleanId(item.id);
            const matchedDoc = allDocuments.find((doc) => cleanId(doc.id) === itemCleanId);
            const docVersions = allDocumentVersions.filter(
                (v) => cleanId(v.document?.id ?? v.documentId) === itemCleanId
            );
            const sortedVersions = [...docVersions].sort(
                (a, b) => (b.versionNumber ?? b.version ?? 0) - (a.versionNumber ?? a.version ?? 0)
            );
            const latestVer = sortedVersions[0];
            const docUpdatedAt = matchedDoc?.updatedAt || item.updatedAt;
            const verUpdatedAt = latestVer?.updatedAt;
            const effectiveUpdatedAt = (docUpdatedAt && verUpdatedAt)
                ? (new Date(docUpdatedAt).getTime() >= new Date(verUpdatedAt).getTime() ? docUpdatedAt : verUpdatedAt)
                : (docUpdatedAt || verUpdatedAt || matchedDoc?.createdAt || item.createdAt);

            const liveShares = allDocumentShares.filter((s) => cleanId(s.document?.id ?? s.documentId) === itemCleanId);
            const isLiveShared = liveShares.length > 0;
            const liveStatus = isLiveShared
                ? (liveShares[0]?.status || 'SHARED')
                : (matchedDoc?.isArchived ? 'ARCHIVED' : (matchedDoc?.status === 'SHARED' ? 'PRIVATE' : (matchedDoc?.status || 'PRIVATE')));

            return {
                ...item,
                name: matchedDoc?.name ?? item.name ?? item.title,
                title: matchedDoc?.name ?? item.title ?? item.name,
                status: liveStatus,
                comment: matchedDoc?.comment ?? item.comment ?? null,
                summary: latestVer?.summary ?? item.summary ?? null,
                classification: item.isFolder
                    ? null
                    : (latestVer?.classification ?? item.classification ?? constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED),
                version: item.isFolder
                    ? '—'
                    : (latestVer ? `v${latestVer.versionNumber ?? latestVer.version ?? 1}.0` : (item.version || 'v1.0')),
                sizeBytes: latestVer?.sizeBytes ?? item.sizeBytes ?? (typeof item.size === 'number' ? item.size : undefined),
                size: item.size || (latestVer?.sizeBytes ? formatBytes(latestVer.sizeBytes) : (item.sizeBytes ? formatBytes(item.sizeBytes) : null)),
                mimeType: latestVer?.mimeType ?? item.mimeType,
                path: latestVer?.path ?? item.path,
                checksum: latestVer?.checksum ?? item.checksum,
                createdAt: matchedDoc?.createdAt ?? item.createdAt,
                updatedAt: effectiveUpdatedAt,
            };
        }
        if (isFolder) {
            const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
            const itemCleanId = cleanId(item.id);
            const matchedDoc = allDocuments.find((doc) => cleanId(doc.id) === itemCleanId);
            const liveShares = allDocumentShares.filter((s) => cleanId(s.document?.id ?? s.documentId) === itemCleanId);
            const isLiveShared = liveShares.length > 0;
            const liveStatus = isLiveShared
                ? (liveShares[0]?.status || 'SHARED')
                : (matchedDoc?.isArchived ? 'ARCHIVED' : (matchedDoc?.status === 'SHARED' ? 'PRIVATE' : (matchedDoc?.status || 'PRIVATE')));

            const getFolderSizeBytes = (folderId) => {
                let total = 0;
                const children = allDocuments.filter(
                    (d) => (d.parent?.id ?? d.parentId) === folderId && !d.isArchived
                );
                for (const child of children) {
                    if (child.isFolder) {
                        total += getFolderSizeBytes(child.id);
                    } else {
                        const fileVersions = allDocumentVersions.filter(
                            (v) => (v.document?.id ?? v.documentId) === child.id
                        );
                        const latest = [...fileVersions].sort(
                            (a, b) => (b.versionNumber ?? b.version ?? 0) - (a.versionNumber ?? a.version ?? 0)
                        )[0];
                        total += Number(latest?.sizeBytes ?? child.sizeBytes ?? 0) || 0;
                    }
                }
                return total;
            };
            const folderSizeBytes = getFolderSizeBytes(item.id);

            return {
                ...item,
                name: matchedDoc?.name ?? item.name ?? item.title,
                title: matchedDoc?.name ?? item.title ?? item.name,
                status: liveStatus,
                comment: matchedDoc?.comment ?? item.comment ?? null,
                summary: null,
                classification: null,
                version: '—',
                sizeBytes: folderSizeBytes,
                createdAt: matchedDoc?.createdAt ?? item.createdAt,
                updatedAt: matchedDoc?.updatedAt ?? item.updatedAt,
            };
        }
        if (isDocumentRequest) {
            const matchedRequest = (allDocumentRequests || []).find((r) => String(r.id) === String(item?.id));
            const effectiveStatus = matchedRequest?.status ?? item?.status;
            const effectiveRejection = item?.rejectionReason ?? matchedRequest?.rejectionReason ?? matchedRequest?.rejection_reason ?? null;
            return {
                ...item,
                ...(matchedRequest || {}),
                status: effectiveStatus,
                rejectionReason: effectiveRejection,
                updatedAt: matchedRequest?.updatedAt ?? item?.updatedAt,
            };
        }
        if (isCoordinatorRequest) {
            const matchedRequest = allCoordinatorRequests.find((r) => r.id === item.id);
            if (matchedRequest) {
                return {
                    ...item,
                    ...matchedRequest,
                    status: matchedRequest.status ?? item.status,
                    updatedAt: matchedRequest.updatedAt ?? item.updatedAt,
                };
            }
        }
        return item;
    }, [item, isDepartment, activeDepartment, isUser, activeUserRecord, userDepartmentDisplay, isDocument, isFolder, isDocumentRequest, isCoordinatorRequest, allDocuments, allDocumentVersions, allDocumentShares, allDocumentRequests, allCoordinatorRequests]);

    // FETCH REQUEST MESSAGES & ATTACHMENTS (INITIAL + REALTIME POLLING)
    useEffect(() => {
        const requestId = activeItem?.id ?? item?.id;
        if (!requestId || !isDocumentRequest) return;

        if (allDocuments.length === 0) {
            useDocumentStore.getState().fetchDocuments().catch(() => {});
        }
        if (allDocumentVersions.length === 0) {
            useDocumentStore.getState().fetchAllDocumentVersions().catch(() => {});
        }

        useDocumentStore.getState().fetchDocumentRequestMessages(requestId).catch(() => {});
        useDocumentStore.getState().fetchDocumentRequestAttachments(requestId).catch(() => {});

        const intervalId = setInterval(() => {
            useDocumentStore.getState().fetchDocumentRequestMessages(requestId).catch(() => {});
            useDocumentStore.getState().fetchDocumentRequestAttachments(requestId).catch(() => {});
        }, 3000);

        return () => clearInterval(intervalId);
    }, [activeItem?.id, item?.id, isDocumentRequest, allDocuments.length, allDocumentVersions.length]);

    const documentVersions = useMemo(() => {
        if (!item || !isDocument) {
            return [];
        }

        const matchedVersions = allDocumentVersions.filter(
            (version) => version.document?.id === item.id || version.documentId === item.id
        );

        if (matchedVersions.length > 0) {
            return matchedVersions.sort(
                (versionA, versionB) => versionB.version - versionA.version
            );
        }

        const parsedVersion = item.version
            ? (parseInt(String(item.version).replace(/^v/i, '').split('.')[0], 10) || 1)
            : 1;

        return [
            {
                id:             `ver-${item.id}`,
                documentId:     item.id,
                version:        parsedVersion,
                sizeBytes:      item.sizeBytes ?? 1048576,
                classification: item.classification ?? constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED,
                changeSummary:  item.changeSummary ?? 'Initial document release.',
                summary:        item.summary ?? null,
                checksum:       item.checksum ?? 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                path:           item.path ?? `/records/${item.name ?? item.title ?? 'document.pdf'}`,
                createdAt:      item.createdAt ?? new Date().toISOString(),
            },
        ];
    }, [item, isDocument, allDocumentVersions]);

    const rootSharedFolder = useMemo(() => {
        return findRootSharedFolder(activeItem ?? item, allDocuments, allDocumentShares);
    }, [activeItem, item, allDocuments, allDocumentShares]);

    const documentShares = useMemo(() => {
        if (!item || (!isDocument && !isFolder)) {
            return [];
        }

        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
        const itemCleanId = cleanId(item.id);

        const direct = allDocumentShares.filter((share) => {
            const sDocId = cleanId(share.document?.id ?? share.documentId);
            return sDocId === itemCleanId;
        });

        if (rootSharedFolder) {
            const rootCleanId = cleanId(rootSharedFolder.id);
            const rootShares = allDocumentShares.filter((share) => {
                const sDocId = cleanId(share.document?.id ?? share.documentId);
                return sDocId === rootCleanId;
            });

            if (direct.length > 0 || rootShares.length > 0) {
                // Key shares by their target (department or member)
                // Direct shares on this document take precedence over inherited root shares
                const getShareKey = (s) => {
                    const deptId = cleanId(s.department?.id ?? s.departmentId ?? (typeof s.department === 'string' ? s.department : ''));
                    const recId = cleanId(s.recipientId ?? s.recipient?.id ?? (typeof s.recipient === 'string' ? s.recipient : ''));
                    return recId ? `user_${recId}_${deptId}` : `dept_${deptId}`;
                };

                const mergedMap = new Map();
                for (const rs of rootShares) {
                    const key = getShareKey(rs);
                    mergedMap.set(key, rs);
                }
                for (const ds of direct) {
                    const key = getShareKey(ds);
                    mergedMap.set(key, ds);
                }

                return Array.from(mergedMap.values());
            }
        }

        if (direct.length > 0) return direct;

        // If direct is empty, check if document is known in the store. If so, it has NO direct shares.
        // Check inherited shares from parent folder only.
        const docInStore = allDocuments.find((d) => cleanId(d.id) === itemCleanId);
        if (docInStore || allDocumentShares.length > 0) {
            let pId = (docInStore?.parentId ?? item.parentId ?? docInStore?.parentFolderId ?? item.parentFolderId);
            while (pId && pId !== 'root') {
                const pCleanId = cleanId(pId);
                const parentDoc = allDocuments.find((d) => cleanId(d.id) === pCleanId);
                if (!parentDoc) break;
                const parentShares = allDocumentShares.filter((s) => {
                    const sDocId = cleanId(s.document?.id ?? s.documentId);
                    return sDocId === pCleanId;
                });
                if (parentShares.length > 0) {
                    return parentShares;
                }
                pId = parentDoc.parentId ?? parentDoc.parentFolderId;
            }
            // Truly unshared! Return []
            return [];
        }

        if (Array.isArray(item.shares) && item.shares.length > 0) {
            return item.shares;
        }
        if (item.share) {
            return [item.share];
        }

        return [];
    }, [item, isDocument, isFolder, rootSharedFolder, allDocumentShares, allDocuments]);

    const departmentShares = useMemo(() => {
        if (isMember) return [];
        const list = documentShares.filter((s) => !s.recipientId && !s.recipient?.id && !s.recipient);
        if (isAdmin) return list;

        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
        const rawUserDept = activeUser?.departmentId ?? activeUser?.department?.id ?? activeUser?.department;
        const matchedUserDept = allDepartments.find((d) =>
            cleanId(d.id) === cleanId(rawUserDept) ||
            (typeof rawUserDept === 'string' && d.name?.toLowerCase() === rawUserDept.toLowerCase()) ||
            (typeof rawUserDept === 'string' && d.code?.toLowerCase() === rawUserDept.toLowerCase())
        );
        const userDeptCleanId = cleanId(matchedUserDept?.id ?? activeUser?.departmentId ?? activeUser?.department?.id);
        const userDeptCleanName = matchedUserDept?.name?.toLowerCase() ?? (typeof activeUser?.department === 'string' ? activeUser.department.toLowerCase() : null);

        if (!userDeptCleanId && !userDeptCleanName) return [];

        return list.filter((s) => {
            const rawSDept = s.department?.id ?? s.departmentId ?? (typeof s.department === 'string' ? s.department : null);
            const matchedSDept = allDepartments.find((d) =>
                cleanId(d.id) === cleanId(rawSDept) ||
                (typeof rawSDept === 'string' && d.name?.toLowerCase() === rawSDept.toLowerCase()) ||
                (typeof rawSDept === 'string' && d.code?.toLowerCase() === rawSDept.toLowerCase()) ||
                (s.department?.name && d.name?.toLowerCase() === s.department.name.toLowerCase())
            );
            const sDeptCleanId = cleanId(matchedSDept?.id ?? rawSDept);
            const sDeptCleanName = matchedSDept?.name?.toLowerCase() ?? s.department?.name?.toLowerCase();

            return Boolean(
                (userDeptCleanId && sDeptCleanId && userDeptCleanId === sDeptCleanId) ||
                (userDeptCleanName && sDeptCleanName && userDeptCleanName === sDeptCleanName)
            );
        });
    }, [documentShares, isAdmin, isMember, activeUser, allDepartments]);

    const userShares = useMemo(() => {
        if (isMember) return [];
        const list = documentShares.filter((s) => Boolean(s.recipientId || s.recipient?.id || s.recipient));
        if (isAdmin) return list;

        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
        const rawUserDept = activeUser?.departmentId ?? activeUser?.department?.id ?? activeUser?.department;
        const matchedUserDept = allDepartments.find((d) =>
            cleanId(d.id) === cleanId(rawUserDept) ||
            (typeof rawUserDept === 'string' && d.name?.toLowerCase() === rawUserDept.toLowerCase()) ||
            (typeof rawUserDept === 'string' && d.code?.toLowerCase() === rawUserDept.toLowerCase())
        );
        const userDeptCleanId = cleanId(matchedUserDept?.id ?? activeUser?.departmentId ?? activeUser?.department?.id);
        const userDeptCleanName = matchedUserDept?.name?.toLowerCase() ?? (typeof activeUser?.department === 'string' ? activeUser.department.toLowerCase() : null);

        if (!userDeptCleanId && !userDeptCleanName) return [];

        return list.filter((s) => {
            const rawSDept = s.department?.id ?? s.departmentId ?? (typeof s.department === 'string' ? s.department : null);
            let matchedSDept = allDepartments.find((d) =>
                cleanId(d.id) === cleanId(rawSDept) ||
                (typeof rawSDept === 'string' && d.name?.toLowerCase() === rawSDept.toLowerCase()) ||
                (typeof rawSDept === 'string' && d.code?.toLowerCase() === rawSDept.toLowerCase()) ||
                (s.department?.name && d.name?.toLowerCase() === s.department.name.toLowerCase())
            );

            if (!matchedSDept) {
                const recipientId = s.recipientId ?? s.recipient?.id;
                const recUser = allUsers.find((u) => u.id === recipientId);
                const recDeptId = recUser?.departmentId ?? recUser?.department?.id ?? recUser?.department;
                if (recDeptId) {
                    matchedSDept = allDepartments.find((d) =>
                        cleanId(d.id) === cleanId(recDeptId) ||
                        (typeof recDeptId === 'string' && d.name?.toLowerCase() === recDeptId.toLowerCase()) ||
                        (typeof recDeptId === 'string' && d.code?.toLowerCase() === recDeptId.toLowerCase())
                    );
                }
            }

            const sDeptCleanId = cleanId(matchedSDept?.id ?? rawSDept);
            const sDeptCleanName = matchedSDept?.name?.toLowerCase() ?? s.department?.name?.toLowerCase();

            return Boolean(
                (userDeptCleanId && sDeptCleanId && userDeptCleanId === sDeptCleanId) ||
                (userDeptCleanName && sDeptCleanName && userDeptCleanName === sDeptCleanName)
            );
        });
    }, [documentShares, isAdmin, isMember, activeUser, allDepartments, allUsers]);

    const pendingStatusRequest = useMemo(() => {
        if (!activeItem || !isDocumentRequest) return null;
        return allCoordinatorRequests.find(
            (cr) =>
                cr.status === constants.COORDINATOR_REQUESTS_STATUS.PENDING &&
                (cr.action === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_RESOLVE ||
                 cr.action === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_REJECT) &&
                String(cr.data?.documentRequestId ?? '') === String(activeItem.id)
        ) ?? null;
    }, [activeItem, isDocumentRequest, allCoordinatorRequests]);

    const canSeePendingStatus = useMemo(() => {
        if (!pendingStatusRequest) return false;
        return isAdmin || (isCoordinator && String(pendingStatusRequest.requesterId) === String(activeUser?.id));
    }, [pendingStatusRequest, isAdmin, isCoordinator, activeUser?.id]);

    const resolvePublisherName = (shareItem) => {
        const sharerId = shareItem.sharer?.id ?? shareItem.sharerId;
        let foundUser = null;

        if (sharerId) {
            foundUser = allUsers.find((u) => u.id === sharerId);
        }

        if (!foundUser && shareItem.publisherId) {
            foundUser = allUsers.find((u) => u.id === shareItem.publisherId);
        }

        if (!foundUser && (shareItem.sharer?.firstName || shareItem.sharer?.lastName)) {
            const name = `${shareItem.sharer.firstName || ''} ${shareItem.sharer.lastName || ''}`.trim();
            if (name) return name;
        }

        // Check latest document version publisher or uploader
        if (!foundUser) {
            const docVersions = allDocumentVersions.filter(
                (v) => (v.document?.id ?? v.documentId) === item?.id
            );
            const latestVer = [...docVersions].sort(
                (a, b) => (b.versionNumber ?? b.version ?? 0) - (a.versionNumber ?? a.version ?? 0)
            )[0];
            const pubId = latestVer?.publisher?.id ?? latestVer?.publisherId ?? latestVer?.uploader?.id ?? latestVer?.uploaderId;
            if (pubId) {
                foundUser = allUsers.find((u) => u.id === pubId);
            }
        }

        // Check item publisher or uploader
        if (!foundUser && item?.publisherId) {
            foundUser = allUsers.find((u) => u.id === item.publisherId);
        }
        if (!foundUser && item?.uploaderId) {
            foundUser = allUsers.find((u) => u.id === item.uploaderId);
        }

        if (foundUser) {
            const fullName = `${foundUser.firstName || ''} ${foundUser.lastName || ''}`.trim();
            return fullName || foundUser.name || foundUser.email || 'Staff';
        }

        if (isDirector && activeUser) {
            const myName = `${activeUser.firstName || ''} ${activeUser.lastName || ''}`.trim();
            return myName || 'Director';
        }

        return isDirector ? 'Director' : 'Staff';
    };

    const getFolderChildren = useMemo(() => {
        return (folderId) => {
            const children = allDocuments.filter(
                (doc) => (doc.parent?.id ?? doc.parentId) === folderId
            );
            return children.map((child) => {
                const childVersions = allDocumentVersions.filter(
                    (v) => (v.document?.id ?? v.documentId) === child.id
                );
                const sortedVersions = [...childVersions].sort(
                    (a, b) => (b.versionNumber ?? b.version ?? 0) - (a.versionNumber ?? a.version ?? 0)
                );
                const latestChildVersion = sortedVersions[0];
                const childContentCount = child.isFolder
                    ? allDocuments.filter((d) => (d.parent?.id ?? d.parentId) === child.id).length
                    : undefined;
                return {
                    ...child,
                    version: child.version ?? (latestChildVersion ? `v${latestChildVersion.versionNumber ?? latestChildVersion.version ?? 1}.0` : undefined),
                    summary: child.isFolder ? null : (child.summary ?? latestChildVersion?.summary ?? null),
                    comment: child.comment ?? null,
                    classification: child.isFolder ? null : (child.classification ?? latestChildVersion?.classification ?? null),
                    path: latestChildVersion?.path ?? child.path ?? null,
                    childContentCount,
                };
            });
        };
    }, [allDocuments, allDocumentVersions]);

    const folderContents = useMemo(() => {
        if (!item || !isFolder) {
            return [];
        }
        return getFolderChildren(item.id);
    }, [item, isFolder, getFolderChildren]);

    const selectedTreeItem = useMemo(() => {
        if (!selectedTreeItemId) return null;
        const found = allDocuments.find((d) => d.id === selectedTreeItemId);
        if (!found) return null;
        const matchedVersions = allDocumentVersions.filter(
            (v) => (v.document?.id ?? v.documentId) === found.id
        );
        const sortedVersions = [...matchedVersions].sort(
            (a, b) => (b.versionNumber ?? b.version ?? 0) - (a.versionNumber ?? a.version ?? 0)
        );
        const latest = sortedVersions[0];
        return {
            ...found,
            summary: found.isFolder ? null : (found.summary ?? latest?.summary ?? null),
            comment: found.comment ?? null,
            version: found.isFolder ? null : (found.version ?? (latest ? `v${latest.versionNumber ?? latest.version ?? 1}.0` : undefined)),
        };
    }, [selectedTreeItemId, allDocuments, allDocumentVersions]);

    const userActivities = useMemo(() => {
        if (!item || !isUser) {
            return [];
        }

        return allAuditLogs
            .filter((log) => log.actor?.id === item.id || log.actorId === item.id)
            .sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0));
    }, [item, isUser, allAuditLogs]);

    const departmentFaculty = useMemo(() => {
        if (!activeItem || !isDepartment) {
            return [];
        }

        return allUsers.filter(
            (userItem) =>
                userItem.departmentId === activeItem.id ||
                userItem.department === activeItem.name ||
                userItem.department === activeItem.title
        );
    }, [activeItem, isDepartment, allUsers]);

    const requestMessages = useMemo(() => {
        if (!item || !isDocumentRequest) {
            return [];
        }

        const messages = allRequestMessages.filter((message) => {
            const msgReqId = typeof message.documentRequest === 'object'
                ? message.documentRequest?.id
                : (message.documentRequestId ?? message.documentRequest);
            return msgReqId === item.id;
        });

        if (messages.length > 0) {
            return messages.sort(
                (messageA, messageB) =>
                    new Date(messageA.createdAt) - new Date(messageB.createdAt)
            );
        }

        if (item.messages && item.messages.length > 0) {
            return item.messages;
        }

        return [];
    }, [item, isDocumentRequest, allRequestMessages]);

    const effectiveRejectionReason = useMemo(() => {
        const directReason = activeItem?.rejectionReason || item?.rejectionReason;
        if (directReason) return directReason;

        if (isDocumentRequest) {
            const rejectionMsg = [...requestMessages]
                .reverse()
                .find((m) => m.message && (
                    m.message.startsWith('Rejection Note:') ||
                    m.message.includes('<!-- rejection_reason:') ||
                    m.message.toLowerCase().includes('rejection reason:')
                ));
            if (rejectionMsg) {
                const text = rejectionMsg.message;
                if (text.startsWith('Rejection Note:')) {
                    return text.replace(/^Rejection Note:\s*/, '').trim();
                }
                const tagMatch = text.match(/<!-- rejection_reason:(.*?) -->/);
                if (tagMatch) {
                    return tagMatch[1].trim();
                }
                return text;
            }
        }
        return null;
    }, [activeItem?.rejectionReason, item?.rejectionReason, isDocumentRequest, requestMessages]);

    const pendingAttachRequests = useMemo(() => {
        if (!item || !isDocumentRequest) return [];
        const activeId = activeUser?.id;
        // PRIVACY GUARD: Only Admin or the submitting Coordinator can view pending attach requests!
        if (!isAdmin && !isCoordinator) return [];

        return allCoordinatorRequests.filter((req) => {
            if (!req || req.status !== constants.COORDINATOR_REQUESTS_STATUS.PENDING) return false;
            if (
                req.action !== constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_ATTACH &&
                req.action !== constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_ATTACH
            ) return false;

            const reqId = typeof req.requester === 'object' ? req.requester?.id : (req.requesterId ?? req.requester);
            if (!isAdmin && String(reqId) !== String(activeId)) return false;

            const payloadData = typeof req.data === 'string' ? JSON.parse(req.data || '{}') : (req.data || {});
            const targetDocReqId = payloadData.documentRequestId ?? payloadData.id;
            return String(targetDocReqId) === String(item.id);
        });
    }, [item, isDocumentRequest, allCoordinatorRequests, isAdmin, isCoordinator, activeUser?.id]);

    const combinedThreadItems = useMemo(() => {
        if (!isDocumentRequest) return [];
        const messageItems = requestMessages.map((msg) => ({
            type: 'message',
            id: msg.id,
            createdAt: msg.createdAt,
            data: msg,
        }));

        const pendingItems = pendingAttachRequests.map((req) => ({
            type: 'pending_attach',
            id: `pending-${req.id}`,
            createdAt: req.createdAt,
            data: req,
        }));

        return [...messageItems, ...pendingItems].sort((a, b) => {
            const timeA = new Date(a.createdAt || 0).getTime();
            const timeB = new Date(b.createdAt || 0).getTime();
            return timeA - timeB;
        });
    }, [isDocumentRequest, requestMessages, pendingAttachRequests]);

    const requestAttachments = useMemo(() => {
        if (!item || !isDocumentRequest) {
            return [];
        }

        const attachments = allRequestAttachments.filter((attachment) => {
            const attReqId = typeof attachment.documentRequest === 'object'
                ? attachment.documentRequest?.id
                : (attachment.documentRequestId ?? attachment.documentRequest);
            return attReqId === item.id;
        });

        const list = attachments.length > 0 ? attachments : (item.attachments ?? []);

        return list.map((att) => {
            const targetDocId = att.documentId ?? att.document?.id ?? att.id;
            const matchedDoc = allDocuments.find((d) => d.id === targetDocId);
            const docVers = allDocumentVersions.filter(
                (v) => (v.document?.id ?? v.documentId) === targetDocId
            );
            const latestVer = docVers.length > 0
                ? [...docVers].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0]
                : null;

            return {
                ...att,
                documentId: targetDocId,
                document: matchedDoc ?? att.document ?? (targetDocId ? { id: targetDocId } : null),
                name: att.name ?? matchedDoc?.name ?? 'Attachment',
                path: att.path ?? latestVer?.path ?? matchedDoc?.path,
                sizeBytes: att.sizeBytes ?? latestVer?.sizeBytes ?? matchedDoc?.sizeBytes,
                mimeType: att.mimeType ?? latestVer?.mimeType ?? matchedDoc?.mimeType,
            };
        });
    }, [item, isDocumentRequest, allRequestAttachments, allDocuments, allDocumentVersions]);

    const tabOptions = useMemo(() => {
        if (isDocumentRequest) {
            return [
                { value: 'information', label: 'Information', icon: Info },
                { value: 'messages',    label: `Message (${requestMessages.length})`, icon: MessageSquare },
                { value: 'attachments', label: `Attachments (${requestAttachments.length})`, icon: Paperclip },
            ];
        }

        if (isCoordinatorRequest) {
            return [
                { value: 'information', label: 'Information', icon: Info },
                { value: 'payload',     label: 'Payload', icon: Layers },
            ];
        }

        const visibleSharesCount = departmentShares.length + userShares.length;

        if (isDocument) {
            return [
                { value: 'information', label: 'Information', icon: Info },
                { value: 'version',     label: `Version (${documentVersions.length})`, icon: Layers },
                ...(!isMember ? [{ value: 'share', label: `Shares (${visibleSharesCount})`, icon: Share2 }] : []),
            ];
        }

        if (isFolder) {
            return [
                { value: 'information', label: 'Information', icon: Info },
                { value: 'content',     label: `Content (${folderContents.length})`, icon: Folder },
                ...(!isMember ? [{ value: 'share', label: `Shares (${visibleSharesCount})`, icon: Share2 }] : []),
            ];
        }

        if (isUser) {
            return [
                { value: 'information', label: 'Information', icon: User },
                { value: 'activity',    label: `Activity (${userActivities.length})`, icon: Clock },
            ];
        }

        if (isDepartment) {
            return [
                { value: 'information', label: 'Information', icon: Building2 },
                { value: 'faculty',      label: `User (${departmentFaculty.length})`, icon: Users },
            ];
        }

        return [{ value: 'information', label: 'Information', icon: Info }];
    }, [
        isDocumentRequest,
        isCoordinatorRequest,
        isDocument,
        isFolder,
        isUser,
        isDepartment,
        isMember,
        requestMessages.length,
        requestAttachments.length,
        documentVersions.length,
        departmentShares.length,
        userShares.length,
        folderContents.length,
        userActivities.length,
        departmentFaculty.length,
    ]);

    useEffect(() => {
        if (tabOptions.length > 0 && !tabOptions.some((opt) => opt.value === activeTab)) {
            const fallback = tabOptions[0]?.value || 'information';
            queueMicrotask(() => {
                setActiveTab(fallback);
                onTabChange?.(fallback);
            });
        }
    }, [tabOptions, activeTab, onTabChange]);

    const attachableDocuments = useMemo(() => {
        let list = (allDocuments || [])
            .filter((doc) => !doc.isFolder && !doc.isArchived)
            .map((doc) => {
                const vers = (allDocumentVersions || []).filter(
                    (v) => (v.document?.id ?? v.documentId) === doc.id
                );
                const latestVer = vers.length > 0
                    ? [...vers].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0]
                    : null;
                const classification = latestVer?.classification || doc.classification || constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED;
                return {
                    ...doc,
                    _latestVer: latestVer,
                    classification,
                };
            });

        // 1. Classification filter
        if (attachClassFilter && attachClassFilter !== 'all') {
            list = list.filter((doc) => String(doc.classification || '').toUpperCase() === attachClassFilter.toUpperCase());
        }

        // 2. Sorting comparator
        const sortComparator = (a, b) => {
            switch (attachSortBy) {
                case 'name-asc':
                    return (a.name || '').localeCompare(b.name || '');
                case 'name-desc':
                    return (b.name || '').localeCompare(a.name || '');
                case 'date-desc':
                    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
                case 'date-asc':
                    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                case 'mimetype-asc': {
                    const extA = (a.name || '').split('.').pop()?.toLowerCase() || '';
                    const extB = (b.name || '').split('.').pop()?.toLowerCase() || '';
                    return extA.localeCompare(extB);
                }
                case 'mimetype-desc': {
                    const extA = (a.name || '').split('.').pop()?.toLowerCase() || '';
                    const extB = (b.name || '').split('.').pop()?.toLowerCase() || '';
                    return extB.localeCompare(extA);
                }
                default:
                    return 0;
            }
        };

        if (!attachSearchTerm.trim()) {
            return list.sort(sortComparator);
        }

        const query = attachSearchTerm.toLowerCase().trim();
        const tokens = query.split(/\s+/).filter(Boolean);

        return list
            .map((doc) => {
                const nameLower = (doc.name || '').toLowerCase();
                const titleLower = (doc.title || '').toLowerCase();
                const summaryLower = (doc._latestVer?.summary || '').toLowerCase();
                const changeLower = (doc._latestVer?.changeSummary || '').toLowerCase();
                const classLower = (doc.classification || '').toLowerCase();
                const semInfo = attachSearchTerm.trim().length >= 3 ? semanticScoreMap[doc.id] : null;

                let score = 0;
                let matchType = null;
                let matchSnippet = null;

                // 1. Direct name/title match
                if (nameLower.includes(query) || titleLower.includes(query)) {
                    score += 100;
                    matchType = 'name';
                } else {
                    const nameTokens = tokens.filter((t) => nameLower.includes(t) || titleLower.includes(t));
                    if (nameTokens.length > 0) {
                        score += nameTokens.length * 25;
                        matchType = 'name';
                    }
                }

                // 2. Content / Summary search (Search from content of the file!)
                if (summaryLower.includes(query)) {
                    score += 60;
                    matchType = matchType || 'content';
                    const idx = summaryLower.indexOf(query);
                    const start = Math.max(0, idx - 25);
                    const end = Math.min(doc._latestVer.summary.length, idx + query.length + 50);
                    matchSnippet = '...' + doc._latestVer.summary.slice(start, end).trim() + '...';
                } else {
                    const summaryTokens = tokens.filter((t) => summaryLower.includes(t));
                    if (summaryTokens.length > 0) {
                        score += summaryTokens.length * 20;
                        matchType = matchType || 'content';
                        matchSnippet = doc._latestVer?.summary?.slice(0, 90) + '...';
                    }
                }

                if (changeLower.includes(query)) {
                    score += 30;
                    matchType = matchType || 'content';
                }

                if (classLower.includes(query)) {
                    score += 15;
                }

                if (semInfo?.similarity) {
                    score += Math.round(semInfo.similarity * 70);
                    matchType = matchType || 'semantic';
                    if (!matchSnippet && semInfo.summarySnippet) {
                        matchSnippet = semInfo.summarySnippet;
                    }
                }

                return {
                    ...doc,
                    _relevanceScore: score,
                    _matchType: matchType,
                    _matchSnippet: matchSnippet,
                    _semanticInfo: semInfo,
                };
            })
            .filter((doc) => doc._relevanceScore > 0)
            .sort((a, b) => (b._relevanceScore - a._relevanceScore) || sortComparator(a, b));
    }, [allDocuments, allDocumentVersions, attachSearchTerm, semanticScoreMap, attachClassFilter, attachSortBy]);

    const inspectorDeptOptions = useMemo(() => {
        return allDepartments.map((d) => ({
            value: d.id,
            label: `${d.name} (${d.code})`,
        }));
    }, [allDepartments]);

    const inspectorRoleOptions = useMemo(() => [
        { value: constants.USERS_ROLE.ADMINISTRATOR, label: constants.USERS_ROLE.ADMINISTRATOR },
        { value: constants.USERS_ROLE.COORDINATOR, label: constants.USERS_ROLE.COORDINATOR },
        { value: constants.USERS_ROLE.DIRECTOR, label: constants.USERS_ROLE.DIRECTOR },
        { value: constants.USERS_ROLE.OFFICER, label: constants.USERS_ROLE.OFFICER },
        { value: constants.USERS_ROLE.MEMBER, label: constants.USERS_ROLE.MEMBER },
    ], []);

    const rmoDepartment = useMemo(() => {
        return allDepartments.find((d) =>
            d?.id === RMO_DEPARTMENT_ID ||
            d?.id === RMO_DEPARTMENT_RAW ||
            d?.code?.toUpperCase() === 'RMO' ||
            d?.name?.toLowerCase().includes('records management')
        ) ?? null;
    }, [allDepartments]);

    const resolvedRmoId = rmoDepartment?.id ?? RMO_DEPARTMENT_ID;
    const isRoleLockedToRMO = userFormRole === constants.USERS_ROLE.ADMINISTRATOR || userFormRole === constants.USERS_ROLE.COORDINATOR;

    const handleInspectorRoleChange = (newRole) => {
        setUserFormRole(newRole);
        if (newRole === constants.USERS_ROLE.ADMINISTRATOR || newRole === constants.USERS_ROLE.COORDINATOR) {
            setUserFormDepartmentId(resolvedRmoId);
        }
    };

    // HANDLERS
    const handleCopyText = (textToCopy, propertyKey) => {
        if (!textToCopy) {
            return;
        }

        navigator.clipboard.writeText(textToCopy);
        setCopiedPropertyKey(propertyKey);
        showToast({
            title:       'Copied to Clipboard',
            description: `${textToCopy} copied.`,
            variant:     'information',
        });

        setTimeout(() => {
            setCopiedPropertyKey(null);
        }, 2000);
    };

    const handleActionClick = async (actionKey, actionItem = null) => {
        const target = actionItem ?? (Array.isArray(selectedItems) && selectedItems.length > 0 ? selectedItems : (activeItem ?? item));
        if (!target || activeActionLoading) {
            return;
        }

        const targetItem = target;
        const shouldSkipLoading = actionKey === 'archive' && targetItem?.isFolder;

        if (!shouldSkipLoading) {
            setActiveActionLoading(actionKey);
        }
        try {
            await onAction?.(actionKey, targetItem);
            if (item?.id && (isDocument || isFolder)) {
                useDocumentStore.getState().fetchDocumentShares(item.id).catch(() => {});
                useDocumentStore.getState().fetchDocumentVersions(item.id).catch(() => {});
            }
        } finally {
            if (!shouldSkipLoading) {
                setActiveActionLoading(null);
            }
        }
    };

    const handleOpenRejectCoordinatorModal = (req) => {
        setRejectingCoordinatorReq(req);
        setCoordinatorRejectReason('');
    };

    const handleCloseRejectCoordinatorModal = () => {
        if (isSubmittingCoordinatorReject) return;
        setRejectingCoordinatorReq(null);
        setCoordinatorRejectReason('');
    };

    const handleConfirmRejectCoordinatorReq = async () => {
        if (!rejectingCoordinatorReq) return;
        setIsSubmittingCoordinatorReject(true);
        try {
            await coordinatorApprovalService.rejectCoordinatorRequest({
                ...rejectingCoordinatorReq,
                rejectionReason: coordinatorRejectReason.trim() || undefined,
            }, activeUser);
            await useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});
            showToast({
                type: 'warning',
                title: 'Request Rejected',
                description: 'Coordinator request was rejected.',
            });
            handleCloseRejectCoordinatorModal();
        } catch (err) {
            showToast({
                type: 'error',
                title: 'Rejection Failed',
                description: err?.message ?? 'Could not reject request.',
            });
        } finally {
            setIsSubmittingCoordinatorReject(false);
        }
    };

    const handleConfirmInspectorAction = async () => {
        if (!inspectorConfirmAction) return;
        const { actionKey, targetItem } = inspectorConfirmAction;
        try {
            await handleActionClick(actionKey, targetItem);
            setInspectorConfirmAction(null);
            if (actionKey === 'restore' || actionKey === 'archive' || actionKey === 'delete') {
                onClearSelection?.();
            }
        } catch (err) {
            console.error(`Failed inspector action ${actionKey}:`, err);
        }
    };

    const handleConfirmInspectorRejection = async () => {
        if (!inspectorRejectModal) return;
        const reason = inspectorRejectReason.trim();
        if (!reason) {
            showToast({
                type: 'warning',
                title: 'Rejection Reason Required',
                description: 'Please provide a reason for rejecting this document.',
            });
            return;
        }
        try {
            const target = inspectorRejectModal.targetItem || item;
            const targetWithReason = Array.isArray(target)
                ? target.map((it) => ({ ...it, rejectionReason: reason }))
                : { ...target, rejectionReason: reason };
            await handleActionClick('reject', targetWithReason);
            setInspectorRejectModal(null);
            setInspectorRejectReason('');
        } catch (err) {
            console.error('Failed inspector rejection:', err);
        }
    };

    const handleConfirmReshare = async () => {
        if (!reshareModal || !reshareFile) {
            showToast({
                type: 'warning',
                title: 'File Required',
                description: 'Please select a replacement file to upload.',
            });
            return;
        }
        setIsSubmittingReshare(true);
        try {
            const uploaderId = activeUser?.id;
            if (reshareModal.mode === 'new_version') {
                await useDocumentStore.getState().reshareNewVersion(
                    reshareModal.docId,
                    reshareModal.shareItem.id,
                    reshareFile,
                    uploaderId,
                    reshareChangeSummary.trim() || 'Revision addressing rejection feedback'
                );
                showToast({
                    type: 'success',
                    title: 'Document Reshared as New Version',
                    description: `Created revision for ${reshareModal.targetDeptName} and reset status to Pending Approval.`,
                });
            } else {
                await useDocumentStore.getState().overwriteVersionFileAndReshare(
                    reshareModal.docId,
                    reshareModal.shareItem.id,
                    reshareFile,
                    uploaderId
                );
                showToast({
                    type: 'success',
                    title: 'Document Overwritten & Reshared',
                    description: `Replaced current version file for ${reshareModal.targetDeptName} and reset status to Pending Approval.`,
                });
            }
            await useDocumentStore.getState().fetchDocumentShares(reshareModal.docId).catch(() => {});
            await useDocumentStore.getState().fetchDocumentVersions(reshareModal.docId).catch(() => {});
            await useDocumentStore.getState().fetchDocuments().catch(() => {});
            if (activeUser) {
                useDocumentStore.getState().syncAllDocumentShares(activeUser, allDepartments, true).catch(() => {});
            }
            setReshareModal(null);
            setReshareFile(null);
            setReshareChangeSummary('');
        } catch (err) {
            console.error('Failed to reshare document:', err);
            showToast({
                type: 'error',
                title: 'Reshare Failed',
                description: err?.message || 'Could not complete reshare operation.',
            });
        } finally {
            setIsSubmittingReshare(false);
        }
    };

    const handleOpenEditDepartment = () => {
        setDeptFormCode(activeItem?.code ?? '');
        setDeptFormName(activeItem?.name ?? activeItem?.title ?? '');
        setDeptFormErrors({});
        setIsEditDepartmentModalOpen(true);
    };

    const handleSaveEditDepartment = async () => {
        const errors = {};
        if (!deptFormCode.trim()) errors.code = 'Code is required.';
        if (!deptFormName.trim()) errors.name = 'Name is required.';

        if (Object.keys(errors).length > 0) {
            setDeptFormErrors(errors);
            return;
        }

        setIsSavingEditDepartment(true);
        setDeptFormErrors({});
        try {
            if (isCoordinator) {
                const deptPayload = {
                    departmentId: activeItem.id,
                    old: {
                        code: activeItem.code,
                        name: activeItem.name || activeItem.title,
                    },
                    new: {
                        code: deptFormCode.trim().toUpperCase(),
                        name: deptFormName.trim(),
                    },
                };

                const requesterId = activeUser?.id ?? useAuthStore.getState().currentUser?.id;
                await coordinatorApprovalService.submitCoordinatorRequest({
                    action: constants.COORDINATOR_REQUESTS_ACTION.DEPARTMENT_UPDATE,
                    requesterId,
                    data: deptPayload,
                });
                useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});

                showToast({
                    type: 'success',
                    title: 'Request Submitted',
                    description: `Department update request for "${deptFormCode.toUpperCase()}" sent for Administrator approval.`,
                });
                setIsEditDepartmentModalOpen(false);
                return;
            }

            const minTimer = new Promise((resolve) => setTimeout(resolve, 500));
            const [updated] = await Promise.all([
                useDepartmentStore.getState().updateDepartment(activeItem.id, {
                    code: deptFormCode.trim().toUpperCase(),
                    name: deptFormName.trim(),
                }, activeUser),
                minTimer,
            ]);

            showToast({
                type: 'success',
                title: 'Department Updated',
                description: `Department details updated for ${deptFormCode.toUpperCase()}.`,
            });
            setIsEditDepartmentModalOpen(false);
            onAction?.('edit_department_success', updated);
        } catch (error) {
            setDeptFormErrors({ code: error?.message ?? 'Failed to update department.' });
        } finally {
            setIsSavingEditDepartment(false);
        }
    };

    const handleOpenDeleteDepartment = () => {
        handleActionClick('delete', activeItem);
    };

    const handleOpenEditUser = () => {
        const u = activeUserRecord ?? item;
        const rawRole = u?.role ?? constants.USERS_ROLE.MEMBER;
        // Guard: admins cannot edit other administrators (only themselves)
        const isTargetAdmin = rawRole === constants.USERS_ROLE.ADMINISTRATOR;
        if (isTargetAdmin && !isSelfUser && isAdmin) {
            showToast({
                type: 'error',
                title: 'Action Not Permitted',
                description: 'Administrators cannot edit other administrator accounts.',
            });
            return;
        }
        const isLocked = rawRole === constants.USERS_ROLE.ADMINISTRATOR || rawRole === constants.USERS_ROLE.COORDINATOR;
        setUserFormFirstName(u?.firstName ?? '');
        setUserFormMiddleName(u?.middleName ?? '');
        setUserFormLastName(u?.lastName ?? '');
        setUserFormEmail(u?.email ? u.email.replace(/@.*$/, '') : '');
        setUserFormRole(rawRole);
        setUserFormDepartmentId(isLocked ? resolvedRmoId : (u?.departmentId ?? allDepartments[0]?.id ?? ''));
        setUserFormAvatarPath(u?.avatarPath ?? null);
        setUserFormAvatarFile(null);
        setUserFormErrors({});
        setIsEditUserModalOpen(true);
    };

    const handleSaveEditUser = async () => {
        const u = activeUserRecord ?? item;
        const errors = {};
        if (!userFormFirstName.trim()) errors.firstName = 'First name is required.';
        if (!userFormLastName.trim()) errors.lastName = 'Last name is required.';

        const rawUsername = userFormEmail.trim().toLowerCase().replace(/@.*$/, '');
        const cleanEmail = rawUsername ? `${rawUsername}${constants.INSTITUTIONAL_CONFIGURATION.EMAIL_DOMAIN}` : '';

        if (!cleanEmail) {
            errors.email = 'Email username is required.';
        } else if (!cleanEmail.endsWith(constants.INSTITUTIONAL_CONFIGURATION.EMAIL_DOMAIN)) {
            errors.email = `Must end with ${constants.INSTITUTIONAL_CONFIGURATION.EMAIL_DOMAIN}`;
        } else if (!constants.VALIDATION_PATTERNS.EMAIL.test(cleanEmail)) {
            errors.email = 'Invalid email address.';
        }

        if (!userFormRole) errors.role = 'Role is required.';

        const finalDepartmentId = (userFormRole === constants.USERS_ROLE.ADMINISTRATOR || userFormRole === constants.USERS_ROLE.COORDINATOR)
            ? resolvedRmoId
            : userFormDepartmentId;

        if (!finalDepartmentId) errors.departmentId = 'Department is required.';

        if (Object.keys(errors).length > 0) {
            setUserFormErrors(errors);
            return;
        }

        setIsSavingEditUser(true);
        setUserFormErrors({});
        try {
            let uploadedAvatarPath = userFormAvatarPath;
            if (userFormAvatarFile && u?.id) {
                const uploadResult = await storageService.uploadAvatar(u.id, userFormAvatarFile);
                uploadedAvatarPath = uploadResult.path;
            }

            if (isCoordinator) {
                const userPayload = {
                    userId: u.id,
                    old: {
                        firstName: u.firstName,
                        middleName: u.middleName,
                        lastName: u.lastName,
                        email: u.email,
                        role: u.role,
                        departmentId: u.departmentId,
                    },
                    new: {
                        firstName: userFormFirstName.trim(),
                        middleName: userFormMiddleName.trim() || null,
                        lastName: userFormLastName.trim(),
                        email: cleanEmail,
                        departmentId: finalDepartmentId,
                        role: userFormRole,
                        avatarPath: uploadedAvatarPath,
                    },
                };

                const requesterId = activeUser?.id ?? useAuthStore.getState().currentUser?.id;
                await coordinatorApprovalService.submitCoordinatorRequest({
                    action: constants.COORDINATOR_REQUESTS_ACTION.USER_UPDATE,
                    requesterId,
                    data: userPayload,
                });
                useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});

                showToast({
                    type: 'success',
                    title: 'Request Submitted',
                    description: `Profile update request for "${u.universityId}" sent for Administrator approval.`,
                });
                setIsEditUserModalOpen(false);
                setUserFormAvatarFile(null);
                return;
            }

            const minTimer = new Promise((resolve) => setTimeout(resolve, 500));
            const [updated] = await Promise.all([
                useUserStore.getState().updateUser(u.id, {
                    firstName: userFormFirstName.trim(),
                    middleName: userFormMiddleName.trim() || null,
                    lastName: userFormLastName.trim(),
                    email: cleanEmail,
                    departmentId: finalDepartmentId,
                    role: userFormRole,
                    avatarPath: uploadedAvatarPath,
                }),
                minTimer,
            ]);

            showToast({
                type: 'success',
                title: 'User Profile Updated',
                description: `Updated profile for ${updated.universityId || u.universityId}.`,
            });
            setIsEditUserModalOpen(false);
            setUserFormAvatarFile(null);
            onAction?.('edit_user_success', updated);
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to update user.';
            setUserFormErrors({ general: errorMessage });
            showToast({
                type: 'error',
                title: 'Update Failed',
                description: errorMessage,
            });
        } finally {
            setIsSavingEditUser(false);
        }
    };

    const handleOpenSuspendUser = () => {
        handleActionClick('suspend', activeUserRecord ?? item);
    };

    const handleOpenAttachModal = () => {
        if (allDocuments.length === 0) {
            useDocumentStore.getState().fetchDocuments().catch(() => {});
        }
        if ((allDocumentVersions || []).length === 0) {
            useDocumentStore.getState().fetchAllDocumentVersions().catch(() => {});
        }
        setIsAttachModalOpen(true);
        setAttachSearchTerm('');
        setSemanticScoreMap({});
        setIsSemanticSearching(false);
    };

    const handleCloseAttachModal = () => {
        setIsAttachModalOpen(false);
        setAttachSearchTerm('');
        setSemanticScoreMap({});
        setIsSemanticSearching(false);
    };

    const handleSelectDocumentToAttach = (selectedDocument) => {
        const docId = selectedDocument.id;
        setStagedAttachments((prev) => {
            if (prev.some((item) => item.documentId === docId)) {
                return prev.filter((item) => item.documentId !== docId);
            }
            return [
                ...prev,
                {
                    documentId: docId,
                    name:       selectedDocument.name || selectedDocument.title,
                    sizeBytes:  selectedDocument.sizeBytes ?? selectedDocument.size,
                },
            ];
        });
    };

    const handleRemoveStagedAttachment = (documentId) => {
        setStagedAttachments((prev) => prev.filter((item) => item.documentId !== documentId));
    };

    const adjustChatTextareaHeight = () => {
        const textarea = chatTextareaRef.current;
        if (!textarea) return;
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        const maxHeight = 120; // roughly 5 lines (~24px per line)
        textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
        textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    };

    useEffect(() => {
        adjustChatTextareaHeight();
    }, [chatInputText]);

    useEffect(() => {
        if (activeTab === 'messages' && isDocumentRequest) {
            chatEndReference.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [activeTab, isDocumentRequest, requestMessages.length]);

    const handleChatKeyDown = (e) => {
        // Shift + Tab => insert new line
        if (e.key === 'Tab' && e.shiftKey) {
            e.preventDefault();
            const textarea = e.target;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const value = textarea.value;
            const nextValue = value.substring(0, start) + '\n' + value.substring(end);
            setChatInputText(nextValue);
            setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = start + 1;
                adjustChatTextareaHeight();
            }, 0);
            return;
        }

        // Shift + Enter => allow default multiline
        if (e.key === 'Enter' && e.shiftKey) {
            return;
        }

        // Enter without Shift => send message
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(e);
        }
    };

    const handleSendMessage = async (formEvent) => {
        if (formEvent) formEvent.preventDefault();
        const targetRequestId = activeItem?.id ?? item?.id;
        if ((!chatInputText.trim() && stagedAttachments.length === 0) || !targetRequestId) {
            return;
        }

        const currentReqStatus = String(activeItem?.status ?? item?.status ?? '').toUpperCase().trim();
        const isRequestLocked = isDocumentRequest && (
            currentReqStatus === constants.DOCUMENT_REQUESTS_STATUS.RESOLVED ||
            currentReqStatus === constants.DOCUMENT_REQUESTS_STATUS.REJECTED ||
            currentReqStatus.includes('RESOLV') ||
            currentReqStatus.includes('REJECT')
        );

        if (isRequestLocked) {
            showToast({
                title: 'Thread Locked',
                description: 'This document request has been closed and cannot be reopened.',
                variant: 'warning',
            });
            return;
        }

        const activeUserId = activeUser?.id;
        if (!activeUserId) {
            showToast({
                title: 'Authentication Error',
                description: 'You must be signed in to post a message.',
                variant: 'error',
            });
            return;
        }

        const currentStaged = [...stagedAttachments];
        const messageText =
            chatInputText.trim() ||
            (currentStaged.length > 0
                ? `Shared ${currentStaged.length === 1 ? currentStaged[0].name : `${currentStaged.length} documents`}`
                : '');

        setChatInputText('');
        setStagedAttachments([]);
        if (chatTextareaRef.current) {
            chatTextareaRef.current.style.height = 'auto';
        }

        if (isCoordinator && currentStaged.length > 0) {
            try {
                const userNote = chatInputText.trim();
                const attachPayload = {
                    documentRequestId: targetRequestId,
                    documentRequestSubject: activeItem?.subject || activeItem?.title || item?.subject || item?.title || 'Document Request',
                    message: messageText,
                    userMessage: userNote,
                    hasExtraMessage: Boolean(userNote),
                    attachments: currentStaged,
                };

                const requesterId = activeUserId ?? useAuthStore.getState().currentUser?.id;
                await coordinatorApprovalService.submitCoordinatorRequest({
                    action: constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_ATTACH,
                    requesterId,
                    data: attachPayload,
                });
                useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});

                showToast({
                    title: 'Attachment Request Submitted',
                    description: `Attached ${currentStaged.length} file${currentStaged.length === 1 ? '' : 's'} and accompanying message queued for Administrator approval.`,
                    variant: 'success',
                });
                return;
            } catch (error) {
                showToast({
                    title: 'Request Failed',
                    description: error?.message ?? 'Could not queue attachment for approval.',
                    variant: 'error',
                });
                return;
            }
        }

        try {
            if (currentStaged.length > 0) {
                for (const att of currentStaged) {
                    await attachDocumentToRequest({
                        documentRequestId: targetRequestId,
                        documentId:        att.documentId,
                        attachedById:      activeUserId,
                        name:              att.name,
                    });
                }
            }

            const attachedDocIds = currentStaged.map((att) => att.documentId ?? att.id).filter(Boolean);
            const metaTag = attachedDocIds.length > 0
                ? `<!-- attachments:[${attachedDocIds.join(',')}] --> <!-- att_names:[${currentStaged.map((s) => encodeURIComponent(s.name || '')).join(',')}] -->`
                : '';
            const fullMessageText = metaTag ? `${messageText} ${metaTag}` : messageText;

            await addRequestMessage({
                documentRequestId: targetRequestId,
                userId:            activeUserId,
                message:           fullMessageText,
            });

            // Immediate fetch to synchronize server state
            useDocumentStore.getState().fetchDocumentRequestMessages(targetRequestId).catch(() => {});
            useDocumentStore.getState().fetchDocumentRequestAttachments(targetRequestId).catch(() => {});

            setTimeout(() => {
                chatEndReference.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        } catch (error) {
            showToast({
                title:       'Message Failed',
                description: error?.message ?? 'Could not post message.',
                variant:     'error',
            });
        }
    };

    // MULTI-RECORD SELECTION STAGING PANEL
    if (selectedItems && selectedItems.length > 0) {
        const isUsersResource = selectedItems.some((i) => i.universityId || (i.email && i.role));
        const isCoordResource = selectedItems.some((i) => i.action && typeof i.action === 'string');
        const isDocReqResource = selectedItems.some((i) => i.subject || i.requestNumber);
        const isDeptResource = selectedItems.some((i) => i.code && !i.size && !i.universityId);
        const isArchivedSelection = selectedItems.every((i) => Boolean(i.isArchived));

        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
        const userDeptClean = cleanId(activeUser?.departmentId ?? activeUser?.department?.id ?? activeUser?.department);

        const getItemEffectiveStatus = (it) => {
            const itCleanId = cleanId(it?.id);
            let deptShares = (allDocumentShares || []).filter((s) => {
                const sDocId = cleanId(s.document?.id ?? s.documentId);
                const sDeptId = cleanId(s.department?.id ?? s.departmentId);
                return sDocId === itCleanId && userDeptClean && sDeptId === userDeptClean;
            });

            if (deptShares.length === 0) {
                const root = findRootSharedFolder(it, allDocuments, allDocumentShares);
                if (root) {
                    const rootClean = cleanId(root.id);
                    deptShares = (allDocumentShares || []).filter((s) => {
                        const sDocId = cleanId(s.document?.id ?? s.documentId);
                        const sDeptId = cleanId(s.department?.id ?? s.departmentId);
                        return sDocId === rootClean && userDeptClean && sDeptId === userDeptClean;
                    });
                }
            }

            if (deptShares.length > 0) {
                if (deptShares.some((s) => s.status === constants.DOCUMENT_SHARES_STATUS.PUBLISHED)) {
                    return constants.DOCUMENT_SHARES_STATUS.PUBLISHED;
                }
                if (deptShares.some((s) => s.status === constants.DOCUMENT_SHARES_STATUS.STASHED)) {
                    return constants.DOCUMENT_SHARES_STATUS.STASHED;
                }
                if (deptShares.some((s) => s.status === constants.DOCUMENT_SHARES_STATUS.APPROVED)) {
                    return constants.DOCUMENT_SHARES_STATUS.APPROVED;
                }
                if (deptShares.some((s) => s.status === constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL)) {
                    return constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL;
                }
                if (deptShares.some((s) => s.status === constants.DOCUMENT_SHARES_STATUS.REJECTED)) {
                    return constants.DOCUMENT_SHARES_STATUS.REJECTED;
                }
                const s0 = deptShares[0]?.status;
                if (s0 && s0 !== '—') return String(s0).toUpperCase();
            }

            const rawFallback = it?.status ?? it?.share?.status;
            return (rawFallback && rawFallback !== '—') ? String(rawFallback).toUpperCase() : '';
        };

        const isDocShared = (it) => {
            const itCleanId = cleanId(it?.id);
            return Boolean(
                it?.share ||
                it?.departmentId ||
                (Array.isArray(it?.shares) && it.shares.length > 0) ||
                (allDocumentShares || []).some((s) => {
                    const sDocId = cleanId(s.document?.id ?? s.documentId);
                    const status = String(s.status || '').toUpperCase();
                    return sDocId === itCleanId && status !== 'UNSHARED' && status !== 'REVOKED';
                })
            );
        };

        // Filtered subsets across various browser domains
        const pendingDocs = selectedItems.filter((it) => {
            const s = getItemEffectiveStatus(it);
            return !s || s === constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL || s === 'PENDING';
        });
        const approvedDocs = selectedItems.filter(
            (it) => getItemEffectiveStatus(it) === constants.DOCUMENT_SHARES_STATUS.APPROVED
        );
        const rejectedDocs = selectedItems.filter(
            (it) => getItemEffectiveStatus(it) === constants.DOCUMENT_SHARES_STATUS.REJECTED
        );
        const publishedDocs = selectedItems.filter(
            (it) => getItemEffectiveStatus(it) === constants.DOCUMENT_SHARES_STATUS.PUBLISHED
        );
        const stashedDocs = selectedItems.filter(
            (it) => getItemEffectiveStatus(it) === constants.DOCUMENT_SHARES_STATUS.STASHED
        );
        // Director can publish/stash only approved documents
        const publishableDocs = approvedDocs;
        const stashableDocs = approvedDocs;

        const sharedDocs = selectedItems.filter(isDocShared);
        const unsharedDocs = selectedItems.filter((it) => !isDocShared(it));

        const isSelfUserCheck = (u) => {
            const uClean = cleanId(u?.id);
            const activeClean = cleanId(activeUser?.id);
            return Boolean(uClean && activeClean && uClean === activeClean);
        };
        const activeUsers = selectedItems.filter(
            (u) => String(u.status || '').toUpperCase() !== constants.USERS_STATUS.SUSPENDED && !isSelfUserCheck(u)
        );
        const suspendedUsers = selectedItems.filter(
            (u) => String(u.status || '').toUpperCase() === constants.USERS_STATUS.SUSPENDED
        );

        const openDocRequests = selectedItems.filter((r) => {
            const s = String(r.status || '').toUpperCase();
            return s !== constants.DOCUMENT_REQUESTS_STATUS.RESOLVED && s !== constants.DOCUMENT_REQUESTS_STATUS.REJECTED;
        });
        const pendingCoordRequests = selectedItems.filter((r) => {
            const s = String(r.status || '').toUpperCase();
            return !s || s === constants.COORDINATOR_REQUESTS_STATUS.PENDING;
        });

        const handleBatchActionClick = async (actionKey, customTargets = null) => {
            if (activeActionLoading) return;
            const targetList = Array.isArray(customTargets) && customTargets.length > 0 ? customTargets : selectedItems;

            if (actionKey === 'publish') {
                useDocumentStore.getState().setPublishModalDocument(targetList);
                return;
            }

            if (actionKey === 'share' || actionKey === 're_share') {
                useDocumentStore.getState().setShareModalDocument(targetList);
                return;
            }

            if (actionKey === 'reject') {
                setInspectorRejectReason('');
                setInspectorRejectModal({ targetItem: targetList });
                return;
            }

            if (['approve', 'unapprove', 'unreject', 'unpublish', 'stash', 'unstash', 'unshare', 'suspend', 'unsuspend', 'resolve', 'restore', 'archive'].includes(actionKey)) {
                const count = targetList.length;

                const titles = {
                    approve: `Approve Files (${count})`,
                    unapprove: `Revoke Approval (${count})`,
                    unreject: `Unreject Files (${count})`,
                    publish: `Publish Files (${count})`,
                    unpublish: `Unpublish Files (${count})`,
                    stash: `Stash Files (${count})`,
                    unstash: `Unstash Files (${count})`,
                    unshare: `Unshare all (${count})`,
                    archive: isArchivedSelection ? `Restore all (${count})` : `Archive all (${count})`,
                    restore: `Restore all (${count})`,
                    delete: `Delete all (${count})`,
                    suspend: `Suspend User Accounts (${count})`,
                    unsuspend: `Unsuspend User Accounts (${count})`,
                    resolve: `Resolve Requests (${count})`,
                };
                const messages = {
                    approve: `Are you sure you want to approve ${count} selected file(s) for department director review?`,
                    unapprove: `Are you sure you want to revoke approval for ${count} selected file(s) and return them to pending approval?`,
                    unreject: `Are you sure you want to unreject ${count} selected file(s) and return them to pending approval?`,
                    publish: `Are you sure you want to publish ${count} selected file(s) to all department members?`,
                    unpublish: `Are you sure you want to unpublish ${count} selected file(s) from faculty and department members?`,
                    stash: `Are you sure you want to stash ${count} selected file(s)? They will be held at upper management level.`,
                    unstash: `Are you sure you want to unstash ${count} selected file(s) and restore them to approved status?`,
                    unshare: count > 1
                        ? `Are you sure you want to remove all departmental and member shares for ${count} selected files?`
                        : `Are you sure you want to remove all departmental and member shares for this item?`,
                    archive: isArchivedSelection
                        ? `Are you sure you want to restore ${count} selected item(s) from the archive to the active repository?`
                        : `Are you sure you want to move ${count} selected file(s) to the archive?`,
                    restore: `Are you sure you want to restore ${count} selected item(s) from the archive to the active repository?`,
                    delete: `Are you sure you want to permanently delete ${count} selected item(s)? This action cannot be undone.`,
                    suspend: `Are you sure you want to suspend ${count} selected user account(s)? The users will be prohibited from authentication.`,
                    unsuspend: `Are you sure you want to re-activate ${count} selected user account(s)? The users will regain institutional access.`,
                    resolve: `Are you sure you want to mark ${count} selected request(s) as resolved?`,
                };
                const primaryLabels = {
                    approve: count > 1 ? `Approve (${count})` : 'Approve',
                    unapprove: count > 1 ? `Revoke Approval (${count})` : 'Revoke Approval',
                    unreject: count > 1 ? `Unreject (${count})` : 'Unreject',
                    publish: count > 1 ? `Publish (${count})` : 'Publish',
                    unpublish: count > 1 ? `Unpublish (${count})` : 'Unpublish',
                    stash: count > 1 ? `Stash (${count})` : 'Stash',
                    unstash: count > 1 ? `Unstash (${count})` : 'Unstash',
                    unshare: `Unshare all (${count})`,
                    archive: isArchivedSelection ? `Restore all (${count})` : `Archive all (${count})`,
                    restore: `Restore all (${count})`,
                    delete: `Delete all (${count})`,
                    suspend: count > 1 ? `Suspend (${count})` : 'Suspend',
                    unsuspend: count > 1 ? `Unsuspend (${count})` : 'Unsuspend',
                    resolve: count > 1 ? `Resolve (${count})` : 'Resolve',
                };
                const conf = getActionConfirmationConfig(actionKey, targetList, count);
                const variants = {
                    approve: 'primary',
                    unapprove: 'destructive',
                    unreject: 'primary',
                    publish: 'primary',
                    unpublish: 'destructive',
                    stash: 'secondary',
                    unstash: 'secondary',
                    unshare: 'destructive',
                    archive: 'secondary',
                    restore: 'primary',
                    delete: 'destructive',
                    suspend: 'destructive',
                    unsuspend: 'primary',
                    resolve: 'primary',
                };

                setInspectorConfirmAction({
                    actionKey,
                    targetItem: targetList,
                    title: titles[actionKey] || conf.title,
                    message: messages[actionKey] || conf.message,
                    primaryLabel: primaryLabels[actionKey] || conf.primaryLabel,
                    variant: conf.variant || variants[actionKey] || 'primary',
                    icon: conf.icon,
                    impact: conf.impact,
                });
                return;
            }

            setActiveActionLoading(actionKey);
            try {
                await onAction?.(actionKey, targetList);
                useDocumentStore.getState().fetchDocuments().catch(() => {});
            } finally {
                setActiveActionLoading(null);
            }
        };

        return (
            <div
                className={`flex flex-col h-full text-text select-text ${className ?? ''}`.trim()}
                {...props}
            >
                {/* HEADER AREA */}
                <div className="flex flex-col gap-2 pb-3 border-b border-surface-border shrink-0">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-2 rounded-lg bg-accent/15 text-accent shrink-0 border border-accent/25">
                                <Layers className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <h2 className="text-sm font-bold text-text truncate">
                                    {selectedItems.length > 1
                                        ? `You select multiple files (${selectedItems.length})`
                                        : `Selected item (${selectedItems.length})`}
                                </h2>
                                <span className="text-xs text-text-muted">
                                    {`Staging ${selectedItems.length} ${selectedItems.length === 1 ? 'record' : 'records'} for simultaneous actions`}
                                </span>
                            </div>
                        </div>

                        {onClearSelection && (
                            <button
                                type="button"
                                onClick={onClearSelection}
                                className="text-xs font-semibold text-accent hover:underline px-2 py-1 rounded-md hover:bg-accent/10 transition-colors cursor-pointer shrink-0"
                            >
                                Clear all
                            </button>
                        )}
                    </div>
                </div>

                {/* STAGING TRAY LIST */}
                <div className="flex-1 overflow-y-auto py-3 pr-1 flex flex-col gap-2 min-h-0">
                    <span className={SECTION_TITLE_STYLE}>
                        Staged Items ({selectedItems.length})
                    </span>

                    {selectedItems.map((staged) => {
                        const title = staged.title ?? staged.name ?? staged.subject ?? 'Untitled Item';
                        const subtitle = staged.isFolder
                            ? 'Folder'
                            : staged.size
                            ? staged.size
                            : staged.department
                            ? staged.department
                            : staged.role ?? 'Record';

                        const isHighlighted = hoveredActionFilter ? Boolean(hoveredActionFilter(staged)) : false;
                        const isDimmed = hoveredActionFilter ? !isHighlighted : false;

                        return (
                            <div
                                key={staged.id}
                                className={`group flex items-center justify-between p-2.5 rounded-xl border transition-all gap-2.5 min-w-0 shadow-2xs ${
                                    isHighlighted
                                        ? 'border-accent ring-2 ring-accent/40 bg-accent/15'
                                        : isDimmed
                                        ? 'opacity-35 border-surface-border bg-surface'
                                        : 'border-surface-border bg-surface hover:bg-surface-hover/70'
                                }`}
                            >
                                <div
                                    className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                                    onClick={() => onAction?.('select_item', staged)}
                                    title={`Click to inspect "${title}"`}
                                >
                                    <div className="p-1.5 rounded-lg bg-surface-hover text-accent border border-surface-border/60 shrink-0">
                                        {staged.isFolder ? (
                                            <Folder className="h-4 w-4" />
                                        ) : staged.universityId || (staged.email && staged.role) ? (
                                            <User className="h-4 w-4" />
                                        ) : staged.code && !staged.size ? (
                                            <Building2 className="h-4 w-4" />
                                        ) : staged.action ? (
                                            <UserCheck className="h-4 w-4" />
                                        ) : staged.subject ? (
                                            <Inbox className="h-4 w-4" />
                                        ) : (
                                            <FileText className="h-4 w-4" />
                                        )}
                                    </div>

                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className="text-xs font-semibold text-text truncate hover:text-accent transition-colors" title={title}>
                                            {title}
                                        </span>
                                        <div className="flex items-center gap-2 text-[11px] text-text-muted">
                                            <span className="truncate">{subtitle}</span>
                                            {staged.classification && staged.classification !== '—' && (
                                                <span className="px-1.5 py-0.2 rounded bg-surface-hover border border-surface-border text-[10px] font-medium text-text-muted">
                                                    {staged.classification}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {onUnstageItem && (
                                    <button
                                        type="button"
                                        onClick={() => onUnstageItem(staged)}
                                        className="p-1 rounded-lg text-text-muted hover:text-error hover:bg-error-background transition-colors cursor-pointer shrink-0 opacity-70 group-hover:opacity-100"
                                        title={`Remove "${title}" from selection`}
                                        aria-label="Remove from selection"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ROLE-DELEGATED QUICK ACTIONS FOOTER */}
                <div className="pt-3 border-t border-surface-border shrink-0 flex flex-col gap-2">
                    <span className={SECTION_TITLE_STYLE}>
                        Simultaneous Quick Actions
                    </span>

                    {/* 1. USERS RESOURCE */}
                    {isUsersResource && (
                        activeUsers.length > 0 && suspendedUsers.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2 w-full">
                                <Button
                                    variant="destructive"
                                    leadingIcon={UserX}
                                    isLoading={activeActionLoading === 'suspend'}
                                    isDisabled={Boolean(activeActionLoading)}
                                    onClick={() => handleBatchActionClick('suspend', activeUsers)}
                                    onMouseEnter={() => setHoveredActionFilter(() => (it) => activeUsers.some((u) => u.id === it.id))}
                                    onMouseLeave={() => setHoveredActionFilter(null)}
                                    className="justify-center truncate text-xs"
                                >
                                    {`Suspend all (${activeUsers.length})`}
                                </Button>
                                <Button
                                    variant="secondary"
                                    leadingIcon={UserCheck}
                                    isLoading={activeActionLoading === 'unsuspend'}
                                    isDisabled={Boolean(activeActionLoading)}
                                    onClick={() => handleBatchActionClick('unsuspend', suspendedUsers)}
                                    onMouseEnter={() => setHoveredActionFilter(() => (it) => suspendedUsers.some((u) => u.id === it.id))}
                                    onMouseLeave={() => setHoveredActionFilter(null)}
                                    className="justify-center truncate text-xs"
                                >
                                    {`Unsuspend all (${suspendedUsers.length})`}
                                </Button>
                            </div>
                        ) : suspendedUsers.length > 0 ? (
                            <div className="w-full">
                                <Button
                                    variant="secondary"
                                    leadingIcon={UserCheck}
                                    isLoading={activeActionLoading === 'unsuspend'}
                                    isDisabled={Boolean(activeActionLoading)}
                                    onClick={() => handleBatchActionClick('unsuspend', suspendedUsers)}
                                    onMouseEnter={() => setHoveredActionFilter(() => (it) => suspendedUsers.some((u) => u.id === it.id))}
                                    onMouseLeave={() => setHoveredActionFilter(null)}
                                    className="w-full justify-center truncate text-xs"
                                >
                                    {`Unsuspend all (${suspendedUsers.length})`}
                                </Button>
                            </div>
                        ) : activeUsers.length > 0 ? (
                            <div className="w-full">
                                <Button
                                    variant="destructive"
                                    leadingIcon={UserX}
                                    isLoading={activeActionLoading === 'suspend'}
                                    isDisabled={Boolean(activeActionLoading)}
                                    onClick={() => handleBatchActionClick('suspend', activeUsers)}
                                    onMouseEnter={() => setHoveredActionFilter(() => (it) => activeUsers.some((u) => u.id === it.id))}
                                    onMouseLeave={() => setHoveredActionFilter(null)}
                                    className="w-full justify-center truncate text-xs"
                                >
                                    {`Suspend all (${activeUsers.length})`}
                                </Button>
                            </div>
                        ) : (
                            <div className="p-2 rounded-lg bg-surface-hover/80 text-center text-xs text-text-muted border border-surface-border">
                                No eligible actions for selected user accounts.
                            </div>
                        )
                    )}

                    {/* 2. COORDINATOR REQUESTS RESOURCE */}
                    {isCoordResource && (
                        isAdmin ? (
                            pendingCoordRequests.length > 0 ? (
                                <div className="grid grid-cols-2 gap-2 w-full">
                                    <Button
                                        variant="primary"
                                        leadingIcon={CheckCircle2}
                                        isLoading={activeActionLoading === 'approve'}
                                        isDisabled={Boolean(activeActionLoading)}
                                        onClick={() => handleBatchActionClick('approve', pendingCoordRequests)}
                                        onMouseEnter={() => setHoveredActionFilter(() => (it) => pendingCoordRequests.some((r) => r.id === it.id))}
                                        onMouseLeave={() => setHoveredActionFilter(null)}
                                        className="justify-center truncate text-xs"
                                    >
                                        {`Approve all (${pendingCoordRequests.length})`}
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        leadingIcon={XCircle}
                                        isLoading={activeActionLoading === 'reject'}
                                        isDisabled={Boolean(activeActionLoading)}
                                        onClick={() => handleBatchActionClick('reject', pendingCoordRequests)}
                                        onMouseEnter={() => setHoveredActionFilter(() => (it) => pendingCoordRequests.some((r) => r.id === it.id))}
                                        onMouseLeave={() => setHoveredActionFilter(null)}
                                        className="justify-center truncate text-xs"
                                    >
                                        {`Reject all (${pendingCoordRequests.length})`}
                                    </Button>
                                </div>
                            ) : (
                                <div className="p-2 rounded-lg bg-surface-hover/80 text-center text-xs text-text-muted border border-surface-border">
                                    Selected coordinator requests are finalized.
                                </div>
                            )
                        ) : (
                            <div className="p-2 rounded-lg bg-surface-hover/80 text-center text-xs text-text-muted border border-surface-border">
                                Coordinator requests are managed by Administrators.
                            </div>
                        )
                    )}

                    {/* 3. DOCUMENT REQUESTS RESOURCE */}
                    {isDocReqResource && (
                        isStaff ? (
                            openDocRequests.length > 0 ? (
                                <div className="grid grid-cols-2 gap-2 w-full">
                                    <Button
                                        variant="primary"
                                        leadingIcon={CheckCircle2}
                                        isLoading={activeActionLoading === 'resolve'}
                                        isDisabled={Boolean(activeActionLoading)}
                                        onClick={() => handleBatchActionClick('resolve', openDocRequests)}
                                        onMouseEnter={() => setHoveredActionFilter(() => (it) => openDocRequests.some((r) => r.id === it.id))}
                                        onMouseLeave={() => setHoveredActionFilter(null)}
                                        className="justify-center truncate text-xs"
                                    >
                                        {`Resolve all (${openDocRequests.length})`}
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        leadingIcon={XCircle}
                                        isLoading={activeActionLoading === 'reject'}
                                        isDisabled={Boolean(activeActionLoading)}
                                        onClick={() => handleBatchActionClick('reject', openDocRequests)}
                                        onMouseEnter={() => setHoveredActionFilter(() => (it) => openDocRequests.some((r) => r.id === it.id))}
                                        onMouseLeave={() => setHoveredActionFilter(null)}
                                        className="justify-center truncate text-xs"
                                    >
                                        {`Reject all (${openDocRequests.length})`}
                                    </Button>
                                </div>
                            ) : (
                                <div className="p-2 rounded-lg bg-surface-hover/80 text-center text-xs text-text-muted border border-surface-border">
                                    Selected document requests are closed.
                                </div>
                            )
                        ) : (
                            <div className="p-2 rounded-lg bg-surface-hover/80 text-center text-xs text-text-muted border border-surface-border">
                                Document requests are managed by Staff.
                            </div>
                        )
                    )}

                    {/* 4. DOCUMENTS & ARCHIVES RESOURCE */}
                    {!isUsersResource && !isCoordResource && !isDocReqResource && !isDeptResource && (
                        isOfficer ? (
                            // Officer role: Approve all, Reject all, Unapprove all, Unreject all
                            <div className="w-full flex flex-col gap-2">
                                {approvedDocs.length === selectedItems.length ? (
                                    <Button
                                        variant="secondary"
                                        leadingIcon={RotateCcw}
                                        isLoading={activeActionLoading === 'unapprove'}
                                        isDisabled={Boolean(activeActionLoading)}
                                        onClick={() => handleBatchActionClick('unapprove', approvedDocs)}
                                        onMouseEnter={() => setHoveredActionFilter(() => (it) => approvedDocs.some((d) => d.id === it.id))}
                                        onMouseLeave={() => setHoveredActionFilter(null)}
                                        className="w-full justify-center truncate text-xs"
                                    >
                                        {`Unapprove all (${approvedDocs.length})`}
                                    </Button>
                                ) : rejectedDocs.length === selectedItems.length ? (
                                    <Button
                                        variant="secondary"
                                        leadingIcon={RotateCcw}
                                        isLoading={activeActionLoading === 'unreject'}
                                        isDisabled={Boolean(activeActionLoading)}
                                        onClick={() => handleBatchActionClick('unreject', rejectedDocs)}
                                        onMouseEnter={() => setHoveredActionFilter(() => (it) => rejectedDocs.some((d) => d.id === it.id))}
                                        onMouseLeave={() => setHoveredActionFilter(null)}
                                        className="w-full justify-center truncate text-xs"
                                    >
                                        {`Unreject all (${rejectedDocs.length})`}
                                    </Button>
                                ) : pendingDocs.length === selectedItems.length ? (
                                    <div className="grid grid-cols-2 gap-2 w-full">
                                        <Button
                                            variant="primary"
                                            leadingIcon={Check}
                                            isLoading={activeActionLoading === 'approve'}
                                            isDisabled={Boolean(activeActionLoading)}
                                            onClick={() => handleBatchActionClick('approve', pendingDocs)}
                                            onMouseEnter={() => setHoveredActionFilter(() => (it) => pendingDocs.some((d) => d.id === it.id))}
                                            onMouseLeave={() => setHoveredActionFilter(null)}
                                            className="justify-center truncate text-xs"
                                        >
                                            {`Approve all (${pendingDocs.length})`}
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            leadingIcon={XCircle}
                                            isLoading={activeActionLoading === 'reject'}
                                            isDisabled={Boolean(activeActionLoading)}
                                            onClick={() => handleBatchActionClick('reject', pendingDocs)}
                                            onMouseEnter={() => setHoveredActionFilter(() => (it) => pendingDocs.some((d) => d.id === it.id))}
                                            onMouseLeave={() => setHoveredActionFilter(null)}
                                            className="justify-center truncate text-xs"
                                        >
                                            {`Reject all (${pendingDocs.length})`}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2 w-full">
                                        {pendingDocs.length > 0 && (
                                            <div className="grid grid-cols-2 gap-2 w-full">
                                                <Button
                                                    variant="primary"
                                                    leadingIcon={Check}
                                                    isLoading={activeActionLoading === 'approve'}
                                                    isDisabled={Boolean(activeActionLoading)}
                                                    onClick={() => handleBatchActionClick('approve', pendingDocs)}
                                                    onMouseEnter={() => setHoveredActionFilter(() => (it) => pendingDocs.some((d) => d.id === it.id))}
                                                    onMouseLeave={() => setHoveredActionFilter(null)}
                                                    className="justify-center truncate text-xs"
                                                >
                                                    {`Approve all (${pendingDocs.length})`}
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    leadingIcon={XCircle}
                                                    isLoading={activeActionLoading === 'reject'}
                                                    isDisabled={Boolean(activeActionLoading)}
                                                    onClick={() => handleBatchActionClick('reject', pendingDocs)}
                                                    onMouseEnter={() => setHoveredActionFilter(() => (it) => pendingDocs.some((d) => d.id === it.id))}
                                                    onMouseLeave={() => setHoveredActionFilter(null)}
                                                    className="justify-center truncate text-xs"
                                                >
                                                    {`Reject all (${pendingDocs.length})`}
                                                </Button>
                                            </div>
                                        )}
                                        {approvedDocs.length > 0 && rejectedDocs.length > 0 ? (
                                            <div className="grid grid-cols-2 gap-2 w-full">
                                                <Button
                                                    variant="secondary"
                                                    leadingIcon={RotateCcw}
                                                    isLoading={activeActionLoading === 'unapprove'}
                                                    isDisabled={Boolean(activeActionLoading)}
                                                    onClick={() => handleBatchActionClick('unapprove', approvedDocs)}
                                                    onMouseEnter={() => setHoveredActionFilter(() => (it) => approvedDocs.some((d) => d.id === it.id))}
                                                    onMouseLeave={() => setHoveredActionFilter(null)}
                                                    className="justify-center truncate text-xs"
                                                >
                                                    {`Unapprove all (${approvedDocs.length})`}
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    leadingIcon={RotateCcw}
                                                    isLoading={activeActionLoading === 'unreject'}
                                                    isDisabled={Boolean(activeActionLoading)}
                                                    onClick={() => handleBatchActionClick('unreject', rejectedDocs)}
                                                    onMouseEnter={() => setHoveredActionFilter(() => (it) => rejectedDocs.some((d) => d.id === it.id))}
                                                    onMouseLeave={() => setHoveredActionFilter(null)}
                                                    className="justify-center truncate text-xs"
                                                >
                                                    {`Unreject all (${rejectedDocs.length})`}
                                                </Button>
                                            </div>
                                        ) : approvedDocs.length > 0 ? (
                                            <Button
                                                variant="secondary"
                                                leadingIcon={RotateCcw}
                                                isLoading={activeActionLoading === 'unapprove'}
                                                isDisabled={Boolean(activeActionLoading)}
                                                onClick={() => handleBatchActionClick('unapprove', approvedDocs)}
                                                onMouseEnter={() => setHoveredActionFilter(() => (it) => approvedDocs.some((d) => d.id === it.id))}
                                                onMouseLeave={() => setHoveredActionFilter(null)}
                                                className="w-full justify-center truncate text-xs"
                                            >
                                                {`Unapprove all (${approvedDocs.length})`}
                                            </Button>
                                        ) : rejectedDocs.length > 0 ? (
                                            <Button
                                                variant="secondary"
                                                leadingIcon={RotateCcw}
                                                isLoading={activeActionLoading === 'unreject'}
                                                isDisabled={Boolean(activeActionLoading)}
                                                onClick={() => handleBatchActionClick('unreject', rejectedDocs)}
                                                onMouseEnter={() => setHoveredActionFilter(() => (it) => rejectedDocs.some((d) => d.id === it.id))}
                                                onMouseLeave={() => setHoveredActionFilter(null)}
                                                className="w-full justify-center truncate text-xs"
                                            >
                                                {`Unreject all (${rejectedDocs.length})`}
                                            </Button>
                                        ) : null}
                                        {pendingDocs.length === 0 && approvedDocs.length === 0 && rejectedDocs.length === 0 && (
                                            <div className="p-2 rounded-lg bg-surface-hover/80 text-center text-xs text-text-muted border border-surface-border">
                                                Selected files are finalized or managed by the Director.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : isDirector ? (
                            // Director role: Publish all, Stash all, Re-Publish all, Unpublish all, Unstash all
                            <div className="w-full flex flex-col gap-2">
                                {publishedDocs.length === selectedItems.length ? (
                                    <div className="w-full">
                                        <Button
                                            variant="secondary"
                                            leadingIcon={EyeOff}
                                            isLoading={activeActionLoading === 'unpublish'}
                                            isDisabled={Boolean(activeActionLoading)}
                                            onClick={() => handleBatchActionClick('unpublish', publishedDocs)}
                                            onMouseEnter={() => setHoveredActionFilter(() => (it) => publishedDocs.some((p) => p.id === it.id))}
                                            onMouseLeave={() => setHoveredActionFilter(null)}
                                            className="w-full justify-center truncate text-xs"
                                        >
                                            {`Unpublish all (${publishedDocs.length})`}
                                        </Button>
                                    </div>
                                ) : stashedDocs.length === selectedItems.length ? (
                                    <Button
                                        variant="secondary"
                                        leadingIcon={RotateCcw}
                                        isLoading={activeActionLoading === 'unstash'}
                                        isDisabled={Boolean(activeActionLoading)}
                                        onClick={() => handleBatchActionClick('unstash', stashedDocs)}
                                        onMouseEnter={() => setHoveredActionFilter(() => (it) => stashedDocs.some((s) => s.id === it.id))}
                                        onMouseLeave={() => setHoveredActionFilter(null)}
                                        className="w-full justify-center truncate text-xs"
                                    >
                                        {`Unstash all (${stashedDocs.length})`}
                                    </Button>
                                ) : publishableDocs.length === selectedItems.length ? (
                                    <div className="grid grid-cols-2 gap-2 w-full">
                                        <Button
                                            variant="primary"
                                            leadingIcon={Globe}
                                            isLoading={activeActionLoading === 'publish'}
                                            isDisabled={Boolean(activeActionLoading)}
                                            onClick={() => handleBatchActionClick('publish', publishableDocs)}
                                            onMouseEnter={() => setHoveredActionFilter(() => (it) => publishableDocs.some((p) => p.id === it.id))}
                                            onMouseLeave={() => setHoveredActionFilter(null)}
                                            className="justify-center truncate text-xs"
                                        >
                                            {`Publish all (${publishableDocs.length})`}
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            leadingIcon={Layers}
                                            isLoading={activeActionLoading === 'stash'}
                                            isDisabled={Boolean(activeActionLoading)}
                                            onClick={() => handleBatchActionClick('stash', stashableDocs)}
                                            onMouseEnter={() => setHoveredActionFilter(() => (it) => stashableDocs.some((s) => s.id === it.id))}
                                            onMouseLeave={() => setHoveredActionFilter(null)}
                                            className="justify-center truncate text-xs"
                                        >
                                            {`Stash all (${stashableDocs.length})`}
                                        </Button>
                                    </div>
                                ) : (() => {
                                    const hasPublish = publishableDocs.length > 0;
                                    const hasUnpublish = publishedDocs.length > 0;
                                    const hasStash = stashableDocs.length > 0;
                                    const hasUnstash = stashedDocs.length > 0;
                                    const totalActions = (hasPublish ? 1 : 0) + (hasUnpublish ? 1 : 0) + (hasStash ? 1 : 0) + (hasUnstash ? 1 : 0);

                                    if (totalActions === 0) {
                                        return (
                                            <div className="p-2 rounded-lg bg-surface-hover/80 text-center text-xs text-text-muted border border-surface-border">
                                                Selected files require Officer approval before publishing or stashing.
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="grid grid-cols-2 gap-2 w-full">
                                            {/* Mixed states for Director: 2-column grid pattern */}
                                            {hasPublish && (
                                                <Button
                                                    variant="primary"
                                                    leadingIcon={Globe}
                                                    isLoading={activeActionLoading === 'publish'}
                                                    isDisabled={Boolean(activeActionLoading)}
                                                    onClick={() => handleBatchActionClick('publish', publishableDocs)}
                                                    onMouseEnter={() => setHoveredActionFilter(() => (it) => publishableDocs.some((p) => p.id === it.id))}
                                                    onMouseLeave={() => setHoveredActionFilter(null)}
                                                    className={`${(totalActions === 1 || totalActions === 3) ? 'col-span-2' : 'col-span-1'} justify-center truncate text-xs`}
                                                >
                                                    {`Publish all (${publishableDocs.length})`}
                                                </Button>
                                            )}
                                            {hasUnpublish && (
                                                <Button
                                                    variant="secondary"
                                                    leadingIcon={EyeOff}
                                                    isLoading={activeActionLoading === 'unpublish'}
                                                    isDisabled={Boolean(activeActionLoading)}
                                                    onClick={() => handleBatchActionClick('unpublish', publishedDocs)}
                                                    onMouseEnter={() => setHoveredActionFilter(() => (it) => publishedDocs.some((p) => p.id === it.id))}
                                                    onMouseLeave={() => setHoveredActionFilter(null)}
                                                    className={`${(totalActions === 1 || (!hasPublish && totalActions === 3)) ? 'col-span-2' : 'col-span-1'} justify-center truncate text-xs`}
                                                >
                                                    {`Unpublish all (${publishedDocs.length})`}
                                                </Button>
                                            )}
                                            {hasStash && (
                                                <Button
                                                    variant="secondary"
                                                    leadingIcon={Layers}
                                                    isLoading={activeActionLoading === 'stash'}
                                                    isDisabled={Boolean(activeActionLoading)}
                                                    onClick={() => handleBatchActionClick('stash', stashableDocs)}
                                                    onMouseEnter={() => setHoveredActionFilter(() => (it) => stashableDocs.some((s) => s.id === it.id))}
                                                    onMouseLeave={() => setHoveredActionFilter(null)}
                                                    className={`${(totalActions === 1 || (!hasPublish && !hasUnpublish && totalActions === 3)) ? 'col-span-2' : 'col-span-1'} justify-center truncate text-xs`}
                                                >
                                                    {`Stash all (${stashableDocs.length})`}
                                                </Button>
                                            )}
                                            {hasUnstash && (
                                                <Button
                                                    variant="secondary"
                                                    leadingIcon={RotateCcw}
                                                    isLoading={activeActionLoading === 'unstash'}
                                                    isDisabled={Boolean(activeActionLoading)}
                                                    onClick={() => handleBatchActionClick('unstash', stashedDocs)}
                                                    onMouseEnter={() => setHoveredActionFilter(() => (it) => stashedDocs.some((s) => s.id === it.id))}
                                                    onMouseLeave={() => setHoveredActionFilter(null)}
                                                    className={`${totalActions === 1 ? 'col-span-2' : 'col-span-1'} justify-center truncate text-xs`}
                                                >
                                                    {`Unstash all (${stashedDocs.length})`}
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        ) : isMember ? (
                            // Member role: Download all ({n})
                            <Button
                                variant="secondary"
                                leadingIcon={Download}
                                isLoading={activeActionLoading === 'download'}
                                isDisabled={Boolean(activeActionLoading)}
                                onClick={() => handleBatchActionClick('download')}
                                onMouseEnter={() => setHoveredActionFilter(() => (it) => !it.isFolder)}
                                onMouseLeave={() => setHoveredActionFilter(null)}
                                className="w-full justify-center truncate text-xs"
                            >
                                {`Download all (${selectedItems.length})`}
                            </Button>
                        ) : (
                            // Admin & Coordinator role: Restore all | Delete all, Share all | Archive all, Re-Share all | Unshare all, or mixed
                            <div className="w-full">
                                {isArchivedSelection ? (
                                    <div className="grid grid-cols-2 gap-2 w-full">
                                        <Button
                                            variant="primary"
                                            leadingIcon={RotateCcw}
                                            isLoading={activeActionLoading === 'restore'}
                                            isDisabled={Boolean(activeActionLoading)}
                                            onClick={() => handleBatchActionClick('restore')}
                                            onMouseEnter={() => setHoveredActionFilter(() => () => true)}
                                            onMouseLeave={() => setHoveredActionFilter(null)}
                                            className="justify-center truncate text-xs"
                                        >
                                            {`Restore all (${selectedItems.length})`}
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            leadingIcon={Trash2}
                                            isLoading={activeActionLoading === 'delete'}
                                            isDisabled={Boolean(activeActionLoading)}
                                            onClick={() => handleBatchActionClick('delete')}
                                            onMouseEnter={() => setHoveredActionFilter(() => () => true)}
                                            onMouseLeave={() => setHoveredActionFilter(null)}
                                            className="justify-center truncate text-xs"
                                        >
                                            {`Delete all (${selectedItems.length})`}
                                        </Button>
                                    </div>
                                ) : sharedDocs.length === 0 ? (
                                    // Multiple (Same: all unshared): Share all | Archive all
                                    <div className="grid grid-cols-2 gap-2 w-full">
                                        <Button
                                            variant="primary"
                                            leadingIcon={Share2}
                                            isLoading={activeActionLoading === 'share'}
                                            isDisabled={Boolean(activeActionLoading)}
                                            onClick={() => handleBatchActionClick('share', unsharedDocs)}
                                            onMouseEnter={() => setHoveredActionFilter(() => (it) => !isDocShared(it))}
                                            onMouseLeave={() => setHoveredActionFilter(null)}
                                            className="justify-center truncate text-xs"
                                        >
                                            {`Share all (${unsharedDocs.length})`}
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            leadingIcon={Archive}
                                            isLoading={activeActionLoading === 'archive'}
                                            isDisabled={Boolean(activeActionLoading)}
                                            onClick={() => handleBatchActionClick('archive', unsharedDocs)}
                                            onMouseEnter={() => setHoveredActionFilter(() => (it) => !isDocShared(it))}
                                            onMouseLeave={() => setHoveredActionFilter(null)}
                                            className="justify-center truncate text-xs"
                                        >
                                            {`Archive all (${unsharedDocs.length})`}
                                        </Button>
                                    </div>
                                ) : unsharedDocs.length === 0 ? (
                                    // Multiple (Same: all shared): Unshare all
                                    <div className="w-full">
                                        <Button
                                            variant="secondary"
                                            leadingIcon={Share2}
                                            isLoading={activeActionLoading === 'unshare'}
                                            isDisabled={Boolean(activeActionLoading)}
                                            onClick={() => handleBatchActionClick('unshare', sharedDocs)}
                                            onMouseEnter={() => setHoveredActionFilter(() => (it) => isDocShared(it))}
                                            onMouseLeave={() => setHoveredActionFilter(null)}
                                            className="w-full justify-center truncate text-xs"
                                        >
                                            {`Unshare all (${sharedDocs.length})`}
                                        </Button>
                                    </div>
                                ) : (
                                    // Multiple (Mixed shared/unshared): Row 1: Share all ({n}) (spans 2 cols), Row 2: Unshare all ({n}) | Archive all ({n})
                                    <div className="grid grid-cols-2 gap-2 w-full">
                                        {unsharedDocs.length > 0 && (
                                            <Button
                                                variant="primary"
                                                leadingIcon={Share2}
                                                isLoading={activeActionLoading === 'share'}
                                                isDisabled={Boolean(activeActionLoading)}
                                                onClick={() => handleBatchActionClick('share', unsharedDocs)}
                                                onMouseEnter={() => setHoveredActionFilter(() => (it) => !isDocShared(it))}
                                                onMouseLeave={() => setHoveredActionFilter(null)}
                                                className={`${sharedDocs.length > 0 ? 'col-span-2' : 'col-span-1'} justify-center truncate text-xs`}
                                            >
                                                {`Share all (${unsharedDocs.length})`}
                                            </Button>
                                        )}
                                        {sharedDocs.length > 0 && (
                                            <Button
                                                variant="secondary"
                                                leadingIcon={Share2}
                                                isLoading={activeActionLoading === 'unshare'}
                                                isDisabled={Boolean(activeActionLoading)}
                                                onClick={() => handleBatchActionClick('unshare', sharedDocs)}
                                                onMouseEnter={() => setHoveredActionFilter(() => (it) => isDocShared(it))}
                                                onMouseLeave={() => setHoveredActionFilter(null)}
                                                className="justify-center truncate text-xs"
                                            >
                                                {`Unshare all (${sharedDocs.length})`}
                                            </Button>
                                        )}
                                        {unsharedDocs.length > 0 && (
                                            <Button
                                                variant="destructive"
                                                leadingIcon={Archive}
                                                isLoading={activeActionLoading === 'archive'}
                                                isDisabled={Boolean(activeActionLoading)}
                                                onClick={() => handleBatchActionClick('archive', unsharedDocs)}
                                                onMouseEnter={() => setHoveredActionFilter(() => (it) => !isDocShared(it))}
                                                onMouseLeave={() => setHoveredActionFilter(null)}
                                                className="justify-center truncate text-xs"
                                            >
                                                {`Archive all (${unsharedDocs.length})`}
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    )}

                    {/* 5. DEPARTMENTS RESOURCE */}
                    {isDeptResource && (
                        <Button
                            variant="destructive"
                            leadingIcon={Trash2}
                            isLoading={activeActionLoading === 'delete'}
                            isDisabled={Boolean(activeActionLoading)}
                            onClick={() => handleBatchActionClick('delete')}
                            onMouseEnter={() => setHoveredActionFilter(() => () => true)}
                            onMouseLeave={() => setHoveredActionFilter(null)}
                            className="w-full justify-center truncate text-xs"
                        >
                            Delete All
                        </Button>
                    )}
                </div>

                {/* ACTION CONFIRMATION MODAL */}
                {Boolean(inspectorConfirmAction) && (
                    <Modal
                        isOpen={Boolean(inspectorConfirmAction)}
                        onClose={() => setInspectorConfirmAction(null)}
                        title={inspectorConfirmAction.title}
                        description={inspectorConfirmAction.message}
                        icon={inspectorConfirmAction.icon || (inspectorConfirmAction.actionKey === 'stash' ? Clock : (['restore', 'unshare'].includes(inspectorConfirmAction.actionKey) ? RotateCcw : CheckCircle2))}
                        size="sm"
                        confirmOnClose={false}
                        primaryAction={{
                            label: inspectorConfirmAction.primaryLabel,
                            variant: inspectorConfirmAction.variant || 'primary',
                            isLoading: activeActionLoading === inspectorConfirmAction.actionKey,
                            isDisabled: Boolean(activeActionLoading),
                            onClick: handleConfirmInspectorAction,
                        }}
                        secondaryAction={{
                            label: 'Cancel',
                            isDisabled: Boolean(activeActionLoading),
                            onClick: () => setInspectorConfirmAction(null),
                        }}
                    >
                        <div className="text-xs text-text-muted leading-relaxed">
                            {inspectorConfirmAction.impact || 'Please confirm you wish to perform this action. The status will update immediately across departmental queues.'}
                        </div>
                    </Modal>
                )}

                {/* REJECTION FORM MODAL */}
                {Boolean(inspectorRejectModal) && (
                    <Modal
                        isOpen={Boolean(inspectorRejectModal)}
                        onClose={() => {
                            setInspectorRejectModal(null);
                            setInspectorRejectReason('');
                        }}
                        title={Array.isArray(inspectorRejectModal.targetItem)
                            ? `Reject All Files (${inspectorRejectModal.targetItem.length})`
                            : `Reject ${inspectorRejectModal.targetItem?.isFolder ? 'Folder' : 'Document'}`}
                        description={Array.isArray(inspectorRejectModal.targetItem)
                            ? `Provide a reason for rejecting the ${inspectorRejectModal.targetItem.length} selected items. They will remain in the repository as Rejected.`
                            : `Provide a reason for rejecting "${inspectorRejectModal.targetItem?.name || inspectorRejectModal.targetItem?.title || 'this document'}". The item will remain in the repository as Rejected.`}
                        icon={AlertTriangle}
                        size="md"
                        confirmOnClose={false}
                        primaryAction={{
                            label: Array.isArray(inspectorRejectModal.targetItem) ? 'Reject All Files' : 'Confirm Rejection',
                            variant: 'danger',
                            isLoading: activeActionLoading === 'reject',
                            isDisabled: Boolean(activeActionLoading) || !inspectorRejectReason.trim(),
                            onClick: handleConfirmInspectorRejection,
                        }}
                        secondaryAction={{
                            label: 'Cancel',
                            isDisabled: Boolean(activeActionLoading),
                            onClick: () => {
                                setInspectorRejectModal(null);
                                setInspectorRejectReason('');
                            },
                        }}
                    >
                        <div className="flex flex-col gap-4">
                            <AreaField
                                label="Rejection Reason"
                                required
                                placeholder="Explain why these items are being rejected so corrective action can be taken..."
                                value={inspectorRejectReason}
                                onChange={(e) => setInspectorRejectReason(e.target.value)}
                                rows={4}
                            />
                            <p className="text-[11px] text-text-muted">
                                This reason will be recorded on the audit log and visible to repository administrators.
                            </p>
                        </div>
                    </Modal>
                )}
            </div>
        );
    }

    // GUARD CLAUSES
    if (!item) {
        return (
            <div
                className={`h-full flex flex-col items-center justify-center p-8 text-center text-text-muted gap-3 select-none ${className ?? ''}`.trim()}
                {...props}
            >
                <div className="p-3 rounded-lg bg-surface-hover border border-surface-border text-text-muted">
                    <Layers className="h-8 w-8" />
                </div>
                <div className="flex flex-col gap-1">
                    <span className="font-semibold text-sm text-text">
                        No Record Selected
                    </span>
                    <p className="text-xs text-text-muted max-w-xs leading-relaxed">
                        Select any table row, list entry, or card in the browser to inspect complete database properties, metadata, and audit records.
                    </p>
                </div>
            </div>
        );
    }

    // DERIVED VALUES
    const rawTitle = activeItem.title ?? activeItem.name ?? activeItem.subject ?? 'Record Details';
    const primaryTitle = (isFolder || isUser || isDepartment || isDocumentRequest || isCoordinatorRequest)
        ? rawTitle
        : (typeof rawTitle === 'string' ? stripFileExtension(rawTitle) || rawTitle : rawTitle);
    const primarySubtitle =
        activeItem.code ??
        activeItem.universityId ??
        (activeItem.action ? activeItem.action.replace(/_/g, ' ') : null) ??
        activeItem.subtitle ??
        (isFolder
            ? 'Folder'
            : isDocumentRequest
                ? (activeItem.subject ?? 'Document Request')
                : isCoordinatorRequest
                    ? 'Coordinator Request'
                    : isDocument
                        ? 'Document'
                        : isUser
                            ? 'User'
                            : 'Record');
    const formattedCreatedDate = formatTimestamp(
        activeItem.createdAt ?? activeItem.date ?? activeItem.timestamp
    ) ?? 'Just now';
    const formattedUpdatedDate = formatTimestamp(
        activeItem.updatedAt ?? activeItem.createdAt ?? activeItem.date
    ) ?? formattedCreatedDate;
    const formattedFileSize = (activeItem.sizeBytes !== undefined && activeItem.sizeBytes !== null && activeItem.sizeBytes > 0)
        ? formatBytes(activeItem.sizeBytes)
        : (activeItem.size && activeItem.size !== '—' ? activeItem.size : (isFolder ? '0 B' : null));
    const mimeType = activeItem.mimeType ?? getMimeTypeFromExtension(activeItem.name ?? activeItem.title);
    const checksum = activeItem.checksum ?? null;

    // RENDER
    return (
        <div
            className={`flex flex-col h-full text-text select-text ${className ?? ''}`.trim()}
            {...props}
        >
            <div className="flex flex-col gap-3 pb-3 border-b border-surface-border shrink-0">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        {isUser ? (
                            <Avatar
                                src={resolveUserAvatar(item, activeUser)}
                                user={item}
                                alt={primaryTitle}
                                size="medium"
                            />
                        ) : (
                            <div className="p-2 rounded-md bg-accent-background text-accent shrink-0 border border-accent-border">
                                {isFolder ? (
                                    <Folder className="h-4 w-4" />
                                ) : isDepartment ? (
                                    <Building2 className="h-4 w-4" />
                                ) : isCoordinatorRequest ? (
                                    <UserCheck className="h-4 w-4" />
                                ) : isDocumentRequest ? (
                                    <Inbox className="h-4 w-4" />
                                ) : (
                                    <FileText className="h-4 w-4" />
                                )}
                            </div>
                        )}

                        <div className="flex flex-col min-w-0">
                            <span
                                className="text-xs font-semibold text-text-muted uppercase tracking-wider truncate cursor-default"
                                title={primarySubtitle}
                            >
                                {primarySubtitle}
                            </span>
                            <span className="text-xs text-text-muted capitalize">
                                {isFolder
                                    ? 'Directory Archive'
                                    : isUser
                                        ? 'User Identity'
                                        : isDepartment
                                            ? 'Academic Department'
                                            : isCoordinatorRequest
                                                ? 'Governance Request'
                                                : isDocumentRequest
                                                    ? 'Document Request'
                                                    : 'Institutional Document'}
                            </span>
                        </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                        {!isFolder && activeItem.classification && activeItem.classification !== '—' && activeItem.classification !== '--' ? (
                            <Badge
                                variant={CLASSIFICATION_BADGE_VARIANT[activeItem.classification] ?? 'neutral'}
                                label={activeItem.classification}
                            />
                        ) : isUser ? (
                            <>
                                {(activeUserRecord?.role ?? item.role) && (
                                    <Badge
                                        variant={ROLE_BADGE_VARIANT[activeUserRecord?.role ?? item.role] ?? 'neutral'}
                                        label={activeUserRecord?.role ?? item.role}
                                    />
                                )}
                                {(activeUserRecord?.status ?? item.status) && (
                                    <Badge
                                        variant={STATUS_BADGE_VARIANT[activeUserRecord?.status ?? item.status] ?? 'neutral'}
                                        label={activeUserRecord?.status ?? item.status}
                                    />
                                )}
                            </>
                        ) : item.role ? (
                            <Badge
                                variant={ROLE_BADGE_VARIANT[item.role] ?? 'neutral'}
                                label={item.role}
                            />
                        ) : (isDocument || isFolder) && activeItem?.status && activeItem.status !== '—' ? (
                            <Badge
                                variant={STATUS_BADGE_VARIANT[activeItem.status] ?? 'neutral'}
                                label={activeItem.status}
                            />
                        ) : (!isDocument && !isFolder && item.status) ? (
                            <Badge
                                variant={STATUS_BADGE_VARIANT[item.status] ?? 'neutral'}
                                label={item.status}
                            />
                        ) : null}
                    </div>
                </div>

                <h2
                    className="text-base font-bold text-text leading-snug break-words cursor-default"
                    title={primaryTitle}
                >
                    {primaryTitle}
                </h2>

                <div className="overflow-x-auto scrollbar-none pb-0.5 mt-1">
                    <SegmentSelection
                        value={activeTab}
                        options={tabOptions}
                        onChange={(newTab) => {
                            setActiveTab(newTab);
                            onTabChange?.(newTab);
                        }}
                        className="w-full min-w-max justify-stretch [&>button]:flex-1"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-4">
                {activeTab === 'information' && (
                    <div className="flex flex-col gap-4">
                        {!isCoordinatorRequest &&
                            !isDocumentRequest &&
                            !isDepartment &&
                            !isUser &&
                            (!isFolder
                                ? Boolean(activeItem.summary || activeItem.changeSummary || activeItem.purpose || activeItem.comment || activeItem.rejectionReason)
                                : Boolean(activeItem.comment)) && (
                                <div className="flex flex-col gap-4">
                                    {!isFolder && activeItem.summary && (
                                        <div className="flex flex-col gap-2">
                                            <span className={SECTION_TITLE_STYLE}>Summary</span>
                                            <div className={`${CALLOUT_BOX_STYLE} flex items-start gap-2.5`}>
                                                <Sparkles className="h-4 w-4 text-text-muted shrink-0 mt-0.5" />
                                                <span className="leading-relaxed whitespace-pre-line">{formatDocumentSummary(activeItem.summary)}</span>
                                            </div>
                                        </div>
                                    )}

                                    {activeItem.changeSummary && (
                                        <div className="flex flex-col gap-2">
                                            <span className={SECTION_TITLE_STYLE}>Change Summary</span>
                                            <div className={`${CALLOUT_BOX_STYLE} flex items-start gap-2.5`}>
                                                <Sparkles className="h-4 w-4 text-text-muted shrink-0 mt-0.5" />
                                                <span className="leading-relaxed whitespace-pre-line">{formatChangeSummary(activeItem.changeSummary)}</span>
                                            </div>
                                        </div>
                                    )}

                                    {activeItem.purpose && (
                                        <div className="flex flex-col gap-2">
                                            <span className={SECTION_TITLE_STYLE}>Purpose</span>
                                            <div className={`${CALLOUT_BOX_STYLE} flex items-start gap-2.5`}>
                                                <Info className="h-4 w-4 text-text-muted shrink-0 mt-0.5" />
                                                <span className="leading-relaxed">{activeItem.purpose}</span>
                                            </div>
                                        </div>
                                    )}

                                    {activeItem.comment && (
                                        <div className="flex flex-col gap-2">
                                            <span className={SECTION_TITLE_STYLE}>Comment</span>
                                            <div className={`${CALLOUT_BOX_STYLE} flex items-start gap-2.5`}>
                                                <MessageSquare className="h-4 w-4 text-text-muted shrink-0 mt-0.5" />
                                                <span className="leading-relaxed">{activeItem.comment}</span>
                                            </div>
                                        </div>
                                    )}

                                    {activeItem.rejectionReason && (
                                        <div className="flex flex-col gap-2">
                                            <span className="text-xs font-semibold uppercase tracking-wider text-error select-none">
                                                Rejection Reason
                                            </span>
                                            <div className={ERROR_CALLOUT_STYLE}>
                                                <div className="flex items-center gap-2 font-bold mb-1">
                                                    <AlertCircle className="h-4 w-4" /> Rejection Reason
                                                </div>
                                                {activeItem.rejectionReason}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                        {(isCoordinatorRequest || isDocumentRequest) && effectiveRejectionReason && (
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wider text-error select-none">
                                    Rejection Reason
                                </span>
                                <div className={ERROR_CALLOUT_STYLE}>
                                    <div className="flex items-center gap-2 font-bold mb-1">
                                        <AlertCircle className="h-4 w-4" /> Rejection Reason
                                    </div>
                                    {effectiveRejectionReason}
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            <span className={SECTION_TITLE_STYLE}>System Properties</span>

                            <div className="flex flex-col">
                                {(isDocument || isFolder) && (
                                    <>
                                        {activeItem.version && activeItem.version !== '—' && (
                                            <div className={PROPERTY_ROW_STYLE}>
                                                <span className={PROPERTY_LABEL_STYLE}>
                                                    <Layers className={ICON_STYLE} /> Version
                                                </span>
                                                <span
                                                    className={PROPERTY_VALUE_STYLE}
                                                    title={`Version ${activeItem.version}`}
                                                >
                                                    {String(activeItem.version).startsWith('v')
                                                        ? activeItem.version
                                                        : `v${activeItem.version}`}
                                                </span>
                                            </div>
                                        )}

                                        {formattedFileSize && (
                                            <div className={PROPERTY_ROW_STYLE}>
                                                <span className={PROPERTY_LABEL_STYLE}>
                                                    <HardDrive className={ICON_STYLE} /> Size
                                                </span>
                                                <span
                                                    className={PROPERTY_VALUE_STYLE}
                                                    title={formattedFileSize}
                                                >
                                                    {formattedFileSize}
                                                </span>
                                            </div>
                                        )}

                                        {!isFolder && mimeType && (
                                            <div className={PROPERTY_ROW_STYLE}>
                                                <span className={PROPERTY_LABEL_STYLE}>
                                                    <FileType className={ICON_STYLE} /> MIME Type
                                                </span>
                                                <span
                                                    className="text-xs text-text font-medium truncate max-w-48 cursor-default select-text"
                                                    title={mimeType}
                                                >
                                                    {formatMimeTypeLabel(mimeType)}
                                                </span>
                                            </div>
                                        )}

                                        {!isFolder && checksum && (
                                            <div className={PROPERTY_ROW_STYLE}>
                                                <span className={PROPERTY_LABEL_STYLE}>
                                                    <Hash className={ICON_STYLE} /> SHA-256 Hash
                                                </span>
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span
                                                        className="text-xs text-text-muted truncate max-w-40 cursor-default select-text"
                                                        title={checksum}
                                                    >
                                                        {checksum.substring(0, 14)}...
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleCopyText(checksum, 'checksum')
                                                        }
                                                        className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text transition-colors cursor-pointer"
                                                        title="Copy Full Checksum"
                                                    >
                                                        {copiedPropertyKey === 'checksum' ? (
                                                            <Check className="h-4 w-4 text-accent" />
                                                        ) : (
                                                            <Copy className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {!isFolder && activeItem.classification && activeItem.classification !== '—' && activeItem.classification !== '--' && (
                                            <div className={PROPERTY_ROW_STYLE}>
                                                <span className={PROPERTY_LABEL_STYLE}>
                                                    <Shield className={ICON_STYLE} /> Classification
                                                </span>
                                                <Badge
                                                    variant={CLASSIFICATION_BADGE_VARIANT[activeItem.classification] ?? 'neutral'}
                                                    label={activeItem.classification}
                                                />
                                            </div>
                                        )}

                                        {(() => {
                                            const docVersions = allDocumentVersions.filter(
                                                (v) => (v.document?.id ?? v.documentId) === item.id
                                            );
                                            const earliestVer = [...docVersions].sort(
                                                (a, b) => (a.version ?? 0) - (b.version ?? 0)
                                            )[0];
                                            const uploader = earliestVer?.uploader;
                                            if (!uploader) return null;
                                            const uploaderName = `${uploader.firstName ?? ''} ${uploader.lastName ?? ''}`.trim() || uploader.email || '—';
                                            return (
                                                <div className={PROPERTY_ROW_STYLE}>
                                                    <span className={PROPERTY_LABEL_STYLE}>
                                                        <User className={ICON_STYLE} /> Uploader
                                                    </span>
                                                    <span
                                                        className={PROPERTY_VALUE_STYLE}
                                                        title={uploaderName}
                                                    >
                                                        {uploaderName}
                                                    </span>
                                                </div>
                                            );
                                        })()}

                                        {/* TOTAL READS */}
                                        {(() => {
                                            const isFold = Boolean(item?.isFolder || item?.mimeType === 'folder');
                                            const userMap = new Map((allUsers || []).map((u) => [String(u.id), u]));

                                            if (isFold) {
                                                const descendantIds = new Set(getRecursiveDescendantDocIds(item?.id, allDocuments));
                                                const childDocReadersMap = new Map();
                                                (allAuditLogs || []).forEach((log) => {
                                                    const docId = log?.entityId || log?.document?.id;
                                                    if (!docId || !descendantIds.has(docId)) return;
                                                    const isRead = ['READ', 'VIEW', 'VIEWED', 'DOWNLOAD', 'DOWNLOADED', 'ACCESS', 'ACCESSED'].includes(
                                                        String(log?.action || '').toUpperCase()
                                                    );
                                                    if (!isRead) return;

                                                    const actorId = log?.actor?.id || log?.actorId;
                                                    if (!actorId) return;

                                                    let actorUser = userMap.get(String(actorId)) || log?.actor;
                                                    if (!actorUser && typeof log?.data === 'string') {
                                                        try {
                                                            const parsed = JSON.parse(log.data);
                                                            actorUser = { id: actorId, role: parsed.role, departmentId: parsed.departmentId };
                                                        } catch {
                                                            // ignore malformed log data
                                                        }
                                                    }
                                                    if (!isRmoUser(actorUser, allDepartments)) {
                                                        if (!childDocReadersMap.has(docId)) {
                                                            childDocReadersMap.set(docId, new Set());
                                                        }
                                                        childDocReadersMap.get(docId).add(String(actorId));
                                                    }
                                                });

                                                let combinedCount = 0;
                                                childDocReadersMap.forEach((readersSet) => {
                                                    combinedCount += readersSet.size;
                                                });

                                                return (
                                                    <div className={PROPERTY_ROW_STYLE}>
                                                        <span className={PROPERTY_LABEL_STYLE}>
                                                            <Eye className={ICON_STYLE} /> Total Reads
                                                        </span>
                                                        <span className={PROPERTY_VALUE_STYLE} title={`${combinedCount} combined unique non-RMO reads across folder contents`}>
                                                            {combinedCount} {combinedCount === 1 ? 'read' : 'reads'} (combined)
                                                        </span>
                                                    </div>
                                                );
                                            }

                                            // File: unique non-RMO readers
                                            const targetId = item?.id;
                                            const nonRmoReaders = new Set();
                                            (allAuditLogs || []).forEach((log) => {
                                                const isDoc = log?.entityId === targetId || log?.document?.id === targetId;
                                                const isRead = ['READ', 'VIEW', 'VIEWED', 'DOWNLOAD', 'DOWNLOADED', 'ACCESS', 'ACCESSED'].includes(
                                                    String(log?.action || '').toUpperCase()
                                                );
                                                if (!isDoc || !isRead) return;

                                                const actorId = log?.actor?.id || log?.actorId;
                                                if (!actorId) return;

                                                let actorUser = userMap.get(String(actorId)) || log?.actor;
                                                if (!actorUser && typeof log?.data === 'string') {
                                                    try {
                                                        const parsed = JSON.parse(log.data);
                                                        actorUser = { id: actorId, role: parsed.role, departmentId: parsed.departmentId };
                                                    } catch {
                                                        // ignore malformed log data
                                                    }
                                                }
                                                if (!isRmoUser(actorUser, allDepartments)) {
                                                    nonRmoReaders.add(String(actorId));
                                                }
                                            });

                                            const readCount = nonRmoReaders.size;

                                            return (
                                                <div className={PROPERTY_ROW_STYLE}>
                                                    <span className={PROPERTY_LABEL_STYLE}>
                                                        <Eye className={ICON_STYLE} /> Total Reads
                                                    </span>
                                                    <span className={PROPERTY_VALUE_STYLE} title={`${readCount} unique non-RMO faculty reads`}>
                                                        {readCount} {readCount === 1 ? 'read' : 'reads'}
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                    </>
                                )}

                                {isUser && (
                                    <>
                                        <div className={PROPERTY_ROW_STYLE}>
                                            <span className={PROPERTY_LABEL_STYLE}>
                                                <Tag className={ICON_STYLE} /> University ID
                                            </span>
                                            <span
                                                className="font-semibold text-xs text-text cursor-default select-text"
                                                title={activeUserRecord?.universityId ?? item.universityId}
                                            >
                                                {activeUserRecord?.universityId ?? item.universityId ?? '—'}
                                            </span>
                                        </div>

                                        <div className={PROPERTY_ROW_STYLE}>
                                            <span className={PROPERTY_LABEL_STYLE}>
                                                <User className={ICON_STYLE} /> First Name
                                            </span>
                                            <span
                                                className={PROPERTY_VALUE_STYLE}
                                                title={activeUserRecord?.firstName ?? item.firstName}
                                            >
                                                {activeUserRecord?.firstName ?? item.firstName ?? '—'}
                                            </span>
                                        </div>

                                        <div className={PROPERTY_ROW_STYLE}>
                                            <span className={PROPERTY_LABEL_STYLE}>
                                                <User className={ICON_STYLE} /> Middle Name
                                            </span>
                                            <span
                                                className={PROPERTY_VALUE_STYLE}
                                                title={activeUserRecord?.middleName ?? item.middleName ?? '—'}
                                            >
                                                {activeUserRecord?.middleName ?? item.middleName ?? '—'}
                                            </span>
                                        </div>

                                        <div className={PROPERTY_ROW_STYLE}>
                                            <span className={PROPERTY_LABEL_STYLE}>
                                                <User className={ICON_STYLE} /> Last Name
                                            </span>
                                            <span
                                                className={PROPERTY_VALUE_STYLE}
                                                title={activeUserRecord?.lastName ?? item.lastName}
                                            >
                                                {activeUserRecord?.lastName ?? item.lastName ?? '—'}
                                            </span>
                                        </div>

                                        <div className={PROPERTY_ROW_STYLE}>
                                            <span className={PROPERTY_LABEL_STYLE}>
                                                <User className={ICON_STYLE} /> Email
                                            </span>
                                            <span
                                                className="font-medium text-text truncate max-w-48 cursor-default select-text"
                                                title={activeUserRecord?.email ?? item.email}
                                            >
                                                {activeUserRecord?.email ?? item.email ?? '—'}
                                            </span>
                                        </div>

                                        <div className={PROPERTY_ROW_STYLE}>
                                            <span className={PROPERTY_LABEL_STYLE}>
                                                <Building2 className={ICON_STYLE} /> Department
                                            </span>
                                            <span
                                                className="font-medium text-text truncate max-w-48 cursor-default select-text"
                                                title={userDepartmentDisplay}
                                            >
                                                {userDepartmentDisplay}
                                            </span>
                                        </div>

                                        <div className={PROPERTY_ROW_STYLE}>
                                            <span className={PROPERTY_LABEL_STYLE}>
                                                <Shield className={ICON_STYLE} /> Role
                                            </span>
                                            <Badge
                                                variant="neutral"
                                                label={activeUserRecord?.role ?? item.role ?? 'MEMBER'}
                                            />
                                        </div>

                                        <div className={PROPERTY_ROW_STYLE}>
                                            <span className={PROPERTY_LABEL_STYLE}>
                                                <CheckCircle2 className={ICON_STYLE} /> Status
                                            </span>
                                            <Badge
                                                variant={STATUS_BADGE_VARIANT[activeUserRecord?.status ?? item.status] ?? 'neutral'}
                                                label={activeUserRecord?.status ?? item.status ?? 'VERIFIED'}
                                            />
                                        </div>
                                    </>
                                )}

                                {isDepartment && (
                                    <>
                                        {(activeItem.code ?? item.code) && (
                                            <div className={PROPERTY_ROW_STYLE}>
                                                <span className={PROPERTY_LABEL_STYLE}>
                                                    <Tag className={ICON_STYLE} /> Code
                                                </span>
                                                <span
                                                    className="font-semibold text-xs text-text cursor-default select-text"
                                                    title={activeItem.code ?? item.code}
                                                >
                                                    {activeItem.code ?? item.code}
                                                </span>
                                            </div>
                                        )}

                                        {(activeItem.name ?? item.name) && (
                                            <div className={PROPERTY_ROW_STYLE}>
                                                <span className={PROPERTY_LABEL_STYLE}>
                                                    <Building2 className={ICON_STYLE} /> Name
                                                </span>
                                                <span
                                                    className="font-semibold text-xs text-text cursor-default select-text"
                                                    title={activeItem.name ?? item.name}
                                                >
                                                    {activeItem.name ?? item.name}
                                                </span>
                                            </div>
                                        )}

                                        <div className={PROPERTY_ROW_STYLE}>
                                            <span className={PROPERTY_LABEL_STYLE}>
                                                <Users className={ICON_STYLE} /> Faculty & Staff
                                            </span>
                                            <span
                                                className={PROPERTY_VALUE_STYLE}
                                                title={`${departmentFaculty.length} personnel`}
                                            >
                                                {departmentFaculty.length} personnel
                                            </span>
                                        </div>
                                    </>
                                )}

                                {item.department && !isDepartment && !isUser && !isDocument && !isFolder && (
                                    <div className={PROPERTY_ROW_STYLE}>
                                        <span className={PROPERTY_LABEL_STYLE}>
                                            <Building2 className={ICON_STYLE} /> Department
                                        </span>
                                        <span
                                            className="font-medium text-text truncate max-w-48 cursor-default"
                                            title={item.department}
                                        >
                                            {item.department}
                                        </span>
                                    </div>
                                )}

                                {isDocumentRequest ? (
                                    <div className={PROPERTY_ROW_STYLE}>
                                        <span className={PROPERTY_LABEL_STYLE}>
                                            <User className={ICON_STYLE} /> Requester
                                        </span>
                                        <span
                                            className="font-medium text-text truncate max-w-48 cursor-default select-text"
                                            title={activeItem.requesterName ?? (typeof activeItem.requester === 'string' ? activeItem.requester : '—')}
                                        >
                                            {activeItem.requesterName ?? (typeof activeItem.requester === 'string' ? activeItem.requester : '—')}
                                        </span>
                                    </div>
                                ) : item.requesterName ? (
                                    <div className={PROPERTY_ROW_STYLE}>
                                        <span className={PROPERTY_LABEL_STYLE}>
                                            <User className={ICON_STYLE} /> Requester
                                        </span>
                                        <span
                                            className="font-medium text-text truncate max-w-48 cursor-default"
                                            title={item.requesterName}
                                        >
                                            {item.requesterName}
                                        </span>
                                    </div>
                                ) : null}

                                {isDocumentRequest && (
                                    <div className={PROPERTY_ROW_STYLE}>
                                        <span className={PROPERTY_LABEL_STYLE}>
                                            <CheckCircle2 className={ICON_STYLE} /> Status
                                        </span>
                                        <Badge
                                            variant={
                                                (activeItem.status || '').toUpperCase().includes('RESOLV')
                                                    ? 'success'
                                                    : (activeItem.status || '').toUpperCase().includes('REJECT')
                                                    ? 'error'
                                                    : 'information'
                                            }
                                            label={activeItem.status ?? constants.DOCUMENT_REQUESTS_STATUS.OPEN}
                                        />
                                    </div>
                                )}

                                <div className={PROPERTY_ROW_STYLE}>
                                    <span className={PROPERTY_LABEL_STYLE}>
                                        <Calendar className={ICON_STYLE} />{' '}
                                        {isCoordinatorRequest
                                            ? 'Submitted Date'
                                            : 'Created At'}
                                    </span>
                                    <span
                                        className={PROPERTY_VALUE_STYLE}
                                        title={formattedCreatedDate}
                                    >
                                        {formattedCreatedDate || 'Just now'}
                                    </span>
                                </div>

                                <div className={PROPERTY_ROW_STYLE}>
                                    <span className={PROPERTY_LABEL_STYLE}>
                                        <Clock className={ICON_STYLE} />{' '}
                                        {isCoordinatorRequest
                                            ? 'Last Updated'
                                            : 'Updated At'}
                                    </span>
                                    <span
                                        className={PROPERTY_VALUE_STYLE}
                                        title={formattedUpdatedDate}
                                    >
                                        {formattedUpdatedDate || formattedCreatedDate || 'Just now'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'version' && isDocument && (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className={SECTION_TITLE_STYLE}>Revision History</span>
                            <span className="text-xs text-text-muted">
                                {documentVersions.length} versions
                            </span>
                        </div>

                        <div className="flex flex-col gap-2">
                            {documentVersions.map((versionItem, versionIndex) => {
                                const isCurrent = versionIndex === 0;
                                const uploader = allUsers.find(
                                    (userItem) => userItem.id === (versionItem.uploader?.id ?? versionItem.uploaderId)
                                );
                                const uploaderName = uploader
                                    ? `${uploader.firstName} ${uploader.lastName}`
                                    : 'Author';

                                return (
                                    <div
                                        key={versionItem.id ?? versionIndex}
                                        className="p-3 rounded-md border border-surface-border bg-surface flex flex-col gap-2.5 hover:border-accent-border transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-surface-hover border border-surface-border text-text">
                                                    v{versionItem.version}.0
                                                </span>
                                                {isCurrent && (
                                                    <Badge variant="success" label="Active" />
                                                )}
                                            </div>

                                            <span className="text-xs text-text-muted">
                                                {formatTimestamp(versionItem.createdAt)}
                                            </span>
                                        </div>

                                        {versionItem.changeSummary && (
                                            <div className={`${CALLOUT_BOX_STYLE} flex items-start gap-2.5 py-2 px-2.5`}>
                                                <Sparkles className="h-4 w-4 text-text-muted shrink-0 mt-0.5" />
                                                <span className="leading-relaxed text-xs whitespace-pre-line">
                                                    {formatChangeSummary(versionItem.changeSummary)}
                                                </span>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between gap-2 text-xs text-text-muted pt-1 border-t border-surface-border">
                                            <span className="truncate font-medium">By {uploaderName}</span>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span>{formatBytes(versionItem.sizeBytes)}</span>
                                                {!isCurrent && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setRevertingVersionItem(versionItem)}
                                                        className="p-1 rounded hover:bg-surface-hover text-accent transition-colors cursor-pointer"
                                                        title={`Revert document to v${versionItem.version}.0`}
                                                        aria-label={`Revert document to v${versionItem.version}.0`}
                                                    >
                                                        <RotateCcw className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleActionClick(
                                                            'download_version',
                                                            versionItem
                                                        )
                                                    }
                                                    className="p-1 rounded hover:bg-surface-hover text-text hover:text-accent transition-colors cursor-pointer"
                                                    title={`Download v${versionItem.version}.0`}
                                                >
                                                    <Download className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeTab === 'share' && !isMember && (isDocument || isFolder) && (() => {
                    const visibleSharesCount = departmentShares.length + userShares.length;
                    return (
                    <div className="flex flex-col gap-4">
                        {rootSharedFolder && (
                            <div className="p-3 rounded-xl border border-accent/30 bg-accent/10 flex items-start justify-between gap-3 shadow-2xs">
                                <div className="flex items-start gap-2.5 min-w-0">
                                    <div className="p-1.5 rounded-lg bg-accent/20 text-accent shrink-0 mt-0.5">
                                        <FolderTree className="h-4 w-4" />
                                    </div>
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                        <span className="text-xs font-semibold text-text">
                                            Inherited Share Property
                                        </span>
                                        <p className="text-[11px] text-text-muted leading-relaxed">
                                            This {item.isFolder ? 'folder' : 'file'} is inside <strong className="text-text font-semibold">{rootSharedFolder.title || rootSharedFolder.name}</strong> and follows its permissions.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <span className={SECTION_TITLE_STYLE}>Permissions & Access</span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-text-muted">
                                    {visibleSharesCount} {visibleSharesCount === 1 ? 'share' : 'shares'}
                                </span>
                                {departmentShares.length > 0 && (
                                    <>
                                        <span className="text-surface-border text-xs">•</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const allDeptCollapsed = departmentShares.every((s) => collapsedShareIds.has(s.id));
                                                if (allDeptCollapsed) {
                                                    expandAllShares();
                                                } else {
                                                    collapseAllShares(departmentShares.map((s) => s.id));
                                                }
                                            }}
                                            className="text-xs text-accent hover:underline font-medium cursor-pointer"
                                        >
                                            {departmentShares.every((s) => collapsedShareIds.has(s.id)) ? 'Expand All' : 'Collapse All'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {visibleSharesCount === 0 ? (
                            <div className="p-3.5 rounded-lg border border-surface-border bg-surface-hover text-center text-text-muted text-xs">
                                No sharing rules configured yet.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {departmentShares.length > 0 && (
                                    <div className="flex flex-col gap-2">
                                    {departmentShares.map((shareItem) => {
                                        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
                                        const rawShareDept = shareItem.department?.id ?? shareItem.departmentId ?? (typeof shareItem.department === 'string' ? shareItem.department : null);
                                        const shareDepartment = allDepartments.find(
                                            (d) => cleanId(d.id) === cleanId(rawShareDept) ||
                                                (typeof rawShareDept === 'string' && d.name?.toLowerCase() === rawShareDept.toLowerCase()) ||
                                                (typeof rawShareDept === 'string' && d.code?.toLowerCase() === rawShareDept.toLowerCase()) ||
                                                (shareItem.department?.name && d.name?.toLowerCase() === shareItem.department.name.toLowerCase())
                                        ) ?? shareItem.department;

                                        const targetDeptClean = cleanId(shareDepartment?.id ?? shareItem.department?.id ?? shareItem.departmentId);
                                        const shareDeptNameClean = (shareDepartment?.name ?? (typeof shareItem.department === 'string' ? shareItem.department : null))?.toLowerCase();
                                        const shareDeptCodeClean = shareDepartment?.code?.toLowerCase();
                                        const publisherName = resolvePublisherName(shareItem);

                                        const isFold = Boolean(item?.isFolder || item?.mimeType === 'folder');

                                        const isUserInDept = (u) => {
                                            const rawUDept = u.departmentId ?? u.department?.id ?? u.department;
                                            const uClean = cleanId(rawUDept);
                                            if (targetDeptClean && uClean && targetDeptClean === uClean) return true;
                                            const matchedUDept = allDepartments.find((d) =>
                                                cleanId(d.id) === uClean ||
                                                (typeof rawUDept === 'string' && d.name?.toLowerCase() === rawUDept.toLowerCase()) ||
                                                (typeof rawUDept === 'string' && d.code?.toLowerCase() === rawUDept.toLowerCase())
                                            );
                                            const uDeptId = cleanId(matchedUDept?.id ?? u.departmentId ?? u.department?.id);
                                            const uDeptName = (matchedUDept?.name ?? (typeof u.department === 'string' ? u.department : null))?.toLowerCase();
                                            const uDeptCode = matchedUDept?.code?.toLowerCase();

                                            return Boolean(
                                                (targetDeptClean && uDeptId && targetDeptClean === uDeptId) ||
                                                (shareDeptNameClean && uDeptName && shareDeptNameClean === uDeptName) ||
                                                (shareDeptCodeClean && uDeptCode && shareDeptCodeClean === uDeptCode) ||
                                                (shareDeptCodeClean && uDeptName && shareDeptCodeClean === uDeptName)
                                            );
                                        };

                                        const deptFaculty = (allUsers || []).filter(
                                            (u) => isUserInDept(u) && constants.isMemberRole(u.role)
                                        );
                                        const deptFacultyMemberIds = new Set(deptFaculty.map((u) => cleanId(u.id)));

                                        let deptReadCount;
                                        let deptAuditLogs;
                                        let uniqueReadersCount;

                                        const readMemberIdsSet = new Set();
                                        const rawDescendantIds = isFold ? getRecursiveDescendantDocIds(item?.id, allDocuments) : [];
                                        const descendantIds = new Set();
                                        rawDescendantIds.forEach((id) => {
                                            descendantIds.add(id);
                                            descendantIds.add(cleanId(id));
                                        });
                                        const cleanTargetId = cleanId(item?.id);

                                        if (isFold) {
                                            const childDocDeptReadersMap = new Map();
                                            const deptLogs = [];

                                            (allAuditLogs || []).forEach((log) => {
                                                const docId = log?.entityId || log?.document?.id || log?.documentId;
                                                if (!docId || (!descendantIds.has(docId) && !descendantIds.has(cleanId(docId)))) return;
                                                const isReadAction = ['READ', 'VIEW', 'VIEWED', 'DOWNLOAD', 'DOWNLOADED', 'ACCESS', 'ACCESSED', 'OPEN', 'OPENED'].includes(String(log?.action || '').toUpperCase());
                                                if (!isReadAction) return;

                                                const actorId = String(log?.actor?.id ?? log?.actorId ?? '');
                                                const actorClean = cleanId(actorId);
                                                if (!actorClean || !deptFacultyMemberIds.has(actorClean)) return;

                                                const normalizedDocId = cleanId(docId);
                                                if (!childDocDeptReadersMap.has(normalizedDocId)) {
                                                    childDocDeptReadersMap.set(normalizedDocId, new Set());
                                                }
                                                if (!childDocDeptReadersMap.get(normalizedDocId).has(actorClean)) {
                                                    childDocDeptReadersMap.get(normalizedDocId).add(actorClean);
                                                    deptLogs.push(log);
                                                }
                                                readMemberIdsSet.add(actorClean);
                                            });

                                            let totalDeptReads = 0;
                                            childDocDeptReadersMap.forEach((readersSet) => {
                                                totalDeptReads += readersSet.size;
                                            });
                                            deptReadCount = totalDeptReads;
                                            deptAuditLogs = deptLogs;
                                        } else {
                                            const nonRmoUserFirstReadLogs = new Map();

                                            (allAuditLogs || []).forEach((log) => {
                                                const docId = log?.entityId || log?.document?.id || log?.documentId;
                                                const isDoc = docId && cleanId(docId) === cleanTargetId;
                                                const isReadAction = ['READ', 'VIEW', 'VIEWED', 'DOWNLOAD', 'DOWNLOADED', 'ACCESS', 'ACCESSED', 'OPEN', 'OPENED'].includes(String(log?.action || '').toUpperCase());
                                                if (!isDoc || !isReadAction) return;

                                                const actorId = String(log?.actor?.id ?? log?.actorId ?? '');
                                                const actorClean = cleanId(actorId);
                                                if (!actorClean || !deptFacultyMemberIds.has(actorClean)) return;

                                                if (!nonRmoUserFirstReadLogs.has(actorClean)) {
                                                    nonRmoUserFirstReadLogs.set(actorClean, log);
                                                }
                                                readMemberIdsSet.add(actorClean);
                                            });

                                            deptReadCount = nonRmoUserFirstReadLogs.size;
                                            deptAuditLogs = Array.from(nonRmoUserFirstReadLogs.values());
                                        }

                                        // Also incorporate direct member user share read states (e.g. from individual member shares)
                                        (documentShares || []).forEach((s) => {
                                            const sDocId = cleanId(s.document?.id ?? s.documentId);
                                            const isDoc = isFold
                                                ? (sDocId && descendantIds.has(sDocId))
                                                : (sDocId === cleanTargetId);
                                            if (!isDoc) return;

                                            const recId = cleanId(s.recipientId ?? s.recipient?.id);
                                            if (recId && deptFacultyMemberIds.has(recId)) {
                                                if (s.isRead || String(s.status || '').toUpperCase() === 'READ' || s.readAt) {
                                                    readMemberIdsSet.add(recId);
                                                }
                                            }
                                        });

                                        uniqueReadersCount = readMemberIdsSet.size;
                                        const totalDeptMembers = deptFaculty.length > 0 ? deptFaculty.length : (uniqueReadersCount || 1);

                                        const deptUserShares = userShares.filter((us) => {
                                            const usDeptClean = cleanId(us.department?.id ?? us.departmentId);
                                            if (usDeptClean && usDeptClean === targetDeptClean) return true;
                                            const recipientId = us.recipientId ?? us.recipient?.id;
                                            const recUser = allUsers.find((u) => u.id === recipientId);
                                            return recUser && isUserInDept(recUser);
                                        });

                                        const isDeptPublished = String(shareItem.status || '').toUpperCase() === constants.DOCUMENT_SHARES_STATUS.PUBLISHED;
                                        const isAllMembersPublished = isDeptPublished && (
                                            deptUserShares.length === 0 ||
                                            (deptFaculty.length > 0 && deptUserShares.length >= deptFaculty.length)
                                        );

                                        const isCollapsed = collapsedShareIds.has(shareItem.id);

                                        return (
                                            <div
                                                key={shareItem.id}
                                                className="p-3.5 rounded-lg border border-surface-border bg-surface-hover flex flex-col gap-3 transition-all"
                                            >
                                                <div
                                                    onClick={() => toggleShareCollapse(shareItem.id)}
                                                    className="flex items-center justify-between gap-2 cursor-pointer select-none group"
                                                    title={isCollapsed ? 'Click to expand details' : 'Click to collapse'}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                                        <Building2 className="h-4 w-4 text-accent shrink-0" />
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="font-semibold text-xs text-text truncate group-hover:text-accent transition-colors">
                                                                {shareDepartment?.name ?? 'University Wide'}
                                                            </span>
                                                            {isCollapsed && (
                                                                <span className="text-[10px] text-text-muted truncate">
                                                                    {isAllMembersPublished
                                                                        ? `${totalDeptMembers} member${totalDeptMembers === 1 ? '' : 's'} • ${uniqueReadersCount}/${totalDeptMembers} read`
                                                                        : `${deptUserShares.length} published • ${uniqueReadersCount}/${deptUserShares.length} read`}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <Badge
                                                            variant={STATUS_BADGE_VARIANT[shareItem.status] ?? 'neutral'}
                                                            label={shareItem.status}
                                                        />
                                                        <button
                                                            type="button"
                                                            className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover/80 transition-colors cursor-pointer"
                                                            aria-label={isCollapsed ? 'Expand share details' : 'Collapse share details'}
                                                        >
                                                            {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                                                        </button>
                                                    </div>
                                                </div>

                                                {!isCollapsed && (
                                                <>

                                                {/* REJECTION FEEDBACK CALLOUT & ADMIN RESHARE ACTIONS */}
                                                {(() => {
                                                    const isShareRejected = shareItem.status === constants.DOCUMENT_SHARES_STATUS.REJECTED;
                                                    if (!isShareRejected) return null;

                                                    const latestVer = documentVersions[0];
                                                    const rejectionReason = shareItem.rejectionReason || latestVer?.rejectionReason || 'No rejection reason specified.';
                                                    const rejecter = allUsers.find((u) => u.id === latestVer?.rejecterId || u.id === shareItem.rejecterId || u.id === shareItem.reviewerId);
                                                    const rejecterName = rejecter ? `${rejecter.firstName || ''} ${rejecter.lastName || ''}`.trim() : null;

                                                    return (
                                                        <div className="p-3 rounded-lg border border-error/30 bg-error/10 flex flex-col gap-2.5">
                                                            <div className="flex items-start gap-2">
                                                                <AlertTriangle className="h-4 w-4 text-error shrink-0 mt-0.5" />
                                                                <div className="flex flex-col gap-0.5 min-w-0">
                                                                    <span className="text-xs font-semibold text-error">
                                                                        Share Rejected by Department Reviewer {rejecterName ? `(${rejecterName})` : ''}
                                                                    </span>
                                                                    <p className="text-xs text-text leading-relaxed">
                                                                        &ldquo;{rejectionReason}&rdquo;
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {/* ADMIN RESHARE ACTIONS */}
                                                            {isAdmin && (
                                                                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-error/20">
                                                                    <Button
                                                                        variant="primary"
                                                                        size="xs"
                                                                        leadingIcon={UploadCloud}
                                                                        onClick={() => {
                                                                            setReshareModal({
                                                                                mode: 'new_version',
                                                                                shareItem,
                                                                                docId: item.id,
                                                                                targetDeptName: shareDepartment?.name ?? 'Department',
                                                                            });
                                                                            setReshareFile(null);
                                                                            setReshareChangeSummary('Revision addressing rejection feedback');
                                                                        }}
                                                                        className="truncate text-[11px]"
                                                                    >
                                                                        Reshare (New Version)
                                                                    </Button>
                                                                    <Button
                                                                        variant="secondary"
                                                                        size="xs"
                                                                        leadingIcon={FileCheck}
                                                                        onClick={() => {
                                                                            setReshareModal({
                                                                                mode: 'overwrite',
                                                                                shareItem,
                                                                                docId: item.id,
                                                                                targetDeptName: shareDepartment?.name ?? 'Department',
                                                                            });
                                                                            setReshareFile(null);
                                                                            setReshareChangeSummary('');
                                                                        }}
                                                                        className="truncate text-[11px]"
                                                                    >
                                                                        Overwrite File & Reshare
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}

                                                {/* VISUAL WORKFLOW TRACKING PIPELINE (4 NODES) */}
                                                {(() => {
                                                    const statusUpper = String(shareItem.status || '').toUpperCase();
                                                    const isRejected = statusUpper.includes('REJECT');

                                                    const isStashed = statusUpper === constants.DOCUMENT_SHARES_STATUS.STASHED;
                                                    const isPublished = statusUpper === constants.DOCUMENT_SHARES_STATUS.PUBLISHED;
                                                    const isDirectorApproved = statusUpper === constants.DOCUMENT_SHARES_STATUS.APPROVED;
                                                    const isOfficerPending = statusUpper === constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL;

                                                    // Determine active step:
                                                    // 1: You (Origin / Draft)
                                                    // 2: Officer (Pending Approval / Review)
                                                    // 3: Director (Approved / Pre-publish)
                                                    // 4: Terminal Branch (Stashed or Published)
                                                    let currentStep = 1;
                                                    if (isStashed || isPublished) {
                                                        currentStep = 4;
                                                    } else if (isDirectorApproved) {
                                                        currentStep = 3;
                                                    } else if (isOfficerPending || isRejected) {
                                                        currentStep = 2;
                                                    }

                                                    // Connector line styles with smooth gradients where the color transitions:
                                                    const getLineStyle = (lineIndex) => {
                                                        if (lineIndex === 1) {
                                                            if (currentStep > 2) {
                                                                return { backgroundColor: 'var(--color-accent)' };
                                                            }
                                                            if (currentStep === 2) {
                                                                return {
                                                                    background: isRejected
                                                                        ? 'linear-gradient(to right, var(--color-accent), var(--color-error))'
                                                                        : 'linear-gradient(to right, var(--color-accent), var(--color-warning))',
                                                                };
                                                            }
                                                            if (currentStep === 1) {
                                                                return {
                                                                    background: 'linear-gradient(to right, var(--color-warning), var(--color-surface-border))',
                                                                };
                                                            }
                                                            return { backgroundColor: 'var(--color-surface-border)' };
                                                        }

                                                        if (lineIndex === 2) {
                                                            if (currentStep > 3) {
                                                                return { backgroundColor: 'var(--color-accent)' };
                                                            }
                                                            if (currentStep === 3) {
                                                                return {
                                                                    background: 'linear-gradient(to right, var(--color-accent), var(--color-warning))',
                                                                };
                                                            }
                                                            return { backgroundColor: 'var(--color-surface-border)' };
                                                        }

                                                        if (lineIndex === 3) {
                                                            if (currentStep === 4) {
                                                                return { backgroundColor: 'var(--color-accent)' };
                                                            }
                                                            return { backgroundColor: 'var(--color-surface-border)' };
                                                        }

                                                        return { backgroundColor: 'var(--color-surface-border)' };
                                                    };

                                                    // Helper for Pill styling (matching the 2-branch design):
                                                    const getPillStyles = (nodeStep, isNodeRejected = false) => {
                                                        const isPassed = currentStep > nodeStep;
                                                        const isCurrent = currentStep === nodeStep;

                                                        if (isNodeRejected && isCurrent) {
                                                            return 'bg-error text-text-inverted border-error font-bold ring-2 ring-error/30 shadow-xs';
                                                        }
                                                        if (isCurrent) {
                                                            return 'bg-warning text-text-inverted border-warning font-bold ring-2 ring-warning/30 shadow-xs animate-pulse';
                                                        }
                                                        if (isPassed) {
                                                            return 'bg-accent text-text-inverted border-accent font-semibold shadow-xs ring-1 ring-accent/30';
                                                        }
                                                        return 'bg-surface/50 border-surface-border text-text-muted/50 font-normal';
                                                    };

                                                    const node1Class = getPillStyles(1);
                                                    const node2Class = getPillStyles(2, isRejected);
                                                    const node3Class = getPillStyles(3);

                                                    // Branch fork paths & node styling:
                                                    const forkStashedColor = isStashed ? 'var(--color-accent)' : 'var(--color-surface-border)';
                                                    const forkPublishedColor = isPublished ? 'var(--color-accent)' : 'var(--color-surface-border)';

                                                    const stashedNodeClass = isStashed
                                                        ? 'bg-accent text-text-inverted border-accent font-bold ring-2 ring-accent/30 shadow-xs'
                                                        : 'bg-surface/50 border-surface-border text-text-muted/40 font-normal';

                                                    const publishedNodeClass = isPublished
                                                        ? 'bg-accent text-text-inverted border-accent font-bold ring-2 ring-accent/30 shadow-xs'
                                                        : 'bg-surface/50 border-surface-border text-text-muted/40 font-normal';

                                                    return (
                                                        <div className="p-2.5 rounded-md border border-surface-border bg-surface/60 flex flex-col gap-2">
                                                            <div className="flex items-center justify-between text-[11px] font-semibold text-text-muted select-none">
                                                                <span>Workflow Progress</span>
                                                                <span className="text-[10px] font-medium text-text-muted/80">Lifecycle Review</span>
                                                            </div>

                                                            {/* EQUAL DISTANCE WORKFLOW TRACK (PILL BADGES) */}
                                                            <div className="flex items-center w-full pt-1 pb-0.5">
                                                                {/* 1. NODE 1: YOU */}
                                                                <div
                                                                    className={`flex items-center justify-center px-2 py-0.5 rounded-md border text-[10px] transition-all select-none shrink-0 ${node1Class}`}
                                                                    title="You (Origin / Created)"
                                                                >
                                                                    <span>You</span>
                                                                </div>

                                                                {/* CONNECTOR 1 -> 2 (EQUAL DISTANCE WITH GRADIENT) */}
                                                                <div
                                                                    className="flex-1 h-0.5 transition-all duration-300 min-w-2 rounded-full"
                                                                    style={getLineStyle(1)}
                                                                />

                                                                {/* 2. NODE 2: OFFICER */}
                                                                <div
                                                                    className={`flex items-center justify-center px-2 py-0.5 rounded-md border text-[10px] transition-all select-none shrink-0 ${node2Class}`}
                                                                    title="Officer Review (Pending Approval)"
                                                                >
                                                                    <span>Officer</span>
                                                                </div>

                                                                {/* CONNECTOR 2 -> 3 (EQUAL DISTANCE WITH GRADIENT) */}
                                                                <div
                                                                    className="flex-1 h-0.5 transition-all duration-300 min-w-2 rounded-full"
                                                                    style={getLineStyle(2)}
                                                                />

                                                                {/* 3. NODE 3: DIRECTOR */}
                                                                <div
                                                                    className={`flex items-center justify-center px-2 py-0.5 rounded-md border text-[10px] transition-all select-none shrink-0 ${node3Class}`}
                                                                    title="Director Review (Approved)"
                                                                >
                                                                    <span>Director</span>
                                                                </div>

                                                                {/* CONNECTOR 3 -> BRANCH FORK (EQUAL DISTANCE) */}
                                                                <div
                                                                    className="flex-1 h-0.5 transition-all duration-300 min-w-2 rounded-full"
                                                                    style={getLineStyle(3)}
                                                                />

                                                                {/* BRANCH CONNECTOR (SVG FORK) */}
                                                                <div className="w-3.5 h-11 shrink-0 flex items-center">
                                                                    <svg className="w-3.5 h-11 shrink-0" viewBox="0 0 14 44" fill="none">
                                                                        <path
                                                                            d="M 0 22 H 4 C 8 22, 9 9, 14 9"
                                                                            stroke={forkStashedColor}
                                                                            strokeWidth={isStashed ? '2.5' : '1.5'}
                                                                            strokeLinecap="round"
                                                                            className="transition-all duration-300"
                                                                        />
                                                                        <path
                                                                            d="M 0 22 H 4 C 8 22, 9 35, 14 35"
                                                                            stroke={forkPublishedColor}
                                                                            strokeWidth={isPublished ? '2.5' : '1.5'}
                                                                            strokeLinecap="round"
                                                                            className="transition-all duration-300"
                                                                        />
                                                                    </svg>
                                                                </div>

                                                                {/* 4. BRANCHING NODES: TOP (STASHED) & BOTTOM (PUBLISHED) */}
                                                                <div className="h-11 flex flex-col justify-between shrink-0">
                                                                    {/* TOP BRANCH: STASHED */}
                                                                    <div
                                                                        className={`flex items-center justify-center px-1.5 py-0.5 rounded-md border text-[9px] transition-all select-none truncate ${stashedNodeClass}`}
                                                                        title="Stashed (Archived / Internal Reserve)"
                                                                    >
                                                                        <span>Stashed</span>
                                                                    </div>

                                                                    {/* BOTTOM BRANCH: PUBLISHED */}
                                                                    <div
                                                                        className={`flex items-center justify-center px-1.5 py-0.5 rounded-md border text-[9px] transition-all select-none truncate ${publishedNodeClass}`}
                                                                        title="Published (Active / Distributed to Members)"
                                                                    >
                                                                        <span>Published</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {/* DEPARTMENT READERSHIP STATISTIC & READERSHIP CHART */}
                                                <div className="p-2.5 rounded-md border border-surface-border bg-surface/50 flex flex-col gap-1.5">
                                                    <div className="flex items-center justify-between text-[11px]">
                                                        <span className="font-semibold text-text-muted flex items-center gap-1.5">
                                                            <Eye className="h-3 w-3 text-accent" />
                                                            <span>Unit Readership</span>
                                                        </span>
                                                        <span className="text-[10px] font-medium text-text">
                                                            {deptReadCount} {deptReadCount === 1 ? 'read' : 'reads'}
                                                            {isFold ? ' (combined)' : ''}
                                                            {isFold && uniqueReadersCount > 0 ? ` • ${uniqueReadersCount} unique ${uniqueReadersCount === 1 ? 'reader' : 'readers'}` : ''}
                                                        </span>
                                                    </div>
                                                    <div className="w-full pt-1">
                                                        <ReadershipChart logs={deptAuditLogs} compact={true} showPeak={false} />
                                                    </div>
                                                </div>

                                                {/* MEMBER ACCESS SUBSECTION */}
                                                {(isAllMembersPublished || deptUserShares.length > 0) && (
                                                    <div className="flex flex-col gap-1.5 pt-1 border-t border-surface-border">
                                                        <div className="flex items-center justify-between text-[11px] font-semibold text-text-muted select-none">
                                                            <span>Member Distribution</span>
                                                            <span className="text-[10px] font-medium text-text-muted/80">
                                                                {isAllMembersPublished ? 'Converged Access' : `${deptUserShares.length} Selected`}
                                                            </span>
                                                        </div>
                                                        {isAllMembersPublished ? (
                                                            <div className="px-2.5 py-2 rounded-md border border-surface-border bg-surface/50 flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <div className="w-6 h-6 rounded-full bg-accent/15 text-accent flex items-center justify-center shrink-0">
                                                                        <Users className="h-3.5 w-3.5" />
                                                                    </div>
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className="font-semibold text-xs text-text truncate leading-tight">
                                                                            {shareDepartment?.code ? `${shareDepartment.code} Members` : `${shareDepartment?.name || 'Department'} Members`}
                                                                        </span>
                                                                        <span className="text-[10px] text-text-muted truncate leading-tight">
                                                                            All {totalDeptMembers} Department Members
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    <div className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent/15 text-accent border border-accent/20">
                                                                        {uniqueReadersCount} / {totalDeptMembers} read
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col gap-1.5">
                                                                {deptUserShares.map((uShare) => {
                                                                    const recId = uShare.recipient?.id ?? uShare.recipientId;
                                                                    const recClean = cleanId(recId);
                                                                    const recipientUser = allUsers.find((u) => cleanId(u.id) === recClean) ?? uShare.recipient;
                                                                    const recipientName = recipientUser
                                                                        ? `${recipientUser.firstName || ''} ${recipientUser.lastName || ''}`.trim() || recipientUser.name || 'User'
                                                                        : 'User';

                                                                    const isRecipientRead = Boolean(
                                                                        uShare.isRead ||
                                                                        String(uShare.status || '').toUpperCase() === 'READ' ||
                                                                        uShare.readAt ||
                                                                        allAuditLogs.some(
                                                                            (log) =>
                                                                                (log.actor?.id === recId || log.actorId === recId) &&
                                                                                (log.entityId === item.id || log.document?.id === item.id) &&
                                                                                ['READ', 'VIEW', 'DOWNLOAD', 'OPEN'].includes(String(log.action || '').toUpperCase())
                                                                        )
                                                                    );

                                                                    const uPublisherName = resolvePublisherName(uShare);

                                                                    return (
                                                                        <div
                                                                            key={uShare.id}
                                                                            className="px-2.5 py-2 rounded-md border border-surface-border bg-surface/50 hover:bg-surface transition-colors flex flex-col gap-1.5"
                                                                        >
                                                                            <div className="flex items-center justify-between gap-2">
                                                                                <div className="flex items-center gap-2 min-w-0">
                                                                                    <Avatar
                                                                                        src={resolveUserAvatar(recipientUser, activeUser)}
                                                                                        user={recipientUser}
                                                                                        alt={recipientName}
                                                                                        size="small"
                                                                                    />
                                                                                    <div className="flex flex-col min-w-0">
                                                                                        <span className="font-semibold text-xs text-text truncate leading-tight" title={recipientName}>
                                                                                            {recipientName}
                                                                                        </span>
                                                                                        {recipientUser?.email && (
                                                                                            <span className="text-[10px] text-text-muted truncate leading-tight" title={recipientUser.email}>
                                                                                                {recipientUser.email}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>

                                                                                {/* COMPACT 2-NODE TRACKING: SENT -> READ */}
                                                                                <div className="flex items-center w-24 shrink-0">
                                                                                    <div
                                                                                        className="flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] select-none shrink-0 bg-accent text-text-inverted border border-accent font-semibold shadow-2xs"
                                                                                        title="Sent"
                                                                                    >
                                                                                        <span>Sent</span>
                                                                                    </div>

                                                                                    <div
                                                                                        className="flex-1 h-0.5 min-w-2 transition-all duration-300 rounded-full"
                                                                                        style={
                                                                                            isRecipientRead
                                                                                                ? { backgroundColor: 'var(--color-accent)' }
                                                                                                : { background: 'linear-gradient(to right, var(--color-accent), var(--color-warning))' }
                                                                                        }
                                                                                    />

                                                                                    <div
                                                                                        className={`flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] select-none shrink-0 transition-all ${
                                                                                            isRecipientRead
                                                                                                ? 'bg-accent text-text-inverted border border-accent font-semibold shadow-2xs'
                                                                                                : 'bg-warning text-text-inverted border border-warning font-bold ring-1 ring-warning/30 shadow-2xs animate-pulse'
                                                                                        }`}
                                                                                        title={isRecipientRead ? 'Read' : 'Pending read'}
                                                                                    >
                                                                                        <span>Read</span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            {/* COMPACT FOOTER */}
                                                                            <div className="flex items-center justify-between text-[10px] text-text-muted pt-1 border-t border-surface-border/60 leading-none">
                                                                                <span className="truncate">
                                                                                    Shared by {uPublisherName} • {formatTimestamp(uShare.createdAt)}
                                                                                </span>
                                                                                {isDirector && !isStaff && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            handleActionClick('unpublish', uShare);
                                                                                        }}
                                                                                        className="text-error hover:underline cursor-pointer font-medium ml-2 shrink-0"
                                                                                    >
                                                                                        Unpublish
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-between text-xs text-text-muted pt-1 border-t border-surface-border">
                                                    <span>
                                                        Shared by {publisherName}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <span>{formatTimestamp(shareItem.createdAt)}</span>
                                                        {isStaff && !isDirector && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleActionClick('unshare', rootSharedFolder ? rootSharedFolder : shareItem);
                                                                }}
                                                                className="text-error hover:underline cursor-pointer font-medium ml-1"
                                                            >
                                                                Unshare
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                </>
                                                )}
                                            </div>
                                        );
                                    })}
                                    </div>
                                )}

                                {/* ORPHAN USER SHARES (Fallback if not mapped to any department share) */}
                                {(() => {
                                    const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
                                    const deptIdsSet = new Set(
                                        departmentShares.map((ds) => cleanId(ds.department?.id ?? ds.departmentId)).filter(Boolean)
                                    );
                                    const orphanUserShares = userShares.filter((us) => {
                                        const usDeptClean = cleanId(us.department?.id ?? us.departmentId);
                                        if (usDeptClean && deptIdsSet.has(usDeptClean)) return false;
                                        const recipientId = us.recipientId ?? us.recipient?.id;
                                        const recUser = allUsers.find((u) => cleanId(u.id) === cleanId(recipientId));
                                        const recDeptClean = cleanId(recUser?.departmentId ?? recUser?.department?.id);
                                        if (recDeptClean && deptIdsSet.has(recDeptClean)) return false;
                                        return true;
                                    });

                                    if (orphanUserShares.length === 0) return null;
                                    return (
                                        <div className="flex flex-col gap-1.5 pt-2 border-t border-surface-border">
                                            <span className="text-[11px] font-semibold text-text-muted select-none">
                                                Direct Member Shares
                                            </span>
                                            {orphanUserShares.map((shareItem) => {
                                                const recId = shareItem.recipient?.id ?? shareItem.recipientId;
                                                const recClean = cleanId(recId);
                                                const recipientUser = allUsers.find((u) => cleanId(u.id) === recClean) ?? shareItem.recipient;
                                                const recipientName = recipientUser
                                                    ? `${recipientUser.firstName || ''} ${recipientUser.lastName || ''}`.trim() || recipientUser.name || 'User'
                                                    : 'User';

                                                const isRecipientRead = Boolean(
                                                    shareItem.isRead ||
                                                    String(shareItem.status || '').toUpperCase() === 'READ' ||
                                                    shareItem.readAt ||
                                                    allAuditLogs.some(
                                                        (log) =>
                                                            (log.actor?.id === recId || log.actorId === recId) &&
                                                            (log.entityId === item.id || log.document?.id === item.id) &&
                                                            ['READ', 'VIEW', 'DOWNLOAD', 'OPEN'].includes(String(log.action || '').toUpperCase())
                                                    )
                                                );

                                                const publisherName = resolvePublisherName(shareItem);

                                                return (
                                                    <div
                                                        key={shareItem.id}
                                                        className="px-2.5 py-2 rounded-md border border-surface-border bg-surface-hover/70 hover:bg-surface-hover transition-colors flex flex-col gap-1.5"
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <Avatar
                                                                    src={resolveUserAvatar(recipientUser, activeUser)}
                                                                    user={recipientUser}
                                                                    alt={recipientName}
                                                                    size="small"
                                                                />
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="font-semibold text-xs text-text truncate leading-tight" title={recipientName}>
                                                                        {recipientName}
                                                                    </span>
                                                                    {recipientUser?.email && (
                                                                        <span className="text-[10px] text-text-muted truncate leading-tight" title={recipientUser.email}>
                                                                            {recipientUser.email}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* COMPACT 2-NODE TRACKING: SENT -> READ */}
                                                            <div className="flex items-center w-24 shrink-0">
                                                                <div
                                                                    className="flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] select-none shrink-0 bg-accent text-text-inverted border border-accent font-semibold shadow-2xs"
                                                                    title="Sent"
                                                                >
                                                                    <span>Sent</span>
                                                                </div>

                                                                <div
                                                                    className="flex-1 h-0.5 min-w-2 transition-all duration-300 rounded-full"
                                                                    style={
                                                                        isRecipientRead
                                                                            ? { backgroundColor: 'var(--color-accent)' }
                                                                            : { background: 'linear-gradient(to right, var(--color-accent), var(--color-warning))' }
                                                                    }
                                                                />

                                                                <div
                                                                    className={`flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] select-none shrink-0 transition-all ${
                                                                        isRecipientRead
                                                                            ? 'bg-accent text-text-inverted border border-accent font-semibold shadow-2xs'
                                                                            : 'bg-warning text-text-inverted border border-warning font-bold ring-1 ring-warning/30 shadow-2xs animate-pulse'
                                                                    }`}
                                                                    title={isRecipientRead ? 'Read' : 'Pending read'}
                                                                >
                                                                    <span>Read</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* COMPACT FOOTER */}
                                                        <div className="flex items-center justify-between text-[10px] text-text-muted pt-1 border-t border-surface-border/60 leading-none">
                                                            <span className="truncate">
                                                                Shared by {publisherName} • {formatTimestamp(shareItem.createdAt)}
                                                            </span>
                                                            {isDirector && !isStaff && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleActionClick('unpublish', shareItem);
                                                                    }}
                                                                    className="text-error hover:underline cursor-pointer font-medium ml-2 shrink-0"
                                                                >
                                                                    Unpublish
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                    );
                })()}

                {activeTab === 'content' && isFolder && (() => {
                    const renderDirectoryNode = (node, depth = 0) => {
                        const isFolderNode = node.isFolder;
                        const isExpanded = expandedFolderIds.has(node.id);
                        const isSelected = selectedTreeItemId === node.id;
                        const childCount = node.childContentCount ?? 0;
                        const hasSubChildren = childCount > 0;

                        return (
                            <div key={node.id} className="flex flex-col select-none">
                                <div
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setSelectedTreeItemId((prev) => (prev === node.id ? null : node.id));
                                    }}
                                    onDoubleClick={(event) => {
                                        event.stopPropagation();
                                        if (isFolderNode) {
                                            if (item.isArchived || node.isArchived) {
                                                showToast({
                                                    type: 'warning',
                                                    title: 'Archived Folder',
                                                    description: 'Cannot browse contents of an archived folder. Restore the folder to view its contents.',
                                                });
                                                return;
                                            }
                                            handleActionClick('open', {
                                                ...node,
                                                parentId: node.parentId ?? item.id,
                                            });
                                        } else {
                                            if (item.isArchived || node.isArchived) {
                                                showToast({
                                                    type: 'warning',
                                                    title: 'Archived Document',
                                                    description: 'Cannot view an archived document.',
                                                });
                                                return;
                                            }
                                            handleActionClick('open', {
                                                ...node,
                                                parentId: node.parentId ?? item.id,
                                            });
                                        }
                                    }}
                                    style={{ paddingLeft: `${depth * 14 + 6}px` }}
                                    className={`group flex items-center justify-between gap-2 py-1.5 pr-2 rounded-md cursor-pointer transition-colors text-xs ${
                                        isSelected
                                            ? 'bg-accent/15 text-accent font-semibold border border-accent/30'
                                            : 'text-text hover:bg-surface-hover border border-transparent'
                                    }`}
                                >
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                        {isFolderNode ? (
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    if (item.isArchived || node.isArchived) {
                                                        showToast({
                                                            type: 'warning',
                                                            title: 'Archived Folder',
                                                            description: 'Cannot browse contents of an archived folder. Restore the folder to view its contents.',
                                                        });
                                                        return;
                                                    }
                                                    setExpandedFolderIds((prev) => {
                                                        const next = new Set(prev);
                                                        if (next.has(node.id)) {
                                                            next.delete(node.id);
                                                        } else {
                                                            next.add(node.id);
                                                        }
                                                        return next;
                                                    });
                                                }}
                                                className="p-0.5 hover:bg-surface-border/50 rounded text-text-muted hover:text-text shrink-0 cursor-pointer"
                                                title={isExpanded ? 'Collapse folder' : 'Expand folder'}
                                            >
                                                {isExpanded ? (
                                                    <ChevronDown className="h-3.5 w-3.5" />
                                                ) : (
                                                    <ChevronRight className="h-3.5 w-3.5" />
                                                )}
                                            </button>
                                        ) : (
                                            <span className="w-4.5 shrink-0" />
                                        )}

                                        {isFolderNode ? (
                                            isExpanded ? (
                                                <FolderOpen className="h-4 w-4 text-accent shrink-0" />
                                            ) : (
                                                <Folder className="h-4 w-4 text-accent shrink-0" />
                                            )
                                        ) : (
                                            <FileText className="h-4 w-4 text-text-muted shrink-0" />
                                        )}

                                        <span className="truncate font-medium cursor-pointer" title={node.name}>
                                            {node.name}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0 select-none">
                                        {isFolderNode ? (
                                            <Badge variant="neutral" className="text-[10px] h-4.5 px-1.5 font-mono">
                                                {childCount} {childCount === 1 ? 'item' : 'items'}
                                            </Badge>
                                        ) : (
                                            <Badge variant="neutral" className="text-[10px] h-4.5 px-1.5 font-mono">
                                                {node.version ? (String(node.version).startsWith('v') ? node.version : `v${node.version}`) : 'v1.0'}
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                {isFolderNode && isExpanded && (
                                    <div className="flex flex-col border-l border-surface-border/70 ml-3.5 pl-0.5">
                                        {hasSubChildren ? (
                                            getFolderChildren(node.id).map((subChild) =>
                                                renderDirectoryNode(subChild, depth + 1)
                                            )
                                        ) : (
                                            <div
                                                style={{ paddingLeft: `${(depth + 1) * 14 + 10}px` }}
                                                className="py-1 text-[11px] text-text-muted italic select-none"
                                            >
                                                Empty folder
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    };

                    return (
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <span className={SECTION_TITLE_STYLE}>Directory Tree</span>
                                <span className="text-xs text-text-muted">
                                    {folderContents.length} direct {folderContents.length === 1 ? 'item' : 'items'}
                                </span>
                            </div>

                            {folderContents.length === 0 ? (
                                <div className="p-4 rounded-lg border border-surface-border bg-surface-hover text-center text-text-muted text-xs">
                                    This folder is currently empty.
                                </div>
                            ) : (
                                <div className="p-2 rounded-lg border border-surface-border bg-surface flex flex-col gap-0.5 divide-y-0 max-h-96 overflow-y-auto">
                                    {folderContents.map((childItem) => renderDirectoryNode(childItem, 0))}
                                </div>
                            )}

                            {/* SELECTED TREE NODE DETAILS CARD */}
                            {selectedTreeItem && (
                                <div className="p-3 rounded-lg border border-surface-border bg-surface flex flex-col gap-2.5 animate-toast-in shadow-sm">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {selectedTreeItem.isFolder ? (
                                                <Folder className="h-4 w-4 text-accent shrink-0" />
                                            ) : (
                                                <FileText className="h-4 w-4 text-text-muted shrink-0" />
                                            )}
                                            <span className="text-xs font-bold text-text truncate" title={selectedTreeItem.name}>
                                                {selectedTreeItem.name}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedTreeItemId(null)}
                                            className="text-text-muted hover:text-text cursor-pointer p-0.5 rounded"
                                            title="Close selection"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>

                                    {selectedTreeItem.summary && (
                                        <div className={`${CALLOUT_BOX_STYLE} flex items-start gap-2 py-1.5 px-2 text-[11px]`}>
                                            <Sparkles className="h-3.5 w-3.5 text-text-muted shrink-0 mt-0.5" />
                                            <span className="break-words leading-relaxed whitespace-pre-line">{formatDocumentSummary(selectedTreeItem.summary)}</span>
                                        </div>
                                    )}

                                    {selectedTreeItem.comment && (
                                        <div className={`${CALLOUT_BOX_STYLE} flex items-start gap-2 py-1.5 px-2 text-[11px]`}>
                                            <MessageSquare className="h-3.5 w-3.5 text-text-muted shrink-0 mt-0.5" />
                                            <span className="break-words leading-relaxed">{selectedTreeItem.comment}</span>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-surface-border text-[11px] text-text-muted">
                                        <span>
                                            {selectedTreeItem.isFolder ? 'Folder' : selectedTreeItem.version ?? 'Document'}
                                        </span>
                                        {selectedTreeItem.isFolder ? (
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                leadingIcon={FolderInput}
                                                onClick={() => {
                                                    if (item.isArchived || selectedTreeItem.isArchived) {
                                                        showToast({
                                                            type: 'warning',
                                                            title: 'Archived Folder',
                                                            description: 'Cannot browse contents of an archived folder.',
                                                        });
                                                        return;
                                                    }
                                                    handleActionClick('open', {
                                                        ...selectedTreeItem,
                                                        parentId: selectedTreeItem.parentId ?? item.id,
                                                    });
                                                }}
                                            >
                                                Open Folder
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                leadingIcon={FileText}
                                                onClick={() => {
                                                    if (item.isArchived || selectedTreeItem.isArchived) {
                                                        showToast({
                                                            type: 'warning',
                                                            title: 'Archived Document',
                                                            description: 'Cannot view an archived document.',
                                                        });
                                                        return;
                                                    }
                                                    handleActionClick('open', {
                                                        ...selectedTreeItem,
                                                        parentId: selectedTreeItem.parentId ?? item.id,
                                                    });
                                                }}
                                            >
                                                Open File
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {activeTab === 'activity' && isUser && (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className={SECTION_TITLE_STYLE}>Audit Trail</span>
                            <span className="text-xs text-text-muted">
                                {userActivities.length} logs
                            </span>
                        </div>

                        {userActivities.length === 0 ? (
                            <div className="p-4 rounded-lg border border-surface-border bg-surface-hover text-center text-text-muted text-xs">
                                No recent activity logged for this user.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {userActivities.map((logItem) => (
                                    <div
                                        key={logItem.id}
                                        className="p-3 rounded-md border border-surface-border bg-surface flex flex-col gap-1 text-xs"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-semibold text-text capitalize">
                                                {logItem.action?.replace(/_/g, ' ')} {logItem.entityType}
                                            </span>
                                            <span className="text-xs text-text-muted">
                                                {formatTimestamp(logItem.createdAt)}
                                            </span>
                                        </div>
                                        <span className="text-xs text-text-muted truncate">
                                            Recorded Action
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {(activeTab === 'faculty' || activeTab === 'roster') && isDepartment && (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className={SECTION_TITLE_STYLE}>Faculty & Personnel</span>
                            <span className="text-xs text-text-muted">
                                {departmentFaculty.length} assigned
                            </span>
                        </div>

                        {departmentFaculty.length === 0 ? (
                            <div className="p-4 rounded-lg border border-surface-border bg-surface-hover text-center text-text-muted text-xs">
                                No faculty members assigned to this department yet.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {departmentFaculty.map((facultyMember) => (
                                    <div
                                        key={facultyMember.id}
                                        onClick={() => {
                                            const facultyWithDept = {
                                                ...facultyMember,
                                                department: facultyMember.department || item.name || item.title,
                                            };
                                            setViewingFacultyMember(facultyWithDept);
                                        }}
                                        className="p-3 rounded-md border border-surface-border bg-surface hover:bg-surface-hover hover:border-accent-border flex items-center justify-between gap-3 cursor-pointer transition-colors"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Avatar
                                                src={resolveUserAvatar(facultyMember, activeUser)}
                                                user={facultyMember}
                                                alt={`${facultyMember.firstName} ${facultyMember.lastName}`}
                                                size="medium"
                                            />
                                            <div className="flex flex-col min-w-0">
                                                <span
                                                    className="text-xs font-semibold text-text truncate"
                                                    title={`${facultyMember.firstName} ${facultyMember.lastName}`}
                                                >
                                                    {facultyMember.firstName} {facultyMember.lastName}
                                                </span>
                                                <span
                                                    className="text-xs text-text-muted truncate"
                                                    title={facultyMember.email}
                                                >
                                                    {facultyMember.email}
                                                </span>
                                            </div>
                                        </div>
                                        <Badge
                                            variant={ROLE_BADGE_VARIANT[facultyMember.role] ?? 'neutral'}
                                            label={facultyMember.role}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'payload' && isCoordinatorRequest && (() => {
                    const rawPayload = item.data;
                    const parsedPayload = typeof rawPayload === 'object' && rawPayload !== null
                        ? rawPayload
                        : (() => {
                              try {
                                  return JSON.parse(rawPayload);
                              } catch {
                                  return rawPayload ? { raw: rawPayload } : {};
                              }
                          })();

                    const act = String(item.action || '').toUpperCase();
                    const crudAction = (() => {
                        if (act.includes('CREATE') || act.includes('UPLOAD') || act.includes('ADD') || act.includes('REGISTER')) return 'CREATE';
                        if (act.includes('READ') || act.includes('VIEW') || act.includes('ACCESS') || act.includes('DOWNLOAD')) return 'READ';
                        if (act.includes('DELETE') || act.includes('REMOVE') || act.includes('PURGE')) return 'DELETE';
                        return 'UPDATE';
                    })();

                    let oldState = parsedPayload.old ?? null;
                    let newState = parsedPayload.new ?? null;

                    // Fallback for oldState if missing in UPDATE or DELETE
                    if (!oldState && (crudAction === 'UPDATE' || crudAction === 'DELETE')) {
                        if (act.startsWith('USER_') || parsedPayload.userId) {
                            const targetId = parsedPayload.userId || parsedPayload.id || item.entityId;
                            const u = allUsers.find((x) => String(x.id) === String(targetId) || String(x.universityId) === String(parsedPayload.universityId));
                            if (u) {
                                oldState = {
                                    universityId: u.universityId,
                                    name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name,
                                    email: u.email,
                                    role: u.role,
                                    status: u.status,
                                };
                            }
                        } else if (act.startsWith('DEPARTMENT_') || parsedPayload.departmentId) {
                            const targetId = parsedPayload.departmentId || parsedPayload.id || item.entityId;
                            const d = allDepartments.find((x) => String(x.id) === String(targetId) || (parsedPayload.code && x.code === parsedPayload.code));
                            if (d) {
                                oldState = {
                                    code: d.code,
                                    name: d.name,
                                };
                            }
                        } else if (act.startsWith('DOCUMENT_') || parsedPayload.documentId) {
                            const targetId = parsedPayload.documentId || parsedPayload.id || item.entityId;
                            const doc = allDocuments.find((x) => String(x.id) === String(targetId));
                            if (doc) {
                                oldState = {
                                    title: doc.title || doc.name,
                                    classification: doc.classification,
                                };
                            }
                        }
                    }

                    // Fallback for newState if missing
                    if (!newState) {
                        if (crudAction === 'DELETE') {
                            newState = { status: 'DELETED' };
                        } else if (crudAction === 'CREATE' || crudAction === 'UPDATE') {
                            const cleaned = Object.fromEntries(
                                Object.entries(parsedPayload).filter(([k]) => !['old', 'new', 'userId', 'departmentId', 'documentId', 'requesterId', 'reviewerId'].includes(k))
                            );
                            newState = Object.keys(cleaned).length > 0 ? cleaned : parsedPayload;
                        }
                    }

                    return (
                        <div className="flex flex-col gap-4">
                            <div className="p-4 rounded-lg border border-surface-border bg-surface-hover flex flex-col gap-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-text">
                                        {getActionLabel(item.action)}
                                    </span>
                                    <span className="px-2 py-1 rounded text-xs font-bold bg-accent-background border border-accent-border text-accent">
                                        {item.action}
                                    </span>
                                </div>
                                <p className="text-xs text-text-muted leading-relaxed">
                                    {getActionDescription(item.action)}
                                </p>
                            </div>

                            <div className="flex flex-col gap-3">
                                <span className={SECTION_TITLE_STYLE}>Payload Changes (Old vs New)</span>

                                <div className="grid grid-cols-1 gap-3">
                                    {/* CARD 1: CURRENT STATE (DATABASE) */}
                                    <div className="flex flex-col gap-2 p-3 rounded-lg border border-surface-border bg-surface">
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
                                            <div className="py-2 text-center text-xs text-text-muted italic">
                                                No previous database record (Provisioning new entry)
                                            </div>
                                        ) : crudAction === 'READ' ? (
                                            <div className="py-2 text-center text-xs text-text-muted italic">
                                                Read-only access event — no previous state modified.
                                            </div>
                                        ) : oldState && Object.keys(oldState).length > 0 ? (
                                            <div className="flex flex-col divide-y divide-surface-border text-xs">
                                                {Object.entries(oldState).map(([fieldKey, fieldValue]) => (
                                                    <div key={fieldKey} className={PROPERTY_ROW_STYLE}>
                                                        <span className="text-text-muted font-medium capitalize">
                                                            {fieldKey.replace(/_/g, ' ')}:
                                                        </span>
                                                        <span className="font-medium text-text-muted text-right line-through">
                                                            {typeof fieldValue === 'object' && fieldValue !== null
                                                                ? JSON.stringify(fieldValue)
                                                                : String(fieldValue ?? '—')}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="py-2 text-center text-xs text-text-muted italic">
                                                No previous database record
                                            </div>
                                        )}
                                    </div>

                                    {/* CARD 2: PROPOSED STATE (COORDINATOR INPUT) */}
                                    <div className="flex flex-col gap-2 p-3 rounded-lg border border-accent-border bg-accent-background">
                                        <div className="flex items-center justify-between pb-2 border-b border-accent-border">
                                            <span className="text-xs font-bold text-accent uppercase tracking-wider">
                                                Proposed State (Coordinator Input)
                                            </span>
                                            <span className="px-2 py-1 rounded text-xs font-semibold bg-accent-background text-accent border border-accent-border">
                                                {item.status === 'APPROVED' ? 'Approved' : item.status === 'REJECTED' ? 'Rejected' : 'Pending Authorization'}
                                            </span>
                                        </div>

                                        {crudAction === 'READ' ? (
                                            <div className="py-2 text-center text-xs text-accent italic">
                                                Official university document accessed.
                                            </div>
                                        ) : newState && Object.keys(newState).length > 0 ? (
                                            <div className="flex flex-col divide-y divide-accent-border text-xs">
                                                {Object.entries(newState).map(([fieldKey, fieldValue]) => (
                                                    <div key={fieldKey} className={PROPERTY_ROW_STYLE}>
                                                        <span className="text-text-muted font-medium capitalize">
                                                            {fieldKey.replace(/_/g, ' ')}:
                                                        </span>
                                                        <span className="font-semibold text-accent text-right">
                                                            {typeof fieldValue === 'object' && fieldValue !== null
                                                                ? JSON.stringify(fieldValue)
                                                                : String(fieldValue ?? '—')}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="py-2 text-center text-xs text-text-muted italic">
                                                No proposed modifications
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {item.status === constants.COORDINATOR_REQUESTS_STATUS.PENDING && (
                                <div className="p-3 rounded-lg bg-surface-hover border border-surface-border text-xs text-text-muted flex items-start gap-2">
                                    <Clock className="h-4 w-4 text-accent shrink-0 mt-1" />
                                    <span>
                                        <strong>Pending Administrator Authorization</strong> — Once approved by an administrator, these changes will be committed to the database.
                                    </span>
                                </div>
                            )}
                            {item.status === constants.COORDINATOR_REQUESTS_STATUS.APPROVED && (
                                <div className="p-3 rounded-lg bg-accent-background border border-accent-border text-xs text-accent flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-1" />
                                    <span>
                                        <strong>Authorized & Executed</strong> — Changes have been carried over and successfully committed to university records.
                                    </span>
                                </div>
                            )}
                            {item.status === constants.COORDINATOR_REQUESTS_STATUS.REJECTED && (
                                <div className="p-3 rounded-lg bg-error-background border border-error-border text-xs text-error flex items-start gap-2">
                                    <AlertCircle className="h-4 w-4 text-error shrink-0 mt-1" />
                                    <span>
                                        <strong>Rejected</strong> — {item.rejectionReason || 'Request declined by administrator.'}
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {activeTab === 'messages' && isDocumentRequest && (
                    <div className="flex flex-col h-full gap-3">
                        <div className="flex items-center justify-between pb-2 border-b border-surface-border select-none">
                            <span className={SECTION_TITLE_STYLE}>Message</span>
                            <span className="text-xs text-text-muted">
                                {requestMessages.length} {requestMessages.length === 1 ? 'message' : 'messages'}
                            </span>
                        </div>

                        {/* WHOLE MESSAGE THREAD CALLOUT BOX */}
                        <div className="flex-1 flex flex-col rounded-xl border border-surface-border bg-surface-hover/60 overflow-hidden shadow-2xs min-h-72">
                            {/* THREAD HEADER INSIDE CALLOUT BOX */}
                            <div className="p-3.5 bg-surface border-b border-surface-border flex flex-col gap-2 shrink-0 select-none">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[10px] font-bold tracking-wider uppercase text-text-muted">
                                            Subject
                                        </span>
                                        <h4 className="text-xs font-bold text-text truncate mt-0.5" title={activeItem?.subject || activeItem?.title || 'Document Request'}>
                                            {activeItem?.subject || activeItem?.title || 'Document Request'}
                                        </h4>
                                    </div>
                                    <Badge
                                        variant={
                                            (activeItem?.status || '').toUpperCase().includes('RESOLV')
                                                ? 'success'
                                                : (activeItem?.status || '').toUpperCase().includes('REJECT')
                                                ? 'error'
                                                : 'information'
                                        }
                                        label={activeItem?.status ?? constants.DOCUMENT_REQUESTS_STATUS.OPEN}
                                    />
                                </div>

                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-muted pt-2 border-t border-surface-border/60">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <User className="h-3.5 w-3.5 text-text-muted shrink-0" />
                                        <span>Requester:</span>
                                        <span className="font-semibold text-text truncate max-w-44" title={activeItem?.requesterName ?? (typeof activeItem?.requester === 'string' ? activeItem.requester : activeItem?.requester?.name || 'Institutional Requester')}>
                                            {activeItem?.requesterName ?? (typeof activeItem?.requester === 'string' ? activeItem.requester : activeItem?.requester?.name || 'Institutional Requester')}
                                        </span>
                                    </div>
                                    {activeItem?.createdAt && (
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <Clock className="h-3.5 w-3.5 text-text-muted shrink-0" />
                                            <span>Requested:</span>
                                            <span className="text-text font-medium">
                                                {formatTimestamp(activeItem.createdAt)}
                                            </span>
                                        </div>
                                    )}
                                    {activeItem?.updatedAt && activeItem.updatedAt !== activeItem.createdAt && (
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <Calendar className="h-3.5 w-3.5 text-text-muted shrink-0" />
                                            <span>Updated:</span>
                                            <span className="text-text font-medium">
                                                {formatMessageTime(activeItem.updatedAt)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {effectiveRejectionReason && (
                                    <div className={`${ERROR_CALLOUT_STYLE} mt-2`}>
                                        <div className="flex items-center gap-2 font-bold mb-1">
                                            <AlertCircle className="h-4 w-4" /> Rejection Reason
                                        </div>
                                        {effectiveRejectionReason}
                                    </div>
                                )}
                            </div>

                            {/* SCROLLABLE MESSAGE STREAM */}
                            <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto p-3.5">
                                {requestMessages.length === 0 ? (
                                    <div className="h-full min-h-[220px] flex flex-col items-center justify-center p-6 text-center text-text-muted gap-2.5 select-none">
                                        <div className="p-3 rounded-full bg-surface border border-surface-border shadow-2xs text-accent">
                                            <MessageSquare className="h-6 w-6" />
                                        </div>
                                        <span className="text-xs font-semibold text-text">No messages yet</span>
                                        <p className="text-[11px] text-text-muted max-w-xs leading-relaxed">
                                            Post a reply or inquiry below to communicate regarding this document request.
                                        </p>
                                    </div>
                                ) : (
                                    combinedThreadItems.map((threadItem, itemIndex) => {
                                        const prevItem = itemIndex > 0 ? combinedThreadItems[itemIndex - 1] : null;
                                        const prevTime = prevItem?.createdAt ? new Date(prevItem.createdAt).getTime() : null;
                                        const currTime = threadItem?.createdAt ? new Date(threadItem.createdAt).getTime() : (prevTime ?? 0);
                                        const showDivider = !prevTime || (currTime - prevTime >= 10 * 60 * 1000);

                                        if (threadItem.type === 'message') {
                                            const message = threadItem.data;
                                            const msgUserId = message.user?.id ?? message.userId;
                                            const sender = allUsers.find(
                                                (userItem) => userItem.id === msgUserId
                                            ) || message.user;
                                            const isSenderActiveUser = Boolean(
                                                activeUser?.id && (msgUserId === activeUser.id || sender?.id === activeUser.id)
                                            );

                                            const requesterId = activeItem?.requesterId ?? activeItem?.requester?.id;
                                            const isSenderRequester = Boolean(
                                                requesterId && (msgUserId === requesterId || sender?.id === requesterId)
                                            );
                                            const senderRole = isSenderActiveUser
                                                ? activeUser?.role
                                                : (sender?.role || allUsers.find((u) => u.id === msgUserId)?.role);

                                            const senderFullName = isSenderActiveUser
                                                ? 'You'
                                                : sender
                                                    ? `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || sender.name || sender.title || 'Institutional Staff'
                                                    : 'University Office';

                                            const messageAttachments = (() => {
                                                if (!message || !message.message) return [];
                                                const match = message.message.match(/<!--\s*attachments:\[(.*?)\]\s*-->/i);
                                                const namesMatch = message.message.match(/<!--\s*att_names:\[(.*?)\]\s*-->/i);
                                                const savedNames = namesMatch && namesMatch[1] ? namesMatch[1].split(',').map((s) => decodeURIComponent(s.trim())) : [];

                                                if (match && match[1]) {
                                                    const idList = match[1].split(',').map((s) => s.trim()).filter(Boolean);
                                                    if (idList.length > 0) {
                                                        return idList.map((targetDocId, idx) => {
                                                            const foundAtt = requestAttachments.find((att) => {
                                                                const id = att.documentId ?? att.document?.id ?? att.id;
                                                                return String(id) === String(targetDocId) || String(att.id) === String(targetDocId);
                                                            });
                                                            const matchedDoc = allDocuments.find((d) => d.id === targetDocId);
                                                            const vers = (allDocumentVersions || []).filter((v) => (v.document?.id ?? v.documentId) === targetDocId);
                                                            const fallbackName = savedNames[idx] || matchedDoc?.name || vers[0]?.document?.name || 'Attached document';

                                                            if (foundAtt) {
                                                                const isDocDeleted = matchedDoc?.isArchived || (!matchedDoc && !foundAtt.path);
                                                                return {
                                                                    ...foundAtt,
                                                                    name: foundAtt.name || fallbackName,
                                                                    isDeleted: isDocDeleted || foundAtt.isDeleted,
                                                                    deletedReason: isDocDeleted ? 'repository_deleted' : null,
                                                                };
                                                            }

                                                            // If not found in active attachments, it was unsent or removed!
                                                            return {
                                                                id: targetDocId,
                                                                documentId: targetDocId,
                                                                name: fallbackName,
                                                                isDeleted: true,
                                                                deletedReason: 'unsent',
                                                            };
                                                        });
                                                    }
                                                }
                                                const msgTime = new Date(message.createdAt).getTime();
                                                return requestAttachments.filter((att) => {
                                                    const attUserId = att.attachedBy?.id ?? att.attachedById;
                                                    const attTime = new Date(att.createdAt).getTime();
                                                    const isSameUser = attUserId === msgUserId || (!attUserId && isSenderActiveUser);
                                                    const isNearTime = Math.abs(attTime - msgTime) <= 10000;
                                                    const isMentioned = att.name && message.message && message.message.includes(att.name);
                                                    return isSameUser && (isNearTime || isMentioned);
                                                });
                                            })();

                                            const isAdminApproved = Boolean(
                                                message.message && message.message.includes('admin_approved')
                                            );
                                            const cleanMessageText = (message.message || '').replace(/<!--[\s\S]*?-->/gi, '').trim();
                                            const formattedFullTime = formatFullDateTime(message.createdAt);

                                            return (
                                                <div key={message.id} className="flex flex-col w-full">
                                                    {showDivider && (
                                                        <div className="flex items-center my-2.5 w-full">
                                                            <div className="flex-grow border-t border-surface-border/70"></div>
                                                            <span className="mx-3 text-[10px] font-medium text-text-muted/80 select-none">
                                                                {formatDividerTimestamp(message.createdAt)}
                                                            </span>
                                                            <div className="flex-grow border-t border-surface-border/70"></div>
                                                        </div>
                                                    )}

                                                    {isSenderActiveUser ? (
                                                        /* RIGHT SIDE: YOU (ACCENTED) */
                                                        <div
                                                            className="flex flex-col gap-1 items-end max-w-[85%] self-end"
                                                            title={formattedFullTime}
                                                        >
                                                            {/* SENDER HEADER */}
                                                            <div className="flex items-center gap-1.5 text-[11px] text-text-muted pr-8 select-none">
                                                                <span className="font-semibold text-text-muted">You</span>
                                                                {renderMessageRoleBadge(senderRole, isSenderRequester)}
                                                                {isAdminApproved && (
                                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                                                        <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                                                        Admin Approved
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* BUBBLE ROW (AVATAR SITS DIRECTLY NEXT TO BOX) */}
                                                            <div className="flex items-end gap-2 flex-row-reverse w-full justify-start">
                                                                <Avatar
                                                                    src={resolveUserAvatar(activeUser, activeUser)}
                                                                    user={activeUser}
                                                                    alt="You"
                                                                    size="small"
                                                                    className="shrink-0 mb-0.5"
                                                                />
                                                                <div className="px-3.5 py-2.5 rounded-2xl rounded-tr-xs text-xs leading-relaxed break-words select-text bg-accent text-text-inverted shadow-xs min-w-0">
                                                                    <p className="whitespace-pre-wrap">{cleanMessageText}</p>

                                                                    {messageAttachments.length > 0 && (
                                                                        <div className="mt-2 flex flex-col gap-1.5 pt-2 border-t border-white/20">
                                                                            {messageAttachments.filter((att) => !att.isDeleted).map((attachment) => (
                                                                                <div
                                                                                        key={attachment.id}
                                                                                        className="p-2 rounded-lg flex items-center justify-between gap-2.5 text-xs bg-black/15 border border-white/20 text-text-inverted"
                                                                                    >
                                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                                            <div className="p-1 rounded bg-white/20 text-text-inverted shrink-0">
                                                                                                <FileText className="h-3.5 w-3.5" />
                                                                                            </div>
                                                                                            <div className="flex flex-col min-w-0">
                                                                                                <span
                                                                                                    className="font-semibold truncate text-xs"
                                                                                                    title={attachment.name}
                                                                                                >
                                                                                                    {attachment.name}
                                                                                                </span>
                                                                                                <span className="text-[10px] text-text-inverted/75">
                                                                                                    {attachment.sizeBytes
                                                                                                        ? formatBytes(attachment.sizeBytes)
                                                                                                        : 'Document'}
                                                                                                </span>
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-1 shrink-0">
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() =>
                                                                                                    handleActionClick('download', attachment)
                                                                                                }
                                                                                                className="p-1 rounded hover:bg-white/20 cursor-pointer text-text-inverted shrink-0 transition-colors"
                                                                                                title="Download Attachment"
                                                                                            >
                                                                                                <Download className="h-3.5 w-3.5" />
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                ))
                                                                            }
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        /* LEFT SIDE: OTHER PARTY */
                                                        <div
                                                            className="flex flex-col gap-1 items-start max-w-[85%] self-start"
                                                            title={formattedFullTime}
                                                        >
                                                            {/* SENDER HEADER */}
                                                            <div className="flex items-center gap-1.5 text-[11px] text-text-muted pl-8 select-none">
                                                                <span className="font-semibold text-text-muted">{senderFullName}</span>
                                                                {renderMessageRoleBadge(senderRole, isSenderRequester)}
                                                                {isAdminApproved && (
                                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                                                        <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                                                        Admin Approved
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* BUBBLE ROW (AVATAR SITS DIRECTLY NEXT TO BOX) */}
                                                            <div className="flex items-end gap-2 flex-row w-full justify-start">
                                                                <Avatar
                                                                    src={resolveUserAvatar(sender, activeUser)}
                                                                    user={sender}
                                                                    alt={senderFullName}
                                                                    size="small"
                                                                    className="shrink-0 mb-0.5"
                                                                />
                                                                <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-xs text-xs leading-relaxed break-words select-text bg-surface border border-surface-border text-text shadow-2xs min-w-0">
                                                                    <p className="whitespace-pre-wrap">{cleanMessageText}</p>

                                                                    {messageAttachments.length > 0 && (
                                                                        <div className="mt-2 flex flex-col gap-1.5 pt-2 border-t border-surface-border">
                                                                            {messageAttachments.filter((att) => !att.isDeleted).map((attachment) => (
                                                                                <div
                                                                                        key={attachment.id}
                                                                                        className="p-2 rounded-lg flex items-center justify-between gap-2.5 text-xs bg-surface-hover/80 border border-surface-border text-text"
                                                                                    >
                                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                                            <div className="p-1 rounded bg-accent/10 text-accent shrink-0">
                                                                                                <FileText className="h-3.5 w-3.5" />
                                                                                            </div>
                                                                                            <div className="flex flex-col min-w-0">
                                                                                                <span
                                                                                                    className="font-semibold truncate text-xs"
                                                                                                    title={attachment.name}
                                                                                                >
                                                                                                    {attachment.name}
                                                                                                </span>
                                                                                                <span className="text-[10px] text-text-muted">
                                                                                                    {attachment.sizeBytes
                                                                                                        ? formatBytes(attachment.sizeBytes)
                                                                                                        : 'Document'}
                                                                                                </span>
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-1 shrink-0">
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() =>
                                                                                                    handleActionClick('download', attachment)
                                                                                                }
                                                                                                className="p-1 rounded hover:bg-surface cursor-pointer text-accent shrink-0 transition-colors"
                                                                                                title="Download Attachment"
                                                                                            >
                                                                                                <Download className="h-3.5 w-3.5" />
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }

                                        // PENDING STAGED FILE APPROVAL BLOCK
                                        const pendingReq = threadItem.data;
                                        const payloadData = typeof pendingReq.data === 'string' ? JSON.parse(pendingReq.data || '{}') : (pendingReq.data || {});
                                        const pendingMsg = payloadData.message || '';
                                        const pendingAtts = payloadData.attachments || [];
                                        const reqUserId = pendingReq.requesterId ?? pendingReq.requester?.id;
                                        const requesterUser = allUsers.find((u) => u.id === reqUserId);
                                        const isSelf = Boolean(activeUser?.id && String(reqUserId) === String(activeUser.id));
                                        const senderName = isSelf ? 'You' : (requesterUser ? `${requesterUser.firstName || ''} ${requesterUser.lastName || ''}`.trim() : 'Coordinator');
                                        const formattedPendingTime = formatFullDateTime(pendingReq.createdAt);

                                        return (
                                            <div key={threadItem.id} className="flex flex-col w-full">
                                                {showDivider && (
                                                    <div className="flex items-center my-2.5 w-full">
                                                        <div className="flex-grow border-t border-surface-border/70"></div>
                                                        <span className="mx-3 text-[10px] font-medium text-text-muted/80 select-none">
                                                            {formatDividerTimestamp(pendingReq.createdAt)}
                                                        </span>
                                                        <div className="flex-grow border-t border-surface-border/70"></div>
                                                    </div>
                                                )}

                                                <div
                                                    className="flex flex-col gap-1 items-end max-w-[90%] self-end w-full"
                                                    title={formattedPendingTime}
                                                >
                                                    <div className="flex items-center gap-1.5 text-[11px] text-text-muted pr-2 select-none">
                                                        <span className="font-semibold text-text-muted">{senderName}</span>
                                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-warning-background text-warning border border-warning-border">
                                                            Coordinator
                                                        </span>
                                                    </div>

                                                    <div className="w-full p-3.5 rounded-2xl rounded-tr-xs text-xs leading-relaxed break-words bg-warning-background/30 border border-dashed border-warning-border text-text shadow-sm backdrop-blur-xs flex flex-col gap-2.5">
                                                        {/* STATUS BADGE */}
                                                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-warning-border/50">
                                                            <div className="flex items-center gap-1.5 text-warning font-semibold text-xs">
                                                                <Clock className="h-3.5 w-3.5 animate-pulse shrink-0" />
                                                                <span>Awaiting Administrator Approval</span>
                                                            </div>
                                                            {isAdmin && (
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    <Button
                                                                        variant="primary"
                                                                        size="sm"
                                                                        leadingIcon={CheckCircle2}
                                                                        onClick={() => handleActionClick('approve', pendingReq)}
                                                                        className="h-7 px-2 text-xs"
                                                                    >
                                                                        Approve
                                                                    </Button>
                                                                    <Button
                                                                        variant="destructive"
                                                                        size="sm"
                                                                        leadingIcon={XCircle}
                                                                        onClick={() => handleOpenRejectCoordinatorModal(pendingReq)}
                                                                        className="h-7 px-2 text-xs"
                                                                    >
                                                                        Reject
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {pendingMsg && (
                                                            <p className="whitespace-pre-wrap text-text font-medium">{pendingMsg}</p>
                                                        )}

                                                        {pendingAtts.length > 0 && (
                                                            <div className="flex flex-col gap-1.5 pt-1">
                                                                <span className="text-[11px] font-semibold text-text-muted">
                                                                    Staged Clearance Files ({pendingAtts.length}):
                                                                </span>
                                                                {pendingAtts.map((att, idx) => (
                                                                    <div
                                                                        key={idx}
                                                                        className="p-2 rounded-lg flex items-center justify-between gap-2 text-xs bg-surface/80 border border-surface-border"
                                                                    >
                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                            <Paperclip className="h-3.5 w-3.5 text-warning shrink-0" />
                                                                            <span className="font-semibold truncate text-xs" title={att.name}>
                                                                                {att.name}
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-[10px] text-text-muted shrink-0">
                                                                            {att.sizeBytes ? formatBytes(att.sizeBytes) : 'File'}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        <div className="text-[10px] text-text-muted italic pt-1 border-t border-warning-border/30">
                                                            This clearance file and message will be delivered to the requester once approved by an Administrator.
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}

                                <div ref={chatEndReference} />
                            </div>

                            {/* MESSAGE COMPOSER DOCKED AT BOTTOM OF CALLOUT BOX */}
                            {(() => {
                                const currentStatus = String(activeItem?.status ?? item?.status ?? '').toUpperCase().trim();
                                const isLocked = isDocumentRequest && (
                                    currentStatus === constants.DOCUMENT_REQUESTS_STATUS.RESOLVED ||
                                    currentStatus === constants.DOCUMENT_REQUESTS_STATUS.REJECTED ||
                                    currentStatus.includes('RESOLV') ||
                                    currentStatus.includes('REJECT')
                                );

                                if (isLocked) {
                                    return (
                                        <div className="p-3 border-t border-surface-border bg-surface-hover/60 flex items-center justify-between gap-2.5 shrink-0">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Lock className="h-4 w-4 text-text-muted shrink-0" />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs font-semibold text-text truncate">
                                                        Request is {currentStatus.toLowerCase()}
                                                    </span>
                                                    <span className="text-[10px] text-text-muted truncate">
                                                        Messaging is locked. Request finalized.
                                                    </span>
                                                </div>
                                            </div>
                                            {canSeePendingStatus && (
                                                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 shrink-0">
                                                    <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse shrink-0" />
                                                    <span className="font-semibold">Action Awaiting Approval</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                }

                                return (
                                    <div className="p-2.5 border-t border-surface-border bg-surface flex flex-col gap-2 shrink-0">
                                        {stagedAttachments.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
                                                {stagedAttachments.map((staged) => (
                                                    <div
                                                        key={staged.documentId}
                                                        className="px-2.5 py-1 rounded-lg bg-accent/10 border border-accent/20 flex items-center gap-2 text-xs text-accent"
                                                    >
                                                        <Paperclip className="h-3.5 w-3.5 shrink-0" />
                                                        <span className="font-semibold truncate max-w-44" title={staged.name}>
                                                            {staged.name}
                                                        </span>
                                                        <span className="text-[10px] opacity-75 shrink-0">
                                                            ({staged.sizeBytes ? formatBytes(staged.sizeBytes) : 'Document'})
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveStagedAttachment(staged.documentId)}
                                                            className="p-0.5 rounded hover:bg-accent/20 cursor-pointer text-accent shrink-0 transition-colors"
                                                            title={`Remove ${staged.name}`}
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <form
                                            onSubmit={handleSendMessage}
                                            className="flex items-end gap-2"
                                        >
                                            {isStaff && (
                                                <button
                                                    type="button"
                                                    onClick={handleOpenAttachModal}
                                                    className="h-10 w-10 flex items-center justify-center rounded-xl border border-surface-border bg-surface hover:bg-surface-hover hover:text-accent text-text-muted transition-colors shrink-0 cursor-pointer"
                                                    title="Attach Document from Repository"
                                                >
                                                    <Paperclip className="h-4 w-4" />
                                                </button>
                                            )}

                                            <div className="relative flex-1 flex items-center px-3 py-2 rounded-xl border border-surface-border bg-surface focus-within:border-accent focus-within:ring-1 focus-within:ring-accent transition-all">
                                                <textarea
                                                    ref={chatTextareaRef}
                                                    value={chatInputText}
                                                    onChange={(e) => setChatInputText(e.target.value)}
                                                    onKeyDown={handleChatKeyDown}
                                                    rows={1}
                                                    placeholder={
                                                        stagedAttachments.length > 0
                                                            ? `Add a message with ${stagedAttachments.length} staged ${stagedAttachments.length === 1 ? 'file' : 'files'}...`
                                                            : 'Type a message... (Shift+Tab for new line)'
                                                    }
                                                    className="w-full bg-transparent border-0 resize-none outline-none focus:outline-none focus:ring-0 text-xs text-text placeholder:text-text-muted leading-relaxed p-0 min-h-[22px] max-h-[120px]"
                                                    style={{ maxHeight: '120px' }}
                                                />
                                            </div>

                                            <Button
                                                type="submit"
                                                variant="primary"
                                                leadingIcon={Send}
                                                isDisabled={!chatInputText.trim() && stagedAttachments.length === 0}
                                                className="shrink-0 h-10 px-3.5 rounded-xl"
                                            >
                                                Send
                                            </Button>
                                        </form>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}

                {activeTab === 'attachments' && isDocumentRequest && (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className={SECTION_TITLE_STYLE}>Attached Clearance Files</span>
                            <span className="text-xs text-text-muted">
                                {requestAttachments.length} files
                            </span>
                        </div>

                        {requestAttachments.length === 0 ? (
                            <div className="p-4 rounded-lg border border-surface-border bg-surface-hover text-center text-text-muted text-xs">
                                No attachments uploaded to this request.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {requestAttachments.map((attachment) => (
                                    <div
                                        key={attachment.id}
                                        className="p-3 rounded-lg border border-surface-border bg-surface hover:bg-surface-hover flex items-center justify-between gap-3 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Paperclip className="h-4 w-4 text-accent shrink-0" />
                                            <div className="flex flex-col min-w-0">
                                                <span
                                                    className="text-xs font-semibold text-text truncate cursor-default"
                                                    title={attachment.name ?? `Attachment #${attachment.id}`}
                                                >
                                                    {attachment.name ?? `Attachment #${attachment.id}`}
                                                </span>
                                                <span className="text-xs text-text-muted truncate">
                                                    {attachment.sizeBytes ? formatBytes(attachment.sizeBytes) : 'Document Attachment'}
                                                    {attachment.attachedByName ? ` · by ${attachment.attachedByName}` : ''}
                                                </span>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleActionClick('download', attachment)}
                                            className="p-2 rounded hover:bg-surface-hover text-accent transition-colors cursor-pointer shrink-0"
                                            title="Download Attachment"
                                        >
                                            <Download className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="pt-3 border-t border-surface-border shrink-0">
                {(isDocument || isFolder) && (() => {
                    // 1. MEMBER ROLE: Download only
                    if (isMember) {
                        return (
                            <div className="w-full">
                                <Button
                                    variant="secondary"
                                    leadingIcon={Download}
                                    isLoading={activeActionLoading === 'download'}
                                    isDisabled={Boolean(activeActionLoading)}
                                    onClick={() => handleActionClick('download')}
                                    className="w-full justify-center truncate px-2"
                                >
                                    Download
                                </Button>
                            </div>
                        );
                    }

                    // 2. OFFICER ROLE: Approve/Unapprove + Reject + Unreject
                    if (isOfficer) {
                        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
                        const userDeptClean = cleanId(activeUser?.departmentId ?? activeUser?.department?.id ?? activeUser?.department);
                        const itemCleanId = cleanId(item?.id);

                        const deptDocShares = (documentShares || []).filter((s) => {
                            const sDeptId = cleanId(s.department?.id ?? s.departmentId);
                            return userDeptClean && sDeptId === userDeptClean;
                        });

                        const fallbackShares = (allDocumentShares || []).filter((s) => {
                            const sDocId = cleanId(s.document?.id ?? s.documentId);
                            const sDeptId = cleanId(s.department?.id ?? s.departmentId);
                            return itemCleanId === sDocId && userDeptClean && sDeptId === userDeptClean;
                        });

                        const pool = deptDocShares.length > 0 ? deptDocShares : fallbackShares;

                        let effectiveOfficerStatus;
                        let officerShare;

                        const pubShare = pool.find((s) => s.status === constants.DOCUMENT_SHARES_STATUS.PUBLISHED);
                        const stashedShare = pool.find((s) => s.status === constants.DOCUMENT_SHARES_STATUS.STASHED);
                        const rejectedShare = pool.find((s) => s.status === constants.DOCUMENT_SHARES_STATUS.REJECTED);
                        const approvedShare = pool.find((s) => s.status === constants.DOCUMENT_SHARES_STATUS.APPROVED);
                        const pendingShare = pool.find((s) => s.status === constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL);

                        if (pubShare) {
                            effectiveOfficerStatus = constants.DOCUMENT_SHARES_STATUS.PUBLISHED;
                            officerShare = pubShare;
                        } else if (stashedShare) {
                            effectiveOfficerStatus = constants.DOCUMENT_SHARES_STATUS.STASHED;
                            officerShare = stashedShare;
                        } else if (rejectedShare) {
                            effectiveOfficerStatus = constants.DOCUMENT_SHARES_STATUS.REJECTED;
                            officerShare = rejectedShare;
                        } else if (approvedShare) {
                            effectiveOfficerStatus = constants.DOCUMENT_SHARES_STATUS.APPROVED;
                            officerShare = approvedShare;
                        } else if (pendingShare) {
                            effectiveOfficerStatus = constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL;
                            officerShare = pendingShare;
                        } else {
                            officerShare = item.share || (pool.length > 0 ? pool[0] : null);
                            const rawOfficerStatus = officerShare?.status ?? item.status ?? item.share?.status;
                            effectiveOfficerStatus = (rawOfficerStatus && rawOfficerStatus !== '—')
                                ? String(rawOfficerStatus).toUpperCase()
                                : constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL;
                        }

                        const isApproved = effectiveOfficerStatus === constants.DOCUMENT_SHARES_STATUS.APPROVED;
                        const isRejected = effectiveOfficerStatus === constants.DOCUMENT_SHARES_STATUS.REJECTED;
                        const isPublished = effectiveOfficerStatus === constants.DOCUMENT_SHARES_STATUS.PUBLISHED;
                        const isStashed = effectiveOfficerStatus === constants.DOCUMENT_SHARES_STATUS.STASHED;

                        if (isPublished || isStashed) {
                            return (
                                <div className="p-2 rounded-lg bg-surface-hover/80 text-center text-xs text-text-muted border border-surface-border">
                                    {isPublished
                                        ? 'This document has been published by the Director.'
                                        : 'This document has been stashed by the Director.'}
                                </div>
                            );
                        }

                        const targetWithShare = {
                            ...item,
                            ...(officerShare ? { share: officerShare } : {}),
                            status: effectiveOfficerStatus,
                        };

                        if (isRejected) {
                            return (
                                <div className="w-full">
                                    <Button
                                        variant="secondary"
                                        leadingIcon={RotateCcw}
                                        isLoading={activeActionLoading === 'unreject'}
                                        isDisabled={Boolean(activeActionLoading)}
                                        onClick={() => {
                                            const conf = getActionConfirmationConfig('unreject', item, 1);
                                            setInspectorConfirmAction({
                                                actionKey: 'unreject',
                                                targetItem: targetWithShare,
                                                ...conf,
                                            });
                                        }}
                                        className="w-full justify-center truncate px-2"
                                    >
                                        Unreject
                                    </Button>
                                </div>
                            );
                        }

                        if (isApproved) {
                            return (
                                <div className="w-full">
                                    <Button
                                        variant="secondary"
                                        leadingIcon={RotateCcw}
                                        isLoading={activeActionLoading === 'unapprove'}
                                        isDisabled={Boolean(activeActionLoading)}
                                        onClick={() => {
                                            const conf = getActionConfirmationConfig('unapprove', item, 1);
                                            setInspectorConfirmAction({
                                                actionKey: 'unapprove',
                                                targetItem: targetWithShare,
                                                ...conf,
                                            });
                                        }}
                                        className="w-full justify-center truncate px-2"
                                    >
                                        Unapprove
                                    </Button>
                                </div>
                            );
                        }

                        return (
                            <div className="grid grid-cols-2 gap-2 w-full">
                                <Button
                                    variant="primary"
                                    leadingIcon={CheckCircle2}
                                    isLoading={activeActionLoading === 'approve'}
                                    isDisabled={Boolean(activeActionLoading)}
                                    onClick={() => {
                                        const conf = getActionConfirmationConfig('approve', item, 1);
                                        setInspectorConfirmAction({
                                            actionKey: 'approve',
                                            targetItem: targetWithShare,
                                            ...conf,
                                        });
                                    }}
                                    className="justify-center truncate px-2"
                                >
                                    Approve
                                </Button>
                                <Button
                                    variant="destructive"
                                    leadingIcon={XCircle}
                                    isLoading={activeActionLoading === 'reject'}
                                    isDisabled={Boolean(activeActionLoading)}
                                    onClick={() => {
                                        setInspectorRejectReason('');
                                        setInspectorRejectModal({ targetItem: targetWithShare });
                                    }}
                                    className="justify-center truncate px-2"
                                >
                                    Reject
                                </Button>
                            </div>
                        );
                    }

                    // 3. DIRECTOR ROLE: Publish/Unpublish + Stash/Unstash
                    if (isDirector) {
                        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
                        const userDeptClean = cleanId(activeUser?.departmentId ?? activeUser?.department?.id ?? activeUser?.department);
                        const itemCleanId = cleanId(item?.id);
                        const isBaseShare = (s) => !s.recipientId && !s.recipient?.id && !s.recipient;

                        const deptDocShares = (documentShares || []).filter((s) => {
                            const sDeptId = cleanId(s.department?.id ?? s.departmentId);
                            return userDeptClean && sDeptId === userDeptClean;
                        });

                        const fallbackShares = (allDocumentShares || []).filter((s) => {
                            const sDocId = cleanId(s.document?.id ?? s.documentId);
                            const sDeptId = cleanId(s.department?.id ?? s.departmentId);
                            return itemCleanId === sDocId && userDeptClean && sDeptId === userDeptClean;
                        });

                        const pool = deptDocShares.length > 0 ? deptDocShares : fallbackShares;

                        let effectiveDirectorStatus;
                        let directorShare;

                        const pubShare = pool.find((s) => s.status === constants.DOCUMENT_SHARES_STATUS.PUBLISHED);
                        const stashedShare = pool.find((s) => s.status === constants.DOCUMENT_SHARES_STATUS.STASHED);
                        const approvedShare = pool.find((s) => s.status === constants.DOCUMENT_SHARES_STATUS.APPROVED);
                        const pendingShare = pool.find((s) => s.status === constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL);
                        const rejectedShare = pool.find((s) => s.status === constants.DOCUMENT_SHARES_STATUS.REJECTED);

                        if (pubShare) {
                            effectiveDirectorStatus = constants.DOCUMENT_SHARES_STATUS.PUBLISHED;
                            directorShare = pool.find(isBaseShare) || pubShare;
                        } else if (stashedShare) {
                            effectiveDirectorStatus = constants.DOCUMENT_SHARES_STATUS.STASHED;
                            directorShare = pool.find(isBaseShare) || stashedShare;
                        } else if (approvedShare) {
                            effectiveDirectorStatus = constants.DOCUMENT_SHARES_STATUS.APPROVED;
                            directorShare = approvedShare;
                        } else if (pendingShare) {
                            effectiveDirectorStatus = constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL;
                            directorShare = pendingShare;
                        } else if (rejectedShare) {
                            effectiveDirectorStatus = constants.DOCUMENT_SHARES_STATUS.REJECTED;
                            directorShare = rejectedShare;
                        } else {
                            directorShare = item.share || (pool.length > 0 ? pool[0] : null);
                            const rawDirectorStatus = directorShare?.status ?? item.status ?? item.share?.status;
                            effectiveDirectorStatus = (rawDirectorStatus && rawDirectorStatus !== '—')
                                ? String(rawDirectorStatus).toUpperCase()
                                : '';
                        }

                        const isPublished = effectiveDirectorStatus === constants.DOCUMENT_SHARES_STATUS.PUBLISHED;
                        const isStashed = effectiveDirectorStatus === constants.DOCUMENT_SHARES_STATUS.STASHED;
                        const isApproved = effectiveDirectorStatus === constants.DOCUMENT_SHARES_STATUS.APPROVED;

                        const targetWithShare = {
                            ...item,
                            ...(directorShare ? { share: directorShare } : {}),
                            status: effectiveDirectorStatus,
                        };

                        if (isPublished) {
                            return (
                                <div className="grid grid-cols-2 gap-2 w-full">
                                    <Button
                                        variant="primary"
                                        leadingIcon={Globe}
                                        isLoading={activeActionLoading === 'publish'}
                                        isDisabled={Boolean(activeActionLoading)}
                                        onClick={() => handleActionClick('re_publish', targetWithShare)}
                                        className="justify-center truncate px-2"
                                    >
                                        Re-Publish
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        leadingIcon={EyeOff}
                                        isLoading={activeActionLoading === 'unpublish'}
                                        isDisabled={Boolean(activeActionLoading)}
                                        onClick={() => {
                                            const conf = getActionConfirmationConfig('unpublish', item, 1);
                                            setInspectorConfirmAction({
                                                actionKey: 'unpublish',
                                                targetItem: targetWithShare,
                                                ...conf,
                                            });
                                        }}
                                        className="justify-center truncate px-2"
                                    >
                                        Unpublish
                                    </Button>
                                </div>
                            );
                        }

                        if (isStashed) {
                            return (
                                <div className="w-full">
                                    <Button
                                        variant="secondary"
                                        leadingIcon={RotateCcw}
                                        isLoading={activeActionLoading === 'unstash'}
                                        isDisabled={Boolean(activeActionLoading)}
                                        onClick={() => {
                                            const conf = getActionConfirmationConfig('unstash', item, 1);
                                            setInspectorConfirmAction({
                                                actionKey: 'unstash',
                                                targetItem: targetWithShare,
                                                ...conf,
                                            });
                                        }}
                                        className="w-full justify-center truncate px-2"
                                    >
                                        Unstash
                                    </Button>
                                </div>
                            );
                        }

                        if (isApproved) {
                            return (
                                <div className="grid grid-cols-2 gap-2 w-full">
                                    <Button
                                        variant="primary"
                                        leadingIcon={Globe}
                                        isLoading={activeActionLoading === 'publish'}
                                        isDisabled={Boolean(activeActionLoading)}
                                        onClick={() => handleActionClick('publish', targetWithShare)}
                                        className="justify-center truncate px-2"
                                    >
                                        Publish
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        leadingIcon={Layers}
                                        isLoading={activeActionLoading === 'stash'}
                                        isDisabled={Boolean(activeActionLoading)}
                                        onClick={() => {
                                            const conf = getActionConfirmationConfig('stash', item, 1);
                                            setInspectorConfirmAction({
                                                actionKey: 'stash',
                                                targetItem: targetWithShare,
                                                ...conf,
                                            });
                                        }}
                                        className="justify-center truncate px-2"
                                    >
                                        Stash
                                    </Button>
                                </div>
                            );
                        }

                        // When document is pending or rejected, Director cannot publish or stash until Officer approves
                        return (
                            <div className="p-2 rounded-lg bg-surface-hover/80 text-center text-xs text-text-muted border border-surface-border w-full">
                                Awaiting Officer approval before publishing or stashing.
                            </div>
                        );
                    }

                    // 4. ADMIN & COORDINATOR (STAFF): RESTORE | DELETE, RE-SHARE | unshare, or SHARE | ARCHIVE
                    const cleanDocId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
                    const isDocItemShared = Boolean(
                        item.share ||
                        item.departmentId ||
                        (Array.isArray(item.shares) && item.shares.length > 0) ||
                        (allDocumentShares || []).some((s) => {
                            const sDocId = cleanDocId(s.document?.id ?? s.documentId);
                            const status = String(s.status || '').toUpperCase();
                            return sDocId === cleanDocId(item.id) && status !== 'UNSHARED' && status !== 'REVOKED';
                        })
                    );

                    if (item.isArchived) {
                        return (
                            <div className="grid grid-cols-2 gap-2 w-full">
                                <Button
                                    variant="primary"
                                    leadingIcon={RotateCcw}
                                    isLoading={activeActionLoading === 'restore'}
                                    isDisabled={Boolean(activeActionLoading)}
                                    onClick={() => {
                                        const conf = getActionConfirmationConfig('restore', item, 1);
                                        setInspectorConfirmAction({
                                            actionKey: 'restore',
                                            targetItem: item,
                                            ...conf,
                                        });
                                    }}
                                    className="justify-center truncate px-2"
                                >
                                    Restore
                                </Button>
                                <Button
                                    variant="destructive"
                                    leadingIcon={Trash2}
                                    isLoading={activeActionLoading === 'delete'}
                                    isDisabled={Boolean(activeActionLoading)}
                                    onClick={() => handleActionClick('delete')}
                                    className="justify-center truncate px-2"
                                >
                                    Delete
                                </Button>
                            </div>
                        );
                    }

                    if (isDocItemShared) {
                        return (
                            <div className="grid grid-cols-2 gap-2 w-full">
                                <Button
                                    variant="primary"
                                    leadingIcon={Share2}
                                    onClick={() => handleActionClick('re_share')}
                                    className="justify-center truncate px-2"
                                >
                                    Re-Share
                                </Button>
                                <Button
                                    variant="secondary"
                                    leadingIcon={Share2}
                                    isLoading={activeActionLoading === 'unshare'}
                                    isDisabled={Boolean(activeActionLoading)}
                                    onClick={() => {
                                        const conf = getActionConfirmationConfig('unshare', item, 1);
                                        setInspectorConfirmAction({
                                            actionKey: 'unshare',
                                            targetItem: item,
                                            ...conf,
                                        });
                                    }}
                                    className="justify-center truncate px-2"
                                >
                                    Unshare
                                </Button>
                            </div>
                        );
                    }

                    return (
                        <div className="grid grid-cols-2 gap-2 w-full">
                            <Button
                                variant="primary"
                                leadingIcon={Share2}
                                onClick={() => handleActionClick('share')}
                                className="justify-center truncate px-2"
                            >
                                Share
                            </Button>
                            <Button
                                variant="destructive"
                                leadingIcon={Archive}
                                isLoading={activeActionLoading === 'archive'}
                                isDisabled={Boolean(activeActionLoading)}
                                onClick={() => handleActionClick('archive')}
                                className="justify-center truncate px-2"
                            >
                                Archive
                            </Button>
                        </div>
                    );
                })()}

                {isUser && (() => {
                    const u = activeUserRecord ?? item;
                    const isTargetAdmin = constants.isAdminRole(u?.role);
                    const canEditUser = !isTargetAdmin || isSelfUser;
                    const canSuspend = !isSelfUser;
                    const isSuspended = (activeUserRecord?.status ?? item.status) === constants.USERS_STATUS.SUSPENDED;

                    if (!canEditUser && !canSuspend) return null;

                    return (
                        <div className={`grid ${canEditUser && canSuspend ? 'grid-cols-2' : 'grid-cols-1'} gap-2 w-full`}>
                            {canEditUser && (
                                <Button
                                    variant="secondary"
                                    leadingIcon={Edit3}
                                    onClick={handleOpenEditUser}
                                    className="justify-center truncate"
                                >
                                    Edit
                                </Button>
                            )}
                            {canSuspend && (
                                isSuspended ? (
                                    <Button
                                        variant="primary"
                                        leadingIcon={UserCheck}
                                        onClick={handleOpenSuspendUser}
                                        className="justify-center truncate"
                                    >
                                        Unsuspend
                                    </Button>
                                ) : (
                                    <Button
                                        variant="destructive"
                                        leadingIcon={UserX}
                                        onClick={handleOpenSuspendUser}
                                        className="justify-center truncate"
                                    >
                                        Suspend
                                    </Button>
                                )
                            )}
                        </div>
                    );
                })()}

                {isDepartment && (
                    <div className="grid grid-cols-2 gap-2 w-full">
                        <Button
                            variant="secondary"
                            leadingIcon={Edit3}
                            onClick={handleOpenEditDepartment}
                            className="justify-center truncate"
                        >
                            Edit
                        </Button>
                        <Button
                            variant="destructive"
                            leadingIcon={Trash2}
                            onClick={handleOpenDeleteDepartment}
                            className="justify-center truncate"
                        >
                            Delete
                        </Button>
                    </div>
                )}

                {isCoordinatorRequest && (
                    <div className="w-full">
                        {item.status === constants.COORDINATOR_REQUESTS_STATUS.PENDING ? (
                            isAdmin ? (
                                <div className="grid grid-cols-2 gap-2 w-full">
                                    <Button
                                        variant="primary"
                                        leadingIcon={CheckCircle2}
                                        onClick={() => handleActionClick('approve')}
                                        className="justify-center truncate"
                                    >
                                        Approve
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        leadingIcon={XCircle}
                                        onClick={() => handleOpenRejectCoordinatorModal(activeItem ?? item)}
                                        className="justify-center truncate"
                                    >
                                        Reject
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    variant="destructive"
                                    leadingIcon={Trash2}
                                    onClick={() => handleActionClick('delete')}
                                    className="w-full justify-center truncate"
                                >
                                    Delete
                                </Button>
                            )
                        ) : (
                            <div className="p-2.5 rounded-lg bg-surface-hover/80 text-center text-xs text-text-muted border border-surface-border w-full flex items-center justify-center gap-1.5 font-medium">
                                <Lock className="w-3.5 h-3.5 text-text-muted shrink-0" />
                                <span>Request finalized ({item.status?.toLowerCase()}) · Locked</span>
                            </div>
                        )}
                    </div>
                )}

                {isDocumentRequest && (
                    <div className="w-full">
                        {canSeePendingStatus && (
                            <div className="mb-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-2 text-xs text-amber-700 dark:text-amber-300">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <Clock className="w-3.5 h-3.5 shrink-0 text-amber-500 animate-pulse" />
                                    <span className="font-semibold truncate">
                                        {pendingStatusRequest.action === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_RESOLVE
                                            ? 'Resolution'
                                            : 'Rejection'} awaiting Admin approval
                                    </span>
                                </div>
                                {isAdmin && (
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    await coordinatorApprovalService.executeApprovedRequest(pendingStatusRequest, activeUser);
                                                    await coordinatorApprovalService.updateCoordinatorRequestStatus({
                                                        requestId: pendingStatusRequest.id,
                                                        status: constants.COORDINATOR_REQUESTS_STATUS.APPROVED,
                                                    });
                                                    useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});
                                                    showToast({ type: 'success', title: 'Request Approved', description: 'Action executed successfully.' });
                                                } catch (err) {
                                                    showToast({ type: 'error', title: 'Approval Failed', description: err?.message ?? 'Could not approve request.' });
                                                }
                                            }}
                                            className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] cursor-pointer"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenRejectCoordinatorModal(pendingStatusRequest)}
                                            className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[11px] cursor-pointer"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeItem.status === constants.DOCUMENT_REQUESTS_STATUS.OPEN ? (
                            isStaff ? (
                                <div className="grid grid-cols-2 gap-2 w-full">
                                    <Button
                                        variant="primary"
                                        leadingIcon={CheckCircle2}
                                        onClick={() => handleActionClick('resolve')}
                                        isLoading={activeActionLoading === 'resolve'}
                                        isDisabled={Boolean(activeActionLoading) || Boolean(canSeePendingStatus)}
                                        className="justify-center truncate"
                                    >
                                        Resolve
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        leadingIcon={XCircle}
                                        onClick={() => handleActionClick('reject')}
                                        isLoading={activeActionLoading === 'reject'}
                                        isDisabled={Boolean(activeActionLoading) || Boolean(canSeePendingStatus)}
                                        className="justify-center truncate"
                                    >
                                        Reject
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    variant="destructive"
                                    leadingIcon={Trash2}
                                    onClick={() => handleActionClick('delete')}
                                    isLoading={activeActionLoading === 'delete'}
                                    isDisabled={Boolean(activeActionLoading)}
                                    className="w-full justify-center"
                                >
                                    Delete
                                </Button>
                            )
                        ) : (
                            <div className="p-2.5 rounded-lg bg-surface-hover/80 text-center text-xs text-text-muted border border-surface-border w-full flex items-center justify-center gap-1.5 font-medium">
                                <Lock className="w-3.5 h-3.5 text-text-muted shrink-0" />
                                <span>Request finalized ({activeItem.status?.toLowerCase()}) · Locked</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {isAttachModalOpen && (
                <Modal
                    isOpen={isAttachModalOpen}
                    onClose={handleCloseAttachModal}
                    title="Attach Documents from Repository"
                    description="Select institutional files to attach to this message thread."
                    size="lg"
                    icon={Paperclip}
                    confirmLabel={stagedAttachments.length > 0 ? `Done (${stagedAttachments.length} staged)` : 'Done'}
                    onConfirm={handleCloseAttachModal}
                    cancelLabel="Cancel"
                    onCancel={handleCloseAttachModal}
                >
                    <div className="flex flex-col gap-3 py-2">
                        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                            <div className="relative flex-1 min-w-0">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted pointer-events-none" />
                                <input
                                    type="text"
                                    value={attachSearchTerm}
                                    onChange={(changeEvent) => {
                                        const nextVal = changeEvent.target.value;
                                        setAttachSearchTerm(nextVal);
                                        if (nextVal.trim().length < 3) {
                                            setSemanticScoreMap({});
                                            setIsSemanticSearching(false);
                                        }
                                    }}
                                    placeholder="Search documents by title, AI summary, or content..."
                                    className="w-full pl-9 pr-28 py-2 text-xs rounded-md border border-surface-border bg-surface text-text focus:outline-hidden focus:border-accent focus:ring-1 focus:ring-accent"
                                />
                                <div className="absolute right-2.5 top-2 flex items-center gap-1.5 pointer-events-none select-none">
                                    {isSemanticSearching ? (
                                        <span className="flex items-center gap-1 text-[10px] text-accent animate-pulse font-medium">
                                            <Sparkles className="h-3 w-3 animate-spin" />
                                            Semantic AI...
                                        </span>
                                    ) : attachSearchTerm.trim().length >= 3 ? (
                                        <span className="flex items-center gap-1 text-[10px] text-accent font-medium">
                                            <Sparkles className="h-3 w-3 text-accent" />
                                            Semantic AI
                                        </span>
                                    ) : null}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <SelectField
                                    value={attachSortBy}
                                    options={ATTACH_SORT_OPTIONS}
                                    onChange={setAttachSortBy}
                                    leadingIcon={ArrowUpDown}
                                    placeholder="Sort records..."
                                    className="w-40 text-xs"
                                    dropdownAlign="right"
                                />
                                <SelectField
                                    value={attachClassFilter}
                                    options={ATTACH_CLASSIFICATION_OPTIONS}
                                    onChange={setAttachClassFilter}
                                    leadingIcon={Filter}
                                    placeholder="Filter records..."
                                    className="w-40 text-xs"
                                    dropdownAlign="right"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col divide-y divide-surface-border max-h-72 overflow-y-auto rounded-lg border border-surface-border bg-surface">
                            {attachableDocuments.length === 0 ? (
                                <div className="p-4 text-center text-xs text-text-muted">
                                    No matching documents found in repository.
                                </div>
                            ) : (
                                attachableDocuments.map((doc) => {
                                    const isStaged = stagedAttachments.some((att) => att.documentId === doc.id);
                                    return (
                                        <div
                                            key={doc.id}
                                            onClick={() => handleSelectDocumentToAttach(doc)}
                                            className={`p-3 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                                                isStaged ? 'bg-accent/10' : 'hover:bg-surface-hover'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <FileText className={`h-4 w-4 shrink-0 ${isStaged ? 'text-accent' : 'text-text-muted'}`} />
                                                <div className="flex flex-col min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className="text-xs font-semibold text-text truncate max-w-xs"
                                                            title={doc.name}
                                                        >
                                                            {doc.name}
                                                        </span>
                                                        {renderClassificationBadge(doc.classification)}
                                                        {doc._semanticInfo && (
                                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-accent/15 text-accent border border-accent/30">
                                                                <Sparkles className="h-2.5 w-2.5" />
                                                                {doc._semanticInfo.confidencePct}% match
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[11px] text-text-muted">
                                                        <span>{doc.sizeBytes ? formatBytes(doc.sizeBytes) : 'Document'}</span>
                                                        {doc._matchSnippet && (
                                                            <span className="text-text-muted/80 truncate text-[10px] italic">
                                                                • Match: {doc._matchSnippet}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <Button
                                                variant={isStaged ? 'secondary' : 'primary'}
                                                leadingIcon={isStaged ? Check : undefined}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSelectDocumentToAttach(doc);
                                                }}
                                                className="shrink-0 text-xs px-3"
                                            >
                                                {isStaged ? 'Staged' : 'Attach'}
                                            </Button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </Modal>
            )}
            {/* EDIT DEPARTMENT MODAL */}
            {isEditDepartmentModalOpen && (
                <Modal
                    isOpen={isEditDepartmentModalOpen}
                    onClose={() => !isSavingEditDepartment && setIsEditDepartmentModalOpen(false)}
                    title="Edit Department"
                    description={`Update records for ${activeItem?.code ?? 'department'}.`}
                    icon={Building2}
                    onConfirm={handleSaveEditDepartment}
                    confirmLabel={isSavingEditDepartment ? 'Saving Changes...' : 'Save Changes'}
                    cancelLabel="Cancel"
                    isConfirmLoading={isSavingEditDepartment}
                    isConfirmDisabled={isSavingEditDepartment}
                >
                    <div className="flex flex-col gap-4 py-2">
                        <TextField
                            label="Code"
                            placeholder="Enter Code"
                            value={deptFormCode}
                            onChange={(changeEvent) => {
                                setDeptFormCode(changeEvent.target.value.toUpperCase());
                                if (deptFormErrors.code) setDeptFormErrors((prev) => ({ ...prev, code: undefined }));
                            }}
                            required
                            error={deptFormErrors.code}
                        />
                        <TextField
                            label="Name"
                            placeholder="Enter Name"
                            value={deptFormName}
                            onChange={(changeEvent) => {
                                setDeptFormName(changeEvent.target.value);
                                if (deptFormErrors.name) setDeptFormErrors((prev) => ({ ...prev, name: undefined }));
                            }}
                            required
                            error={deptFormErrors.name}
                        />
                    </div>
                </Modal>
            )}



            {/* EDIT USER PROFILE MODAL */}
            {isEditUserModalOpen && (() => {
                const targetUser = activeUserRecord ?? item;
                return (
                    <Modal
                        isOpen={isEditUserModalOpen}
                        onClose={() => !isSavingEditUser && setIsEditUserModalOpen(false)}
                        size="lg"
                        title="Edit User Profile"
                        description={`Update records for ${targetUser?.universityId} (${targetUser?.firstName} ${targetUser?.lastName}).`}
                        icon={User}
                        onConfirm={handleSaveEditUser}
                        confirmLabel={isSavingEditUser ? 'Saving Changes...' : 'Save Changes'}
                        cancelLabel="Cancel"
                        isConfirmLoading={isSavingEditUser}
                        isConfirmDisabled={isSavingEditUser}
                    >
                        <div className="flex flex-col gap-5 py-2">
                            {/* AVATAR PREVIEW & UPLOAD */}
                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-xl bg-surface-hover/40 border border-surface-border">
                                <Avatar
                                    src={userFormAvatarFile ? URL.createObjectURL(userFormAvatarFile) : userFormAvatarPath}
                                    alt={`${userFormFirstName} ${userFormLastName}`}
                                    size="large"
                                    className="h-20 w-20 shadow-md ring-2 ring-surface-border shrink-0 text-xl"
                                />
                                <div className="flex flex-col justify-center items-center sm:items-start gap-2 flex-1 text-center sm:text-left">
                                    <div>
                                        <h4 className="text-sm font-bold text-text">
                                            {userFormFirstName} {userFormLastName}
                                        </h4>
                                        <p className="text-xs text-text-muted mt-0.5">
                                            {targetUser?.universityId} · {targetUser?.email}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="file"
                                            ref={editUserAvatarInputRef}
                                            onChange={(e) => setUserFormAvatarFile(e.target.files?.[0] ?? null)}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => editUserAvatarInputRef.current?.click()}
                                            className="px-3 py-1.5 rounded-md border border-surface-border bg-surface hover:bg-surface-hover text-xs font-medium text-text inline-flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
                                        >
                                            <Upload className="h-3.5 w-3.5" />
                                            {userFormAvatarFile ? 'Change Photo' : 'Upload New Photo'}
                                        </button>
                                        {userFormAvatarFile && (
                                            <button
                                                type="button"
                                                onClick={() => setUserFormAvatarFile(null)}
                                                className="px-2 py-1.5 rounded-md text-xs text-error hover:bg-error-background transition-colors cursor-pointer"
                                            >
                                                Reset
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* UNIVERSITY ID (READ ONLY) */}
                            <TextField
                                label="University ID"
                                value={targetUser?.universityId ?? ''}
                                isDisabled={true}
                                helperText="University ID cannot be altered once registered."
                            />

                            {/* NAMES */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <TextField
                                    label="First Name"
                                    placeholder="Enter your first name"
                                    value={userFormFirstName}
                                    onChange={(e) => {
                                        setUserFormFirstName(e.target.value);
                                        if (userFormErrors.firstName) setUserFormErrors((prev) => ({ ...prev, firstName: undefined }));
                                    }}
                                    required
                                    error={userFormErrors.firstName}
                                />
                                <TextField
                                    label="Middle Name"
                                    placeholder="Enter middle name"
                                    value={userFormMiddleName}
                                    onChange={(e) => setUserFormMiddleName(e.target.value)}
                                />
                                <TextField
                                    label="Last Name"
                                    placeholder="Enter your last name"
                                    value={userFormLastName}
                                    onChange={(e) => {
                                        setUserFormLastName(e.target.value);
                                        if (userFormErrors.lastName) setUserFormErrors((prev) => ({ ...prev, lastName: undefined }));
                                    }}
                                    required
                                    error={userFormErrors.lastName}
                                />
                            </div>

                            {/* EMAIL */}
                            <TextField
                                label="Email Address"
                                placeholder="Enter username"
                                value={userFormEmail}
                                suffixButton={constants.INSTITUTIONAL_CONFIGURATION.EMAIL_DOMAIN}
                                onChange={(e) => {
                                    let val = e.target.value;
                                    if (val.includes('@')) {
                                        val = val.replace(/@.*$/, '');
                                    }
                                    setUserFormEmail(val);
                                    if (userFormErrors.email) setUserFormErrors((prev) => ({ ...prev, email: undefined }));
                                }}
                                helperText={`Domain: ${constants.INSTITUTIONAL_CONFIGURATION.EMAIL_DOMAIN}`}
                                required
                                error={userFormErrors.email}
                            />

                            {/* ROLE & DEPARTMENT (SWAPPED ORDER) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <SelectField
                                    label="Role"
                                    value={userFormRole}
                                    onChange={(val) => {
                                        handleInspectorRoleChange(val);
                                        if (userFormErrors.role) setUserFormErrors((prev) => ({ ...prev, role: undefined }));
                                    }}
                                    options={inspectorRoleOptions}
                                    required
                                    error={userFormErrors.role}
                                />
                                <SelectField
                                    label="Department"
                                    value={isRoleLockedToRMO ? resolvedRmoId : userFormDepartmentId}
                                    onChange={(val) => {
                                        setUserFormDepartmentId(val);
                                        if (userFormErrors.departmentId) setUserFormErrors((prev) => ({ ...prev, departmentId: undefined }));
                                    }}
                                    options={inspectorDeptOptions}
                                    isDisabled={isRoleLockedToRMO}
                                    helperText={isRoleLockedToRMO ? 'Required for this role.' : undefined}
                                    required
                                    error={userFormErrors.departmentId}
                                />
                            </div>
                        </div>
                    </Modal>
                );
            })()}



            {/* VERSION REVERT CONFIRMATION MODAL */}
            {revertingVersionItem && (
                <Modal
                    isOpen={Boolean(revertingVersionItem)}
                    onClose={() => !isRevertingVersion && setRevertingVersionItem(null)}
                    title="Revert Document Version"
                    description={`Are you sure you want to revert this document to version v${revertingVersionItem.version}.0?`}
                    icon={RotateCcw}
                    variant="warning"
                    size="sm"
                    callout={`A new revision will be created restoring the exact binary file and snapshot from version v${revertingVersionItem.version}.0. Previous versions are retained.`}
                    calloutVariant="warning"
                    onConfirm={async () => {
                        setIsRevertingVersion(true);
                        try {
                            await handleActionClick('revert_version', revertingVersionItem);
                            setRevertingVersionItem(null);
                        } finally {
                            setIsRevertingVersion(false);
                        }
                    }}
                    confirmLabel={isRevertingVersion ? 'Reverting...' : `Revert to v${revertingVersionItem.version}.0`}
                    cancelLabel="Cancel"
                    isConfirmLoading={isRevertingVersion}
                    isConfirmDisabled={isRevertingVersion}
                />
            )}

            {/* COORDINATOR REJECT CONFIRMATION MODAL */}
            {rejectingCoordinatorReq && (
                <Modal
                    isOpen={Boolean(rejectingCoordinatorReq)}
                    onClose={handleCloseRejectCoordinatorModal}
                    title="Reject Coordinator Request"
                    description="Please provide a reason for rejecting this coordinator request. This feedback will be recorded in the audit trail and visible to the coordinator."
                    icon={XCircle}
                    variant="destructive"
                    callout="Rejection will notify the department coordinator and terminate the requested operation."
                    calloutVariant="destructive"
                    size="sm"
                    confirmLabel={isSubmittingCoordinatorReject ? 'Rejecting...' : 'Reject Request'}
                    cancelLabel="Cancel"
                    isConfirmLoading={isSubmittingCoordinatorReject}
                    isConfirmDisabled={isSubmittingCoordinatorReject}
                    onConfirm={handleConfirmRejectCoordinatorReq}
                >
                    <div className="flex flex-col gap-3 py-2">
                        <AreaField
                            label="Rejection Reason"
                            placeholder="Enter rejection reason..."
                            value={coordinatorRejectReason}
                            onChange={(e) => setCoordinatorRejectReason(e.target.value)}
                        />
                    </div>
                </Modal>
            )}

            {/* VIEW FACULTY PROFILE MODAL */}
            {viewingFacultyMember && (
                <Account
                    isOpen={Boolean(viewingFacultyMember)}
                    onClose={() => setViewingFacultyMember(null)}
                    user={viewingFacultyMember}
                    readOnly={viewingFacultyMember.id !== activeUser?.id}
                />
            )}

            {/* ACTION CONFIRMATION MODAL */}
            {Boolean(inspectorConfirmAction) && (
                <Modal
                    isOpen={Boolean(inspectorConfirmAction)}
                    onClose={() => setInspectorConfirmAction(null)}
                    title={inspectorConfirmAction.title}
                    description={inspectorConfirmAction.message}
                    icon={inspectorConfirmAction.actionKey === 'stash' ? Clock : (['restore', 'unshare'].includes(inspectorConfirmAction.actionKey) ? RotateCcw : CheckCircle2)}
                    size="sm"
                    confirmOnClose={false}
                    primaryAction={{
                        label: inspectorConfirmAction.primaryLabel,
                        variant: inspectorConfirmAction.variant || 'primary',
                        isLoading: activeActionLoading === inspectorConfirmAction.actionKey,
                        isDisabled: Boolean(activeActionLoading),
                        onClick: handleConfirmInspectorAction,
                    }}
                    secondaryAction={{
                        label: 'Cancel',
                        isDisabled: Boolean(activeActionLoading),
                        onClick: () => setInspectorConfirmAction(null),
                    }}
                >
                    <div className="text-xs text-text-muted leading-relaxed">
                        Please confirm you wish to perform this action. The status will update immediately across departmental queues.
                    </div>
                </Modal>
            )}

            {/* REJECTION FORM MODAL */}
            {Boolean(inspectorRejectModal) && (
                <Modal
                    isOpen={Boolean(inspectorRejectModal)}
                    onClose={() => {
                        setInspectorRejectModal(null);
                        setInspectorRejectReason('');
                    }}
                    title={`Reject ${inspectorRejectModal.targetItem?.isFolder ? 'Folder' : 'Document'}`}
                    description={`Provide a reason for rejecting "${inspectorRejectModal.targetItem?.name || inspectorRejectModal.targetItem?.title || 'this document'}". The item will remain in the repository as Rejected.`}
                    icon={AlertTriangle}
                    size="md"
                    confirmOnClose={false}
                    primaryAction={{
                        label: 'Confirm Rejection',
                        variant: 'danger',
                        isLoading: activeActionLoading === 'reject',
                        isDisabled: Boolean(activeActionLoading) || !inspectorRejectReason.trim(),
                        onClick: handleConfirmInspectorRejection,
                    }}
                    secondaryAction={{
                        label: 'Cancel',
                        isDisabled: Boolean(activeActionLoading),
                        onClick: () => {
                            setInspectorRejectModal(null);
                            setInspectorRejectReason('');
                        },
                    }}
                >
                    <div className="flex flex-col gap-4">
                        <AreaField
                            label="Rejection Reason"
                            required
                            placeholder="Explain why this document is being rejected so the administrator can take corrective action..."
                            value={inspectorRejectReason}
                            onChange={(e) => setInspectorRejectReason(e.target.value)}
                            rows={4}
                        />
                        <p className="text-[11px] text-text-muted">
                            This reason will be recorded on the version audit log and shown to repository administrators.
                        </p>
                    </div>
                </Modal>
            )}

            {/* ADMIN RESHARE MODAL (NEW VERSION OR OVERWRITE) */}
            {Boolean(reshareModal) && (
                <Modal
                    isOpen={Boolean(reshareModal)}
                    onClose={() => {
                        if (!isSubmittingReshare) {
                            setReshareModal(null);
                            setReshareFile(null);
                            setReshareChangeSummary('');
                        }
                    }}
                    title={reshareModal.mode === 'new_version' ? 'Reshare Document (New Version)' : 'Overwrite File & Reshare'}
                    description={
                        reshareModal.mode === 'new_version'
                            ? `Upload a new revision for ${reshareModal.targetDeptName}. This will create the next version number and reset status to Pending Approval.`
                            : `Upload a replacement file for ${reshareModal.targetDeptName}. This will overwrite the current version file in-place and reset status to Pending Approval.`
                    }
                    icon={reshareModal.mode === 'new_version' ? UploadCloud : FileCheck}
                    size="md"
                    confirmOnClose={false}
                    primaryAction={{
                        label: isSubmittingReshare ? 'Uploading & Resharing...' : reshareModal.mode === 'new_version' ? 'Upload New Version & Reshare' : 'Overwrite & Reshare',
                        variant: 'primary',
                        isLoading: isSubmittingReshare,
                        isDisabled: isSubmittingReshare || !reshareFile,
                        onClick: handleConfirmReshare,
                    }}
                    secondaryAction={{
                        label: 'Cancel',
                        isDisabled: isSubmittingReshare,
                        onClick: () => {
                            setReshareModal(null);
                            setReshareFile(null);
                            setReshareChangeSummary('');
                        },
                    }}
                >
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-text">Replacement File</label>
                            <input
                                type="file"
                                id="reshare-file-input"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) setReshareFile(file);
                                }}
                                className="block w-full text-xs text-text file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-accent file:text-accent-foreground hover:file:bg-accent/90 cursor-pointer border border-surface-border rounded-lg bg-surface p-2"
                            />
                            {reshareFile && (
                                <div className="text-[11px] text-text-muted">
                                    Selected: <strong className="text-text">{reshareFile.name}</strong> ({formatBytes(reshareFile.size)})
                                </div>
                            )}
                        </div>

                        {reshareModal.mode === 'new_version' && (
                            <TextField
                                label="Change Summary"
                                placeholder="Describe what changed in this version..."
                                value={reshareChangeSummary}
                                onChange={(e) => setReshareChangeSummary(e.target.value)}
                            />
                        )}

                        <div className="p-3 rounded-lg border border-accent/20 bg-accent/5 text-xs text-text-muted leading-relaxed">
                            Submitting will clear the previous rejection reason and place the document back into the Officer&apos;s pending approval queue.
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};


// --- HELPERS ---
const formatBytes = (bytes) => {
    if (typeof bytes === 'string' && /[a-zA-Z]/.test(bytes)) {
        return bytes;
    }
    const num = Number(bytes);
    if (!num || isNaN(num) || num <= 0) {
        return '0 B';
    }
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const sizeIndex = Math.min(Math.floor(Math.log(num) / Math.log(1024)), sizes.length - 1);
    const formattedValue = (num / Math.pow(1024, sizeIndex)).toFixed(1);
    return `${formattedValue} ${sizes[sizeIndex]}`;
};

const formatTimestamp = (timestampString) => {
    if (!timestampString || timestampString === 'Invalid Date') {
        return null;
    }

    try {
        const date = new Date(timestampString);
        if (isNaN(date.getTime())) {
            return null;
        }
        return date.toLocaleDateString(undefined, {
            year:   'numeric',
            month:  'short',
            day:    'numeric',
            hour:   '2-digit',
            minute: '2-digit',
        });
    } catch {
        return null;
    }
};

const formatMessageTime = (timestampString) => {
    if (!timestampString || timestampString === 'Invalid Date') {
        return '';
    }

    try {
        const date = new Date(timestampString);
        if (isNaN(date.getTime())) {
            return '';
        }
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const timeStr = date.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
        });
        if (isToday) {
            return timeStr;
        }
        const isThisYear = date.getFullYear() === now.getFullYear();
        const dateStr = date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            ...(isThisYear ? {} : { year: '2-digit' }),
        });
        return `${dateStr}, ${timeStr}`;
    } catch {
        return '';
    }
};

const formatDividerTimestamp = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) {
        return `Today at ${timeString}`;
    }
    if (isYesterday) {
        return `Yesterday at ${timeString}`;
    }
    const dateString = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${dateString} at ${timeString}`;
};

const formatFullDateTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

const renderMessageRoleBadge = (role, isRequester = false) => {
    const badges = [];
    if (isRequester) {
        badges.push(
            <span key="requester" className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-information-background text-information border border-information-border">
                Requester
            </span>
        );
    }
    if (role === constants.USERS_ROLE.ADMINISTRATOR) {
        badges.push(
            <span key="admin" className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-accent/15 text-accent border border-accent/20">
                Admin
            </span>
        );
    } else if (role === constants.USERS_ROLE.COORDINATOR) {
        badges.push(
            <span key="coordinator" className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-warning-background text-warning border border-warning-border">
                Coordinator
            </span>
        );
    } else if (role === constants.USERS_ROLE.DIRECTOR) {
        badges.push(
            <span key="director" className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-information-background text-information border border-information-border">
                Director
            </span>
        );
    } else if (role === constants.USERS_ROLE.OFFICER && !isRequester) {
        badges.push(
            <span key="officer" className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-surface-hover text-text-muted border border-surface-border">
                Officer
            </span>
        );
    } else if (role === constants.USERS_ROLE.MEMBER && !isRequester) {
        badges.push(
            <span key="member" className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-surface-hover text-text-muted border border-surface-border">
                Member
            </span>
        );
    }
    if (badges.length === 0) return null;
    return <span className="inline-flex items-center gap-1">{badges}</span>;
};

const getMimeTypeFromExtension = (filename) => {
    if (!filename) {
        return null;
    }

    const extension = filename.split('.').pop()?.toLowerCase();
    const mimeTypes = {
        pdf:  'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        doc:  'application/msword',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        xls:  'application/vnd.ms-excel',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        png:  'image/png',
        jpg:  'image/jpeg',
        jpeg: 'image/jpeg',
        txt:  'text/plain',
        json: 'application/json',
    };

    return mimeTypes[extension] ?? 'application/octet-stream';
};

const getActionLabel = (action) => {
    switch (action) {
        case 'USER_CREATE':
            return 'Provision New User Account';
        case 'USER_UPDATE':
            return 'Update User Account Profile';
        case 'USER_SUSPEND':
            return 'Account Administrative Suspension';
        case 'DEPARTMENT_CREATE':
            return 'Establish New Department';
        case 'DEPARTMENT_UPDATE':
            return 'Update Department Information';
        case 'DOCUMENT_UPLOAD':
            return 'Upload & Register Document';
        case 'DOCUMENT_SHARE':
            return 'Grant Department Access Share';
        case 'DOCUMENT_ARCHIVE':
            return 'Transfer Document to Archive';
        case 'DOCUMENT_DELETE':
            return 'Permanent Document Deletion';
        case 'DOCUMENT_ATTACH':
        case 'DOCUMENT_REQUEST_ATTACH':
            return 'DOCUMENT ATTACHMENT';
        case 'DOCUMENT_REQUEST_RESOLVE':
        case 'DOCUMENT_REQUEST_REJECT':
            return 'DOCUMENT RESOLUTION';
        case 'DOCUMENT_REQUEST_REOPEN':
            return 'DOCUMENT REOPEN';
        default:
            return action ?? 'Coordinator Request';
    }
};

const getActionDescription = (action) => {
    switch (action) {
        case 'USER_CREATE':
            return 'Coordinator submitted candidate user data for administrative authorization and account creation.';
        case 'USER_UPDATE':
            return 'Coordinator requested modifications to user designation, title, or department assignment.';
        case 'USER_SUSPEND':
            return 'Coordinator initiated an administrative suspension request for user credentials.';
        case 'DEPARTMENT_CREATE':
            return 'Coordinator proposed establishing a new collegiate department or administrative unit.';
        case 'DEPARTMENT_UPDATE':
            return 'Coordinator submitted changes to departmental structure, naming, or unit assignment.';
        case 'DOCUMENT_UPLOAD':
            return 'Coordinator uploaded a document file requiring administrative verification before institutional publication.';
        case 'DOCUMENT_SHARE':
            return 'Coordinator requested cross-departmental sharing permissions for an official document.';
        case 'DOCUMENT_ARCHIVE':
            return 'Coordinator submitted a request to transfer an active document into cold vault archives.';
        case 'DOCUMENT_DELETE':
            return 'Coordinator requested permanent deletion of a document from institutional records.';
        case 'DOCUMENT_ATTACH':
        case 'DOCUMENT_REQUEST_ATTACH':
            return 'Coordinator staged official document attachments awaiting administrative approval before delivery.';
        case 'DOCUMENT_REQUEST_RESOLVE':
            return 'Coordinator requested to mark this document request as resolved.';
        case 'DOCUMENT_REQUEST_REJECT':
            return 'Coordinator requested rejection of this document request.';
        case 'DOCUMENT_REQUEST_REOPEN':
            return 'Coordinator requested to reopen this resolved or rejected document request.';
        default:
            return 'Coordinator action submitted for administrative review and execution.';
    }
};


// --- EXPORTS ---
export { Inspector };
