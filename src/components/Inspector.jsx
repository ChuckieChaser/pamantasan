// --- IMPORTS ---
import { useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    Archive,
    Building2,
    Calendar,
    Check,
    CheckCircle2,
    Clock,
    Copy,
    Download,
    Edit3,
    FileCheck,
    FileText,
    FileType,
    Folder,
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
    Tag,
    Trash2,
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
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Button } from './Button';
import { Modal } from './Modal';
import { SegmentSelection } from './Selections';


// --- CONFIGURATIONS ---
const SECTION_TITLE_STYLE = 'text-xs font-semibold uppercase tracking-wider text-text-muted select-none';
const PROPERTY_ROW_STYLE = 'flex items-center justify-between gap-3 py-2 border-b border-surface-border text-xs';
const PROPERTY_LABEL_STYLE = 'text-text-muted flex items-center gap-2 shrink-0 font-medium';
const PROPERTY_VALUE_STYLE = 'font-medium text-text text-right break-words select-text';
const CALLOUT_BOX_STYLE = 'p-3 rounded-md bg-surface-hover border border-surface-border text-xs text-text leading-relaxed select-text';
const ERROR_CALLOUT_STYLE = 'p-3 rounded-md bg-error-background border border-error-border text-xs text-error leading-relaxed select-text';
const ICON_STYLE = 'h-4 w-4 shrink-0 text-text-muted';

const CLASSIFICATION_BADGE_VARIANT = {
    PUBLIC:       'success',
    OFFICIAL:     'neutral',
    INTERNAL:     'neutral',
    CONFIDENTIAL: 'warning',
    RESTRICTED:   'error',
};

const ROLE_BADGE_VARIANT = {
    ADMINISTRATOR: 'error',
    COORDINATOR:   'information',
    FACULTY:       'neutral',
    MEMBER:        'neutral',
    STUDENT:       'neutral',
};

const STATUS_BADGE_VARIANT = {
    APPROVED:  'success',
    VERIFIED:  'success',
    ACTIVE:    'success',
    RESOLVED:  'success',
    COMPLETED: 'success',
    PENDING:   'warning',
    SUBMITTED: 'warning',
    OPEN:      'warning',
    REJECTED:  'error',
    SUSPENDED: 'error',
    ARCHIVED:  'error',
    CANCELLED: 'error',
};


