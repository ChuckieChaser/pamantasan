// --- IMPORTS ---
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    Building2,
    Calendar,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Clock,
    Copy,
    Download,
    Edit3,
    Eye,
    EyeOff,
    FileText,
    FileType,
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
import { SelectField, TextField } from './Fields';
import { SegmentSelection } from './Selections';
import { Account } from './ui/Account';
import { constants } from '../constants';
import { storageService, coordinatorApprovalService } from '../services';


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
    currentUser = null,
    targetTab = null,
    onAction,
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
    const [previousItemId, setPreviousItemId] = useState(item?.id);

    // VERSION REVERT CONFIRMATION STATE
    const [revertingVersionItem, setRevertingVersionItem] = useState(null);
    const [isRevertingVersion, setIsRevertingVersion] = useState(false);

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

    // DIRECTORY TREE STATES
    const [expandedFolderIds, setExpandedFolderIds] = useState(() => new Set());
    const [selectedTreeItemId, setSelectedTreeItemId] = useState(null);

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

    if (item?.id !== previousItemId) {
        setPreviousItemId(item?.id);
        const resolvedTab = normalizeTab(targetTab || item?._targetTab || 'information');
        setActiveTab(isMember && resolvedTab === 'share' ? 'information' : resolvedTab);
        setChatInputText('');
        setStagedAttachments([]);
        setIsAttachModalOpen(false);
        setIsEditDepartmentModalOpen(false);
        setIsEditUserModalOpen(false);
        setViewingFacultyMember(null);
        setExpandedFolderIds(new Set());
        setSelectedTreeItemId(null);
    }

    useEffect(() => {
        const nextTab = targetTab || item?._targetTab;
        if (nextTab) {
            const resolvedTab = normalizeTab(nextTab);
            const target = isMember && resolvedTab === 'share' ? 'information' : resolvedTab;
            queueMicrotask(() => setActiveTab(target));
        }
    }, [targetTab, item?.id, item?._targetTab, isMember]);

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
            const matchedDoc = allDocuments.find((doc) => doc.id === item.id);
            const docVersions = allDocumentVersions.filter(
                (v) => (v.document?.id ?? v.documentId) === item.id
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

            return {
                ...item,
                name: matchedDoc?.name ?? item.name ?? item.title,
                title: matchedDoc?.name ?? item.title ?? item.name,
                comment: matchedDoc?.comment ?? item.comment ?? null,
                summary: latestVer?.summary ?? item.summary ?? null,
                classification: item.isFolder
                    ? null
                    : (latestVer?.classification ?? item.classification ?? constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED),
                version: item.isFolder
                    ? '—'
                    : (latestVer ? `v${latestVer.versionNumber ?? latestVer.version ?? 1}.0` : item.version),
                sizeBytes: latestVer?.sizeBytes ?? item.sizeBytes,
                mimeType: latestVer?.mimeType ?? item.mimeType,
                path: latestVer?.path ?? item.path,
                checksum: latestVer?.checksum ?? item.checksum,
                createdAt: matchedDoc?.createdAt ?? item.createdAt,
                updatedAt: effectiveUpdatedAt,
            };
        }
        if (isFolder) {
            const matchedDoc = allDocuments.find((doc) => doc.id === item.id);
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
            return {
                ...item,
                ...(matchedRequest || {}),
                status: effectiveStatus,
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
    }, [item, isDepartment, activeDepartment, isUser, activeUserRecord, userDepartmentDisplay, isDocument, isFolder, isDocumentRequest, isCoordinatorRequest, allDocuments, allDocumentVersions, allDocumentRequests, allCoordinatorRequests]);

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

        return [
            {
                id:             `ver-${item.id}`,
                documentId:     item.id,
                version:        item.version ? parseInt(String(item.version).replace(/\D/g, '')) || 1 : 1,
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
        if (direct.length > 0) return direct;

        if (Array.isArray(item.shares) && item.shares.length > 0) {
            return item.shares;
        }
        if (item.share) {
            return [item.share];
        }

        // Inherited shares from parent folder
        let pId = item.parentId ?? item.parentFolderId;
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

        if (item.status && item.status !== '—') {
            return [{
                id: `synthetic-${item.id}`,
                status: item.status,
                department: { name: userDepartmentDisplay || 'Current Department' },
                createdAt: item.createdAt || new Date().toISOString(),
            }];
        }

        return [];
    }, [item, isDocument, isFolder, allDocumentShares, allDocuments, userDepartmentDisplay]);

    const departmentShares = useMemo(() => {
        return documentShares.filter((s) => !s.recipientId && !s.recipient?.id && !s.recipient);
    }, [documentShares]);

    const userShares = useMemo(() => {
        return documentShares.filter((s) => Boolean(s.recipientId || s.recipient?.id || s.recipient));
    }, [documentShares]);

    const pendingStatusRequest = useMemo(() => {
        if (!activeItem || !isDocumentRequest) return null;
        return allCoordinatorRequests.find(
            (cr) =>
                cr.status === constants.COORDINATOR_REQUESTS_STATUS.PENDING &&
                (cr.action === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_RESOLVE ||
                 cr.action === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_REJECT ||
                 cr.action === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_REOPEN) &&
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

        return allAuditLogs.filter((log) => log.actor?.id === item.id || log.actorId === item.id);
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

        if (isDocument) {
            return [
                { value: 'information', label: 'Information', icon: Info },
                { value: 'version',     label: `Version (${documentVersions.length})`, icon: Layers },
                ...(!isMember ? [{ value: 'share', label: `Share (${documentShares.length})`, icon: Share2 }] : []),
            ];
        }

        if (isFolder) {
            return [
                { value: 'information', label: 'Information', icon: Info },
                { value: 'content',     label: `Content (${folderContents.length})`, icon: Folder },
                ...(!isMember ? [{ value: 'share', label: `Share (${documentShares.length})`, icon: Share2 }] : []),
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
        documentShares.length,
        folderContents.length,
        userActivities.length,
        departmentFaculty.length,
    ]);

    useEffect(() => {
        if (tabOptions.length > 0 && !tabOptions.some((opt) => opt.value === activeTab)) {
            const fallback = tabOptions[0]?.value || 'information';
            queueMicrotask(() => setActiveTab(fallback));
        }
    }, [tabOptions, activeTab]);

    const attachableDocuments = useMemo(() => {
        return allDocuments
            .filter((doc) => !doc.isFolder && !doc.isArchived)
            .filter((doc) => {
                if (!attachSearchTerm.trim()) {
                    return true;
                }
                const query = attachSearchTerm.toLowerCase();
                return (
                    (doc.name && doc.name.toLowerCase().includes(query)) ||
                    (doc.title && doc.title.toLowerCase().includes(query))
                );
            });
    }, [allDocuments, attachSearchTerm]);

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
        if (!item || activeActionLoading) {
            return;
        }

        const targetItem = actionItem ?? activeItem ?? item;
        const shouldSkipLoading = actionKey === 'archive' && targetItem?.isFolder;

        if (!shouldSkipLoading) {
            setActiveActionLoading(actionKey);
        }
        try {
            await onAction?.(actionKey, targetItem);
        } finally {
            if (!shouldSkipLoading) {
                setActiveActionLoading(null);
            }
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
                }),
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
        const isLocked = rawRole === constants.USERS_ROLE.ADMINISTRATOR || rawRole === constants.USERS_ROLE.COORDINATOR;
        setUserFormFirstName(u?.firstName ?? '');
        setUserFormMiddleName(u?.middleName ?? '');
        setUserFormLastName(u?.lastName ?? '');
        setUserFormEmail(u?.email ?? '');
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

        const cleanEmail = userFormEmail.trim().toLowerCase();
        if (!cleanEmail) {
            errors.email = 'Email is required.';
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
                        email: userFormEmail.trim().toLowerCase(),
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
                    email: userFormEmail.trim().toLowerCase(),
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
        setIsAttachModalOpen(true);
        setAttachSearchTerm('');
    };

    const handleCloseAttachModal = () => {
        setIsAttachModalOpen(false);
        setAttachSearchTerm('');
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
                description: 'This document request has been closed. Reopen it to send messages.',
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
            const metaTag = attachedDocIds.length > 0 ? `<!-- attachments:[${attachedDocIds.join(',')}] -->` : '';
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
    const primaryTitle = activeItem.title ?? activeItem.name ?? activeItem.subject ?? 'Record Details';
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
    const formattedFileSize = (activeItem.sizeBytes !== undefined && activeItem.sizeBytes !== null)
        ? formatBytes(activeItem.sizeBytes)
        : (activeItem.size ?? (isFolder ? '0 B' : null));
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

                <SegmentSelection
                    value={activeTab}
                    options={tabOptions}
                    onChange={setActiveTab}
                    className="w-full justify-stretch [&>button]:flex-1 mt-1"
                />
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
                                                <span className="leading-relaxed whitespace-pre-line">{activeItem.summary}</span>
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

                        {isCoordinatorRequest && item.rejectionReason && (
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wider text-error select-none">
                                    Rejection Reason
                                </span>
                                <div className={ERROR_CALLOUT_STYLE}>
                                    <div className="flex items-center gap-2 font-bold mb-1">
                                        <AlertCircle className="h-4 w-4" /> Rejection Reason
                                    </div>
                                    {item.rejectionReason}
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
                                                    className="text-xs text-text-muted truncate max-w-48 cursor-default select-text"
                                                    title={mimeType}
                                                >
                                                    {mimeType}
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
                                            const targetIds = isFold
                                                ? new Set(getRecursiveDescendantDocIds(item?.id, allDocuments))
                                                : new Set([item?.id]);
                                            const readCount = (allAuditLogs || []).filter((log) => {
                                                const isDoc = targetIds.has(log?.entityId) || targetIds.has(log?.document?.id);
                                                const isRead = ['READ', 'VIEW', 'VIEWED'].includes(String(log?.action || '').toUpperCase());
                                                return isDoc && isRead;
                                            }).length;

                                            return (
                                                <div className={PROPERTY_ROW_STYLE}>
                                                    <span className={PROPERTY_LABEL_STYLE}>
                                                        <Eye className={ICON_STYLE} /> Total Reads
                                                    </span>
                                                    <span className={PROPERTY_VALUE_STYLE} title={`${readCount} total reads`}>
                                                        {readCount} {readCount === 1 ? 'read' : 'reads'} {isFold ? '(combined)' : ''}
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

                {activeTab === 'share' && !isMember && (isDocument || isFolder) && (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <span className={SECTION_TITLE_STYLE}>Permissions & Access</span>
                            <span className="text-xs text-text-muted">
                                {documentShares.length} {documentShares.length === 1 ? 'share' : 'shares'}
                            </span>
                        </div>

                        {documentShares.length === 0 ? (
                            <div className="p-3.5 rounded-lg border border-surface-border bg-surface-hover text-center text-text-muted text-xs">
                                No sharing rules configured yet.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {departmentShares.length > 0 && (
                                    <div className="flex flex-col gap-2">
                                    {departmentShares.map((shareItem) => {
                                        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
                                        const targetDeptClean = cleanId(shareItem.department?.id ?? shareItem.departmentId);
                                        const shareDepartment = allDepartments.find(
                                            (department) => cleanId(department.id) === targetDeptClean
                                        ) ?? shareItem.department;
                                        const publisherName = resolvePublisherName(shareItem);

                                        return (
                                            <div
                                                key={shareItem.id}
                                                className="p-3.5 rounded-lg border border-surface-border bg-surface-hover flex flex-col gap-3"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <Building2 className="h-4 w-4 text-text-muted shrink-0" />
                                                        <span className="font-semibold text-xs text-text truncate">
                                                            {shareDepartment?.name ?? 'University Wide'}
                                                        </span>
                                                    </div>
                                                    <Badge
                                                        variant={STATUS_BADGE_VARIANT[shareItem.status] ?? 'neutral'}
                                                        label={shareItem.status}
                                                    />
                                                </div>

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
                                                {(() => {
                                                    const deptId = shareDepartment?.id ?? shareItem.department?.id ?? shareItem.departmentId;
                                                    const isFold = Boolean(item?.isFolder || item?.mimeType === 'folder');
                                                    const targetDocIds = isFold
                                                        ? new Set(getRecursiveDescendantDocIds(item?.id, allDocuments))
                                                        : new Set([item?.id]);

                                                    const deptAuditLogs = (allAuditLogs || []).filter((log) => {
                                                        const isDoc = targetDocIds.has(log?.entityId) || targetDocIds.has(log?.document?.id);
                                                        const isReadAction = ['READ', 'VIEW', 'VIEWED'].includes(String(log?.action || '').toUpperCase());
                                                        if (!isDoc || !isReadAction) return false;

                                                        const actorId = log?.actor?.id ?? log?.actorId;
                                                        const actorUser = (allUsers || []).find((u) => u.id === actorId);
                                                        let logDeptId = actorUser?.departmentId;
                                                        if (!logDeptId && typeof log?.data === 'string') {
                                                            try {
                                                                const parsed = JSON.parse(log.data);
                                                                logDeptId = parsed.departmentId;
                                                            } catch {
                                                                /* ignore */
                                                            }
                                                        }
                                                        return Boolean(deptId && logDeptId && String(logDeptId) === String(deptId));
                                                    });

                                                    const deptReadCount = deptAuditLogs.length;
                                                    const uniqueReadersCount = new Set(
                                                        deptAuditLogs.map((l) => l?.actor?.id ?? l?.actorId).filter(Boolean)
                                                    ).size;

                                                    return (
                                                        <div className="p-2.5 rounded-md border border-surface-border bg-surface/50 flex flex-col gap-1.5">
                                                            <div className="flex items-center justify-between text-[11px]">
                                                                <span className="font-semibold text-text-muted flex items-center gap-1.5">
                                                                    <Eye className="h-3 w-3 text-accent" />
                                                                    <span>Unit Readership</span>
                                                                </span>
                                                                <span className="text-[10px] font-medium text-text">
                                                                    {deptReadCount} {deptReadCount === 1 ? 'read' : 'reads'}
                                                                    {isFold ? ' (combined)' : ''}
                                                                    {uniqueReadersCount > 0 ? ` • ${uniqueReadersCount} unique` : ''}
                                                                </span>
                                                            </div>
                                                            <div className="w-full pt-1">
                                                                <ReadershipChart logs={deptAuditLogs} compact={true} showPeak={false} />
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

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
                                                                    handleActionClick('unshare', shareItem);
                                                                }}
                                                                className="text-error hover:underline cursor-pointer font-medium ml-1"
                                                            >
                                                                Unshare
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    </div>
                                )}

                                {/* DIVIDER */}
                                {departmentShares.length > 0 && userShares.length > 0 && (
                                    <div className="border-t border-surface-border my-1" />
                                )}

                                {/* USERS SHARES */}
                                {userShares.length > 0 && (
                                    <div className="flex flex-col gap-1.5">
                                    {userShares.map((shareItem) => {
                                        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
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
                                )}
                            </div>
                        )}
                    </div>
                )}

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
                                            <span className="break-words leading-relaxed whitespace-pre-line">{selectedTreeItem.summary}</span>
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

                {activeTab === 'payload' && isCoordinatorRequest && item.data && (
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
                                <div className="flex flex-col gap-2 p-3 rounded-lg border border-surface-border bg-surface">
                                    <div className="flex items-center justify-between pb-2 border-b border-surface-border">
                                        <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                                            Current State (Database)
                                        </span>
                                        <span className="text-xs text-text-muted">
                                            {item.data.old ? 'Existing Record' : 'None (New Entry)'}
                                        </span>
                                    </div>

                                    {item.data.old ? (
                                        <div className="flex flex-col divide-y divide-surface-border text-xs">
                                            {Object.entries(item.data.old).map(([fieldKey, fieldValue]) => (
                                                <div key={fieldKey} className={PROPERTY_ROW_STYLE}>
                                                    <span className="text-text-muted font-medium capitalize">
                                                        {fieldKey.replace(/_/g, ' ')}:
                                                    </span>
                                                    <span className="font-medium text-text-muted text-right line-through">
                                                        {String(fieldValue)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-2 text-center text-xs text-text-muted italic">
                                            No previous database record (Provisioning new entry)
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col gap-2 p-3 rounded-lg border border-accent-border bg-accent-background">
                                    <div className="flex items-center justify-between pb-2 border-b border-accent-border">
                                        <span className="text-xs font-bold text-accent uppercase tracking-wider">
                                            Proposed State (Coordinator Input)
                                        </span>
                                        <span className="px-2 py-1 rounded text-xs font-semibold bg-accent-background text-accent border border-accent-border">
                                            Pending Authorization
                                        </span>
                                    </div>

                                    {item.data.new ? (
                                        <div className="flex flex-col divide-y divide-accent-border text-xs">
                                            {Object.entries(item.data.new).map(([fieldKey, fieldValue]) => (
                                                <div key={fieldKey} className={PROPERTY_ROW_STYLE}>
                                                    <span className="text-text-muted font-medium capitalize">
                                                        {fieldKey.replace(/_/g, ' ')}:
                                                    </span>
                                                    <span className="font-semibold text-accent text-right">
                                                        {String(fieldValue)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col divide-y divide-accent-border text-xs">
                                            {Object.entries(item.data)
                                                .filter(([key]) => key !== 'old' && key !== 'new')
                                                .map(([fieldKey, fieldValue]) => (
                                                    <div key={fieldKey} className={PROPERTY_ROW_STYLE}>
                                                        <span className="text-text-muted font-medium capitalize">
                                                            {fieldKey.replace(/_/g, ' ')}:
                                                        </span>
                                                        <span className="font-semibold text-accent text-right">
                                                            {typeof fieldValue === 'object' && fieldValue !== null
                                                                ? JSON.stringify(fieldValue)
                                                                : String(fieldValue)}
                                                        </span>
                                                    </div>
                                                ))}
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
                )}

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
                                                if (match && match[1]) {
                                                    const idList = match[1].split(',').map((s) => s.trim()).filter(Boolean);
                                                    if (idList.length > 0) {
                                                        return requestAttachments.filter((att) => {
                                                            const targetDocId = att.documentId ?? att.document?.id ?? att.id;
                                                            return idList.includes(String(targetDocId)) || idList.includes(String(att.id));
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
                                                                            {messageAttachments.map((attachment) => (
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
                                                                            ))}
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
                                                                            {messageAttachments.map((attachment) => (
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
                                                                        onClick={() => handleActionClick('reject', pendingReq)}
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
                                                        Messaging is locked until reopened.
                                                    </span>
                                                </div>
                                            </div>
                                            {canSeePendingStatus && pendingStatusRequest?.action === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_REOPEN ? (
                                                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 shrink-0">
                                                    <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse shrink-0" />
                                                    <span className="font-semibold">Reopen Awaiting Approval</span>
                                                </div>
                                            ) : isStaff && (
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    leadingIcon={RotateCcw}
                                                    onClick={() => handleActionClick('open_request')}
                                                    isLoading={activeActionLoading === 'open_request'}
                                                    isDisabled={Boolean(activeActionLoading) || Boolean(canSeePendingStatus)}
                                                    className="h-7 px-2.5 text-[11px] shrink-0"
                                                >
                                                    Reopen
                                                </Button>
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

                    // 2. OFFICER ROLE: Approve/Unapprove + Reject
                    if (isOfficer) {
                        const isPending = item.status === constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL;
                        return (
                            <div className="grid grid-cols-2 gap-2 w-full">
                                {isPending ? (
                                    <Button
                                        variant="primary"
                                        leadingIcon={CheckCircle2}
                                        isLoading={activeActionLoading === 'approve'}
                                        isDisabled={Boolean(activeActionLoading)}
                                        onClick={() => handleActionClick('approve')}
                                        className="justify-center truncate px-2"
                                    >
                                        Approve
                                    </Button>
                                ) : (
                                    <Button
                                        variant="secondary"
                                        leadingIcon={RotateCcw}
                                        isLoading={activeActionLoading === 'unapprove'}
                                        isDisabled={Boolean(activeActionLoading)}
                                        onClick={() => handleActionClick('unapprove')}
                                        className="justify-center truncate px-2"
                                    >
                                        Unapprove
                                    </Button>
                                )}
                                <Button
                                    variant="destructive"
                                    leadingIcon={XCircle}
                                    isLoading={activeActionLoading === 'reject'}
                                    isDisabled={Boolean(activeActionLoading)}
                                    onClick={() => handleActionClick('reject')}
                                    className="justify-center truncate px-2"
                                >
                                    Reject
                                </Button>
                            </div>
                        );
                    }

                    // 3. DIRECTOR ROLE: Publish/Unpublish + Stash/Unstash
                    if (isDirector) {
                        const isPublished = item.status === constants.DOCUMENT_SHARES_STATUS.PUBLISHED;
                        const isStashed = item.status === constants.DOCUMENT_SHARES_STATUS.STASHED;
                        return (
                            <div className="grid grid-cols-2 gap-2 w-full">
                                {isPublished ? (
                                    <Button
                                        variant="destructive"
                                        leadingIcon={EyeOff}
                                        isLoading={activeActionLoading === 'unpublish'}
                                        isDisabled={Boolean(activeActionLoading)}
                                        onClick={() => handleActionClick('unpublish')}
                                        className="justify-center truncate px-2"
                                    >
                                        Unpublish
                                    </Button>
                                ) : (
                                    <Button
                                        variant="primary"
                                        leadingIcon={Globe}
                                        isLoading={activeActionLoading === 'publish'}
                                        isDisabled={Boolean(activeActionLoading)}
                                        onClick={() => handleActionClick('publish')}
                                        className="justify-center truncate px-2"
                                    >
                                        Publish
                                    </Button>
                                )}
                                {isStashed ? (
                                    <Button
                                        variant="secondary"
                                        leadingIcon={RotateCcw}
                                        isLoading={activeActionLoading === 'unstash'}
                                        isDisabled={Boolean(activeActionLoading)}
                                        onClick={() => handleActionClick('unstash')}
                                        className="justify-center truncate px-2"
                                    >
                                        Unstash
                                    </Button>
                                ) : (
                                    <Button
                                        variant="secondary"
                                        leadingIcon={Layers}
                                        isLoading={activeActionLoading === 'stash'}
                                        isDisabled={Boolean(activeActionLoading)}
                                        onClick={() => handleActionClick('stash')}
                                        className="justify-center truncate px-2"
                                    >
                                        Stash
                                    </Button>
                                )}
                            </div>
                        );
                    }

                    // 4. ADMIN & COORDINATOR (STAFF): Share + Delete (no Download)
                    return (
                        <div className="grid grid-cols-2 gap-2 w-full">
                            {!item.isArchived && (
                                <Button
                                    variant="primary"
                                    leadingIcon={Share2}
                                    onClick={() => handleActionClick('share')}
                                    className="justify-center truncate px-2"
                                >
                                    Share
                                </Button>
                            )}
                            <Button
                                variant="destructive"
                                leadingIcon={Trash2}
                                isLoading={activeActionLoading === 'delete'}
                                isDisabled={Boolean(activeActionLoading)}
                                onClick={() => handleActionClick('delete')}
                                className={`justify-center truncate px-2 ${item.isArchived ? 'col-span-2' : ''}`}
                            >
                                Delete
                            </Button>
                        </div>
                    );
                })()}

                {isUser && (
                    <div className="grid grid-cols-2 gap-2 w-full">
                        <Button
                            variant="primary"
                            leadingIcon={Edit3}
                            onClick={handleOpenEditUser}
                            className="justify-center truncate"
                        >
                            Edit
                        </Button>
                        {(activeUserRecord?.status ?? item.status) === constants.USERS_STATUS.SUSPENDED ? (
                            <Button
                                variant="secondary"
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
                                onClick={isSelfUser ? undefined : handleOpenSuspendUser}
                                isDisabled={isSelfUser}
                                title={isSelfUser ? 'Administrators cannot suspend their own account' : 'Suspend'}
                                className={`justify-center truncate ${isSelfUser ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                                {isSelfUser ? 'Suspend (Self)' : 'Suspend'}
                            </Button>
                        )}
                    </div>
                )}

                {isDepartment && (
                    <div className="grid grid-cols-2 gap-2 w-full">
                        <Button
                            variant="primary"
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
                        {isAdmin ? (
                            <div className="grid grid-cols-2 gap-2 w-full">
                                <Button
                                    variant="primary"
                                    leadingIcon={CheckCircle2}
                                    onClick={() => handleActionClick('approve')}
                                    className="justify-center truncate"
                                    isDisabled={item.status !== constants.COORDINATOR_REQUESTS_STATUS.PENDING}
                                >
                                    Approve
                                </Button>
                                <Button
                                    variant="destructive"
                                    leadingIcon={XCircle}
                                    onClick={() => handleActionClick('reject')}
                                    className="justify-center truncate"
                                    isDisabled={item.status !== constants.COORDINATOR_REQUESTS_STATUS.PENDING}
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
                                            : pendingStatusRequest.action === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_REOPEN
                                            ? 'Reopen'
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
                                            onClick={async () => {
                                                try {
                                                    await coordinatorApprovalService.updateCoordinatorRequestStatus({
                                                        requestId: pendingStatusRequest.id,
                                                        status: constants.COORDINATOR_REQUESTS_STATUS.REJECTED,
                                                    });
                                                    useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});
                                                    showToast({ type: 'warning', title: 'Request Rejected', description: 'Request was rejected.' });
                                                } catch (err) {
                                                    showToast({ type: 'error', title: 'Rejection Failed', description: err?.message ?? 'Could not reject request.' });
                                                }
                                            }}
                                            className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[11px] cursor-pointer"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {isStaff ? (
                            activeItem.status === constants.DOCUMENT_REQUESTS_STATUS.OPEN ? (
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
                                    variant="primary"
                                    leadingIcon={RotateCcw}
                                    onClick={() => handleActionClick('open_request')}
                                    isLoading={activeActionLoading === 'open_request'}
                                    isDisabled={Boolean(activeActionLoading) || Boolean(canSeePendingStatus)}
                                    className="w-full justify-center"
                                >
                                    Open
                                </Button>
                            )
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
                    size="md"
                    icon={Paperclip}
                    confirmLabel={stagedAttachments.length > 0 ? `Done (${stagedAttachments.length} staged)` : 'Done'}
                    onConfirm={handleCloseAttachModal}
                    cancelLabel="Cancel"
                    onCancel={handleCloseAttachModal}
                >
                    <div className="flex flex-col gap-3 py-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-text-muted pointer-events-none" />
                            <input
                                type="text"
                                value={attachSearchTerm}
                                onChange={(changeEvent) => setAttachSearchTerm(changeEvent.target.value)}
                                placeholder="Search documents by name..."
                                className="w-full pl-9 pr-3 py-2 text-xs rounded-md border border-surface-border bg-surface text-text focus:outline-hidden focus:border-accent focus:ring-1 focus:ring-accent"
                            />
                        </div>

                        <div className="flex flex-col divide-y divide-surface-border max-h-64 overflow-y-auto rounded-lg border border-surface-border bg-surface">
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
                                                    <span
                                                        className="text-xs font-semibold text-text truncate"
                                                        title={doc.name}
                                                    >
                                                        {doc.name}
                                                    </span>
                                                    <span className="text-xs text-text-muted">
                                                        {doc.sizeBytes ? formatBytes(doc.sizeBytes) : 'Document'} • {doc.classification ?? constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED}
                                                    </span>
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
                            placeholder="Enter your department code"
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
                            placeholder="Enter your department name"
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
                                type="email"
                                placeholder="name@pamantasan.edu.ph"
                                value={userFormEmail}
                                onChange={(e) => {
                                    setUserFormEmail(e.target.value);
                                    if (userFormErrors.email) setUserFormErrors((prev) => ({ ...prev, email: undefined }));
                                }}
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

            {/* VIEW FACULTY PROFILE MODAL */}
            {viewingFacultyMember && (
                <Account
                    isOpen={Boolean(viewingFacultyMember)}
                    onClose={() => setViewingFacultyMember(null)}
                    user={viewingFacultyMember}
                    readOnly={viewingFacultyMember.id !== activeUser?.id}
                />
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
