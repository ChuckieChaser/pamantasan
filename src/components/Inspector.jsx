// --- IMPORTS ---
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    Archive,
    ArrowUpRight,
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
    FileCheck,
    FileText,
    FileType,
    Folder,
    FolderInput,
    FolderOpen,
    FolderTree,
    HardDrive,
    Hash,
    Inbox,
    Info,
    Layers,
    MessageSquare,
    Paperclip,
    RotateCcw,
    Search,
    Send,
    Share2,
    Shield,
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
    useDepartmentStore,
    useDocumentStore,
    useUserStore,
} from '../stores';
import { Avatar, resolveUserAvatar } from './Avatar';
import { Badge } from './Badge';
import { Button } from './Button';
import { Modal } from './Modal';
import { SelectField, TextField } from './Fields';
import { SegmentSelection } from './Selections';
import { Account } from './ui/Account';
import { constants } from '../constants';
import { storageService } from '../services';


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
    [constants.DOCUMENT_REQUESTS_STATUS.OPEN]: 'warning',
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
    return tab;
};


// --- COMPONENTS ---
const Inspector = ({
    item = null,
    currentUser = null,
    targetTab = null,
    onClose,
    onAction,
    className,
    ...props
}) => {
    // REFS
    const chatEndReference = useRef(null);

    // STATES
    const [activeTab, setActiveTab] = useState(normalizeTab(targetTab || item?._targetTab || 'information'));
    const [copiedPropertyKey, setCopiedPropertyKey] = useState(null);
    const [chatInputText, setChatInputText] = useState('');
    const [stagedAttachment, setStagedAttachment] = useState(null);
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

    if (item?.id !== previousItemId) {
        setPreviousItemId(item?.id);
        setActiveTab(normalizeTab(targetTab || item?._targetTab || 'information'));
        setChatInputText('');
        setStagedAttachment(null);
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
            setActiveTab(normalizeTab(nextTab));
        }
    }, [targetTab, item?.id, item?._targetTab]);

    // HOOKS
    const { showToast } = useToast();
    const { currentUser: authUser } = useAuth();
    const activeUser = currentUser ?? authUser;

    const allDocuments = useDocumentStore((state) => state.documents);
    const allDocumentVersions = useDocumentStore((state) => state.documentVersions ?? state.versions ?? []);
    const allDocumentShares = useDocumentStore((state) => state.documentShares ?? state.shares ?? []);
    const allRequestMessages = useDocumentStore((state) => state.documentRequestMessages ?? []);
    const allRequestAttachments = useDocumentStore((state) => state.documentRequestAttachments ?? []);
    const addRequestMessage = useDocumentStore((state) => state.insertDocumentRequestMessage);
    const attachDocumentToRequest = useDocumentStore((state) => state.insertDocumentRequestAttachment);
    const allDepartments = useDepartmentStore((state) => state.departments);
    const allUsers = useUserStore((state) => state.users);
    const allAuditLogs = useAuditStore((state) => state.auditLogs);

    // DERIVED VALUES
    const isFolder = Boolean(item?.isFolder);
    const isDocument = Boolean(
        !isFolder &&
        (item?.classification ||
            item?.size ||
            item?.sizeBytes ||
            item?.mimeType ||
            item?.version !== undefined ||
            item?.parentId !== undefined)
    );
    const isUser = Boolean(item?.universityId || item?.email || item?.role);
    const isDepartment = Boolean(item?.code && !item?.universityId && !isUser);

    // FETCH VERSIONS DYNAMICALLY ON SELECTION
    useEffect(() => {
        if (item?.id && isDocument) {
            useDocumentStore.getState().fetchDocumentVersions(item.id).catch(() => {});
        }
    }, [item?.id, isDocument]);

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
        return item;
    }, [item, isDepartment, activeDepartment, isUser, activeUserRecord, userDepartmentDisplay, isDocument, isFolder, allDocuments, allDocumentVersions]);

    const isCoordinatorRequest = Boolean(
        item?.action &&
        (item.action.startsWith('USER_') ||
            item.action.startsWith('DEPARTMENT_') ||
            item.action.startsWith('DOCUMENT_'))
    );
    const isDocumentRequest = Boolean(item?.subject && !isCoordinatorRequest);

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
        if (!item || !isDocument) {
            return [];
        }

        return allDocumentShares.filter((share) => share.document?.id === item.id || share.documentId === item.id);
    }, [item, isDocument, allDocumentShares]);

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

        const messages = allRequestMessages.filter(
            (message) => message.documentRequest?.id === item.id || message.documentRequestId === item.id
        );

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

    const requestAttachments = useMemo(() => {
        if (!item || !isDocumentRequest) {
            return [];
        }

        const attachments = allRequestAttachments.filter(
            (attachment) => attachment.documentRequest?.id === item.id || attachment.documentRequestId === item.id
        );

        if (attachments.length > 0) {
            return attachments;
        }

        return item.attachments ?? [];
    }, [item, isDocumentRequest, allRequestAttachments]);

    const tabOptions = useMemo(() => {
        if (isDocument) {
            return [
                { value: 'information', label: 'Information', icon: Info },
                { value: 'version',     label: `Version (${documentVersions.length})`, icon: Layers },
                { value: 'share',       label: `Share (${documentShares.length})`, icon: Share2 },
            ];
        }

        if (isFolder) {
            return [
                { value: 'information', label: 'Information', icon: Info },
                { value: 'content',     label: `Content (${folderContents.length})`, icon: Folder },
                { value: 'share',       label: `Share (${documentShares.length})`, icon: Share2 },
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

        if (isCoordinatorRequest) {
            return [
                { value: 'information', label: 'Information', icon: Info },
                { value: 'payload',     label: 'Payload', icon: Layers },
            ];
        }

        if (isDocumentRequest) {
            return [
                { value: 'information', label: 'Information', icon: Info },
                { value: 'messages',    label: `Discussion (${requestMessages.length})`, icon: MessageSquare },
                { value: 'attachments', label: `Attachments (${requestAttachments.length})`, icon: Paperclip },
            ];
        }

        return [{ value: 'information', label: 'Information', icon: Info }];
    }, [
        isDocument,
        isFolder,
        isUser,
        isDepartment,
        isCoordinatorRequest,
        isDocumentRequest,
        documentVersions.length,
        documentShares.length,
        folderContents.length,
        userActivities.length,
        departmentFaculty.length,
        requestMessages.length,
        requestAttachments.length,
    ]);

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
            setUserFormError(error?.message ?? 'Failed to update user.');
        } finally {
            setIsSavingEditUser(false);
        }
    };

    const handleOpenSuspendUser = () => {
        handleActionClick('suspend', activeUserRecord ?? item);
    };

    const handleOpenAttachModal = () => {
        setIsAttachModalOpen(true);
        setAttachSearchTerm('');
    };

    const handleCloseAttachModal = () => {
        setIsAttachModalOpen(false);
        setAttachSearchTerm('');
    };

    const handleSelectDocumentToAttach = (selectedDocument) => {
        setStagedAttachment({
            documentId: selectedDocument.id,
            name:       selectedDocument.name,
            sizeBytes:  selectedDocument.sizeBytes ?? selectedDocument.size,
        });
        setIsAttachModalOpen(false);
        setAttachSearchTerm('');
    };

    const handleRemoveStagedAttachment = () => {
        setStagedAttachment(null);
    };

    const handleSendMessage = async (formEvent) => {
        formEvent.preventDefault();
        if ((!chatInputText.trim() && !stagedAttachment) || !item) {
            return;
        }

        const activeUserId = activeUser?.id;
        if (!activeUserId) {
            showToast({
                title: 'Authentication Error',
                description: 'You must be signed in to post a discussion message.',
                variant: 'error',
            });
            return;
        }
        const messageText =
            chatInputText.trim() ||
            (stagedAttachment ? `Attached document: ${stagedAttachment.name}` : '');

        try {
            if (stagedAttachment) {
                await attachDocumentToRequest({
                    documentRequestId: item.id,
                    documentId:        stagedAttachment.documentId,
                    attachedById:      activeUserId,
                });
            }

            await addRequestMessage({
                documentRequestId: item.id,
                userId:            activeUserId,
                message:           messageText,
            });

            setChatInputText('');
            setStagedAttachment(null);
            showToast({
                title:       'Message Sent',
                description: stagedAttachment
                    ? 'Message and attached file posted to discussion thread.'
                    : 'Your reply has been posted to the discussion thread.',
                variant:     'success',
            });
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
        (isFolder ? 'Folder' : isDocument ? 'Document' : isUser ? 'User' : 'Record');
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
    const storagePath = activeItem.path ?? null;

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
                                                    ? 'Clearance Request'
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
                        ) : item.status ? (
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
                                                <span className="leading-relaxed">{activeItem.summary}</span>
                                            </div>
                                        </div>
                                    )}

                                    {activeItem.changeSummary && (
                                        <div className="flex flex-col gap-2">
                                            <span className={SECTION_TITLE_STYLE}>Change Summary</span>
                                            <div className={`${CALLOUT_BOX_STYLE} flex items-start gap-2.5`}>
                                                <Sparkles className="h-4 w-4 text-text-muted shrink-0 mt-0.5" />
                                                <span className="leading-relaxed">{activeItem.changeSummary}</span>
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

                                {item.requesterName && (
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
                                )}

                                <div className={PROPERTY_ROW_STYLE}>
                                    <span className={PROPERTY_LABEL_STYLE}>
                                        <Calendar className={ICON_STYLE} />{' '}
                                        {isCoordinatorRequest || isDocumentRequest
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
                                        {isCoordinatorRequest || isDocumentRequest
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

                                        {(versionItem.summary || versionItem.changeSummary) && (
                                            <div className={`${CALLOUT_BOX_STYLE} flex items-start gap-2.5 py-2 px-2.5`}>
                                                <Sparkles className="h-4 w-4 text-text-muted shrink-0 mt-0.5" />
                                                <span className="leading-relaxed text-xs">
                                                    {versionItem.summary || versionItem.changeSummary}
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

                {activeTab === 'share' && (isDocument || isFolder) && (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className={SECTION_TITLE_STYLE}>Permissions & Access</span>
                            <span className="text-xs text-text-muted">
                                {documentShares.length} shares
                            </span>
                        </div>

                        {documentShares.length === 0 ? (
                            <div className="p-4 rounded-lg border border-surface-border bg-surface-hover text-center text-text-muted text-xs">
                                No department sharing rules configured yet.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {documentShares.map((shareItem) => {
                                    const shareDepartment = allDepartments.find(
                                        (department) => department.id === (shareItem.department?.id ?? shareItem.departmentId)
                                    );
                                    const sharer = allUsers.find(
                                        (userItem) => userItem.id === (shareItem.sharer?.id ?? shareItem.sharerId)
                                    );

                                    return (
                                        <div
                                            key={shareItem.id}
                                            className="p-3 rounded-lg border border-surface-border bg-surface-hover flex flex-col gap-2"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-semibold text-xs text-text">
                                                    {shareDepartment?.name ?? 'University Wide'}
                                                </span>
                                                <Badge
                                                    variant={STATUS_BADGE_VARIANT[shareItem.status] ?? 'neutral'}
                                                    label={shareItem.status}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between text-xs text-text-muted pt-1 border-t border-surface-border">
                                                <span>
                                                    Shared by {sharer?.firstName ?? 'Dean'}{' '}
                                                    {sharer?.lastName ?? ''}
                                                </span>
                                                <span>{formatTimestamp(shareItem.createdAt)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
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
                                            <span className="break-words leading-relaxed">{selectedTreeItem.summary}</span>
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
                        <div className="flex items-center justify-between pb-2 border-b border-surface-border">
                            <span className={SECTION_TITLE_STYLE}>Direct Discussion</span>
                            <span className="text-xs text-text-muted">
                                {requestMessages.length} messages
                            </span>
                        </div>

                        <div className="flex-1 flex flex-col gap-3 min-h-56">
                            {requestMessages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-text-muted gap-2">
                                    <MessageSquare className="h-6 w-6 text-text-muted" />
                                    <span className="text-xs">No messages posted yet.</span>
                                </div>
                            ) : (
                                requestMessages.map((message) => {
                                    const msgUserId = message.user?.id ?? message.userId;
                                    const sender = allUsers.find(
                                        (userItem) => userItem.id === msgUserId
                                    );
                                    const isSenderActiveUser = msgUserId === activeUser?.id;
                                    const isAdministrativeUser =
                                        activeUser?.role === constants.USERS_ROLE.ADMINISTRATOR ||
                                        activeUser?.role === constants.USERS_ROLE.COORDINATOR;
                                    const isSenderAdministrative =
                                        sender?.role === constants.USERS_ROLE.ADMINISTRATOR ||
                                        sender?.role === constants.USERS_ROLE.COORDINATOR;
                                    const isFellowAdmin =
                                        !isSenderActiveUser &&
                                        isAdministrativeUser &&
                                        isSenderAdministrative;

                                    const senderName = sender
                                        ? `${sender.firstName} ${sender.lastName}`
                                        : 'University Office';

                                    const messageAttachments = requestAttachments.filter(
                                        (att) => {
                                            const attUserId = att.attachedBy?.id ?? att.attachedById;
                                            return attUserId === msgUserId || (!attUserId && isSenderActiveUser);
                                        }
                                    );

                                    const bubbleStyle = isSenderActiveUser
                                        ? 'bg-accent text-text-inverted rounded-br-sm'
                                        : isFellowAdmin
                                            ? 'bg-warning-background border border-warning-border text-text rounded-bl-sm'
                                            : 'bg-surface-hover border border-surface-border text-text rounded-bl-sm';

                                    return (
                                        <div
                                            key={message.id}
                                            className={`flex items-end gap-2 max-w-sm ${
                                                isSenderActiveUser
                                                    ? 'self-end flex-row-reverse'
                                                    : 'self-start flex-row'
                                            }`}
                                        >
                                            <Avatar
                                                src={resolveUserAvatar(sender, activeUser)}
                                                user={sender}
                                                alt={senderName}
                                                size="small"
                                                className="mb-1 shrink-0"
                                            />

                                            <div
                                                className={`flex flex-col gap-1 ${
                                                    isSenderActiveUser
                                                        ? 'items-end'
                                                        : 'items-start'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 text-xs text-text-muted px-1">
                                                    <span className="font-semibold">{senderName}</span>
                                                    {isFellowAdmin && (
                                                        <Badge
                                                            variant="warning"
                                                            label={sender?.role}
                                                        />
                                                    )}
                                                    <span>•</span>
                                                    <span>{formatTimestamp(message.createdAt)}</span>
                                                </div>

                                                <div
                                                    className={`p-3 rounded-2xl text-xs leading-relaxed break-words select-text ${bubbleStyle}`}
                                                >
                                                    <p>{message.message}</p>

                                                    {messageAttachments.length > 0 && (
                                                        <div className="mt-2 flex flex-col gap-2">
                                                            {messageAttachments.map((attachment) => (
                                                                <div
                                                                    key={attachment.id}
                                                                    className={`p-2 rounded-lg flex items-center justify-between gap-2 text-xs ${
                                                                        isSenderActiveUser
                                                                            ? 'bg-surface/20 text-text-inverted border border-white/20'
                                                                            : 'bg-surface border border-surface-border text-text'
                                                                    }`}
                                                                >
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <Paperclip className="h-4 w-4 shrink-0" />
                                                                        <div className="flex flex-col min-w-0">
                                                                            <span
                                                                                className="font-semibold truncate"
                                                                                title={attachment.name}
                                                                            >
                                                                                {attachment.name}
                                                                            </span>
                                                                            <span className="text-xs opacity-75">
                                                                                {attachment.sizeBytes
                                                                                    ? formatBytes(attachment.sizeBytes)
                                                                                    : 'Document'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            handleActionClick(
                                                                                'download',
                                                                                attachment
                                                                            )
                                                                        }
                                                                        className={`p-1 rounded hover:bg-surface-hover cursor-pointer shrink-0 transition-colors ${
                                                                            isSenderActiveUser
                                                                                ? 'text-text-inverted'
                                                                                : 'text-accent'
                                                                        }`}
                                                                        title="Download Attachment"
                                                                    >
                                                                        <Download className="h-4 w-4" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={chatEndReference} />
                        </div>

                        <div className="pt-3 border-t border-surface-border flex flex-col gap-2 shrink-0">
                            {stagedAttachment && (
                                <div className="px-3 py-2 rounded-lg bg-accent-background border border-accent-border flex items-center justify-between text-xs text-accent">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Paperclip className="h-4 w-4 shrink-0" />
                                        <span className="font-semibold truncate" title={stagedAttachment.name}>
                                            {stagedAttachment.name}
                                        </span>
                                        <span className="text-xs opacity-80">
                                            ({stagedAttachment.sizeBytes ? formatBytes(stagedAttachment.sizeBytes) : 'Document'})
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleRemoveStagedAttachment}
                                        className="p-1 rounded hover:bg-accent-background cursor-pointer text-accent shrink-0"
                                        title="Remove staged attachment"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            )}

                            <form
                                onSubmit={handleSendMessage}
                                className="flex items-center gap-2"
                            >
                                <button
                                    type="button"
                                    onClick={handleOpenAttachModal}
                                    className="p-2 rounded-md border border-surface-border bg-surface hover:bg-surface-hover text-text-muted hover:text-accent transition-colors cursor-pointer shrink-0"
                                    title="Attach Document from Repository"
                                >
                                    <Paperclip className="h-4 w-4" />
                                </button>

                                <input
                                    type="text"
                                    value={chatInputText}
                                    onChange={(changeEvent) => setChatInputText(changeEvent.target.value)}
                                    placeholder={stagedAttachment ? 'Add a note with your attachment...' : 'Type a message or inquiry...'}
                                    className="flex-1 px-3 py-2 text-xs rounded-md border border-surface-border bg-surface text-text focus:outline-hidden focus:border-accent focus:ring-1 focus:ring-accent"
                                />

                                <Button
                                    type="submit"
                                    variant="primary"
                                    leadingIcon={Send}
                                    isDisabled={!chatInputText.trim() && !stagedAttachment}
                                >
                                    Send
                                </Button>
                            </form>
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
                {(isDocument || isFolder) && (
                    <div className={`grid ${item.isArchived ? 'grid-cols-2' : 'grid-cols-3'} gap-2 w-full`}>
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
                            variant="secondary"
                            leadingIcon={Download}
                            isLoading={activeActionLoading === 'download'}
                            isDisabled={Boolean(activeActionLoading)}
                            onClick={() => handleActionClick('download')}
                            className="justify-center truncate px-2"
                        >
                            Download
                        </Button>
                        <Button
                            variant="destructive"
                            leadingIcon={Archive}
                            isLoading={activeActionLoading === 'archive' || activeActionLoading === 'restore'}
                            isDisabled={Boolean(activeActionLoading)}
                            onClick={() => handleActionClick(item.isArchived ? 'restore' : 'archive')}
                            className="justify-center truncate px-2"
                        >
                            {item.isArchived ? 'Unarchive' : 'Archive'}
                        </Button>
                    </div>
                )}

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
                        {item.status === constants.COORDINATOR_REQUESTS_STATUS.PENDING ? (
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
                                    onClick={() => handleActionClick('reject')}
                                    className="justify-center truncate"
                                >
                                    Reject
                                </Button>
                            </div>
                        ) : (
                            <Button
                                variant="secondary"
                                leadingIcon={Layers}
                                onClick={() => handleActionClick('reopen')}
                                className="w-full justify-center"
                            >
                                Re-evaluate Action
                            </Button>
                        )}
                    </div>
                )}

                {isDocumentRequest && (
                    <div className="w-full">
                        {item.status === constants.DOCUMENT_REQUESTS_STATUS.OPEN ? (
                            <div className="grid grid-cols-2 gap-2 w-full">
                                <Button
                                    variant="primary"
                                    leadingIcon={FileCheck}
                                    onClick={() => handleActionClick('resolve')}
                                    className="justify-center truncate"
                                >
                                    Resolve Request
                                </Button>
                                <Button
                                    variant="destructive"
                                    leadingIcon={XCircle}
                                    onClick={() => handleActionClick('reject')}
                                    className="justify-center truncate"
                                >
                                    Reject Request
                                </Button>
                            </div>
                        ) : (
                            <Button
                                variant="primary"
                                leadingIcon={Download}
                                onClick={() => handleActionClick('download')}
                                className="w-full justify-center"
                            >
                                Download Clearance Package
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {isAttachModalOpen && (
                <Modal
                    isOpen={isAttachModalOpen}
                    onClose={handleCloseAttachModal}
                    title="Attach Document from Repository"
                    description="Select an institutional file to attach to this clearance thread."
                    size="md"
                    icon={Paperclip}
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
                                attachableDocuments.map((doc) => (
                                    <div
                                        key={doc.id}
                                        className="p-3 flex items-center justify-between gap-3 hover:bg-surface-hover transition-colors"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <FileText className="h-4 w-4 text-accent shrink-0" />
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
                                            variant="primary"
                                            onClick={() => handleSelectDocumentToAttach(doc)}
                                            className="shrink-0 text-xs px-3"
                                        >
                                            Attach
                                        </Button>
                                    </div>
                                ))
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
            return 'Attach Document File';
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
        default:
            return 'Coordinator action submitted for administrative review and execution.';
    }
};


// --- EXPORTS ---
export { Inspector };