// --- COMPONENTS ---
const Inspector = ({
    item = null,
    currentUser = null,
    onAction,
    className,
    ...props
}) => {
    // REFS
    const chatEndReference = useRef(null);

    // STATES
    const [activeTab, setActiveTab] = useState('information');
    const [copiedPropertyKey, setCopiedPropertyKey] = useState(null);
    const [chatInputText, setChatInputText] = useState('');
    const [stagedAttachment, setStagedAttachment] = useState(null);
    const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
    const [attachSearchTerm, setAttachSearchTerm] = useState('');
    const [previousItemId, setPreviousItemId] = useState(item?.id);

    if (item?.id !== previousItemId) {
        setPreviousItemId(item?.id);
        setActiveTab('information');
        setChatInputText('');
        setStagedAttachment(null);
        setIsAttachModalOpen(false);
    }

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
    const isFolder = Boolean(item?.isFolder || item?.is_folder);
    const isDocument = Boolean(
        !isFolder &&
        (item?.classification ||
            item?.size ||
            item?.size_bytes ||
            item?.mime_type ||
            item?.version ||
            item?.parentId !== undefined ||
            item?.parent_id !== undefined)
    );
    const isUser = Boolean(item?.university_id || item?.email || item?.role);
    const isDepartment = Boolean(item?.code && !item?.university_id && !isUser);
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
            (version) => version.document_id === item.id
        );

        if (matchedVersions.length > 0) {
            return matchedVersions.sort(
                (versionA, versionB) => versionB.version - versionA.version
            );
        }

        return [
            {
                id:             `ver-${item.id}`,
                document_id:    item.id,
                version:        item.version ? parseInt(String(item.version).replace(/\D/g, '')) || 1 : 1,
                size_bytes:     item.size_bytes ?? 1048576,
                classification: item.classification ?? 'PUBLIC',
                change_summary: item.change_summary ?? 'Initial document release.',
                summary:        item.summary ?? item.description ?? '',
                checksum:       item.checksum ?? 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                path:           item.path ?? `/records/${item.name ?? item.title ?? 'document.pdf'}`,
                created_at:     item.created_at ?? new Date().toISOString(),
            },
        ];
    }, [item, isDocument, allDocumentVersions]);

    const documentShares = useMemo(() => {
        if (!item || !isDocument) {
            return [];
        }

        return allDocumentShares.filter((share) => share.document_id === item.id);
    }, [item, isDocument, allDocumentShares]);

    const folderContents = useMemo(() => {
        if (!item || !isFolder) {
            return [];
        }

        return allDocuments.filter((doc) => doc.parent_id === item.id);
    }, [item, isFolder, allDocuments]);

    const userActivities = useMemo(() => {
        if (!item || !isUser) {
            return [];
        }

        return allAuditLogs.filter((log) => log.actor_id === item.id);
    }, [item, isUser, allAuditLogs]);

    const departmentFaculty = useMemo(() => {
        if (!item || !isDepartment) {
            return [];
        }

        return allUsers.filter((userItem) => userItem.department_id === item.id);
    }, [item, isDepartment, allUsers]);

    const requestMessages = useMemo(() => {
        if (!item || !isDocumentRequest) {
            return [];
        }

        const messages = allRequestMessages.filter(
            (message) => message.document_request_id === item.id
        );

        if (messages.length > 0) {
            return messages.sort(
                (messageA, messageB) =>
                    new Date(messageA.created_at) - new Date(messageB.created_at)
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
            (attachment) => attachment.document_request_id === item.id
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
                { value: 'versions',    label: `Versions (${documentVersions.length})`, icon: Layers },
                { value: 'shares',      label: `Shares (${documentShares.length})`, icon: Share2 },
            ];
        }

        if (isFolder) {
            return [
                { value: 'information', label: 'Information', icon: Info },
                { value: 'contents',    label: `Contents (${folderContents.length})`, icon: Folder },
            ];
        }

        if (isUser) {
            return [
                { value: 'information', label: 'Profile', icon: User },
                { value: 'activity',    label: `Activity (${userActivities.length})`, icon: Clock },
            ];
        }

        if (isDepartment) {
            return [
                { value: 'information', label: 'Information', icon: Building2 },
                { value: 'roster',      label: `Faculty (${departmentFaculty.length})`, icon: Users },
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
            .filter((doc) => !doc.is_folder && !doc.is_archived)
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

    const handleActionClick = (actionKey, actionItem = null) => {
        if (!item) {
            return;
        }

        onAction?.(actionKey, actionItem ?? item);
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
            document_id: selectedDocument.id,
            name:        selectedDocument.name,
            size_bytes:  selectedDocument.size_bytes,
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

        const activeUserId = activeUser?.id ?? 'f1000001-0000-4000-8000-000000000001';
        const messageText =
            chatInputText.trim() ||
            (stagedAttachment ? `Attached document: ${stagedAttachment.name}` : '');

        try {
            if (stagedAttachment) {
                await attachDocumentToRequest({
                    document_request_id: item.id,
                    document_id:         stagedAttachment.document_id,
                    attached_by_id:      activeUserId,
                });
            }

            await addRequestMessage({
                document_request_id: item.id,
                user_id:             activeUserId,
                message:             messageText,
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
    const primaryTitle = item.title ?? item.name ?? item.subject ?? 'Record Details';
    const primarySubtitle =
        item.code ??
        item.university_id ??
        (item.action ? item.action.replace(/_/g, ' ') : null) ??
        item.subtitle ??
        (isFolder ? 'Folder' : isDocument ? 'Document' : isUser ? 'User' : 'Record');
    const formattedCreatedDate = formatTimestamp(item.created_at ?? item.date ?? item.timestamp);
    const formattedUpdatedDate = formatTimestamp(item.updated_at ?? item.created_at);
    const formattedFileSize = item.size_bytes ? formatBytes(item.size_bytes) : item.size ?? null;
    const mimeType = item.mime_type ?? getMimeTypeFromExtension(item.name ?? item.title);
    const checksum = item.checksum ?? null;
    const storagePath = item.path ?? null;

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
                                src={item.avatar_path ?? item.avatarPath}
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
                        {item.classification && item.classification !== '—' ? (
                            <Badge
                                variant={CLASSIFICATION_BADGE_VARIANT[item.classification] ?? 'neutral'}
                                label={item.classification}
                            />
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
                            (item.summary ||
                                item.change_summary ||
                                item.purpose ||
                                (item.description && !item.purpose) ||
                                item.comment ||
                                item.rejection_reason) && (
                                <div className="flex flex-col gap-4">
                                    {item.summary && (
                                        <div className="flex flex-col gap-2">
                                            <span className={SECTION_TITLE_STYLE}>Summary</span>
                                            <div className={CALLOUT_BOX_STYLE}>
                                                {item.summary}
                                            </div>
                                        </div>
                                    )}

                                    {item.change_summary && (
                                        <div className="flex flex-col gap-2">
                                            <span className={SECTION_TITLE_STYLE}>Change Summary</span>
                                            <div className={CALLOUT_BOX_STYLE}>
                                                {item.change_summary}
                                            </div>
                                        </div>
                                    )}

                                    {item.purpose && (
                                        <div className="flex flex-col gap-2">
                                            <span className={SECTION_TITLE_STYLE}>Purpose</span>
                                            <div className={CALLOUT_BOX_STYLE}>
                                                {item.purpose}
                                            </div>
                                        </div>
                                    )}

                                    {item.description && !item.purpose && !item.summary && (
                                        <div className="flex flex-col gap-2">
                                            <span className={SECTION_TITLE_STYLE}>Description</span>
                                            <div className={CALLOUT_BOX_STYLE}>
                                                {item.description}
                                            </div>
                                        </div>
                                    )}

                                    {item.comment && !item.description && !item.summary && !item.purpose && (
                                        <div className="flex flex-col gap-2">
                                            <span className={SECTION_TITLE_STYLE}>Internal Notes</span>
                                            <div className={CALLOUT_BOX_STYLE}>
                                                {item.comment}
                                            </div>
                                        </div>
                                    )}

                                    {item.rejection_reason && (
                                        <div className="flex flex-col gap-2">
                                            <span className="text-xs font-semibold uppercase tracking-wider text-error select-none">
                                                Rejection Reason
                                            </span>
                                            <div className={ERROR_CALLOUT_STYLE}>
                                                <div className="flex items-center gap-2 font-bold mb-1">
                                                    <AlertCircle className="h-4 w-4" /> Rejection Reason
                                                </div>
                                                {item.rejection_reason}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                        {isCoordinatorRequest && item.rejection_reason && (
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wider text-error select-none">
                                    Rejection Reason
                                </span>
                                <div className={ERROR_CALLOUT_STYLE}>
                                    <div className="flex items-center gap-2 font-bold mb-1">
                                        <AlertCircle className="h-4 w-4" /> Rejection Reason
                                    </div>
                                    {item.rejection_reason}
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            <span className={SECTION_TITLE_STYLE}>System Properties</span>

                            <div className="flex flex-col">
                                {isDocument && (
                                    <>
                                        {item.version && item.version !== '—' && (
                                            <div className={PROPERTY_ROW_STYLE}>
                                                <span className={PROPERTY_LABEL_STYLE}>
                                                    <Layers className={ICON_STYLE} /> Current Version
                                                </span>
                                                <span
                                                    className={PROPERTY_VALUE_STYLE}
                                                    title={`Version ${item.version}`}
                                                >
                                                    {String(item.version).startsWith('v')
                                                        ? item.version
                                                        : `v${item.version}`}
                                                </span>
                                            </div>
                                        )}

                                        {formattedFileSize && (
                                            <div className={PROPERTY_ROW_STYLE}>
                                                <span className={PROPERTY_LABEL_STYLE}>
                                                    <HardDrive className={ICON_STYLE} /> File Size
                                                </span>
                                                <span
                                                    className={PROPERTY_VALUE_STYLE}
                                                    title={formattedFileSize}
                                                >
                                                    {formattedFileSize}
                                                </span>
                                            </div>
                                        )}

                                        {mimeType && (
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

                                        {storagePath && (
                                            <div className={PROPERTY_ROW_STYLE}>
                                                <span className={PROPERTY_LABEL_STYLE}>
                                                    <FolderTree className={ICON_STYLE} /> Storage Path
                                                </span>
                                                <span
                                                    className="text-xs text-text-muted truncate max-w-48 cursor-default select-text"
                                                    title={storagePath}
                                                >
                                                    {storagePath}
                                                </span>
                                            </div>
                                        )}

                                        {checksum && (
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

                                        {item.classification && (
                                            <div className={PROPERTY_ROW_STYLE}>
                                                <span className={PROPERTY_LABEL_STYLE}>
                                                    <Shield className={ICON_STYLE} /> Classification
                                                </span>
                                                <Badge
                                                    variant={CLASSIFICATION_BADGE_VARIANT[item.classification] ?? 'neutral'}
                                                    label={item.classification}
                                                />
                                            </div>
                                        )}
                                    </>
                                )}

                                {isUser && (
                                    <>
                                        {item.university_id && (
                                            <div className={PROPERTY_ROW_STYLE}>
                                                <span className={PROPERTY_LABEL_STYLE}>
                                                    <Tag className={ICON_STYLE} /> University ID
                                                </span>
                                                <span
                                                    className="font-semibold text-xs text-text cursor-default select-text"
                                                    title={item.university_id}
                                                >
                                                    {item.university_id}
                                                </span>
                                            </div>
                                        )}

                                        {item.email && (
                                            <div className={PROPERTY_ROW_STYLE}>
                                                <span className={PROPERTY_LABEL_STYLE}>
                                                    <User className={ICON_STYLE} /> Email Address
                                                </span>
                                                <span
                                                    className="font-medium text-text truncate max-w-48 cursor-default select-text"
                                                    title={item.email}
                                                >
                                                    {item.email}
                                                </span>
                                            </div>
                                        )}

                                        {item.title && (
                                            <div className={PROPERTY_ROW_STYLE}>
                                                <span className={PROPERTY_LABEL_STYLE}>
                                                    <Info className={ICON_STYLE} /> Academic Title
                                                </span>
                                                <span
                                                    className={PROPERTY_VALUE_STYLE}
                                                    title={item.title}
                                                >
                                                    {item.title}
                                                </span>
                                            </div>
                                        )}

                                        {item.role && (
                                            <div className={PROPERTY_ROW_STYLE}>
                                                <span className={PROPERTY_LABEL_STYLE}>
                                                    <Shield className={ICON_STYLE} /> System Role
                                                </span>
                                                <Badge
                                                    variant={ROLE_BADGE_VARIANT[item.role] ?? 'neutral'}
                                                    label={item.role}
                                                />
                                            </div>
                                        )}
                                    </>
                                )}

                                {isDepartment && (
                                    <>
                                        {item.code && (
                                            <div className={PROPERTY_ROW_STYLE}>
                                                <span className={PROPERTY_LABEL_STYLE}>
                                                    <Tag className={ICON_STYLE} /> Department Code
                                                </span>
                                                <span
                                                    className="font-semibold text-xs text-text cursor-default"
                                                    title={item.code}
                                                >
                                                    {item.code}
                                                </span>
                                            </div>
                                        )}

                                        {item.division && (
                                            <div className={PROPERTY_ROW_STYLE}>
                                                <span className={PROPERTY_LABEL_STYLE}>
                                                    <Layers className={ICON_STYLE} /> Division
                                                </span>
                                                <span
                                                    className={PROPERTY_VALUE_STYLE}
                                                    title={item.division}
                                                >
                                                    {item.division}
                                                </span>
                                            </div>
                                        )}

                                        {(item.director || item.department_head) && (
                                            <div className={PROPERTY_ROW_STYLE}>
                                                <span className={PROPERTY_LABEL_STYLE}>
                                                    <User className={ICON_STYLE} /> Director
                                                </span>
                                                <span
                                                    className={PROPERTY_VALUE_STYLE}
                                                    title={item.director ?? item.department_head}
                                                >
                                                    {item.director ?? item.department_head}
                                                </span>
                                            </div>
                                        )}

                                        {item.officer && (
                                            <div className={PROPERTY_ROW_STYLE}>
                                                <span className={PROPERTY_LABEL_STYLE}>
                                                    <UserCheck className={ICON_STYLE} /> Officer
                                                </span>
                                                <span
                                                    className={PROPERTY_VALUE_STYLE}
                                                    title={item.officer}
                                                >
                                                    {item.officer}
                                                </span>
                                            </div>
                                        )}

                                        {item.faculty_count !== undefined && (
                                            <div className={PROPERTY_ROW_STYLE}>
                                                <span className={PROPERTY_LABEL_STYLE}>
                                                    <Users className={ICON_STYLE} /> Faculty Roster
                                                </span>
                                                <span
                                                    className={PROPERTY_VALUE_STYLE}
                                                    title={`${item.faculty_count} personnel`}
                                                >
                                                    {item.faculty_count} personnel
                                                </span>
                                            </div>
                                        )}
                                    </>
                                )}

                                {item.department && !isDepartment && (
                                    <div className={PROPERTY_ROW_STYLE}>
                                        <span className={PROPERTY_LABEL_STYLE}>
                                            <Building2 className={ICON_STYLE} /> Academic Unit
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

                                {formattedCreatedDate && (
                                    <div className={PROPERTY_ROW_STYLE}>
                                        <span className={PROPERTY_LABEL_STYLE}>
                                            <Calendar className={ICON_STYLE} /> Submitted Date
                                        </span>
                                        <span
                                            className={PROPERTY_VALUE_STYLE}
                                            title={formattedCreatedDate}
                                        >
                                            {formattedCreatedDate}
                                        </span>
                                    </div>
                                )}

                                {formattedUpdatedDate &&
                                    formattedUpdatedDate !== formattedCreatedDate && (
                                        <div className={PROPERTY_ROW_STYLE}>
                                            <span className={PROPERTY_LABEL_STYLE}>
                                                <Clock className={ICON_STYLE} /> Last Updated
                                            </span>
                                            <span
                                                className={PROPERTY_VALUE_STYLE}
                                                title={formattedUpdatedDate}
                                            >
                                                {formattedUpdatedDate}
                                            </span>
                                        </div>
                                    )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'versions' && isDocument && (
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
                                    (userItem) => userItem.id === versionItem.uploader_id
                                );
                                const uploaderName = uploader
                                    ? `${uploader.first_name} ${uploader.last_name}`
                                    : 'Author';

                                return (
                                    <div
                                        key={versionItem.id ?? versionIndex}
                                        className={`p-3 rounded-lg border flex flex-col gap-2 transition-all ${
                                            isCurrent
                                                ? 'bg-surface border-accent-border'
                                                : 'bg-surface-hover border-surface-border'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`px-2 py-1 rounded text-xs font-bold ${
                                                        isCurrent
                                                            ? 'bg-accent text-text-inverted'
                                                            : 'bg-surface border border-surface-border text-text-muted'
                                                    }`}
                                                >
                                                    v{versionItem.version}.0
                                                </span>
                                                {isCurrent && (
                                                    <span className="text-xs font-semibold text-accent uppercase tracking-wide">
                                                        Active
                                                    </span>
                                                )}
                                            </div>

                                            <span className="text-xs text-text-muted">
                                                {formatTimestamp(versionItem.created_at)}
                                            </span>
                                        </div>

                                        {versionItem.change_summary && (
                                            <p className="text-xs text-text leading-relaxed bg-surface p-2 rounded border border-surface-border">
                                                {versionItem.change_summary}
                                            </p>
                                        )}

                                        <div className="flex items-center justify-between gap-2 text-xs text-text-muted pt-1 border-t border-surface-border">
                                            <span className="truncate font-medium">By {uploaderName}</span>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span>{formatBytes(versionItem.size_bytes)}</span>
                                                {!isCurrent && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleActionClick(
                                                                'revert_version',
                                                                versionItem
                                                            )
                                                        }
                                                        className="px-2 py-1 rounded hover:bg-surface-hover text-accent font-semibold inline-flex items-center gap-1 text-xs transition-colors cursor-pointer"
                                                        title={`Revert document to v${versionItem.version}.0`}
                                                    >
                                                        <RotateCcw className="h-3 w-3" />
                                                        <span>Revert</span>
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
                                                    className="p-1 rounded hover:bg-surface text-text hover:text-accent transition-colors cursor-pointer"
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

                {activeTab === 'shares' && isDocument && (
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
                                        (department) => department.id === shareItem.department_id
                                    );
                                    const sharer = allUsers.find(
                                        (userItem) => userItem.id === shareItem.sharer_id
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
                                                    Shared by {sharer?.first_name ?? 'Dean'}{' '}
                                                    {sharer?.last_name ?? ''}
                                                </span>
                                                <span>{formatTimestamp(shareItem.created_at)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'contents' && isFolder && (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className={SECTION_TITLE_STYLE}>Directory Contents</span>
                            <span className="text-xs text-text-muted">
                                {folderContents.length} items
                            </span>
                        </div>

                        {folderContents.length === 0 ? (
                            <div className="p-4 rounded-lg border border-surface-border bg-surface-hover text-center text-text-muted text-xs">
                                This folder is currently empty.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {folderContents.map((contentItem) => (
                                    <div
                                        key={contentItem.id}
                                        onClick={() => handleActionClick('open', contentItem)}
                                        className="p-3 rounded-md border border-surface-border bg-surface hover:bg-surface-hover hover:border-accent-border flex items-center justify-between gap-3 cursor-pointer transition-colors"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            {contentItem.is_folder ? (
                                                <Folder className="h-4 w-4 text-accent shrink-0" />
                                            ) : (
                                                <FileText className="h-4 w-4 text-text-muted shrink-0" />
                                            )}
                                            <span
                                                className="text-xs font-medium text-text truncate cursor-default"
                                                title={contentItem.name}
                                            >
                                                {contentItem.name}
                                            </span>
                                        </div>
                                        <span className="text-xs text-text-muted shrink-0">
                                            {formatTimestamp(contentItem.updated_at)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

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
                                                {logItem.action?.replace(/_/g, ' ')} {logItem.entity_type}
                                            </span>
                                            <span className="text-xs text-text-muted">
                                                {formatTimestamp(logItem.created_at)}
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

                {activeTab === 'roster' && isDepartment && (
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
                                        onClick={() => handleActionClick('open', facultyMember)}
                                        className="p-3 rounded-md border border-surface-border bg-surface hover:bg-surface-hover hover:border-accent-border flex items-center justify-between gap-3 cursor-pointer transition-colors"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Avatar
                                                src={facultyMember.avatar_path}
                                                alt={`${facultyMember.first_name} ${facultyMember.last_name}`}
                                                size="medium"
                                            />
                                            <div className="flex flex-col min-w-0">
                                                <span
                                                    className="text-xs font-semibold text-text truncate"
                                                    title={`${facultyMember.first_name} ${facultyMember.last_name}`}
                                                >
                                                    {facultyMember.first_name} {facultyMember.last_name}
                                                </span>
                                                <span
                                                    className="text-xs text-text-muted truncate"
                                                    title={facultyMember.title ?? facultyMember.email}
                                                >
                                                    {facultyMember.title ?? facultyMember.email}
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

                        {item.status === 'PENDING' && (
                            <div className="p-3 rounded-lg bg-surface-hover border border-surface-border text-xs text-text-muted flex items-start gap-2">
                                <Clock className="h-4 w-4 text-accent shrink-0 mt-1" />
                                <span>
                                    <strong>Pending Administrator Authorization</strong> — Once approved by an administrator, these changes will be committed to the database.
                                </span>
                            </div>
                        )}
                        {item.status === 'APPROVED' && (
                            <div className="p-3 rounded-lg bg-accent-background border border-accent-border text-xs text-accent flex items-start gap-2">
                                <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-1" />
                                <span>
                                    <strong>Authorized & Executed</strong> — Changes have been carried over and successfully committed to university records.
                                </span>
                            </div>
                        )}
                        {item.status === 'REJECTED' && (
                            <div className="p-3 rounded-lg bg-error-background border border-error-border text-xs text-error flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 text-error shrink-0 mt-1" />
                                <span>
                                    <strong>Rejected</strong> — {item.rejection_reason || 'Request declined by administrator.'}
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
                                    const sender = allUsers.find(
                                        (userItem) => userItem.id === message.user_id
                                    );
                                    const isSenderActiveUser = message.user_id === activeUser?.id;
                                    const isAdministrativeUser =
                                        activeUser?.role === 'ADMINISTRATOR' ||
                                        activeUser?.role === 'COORDINATOR';
                                    const isSenderAdministrative =
                                        sender?.role === 'ADMINISTRATOR' ||
                                        sender?.role === 'COORDINATOR';
                                    const isFellowAdmin =
                                        !isSenderActiveUser &&
                                        isAdministrativeUser &&
                                        isSenderAdministrative;

                                    const senderName = sender
                                        ? `${sender.first_name} ${sender.last_name}`
                                        : 'University Office';

                                    const messageAttachments = requestAttachments.filter(
                                        (att) =>
                                            att.attached_by_id === message.user_id ||
                                            (!att.attached_by_id && isSenderActiveUser)
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
                                                src={sender?.avatar_path}
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
                                                    <span>{formatTimestamp(message.created_at)}</span>
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
                                                                                {attachment.size_bytes
                                                                                    ? formatBytes(attachment.size_bytes)
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
                                            ({stagedAttachment.size_bytes ? formatBytes(stagedAttachment.size_bytes) : 'Document'})
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
                                                    {attachment.size_bytes ? formatBytes(attachment.size_bytes) : 'Document Attachment'}
                                                    {attachment.attached_by_name ? ` · by ${attachment.attached_by_name}` : ''}
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
                {isDocument && (
                    <div className="grid grid-cols-3 gap-2 w-full">
                        <Button
                            variant="primary"
                            leadingIcon={Download}
                            onClick={() => handleActionClick('download')}
                            className="justify-center truncate px-2"
                        >
                            Download
                        </Button>
                        <Button
                            variant="secondary"
                            leadingIcon={Share2}
                            onClick={() => handleActionClick('share')}
                            className="justify-center truncate px-2"
                        >
                            Share
                        </Button>
                        <Button
                            variant="destructive"
                            leadingIcon={Archive}
                            onClick={() => handleActionClick('archive')}
                            className="justify-center truncate px-2"
                        >
                            Archive
                        </Button>
                    </div>
                )}

                {isUser && (
                    <div className="grid grid-cols-2 gap-2 w-full">
                        <Button
                            variant="primary"
                            leadingIcon={Edit3}
                            onClick={() => handleActionClick('edit')}
                            className="justify-center truncate"
                        >
                            Edit Profile
                        </Button>
                        {item.status === 'VERIFIED' ? (
                            <Button
                                variant="destructive"
                                leadingIcon={UserX}
                                onClick={() => handleActionClick('suspend')}
                                className="justify-center truncate"
                            >
                                Suspend Account
                            </Button>
                        ) : (
                            <Button
                                variant="primary"
                                leadingIcon={UserCheck}
                                onClick={() => handleActionClick('verify')}
                                className="justify-center truncate"
                            >
                                Verify Account
                            </Button>
                        )}
                    </div>
                )}

                {isDepartment && (
                    <div className="grid grid-cols-2 gap-2 w-full">
                        <Button
                            variant="primary"
                            leadingIcon={Edit3}
                            onClick={() => handleActionClick('edit')}
                            className="justify-center truncate"
                        >
                            Edit Department
                        </Button>
                        <Button
                            variant="destructive"
                            leadingIcon={Trash2}
                            onClick={() => handleActionClick('delete')}
                            className="justify-center truncate"
                        >
                            Delete
                        </Button>
                    </div>
                )}

                {isCoordinatorRequest && (
                    <div className="w-full">
                        {item.status === 'PENDING' ? (
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
                        {item.status === 'OPEN' ? (
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

                {isFolder && (
                    <Button
                        variant="primary"
                        leadingIcon={Folder}
                        onClick={() => handleActionClick('open_folder')}
                        className="w-full justify-center"
                    >
                        Browse Directory
                    </Button>
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
                                                    {doc.size_bytes ? formatBytes(doc.size_bytes) : 'Document'} • {doc.classification ?? 'OFFICIAL'}
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
        </div>
    );
};


// --- HELPERS ---
const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) {
        return '0 B';
    }
    const sizeIndex = Math.floor(Math.log(bytes) / Math.log(1024));
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const formattedValue = (bytes / Math.pow(1024, sizeIndex)).toFixed(1);
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
