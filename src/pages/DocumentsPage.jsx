// --- IMPORTS ---
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
    Plus,
    UploadCloud,
    FolderPlus,
    FolderUp,
    FileText,
    Folder,
    FileUp,
    CheckCircle2,
    Check,
    Layers,
    X,
    AlertTriangle,
    Clock,
    Shield,
    Lock,
    EyeOff,
    Globe,
    FileCheck,
    Sparkles,
    Trash2,
    Share2,
    Search,
    Users,
    ScanText,
    Image as ImageIcon,
    Crop,
    Smartphone,
    Building2,
    RotateCcw,
    FolderTree,
    ChevronDown,
    ChevronUp,
    ChevronRight,
    FolderOpen,
    Minus,
} from 'lucide-react';
import {
    Badge,
    Browser,
    Button,
    Container,
    Modal,
    TextField,
    AreaField,
    SelectField,
    DocumentViewerModal,
    DocumentScannerModal,
    MobileScanModal,
    Avatar,
    resolveUserAvatar,
    formatDateTime,
    getMimeTypeFromFilename,
    formatMimeTypeLabel,
    getExtensionFromMimeType,
    fileToBase64,
} from '../components';
import { getSpecificMimeLabel, findRootSharedFolder, getActionConfirmationConfig } from '../components/browser/common';
import { OfficerSignatureStampModal } from '../components/OfficerSignatureStampModal';
import { useToast, useAuth, useSeenDocuments } from '../hooks';
import { constants } from '../constants';
import { stripFileExtension, isGenericFileName, deriveTitleFromDocumentText } from '../utils/fileNameUtils';
import {
    useDocumentStore,
    useDepartmentStore,
    useUserStore,
    useCoordinatorStore,
    useAuthStore,
    useAuditStore,
    getRecursiveDescendantDocIds,
} from '../stores';
import {
    storageService,
    documentService,
    aiService,
    coordinatorApprovalService,
    systemEventService,
    ocrService,
} from '../services';


// --- CONFIGURATIONS ---
const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id ? String(id).toLowerCase() : '');
const FILE_EXTENSION_OPTIONS = ['.pdf', '.docx', '.xlsx', '.pptx', '.txt', '.csv', '.png', '.jpg'];

const DOCUMENT_COLUMNS = [
    { key: 'title', label: 'Name' },
    { key: 'classification', label: 'Classification' },
    { key: 'version', label: 'Version' },
    { key: 'size', label: 'Size' },
    { key: 'date', label: 'Last Modified' },
];

const buildBreadcrumbsForFolder = (folderId, allDocs, isArchived = false) => {
    const chain = [];
    let curr = (allDocs || []).find((d) => d.id === folderId);
    while (curr) {
        chain.unshift({ id: curr.id, label: curr.name ?? curr.title ?? 'Folder' });
        if (!curr.parentId && !curr.parentFolderId) break;
        const parentId = curr.parentId ?? curr.parentFolderId;
        curr = (allDocs || []).find((d) => d.id === parentId);
    }
    const rootLabel = isArchived ? 'Archives' : 'Repository Root';
    return [{ id: 'root', label: rootLabel }, ...chain];
};

const BASE_FILTER_OPTIONS = [
    // 1. STATUS
    { category: 'Status', value: constants.DOCUMENT_SHARES_STATUS.PUBLISHED, label: 'Published', icon: CheckCircle2 },
    { category: 'Status', value: constants.DOCUMENT_SHARES_STATUS.APPROVED, label: 'Approved', icon: FileCheck },
    { category: 'Status', value: constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL, label: 'Pending Approval', icon: Clock },
    { category: 'Status', value: constants.DOCUMENT_SHARES_STATUS.STASHED, label: 'Stashed', icon: Layers },

    // 2. SECURITY CLASSIFICATION
    { category: 'Classification', value: constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED, label: 'Unclassified', icon: Globe },
    { category: 'Classification', value: constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC, label: 'Public', icon: Globe },
    { category: 'Classification', value: constants.DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL, label: 'Confidential', icon: Shield },
    { category: 'Classification', value: constants.DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED, label: 'Restricted', icon: Lock },
    { category: 'Classification', value: constants.DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE, label: 'Private', icon: EyeOff },
];

const CLASSIFICATION_OPTIONS = [
    { value: constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED, label: 'Unclassified' },
    { value: constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC, label: 'Public' },
    { value: constants.DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL, label: 'Confidential' },
    { value: constants.DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED, label: 'Restricted' },
    { value: constants.DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE, label: 'Private' },
];

const INITIAL_BREADCRUMBS = [
    { id: 'root', label: 'Repository Root' },
];

const isPdfFileItem = (item, versList = []) => {
    if (!item || item.isFolder) return false;
    const cleanDoc = typeof item.id === 'string' ? item.id.replace(/-/g, '').toLowerCase() : String(item.id || '').toLowerCase();
    const vers = (versList || []).filter((v) => {
        const vId = v.document?.id ?? v.documentId;
        const cleanV = typeof vId === 'string' ? vId.replace(/-/g, '').toLowerCase() : String(vId || '').toLowerCase();
        return cleanV === cleanDoc;
    });
    const latestVer = vers.length > 0 ? [...vers].sort((a, b) => (b.version || 0) - (a.version || 0))[0] : null;
    const mime = String(latestVer?.mimeType || item.mimeType || item.type || '').toLowerCase();
    const nameOrPath = String(latestVer?.path || item.path || item.name || item.title || item.fileName || '').toLowerCase();
    if (mime.includes('pdf') || mime === 'application/pdf') return true;
    if (/\.pdf(?:[?#]|$)/i.test(nameOrPath)) return true;
    return false;
};

const ModalAffectedDocumentsSection = ({
    targetDocument,
    allDocuments = [],
    actionType = 'publish',
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const isBatch = Array.isArray(targetDocument);
    const docs = useMemo(() => {
        if (!targetDocument) return [];
        return isBatch ? targetDocument : [targetDocument];
    }, [targetDocument, isBatch]);

    const isSingleFolder = !isBatch && Boolean(docs[0]?.isFolder);

    const { affectedItems, totalFiles, totalFolders } = useMemo(() => {
        if (!targetDocument) {
            return { affectedItems: [], totalFiles: 0, totalFolders: 0 };
        }

        if (isBatch) {
            let files = 0;
            let folders = 0;
            const items = [];
            const seen = new Set();

            docs.forEach((d) => {
                if (!seen.has(d.id)) {
                    seen.add(d.id);
                    items.push(d);
                    if (d.isFolder) {
                        folders++;
                        const descIds = getRecursiveDescendantDocIds(d.id, allDocuments);
                        (allDocuments || []).forEach((c) => {
                            if (descIds.includes(c.id) && !seen.has(c.id) && !c.isArchived) {
                                seen.add(c.id);
                                items.push(c);
                                if (c.isFolder) folders++;
                                else files++;
                            }
                        });
                    } else {
                        files++;
                    }
                }
            });

            return { affectedItems: items, totalFiles: files, totalFolders: folders };
        }

        if (isSingleFolder) {
            const folder = docs[0];
            const descIds = getRecursiveDescendantDocIds(folder.id, allDocuments);
            const childItems = (allDocuments || []).filter(
                (d) => descIds.includes(d.id) && !d.isArchived
            );
            const files = childItems.filter((d) => !d.isFolder).length;
            const folders = childItems.filter((d) => d.isFolder).length;
            return {
                affectedItems: childItems,
                totalFiles: files,
                totalFolders: folders,
            };
        }

        return {
            affectedItems: docs,
            totalFiles: 1,
            totalFolders: 0,
        };
    }, [targetDocument, isBatch, isSingleFolder, docs, allDocuments]);

    if (!targetDocument || docs.length === 0) return null;

    const firstDoc = docs[0];
    const docName = firstDoc?.title || firstDoc?.name || (firstDoc?.isFolder ? 'Folder' : 'Document');

    return (
        <div className="p-3.5 rounded-xl border border-surface-border bg-surface-hover/30 flex flex-col gap-2.5">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-accent/10 text-accent shrink-0 mt-0.5">
                        {isBatch ? (
                            <Layers className="h-4 w-4" />
                        ) : isSingleFolder ? (
                            <FolderTree className="h-4 w-4" />
                        ) : (
                            <FileText className="h-4 w-4" />
                        )}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-text truncate">
                                {isBatch
                                    ? `Batch Selection: ${docs.length} Root Items`
                                    : isSingleFolder
                                    ? `Shared Root Folder: "${docName}"`
                                    : `Institutional Document: "${docName}"`}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-accent/15 text-accent border border-accent/20">
                                {isBatch ? 'Multi-Select' : isSingleFolder ? 'Shared Root' : 'Single Document'}
                            </span>
                        </div>
                        <p className="text-[11px] text-text-muted leading-relaxed mt-0.5">
                            {isBatch
                                ? `Scheduling ${actionType === 'publish' ? 'publication' : 'department share'} across ${totalFiles} ${totalFiles === 1 ? 'file' : 'files'}${totalFolders > 0 ? ` and ${totalFolders} ${totalFolders === 1 ? 'folder' : 'folders'}` : ''}. All nested items will receive these permissions.`
                                : isSingleFolder
                                ? affectedItems.length > 0
                                    ? `Cascading ${actionType === 'publish' ? 'publication' : 'department share'} to ${totalFiles} ${totalFiles === 1 ? 'file' : 'files'}${totalFolders > 0 ? ` and ${totalFolders} subfolder${totalFolders === 1 ? '' : 's'}` : ''} inside this folder.`
                                    : `This folder is currently empty. Future items placed in this folder will automatically inherit these ${actionType === 'publish' ? 'publication' : 'share'} settings.`
                                : `${firstDoc?.size || 'Direct file'} • Root Institutional Record`}
                        </p>
                    </div>
                </div>

                {affectedItems.length > 4 && (
                    <button
                        type="button"
                        onClick={() => setIsExpanded((prev) => !prev)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline shrink-0 pt-0.5 cursor-pointer"
                    >
                        <span>{isExpanded ? 'Hide Items' : `View All (${affectedItems.length})`}</span>
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                )}
            </div>

            {/* AFFECTED ITEMS PREVIEW TRAY */}
            {affectedItems.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-surface-border/60 max-h-40 overflow-y-auto">
                    {(isExpanded || affectedItems.length <= 4 ? affectedItems : affectedItems.slice(0, 4)).map((item) => {
                        const itName = item.title || item.name || (item.isFolder ? 'Folder' : 'File');
                        return (
                            <div
                                key={item.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-surface-border bg-surface text-xs text-text min-w-0 shadow-2xs"
                                title={itName}
                            >
                                {item.isFolder ? (
                                    <Folder className="h-3 w-3 text-accent shrink-0" />
                                ) : (
                                    <FileText className="h-3 w-3 text-text-muted shrink-0" />
                                )}
                                <span className="truncate max-w-[200px] text-[11px] font-medium">{itName}</span>
                            </div>
                        );
                    })}
                    {!isExpanded && affectedItems.length > 4 && (
                        <button
                            type="button"
                            onClick={() => setIsExpanded(true)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-accent/40 bg-accent/5 text-[11px] font-medium text-accent hover:bg-accent/10 cursor-pointer transition-colors"
                        >
                            +{affectedItems.length - 4} more
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};


// --- COMPONENTS ---
const DocumentsPage = ({
    currentUser: propUser = null,
    selectedItem = null,
    selectedItems = [],
    onSelectDocument,
    onSelectMultiple,
    className,
    ...props
}) => {
    // AUTH RESOLUTION
    const { currentUser: authUser } = useAuth();
    const storeUser = useAuthStore((state) => state.currentUser);
    const currentUser = propUser ?? authUser ?? storeUser ?? useAuthStore.getState().currentUser;
    const isCoordinator = constants.isCoordinatorRole(currentUser?.role);

    // REFS
    const fileInputReference = useRef(null);
    const folderInputReference = useRef(null);

    // STATES: REPOSITORY & NAVIGATION
    const [localCreatedItems, setLocalCreatedItems] = useState([]);
    const [currentFolderId, setCurrentFolderId] = useState('root');
    const [breadcrumbsList, setBreadcrumbsList] = useState(INITIAL_BREADCRUMBS);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [previewingDocument, setPreviewingDocument] = useState(null);

    // STATES: DRAG OVER
    const [isPageDragActive, setIsPageDragActive] = useState(false);
    const [isDropzoneDragActive, setIsDropzoneDragActive] = useState(false);

    // STATES: CREATION MODAL
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
    const [creationMode, setCreationMode] = useState('file');
    const [isMobileScanModalOpen, setIsMobileScanModalOpen] = useState(false);

    // STATES: STAGED ITEMS & FORMS
    const [stagedDroppedItems, setStagedDroppedItems] = useState([]);
    const [scannerItem, setScannerItem] = useState(null);
    const [conflictModalItem, setConflictModalItem] = useState(null);
    const [fileError, setFileError] = useState('');
    const [folderTitle, setFolderTitle] = useState('');
    const [folderDescription, setFolderDescription] = useState('');
    const [folderError, setFolderError] = useState('');
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);

    // STATES: ARCHIVE CONFIRMATION & RESTORE GUARD
    const [archivingItem, setArchivingItem] = useState(null);
    const [isArchivingItem, setIsArchivingItem] = useState(false);
    const [restoringItem, setRestoringItem] = useState(null);
    const [isRestoringItem, setIsRestoringItem] = useState(false);
    const [restoreConflictModalItem, setRestoreConflictModalItem] = useState(null);

    // STATES: DELETE CONFIRMATION
    const [deletingItem, setDeletingItem] = useState(null);
    const [isDeletingItemLoading, setIsDeletingItemLoading] = useState(false);

    // STATES: EDIT MODAL
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [editFormName, setEditFormName] = useState('');
    const [editFormExtension, setEditFormExtension] = useState('.pdf');
    const [editFormSummary, setEditFormSummary] = useState('');
    const [editFormClassification, setEditFormClassification] = useState(constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED);
    const [editFormComment, setEditFormComment] = useState('');
    const [editFormErrors, setEditFormErrors] = useState({});
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [isGeneratingAiSummary, setIsGeneratingAiSummary] = useState(false);
    const [isClassifyingAi, setIsClassifyingAi] = useState(false);
    const { markItemAsSeen, getHighlightedIds } = useSeenDocuments(currentUser);

    // STATES: SHARE MODAL
    const [selectedShareDepartmentIds, setSelectedShareDepartmentIds] = useState([]);
    const [departmentSearchQuery, setDepartmentSearchQuery] = useState('');
    const [isSharingDepartment, setIsSharingDepartment] = useState(false);
    const [unsharingShareId, setUnsharingShareId] = useState(null);
    const initializedShareDocIdRef = useRef(null);
    const [shareRequiresSignatureMap, setShareRequiresSignatureMap] = useState({});
    const [excludedShareDocIds, setExcludedShareDocIds] = useState(() => new Set());
    const [expandedShareFolderIds, setExpandedShareFolderIds] = useState(() => new Set());

    // STATES: PUBLISH TO MEMBERS MODAL
    const [selectedPublishMemberIds, setSelectedPublishMemberIds] = useState([]);
    const [memberSearchQuery, setMemberSearchQuery] = useState('');
    const [isPublishingMembers, setIsPublishingMembers] = useState(false);
    const [unpublishingPublicationId, setUnpublishingPublicationId] = useState(null);
    const initializedPublishDocIdRef = useRef(null);

    // STATES: ACTION CONFIRMATION & REJECTION MODALS
    const [confirmActionModal, setConfirmActionModal] = useState(null);
    const [rejectionActionModal, setRejectionActionModal] = useState(null);
    const [rejectionReasonText, setRejectionReasonText] = useState('');
    const [isSubmittingAction, setIsSubmittingAction] = useState(false);

    // STATES: OFFICER DIGITAL SIGNATURE STAMPING
    const [stampSignatureMap, setStampSignatureMap] = useState({});
    const [officerStampModalQueue, setOfficerStampModalQueue] = useState(null);
    const [isOfficerStampModalOpen, setIsOfficerStampModalOpen] = useState(false);
    const [isSubmittingOfficerStamp, setIsSubmittingOfficerStamp] = useState(false);

    const stagedFilesForApproval = useMemo(() => {
        if (!confirmActionModal || confirmActionModal.actionKey !== 'approve') return [];
        const raw = confirmActionModal.item;
        return (Array.isArray(raw) ? raw : [raw]).filter((i) => !i.isFolder);
    }, [confirmActionModal]);

    const handleOfficerStampConfirm = async ({ item, shareId, deptId, shouldStamp, stamps, isLastInQueue, queueIndex, advanceQueue }) => {
        setIsSubmittingOfficerStamp(true);
        try {
            if (shouldStamp && stamps.length > 0) {
                await useDocumentStore.getState().approveAndStampShare(shareId, {
                    shouldStamp: true,
                    stamps,
                    officerUser: currentUser,
                });
            } else {
                await useDocumentStore.getState().approveShare(shareId);
            }

            showToast({
                type: 'success',
                title: shouldStamp ? 'Document Stamped & Approved' : 'Document Approved',
                description: shouldStamp
                    ? `Successfully stamped signature on "${item?.name || item?.title || 'Document'}".`
                    : `Approved "${item?.name || item?.title || 'Document'}".`,
            });

            if (isLastInQueue) {
                setIsOfficerStampModalOpen(false);
                setOfficerStampModalQueue(null);
                if (currentUser) {
                    await syncAllDocumentShares(currentUser, departments, true).catch(() => {});
                }
            } else {
                advanceQueue();
            }
        } catch (err) {
            console.error('Failed to stamp/approve:', err);
            showToast({
                type: 'error',
                title: 'Stamping Failed',
                description: err?.message || 'Could not complete stamping.',
            });
        } finally {
            setIsSubmittingOfficerStamp(false);
        }
    };

    // HOOKS
    const { showToast, showProcessing } = useToast();
    const documents = useDocumentStore((state) => state.documents);
    const documentVersions = useDocumentStore((state) => state.documentVersions);
    const documentShares = useDocumentStore((state) => state.documentShares);
    const fetchDocuments = useDocumentStore((state) => state.fetchDocuments);
    const syncAllDocumentShares = useDocumentStore((state) => state.syncAllDocumentShares);
    const shareModalDocument = useDocumentStore((state) => state.shareModalDocument);
    const setShareModalDocument = useDocumentStore((state) => state.setShareModalDocument);
    const publishModalDocument = useDocumentStore((state) => state.publishModalDocument);
    const setPublishModalDocument = useDocumentStore((state) => state.setPublishModalDocument);
    const publishDocumentToMembers = useDocumentStore((state) => state.publishDocumentToMembers);
    const users = useUserStore((state) => state.users);
    const fetchUsers = useUserStore((state) => state.fetchUsers);
    const shareDocument = useDocumentStore((state) => state.shareDocument);
    const shareDocumentRecursive = useDocumentStore((state) => state.shareDocumentRecursive);
    const unshareDocument = useDocumentStore((state) => state.unshareDocument);
    const unshareDocumentRecursive = useDocumentStore((state) => state.unshareDocumentRecursive);
    const updateShareStatusRecursive = useDocumentStore((state) => state.updateShareStatusRecursive);
    const approveShare = useDocumentStore((state) => state.approveShare);
    const unapproveShare = useDocumentStore((state) => state.unapproveShare);
    const rejectShare = useDocumentStore((state) => state.rejectShare);
    const unrejectShare = useDocumentStore((state) => state.unrejectShare);
    const publishShare = useDocumentStore((state) => state.publishShare);
    const unpublishShare = useDocumentStore((state) => state.unpublishShare);
    const stashShare = useDocumentStore((state) => state.stashShare);
    const unstashShare = useDocumentStore((state) => state.unstashShare);
    const departments = useDepartmentStore((state) => state.departments);
    const fetchDepartments = useDepartmentStore((state) => state.fetchDepartments);

    const dynamicFilterOptions = useMemo(() => {
        return [...BASE_FILTER_OPTIONS];
    }, []);

    useEffect(() => {
        fetchDocuments().catch(() => {});
        fetchDepartments().catch(() => {});
        fetchUsers().catch(() => {});
    }, [fetchDocuments, fetchDepartments, fetchUsers]);

    useEffect(() => {
        if (currentUser) {
            syncAllDocumentShares(currentUser, departments).catch(() => {});
        }
    }, [currentUser, departments, syncAllDocumentShares]);

    useEffect(() => {
        if (!shareModalDocument) {
            initializedShareDocIdRef.current = null;
            queueMicrotask(() => {
                setSelectedShareDepartmentIds([]);
                setDepartmentSearchQuery('');
                setExcludedShareDocIds(new Set());
                setShareRequiresSignatureMap({});
                setExpandedShareFolderIds(new Set());
            });
            return;
        }

        const isShareArray = Array.isArray(shareModalDocument);
        const docKey = isShareArray
            ? shareModalDocument.map((d) => d.id).join(',')
            : shareModalDocument.id;

        if (initializedShareDocIdRef.current === docKey) {
            return;
        }
        initializedShareDocIdRef.current = docKey;

        // Initialize signature map and expand staged folders by default
        const rawDocs = isShareArray ? shareModalDocument : [shareModalDocument];
        const initialSigMap = {};
        const initialExpanded = new Set();
        const allDocs = documents || [];

        rawDocs.forEach((d) => {
            if (!d) return;
            if (d.isFolder) {
                initialExpanded.add(d.id);
                const descIds = getRecursiveDescendantDocIds(d.id, allDocs);
                allDocs.forEach((child) => {
                    if (descIds.includes(child.id) && !child.isArchived) {
                        if (child.isFolder) {
                            initialExpanded.add(child.id);
                        } else {
                            initialSigMap[child.id] = Boolean(
                                child.requiresSignature ?? documentService.getLocalRequiresSignature(child.id) ?? false
                            );
                        }
                    }
                });
            } else {
                initialSigMap[d.id] = Boolean(
                    d.requiresSignature ?? documentService.getLocalRequiresSignature(d.id) ?? false
                );
            }
        });

        queueMicrotask(() => {
            setSelectedShareDepartmentIds([]);
            setDepartmentSearchQuery('');
            setExcludedShareDocIds(new Set());
            setShareRequiresSignatureMap(initialSigMap);
            setExpandedShareFolderIds(initialExpanded);
        });
    }, [shareModalDocument, documents]);

    useEffect(() => {
        if (!publishModalDocument) {
            initializedPublishDocIdRef.current = null;
            return;
        }

        const isPublishArray = Array.isArray(publishModalDocument);
        const docKey = isPublishArray
            ? publishModalDocument.map((d) => d.id).join(',')
            : publishModalDocument.id;

        if (initializedPublishDocIdRef.current === docKey) {
            return;
        }
        initializedPublishDocIdRef.current = docKey;

        queueMicrotask(() => {
            setSelectedPublishMemberIds([]);
            setMemberSearchQuery('');
        });
    }, [publishModalDocument]);

    // DERIVED VALUES
    const userDepartment = currentUser?.department ?? 'General Repository';
    const userRole = currentUser?.role ?? constants.USERS_ROLE.MEMBER;
    const isStaff = constants.isStaffRole(userRole);
    const isOfficer = constants.isOfficerRole(userRole);
    const isDirector = constants.isDirectorRole(userRole);
    const isMember = constants.isMemberRole(userRole);
    const canUpload = isStaff;

    const repositoryItems = useMemo(() => {
        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
        const rawUserDept = currentUser?.departmentId || currentUser?.department?.id || currentUser?.department;
        const matchedUserDept = departments.find((d) =>
            cleanId(d.id) === cleanId(rawUserDept) ||
            (typeof rawUserDept === 'string' && d.name?.toLowerCase() === rawUserDept.toLowerCase()) ||
            (typeof rawUserDept === 'string' && d.code?.toLowerCase() === rawUserDept.toLowerCase())
        );
        const userDeptClean = cleanId(matchedUserDept?.id ?? currentUser?.departmentId ?? currentUser?.department?.id);

        // 1. Identify accessible documents and folders and their resolved share status
        const accessibleItemMap = new Map(); // docId -> { status, share, shares }
        const setAccessibleItem = (id, meta) => {
            accessibleItemMap.set(id, meta);
            const cId = cleanId(id);
            if (cId) accessibleItemMap.set(cId, meta);
        };

        documents.forEach((doc) => {
            const docClean = cleanId(doc.id);
            const rootSharedFolder = findRootSharedFolder(doc, documents, documentShares);
            const rootClean = rootSharedFolder ? cleanId(rootSharedFolder.id) : null;
            let docDirectShares = (documentShares || []).filter(
                (s) => cleanId(s.document?.id ?? s.documentId) === docClean
            );

            if (doc.isFolder) {
                const descendantIds = getRecursiveDescendantDocIds(doc.id, documents);
                const descendantFiles = documents.filter(
                    (d) => descendantIds.includes(d.id) && cleanId(d.id) !== docClean && !d.isFolder
                );
                if (descendantFiles.length > 0) {
                    const descendantFileIds = new Set(descendantFiles.map((d) => cleanId(d.id)));
                    const childShares = (documentShares || []).filter((s) => {
                        const sDocId = cleanId(s.document?.id ?? s.documentId);
                        const isBase = !s.recipientId && !s.recipient?.id && !s.recipient;
                        return descendantFileIds.has(sDocId) && isBase;
                    });
                    if (childShares.length > 0) {
                        docDirectShares = docDirectShares.map((fShare) => {
                            const fDeptClean = cleanId(fShare.department?.id ?? fShare.departmentId);
                            const deptChildShares = childShares.filter(
                                (s) => cleanId(s.department?.id ?? s.departmentId) === fDeptClean
                            );
                            if (deptChildShares.length === 0) return fShare;

                            const allPubOrStashed = deptChildShares.length >= descendantFiles.length &&
                                deptChildShares.every(
                                    (s) => s.status === constants.DOCUMENT_SHARES_STATUS.PUBLISHED || s.status === constants.DOCUMENT_SHARES_STATUS.STASHED
                                );
                            if (allPubOrStashed) {
                                const anyPub = deptChildShares.some((s) => s.status === constants.DOCUMENT_SHARES_STATUS.PUBLISHED);
                                return {
                                    ...fShare,
                                    status: anyPub ? constants.DOCUMENT_SHARES_STATUS.PUBLISHED : constants.DOCUMENT_SHARES_STATUS.STASHED,
                                    rejectionReason: null,
                                };
                            }
                            if (deptChildShares.some((s) => s.status === constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL)) {
                                return { ...fShare, status: constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL, rejectionReason: null };
                            }
                            if (deptChildShares.some((s) => s.status === constants.DOCUMENT_SHARES_STATUS.APPROVED)) {
                                return { ...fShare, status: constants.DOCUMENT_SHARES_STATUS.APPROVED, rejectionReason: null };
                            }
                            return { ...fShare, rejectionReason: null };
                        });
                    }
                }
            }

            // 1. Direct departmental shares for this specific document (file or folder)
            const directDeptShares = docDirectShares.filter(
                (s) => !userDeptClean || cleanId(s.department?.id ?? s.departmentId) === userDeptClean
            );

            // 2. Ancestor/folder inherited departmental shares (if no direct share)
            let effectiveDeptShares = [...directDeptShares];
            let isInheritedFromFolder = false;

            if (effectiveDeptShares.length === 0) {
                let pId = doc.parentId ?? doc.parentFolderId;
                while (pId && pId !== 'root') {
                    const parentDoc = documents.find((d) => cleanId(d.id) === cleanId(pId));
                    if (!parentDoc) break;
                    const parentDocClean = cleanId(parentDoc.id);
                    const parentDeptShares = (documentShares || []).filter(
                        (s) =>
                            cleanId(s.document?.id ?? s.documentId) === parentDocClean &&
                            (!userDeptClean || cleanId(s.department?.id ?? s.departmentId) === userDeptClean)
                    );
                    if (parentDeptShares.length > 0) {
                        // If parent folder share was marked REJECTED (e.g. from legacy folder share mutation),
                        // child files without their own direct share inherit PENDING_APPROVAL so they can undergo normal review.
                        effectiveDeptShares = parentDeptShares.map((ps) => {
                            if (String(ps.status).toUpperCase() === constants.DOCUMENT_SHARES_STATUS.REJECTED) {
                                return { ...ps, status: constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL };
                            }
                            return ps;
                        });
                        isInheritedFromFolder = true;
                        break;
                    }
                    pId = parentDoc.parentId ?? parentDoc.parentFolderId;
                }
            }

            if (isStaff) {
                // Admin and Coord see everything
                let effectiveStaffShares = [...docDirectShares];
                if (effectiveStaffShares.length === 0) {
                    let pId = doc.parentId ?? doc.parentFolderId;
                    while (pId && pId !== 'root') {
                        const parentDoc = documents.find((d) => cleanId(d.id) === cleanId(pId));
                        if (!parentDoc) break;
                        const parentClean = cleanId(parentDoc.id);
                        const parentShares = (documentShares || []).filter(
                            (s) => cleanId(s.document?.id ?? s.documentId) === parentClean
                        );
                        if (parentShares.length > 0) {
                            effectiveStaffShares = parentShares;
                            break;
                        }
                        pId = parentDoc.parentId ?? parentDoc.parentFolderId;
                    }
                }
                let resolvedStatus = '—';
                if (effectiveStaffShares.length > 0) {
                    if (effectiveStaffShares.some((s) => s.status === constants.DOCUMENT_SHARES_STATUS.PUBLISHED)) {
                        resolvedStatus = constants.DOCUMENT_SHARES_STATUS.PUBLISHED;
                    } else if (effectiveStaffShares.some((s) => s.status === constants.DOCUMENT_SHARES_STATUS.APPROVED)) {
                        resolvedStatus = constants.DOCUMENT_SHARES_STATUS.APPROVED;
                    } else if (effectiveStaffShares.some((s) => s.status === constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL)) {
                        resolvedStatus = constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL;
                    } else if (effectiveStaffShares.some((s) => s.status === constants.DOCUMENT_SHARES_STATUS.STASHED)) {
                        resolvedStatus = constants.DOCUMENT_SHARES_STATUS.STASHED;
                    } else if (effectiveStaffShares.some((s) => s.status === constants.DOCUMENT_SHARES_STATUS.REJECTED)) {
                        resolvedStatus = constants.DOCUMENT_SHARES_STATUS.REJECTED;
                    } else {
                        resolvedStatus = effectiveStaffShares[0].status;
                    }
                }
                setAccessibleItem(doc.id, {
                    status: resolvedStatus,
                    share: effectiveStaffShares[0] || null,
                    shares: effectiveStaffShares,
                    rootSharedFolder: rootSharedFolder || null,
                });
                return;
            }

            if (effectiveDeptShares.length === 0) {
                // No share row for user's department directly or via enclosing folder -> not accessible!
                return;
            }

            // Determine priority status among effective shares:
            // PUBLISHED > STASHED > APPROVED > PENDING_APPROVAL
            let resolvedStatus = '—';
            if (effectiveDeptShares.some((s) => s.status === constants.DOCUMENT_SHARES_STATUS.PUBLISHED)) {
                resolvedStatus = constants.DOCUMENT_SHARES_STATUS.PUBLISHED;
            } else if (effectiveDeptShares.some((s) => s.status === constants.DOCUMENT_SHARES_STATUS.STASHED)) {
                resolvedStatus = constants.DOCUMENT_SHARES_STATUS.STASHED;
            } else if (effectiveDeptShares.some((s) => s.status === constants.DOCUMENT_SHARES_STATUS.APPROVED)) {
                resolvedStatus = constants.DOCUMENT_SHARES_STATUS.APPROVED;
            } else if (effectiveDeptShares.some((s) => s.status === constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL)) {
                resolvedStatus = constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL;
            } else if (effectiveDeptShares.some((s) => s.status === constants.DOCUMENT_SHARES_STATUS.REJECTED)) {
                resolvedStatus = constants.DOCUMENT_SHARES_STATUS.REJECTED;
            } else {
                resolvedStatus = effectiveDeptShares[0]?.status ?? '—';
            }

            const primaryShare = effectiveDeptShares.find((s) => s.status === resolvedStatus) || effectiveDeptShares[0];

            // Role-based status gating:
            // OFFICER: PENDING_APPROVAL, APPROVED, STASHED, PUBLISHED, REJECTED
            if (isOfficer) {
                if (
                    [
                        constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL,
                        constants.DOCUMENT_SHARES_STATUS.APPROVED,
                        constants.DOCUMENT_SHARES_STATUS.STASHED,
                        constants.DOCUMENT_SHARES_STATUS.PUBLISHED,
                        constants.DOCUMENT_SHARES_STATUS.REJECTED,
                    ].includes(resolvedStatus)
                ) {
                    setAccessibleItem(doc.id, {
                        status: resolvedStatus,
                        share: primaryShare,
                        shares: effectiveDeptShares,
                        isInherited: isInheritedFromFolder,
                    });
                }
            } else if (isDirector) {
                // DIRECTOR: APPROVED, STASHED, PUBLISHED
                if (
                    [
                        constants.DOCUMENT_SHARES_STATUS.APPROVED,
                        constants.DOCUMENT_SHARES_STATUS.STASHED,
                        constants.DOCUMENT_SHARES_STATUS.PUBLISHED,
                    ].includes(resolvedStatus)
                ) {
                    setAccessibleItem(doc.id, {
                        status: resolvedStatus,
                        share: primaryShare,
                        shares: effectiveDeptShares,
                        isInherited: isInheritedFromFolder,
                    });
                }
            } else if (isMember) {
                // MEMBER: PUBLISHED only.
                if (resolvedStatus === constants.DOCUMENT_SHARES_STATUS.PUBLISHED) {
                    const memberSpecificShares = effectiveDeptShares.filter(
                        (s) => s.recipient?.id ?? s.recipientId
                    );

                    if (memberSpecificShares.length > 0) {
                        const userShare = memberSpecificShares.find(
                            (s) => cleanId(s.recipient?.id ?? s.recipientId) === cleanId(currentUser?.id)
                        );
                        if (userShare && userShare.status === constants.DOCUMENT_SHARES_STATUS.PUBLISHED) {
                            setAccessibleItem(doc.id, {
                                status: userShare.status,
                                share: userShare,
                                shares: [userShare],
                                isInherited: isInheritedFromFolder,
                            });
                        }
                    } else {
                        // Broad publication for all department members
                        setAccessibleItem(doc.id, {
                            status: resolvedStatus,
                            share: primaryShare,
                            shares: effectiveDeptShares,
                            isInherited: isInheritedFromFolder,
                        });
                    }
                }
            }
        });

        // 2. Determine folder accessibility
        // For staff: all folders visible.
        // For department users: folder is visible if:
        //   - it is directly accessible (has permitted share row for user's department)
        //   - OR it is an ancestor of ANY item (file or subfolder) that is accessible
        const accessibleFolderIdSet = new Set();
        if (isStaff) {
            documents.forEach((d) => {
                if (d.isFolder) {
                    accessibleFolderIdSet.add(d.id);
                    accessibleFolderIdSet.add(cleanId(d.id));
                }
            });
        } else {
            accessibleItemMap.forEach((_, itemId) => {
                const itemDoc = documents.find((d) => cleanId(d.id) === cleanId(itemId));
                if (itemDoc?.isFolder) {
                    accessibleFolderIdSet.add(itemDoc.id);
                    accessibleFolderIdSet.add(cleanId(itemDoc.id));
                }
                let pId = itemDoc?.parentId ?? itemDoc?.parentFolderId;
                while (pId && pId !== 'root') {
                    accessibleFolderIdSet.add(pId);
                    accessibleFolderIdSet.add(cleanId(pId));
                    const parentDoc = documents.find((d) => cleanId(d.id) === cleanId(pId));
                    if (!parentDoc) break;
                    pId = parentDoc.parentId ?? parentDoc.parentFolderId;
                }
            });
        }

        // 3. Filter documents to accessible ones (Non-administrative roles never see folders)
        const accessibleDocs = documents.filter((doc) => {
            if (!isStaff && doc.isFolder) {
                return false;
            }
            if (doc.isFolder) {
                return accessibleFolderIdSet.has(doc.id) || accessibleFolderIdSet.has(cleanId(doc.id));
            }
            return accessibleItemMap.has(doc.id) || accessibleItemMap.has(cleanId(doc.id));
        });

        // Build set of rejected documents
        const rejectedDocIdSet = new Set();

        documents.forEach((d) => {
            if (d.isFolder) return;
            const dClean = cleanId(d.id);
            const sharesForDoc = (documentShares || []).filter(
                (s) => cleanId(s.document?.id ?? s.documentId) === dClean &&
                    (!userDeptClean || cleanId(s.department?.id ?? s.departmentId) === userDeptClean)
            );
            const isDocRejected = sharesForDoc.some(
                (s) => String(s.status).toUpperCase() === constants.DOCUMENT_SHARES_STATUS.REJECTED
            );
            if (isDocRejected) {
                rejectedDocIdSet.add(d.id);
                rejectedDocIdSet.add(dClean);
            }
        });

        // Build set of pending action documents for Officer & Director workflow
        const pendingActionDocIdSet = new Set();
        const foldersWithPendingActionChildrenSet = new Set();

        if (isOfficer || isDirector) {
            documents.forEach((d) => {
                if (d.isFolder) return;
                const dClean = cleanId(d.id);
                const shareMeta = accessibleItemMap.get(d.id) || accessibleItemMap.get(dClean);

                const deptSharesForDoc = (documentShares || []).filter(
                    (s) =>
                        cleanId(s.document?.id ?? s.documentId) === dClean &&
                        (!userDeptClean || cleanId(s.department?.id ?? s.departmentId) === userDeptClean)
                );

                const hasPublished = deptSharesForDoc.some(
                    (s) => String(s.status).toUpperCase() === constants.DOCUMENT_SHARES_STATUS.PUBLISHED
                ) || shareMeta?.status === constants.DOCUMENT_SHARES_STATUS.PUBLISHED;

                const hasStashed = deptSharesForDoc.some(
                    (s) => String(s.status).toUpperCase() === constants.DOCUMENT_SHARES_STATUS.STASHED
                ) || shareMeta?.status === constants.DOCUMENT_SHARES_STATUS.STASHED;

                const hasApproved = deptSharesForDoc.some(
                    (s) => String(s.status).toUpperCase() === constants.DOCUMENT_SHARES_STATUS.APPROVED
                ) || shareMeta?.status === constants.DOCUMENT_SHARES_STATUS.APPROVED;

                const hasPendingApproval = deptSharesForDoc.some(
                    (s) => String(s.status).toUpperCase() === constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL
                ) || shareMeta?.status === constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL;

                const isPending = isOfficer
                    ? (hasPendingApproval && !hasApproved && !hasPublished)
                    : isDirector
                        ? (hasApproved && !hasPublished && !hasStashed)
                        : false;

                if (isPending) {
                    pendingActionDocIdSet.add(d.id);
                    pendingActionDocIdSet.add(dClean);

                    let pId = d.parentId ?? d.parentFolderId;
                    while (pId && pId !== 'root') {
                        foldersWithPendingActionChildrenSet.add(pId);
                        foldersWithPendingActionChildrenSet.add(cleanId(pId));
                        const parentDoc = documents.find((p) => cleanId(p.id) === cleanId(pId));
                        if (!parentDoc) break;
                        pId = parentDoc.parentId ?? parentDoc.parentFolderId;
                    }
                }
            });
        }

        // 4. Map into browser items
        const liveItems = accessibleDocs.map((doc) => {
            const docClean = cleanId(doc.id);
            const versionsForDoc = (documentVersions || []).filter(
                (v) => cleanId(v.document?.id ?? v.documentId) === docClean
            );
            const latestVer = versionsForDoc.length > 0
                ? [...versionsForDoc].sort((a, b) => b.version - a.version)[0]
                : null;

            const folderSizeBytes = doc.isFolder
                ? getRecursiveFolderSizeBytes(doc.id, documents, documentVersions)
                : null;
            const formattedSize = doc.isFolder
                ? formatFileSize(folderSizeBytes)
                : (latestVer?.sizeBytes ? formatFileSize(latestVer.sizeBytes) : '—');

            const originalLocation = doc.parentId && doc.parentId !== 'root'
                ? (() => {
                    const chain = [];
                    let curr = (documents || []).find((d) => cleanId(d.id) === cleanId(doc.parentId));
                    while (curr) {
                        chain.unshift(curr.name || curr.title || 'Folder');
                        const pId = curr.parentId ?? curr.parentFolderId;
                        if (!pId || pId === 'root') break;
                        curr = (documents || []).find((d) => cleanId(d.id) === cleanId(pId));
                    }
                    return chain.length > 0 ? chain.join(' / ') : 'Repository Root';
                })()
                : 'Repository Root';

            const shareMeta = accessibleItemMap.get(doc.id) || accessibleItemMap.get(docClean) || (() => {
                if (isStaff) {
                    const docShares = (documentShares || []).filter(
                        (s) => cleanId(s.document?.id ?? s.documentId) === docClean
                    );
                    if (docShares.length > 0) {
                        return {
                            status: docShares[0].status,
                            share: docShares[0],
                            shares: docShares,
                        };
                    }
                } else if (userDeptClean) {
                    const deptShare = (documentShares || []).find(
                        (s) =>
                            cleanId(s.document?.id ?? s.documentId) === docClean &&
                            cleanId(s.department?.id ?? s.departmentId) === userDeptClean
                    );
                    if (deptShare) {
                        return {
                            status: deptShare.status,
                            share: deptShare,
                            shares: [deptShare],
                        };
                    }
                }
                return { status: '—', share: null, shares: [] };
            })();
            const itemStatus = shareMeta?.status ?? '—';

            const displayName = doc.isFolder ? doc.name : stripFileExtension(doc.name || '') || doc.name;
            const effectiveMime = doc.isFolder ? 'folder' : (latestVer?.mimeType || (doc.name ? getMimeTypeFromFilename(doc.name) : null));
            const subtitleText = doc.isFolder ? 'Directory' : getSpecificMimeLabel(effectiveMime, doc.name);

            const isDocRejected = !doc.isFolder && (rejectedDocIdSet.has(doc.id) || rejectedDocIdSet.has(docClean));
            const isDocActionPending = (isOfficer || isDirector) && !doc.isFolder && (pendingActionDocIdSet.has(doc.id) || pendingActionDocIdSet.has(docClean));
            const hasPendingActionChild = (isOfficer || isDirector) && doc.isFolder && (foldersWithPendingActionChildrenSet.has(doc.id) || foldersWithPendingActionChildrenSet.has(docClean));
            const isActionPending = isDocActionPending || hasPendingActionChild;

            return {
                id: doc.id,
                parentId: doc.parentId ?? 'root',
                title: displayName,
                name: displayName,
                subtitle: subtitleText,
                fileName: doc.name || null,
                mimeType: effectiveMime,
                description: doc.comment ?? null,
                summary: doc.isFolder ? null : (latestVer?.summary ?? null),
                comment: doc.comment ?? null,
                category: doc.isFolder ? 'Folder' : 'Document',
                classification: doc.isFolder
                    ? null
                    : (latestVer?.classification ?? constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED),
                version: doc.isFolder ? '—' : (latestVer ? `v${latestVer.version}.0` : 'v1.0'),
                size: formattedSize,
                sizeBytes: doc.isFolder ? folderSizeBytes : (latestVer?.sizeBytes ?? 0),
                path: latestVer?.path ?? null,
                status: itemStatus,
                share: shareMeta?.share ?? null,
                uploaderId: latestVer?.uploader?.id || latestVer?.uploaderId || latestVer?.uploader || doc.uploaderId || doc.uploader?.id || doc.uploader || null,
                uploader: latestVer?.uploader || doc.uploader || null,
                createdAt: latestVer?.createdAt || doc.createdAt || doc.updatedAt || null,
                updatedAt: doc.updatedAt || latestVer?.createdAt || doc.createdAt || null,
                rawDate: doc.updatedAt || latestVer?.createdAt || doc.createdAt || null,
                date: (doc.updatedAt || latestVer?.createdAt || doc.createdAt) && !isNaN(new Date(doc.updatedAt || latestVer?.createdAt || doc.createdAt).getTime())
                    ? formatDateTime(doc.updatedAt || latestVer?.createdAt || doc.createdAt)
                    : 'Active',
                isFolder: Boolean(doc.isFolder),
                isArchived: Boolean(doc.isArchived),
                directlyArchived: doc.directlyArchived,
                originalLocation: originalLocation,
                isRejected: isDocRejected,
                hasRejectedChild: false,
                isPendingAction: isActionPending,
                isWarning: isActionPending,
                hasPendingActionChild: hasPendingActionChild,
                tags: doc.isFolder
                    ? ['Folder']
                    : [
                        latestVer?.classification ?? constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED,
                        ...(itemStatus && itemStatus !== '—' ? [itemStatus] : []),
                    ],
            };
        });

        return [...localCreatedItems, ...liveItems];
    }, [documents, documentVersions, documentShares, localCreatedItems, currentUser, isStaff, isOfficer, isDirector, isMember, departments]);

    // DERIVED SELECTION & ACTIVE FOLDER: Reactive to both local navigation and external selectedItem
    const activeSelectedDocument = useMemo(() => {
        if (selectedItems && selectedItems.length > 1) return null;
        const targetId = selectedItem?.id ?? selectedDocument?.id;
        if (!targetId) return null;
        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
        const targetClean = cleanId(targetId);
        const matched = repositoryItems.find((item) => cleanId(item.id) === targetClean);
        return matched ?? null;
    }, [selectedItems, selectedItem, selectedDocument, repositoryItems]);

    const activeFolderId = useMemo(() => {
        if (selectedItem?.id) {
            const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
            const targetClean = cleanId(selectedItem.id);
            const matched = repositoryItems.find((item) => cleanId(item.id) === targetClean);
            if (matched && matched.parentId && matched.parentId !== 'root') {
                return matched.parentId;
            }
        }
        return currentFolderId;
    }, [selectedItem, repositoryItems, currentFolderId]);

    const currentFolderItems = useMemo(() => {
        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
        return repositoryItems.filter((item) => {
            const matchesArchiveState = !item.isArchived;
            if (!matchesArchiveState) return false;
            if (!isStaff) {
                return !item.isFolder;
            }
            const itemParent = item.parentId ?? 'root';
            if (activeFolderId === 'root') {
                return !itemParent || itemParent === 'root';
            }
            return cleanId(itemParent) === cleanId(activeFolderId);
        });
    }, [repositoryItems, activeFolderId, isStaff]);

    const activeBreadcrumbsList = useMemo(() => {
        if (!isStaff) {
            return [{ id: 'root', label: 'Documents' }];
        }
        if (activeFolderId !== 'root') {
            return buildBreadcrumbsForFolder(activeFolderId, documents);
        }
        return breadcrumbsList;
    }, [activeFolderId, documents, breadcrumbsList, isStaff]);

    const highlightedIds = useMemo(() => {
        return getHighlightedIds(repositoryItems);
    }, [getHighlightedIds, repositoryItems]);

    const currentDirectoryLabel = activeBreadcrumbsList[activeBreadcrumbsList.length - 1]?.label ?? 'current directory';

    // HANDLERS
    const handleBreadcrumbClick = (breadcrumbItem) => {
        setCurrentFolderId(breadcrumbItem.id);
        setBreadcrumbsList(buildBreadcrumbsForFolder(breadcrumbItem.id, documents));
        setSelectedDocument(null);
        onSelectDocument?.(null);
    };

    const handleItemSelect = (item) => {
        setSelectedDocument(item);
        onSelectDocument?.(item);
        if (item) {
            markItemAsSeen(item);
        }
    };

    const handleItemDoubleClick = useCallback((item) => {
        if (!item) {
            return;
        }

        if (item.isFolder) {
            if (item.isArchived) {
                showToast({
                    type: 'warning',
                    title: 'Archived Folder',
                    description: 'Cannot browse contents of an archived folder. Restore the folder to view its contents.',
                });
                return;
            }

            setCurrentFolderId(item.id);
            setBreadcrumbsList(buildBreadcrumbsForFolder(item.id, documents));
            setSelectedDocument(null);
            onSelectDocument?.(null);
            return;
        }

        // When item is a file:
        if (item.isArchived) {
            showToast({
                type: 'warning',
                title: 'Archived Document',
                description: 'Cannot view an archived document. Restore the document to view its contents.',
            });
            return;
        }

        // PERMISSION CLEARANCE CHECK FOR NON-ADMIN/COORD ROLES
        const isStaffUser = constants.isStaffRole(currentUser?.role);

        if (!isStaffUser) {
            const hasAccess = repositoryItems.some((r) => r.id === item.id);
            if (!hasAccess) {
                showToast({
                    type: 'error',
                    title: 'Access Restricted',
                    description: 'You do not have clearance to view this document.',
                });
                return;
            }
        }

        // Navigate into its containing directory if needed, select the file, and open preview modal
        const targetParentId = item.parentId ?? 'root';
        if (targetParentId !== currentFolderId) {
            setCurrentFolderId(targetParentId);
            setBreadcrumbsList(buildBreadcrumbsForFolder(targetParentId, documents));
        }
        setSelectedDocument(item);
        onSelectDocument?.(item);
        setPreviewingDocument(item);
    }, [documents, showToast, currentUser?.role, repositoryItems, currentFolderId, onSelectDocument]);

    useEffect(() => {
        const handleOpenFolderEvent = (event) => {
            if (event?.detail) {
                const target = event.detail;
                if (target.isArchived) {
                    showToast({
                        type: 'warning',
                        title: 'Archived Folder',
                        description: 'Cannot browse contents of an archived folder. Restore the folder to view its contents.',
                    });
                    return;
                }
                handleItemDoubleClick(target);
            }
        };

        const handleOpenFileEvent = (event) => {
            if (event?.detail) {
                const target = event.detail;
                if (target.isArchived) {
                    showToast({
                        type: 'warning',
                        title: 'Archived Document',
                        description: 'Cannot view an archived document. Restore the document to view its contents.',
                    });
                    return;
                }
                handleItemDoubleClick(target);
            }
        };

        window.addEventListener('pamantasan:open-folder', handleOpenFolderEvent);
        window.addEventListener('pamantasan:open-file', handleOpenFileEvent);
        return () => {
            window.removeEventListener('pamantasan:open-folder', handleOpenFolderEvent);
            window.removeEventListener('pamantasan:open-file', handleOpenFileEvent);
        };
    }, [documents, handleItemDoubleClick, showToast]);

    // LISTEN FOR EXTERNAL ARCHIVE & DELETE TRIGGERS (E.G. FROM INSPECTOR QUICK ACTION)
    useEffect(() => {
        const handleArchiveDocEvent = (event) => {
            if (event.detail) {
                const targetDoc = Array.isArray(event.detail)
                    ? event.detail
                    : (documents.find((d) => d?.id === event.detail.id) ?? event.detail);
                setArchivingItem(targetDoc);
            }
        };
        const handleDeleteDocEvent = (event) => {
            if (event.detail) {
                const targetDoc = Array.isArray(event.detail)
                    ? event.detail
                    : (documents.find((d) => d?.id === event.detail.id) ?? event.detail);
                setDeletingItem(targetDoc);
            }
        };
        window.addEventListener('pamantasan:archive-document', handleArchiveDocEvent);
        window.addEventListener('pamantasan:delete-document', handleDeleteDocEvent);
        return () => {
            window.removeEventListener('pamantasan:archive-document', handleArchiveDocEvent);
            window.removeEventListener('pamantasan:delete-document', handleDeleteDocEvent);
        };
    }, [documents]);

    useEffect(() => {
        if (isCreateModalOpen) {
            queueMicrotask(() => {
                setIsPageDragActive(false);
            });
        }
    }, [isCreateModalOpen]);

    const handleOpenCreateModal = () => {
        setStagedDroppedItems([]);
        setFileError('');
        setFolderTitle('');
        setFolderDescription('');
        setFolderError('');
        setIsDiscardConfirmOpen(false);
        setIsCreateModalOpen(true);
    };

    const handleRequestCloseCreateModal = () => {
        const hasStagedItems = stagedDroppedItems.length > 0;
        const hasUnsavedFolder = folderTitle.trim().length > 0 || folderDescription.trim().length > 0;

        if (hasStagedItems || hasUnsavedFolder) {
            setIsDiscardConfirmOpen(true);
            return;
        }

        handleForceCloseCreateModal();
    };

    const handleForceCloseCreateModal = () => {
        setIsCreateModalOpen(false);
        setIsDiscardConfirmOpen(false);
        setStagedDroppedItems([]);
        setFileError('');
        setFolderTitle('');
        setFolderDescription('');
        setFolderError('');
    };

    const handleCancelDiscard = () => {
        setIsDiscardConfirmOpen(false);
    };

    const handleCreationModeChange = (selectedMode) => {
        setCreationMode(selectedMode);
    };

    const handleCloseEditModal = () => {
        if (isSavingEdit) return;
        setIsEditModalOpen(false);
        setEditItem(null);
        setEditFormErrors({});
    };

    const handleGenerateSummaryWithAI = async () => {
        if (!editItem) return;
        setIsGeneratingAiSummary(true);

        try {
            if (editItem.isFolder) {
                // Folder summary synthesis
                const childDocs = (documents || []).filter(
                    (d) => (d.parentId ?? null) === editItem.id && !d.isArchived
                );
                const childMeta = childDocs.map((doc) => {
                    const vers = (documentVersions || []).filter(
                        (v) => (v.document?.id ?? v.documentId) === doc.id
                    );
                    const latest = vers.length > 0 ? [...vers].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0] : null;
                    return {
                        name: doc.name || doc.title,
                        mimeType: latest?.mimeType,
                        summary: latest?.summary,
                        classification: latest?.classification,
                    };
                });

                const res = await aiService.synthesizeFolderSummary({
                    folderName: editFormName.trim() || editItem.name || 'Folder',
                    childDocuments: childMeta,
                });

                if (res?.summary) {
                    setEditFormSummary(res.summary);
                    if (editFormErrors.summary) setEditFormErrors((prev) => ({ ...prev, summary: '' }));
                    showToast({
                        type: 'success',
                        title: 'Summary Generated',
                        description: 'Generated folder overview based on child repository items.',
                    });
                }
            } else {
                // File summary analysis
                const vers = (documentVersions || []).filter(
                    (v) => (v.document?.id ?? v.documentId) === editItem.id
                );
                const latestVer = vers.length > 0
                    ? [...vers].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0]
                    : null;
                const path = latestVer?.path || editItem.path;

                const fullFileName = editItem.isFolder ? editFormName.trim() : `${editFormName.trim()}${editFormExtension}`;
                if (path) {
                    const res = await aiService.analyzeDocumentFile({
                        storagePath: path,
                        mimeType: latestVer?.mimeType || 'application/octet-stream',
                        fileName: fullFileName || editItem.name || 'document',
                        fileSize: latestVer?.sizeBytes || 0,
                    });

                    if (res?.summary) {
                        setEditFormSummary(res.summary);
                        if (editFormErrors.summary) setEditFormErrors((prev) => ({ ...prev, summary: '' }));
                    }

                    if (res?.classification && res.classification !== 'UNCLASSIFIED') {
                        setEditFormClassification(res.classification);
                        if (editFormErrors.classification) setEditFormErrors((prev) => ({ ...prev, classification: '' }));
                    }

                    showToast({
                        type: 'success',
                        title: 'Summary Generated',
                        description: `Summary and classification updated (${res?.classification || 'Analyzed'}).`,
                    });
                } else {
                    const cleanedName = stripFileExtension(editItem.isFolder ? editFormName : `${editFormName}${editFormExtension}`).replace(/[-_]/g, ' ');
                    const generated = `Institutional documentation and operational records pertaining to ${cleanedName}.`;
                    setEditFormSummary(generated);
                    if (editFormErrors.summary) {
                        setEditFormErrors((prev) => ({ ...prev, summary: '' }));
                    }
                    showToast({
                        type: 'success',
                        title: 'Summary Generated',
                        description: 'Generated document summary based on filename.',
                    });
                }
            }
        } catch (err) {
            console.error('AI summary error:', err);
            showToast({
                type: 'error',
                title: 'AI Generation Failed',
                description: err?.message || 'Could not generate AI summary.',
            });
        } finally {
            setIsGeneratingAiSummary(false);
        }
    };

    const handleAutoClassifyWithAI = async () => {
        if (!editItem) return;
        setIsClassifyingAi(true);
        try {
            const vers = (documentVersions || []).filter(
                (v) => (v.document?.id ?? v.documentId) === editItem.id
            );
            const latestVer = vers.length > 0
                ? [...vers].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0]
                : null;
            const path = latestVer?.path || editItem.path;

            const fullFileName = editItem.isFolder ? editFormName.trim() : `${editFormName.trim()}${editFormExtension}`;
            if (path) {
                try {
                    const res = await aiService.analyzeDocumentFile({
                        storagePath: path,
                        mimeType: latestVer?.mimeType || 'application/octet-stream',
                        fileName: fullFileName || editItem.name || 'document',
                        fileSize: latestVer?.sizeBytes || 0,
                        extractedText: editFormSummary || latestVer?.summary || null,
                    });
                    if (res?.classification && res.classification !== 'UNCLASSIFIED') {
                        setEditFormClassification(res.classification);
                        if (editFormErrors.classification) {
                            setEditFormErrors((prev) => ({ ...prev, classification: '' }));
                        }
                        showToast({
                            type: 'success',
                            title: 'Document Classified',
                            description: `Classified as ${res.classification} based on document content.`,
                        });
                        return;
                    }
                } catch (err) {
                    console.warn('AI classification fallback to keywords:', err);
                }
            }

            // Fallback keyword heuristic
            const lower = (editFormName + ' ' + editFormSummary).toLowerCase();
            let suggested = constants.DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL;
            if (lower.includes('public') || lower.includes('handbook') || lower.includes('memo') || lower.includes('calendar') || lower.includes('bulletin')) {
                suggested = constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC;
            } else if (lower.includes('restricted') || lower.includes('exam') || lower.includes('board') || lower.includes('audit')) {
                suggested = constants.DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED;
            } else if (lower.includes('private') || lower.includes('personal') || lower.includes('medical') || lower.includes('salary')) {
                suggested = constants.DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE;
            }
            setEditFormClassification(suggested);
            showToast({
                type: 'success',
                title: 'Document Classified',
                description: `Classified as ${suggested} based on document content keywords.`,
            });
        } finally {
            setIsClassifyingAi(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!editItem) return;
        const errors = {};
        if (!editFormName.trim()) {
            errors.name = 'Name is required.';
        }
        if (!editItem.isFolder) {
            if (!editFormClassification) {
                errors.classification = 'Classification is required.';
            }
        }

        if (Object.keys(errors).length > 0) {
            setEditFormErrors(errors);
            return;
        }

        const cleanSavedName = editItem.isFolder
            ? editFormName.trim()
            : stripFileExtension(editFormName.trim());

        const targetMimeType = editItem.isFolder
            ? undefined
            : (getMimeTypeFromFilename(`file${editFormExtension}`) || 'application/pdf');

        setIsSavingEdit(true);
        try {
            if (isCoordinator) {
                const docPayload = {
                    documentId: editItem.id,
                    documentTitle: cleanSavedName,
                    isFolder: Boolean(editItem.isFolder),
                    new: {
                        name: cleanSavedName,
                        comment: editFormComment.trim() || null,
                        summary: editItem.isFolder ? null : (editFormSummary.trim() || null),
                        classification: editItem.isFolder ? null : editFormClassification,
                        mimeType: editItem.isFolder ? null : targetMimeType,
                    },
                };

                const requesterId = currentUser?.id ?? useAuthStore.getState().currentUser?.id;
                await coordinatorApprovalService.submitCoordinatorRequest({
                    action: constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_UPDATE,
                    requesterId,
                    data: docPayload,
                });
                useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});

                showToast({
                    type: 'success',
                    title: 'Request Submitted',
                    description: `Edit request for "${cleanSavedName}" sent for Administrator approval.`,
                });
                setIsEditModalOpen(false);
                return;
            }

            await useDocumentStore.getState().updateDocument(editItem.id, {
                name: cleanSavedName,
                comment: editFormComment.trim() || null,
            });

            if (!editItem.isFolder) {
                const vers = (documentVersions || []).filter(
                    (v) => (v.document?.id ?? v.documentId) === editItem.id
                );
                const latestVer = vers.length > 0
                    ? [...vers].sort((a, b) => b.version - a.version)[0]
                    : null;
                if (latestVer) {
                    await useDocumentStore.getState().updateDocumentVersion(latestVer.id, {
                        documentId: editItem.id,
                        summary: editFormSummary.trim() || null,
                        classification: editFormClassification,
                        changeSummary: 'Updated metadata via editor',
                        mimeType: targetMimeType,
                    });
                }
            }

            await fetchDocuments(null, true);

            const timestamp = new Date().toISOString();
            const updatedSelected = {
                ...editItem,
                name: cleanSavedName,
                title: cleanSavedName,
                comment: editFormComment.trim() || null,
                description: editItem.isFolder ? (editFormComment.trim() || null) : (editFormSummary.trim() || null),
                summary: editItem.isFolder ? null : (editFormSummary.trim() || null),
                classification: editItem.isFolder ? '—' : editFormClassification,
                mimeType: editItem.isFolder ? undefined : targetMimeType,
                updatedAt: timestamp,
                date: formatDateTime(timestamp),
            };

            if (selectedDocument?.id === editItem.id) {
                setSelectedDocument(updatedSelected);
                onSelectDocument?.(updatedSelected);
            }

            showToast({
                type: 'success',
                title: editItem.isFolder ? 'Folder Updated' : 'Document Updated',
                description: `Changes to "${cleanSavedName}" have been saved.`,
            });

            setIsEditModalOpen(false);
            setEditItem(null);
        } catch (err) {
            showToast({
                type: 'error',
                title: 'Update Failed',
                description: err?.message || 'Could not update document metadata.',
                rawError: err?.stack || String(err),
            });
        } finally {
            setIsSavingEdit(false);
        }
    };

    const unshareItemFromAllDepartments = async (targetItem) => {
        if (!targetItem?.id) return;
        await useDocumentStore.getState().unshareDocumentFromAllDepartments(targetItem.id);
    };

    const handleConfirmAction = async () => {
        if (!confirmActionModal) return;
        const { actionKey, item, shareId, deptId, docTitle } = confirmActionModal;
        setIsSubmittingAction(true);
        try {
            const cleanId = (uid) => (typeof uid === 'string' ? uid.replace(/-/g, '').toLowerCase() : uid);
            const userDeptClean = cleanId(currentUser?.departmentId);

            const executeSingle = async (targetItem, targetShareId, targetDeptId) => {
                const isTargetFolder = Boolean(targetItem.isFolder);
                const freshShares = useDocumentStore.getState().documentShares || [];
                const targetDocClean = cleanId(targetItem.id);
                const targetDeptClean = cleanId(targetDeptId || currentUser?.departmentId);

                // Find direct departmental share for this exact document
                const directShare = freshShares.find((s) => {
                    const sDocClean = cleanId(s.document?.id ?? s.documentId);
                    const sDeptClean = cleanId(s.department?.id ?? s.departmentId);
                    const isBase = !s.recipientId && !s.recipient?.id;
                    return sDocClean === targetDocClean && sDeptClean === targetDeptClean && isBase;
                }) || freshShares.find((s) => {
                    const sDocClean = cleanId(s.document?.id ?? s.documentId);
                    const sDeptClean = cleanId(s.department?.id ?? s.departmentId);
                    return sDocClean === targetDocClean && sDeptClean === targetDeptClean;
                });

                if (actionKey === 'approve') {
                    if (isTargetFolder && targetDeptId) {
                        await updateShareStatusRecursive(targetItem.id, targetDeptId, constants.DOCUMENT_SHARES_STATUS.APPROVED);
                    } else if (directShare) {
                        await approveShare(directShare.id);
                    } else if (!isTargetFolder && targetDeptId) {
                        await useDocumentStore.getState().insertDocumentShare({
                            documentId: targetItem.id,
                            departmentId: targetDeptId,
                            sharerId: currentUser?.id,
                            recipientId: null,
                            status: constants.DOCUMENT_SHARES_STATUS.APPROVED,
                        });
                    }
                } else if (actionKey === 'unapprove') {
                    if (isTargetFolder && targetDeptId) {
                        await updateShareStatusRecursive(targetItem.id, targetDeptId, constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL);
                    } else if (directShare) {
                        await unapproveShare(directShare.id);
                    } else if (!isTargetFolder && targetDeptId) {
                        await useDocumentStore.getState().insertDocumentShare({
                            documentId: targetItem.id,
                            departmentId: targetDeptId,
                            sharerId: currentUser?.id,
                            recipientId: null,
                            status: constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL,
                        });
                    }
                } else if (actionKey === 'stash') {
                    if (isTargetFolder && targetDeptId) {
                        await updateShareStatusRecursive(targetItem.id, targetDeptId, constants.DOCUMENT_SHARES_STATUS.STASHED);
                    } else if (directShare) {
                        await stashShare(directShare.id);
                    } else if (!isTargetFolder && targetDeptId) {
                        await useDocumentStore.getState().insertDocumentShare({
                            documentId: targetItem.id,
                            departmentId: targetDeptId,
                            sharerId: currentUser?.id,
                            recipientId: null,
                            status: constants.DOCUMENT_SHARES_STATUS.STASHED,
                        });
                    }
                } else if (actionKey === 'unstash') {
                    if (isTargetFolder && targetDeptId) {
                        await updateShareStatusRecursive(targetItem.id, targetDeptId, constants.DOCUMENT_SHARES_STATUS.APPROVED);
                    } else if (directShare) {
                        await unstashShare(directShare.id);
                    } else if (!isTargetFolder && targetDeptId) {
                        await useDocumentStore.getState().insertDocumentShare({
                            documentId: targetItem.id,
                            departmentId: targetDeptId,
                            sharerId: currentUser?.id,
                            recipientId: null,
                            status: constants.DOCUMENT_SHARES_STATUS.APPROVED,
                        });
                    }
                } else if (actionKey === 'unreject') {
                    if (isTargetFolder && targetDeptId) {
                        await updateShareStatusRecursive(targetItem.id, targetDeptId, constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL);
                    } else if (directShare) {
                        await unrejectShare(directShare.id);
                    } else if (!isTargetFolder && targetDeptId) {
                        await useDocumentStore.getState().insertDocumentShare({
                            documentId: targetItem.id,
                            departmentId: targetDeptId,
                            sharerId: currentUser?.id,
                            recipientId: null,
                            status: constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL,
                        });
                    }
                } else if (actionKey === 'unpublish') {
                    if (isTargetFolder && targetDeptId) {
                        await updateShareStatusRecursive(targetItem.id, targetDeptId, constants.DOCUMENT_SHARES_STATUS.APPROVED);
                    } else if (directShare) {
                        await unpublishShare(directShare.id);
                    }
                } else if (actionKey === 'unshare') {
                    await unshareItemFromAllDepartments(targetItem);
                }
            };

        // OFFICER SIGNATURE STAMPING & QUEUE FLOW
        if (actionKey === 'approve' && constants.isOfficerRole(currentUser?.role)) {
            const filesToApprove = (Array.isArray(item) ? item : [item]).filter((i) => !i.isFolder);
            const freshShares = useDocumentStore.getState().documentShares || [];

            const filesToStamp = filesToApprove.filter((f) => {
                const isPdf = isPdfFileItem(f, documentVersions);
                const isMandatory = Boolean(
                    f.requiresSignature ||
                    (documentService?.getLocalRequiresSignature && documentService.getLocalRequiresSignature(f.id)) ||
                    f.share?.requiresSignature ||
                    (freshShares || []).find((s) => cleanId(s.document?.id ?? s.documentId) === cleanId(f.id))?.requiresSignature
                );
                return isPdf && (isMandatory || stampSignatureMap[f.id]);
            });

            const filesDirectApprove = filesToApprove.filter((f) => !filesToStamp.some((s) => s.id === f.id));

            // 1. Immediately approve files with stamp OFF
            for (const singleItem of filesDirectApprove) {
                let sRecord = singleItem.share;
                if (!sRecord) {
                    sRecord = freshShares.find((s) => cleanId(s.document?.id ?? s.documentId) === cleanId(singleItem.id));
                }
                const sId = sRecord?.id;
                const dId = sRecord?.department?.id ?? sRecord?.departmentId ?? currentUser?.departmentId;
                if (sId) {
                    await approveShare(sId);
                }
            }

            // 2. If files to stamp exist, build queue and open modal
            if (filesToStamp.length > 0) {
                const queueTasks = await Promise.all(filesToStamp.map(async (file) => {
                    const fileClean = cleanId(file.id);
                    let sRecord = file.share;
                    if (!sRecord) {
                        if (userDeptClean) {
                            sRecord = freshShares.find(
                                (s) => cleanId(s.document?.id ?? s.documentId) === fileClean && cleanId(s.department?.id ?? s.departmentId) === userDeptClean
                            );
                        } else {
                            sRecord = freshShares.find((s) => cleanId(s.document?.id ?? s.documentId) === fileClean);
                        }
                    }
                    let vers = (useDocumentStore.getState().documentVersions || []).filter((v) => cleanId(v.document?.id ?? v.documentId) === fileClean);
                    if (vers.length === 0 && file.id) {
                        try {
                            const fetched = await useDocumentStore.getState().fetchDocumentVersions(file.id);
                            if (Array.isArray(fetched) && fetched.length > 0) {
                                vers = fetched;
                            }
                        } catch {
                            // ignore
                        }
                    }
                    const activeVer = [...vers].sort((a, b) => (b.version || 0) - (a.version || 0))[0];
                    const isMandatory = Boolean(
                        file.requiresSignature ||
                        (documentService?.getLocalRequiresSignature && documentService.getLocalRequiresSignature(file.id)) ||
                        file.share?.requiresSignature ||
                        sRecord?.requiresSignature
                    );
                    return {
                        item: file,
                        shareRecord: sRecord,
                        shareId: sRecord?.id,
                        deptId: sRecord?.department?.id ?? sRecord?.departmentId ?? currentUser?.departmentId,
                        activeVersion: activeVer,
                        effectiveIsMandatorySign: isMandatory,
                    };
                }));

                setConfirmActionModal(null);
                setIsSubmittingAction(false);
                setOfficerStampModalQueue(queueTasks);
                setIsOfficerStampModalOpen(true);
                return;
            }

            // If everything direct approved
            setConfirmActionModal(null);
            setIsSubmittingAction(false);
            showToast({
                type: 'success',
                title: 'Documents Approved',
                description: `Approved ${filesDirectApprove.length} document${filesDirectApprove.length === 1 ? '' : 's'} directly.`,
            });
            if (currentUser) {
                await syncAllDocumentShares(currentUser, departments, true).catch(() => {});
            }
            return;
        }

            if (Array.isArray(item)) {
                let successCount = 0;
                for (const singleItem of item) {
                    if (actionKey === 'unshare') {
                        try {
                            await unshareItemFromAllDepartments(singleItem);
                            successCount++;
                        } catch (singleErr) {
                            console.error(`Failed unshare for ${singleItem.name || singleItem.title}:`, singleErr);
                        }
                        continue;
                    }

                    let sRecord = singleItem.share;
                    if (!sRecord) {
                        if (userDeptClean) {
                            sRecord = (documentShares || []).find((s) => {
                                const sDocId = cleanId(s.document?.id ?? s.documentId);
                                const sDeptId = cleanId(s.department?.id ?? s.departmentId);
                                const isBase = !s.recipientId && !s.recipient?.id;
                                return sDocId === cleanId(singleItem.id) && sDeptId === userDeptClean && isBase;
                            }) || (documentShares || []).find((s) => {
                                const sDocId = cleanId(s.document?.id ?? s.documentId);
                                const sDeptId = cleanId(s.department?.id ?? s.departmentId);
                                return sDocId === cleanId(singleItem.id) && sDeptId === userDeptClean;
                            });
                        } else {
                            sRecord = (documentShares || []).find((s) => {
                                const sDocId = cleanId(s.document?.id ?? s.documentId);
                                const isBase = !s.recipientId && !s.recipient?.id;
                                return sDocId === cleanId(singleItem.id) && isBase;
                            }) || (documentShares || []).find((s) => cleanId(s.document?.id ?? s.documentId) === cleanId(singleItem.id));
                        }
                    }
                    const sId = sRecord?.id;
                    const dId = sRecord?.department?.id ?? sRecord?.departmentId ?? currentUser?.departmentId;
                    try {
                        await executeSingle(singleItem, sId, dId);
                        successCount++;
                    } catch (singleErr) {
                        console.error(`Failed ${actionKey} for ${singleItem.name || singleItem.title}:`, singleErr);
                    }
                }
                const processedIds = new Set(item.map((i) => i.id));
                const remaining = (selectedItems || []).filter((it) => !processedIds.has(it.id));
                onSelectMultiple?.(remaining);
                if (remaining.length === 1) setSelectedDocument(remaining[0]);
                else if (remaining.length === 0) setSelectedDocument(null);

                showToast({
                    type: 'success',
                    title: 'Batch Action Completed',
                    description: actionKey === 'unshare'
                        ? `Unshared ${successCount} of ${item.length} files from all active departments.`
                        : `Processed ${successCount} of ${item.length} files.`,
                });
            } else {
                if (actionKey === 'unshare') {
                    await unshareItemFromAllDepartments(item);
                } else {
                    await executeSingle(item, shareId, deptId);
                }
                if (selectedItems && selectedItems.length > 0) {
                    const remaining = selectedItems.filter((it) => it.id !== item.id);
                    onSelectMultiple?.(remaining);
                    if (remaining.length === 1) setSelectedDocument(remaining[0]);
                    else if (remaining.length === 0) setSelectedDocument(null);
                }
                const titleMap = {
                    approve: item.isFolder ? 'Folder Approved' : 'Document Approved',
                    unapprove: 'Approval Revoked',
                    stash: item.isFolder ? 'Folder Stashed' : 'Document Stashed',
                    unstash: item.isFolder ? 'Folder Unstashed' : 'Document Unstashed',
                    unreject: item.isFolder ? 'Folder Restored' : 'Document Restored',
                    unpublish: item.isFolder ? 'Folder Unpublished' : 'Document Unpublished',
                    unshare: item.isFolder ? 'Folder Unshared' : 'Document Unshared',
                };
                const descMap = {
                    approve: `Approved "${docTitle}" for department director review.`,
                    unapprove: `Reverted "${docTitle}" to pending approval.`,
                    stash: `Stashed "${docTitle}" at upper management level.`,
                    unstash: `Restored "${docTitle}" to approved state.`,
                    unreject: `Restored "${docTitle}" to pending approval.`,
                    unpublish: `Unpublished "${docTitle}" and returned it to approved status.`,
                    unshare: `Removed all departmental shares for "${docTitle}".`,
                };
                showToast({
                    type: actionKey === 'unapprove' || actionKey === 'stash' || actionKey === 'unpublish' ? 'information' : 'success',
                    title: titleMap[actionKey] || 'Action Completed',
                    description: descMap[actionKey] || `Completed ${actionKey} for "${docTitle}".`,
                });
            }
            for (const singleItem of (Array.isArray(item) ? item : [item])) {
                await useDocumentStore.getState().fetchDocumentShares(singleItem.id).catch(() => {});
                markItemAsSeen(singleItem);
            }
            if (currentUser) {
                await syncAllDocumentShares(currentUser, departments, true).catch(() => {});
            }
            setConfirmActionModal(null);
        } catch (err) {
            console.error(`Failed to execute ${actionKey}:`, err);
            showToast({
                type: 'error',
                title: 'Action Failed',
                description: err?.message || `Could not complete ${actionKey}.`,
            });
        } finally {
            setIsSubmittingAction(false);
        }
    };

    const handleConfirmRejection = async () => {
        if (!rejectionActionModal) return;
        const { item, shareId, deptId, docTitle } = rejectionActionModal;
        const reason = rejectionReasonText.trim();
        if (!reason) {
            showToast({
                type: 'warning',
                title: 'Rejection Reason Required',
                description: 'Please specify a reason for rejecting this document.',
            });
            return;
        }
        setIsSubmittingAction(true);
        try {
            const cleanId = (uid) => (typeof uid === 'string' ? uid.replace(/-/g, '').toLowerCase() : uid);
            const userDeptClean = cleanId(currentUser?.departmentId);

            const executeSingleRejection = async (singleItem, singleDeptId) => {
                const freshShares = useDocumentStore.getState().documentShares || [];
                const targetDocClean = cleanId(singleItem.id);
                const targetDeptClean = cleanId(singleDeptId || currentUser?.departmentId);

                if (singleItem.isFolder && singleDeptId) {
                    await updateShareStatusRecursive(singleItem.id, singleDeptId, constants.DOCUMENT_SHARES_STATUS.REJECTED);
                    return;
                }

                // Check direct share on the file
                const directShare = freshShares.find((s) => {
                    const sDocClean = cleanId(s.document?.id ?? s.documentId);
                    const sDeptClean = cleanId(s.department?.id ?? s.departmentId);
                    const isBase = !s.recipientId && !s.recipient?.id;
                    return sDocClean === targetDocClean && sDeptClean === targetDeptClean && isBase;
                }) || freshShares.find((s) => {
                    const sDocClean = cleanId(s.document?.id ?? s.documentId);
                    const sDeptClean = cleanId(s.department?.id ?? s.departmentId);
                    return sDocClean === targetDocClean && sDeptClean === targetDeptClean;
                });

                if (directShare) {
                    await rejectShare(directShare.id, reason, currentUser?.id);
                } else if (singleDeptId) {
                    // Create independent share record for this rejected file
                    await useDocumentStore.getState().insertDocumentShare({
                        documentId: singleItem.id,
                        departmentId: singleDeptId,
                        sharerId: currentUser?.id,
                        recipientId: null,
                        status: constants.DOCUMENT_SHARES_STATUS.REJECTED,
                        rejectionReason: reason,
                        rejecterId: currentUser?.id,
                    });
                    const docVers = (useDocumentStore.getState().documentVersions || []).filter(
                        (v) => (v.document?.id ?? v.documentId) === singleItem.id
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
            };

            if (Array.isArray(item)) {
                let successCount = 0;
                for (const singleItem of item) {
                    const dId = singleItem.share?.department?.id ?? singleItem.share?.departmentId ?? currentUser?.departmentId;
                    try {
                        await executeSingleRejection(singleItem, dId);
                        successCount++;
                    } catch (singleErr) {
                        console.error(`Failed reject for ${singleItem.name || singleItem.title}:`, singleErr);
                    }
                }
                const processedIds = new Set(item.map((i) => i.id));
                const remaining = (selectedItems || []).filter((it) => !processedIds.has(it.id));
                onSelectMultiple?.(remaining);
                if (remaining.length === 1) setSelectedDocument(remaining[0]);
                else if (remaining.length === 0) setSelectedDocument(null);

                showToast({
                    type: 'warning',
                    title: 'Files Rejected',
                    description: `Rejected ${successCount} of ${item.length} files.`,
                });
            } else {
                await executeSingleRejection(item, deptId);
                if (selectedItems && selectedItems.length > 0) {
                    const remaining = selectedItems.filter((it) => it.id !== item.id);
                    onSelectMultiple?.(remaining);
                    if (remaining.length === 1) setSelectedDocument(remaining[0]);
                    else if (remaining.length === 0) setSelectedDocument(null);
                }
                showToast({
                    type: 'warning',
                    title: item.isFolder ? 'Folder Rejected' : 'Document Rejected',
                    description: `Rejected "${docTitle}". The item remains in your repository as Rejected.`,
                });
            }
            for (const singleItem of (Array.isArray(item) ? item : [item])) {
                await useDocumentStore.getState().fetchDocumentShares(singleItem.id).catch(() => {});
            }
            if (currentUser) {
                await syncAllDocumentShares(currentUser, departments, true).catch(() => {});
            }
            setRejectionActionModal(null);
            setRejectionReasonText('');
        } catch (err) {
            console.error('Failed to reject share:', err);
            showToast({
                type: 'error',
                title: 'Rejection Failed',
                description: err?.message || 'Could not reject document.',
            });
        } finally {
            setIsSubmittingAction(false);
        }
    };

    const handleItemAction = async (actionKey, item) => {
        if (!item) {
            return;
        }

        if (actionKey === 'open' || actionKey === 'open_folder') {
            handleItemDoubleClick(item);
            return;
        }

        if (actionKey === 'share' || actionKey === 're_share') {
            const root = !Array.isArray(item) ? findRootSharedFolder(item, documents, documentShares) : null;
            setShareModalDocument(root || item);
            return;
        }

        if (actionKey === 'publish' || actionKey === 're_publish') {
            // Officers and Directors publish individual files directly
            setPublishModalDocument(item);
            return;
        }

        if (['approve', 'unapprove', 'reject', 'unreject', 'unpublish', 'stash', 'unstash', 'unshare'].includes(actionKey)) {
            const isBatch = Array.isArray(item);
            const cleanId = (uid) => (typeof uid === 'string' ? uid.replace(/-/g, '').toLowerCase() : uid);

            if (isBatch) {
                const count = item.length;
                if (actionKey === 'reject') {
                    setRejectionReasonText('');
                    setRejectionActionModal({
                        item,
                        count,
                        docTitle: `${count} files`,
                    });
                    return;
                }


                if (actionKey === 'approve' && constants.isOfficerRole(currentUser?.role)) {
                    const filesToApprove = (item ? (Array.isArray(item) ? item : [item]) : []).filter((i) => !i.isFolder);
                    const initMap = {};
                    filesToApprove.forEach((f) => {
                        const isPdf = isPdfFileItem(f, documentVersions);
                        const isMandatory = Boolean(
                            f.requiresSignature ||
                            (documentService?.getLocalRequiresSignature && documentService.getLocalRequiresSignature(f.id)) ||
                            f.share?.requiresSignature ||
                            (documentShares || []).find((s) => cleanId(s.document?.id ?? s.documentId) === cleanId(f.id))?.requiresSignature
                        );
                        initMap[f.id] = isPdf ? (isMandatory ? true : true) : false;
                    });
                    setStampSignatureMap(initMap);
                }

                const config = getActionConfirmationConfig(actionKey, item, count);
                setConfirmActionModal({
                    actionKey,
                    item,
                    count,
                    docTitle: `${count} files`,
                    title: config.title,
                    message: config.message,
                    primaryLabel: config.primaryLabel,
                    variant: config.variant,
                    icon: config.icon,
                    impact: config.impact,
                });
                return;
            }

            if (actionKey === 'unshare') {
                const cleanId = (uid) => (typeof uid === 'string' ? uid.replace(/-/g, '').toLowerCase() : uid);
                const freshShares = useDocumentStore.getState().documentShares || [];
                const allDocs = useDocumentStore.getState().documents || [];
                const itemClean = cleanId(item.id);
                const descendantIds = item.isFolder ? getRecursiveDescendantDocIds(item.id, allDocs) : [];
                const targetIds = new Set([itemClean, ...descendantIds.map(cleanId)]);

                const hasShares = freshShares.some((s) => targetIds.has(cleanId(s.document?.id ?? s.documentId))) ||
                    Boolean(item.share?.id || item.departmentId || item.department || item.shares?.length > 0 || item.status === 'SHARED' || item.isShared);

                if (!hasShares) {
                    showToast({
                        type: 'error',
                        title: 'Action Failed',
                        description: 'No associated departmental share found for this document.',
                    });
                    return;
                }

                const docTitle = item.title || item.name || (item.isFolder ? 'Folder' : 'Document');
                const config = getActionConfirmationConfig('unshare', item, 1);
                setConfirmActionModal({
                    actionKey: 'unshare',
                    item,
                    docTitle,
                    title: config.title,
                    message: config.message,
                    primaryLabel: config.primaryLabel,
                    variant: config.variant,
                    icon: config.icon,
                    impact: config.impact,
                });
                return;
            }

            let shareRecord = item.share;
            if (!shareRecord) {
                if (currentUser?.departmentId) {
                    const uDeptClean = cleanId(currentUser.departmentId);
                    const iClean = cleanId(item.id);
                    shareRecord = (documentShares || []).find(
                        (s) =>
                            cleanId(s.document?.id ?? s.documentId) === iClean &&
                            cleanId(s.department?.id ?? s.departmentId) === uDeptClean &&
                            !s.recipientId && !s.recipient?.id
                    ) || (documentShares || []).find(
                        (s) =>
                            cleanId(s.document?.id ?? s.documentId) === iClean &&
                            cleanId(s.department?.id ?? s.departmentId) === uDeptClean
                    );
                } else {
                    const iClean = cleanId(item.id);
                    shareRecord = (documentShares || []).find(
                        (s) =>
                            cleanId(s.document?.id ?? s.documentId) === iClean &&
                            !s.recipientId && !s.recipient?.id
                    ) || (documentShares || []).find((s) => cleanId(s.document?.id ?? s.documentId) === iClean);
                }
            }

            const shareId = shareRecord?.id;
            if (!shareId) {
                showToast({
                    type: 'error',
                    title: 'Action Failed',
                    description: 'No associated departmental share found for this document.',
                });
                return;
            }

            const docTitle = item.title || item.name || 'document';
            const deptId = shareRecord?.department?.id ?? shareRecord?.departmentId ?? currentUser?.departmentId;

            if (actionKey === 'approve') {
                const currentStatus = String(shareRecord?.status ?? item?.status ?? '').toUpperCase();
                if (currentStatus === constants.DOCUMENT_SHARES_STATUS.REJECTED) {
                    showToast({
                        type: 'error',
                        title: 'Action Prohibited',
                        description: 'You cannot directly approve a rejected document. Please unreject it first.',
                    });
                    return;
                }
            }

            if (['approve', 'unapprove', 'stash', 'unstash', 'unreject', 'unpublish'].includes(actionKey)) {
                if (actionKey === 'approve' && constants.isOfficerRole(currentUser?.role)) {
                    const filesToApprove = (item ? (Array.isArray(item) ? item : [item]) : []).filter((i) => !i.isFolder);
                    const initMap = {};
                    filesToApprove.forEach((f) => {
                        const isPdf = isPdfFileItem(f, documentVersions);
                        const isMandatory = Boolean(
                            f.requiresSignature ||
                            (documentService?.getLocalRequiresSignature && documentService.getLocalRequiresSignature(f.id)) ||
                            f.share?.requiresSignature ||
                            (documentShares || []).find((s) => cleanId(s.document?.id ?? s.documentId) === cleanId(f.id))?.requiresSignature
                        );
                        initMap[f.id] = isPdf ? (isMandatory ? true : true) : false;
                    });
                    setStampSignatureMap(initMap);
                }

                const config = getActionConfirmationConfig(actionKey, item, 1);
                setConfirmActionModal({
                    actionKey,
                    item,
                    shareId,
                    deptId,
                    docTitle,
                    title: config.title,
                    message: config.message,
                    primaryLabel: config.primaryLabel,
                    variant: config.variant,
                    icon: config.icon,
                    impact: config.impact,
                });
                return;
            }

            if (actionKey === 'reject') {
                const currentStatus = String(shareRecord?.status ?? item?.status ?? '').toUpperCase();
                if (currentStatus === constants.DOCUMENT_SHARES_STATUS.APPROVED) {
                    showToast({
                        type: 'error',
                        title: 'Action Prohibited',
                        description: 'You cannot directly reject an approved document. Please revoke approval (unapprove) first.',
                    });
                    return;
                }
                setRejectionReasonText('');
                setRejectionActionModal({
                    item,
                    shareId,
                    deptId,
                    docTitle,
                });
                return;
            }

            try {
                const freshShares = useDocumentStore.getState().documentShares || [];
                const itemDocClean = cleanId(item.id);
                const targetDeptClean = cleanId(deptId || currentUser?.departmentId);
                const directShare = freshShares.find((s) => {
                    const sDocClean = cleanId(s.document?.id ?? s.documentId);
                    const sDeptClean = cleanId(s.department?.id ?? s.departmentId);
                    const isBase = !s.recipientId && !s.recipient?.id;
                    return sDocClean === itemDocClean && sDeptClean === targetDeptClean && isBase;
                }) || freshShares.find((s) => {
                    const sDocClean = cleanId(s.document?.id ?? s.documentId);
                    const sDeptClean = cleanId(s.department?.id ?? s.departmentId);
                    return sDocClean === itemDocClean && sDeptClean === targetDeptClean;
                });

                if (actionKey === 'publish') {
                    if (item.isFolder && deptId) {
                        await updateShareStatusRecursive(item.id, deptId, constants.DOCUMENT_SHARES_STATUS.PUBLISHED);
                    } else if (directShare) {
                        await publishShare(directShare.id);
                    } else if (deptId) {
                        await useDocumentStore.getState().insertDocumentShare({
                            documentId: item.id,
                            departmentId: deptId,
                            sharerId: currentUser?.id,
                            recipientId: null,
                            status: constants.DOCUMENT_SHARES_STATUS.PUBLISHED,
                        });
                    }
                    showToast({
                        type: 'success',
                        title: item.isFolder ? 'Folder Published' : 'Document Published',
                        description: `Published "${docTitle}" to all department members.`,
                    });
                } else if (actionKey === 'unpublish') {
                    if (item.isFolder && deptId) {
                        await updateShareStatusRecursive(item.id, deptId, constants.DOCUMENT_SHARES_STATUS.APPROVED);
                    } else if (directShare) {
                        await unpublishShare(directShare.id);
                    }
                    showToast({
                        type: 'information',
                        title: item.isFolder ? 'Folder Unpublished' : 'Document Unpublished',
                        description: `Unpublished "${docTitle}" from department members.`,
                    });
                } else if (actionKey === 'unshare') {
                    await unshareItemFromAllDepartments(item);
                    if (selectedItems && selectedItems.length > 0) {
                        const remaining = selectedItems.filter((it) => it.id !== item.id);
                        onSelectMultiple?.(remaining);
                        if (remaining.length === 1) setSelectedDocument(remaining[0]);
                        else if (remaining.length === 0) setSelectedDocument(null);
                    }
                    showToast({
                        type: 'success',
                        title: item.isFolder ? 'Folder Unshared' : 'Document Unshared',
                        description: `Removed all departmental shares for "${docTitle}".`,
                    });
                }
                if (currentUser) {
                    syncAllDocumentShares(currentUser, departments).catch(() => {});
                }
            } catch (err) {
                console.error(`Failed to execute ${actionKey}:`, err);
                showToast({
                    type: 'error',
                    title: 'Action Failed',
                    description: err?.message || `Could not complete ${actionKey}.`,
                });
            }
            return;
        }

        if (actionKey === 'select_root_folder') {
            const itemWithTab = { ...item, _targetTab: 'shares' };
            setSelectedDocument(itemWithTab);
            onSelectDocument?.(itemWithTab);
            return;
        }

        if (actionKey === 'view_share') {
            const root = isStaff ? findRootSharedFolder(item, documents, documentShares) : null;
            const targetDoc = root || item;
            const itemWithTab = { ...targetDoc, _targetTab: 'shares' };
            setSelectedDocument(itemWithTab);
            onSelectDocument?.(itemWithTab);
            return;
        }

        if (['view_information', 'view_content', 'view_version'].includes(actionKey)) {
            const tabMap = {
                view_information: 'information',
                view_content: 'contents',
                view_version: 'versions',
            };
            const targetTab = tabMap[actionKey] || 'information';
            const itemWithTab = { ...item, _targetTab: targetTab };
            setSelectedDocument(itemWithTab);
            onSelectDocument?.(itemWithTab);
            return;
        }

        if (actionKey === 'edit') {
            setEditItem(item);
            let rawName = stripFileExtension(item.name || item.title || '');
            let rawExtension = '.pdf';
            if (!item.isFolder) {
                const vers = (documentVersions || []).filter(
                    (v) => (v.document?.id ?? v.documentId) === item.id
                );
                const latestVer = vers.length > 0
                    ? [...vers].sort((a, b) => b.version - a.version)[0]
                    : null;
                const effectiveMime = latestVer?.mimeType || item.mimeType;
                if (effectiveMime) {
                    rawExtension = getExtensionFromMimeType(effectiveMime);
                } else {
                    const originalRaw = item.name || item.title || '';
                    const lastDot = originalRaw.lastIndexOf('.');
                    if (lastDot > 0) {
                        rawExtension = originalRaw.slice(lastDot).toLowerCase();
                    }
                }
            }
            setEditFormName(rawName);
            setEditFormExtension(rawExtension);
            setEditFormComment(item.comment || item.description || '');

            if (!item.isFolder) {
                const vers = (documentVersions || []).filter(
                    (v) => (v.document?.id ?? v.documentId) === item.id
                );
                const latestVer = vers.length > 0
                    ? [...vers].sort((a, b) => b.version - a.version)[0]
                    : null;
                setEditFormSummary(latestVer?.summary || item.summary || item.description || '');
                setEditFormClassification(latestVer?.classification || item.classification || constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED);
            } else {
                setEditFormSummary('');
                setEditFormClassification(constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED);
            }

            setEditFormErrors({});
            setIsEditModalOpen(true);
            return;
        }

        if (actionKey === 'download') {
            const itemsToDownload = Array.isArray(item) ? item : [item];
            if (itemsToDownload.length > 1) {
                showToast({
                    type: 'information',
                    title: 'Batch Download Started',
                    description: `Packaging ${itemsToDownload.length} items into ZIP archive...`,
                });
                try {
                    const zipName = await storageService.downloadMultipleAsZip(
                        itemsToDownload,
                        documents,
                        documentVersions
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

            for (const downloadTarget of itemsToDownload) {
                const fileName = downloadTarget.name || downloadTarget.title || 'document';
                try {
                    if (downloadTarget.isFolder) {
                        await storageService.downloadFolder(
                            downloadTarget,
                            documents,
                            documentVersions
                        );
                        const childFiles = (documents || []).filter(
                            (d) => !d.isFolder && (d.parentId === downloadTarget.id || d.parentFolderId === downloadTarget.id)
                        );
                        childFiles.forEach((file) => {
                            systemEventService.recordDocumentRead({
                                document: file,
                                user: currentUser,
                            }).catch(() => {});
                        });
                    } else {
                        const vers = (documentVersions || []).filter(
                            (v) => (v.document?.id ?? v.documentId) === downloadTarget.id
                        );
                        const latestVer = vers.length > 0
                            ? [...vers].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0]
                            : null;
                        const path = latestVer?.path || downloadTarget.path || downloadTarget.url || downloadTarget.downloadUrl;
                        await storageService.downloadDocument(path, fileName);
                        if (currentUser?.id) {
                            systemEventService.recordDocumentRead({
                                document: downloadTarget,
                                user: currentUser,
                                version: latestVer?.version,
                            }).catch(() => {});
                        }
                    }
                } catch (err) {
                    showToast({
                        type: 'error',
                        title: 'Download Failed',
                        description: err?.message || 'Could not download file.',
                    });
                }
            }
            return;
        }

        if (actionKey === 'approve') {
            const targetItems = Array.isArray(item) ? item : [item];
            const targetIds = new Set(targetItems.map((i) => i.id));
            setLocalCreatedItems((previousItems) =>
                previousItems.map((repositoryItem) => {
                    if (!targetIds.has(repositoryItem.id)) {
                        return repositoryItem;
                    }
                    return {
                        ...repositoryItem,
                        status: constants.DOCUMENT_SHARES_STATUS.APPROVED,
                    };
                })
            );
            showToast({
                type: 'success',
                title: targetItems.length > 1 ? 'Documents Approved' : 'Document Approved',
                description: targetItems.length > 1 ? `${targetItems.length} items approved for distribution.` : `"${targetItems[0].title || targetItems[0].name}" has been approved for distribution.`,
            });
            return;
        }

        if (actionKey === 'comment') {
            setSelectedDocument(item);
            onSelectDocument?.(item);
            return;
        }

        if (actionKey === 'archive') {
            setArchivingItem(item);
            return;
        }

        if (actionKey === 'restore') {
            setRestoringItem(item);
            return;
        }

        if (actionKey === 'delete') {
            setDeletingItem(item);
            return;
        }
    };

    // LISTEN FOR EXTERNAL DOCUMENT ACTION TRIGGERS (E.G. FROM INSPECTOR QUICK ACTION)
    useEffect(() => {
        const handleDocumentActionEvent = (event) => {
            const { actionKey, item } = event.detail || {};
            if (actionKey && item) {
                handleItemAction(actionKey, item);
            }
        };
        window.addEventListener('pamantasan:document-action', handleDocumentActionEvent);
        return () => {
            window.removeEventListener('pamantasan:document-action', handleDocumentActionEvent);
        };
    }, []);

    const performRestoreItem = async (item) => {
        try {
            if (isCoordinator) {
                const restorePayload = {
                    documentId: item.id,
                    documentTitle: item.title || item.name,
                    isArchived: false,
                    isFolder: Boolean(item.isFolder),
                };

                const requesterId = currentUser?.id ?? useAuthStore.getState().currentUser?.id;
                await coordinatorApprovalService.submitCoordinatorRequest({
                    action: constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_UNARCHIVE,
                    requesterId,
                    data: restorePayload,
                });
                useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});

                showToast({
                    type: 'success',
                    title: 'Request Submitted',
                    description: `Restore request for "${item.title || item.name}" sent for Administrator approval.`,
                });
                return;
            }

            await useDocumentStore.getState().archiveDocument(item.id, false);
            setLocalCreatedItems((previousItems) =>
                previousItems.map((repositoryItem) => {
                    if (repositoryItem.id !== item.id) {
                        return repositoryItem;
                    }
                    return {
                        ...repositoryItem,
                        isArchived: false,
                    };
                })
            );
            if (selectedDocument?.id === item.id) {
                const updated = {
                    ...selectedDocument,
                    isArchived: false,
                };
                setSelectedDocument(updated);
                onSelectDocument?.(updated);
            }
            showToast({
                type: 'success',
                title: item.isFolder ? 'Folder Restored' : 'Document Restored',
                description: `"${item.title || item.name}" restored to active repository.`,
            });
        } catch (err) {
            showToast({
                type: 'error',
                title: 'Restore Failed',
                description: err?.message || 'Could not restore item.',
                rawError: err?.stack || String(err),
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
            await useDocumentStore.getState().archiveDocument(item.id, false);

            setLocalCreatedItems((previousItems) =>
                previousItems.map((repItem) => {
                    const inChain = chain.some((f) => f.id === repItem.id);
                    if (repItem.id === item.id || inChain) {
                        return { ...repItem, isArchived: false };
                    }
                    return repItem;
                })
            );

            if (selectedDocument?.id === item.id) {
                const updated = { ...selectedDocument, isArchived: false };
                setSelectedDocument(updated);
                onSelectDocument?.(updated);
            }

            showToast({
                type: 'success',
                title: 'Items Restored',
                description: `"${parentFolder.name || parentFolder.title}" and "${item.title || item.name}" restored to active repository.`,
            });
        } catch (err) {
            showToast({
                type: 'error',
                title: 'Restore Failed',
                description: err?.message || 'Could not restore items.',
                rawError: err?.stack || String(err),
            });
        }
    };

    const handleConfirmArchiveItem = async () => {
        const itemsToArchive = Array.isArray(archivingItem) ? archivingItem : (archivingItem?.id ? [archivingItem] : []);
        if (itemsToArchive.length === 0) {
            return;
        }
        setIsArchivingItem(true);
        try {
            if (isCoordinator) {
                const requesterId = currentUser?.id ?? useAuthStore.getState().currentUser?.id;
                for (const item of itemsToArchive) {
                    const archivePayload = {
                        documentId: item.id,
                        documentTitle: item.title || item.name,
                        isArchived: true,
                        isFolder: Boolean(item.isFolder),
                    };

                    await coordinatorApprovalService.submitCoordinatorRequest({
                        action: constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_ARCHIVE,
                        requesterId,
                        data: archivePayload,
                    });
                }
                useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});

                showToast({
                    type: 'success',
                    title: 'Request Submitted',
                    description: `Archive request for ${itemsToArchive.length} item(s) sent for Administrator approval.`,
                });
                setArchivingItem(null);
                return;
            }

            const archiveIds = new Set(itemsToArchive.map((i) => i.id));
            for (const item of itemsToArchive) {
                await useDocumentStore.getState().archiveDocument(item.id, true);
            }
            setLocalCreatedItems((previousItems) =>
                previousItems.map((repositoryItem) => {
                    if (!archiveIds.has(repositoryItem.id)) {
                        return repositoryItem;
                    }
                    return {
                        ...repositoryItem,
                        isArchived: true,
                        directlyArchived: true,
                    };
                })
            );
            const remaining = (selectedItems || []).filter((it) => !archiveIds.has(it.id));
            onSelectMultiple?.(remaining);
            if (remaining.length === 1) {
                setSelectedDocument(remaining[0]);
                onSelectDocument?.(remaining[0]);
            } else {
                setSelectedDocument(null);
                onSelectDocument?.(null);
            }
            showToast({
                type: 'success',
                title: itemsToArchive.length > 1 ? 'Documents Archived' : (itemsToArchive[0].isFolder ? 'Folder Archived' : 'Document Archived'),
                description: itemsToArchive.length > 1 ? `${itemsToArchive.length} items moved to archives.` : `"${itemsToArchive[0].title || itemsToArchive[0].name}" moved to archives.`,
            });
            setArchivingItem(null);
        } catch (error) {
            showToast({
                type: 'error',
                title: 'Archive Failed',
                description: error?.message || 'Could not archive item.',
                rawError: error?.stack || String(error),
            });
        } finally {
            setIsArchivingItem(false);
        }
    };

    const handleConfirmRestoreItem = async () => {
        if (!restoringItem) return;
        const itemsToRestore = Array.isArray(restoringItem) ? restoringItem : [restoringItem];
        if (itemsToRestore.length === 0) return;

        const allDocs = useDocumentStore.getState().documents || [];

        // CHILD RESTORE GUARD: If any target item's parent folder is currently archived, block and prompt
        for (const singleItem of itemsToRestore) {
            const targetParentId = singleItem.parentId && singleItem.parentId !== 'root' ? singleItem.parentId : null;
            const parentDoc = targetParentId ? allDocs.find((d) => d.id === targetParentId) : null;
            if (parentDoc && parentDoc.isArchived) {
                setRestoreConflictModalItem({ item: singleItem, parentFolder: parentDoc });
                setRestoringItem(null);
                return;
            }
        }

        setIsRestoringItem(true);
        try {
            for (const singleItem of itemsToRestore) {
                await performRestoreItem(singleItem);
            }

            const restoredIds = new Set(itemsToRestore.map((it) => it.id));
            const remaining = (selectedItems || []).filter((it) => !restoredIds.has(it.id));
            onSelectMultiple?.(remaining);
            if (remaining.length === 1) {
                setSelectedDocument(remaining[0]);
                onSelectDocument?.(remaining[0]);
            } else if (remaining.length === 0) {
                setSelectedDocument(null);
                onSelectDocument?.(null);
            }

            setRestoringItem(null);
        } catch (error) {
            console.error('Failed to restore items:', error);
            showToast({
                type: 'error',
                title: 'Restore Failed',
                description: error?.message || 'Could not restore items.',
            });
        } finally {
            setIsRestoringItem(false);
        }
    };

    const handleConfirmDeleteItem = async () => {
        const itemsToDelete = Array.isArray(deletingItem) ? deletingItem : (deletingItem?.id ? [deletingItem] : []);
        if (itemsToDelete.length === 0) {
            return;
        }
        setIsDeletingItemLoading(true);
        try {
            if (isCoordinator) {
                const requesterId = currentUser?.id ?? useAuthStore.getState().currentUser?.id;
                for (const item of itemsToDelete) {
                    const deletePayload = {
                        documentId: item.id,
                        documentTitle: item.title || item.name,
                        isFolder: Boolean(item.isFolder),
                    };

                    await coordinatorApprovalService.submitCoordinatorRequest({
                        action: constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_DELETE,
                        requesterId,
                        data: deletePayload,
                    });
                }
                useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});

                showToast({
                    type: 'success',
                    title: 'Request Submitted',
                    description: `Delete request for ${itemsToDelete.length} item(s) sent for Administrator approval.`,
                });
                setDeletingItem(null);
                return;
            }

            const deleteIds = new Set(itemsToDelete.map((i) => i.id));
            for (const item of itemsToDelete) {
                await useDocumentStore.getState().deleteDocument(item.id);
            }
            setLocalCreatedItems((previousItems) =>
                previousItems.filter((repositoryItem) => !deleteIds.has(repositoryItem.id))
            );
            const remaining = (selectedItems || []).filter((it) => !deleteIds.has(it.id));
            onSelectMultiple?.(remaining);
            if (remaining.length === 1) {
                setSelectedDocument(remaining[0]);
                onSelectDocument?.(remaining[0]);
            } else {
                setSelectedDocument(null);
                onSelectDocument?.(null);
            }
            showToast({
                type: 'success',
                title: itemsToDelete.length > 1 ? 'Documents Deleted' : (itemsToDelete[0].isFolder ? 'Folder Deleted' : 'Document Deleted'),
                description: itemsToDelete.length > 1 ? `${itemsToDelete.length} items deleted from repository.` : `"${itemsToDelete[0].title || itemsToDelete[0].name}" deleted from repository.`,
            });
            setDeletingItem(null);
        } catch (error) {
            showToast({
                type: 'error',
                title: 'Delete Failed',
                description: error?.message || 'Could not delete item.',
                rawError: error?.stack || String(error),
            });
        } finally {
            setIsDeletingItemLoading(false);
        }
    };

    // DIRECTORY-AWARE PAYLOAD COMMITTER (REAL FIREBASE STORAGE & POSTGRESQL SYNC)
    const handleCommitDroppedPayload = async (extractedItems, destinationFolderId, destinationLabel) => {
        const validItems = extractedItems.filter((item) => item.action !== 'ignore');
        if (validItems.length === 0) {
            return;
        }

        const summaryTitle = validItems.length === 1
            ? `Uploading ${validItems[0].fileName || validItems[0].title}`
            : `Uploading ${validItems.length} files to ${destinationLabel}`;

        const processingItems = validItems.map((item) => ({
            id: item.id,
            name: item.relativePath || item.fileName || item.title,
            progress: 10,
            isFinished: false,
            statusText: 'Preparing upload...',
        }));

        const toastProcess = showProcessing({
            title: summaryTitle,
            items: processingItems,
            completionTitle: null,
            completionDescription: null,
        });

        const activeUserId = currentUser?.id;
        const rootTargetId = destinationFolderId === 'root' ? null : destinationFolderId;

        // 1. COLLECT ALL UNIQUE ANCESTOR DIRECTORY PATHS ACROSS ALL DROPPED ITEMS
        const directoryPrefixSet = new Set();
        validItems.forEach((item) => {
            if (item.folderPathParts && item.folderPathParts.length > 0) {
                let acc = '';
                item.folderPathParts.forEach((part) => {
                    acc = acc ? `${acc}/${part}` : part;
                    directoryPrefixSet.add(acc);
                });
            }
        });

        // 2. SORT UNIQUE DIRECTORIES BY DEPTH (SHALLOWEST FIRST)
        const sortedDirectoryPaths = Array.from(directoryPrefixSet).sort((a, b) => {
            const depthA = a.split('/').length;
            const depthB = b.split('/').length;
            return depthA - depthB;
        });

        // 3. SEQUENTIALLY RESOLVE OR CREATE ALL DIRECTORIES IN DATABASE (ZERO RACE CONDITIONS)
        const folderPathToIdMap = new Map();
        const knownDocs = [...documents];

        for (const dirPath of sortedDirectoryPaths) {
            const parts = dirPath.split('/');
            const folderName = parts[parts.length - 1];
            const parentPath = parts.length > 1 ? parts.slice(0, -1).join('/') : null;
            const parentFolderId = parentPath ? folderPathToIdMap.get(parentPath) : rootTargetId;

            let existingFolder = knownDocs.find(
                (d) => d.isFolder && (d.parentId ?? null) === parentFolderId && !d.isArchived && d.name.toLowerCase() === folderName.toLowerCase()
            );

            if (existingFolder) {
                folderPathToIdMap.set(dirPath, existingFolder.id);
            } else if (activeUserId) {
                try {
                    const createdFolder = await documentService.insertDocument({
                        name: folderName,
                        isFolder: true,
                        isArchived: false,
                        parentId: parentFolderId,
                        comment: null,
                    });
                    folderPathToIdMap.set(dirPath, createdFolder.id);
                    knownDocs.push(createdFolder);
                    await useDocumentStore.getState().inheritSharesFromRoot(createdFolder);
                    useAuditStore.getState().insertAuditLog({
                        actorId: activeUserId,
                        entityType: constants.AUDIT_LOGS_ENTITY_TYPE.DOCUMENT,
                        entityId: String(createdFolder.id),
                        action: constants.AUDIT_LOGS_ACTION.CREATED,
                        data: JSON.stringify({
                            title: folderName,
                            isFolder: true,
                            parentId: parentFolderId,
                            location: currentDirectoryLabel,
                        }),
                        createdAt: new Date().toISOString(),
                    }).catch(() => {});
                } catch (folderErr) {
                    console.error(`Failed to create directory "${folderName}":`, folderErr);
                }
            }
        }

        const CONCURRENCY_LIMIT = 2;
        let itemIndex = 0;

        const processItem = async (item) => {
            try {
                // If item is an empty folder, its directory was already created above
                if (item.isFolder) {
                    toastProcess.updateItem(item.id, {
                        progress: 100,
                        isFinished: true,
                        statusText: 'Folder created',
                    });
                    return;
                }

                // OCR PRE-PROCESSING IF CONVERTING IMAGE TO SEARCHABLE PDF
                let ocrSummary = null;
                if (item.isImage && item.ocrMode === 'ocr_pdf') {
                    toastProcess.updateItem(item.id, {
                        progress: 15,
                        statusText: 'Running Cloud OCR text recognition...',
                    });

                    try {
                        // If enhanced in Scanner Studio, honor user's filter (do not auto-whiten if 'original')
                        const shouldWhiten = item.isScannerEnhanced ? (item.scannerFilter !== 'original') : true;
                        const ocrResult = await ocrService.convertImageToPdf(item.file, {
                            customTitle: item.fileName || item.title,
                            autoWhiten: shouldWhiten,
                        });

                        if (ocrResult.extractedText) {
                            ocrSummary = aiService.generateContentDrivenSummary(ocrResult.extractedText, item.fileName) || aiService.formatExecutiveSummary(ocrResult.extractedText.slice(0, 2000));
                        }

                        item = {
                            ...item,
                            file: ocrResult.pdfFile,
                            fileName: ocrResult.pdfFileName,
                            title: ocrResult.pdfFileName,
                            size: formatFileSize(ocrResult.sizeBytes),
                            sizeBytes: ocrResult.sizeBytes,
                            mimeType: 'application/pdf',
                            summary: ocrSummary,
                        };

                        toastProcess.updateItem(item.id, {
                            progress: 25,
                            statusText: `OCR extracted ${ocrResult.linesCount} lines. Resolving location...`,
                        });
                    } catch (ocrErr) {
                        console.warn('OCR processing failed, uploading as normal image:', ocrErr);
                        toastProcess.updateItem(item.id, {
                            progress: 25,
                            statusText: 'OCR failed. Uploading as normal image...',
                        });
                        showToast({
                            type: 'warning',
                            title: 'OCR Processing Failed',
                            description: `Could not process OCR for "${item.fileName}". File will be uploaded as normal image. (${ocrErr?.message || 'Error'})`,
                        });
                    }
                } else {
                    toastProcess.updateItem(item.id, {
                        progress: 15,
                        statusText: 'Resolving folder location...',
                    });
                }

                // 1. Resolve exact target parent folder ID from precomputed map
                let targetParentId = rootTargetId;
                if (item.folderPathParts && item.folderPathParts.length > 0) {
                    const itemDirPath = item.folderPathParts.join('/');
                    targetParentId = folderPathToIdMap.get(itemDirPath) ?? rootTargetId;
                }

                const finalFileName = item.fileName || item.file?.name || (item.title ? item.title.split('/').pop() : 'document');
                let cleanDocName = stripFileExtension(finalFileName) || finalFileName;

                // 2. Check if creating new version or new document
                let targetDocumentId = item.action === 'create_new' ? null : item.existingDocumentId;

                if (!targetDocumentId && activeUserId && item.action !== 'create_new') {
                    const existingDoc = knownDocs.find(
                        (d) => !d.isFolder && (d.parentId ?? null) === targetParentId && !d.isArchived && (
                            d.name.toLowerCase() === cleanDocName.toLowerCase() ||
                            d.name.toLowerCase() === finalFileName.toLowerCase()
                        )
                    );
                    if (existingDoc) {
                        targetDocumentId = existingDoc.id;
                    }
                }

                // Extract client text snippet for text-based formats, DOCX, and images (via Google Vision OCR)
                let textContentSnippet = null;
                if (!ocrSummary && item.file) {
                    const isImg = ocrService.isImageFile(item.file);
                    if (isImg) {
                        toastProcess.updateItem(item.id, {
                            progress: 20,
                            statusText: 'Extracting text from image via Google Vision OCR...',
                        });
                    }
                    try {
                        textContentSnippet = await aiService.extractDocumentText(item.file, finalFileName);
                    } catch (txtErr) {
                        console.warn('[DocumentsPage] Text extraction failed:', txtErr);
                    }
                }
                const activeExtractedText = ocrSummary || textContentSnippet || item.summary || null;

                // AUTO-DERIVE TITLE: If the filename was generic (camera photo hash like 8311655..., 1234, etc.),
                // promote the institutional reference or subject from OCR text as the document title.
                if (isGenericFileName(cleanDocName) && activeExtractedText) {
                    const derivedTitle = deriveTitleFromDocumentText(activeExtractedText);
                    if (derivedTitle) {
                        cleanDocName = derivedTitle;
                        // Re-check existing documents with the derived title if no targetDocumentId was bound
                        if (!targetDocumentId && activeUserId && item.action !== 'create_new') {
                            const existingWithDerived = knownDocs.find(
                                (d) => !d.isFolder && (d.parentId ?? null) === targetParentId && !d.isArchived &&
                                    d.name.toLowerCase() === cleanDocName.toLowerCase()
                            );
                            if (existingWithDerived) {
                                targetDocumentId = existingWithDerived.id;
                            }
                        }
                    }
                }

                if (targetDocumentId) {
                    // VERSIONING: Existing document found, increment version
                    const docVersions = (documentVersions || []).filter(
                        (v) => (v.document?.id ?? v.documentId) === targetDocumentId
                    );
                    const nextVersionNum = item.nextVersion || (docVersions.length > 0 ? Math.max(...docVersions.map((v) => v.version || 1)) + 1 : 2);
                    const latestPriorVer = docVersions.length > 0
                        ? [...docVersions].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0]
                        : null;

                    toastProcess.updateItem(item.id, {
                        progress: 35,
                        statusText: `Uploading version ${nextVersionNum}.0 to Firebase Storage...`,
                    });

                    const storageResult = await storageService.uploadDocument(
                        targetDocumentId,
                        item.file,
                        nextVersionNum,
                        finalFileName
                    );

                    toastProcess.updateItem(item.id, {
                        progress: 65,
                        statusText: `AI analyzing document & version differences...`,
                    });

                    // Call Vertex AI for version diffing, OCR/summary, and embeddings
                    let aiResult = null;
                    try {
                        let fileBase64 = null;
                        if (item.file && item.file.size <= 15 * 1024 * 1024) {
                            fileBase64 = await fileToBase64(item.file).catch(() => null);
                        }

                        aiResult = await aiService.analyzeDocumentFile({
                            storagePath: storageResult.path,
                            downloadUrl: storageResult.downloadUrl || null,
                            fileBase64,
                            mimeType: storageResult.mimeType || item.file.type || getMimeTypeFromFilename(finalFileName),
                            fileName: finalFileName,
                            fileSize: storageResult.sizeBytes || item.file.size || 0,
                            isVersionUpdate: true,
                            previousStoragePath: latestPriorVer?.path || null,
                            previousMimeType: latestPriorVer?.mimeType || null,
                            previousSummary: latestPriorVer?.summary || null,
                            previousClassification: latestPriorVer?.classification || null,
                            previousText: latestPriorVer?.summary || null,
                            nextVersion: nextVersionNum,
                            extractedText: activeExtractedText,
                        });
                    } catch (aiErr) {
                        console.warn('AI analysis error on version update:', aiErr);
                    }

                    toastProcess.updateItem(item.id, {
                        progress: 85,
                        statusText: `Saving version ${nextVersionNum}.0 and embeddings in database...`,
                    });

                    if (activeUserId) {
                        const finalClassification = (item.classification && item.classification !== constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED)
                            ? item.classification
                            : (aiResult?.classification || constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED);

                        await documentService.insertDocumentVersion({
                            documentId: targetDocumentId,
                            uploaderId: activeUserId,
                            version: nextVersionNum,
                            path: storageResult.path,
                            sizeBytes: storageResult.sizeBytes,
                            mimeType: storageResult.mimeType || item.file.type || getMimeTypeFromFilename(finalFileName),
                            classification: finalClassification,
                            changeSummary: aiResult?.changeSummary || `Version ${nextVersionNum}.0 update`,
                            summary: aiService.formatExecutiveSummary(aiResult?.summary || (activeExtractedText ? aiService.generateContentDrivenSummary(activeExtractedText, finalFileName) : null)),
                            embedding: aiResult?.embedding || null,
                        });

                        await documentService.updateDocument(targetDocumentId, {
                            updatedAt: new Date().toISOString(),
                        }).catch(() => null);

                        useAuditStore.getState().insertAuditLog({
                            actorId: activeUserId,
                            entityType: constants.AUDIT_LOGS_ENTITY_TYPE.DOCUMENT,
                            entityId: String(targetDocumentId),
                            action: constants.AUDIT_LOGS_ACTION.UPDATED,
                            data: JSON.stringify({
                                title: cleanDocName,
                                version: nextVersionNum,
                                isVersionUpdate: true,
                                isFolder: false,
                                location: currentDirectoryLabel,
                            }),
                            createdAt: new Date().toISOString(),
                        }).catch(() => {});
                    }
                } else {
                    // NEW DOCUMENT: Insert document row first, then upload, then insert version row
                    toastProcess.updateItem(item.id, {
                        progress: 25,
                        statusText: 'Creating document in database...',
                    });

                    let createdDoc = null;
                    if (activeUserId) {
                        createdDoc = await documentService.insertDocument({
                            name: cleanDocName,
                            isFolder: false,
                            isArchived: false,
                            parentId: targetParentId,
                            comment: null,
                        });
                        targetDocumentId = createdDoc.id;
                        knownDocs.push(createdDoc);
                    } else {
                        targetDocumentId = item.id;
                    }

                    toastProcess.updateItem(item.id, {
                        progress: 45,
                        statusText: 'Uploading file to Firebase Storage...',
                    });

                    let storageResult;
                    try {
                        storageResult = await storageService.uploadDocument(
                            targetDocumentId,
                            item.file,
                            1,
                            finalFileName
                        );
                    } catch (uploadErr) {
                        if (createdDoc?.id) {
                            await documentService.deleteDocument(createdDoc.id).catch(() => null);
                        }
                        throw uploadErr;
                    }

                    toastProcess.updateItem(item.id, {
                        progress: 70,
                        statusText: 'AI reading & analyzing document...',
                    });

                    // Call Vertex AI for multimodal analysis, OCR, classification, and embeddings
                    let aiResult = null;
                    try {
                        let fileBase64 = null;
                        if (item.file && item.file.size <= 15 * 1024 * 1024) {
                            fileBase64 = await fileToBase64(item.file).catch(() => null);
                        }

                        aiResult = await aiService.analyzeDocumentFile({
                            storagePath: storageResult.path,
                            downloadUrl: storageResult.downloadUrl || null,
                            fileBase64,
                            mimeType: storageResult.mimeType || item.file.type || getMimeTypeFromFilename(finalFileName),
                            fileName: finalFileName,
                            fileSize: storageResult.sizeBytes || item.file.size || 0,
                            isVersionUpdate: false,
                            extractedText: activeExtractedText,
                        });
                    } catch (aiErr) {
                        console.warn('AI analysis error on initial upload:', aiErr);
                    }

                    toastProcess.updateItem(item.id, {
                        progress: 90,
                        statusText: 'Saving version record & embeddings in database...',
                    });

                    if (activeUserId) {
                        const finalClassification = (item.classification && item.classification !== constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED)
                            ? item.classification
                            : (aiResult?.classification || constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED);

                        try {
                            await documentService.insertDocumentVersion({
                                documentId: targetDocumentId,
                                uploaderId: activeUserId,
                                version: 1,
                                path: storageResult.path,
                                sizeBytes: storageResult.sizeBytes,
                                mimeType: storageResult.mimeType || item.file.type || getMimeTypeFromFilename(finalFileName),
                                classification: finalClassification,
                                changeSummary: aiResult?.changeSummary || 'Initial file upload',
                                summary: aiService.formatExecutiveSummary(aiResult?.summary || (activeExtractedText ? aiService.generateContentDrivenSummary(activeExtractedText, finalFileName) : null)),
                                embedding: aiResult?.embedding || null,
                            });

                            useAuditStore.getState().insertAuditLog({
                                actorId: activeUserId,
                                entityType: constants.AUDIT_LOGS_ENTITY_TYPE.DOCUMENT,
                                entityId: String(targetDocumentId),
                                action: constants.AUDIT_LOGS_ACTION.UPLOADED,
                                data: JSON.stringify({
                                    title: cleanDocName,
                                    version: 1,
                                    isVersionUpdate: false,
                                    isFolder: false,
                                    location: currentDirectoryLabel,
                                }),
                                createdAt: new Date().toISOString(),
                            }).catch(() => {});

                            if (createdDoc?.id) {
                                await useDocumentStore.getState().inheritSharesFromRoot(createdDoc);
                            }
                        } catch (verErr) {
                            await storageService.deleteDocument(storageResult.path).catch(() => null);
                            if (createdDoc?.id) {
                                await documentService.deleteDocument(createdDoc.id).catch(() => null);
                            }
                            throw verErr;
                        }
                    }
                }

                toastProcess.updateItem(item.id, {
                    progress: 100,
                    isFinished: true,
                    statusText: 'Stored in Firebase',
                });
            } catch (err) {
                console.error(`Error uploading ${item.fileName || item.title}:`, err);
                toastProcess.updateItem(item.id, {
                    progress: 100,
                    isFinished: true,
                    statusText: 'Upload error',
                });
            }
        };

        const worker = async () => {
            while (itemIndex < validItems.length) {
                const currentIdx = itemIndex++;
                await processItem(validItems[currentIdx]);
            }
        };

        const workers = Array.from(
            { length: Math.min(CONCURRENCY_LIMIT, validItems.length) },
            () => worker()
        );
        await Promise.all(workers);

        await fetchDocuments(null, true).catch(() => {});
        if (currentUser) {
            await syncAllDocumentShares(currentUser, departments, true).catch(() => {});
        }
        toastProcess.complete();

        // Auto-select the newly uploaded primary document
        if (validItems.length > 0) {
            const primaryItem = validItems[0];
            const latestDocs = useDocumentStore.getState().documents || [];
            const primaryName = primaryItem?.fileName || primaryItem?.title || primaryItem?.name;
            const matchedUploadedDoc = latestDocs.find(
                (d) => (primaryItem?.existingDocumentId && d.id === primaryItem.existingDocumentId) ||
                       (primaryName && (d.name === primaryName || d.title === primaryName))
            );
            if (matchedUploadedDoc) {
                setSelectedDocument(matchedUploadedDoc);
                onSelectDocument?.(matchedUploadedDoc);
            }
        }

        // DISPATCH NOTIFICATIONS TO RMO STAFF
        if (activeUserId && validItems.length > 0) {
            const fileItems = validItems.filter((i) => !i.isFolder);
            const folderCount = sortedDirectoryPaths.length;
            const primaryItem = validItems[0];
            const primaryId = primaryItem?.existingDocumentId || (knownDocs.find((d) => d.name === (primaryItem?.fileName || primaryItem?.title))?.id) || rootTargetId;

            if (validItems.length === 1 && fileItems.length === 1) {
                const singleName = fileItems[0].fileName || fileItems[0].title || 'Document';
                systemEventService.recordSystemEvent({
                    actorId: activeUserId,
                    entityType: constants.AUDIT_LOGS_ENTITY_TYPE.DOCUMENT,
                    entityId: String(primaryId || 'doc-upload'),
                    action: primaryItem?.action === 'create_new' || !primaryItem?.existingDocumentId
                        ? constants.AUDIT_LOGS_ACTION.UPLOADED
                        : constants.AUDIT_LOGS_ACTION.UPDATED,
                    data: {
                        title: `Document Uploaded: ${singleName}`,
                        description: `Document "${singleName}" was uploaded to ${currentDirectoryLabel}.`,
                        fileName: singleName,
                        location: currentDirectoryLabel,
                    },
                    targetRoles: ['RMO_STAFF'],
                    isMajor: false,
                }).catch(() => {});
            } else {
                const rootDirName = sortedDirectoryPaths.length > 0 ? sortedDirectoryPaths[0].split('/')[0] : null;
                const summaryTitle = rootDirName
                    ? `Folder Upload: ${rootDirName} (${fileItems.length} file${fileItems.length === 1 ? '' : 's'})`
                    : `Batch Upload: ${fileItems.length} documents`;
                const summaryDesc = `Uploaded ${fileItems.length} file${fileItems.length === 1 ? '' : 's'}${folderCount > 0 ? ` across ${folderCount} folder${folderCount === 1 ? '' : 's'}` : ''} to ${currentDirectoryLabel}.`;

                systemEventService.recordSystemEvent({
                    actorId: activeUserId,
                    entityType: constants.AUDIT_LOGS_ENTITY_TYPE.DOCUMENT,
                    entityId: String(primaryId || 'batch-upload'),
                    action: constants.AUDIT_LOGS_ACTION.UPLOADED,
                    data: {
                        title: summaryTitle,
                        description: summaryDesc,
                        fileCount: fileItems.length,
                        folderCount: folderCount,
                        location: currentDirectoryLabel,
                    },
                    targetRoles: ['RMO_STAFF'],
                    isMajor: false,
                }).catch(() => {});
            }
        }
    };

    // MODAL DROPZONE DRAG & DROP HANDLERS
    const handleDropzoneDragOver = (dragEvent) => {
        dragEvent.preventDefault();
        dragEvent.stopPropagation();
        setIsDropzoneDragActive(true);
        setIsPageDragActive(false);
    };

    const handleDropzoneDragLeave = (dragEvent) => {
        dragEvent.preventDefault();
        dragEvent.stopPropagation();
        setIsDropzoneDragActive(false);
    };

    const handleDropzoneDrop = async (dropEvent) => {
        dropEvent.preventDefault();
        dropEvent.stopPropagation();
        setIsDropzoneDragActive(false);
        setIsPageDragActive(false);

        const extracted = await processDataTransferPayload(
            dropEvent.dataTransfer,
            currentFolderId,
            userDepartment
        );

        if (extracted.length > 0) {
            const annotated = annotateDuplicates(extracted, currentFolderId, documents, documentVersions);
            setStagedDroppedItems((prev) => [...prev, ...annotated]);
            if (fileError) {
                setFileError('');
            }
        }
    };

    const handleFileInputChange = (event) => {
        const selectedFiles = Array.from(event.target.files ?? []);

        if (selectedFiles.length === 0) {
            return;
        }

        const fallbackExtractedItems = selectedFiles.map((file) => {
            const isImage = ocrService.isImageFile(file);
            const pathParts = file.webkitRelativePath ? file.webkitRelativePath.split('/').filter(Boolean) : [];
            const folderPathParts = pathParts.length > 1 ? pathParts.slice(0, -1) : [];
            const relativePath = file.webkitRelativePath ? `/${file.webkitRelativePath}` : `/${file.name}`;
            return {
                id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                parentId: currentFolderId,
                relativePath: relativePath,
                fileName: file.name,
                folderPathParts: folderPathParts,
                title: relativePath,
                subtitle: `DOC-${new Date().getFullYear()}-GEN-${Math.floor(100 + Math.random() * 900)}`,
                description: null,
                category: isImage ? 'Image' : 'Document',
                classification: constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED,
                version: 'v1.0',
                size: formatFileSize(file.size),
                sizeBytes: file.size,
                status: constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL,
                date: 'Just now',
                isFolder: false,
                file: file,
                isImage: isImage,
                ocrMode: isImage ? 'ocr_pdf' : 'normal_image',
                tags: [constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL, constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED],
            };
        });

        const annotated = annotateDuplicates(fallbackExtractedItems, currentFolderId, documents, documentVersions);
        setStagedDroppedItems((previousItems) => [...previousItems, ...annotated]);
        setFileError('');
        if (event.target) {
            event.target.value = '';
        }
    };

    // HANDLER: IMAGE CAPTURED FROM MOBILE PHONE CAMERA
    const handleMobileImageReceived = (file) => {
        const newStagedItem = {
            id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            parentId: currentFolderId,
            relativePath: `/${file.name}`,
            fileName: file.name,
            folderPathParts: [],
            title: `/${file.name}`,
            subtitle: `DOC-${new Date().getFullYear()}-SCAN-${Math.floor(100 + Math.random() * 900)}`,
            description: 'Captured via smartphone camera',
            category: 'Image',
            classification: constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED,
            version: 'v1.0',
            size: formatFileSize(file.size),
            sizeBytes: file.size,
            status: constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL,
            date: 'Just now',
            isFolder: false,
            file: file,
            isImage: true,
            isMobileCaptured: true,
            ocrMode: 'ocr_pdf',
            tags: [constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL, constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED],
        };

        const annotated = annotateDuplicates([newStagedItem], currentFolderId, documents, documentVersions);
        setStagedDroppedItems((previousItems) => [...previousItems, ...annotated]);
        setFileError('');

        showToast({
            type: 'success',
            title: 'Mobile Scan Received',
            description: `Photo "${file.name}" received from phone and queued for Cloud OCR conversion!`,
        });
    };

    const handleToggleOcrMode = (stagedId, mode) => {
        setStagedDroppedItems((prev) =>
            prev.map((item) =>
                item.id === stagedId ? { ...item, ocrMode: mode } : item
            )
        );
    };

    const handleSetAllImagesOcrMode = (mode) => {
        setStagedDroppedItems((prev) =>
            prev.map((item) =>
                item.isImage ? { ...item, ocrMode: mode } : item
            )
        );
    };

    const handleSetStagedItemClassification = (stagedId, classification) => {
        setStagedDroppedItems((prev) =>
            prev.map((item) =>
                item.id === stagedId ? { ...item, classification } : item
            )
        );
    };

    const handleSetAllStagedClassification = (classification) => {
        setStagedDroppedItems((prev) =>
            prev.map((item) => ({ ...item, classification }))
        );
    };

    const handleOpenScanner = (item) => {
        setScannerItem(item);
    };

    const handleApplyScannerResults = ({ enhancedFile, enhancedBlob, filterMode }) => {
        if (!scannerItem) return;

        setStagedDroppedItems((prev) =>
            prev.map((item) => {
                if (item.id === scannerItem.id) {
                    const previewUrl = URL.createObjectURL(enhancedBlob);
                    return {
                        ...item,
                        file: enhancedFile,
                        previewUrl,
                        isScannerEnhanced: true,
                        scannerFilter: filterMode,
                        size: formatFileSize(enhancedFile.size),
                        sizeBytes: enhancedFile.size,
                    };
                }
                return item;
            })
        );

        showToast({
            type: 'success',
            title: 'Document Enhanced',
            description: `Adjustments and paper whitening applied to "${scannerItem.fileName || scannerItem.title}".`,
        });
        setScannerItem(null);
    };

    const handleRemoveStagedItem = (stagedId) => {
        setStagedDroppedItems((previousItems) =>
            previousItems.filter((item) => item.id !== stagedId)
        );
    };

    const handleClearAllStagedItems = () => {
        setStagedDroppedItems([]);
    };

    // PAGE-LEVEL DRAG & DROP HANDLERS (DROP DIRECTLY ONTO REPOSITORY EXPLORER)
    const handlePageDragOver = (dragEvent) => {
        if (!canUpload || isCreateModalOpen) {
            return;
        }
        dragEvent.preventDefault();
        setIsPageDragActive(true);
    };

    const handlePageDragLeave = (dragEvent) => {
        if (dragEvent.currentTarget.contains(dragEvent.relatedTarget)) {
            return;
        }
        setIsPageDragActive(false);
    };

    const handlePageDrop = async (dropEvent) => {
        if (!canUpload || isCreateModalOpen) {
            return;
        }
        dropEvent.preventDefault();
        setIsPageDragActive(false);

        const extracted = await processDataTransferPayload(
            dropEvent.dataTransfer,
            currentFolderId,
            userDepartment
        );

        if (extracted.length > 0) {
            const annotated = annotateDuplicates(extracted, currentFolderId, documents, documentVersions);
            setStagedDroppedItems(annotated);
            setCreationMode('file');
            setFileError('');
            setIsCreateModalOpen(true);
        }
    };

    // SUBMIT HANDLERS FOR MODAL
    const handleCreateFolderSubmit = async () => {
        const trimmedFolderTitle = folderTitle.trim();

        if (!trimmedFolderTitle) {
            setFolderError('Folder name is required.');
            return;
        }

        const activeUserId = currentUser?.id;
        const targetParentId = currentFolderId === 'root' ? null : currentFolderId;

        // Auto-suffix folder name if it already exists in the active directory (silent)
        const uniqueFolderName = getUniqueFolderName(trimmedFolderTitle, targetParentId, documents);

        setIsCreatingFolder(true);
        try {
            if (activeUserId) {
                const created = await documentService.insertDocument({
                    name: uniqueFolderName,
                    isFolder: true,
                    isArchived: false,
                    parentId: targetParentId,
                    comment: folderDescription.trim() || null,
                });
                if (created?.id) {
                    systemEventService.recordSystemEvent({
                        actorId: activeUserId,
                        entityType: constants.AUDIT_LOGS_ENTITY_TYPE.DOCUMENT,
                        entityId: String(created.id),
                        action: constants.AUDIT_LOGS_ACTION.CREATED,
                        data: {
                            name: uniqueFolderName,
                            title: `Folder Created: ${uniqueFolderName}`,
                            description: `Folder "${uniqueFolderName}" was created in ${currentDirectoryLabel}.`,
                            isFolder: true,
                            parentId: targetParentId,
                            location: currentDirectoryLabel,
                        },
                        targetRoles: ['RMO_STAFF'],
                        isMajor: false,
                    }).catch(() => {});
                }
                if (created?.id) {
                    await useDocumentStore.getState().inheritSharesFromRoot(created);
                }
                await fetchDocuments(null, true);
                if (currentUser) {
                    await syncAllDocumentShares(currentUser, departments, true).catch(() => {});
                }
                if (created?.id) {
                    const latestDocs = useDocumentStore.getState().documents || [];
                    const matchedFolder = latestDocs.find((d) => d.id === created.id) || created;
                    setSelectedDocument(matchedFolder);
                    onSelectDocument?.(matchedFolder);
                }
            } else {
                const newFolderItem = {
                    id: `folder-${Date.now()}`,
                    parentId: currentFolderId,
                    title: uniqueFolderName,
                    name: uniqueFolderName,
                    subtitle: `DIR-${new Date().getFullYear()}-${uniqueFolderName.slice(0, 3).toUpperCase()}`,
                    description: folderDescription.trim() || null,
                    summary: null,
                    comment: folderDescription.trim() || null,
                    category: 'Folder',
                    classification: null,
                    version: '—',
                    size: 'Folder',
                    status: 'Active',
                    date: 'Just now',
                    isFolder: true,
                    tags: ['Folder'],
                };
                setLocalCreatedItems((previousItems) => [newFolderItem, ...previousItems]);
                setSelectedDocument(newFolderItem);
                onSelectDocument?.(newFolderItem);
            }

            setIsCreateModalOpen(false);
            setFolderTitle('');
            setFolderDescription('');

            showToast({
                title: 'Folder Created',
                description: `Folder "${uniqueFolderName}" created in ${currentDirectoryLabel}.`,
                variant: 'success',
            });
        } catch (err) {
            setFolderError(err?.message || 'Failed to create folder.');
            showToast({
                title: 'Creation Failed',
                description: err?.message || 'Could not create folder in database.',
                variant: 'error',
                rawError: err?.stack || String(err),
            });
        } finally {
            setIsCreatingFolder(false);
        }
    };

    const handleUploadAnyway = (conflictItem) => {
        const uniqueFileName = getUniqueFileName(
            conflictItem.fileName,
            currentFolderId,
            documents,
            stagedDroppedItems,
            conflictItem.id
        );

        let newRelativePath = `/${uniqueFileName}`;
        if (conflictItem.folderPathParts && conflictItem.folderPathParts.length > 0) {
            newRelativePath = `/${conflictItem.folderPathParts.join('/')}/${uniqueFileName}`;
        }

        let newFile = conflictItem.file;
        if (conflictItem.file && typeof File !== 'undefined') {
            try {
                newFile = new File([conflictItem.file], uniqueFileName, {
                    type: conflictItem.file.type,
                    lastModified: conflictItem.file.lastModified,
                });
            } catch {
                newFile = conflictItem.file;
            }
        }

        setStagedDroppedItems((prev) =>
            prev.map((item) =>
                item.id === conflictItem.id
                    ? {
                          ...item,
                          fileName: uniqueFileName,
                          title: uniqueFileName,
                          relativePath: newRelativePath,
                          file: newFile,
                          action: 'create_new',
                          isDuplicate: false,
                          resolved: true,
                          existingDocumentId: null,
                      }
                    : item
            )
        );
        setConflictModalItem(null);
    };

    const handleUploadFileSubmit = () => {
        if (stagedDroppedItems.length === 0) {
            setFileError('Please select or drag files to upload.');
            return;
        }

        const unresolvedConflict = stagedDroppedItems.find(
            (item) => item.isDuplicate && !item.resolved
        );
        if (unresolvedConflict) {
            setConflictModalItem(unresolvedConflict);
            setFileError(`Please resolve duplicate file "${unresolvedConflict.fileName}" first.`);
            return;
        }

        handleCommitDroppedPayload(stagedDroppedItems, currentFolderId, currentDirectoryLabel);
        setIsCreateModalOpen(false);
        setStagedDroppedItems([]);
    };

    // AFFECTED ITEMS DIRECTORY TREE (FOLDER FIRST) FOR SHARE MODAL
    const affectedShareTree = useMemo(() => {
        if (!shareModalDocument) {
            return { roots: [], allPdfs: [], totalActive: 0, hasExcluded: false };
        }
        const rawDocs = Array.isArray(shareModalDocument) ? shareModalDocument : [shareModalDocument];
        const allDocs = documents || [];
        const allVers = documentVersions || [];

        const checkIsPdf = (item) => isPdfFileItem(item, allVers);

        // Recursively build tree for a folder
        const buildFolderSubtree = (folderItem, level = 0) => {
            if (!folderItem || excludedShareDocIds.has(folderItem.id)) return null;

            const descIds = getRecursiveDescendantDocIds(folderItem.id, allDocs);
            const childDocs = allDocs.filter(
                (c) => (c.parentId === folderItem.id || c.parentFolderId === folderItem.id) &&
                       !c.isArchived &&
                       !excludedShareDocIds.has(c.id)
            );

            const childFolders = childDocs
                .filter((d) => d.isFolder)
                .sort((a, b) => (a.name || a.title || '').localeCompare(b.name || b.title || ''));
            const childFiles = childDocs
                .filter((d) => !d.isFolder)
                .sort((a, b) => (a.name || a.title || '').localeCompare(b.name || b.title || ''));

            const childNodes = [];
            for (const cf of childFolders) {
                const sub = buildFolderSubtree(cf, level + 1);
                if (sub) childNodes.push(sub);
            }
            for (const cf of childFiles) {
                const isPdf = checkIsPdf(cf);
                childNodes.push({
                    id: cf.id,
                    doc: cf,
                    name: cf.name || cf.title || 'document',
                    isFolder: false,
                    isPdf,
                    level: level + 1,
                    allDescendantPdfIds: isPdf ? [cf.id] : [],
                    allDescendantDocIds: [cf.id],
                    children: [],
                });
            }

            const allDescendantPdfIds = [];
            const allDescendantDocIds = [folderItem.id, ...descIds];
            for (const cn of childNodes) {
                allDescendantPdfIds.push(...cn.allDescendantPdfIds);
            }

            return {
                id: folderItem.id,
                doc: folderItem,
                name: folderItem.name || folderItem.title || 'Folder',
                isFolder: true,
                isPdf: false,
                level,
                allDescendantPdfIds: [...new Set(allDescendantPdfIds)],
                allDescendantDocIds,
                children: childNodes,
            };
        };

        const rootNodes = [];
        const seenRootIds = new Set();
        const sortedRawFolders = rawDocs.filter((d) => d && d.isFolder && !excludedShareDocIds.has(d.id));
        const sortedRawFiles = rawDocs.filter((d) => d && !d.isFolder && !excludedShareDocIds.has(d.id));

        for (const rf of sortedRawFolders) {
            if (!seenRootIds.has(rf.id)) {
                seenRootIds.add(rf.id);
                const sub = buildFolderSubtree(rf, 0);
                if (sub) rootNodes.push(sub);
            }
        }
        for (const rf of sortedRawFiles) {
            if (!seenRootIds.has(rf.id)) {
                seenRootIds.add(rf.id);
                const isPdf = checkIsPdf(rf);
                rootNodes.push({
                    id: rf.id,
                    doc: rf,
                    name: rf.name || rf.title || 'document',
                    isFolder: false,
                    isPdf,
                    level: 0,
                    allDescendantPdfIds: isPdf ? [rf.id] : [],
                    allDescendantDocIds: [rf.id],
                    children: [],
                });
            }
        }

        const allPdfs = [];
        const collectPdfs = (nodes) => {
            nodes.forEach((n) => {
                if (!n.isFolder && n.isPdf) {
                    allPdfs.push(n.doc);
                }
                if (n.children && n.children.length > 0) {
                    collectPdfs(n.children);
                }
            });
        };
        collectPdfs(rootNodes);

        let totalActive = 0;
        const countActive = (nodes) => {
            nodes.forEach((n) => {
                totalActive++;
                if (n.children && n.children.length > 0) {
                    countActive(n.children);
                }
            });
        };
        countActive(rootNodes);

        return {
            roots: rootNodes,
            allPdfs,
            totalActive,
            hasExcluded: excludedShareDocIds.size > 0,
        };
    }, [shareModalDocument, documents, documentVersions, excludedShareDocIds]);

    const renderShareTreeNode = (node) => {
        const isExpanded = expandedShareFolderIds.has(node.id);
        const hasChildren = node.children && node.children.length > 0;
        const indentPx = node.level * 16;

        let isChecked = false;
        let isIndeterminate = false;
        let hasPdfToSign = false;

        if (node.isFolder) {
            const descendantPdfIds = node.allDescendantPdfIds;
            if (descendantPdfIds.length > 0) {
                hasPdfToSign = true;
                const checkedCount = descendantPdfIds.filter((id) => Boolean(shareRequiresSignatureMap[id])).length;
                isChecked = checkedCount === descendantPdfIds.length;
                isIndeterminate = checkedCount > 0 && checkedCount < descendantPdfIds.length;
            }
        } else if (node.isPdf) {
            hasPdfToSign = true;
            isChecked = Boolean(shareRequiresSignatureMap[node.id]);
        }

        const handleToggleSignature = (e) => {
            e.stopPropagation();
            if (node.isFolder) {
                const nextVal = !isChecked;
                const updates = {};
                node.allDescendantPdfIds.forEach((pid) => {
                    updates[pid] = nextVal;
                    documentService.setLocalRequiresSignature(pid, nextVal);
                });
                setShareRequiresSignatureMap((prev) => ({ ...prev, ...updates }));
            } else if (node.isPdf) {
                const nextVal = !isChecked;
                documentService.setLocalRequiresSignature(node.id, nextVal);
                setShareRequiresSignatureMap((prev) => ({ ...prev, [node.id]: nextVal }));
            }
        };

        const handleExclude = (e) => {
            e.stopPropagation();
            setExcludedShareDocIds((prev) => new Set([...prev, ...node.allDescendantDocIds]));
        };

        const toggleFolderExpand = (e) => {
            e.stopPropagation();
            setExpandedShareFolderIds((prev) => {
                const next = new Set(prev);
                if (next.has(node.id)) next.delete(node.id);
                else next.add(node.id);
                return next;
            });
        };

        return (
            <div key={node.id} className="flex flex-col">
                <div
                    className={`group flex items-center justify-between gap-1.5 py-1 px-1.5 rounded-lg text-xs hover:bg-surface-hover/80 transition-colors ${
                        node.isFolder ? 'font-medium' : ''
                    }`}
                    style={{ paddingLeft: `${indentPx + 6}px` }}
                >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {node.isFolder ? (
                            <button
                                type="button"
                                onClick={toggleFolderExpand}
                                className="p-0.5 hover:bg-surface-border/50 rounded text-text-muted hover:text-text shrink-0 cursor-pointer"
                                title={isExpanded ? 'Collapse folder' : 'Expand folder'}
                                aria-label={isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
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

                        {hasPdfToSign ? (
                            <button
                                type="button"
                                role="checkbox"
                                aria-checked={isIndeterminate ? 'mixed' : isChecked}
                                onClick={handleToggleSignature}
                                className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                                    isChecked
                                        ? 'bg-amber-500 border-amber-500 text-white shadow-2xs'
                                        : isIndeterminate
                                        ? 'bg-amber-500/30 border-amber-500 text-amber-300'
                                        : 'border-surface-border bg-surface hover:border-amber-500/70'
                                }`}
                                title={
                                    node.isFolder
                                        ? isChecked
                                            ? 'All child PDFs require official signature. Click to toggle OFF for all.'
                                            : 'Require official signature on all child PDFs. Click to toggle ON.'
                                        : isChecked
                                        ? 'Mandatory signature is ON for this PDF. Click to toggle OFF.'
                                        : 'Require official signature on this PDF. Click to toggle ON.'
                                }
                            >
                                {isChecked && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                                {isIndeterminate && <Minus className="h-2.5 w-2.5 stroke-[3]" />}
                            </button>
                        ) : (
                            <span className="w-3.5 shrink-0" />
                        )}

                        {node.isFolder ? (
                            isExpanded ? (
                                <FolderOpen className="h-3.5 w-3.5 text-accent shrink-0" />
                            ) : (
                                <Folder className="h-3.5 w-3.5 text-accent shrink-0" />
                            )
                        ) : (
                            <FileText className="h-3.5 w-3.5 text-text-muted shrink-0" />
                        )}

                        <span className="truncate text-text select-none text-[11px]" title={node.name}>
                            {node.name}
                        </span>

                        {node.isPdf && (
                            <span className="text-[9px] uppercase px-1 py-0.2 rounded font-mono font-semibold bg-surface-border text-text-muted shrink-0">
                                PDF
                            </span>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleExclude}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-text-muted hover:text-error hover:bg-error-background transition-opacity cursor-pointer shrink-0"
                        title={`Exclude "${node.name}"`}
                        aria-label={`Exclude ${node.name}`}
                    >
                        <Minus className="h-3.5 w-3.5" />
                    </button>
                </div>

                {node.isFolder && isExpanded && hasChildren && (
                    <div className="relative border-l border-surface-border/60 ml-4 pl-1 flex flex-col gap-0.5">
                        {node.children.map(renderShareTreeNode)}
                    </div>
                )}
            </div>
        );
    };

    // ACTIVE SHARES AND OPTIONS FOR SHARE MODAL
    const activeSharesForModalDoc = useMemo(() => {
        if (!shareModalDocument) return [];
        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
        const docs = Array.isArray(shareModalDocument) ? shareModalDocument : [shareModalDocument];
        const modalCleanIds = new Set(docs.map((d) => cleanId(d.id)).filter(Boolean));
        
        // Only include departmental shares (exclude member shares where recipientId or recipient is present)
        const deptShares = (documentShares || []).filter(
            (s) =>
                modalCleanIds.has(cleanId(s.document?.id ?? s.documentId)) &&
                !s.recipientId &&
                !s.recipient?.id &&
                !s.recipient
        );

        // Deduplicate by department ID so each department only appears once in the active shares list
        const seenDeptIds = new Set();
        const uniqueDeptShares = [];
        for (const share of deptShares) {
            const deptId = cleanId(share.department?.id ?? share.departmentId);
            if (deptId && !seenDeptIds.has(deptId)) {
                seenDeptIds.add(deptId);
                uniqueDeptShares.push(share);
            }
        }
        return uniqueDeptShares;
    }, [shareModalDocument, documentShares]);

    const availableDepartmentsToShare = useMemo(() => {
        if (!shareModalDocument) return [];
        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
        const docs = Array.isArray(shareModalDocument) ? shareModalDocument : [shareModalDocument];
        const sharedDeptIds = new Set();
        if (docs.length === 1) {
            activeSharesForModalDoc.forEach((s) => {
                const id = cleanId(s.department?.id ?? s.departmentId);
                if (id) sharedDeptIds.add(id);
            });
        } else if (docs.length > 1) {
            const firstDocDeptIds = new Set(
                (documentShares || [])
                    .filter(
                        (s) =>
                            cleanId(s.document?.id ?? s.documentId) === cleanId(docs[0].id) &&
                            !s.recipientId &&
                            !s.recipient?.id &&
                            !s.recipient
                    )
                    .map((s) => cleanId(s.department?.id ?? s.departmentId))
            );
            for (const deptId of firstDocDeptIds) {
                const isSharedInAll = docs.every((doc) =>
                    (documentShares || []).some(
                        (s) =>
                            cleanId(s.document?.id ?? s.documentId) === cleanId(doc.id) &&
                            cleanId(s.department?.id ?? s.departmentId) === deptId &&
                            !s.recipientId &&
                            !s.recipient?.id &&
                            !s.recipient
                    )
                );
                if (isSharedInAll) {
                    sharedDeptIds.add(deptId);
                }
            }
        }
        const rawUserDept = currentUser?.department;
        const userDeptClean = cleanId(currentUser?.departmentId || (typeof rawUserDept === 'object' ? rawUserDept?.id : null));
        const docDeptCleanIds = new Set(
            docs.map((d) => cleanId(d.departmentId || d.department?.id)).filter(Boolean)
        );
        const userDeptName = typeof rawUserDept === 'string' ? rawUserDept : (rawUserDept?.name || '');
        const userDeptNameLower = userDeptName.toLowerCase().trim();

        return (departments || []).filter((d) => {
            const dClean = cleanId(d.id);
            // 1. Exclude already shared departments
            if (sharedDeptIds.has(dClean)) return false;

            const name = (d.name || '').toLowerCase().trim();
            const code = (d.code || '').toLowerCase().trim();

            // 2. Exclude Records Management Office (RMO)
            if (name.includes('records management') || code === 'rmo') return false;

            // 3. Exclude user's own department and the document's own department
            if (userDeptClean && dClean === userDeptClean) return false;
            if (docDeptCleanIds.has(dClean)) return false;
            if (userDeptNameLower && name === userDeptNameLower) return false;

            return true;
        });
    }, [departments, activeSharesForModalDoc, shareModalDocument, currentUser, documentShares]);

    const filteredAvailableDepartments = useMemo(() => {
        if (!departmentSearchQuery.trim()) return availableDepartmentsToShare;
        const q = departmentSearchQuery.toLowerCase();
        return availableDepartmentsToShare.filter(
            (d) =>
                (d.name || '').toLowerCase().includes(q) ||
                (d.code || '').toLowerCase().includes(q)
        );
    }, [availableDepartmentsToShare, departmentSearchQuery]);

    const handleToggleDepartmentSelection = (deptId) => {
        setSelectedShareDepartmentIds((prev) =>
            prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
        );
    };

    const handleSelectAllDepartments = () => {
        if (selectedShareDepartmentIds.length === filteredAvailableDepartments.length) {
            setSelectedShareDepartmentIds([]);
        } else {
            setSelectedShareDepartmentIds(filteredAvailableDepartments.map((d) => d.id));
        }
    };

    const handleShareSubmit = async () => {
        if (!shareModalDocument || selectedShareDepartmentIds.length === 0) {
            showToast({
                type: 'warning',
                title: 'Select Department',
                description: 'Please select at least one department to share with.',
            });
            return;
        }

        setIsSharingDepartment(true);
        try {
            const rawDocs = Array.isArray(shareModalDocument) ? shareModalDocument : [shareModalDocument];
            const docs = rawDocs.filter((d) => !excludedShareDocIds.has(d.id));
            if (docs.length === 0) {
                showToast({
                    type: 'warning',
                    title: 'No Documents Selected',
                    description: 'All items have been excluded. Please restore at least one item.',
                });
                setIsSharingDepartment(false);
                return;
            }

            // Sync any updated requiresSignature preferences to local storage / memory
            for (const [docId, reqSig] of Object.entries(shareRequiresSignatureMap)) {
                documentService.setLocalRequiresSignature(docId, reqSig);
            }

            const targetCount = selectedShareDepartmentIds.length;
            const docCount = docs.length;
            const isSingle = docCount === 1;
            const firstDoc = docs[0];
            const docTitle = isSingle
                ? (firstDoc.title || firstDoc.name || 'document')
                : `${docCount} documents`;

            if (isCoordinator) {
                const requesterId = currentUser?.id ?? useAuthStore.getState().currentUser?.id;
                for (const doc of docs) {
                    const isFolder = Boolean(doc.isFolder);
                    const singleDocTitle = doc.title || doc.name || 'document';
                    const sharePayload = {
                        documentId: doc.id,
                        documentTitle: singleDocTitle,
                        departmentIds: selectedShareDepartmentIds,
                        isRecursive: isFolder,
                        requiresSignatureMap: shareRequiresSignatureMap,
                    };

                    await coordinatorApprovalService.submitCoordinatorRequest({
                        action: constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_SHARE,
                        requesterId,
                        data: sharePayload,
                    });
                }
                useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});

                showToast({
                    type: 'success',
                    title: 'Request Submitted',
                    description: isSingle
                        ? `Share request for "${docTitle}" sent for Administrator approval.`
                        : `Share requests for ${docCount} documents sent for Administrator approval.`,
                });

                setSelectedShareDepartmentIds([]);
                setDepartmentSearchQuery('');
                setShareModalDocument(null);
                if (isSingle) {
                    const latestDoc = useDocumentStore.getState().documents.find((d) => d.id === firstDoc.id) || firstDoc;
                    onSelectMultiple?.([latestDoc]);
                    setSelectedDocument(latestDoc);
                    onSelectDocument?.(latestDoc);
                } else {
                    const processedDocIds = new Set(docs.map((d) => d.id));
                    const remaining = (selectedItems || []).filter((it) => !processedDocIds.has(it.id));
                    onSelectMultiple?.(remaining);
                    if (remaining.length === 1) {
                        setSelectedDocument(remaining[0]);
                        onSelectDocument?.(remaining[0]);
                    } else if (remaining.length === 0) {
                        setSelectedDocument(null);
                        onSelectDocument?.(null);
                    }
                }
                return;
            }

            for (const doc of docs) {
                if (doc.isFolder) {
                    await shareDocumentRecursive(
                        doc.id,
                        selectedShareDepartmentIds,
                        currentUser.id
                    );
                } else {
                    await Promise.all(
                        selectedShareDepartmentIds.map((deptId) =>
                            shareDocument(doc.id, deptId, currentUser.id)
                        )
                    );
                }
            }

            showToast({
                type: 'success',
                title: isSingle && Boolean(firstDoc?.isFolder)
                    ? 'Folder Shared with Cascade'
                    : isSingle
                    ? 'Document Shared'
                    : 'Documents Shared',
                description: isSingle
                    ? `Shared "${docTitle}" with ${targetCount} department${targetCount > 1 ? 's' : ''}. Status set to Pending Approval.`
                    : `Shared ${docCount} documents with ${targetCount} department${targetCount > 1 ? 's' : ''}. Status set to Pending Approval.`,
            });

            setSelectedShareDepartmentIds([]);
            setDepartmentSearchQuery('');
            setShareModalDocument(null);
            const isBatch = Array.isArray(shareModalDocument);
            if (isBatch || (selectedItems && selectedItems.length > 0)) {
                const processedDocIds = new Set(docs.map((d) => d.id));
                const remaining = (selectedItems || []).filter((it) => !processedDocIds.has(it.id));
                onSelectMultiple?.(remaining);
                if (remaining.length === 1) {
                    setSelectedDocument(remaining[0]);
                    onSelectDocument?.(remaining[0]);
                } else if (remaining.length === 0) {
                    setSelectedDocument(null);
                    onSelectDocument?.(null);
                }
            } else {
                const refreshedDoc = useDocumentStore.getState().documents.find((d) => d.id === firstDoc.id) || firstDoc;
                onSelectMultiple?.([]);
                setSelectedDocument(refreshedDoc);
                onSelectDocument?.(refreshedDoc);
            }
            for (const doc of docs) {
                await useDocumentStore.getState().fetchDocumentShares(doc.id).catch(() => {});
            }
            if (currentUser) {
                await syncAllDocumentShares(currentUser, departments, true).catch(() => {});
            }
            if (isSingle) {
                const refreshedDoc = useDocumentStore.getState().documents.find((d) => d.id === firstDoc.id) || firstDoc;
                setSelectedDocument(refreshedDoc);
                onSelectDocument?.(refreshedDoc);
            }
        } catch (err) {
            console.error('Failed to share document/folder:', err);
            showToast({
                type: 'error',
                title: 'Share Failed',
                description: err?.message || 'Could not complete department share.',
            });
        } finally {
            setIsSharingDepartment(false);
        }
    };

    const handleUnshareClick = async (shareItem, departmentName) => {
        const shareId = shareItem?.id;
        const deptId = shareItem?.department?.id ?? shareItem?.departmentId;
        setUnsharingShareId(shareId || deptId);
        try {
            const isFolder = Boolean(shareModalDocument?.isFolder);
            const docTitle = shareModalDocument?.title || shareModalDocument?.name || 'document';

            if (isCoordinator) {
                const unsharePayload = {
                    shareId: shareId,
                    documentId: shareModalDocument?.id,
                    departmentId: deptId,
                    departmentName: departmentName,
                    isRecursive: isFolder,
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
                    description: `Unshare request for "${departmentName || 'department'}" sent for Administrator approval.`,
                });
                return;
            }

            if (isFolder && deptId) {
                await unshareDocumentRecursive(shareModalDocument.id, deptId);
                showToast({
                    type: 'success',
                    title: 'Share Deleted',
                    description: `Deleted "${docTitle}" and all nested contents from ${departmentName || 'department'}.`,
                });
            } else if (shareId) {
                await unshareDocument(shareId);
                showToast({
                    type: 'success',
                    title: 'Share Deleted',
                    description: `Deleted share for ${departmentName || 'department'}.`,
                });
            }
            if (shareModalDocument?.id) {
                await useDocumentStore.getState().fetchDocumentShares(shareModalDocument.id).catch(() => {});
            }
            if (currentUser) {
                await syncAllDocumentShares(currentUser, departments, true).catch(() => {});
            }
        } catch (err) {
            console.error('Failed to remove share:', err);
            showToast({
                type: 'error',
                title: 'Unshare Failed',
                description: err?.message || 'Could not remove department share.',
            });
        } finally {
            setUnsharingShareId(null);
        }
    };

    // ACTIVE MEMBERS ALREADY PUBLISHED TO FOR MODAL DOC
    const publishedMemberIdsForModalDoc = useMemo(() => {
        if (!publishModalDocument) return new Set();
        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
        const docs = Array.isArray(publishModalDocument) ? publishModalDocument : [publishModalDocument];
        const allDocs = documents || [];
        const modalCleanIds = new Set(
            docs.flatMap((d) => {
                if (d.isFolder) {
                    return getRecursiveDescendantDocIds(d.id, allDocs).map((id) => cleanId(id));
                }
                return [cleanId(d.id)];
            }).filter(Boolean)
        );
        const userDeptClean = cleanId(currentUser?.departmentId);

        const pubShares = (documentShares || []).filter((s) => {
            const sDocId = cleanId(s.document?.id ?? s.documentId);
            const sDeptId = cleanId(s.department?.id ?? s.departmentId);
            const sStatus = String(s.status || '').toUpperCase();
            return (
                modalCleanIds.has(sDocId) &&
                userDeptClean &&
                sDeptId === userDeptClean &&
                sStatus === constants.DOCUMENT_SHARES_STATUS.PUBLISHED
            );
        });

        const broadcastShare = pubShares.find((s) => !s.recipientId && !s.recipient?.id && !s.recipient);
        const memberShares = pubShares.filter((s) => s.recipientId || s.recipient?.id || s.recipient);

        // If broadcast share exists without specific member shares, all department members are already published
        if (broadcastShare && memberShares.length === 0) {
            const allDeptMemberIds = (users || [])
                .filter((u) => cleanId(u.departmentId) === userDeptClean && constants.isMemberRole(u.role))
                .map((u) => cleanId(u.id));
            return new Set(allDeptMemberIds);
        }

        const ids = new Set();
        for (const ms of memberShares) {
            const recId = cleanId(ms.recipient?.id ?? ms.recipientId);
            if (recId) ids.add(recId);
        }
        return ids;
    }, [publishModalDocument, documentShares, currentUser, users, documents]);

    // HANDLERS: PUBLISH TO MEMBERS MODAL
    const departmentMembers = useMemo(() => {
        if (!currentUser?.departmentId) return [];
        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
        const userDeptClean = cleanId(currentUser.departmentId);
        const currentUserIdClean = cleanId(currentUser.id);
        return (users || []).filter(
            (u) =>
                cleanId(u.departmentId) === userDeptClean &&
                cleanId(u.id) !== currentUserIdClean &&
                u.status !== constants.USERS_STATUS.SUSPENDED &&
                constants.isMemberRole(u.role) &&
                !publishedMemberIdsForModalDoc.has(cleanId(u.id))
        );
    }, [users, currentUser, publishedMemberIdsForModalDoc]);

    const filteredDepartmentMembers = useMemo(() => {
        if (!memberSearchQuery.trim()) return departmentMembers;
        const q = memberSearchQuery.toLowerCase();
        return departmentMembers.filter((m) => {
            const fullName = `${m.firstName || ''} ${m.lastName || ''}`.toLowerCase();
            const univId = (m.universityId || '').toLowerCase();
            const email = (m.email || '').toLowerCase();
            return fullName.includes(q) || univId.includes(q) || email.includes(q);
        });
    }, [departmentMembers, memberSearchQuery]);

    // ACTIVE PUBLICATIONS FOR MODAL DOC
    const activePublicationsForModalDoc = useMemo(() => {
        if (!publishModalDocument) return [];
        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
        const docs = Array.isArray(publishModalDocument) ? publishModalDocument : [publishModalDocument];
        const allDocs = documents || [];
        const modalCleanIds = new Set(
            docs.flatMap((d) => {
                if (d.isFolder) {
                    return getRecursiveDescendantDocIds(d.id, allDocs).map((id) => cleanId(id));
                }
                return [cleanId(d.id)];
            }).filter(Boolean)
        );
        const userDeptClean = cleanId(currentUser?.departmentId);

        const pubShares = (documentShares || []).filter((s) => {
            const sDocId = cleanId(s.document?.id ?? s.documentId);
            const sDeptId = cleanId(s.department?.id ?? s.departmentId);
            const sStatus = String(s.status || '').toUpperCase();
            return (
                modalCleanIds.has(sDocId) &&
                userDeptClean &&
                sDeptId === userDeptClean &&
                sStatus === constants.DOCUMENT_SHARES_STATUS.PUBLISHED
            );
        });

        const broadcastShare = pubShares.find((s) => !s.recipientId && !s.recipient?.id && !s.recipient);
        const memberShares = pubShares.filter((s) => s.recipientId || s.recipient?.id || s.recipient);

        const allDeptMembers = (users || []).filter(
            (u) => cleanId(u.departmentId) === userDeptClean && constants.isMemberRole(u.role)
        );

        const seenMemberIds = new Set();
        const memberResults = [];
        for (const ms of memberShares) {
            const recId = cleanId(ms.recipient?.id ?? ms.recipientId);
            if (recId && !seenMemberIds.has(recId)) {
                seenMemberIds.add(recId);
                const memberObj = (users || []).find((u) => cleanId(u.id) === recId);
                memberResults.push({
                    isBroadcast: false,
                    id: ms.id,
                    recipientId: recId,
                    recipient: memberObj || ms.recipient,
                    status: ms.status,
                    createdAt: ms.createdAt,
                    updatedAt: ms.updatedAt,
                    share: ms,
                });
            }
        }

        // Convergence check: If all department members have shares, converge into single Entire Department card
        const isConvergedToAll = allDeptMembers.length > 0 && allDeptMembers.every((m) => seenMemberIds.has(cleanId(m.id)));

        // If broad publish to all OR converged to all members, show ONLY Entire Department
        if (isConvergedToAll || (broadcastShare && memberShares.length === 0)) {
            const targetShare = broadcastShare || memberShares[0]?.share;
            return [{
                isBroadcast: true,
                id: broadcastShare?.id || targetShare?.id || 'converged-broadcast',
                status: constants.DOCUMENT_SHARES_STATUS.PUBLISHED,
                createdAt: targetShare?.createdAt || new Date().toISOString(),
                updatedAt: targetShare?.updatedAt || targetShare?.createdAt,
                share: broadcastShare || targetShare,
            }];
        }

        // If published to a subset of members, show ONLY the members (do NOT show Entire Department)
        return memberResults;
    }, [publishModalDocument, documentShares, currentUser, users, documents]);

    const handleToggleMemberSelection = (memberId) => {
        setSelectedPublishMemberIds((prev) =>
            prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
        );
    };

    const handleSelectAllMembers = () => {
        if (selectedPublishMemberIds.length === filteredDepartmentMembers.length && filteredDepartmentMembers.length > 0) {
            setSelectedPublishMemberIds([]);
        } else {
            setSelectedPublishMemberIds(filteredDepartmentMembers.map((m) => m.id));
        }
    };

    const handleRevokePublicationClick = async (pubItem, targetName) => {
        const pubId = pubItem?.id;
        setUnpublishingPublicationId(pubId);
        try {
            const docTitle = Array.isArray(publishModalDocument)
                ? `${publishModalDocument.length} documents`
                : (publishModalDocument?.title || publishModalDocument?.name || 'document');

            if (pubItem.isBroadcast) {
                await unpublishShare(pubId);
                showToast({
                    type: 'information',
                    title: 'Publication Revoked',
                    description: `Revoked publication of "${docTitle}" for all faculty members in ${userDepartment}.`,
                });
            } else {
                const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
                const recId = cleanId(pubItem.recipientId || pubItem.recipient?.id);
                const userDeptClean = cleanId(currentUser?.departmentId);
                const allDocs = documents || [];
                const targetDocIds = new Set();
                const docs = Array.isArray(publishModalDocument) ? publishModalDocument : [publishModalDocument];
                for (const d of docs) {
                    if (d?.id) {
                        targetDocIds.add(cleanId(d.id));
                        if (d.isFolder) {
                            getRecursiveDescendantDocIds(d.id, allDocs).forEach((cid) => targetDocIds.add(cleanId(cid)));
                        }
                    }
                }

                const relatedShares = (documentShares || []).filter((s) => {
                    const sDoc = cleanId(s.document?.id ?? s.documentId);
                    const sDept = cleanId(s.department?.id ?? s.departmentId);
                    const sRec = cleanId(s.recipient?.id ?? s.recipientId);
                    return sRec === recId && targetDocIds.has(sDoc) && (!userDeptClean || sDept === userDeptClean);
                });

                if (relatedShares.length > 0) {
                    for (const rs of relatedShares) {
                        await unshareDocument(rs.id);
                    }
                } else if (pubId) {
                    await unshareDocument(pubId);
                }

                showToast({
                    type: 'information',
                    title: 'Publication Revoked',
                    description: `Revoked access to "${docTitle}" for ${targetName || 'faculty member'}.`,
                });
            }

            const docs = Array.isArray(publishModalDocument) ? publishModalDocument : [publishModalDocument];
            for (const doc of docs) {
                await useDocumentStore.getState().fetchDocumentShares(doc.id).catch(() => {});
            }
            if (currentUser) {
                await syncAllDocumentShares(currentUser, departments, true).catch(() => {});
            }
        } catch (err) {
            console.error('Failed to revoke publication:', err);
            showToast({
                type: 'error',
                title: 'Revoke Failed',
                description: err?.message || 'Could not revoke publication access.',
            });
        } finally {
            setUnpublishingPublicationId(null);
        }
    };

    const handlePublishSubmit = async () => {
        if (!publishModalDocument || !currentUser?.departmentId || selectedPublishMemberIds.length === 0) return;

        setIsPublishingMembers(true);
        const docs = Array.isArray(publishModalDocument) ? publishModalDocument : [publishModalDocument];
        const isSingle = docs.length === 1;
        const firstDoc = docs[0];
        const docTitle = firstDoc?.title || firstDoc?.name || 'document';
        const docCount = docs.length;

        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
        const userDeptClean = cleanId(currentUser?.departmentId);
        const allDeptMembers = (users || []).filter(
            (u) => cleanId(u.departmentId) === userDeptClean && constants.isMemberRole(u.role)
        );

        // Combine previously published members with newly selected members
        const combinedMemberIds = Array.from(new Set([
            ...Array.from(publishedMemberIdsForModalDoc),
            ...selectedPublishMemberIds
        ]));

        // If combined members covers all department members, publish to all (broad publish)
        const isPublishToAll = allDeptMembers.length > 0 && combinedMemberIds.length >= allDeptMembers.length;
        const targetIds = isPublishToAll ? [] : combinedMemberIds;

        const rawUserDept = currentUser?.departmentId || currentUser?.department?.id || currentUser?.department;
        const matchedUserDept = departments.find((d) =>
            cleanId(d.id) === cleanId(rawUserDept) ||
            (typeof rawUserDept === 'string' && d.name?.toLowerCase() === rawUserDept.toLowerCase()) ||
            (typeof rawUserDept === 'string' && d.code?.toLowerCase() === rawUserDept.toLowerCase())
        );
        const effectiveDeptId = matchedUserDept?.id ?? currentUser?.departmentId;

        try {
            for (const doc of docs) {
                await publishDocumentToMembers(
                    doc.id,
                    effectiveDeptId,
                    targetIds,
                    currentUser.id
                );
                await useDocumentStore.getState().fetchDocumentShares(doc.id).catch(() => {});
                markItemAsSeen(doc);
            }

            showToast({
                type: 'success',
                title: isSingle && Boolean(firstDoc?.isFolder)
                    ? 'Folder Published'
                    : isSingle
                    ? 'Document Published'
                    : 'Documents Published',
                description:
                    isPublishToAll
                        ? isSingle
                            ? `Published "${docTitle}" to all members in ${userDepartment}.`
                            : `Published ${docCount} items to all members in ${userDepartment}.`
                        : isSingle
                            ? `Published "${docTitle}" to ${selectedPublishMemberIds.length} new member${selectedPublishMemberIds.length === 1 ? '' : 's'}.`
                            : `Published ${docCount} items to ${selectedPublishMemberIds.length} new member${selectedPublishMemberIds.length === 1 ? '' : 's'}.`,
            });
            setPublishModalDocument(null);
            setSelectedPublishMemberIds([]);
            const isBatch = Array.isArray(publishModalDocument);
            if (isBatch && docs.length > 1) {
                const processedDocIds = new Set(docs.map((d) => d.id));
                const remaining = (selectedItems || []).filter((it) => !processedDocIds.has(it.id));
                onSelectMultiple?.(remaining);
                if (remaining.length === 1) {
                    setSelectedDocument(remaining[0]);
                    onSelectDocument?.(remaining[0]);
                } else if (remaining.length === 0) {
                    setSelectedDocument(null);
                    onSelectDocument?.(null);
                }
            } else {
                const refreshedDoc = useDocumentStore.getState().documents.find((d) => d.id === firstDoc.id) || firstDoc;
                onSelectMultiple?.([refreshedDoc]);
                setSelectedDocument(refreshedDoc);
                onSelectDocument?.(refreshedDoc);
            }
            if (currentUser) {
                await syncAllDocumentShares(currentUser, departments, true).catch(() => {});
            }
        } catch (err) {
            console.error('Failed to publish document to members:', err);
            showToast({
                type: 'error',
                title: 'Publish Failed',
                description: err?.message || 'Could not update publication settings.',
            });
        } finally {
            setIsPublishingMembers(false);
        }
    };

    const modalPrimaryAction = {
        label: creationMode === 'file'
            ? stagedDroppedItems.length > 1
                ? `Upload ${stagedDroppedItems.length} Items`
                : 'Upload Files'
            : (isCreatingFolder ? 'Creating Folder...' : 'Create Folder'),
        onClick: creationMode === 'file' ? handleUploadFileSubmit : handleCreateFolderSubmit,
        leadingIcon: creationMode === 'file' ? UploadCloud : FolderPlus,
        isLoading: isCreatingFolder,
        isDisabled: isCreatingFolder,
    };

    const modalSecondaryAction = {
        label: 'Cancel',
        onClick: handleRequestCloseCreateModal,
    };

    // RENDER
    return (
        <Container
            variant="page"
            onDragOver={handlePageDragOver}
            onDragLeave={handlePageDragLeave}
            onDrop={handlePageDrop}
            className={`relative ${className ?? ''}`.trim()}
            {...props}
        >
            {/* PAGE LEVEL RECURSIVE DRAG & DROP HIGHLIGHT OVERLAY */}
            {isPageDragActive && (
                <div className="absolute inset-0 z-40 bg-accent-background/80 backdrop-blur-xs border-2 border-dashed border-accent rounded-xl flex flex-col items-center justify-center gap-3 p-6 pointer-events-none animate-toast-in">
                    <div className="p-4 rounded-full bg-accent text-text-inverted shadow-lg animate-bounce">
                        <UploadCloud className="h-10 w-10" />
                    </div>
                    <div className="flex flex-col items-center gap-1 text-center">
                        <span className="text-base font-bold text-text">
                            Drop files or nested folders to upload
                        </span>
                        <span className="text-xs text-text-muted font-medium">
                            Directory structure will be preserved automatically in {currentDirectoryLabel}
                        </span>
                    </div>
                </div>
            )}

            <Browser
                resourceName="documents"
                title="Manage Documents"
                description="Institutional document repository, classification filters, and version management."
                data={currentFolderItems}
                columns={DOCUMENT_COLUMNS}
                filterOptions={dynamicFilterOptions}
                breadcrumbs={activeBreadcrumbsList}
                selectedItem={activeSelectedDocument}
                selectedIds={new Set((selectedItems || []).map((i) => i.id))}
                highlightedIds={highlightedIds}
                onItemHover={markItemAsSeen}
                onItemSeen={markItemAsSeen}
                onSelectItem={handleItemSelect}
                onSelectMultipleItems={onSelectMultiple}
                onDoubleClickItem={handleItemDoubleClick}
                onBreadcrumbClick={handleBreadcrumbClick}
                onAddItem={canUpload ? handleOpenCreateModal : undefined}
                addItemLabel="New Document"
                addItemIcon={Plus}
                searchPlaceholder="Search documents by name, classification..."
                initialView="table"
                onItemAction={handleItemAction}
            />

            {/* DOCUMENT / FOLDER CREATION MODAL */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={handleRequestCloseCreateModal}
                title={creationMode === 'file' ? 'Upload to Repository' : 'Create New Folder'}
                description={`Items will be placed in ${currentDirectoryLabel}.`}
                icon={creationMode === 'file' ? FileUp : FolderPlus}
                size="lg"
                confirmOnClose={false}
                primaryAction={modalPrimaryAction}
                secondaryAction={modalSecondaryAction}
            >
                {/* 1. TOP HEADER CONTROLS: SEGMENTED SWITCHER & QUICK SCAN ACTION */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
                    {/* Modern Segmented Control */}
                    <div className="inline-flex p-1 rounded-xl bg-surface-hover/80 border border-surface-border self-start">
                        <button
                            type="button"
                            onClick={() => handleCreationModeChange('file')}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                creationMode === 'file'
                                    ? 'bg-surface text-text shadow-xs border border-surface-border/80'
                                    : 'text-text-muted hover:text-text'
                            }`}
                        >
                            <FileUp className={`h-4 w-4 ${creationMode === 'file' ? 'text-accent' : 'text-text-muted'}`} />
                            <span>Upload Documents</span>
                            {stagedDroppedItems.length > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-accent/15 text-accent">
                                    {stagedDroppedItems.length}
                                </span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleCreationModeChange('folder')}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                creationMode === 'folder'
                                    ? 'bg-surface text-text shadow-xs border border-surface-border/80'
                                    : 'text-text-muted hover:text-text'
                            }`}
                        >
                            <FolderPlus className={`h-4 w-4 ${creationMode === 'folder' ? 'text-accent' : 'text-text-muted'}`} />
                            <span>Create Folder</span>
                        </button>
                    </div>

                    {/* Wireless Phone Camera Quick Action */}
                    <button
                        type="button"
                        onClick={() => setIsMobileScanModalOpen(true)}
                        className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl border border-accent/30 bg-accent/5 hover:bg-accent/10 text-accent text-xs font-medium transition-all cursor-pointer shadow-2xs group"
                        title="Scan documents wirelessly using your smartphone camera"
                    >
                        <Smartphone className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
                        <span>Scan with Phone</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-accent/20 text-accent uppercase tracking-wider">
                            Camera
                        </span>
                    </button>
                </div>

                {/* 2. MODE CONTENT A: FILE / FOLDER DROPZONE */}
                {creationMode === 'file' && (
                    <div className="flex flex-col gap-4 mt-1">
                        {fileError && (
                            <div className="p-3 rounded-lg bg-error-background border border-error-border text-xs text-error flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                <span>{fileError}</span>
                            </div>
                        )}

                        {/* REFINED DROPZONE */}
                        <div
                            onDragOver={handleDropzoneDragOver}
                            onDragLeave={handleDropzoneDragLeave}
                            onDrop={handleDropzoneDrop}
                            className={`relative group border-2 border-dashed rounded-2xl p-7 flex flex-col items-center justify-center text-center gap-3 transition-all ${
                                isDropzoneDragActive
                                    ? 'border-accent bg-accent/10 scale-[0.995] ring-4 ring-accent/10'
                                    : 'border-surface-border hover:border-accent/50 bg-surface hover:bg-surface-hover/30'
                            }`}
                        >
                            <div className="p-3.5 rounded-2xl bg-surface-hover border border-surface-border text-accent group-hover:scale-105 transition-transform shadow-2xs">
                                <UploadCloud className="h-7 w-7 text-accent" />
                            </div>

                            <div className="flex flex-col gap-1 max-w-sm">
                                <span className="text-sm font-semibold text-text">
                                    Drag and drop documents or directories here
                                </span>
                                <span className="text-xs text-text-muted">
                                    Preserves nested folder structures automatically
                                </span>
                            </div>

                            {/* Dual browse action buttons */}
                            <div className="flex items-center gap-2 mt-1">
                                <button
                                    type="button"
                                    onClick={() => fileInputReference.current?.click()}
                                    className="px-3.5 py-1.5 rounded-lg bg-accent text-text-inverted text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-xs flex items-center gap-1.5"
                                >
                                    <FileUp className="h-3.5 w-3.5" />
                                    <span>Browse Files</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => folderInputReference.current?.click()}
                                    className="px-3.5 py-1.5 rounded-lg bg-surface-hover hover:bg-surface-border border border-surface-border text-text text-xs font-semibold transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
                                    title="Select an entire folder from your computer"
                                >
                                    <FolderUp className="h-3.5 w-3.5 text-text-muted" />
                                    <span>Browse Folder</span>
                                </button>
                            </div>

                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-surface-border/60 w-full justify-center">
                                <span className="text-[11px] text-text-muted flex items-center gap-1">
                                    <span>Destination:</span>
                                    <span className="font-semibold text-text px-2 py-0.5 rounded-md bg-surface-hover border border-surface-border font-mono text-[10px]">
                                        {currentDirectoryLabel}
                                    </span>
                                </span>
                            </div>

                            <input
                                ref={fileInputReference}
                                type="file"
                                multiple
                                onChange={handleFileInputChange}
                                className="hidden"
                            />
                            <input
                                ref={folderInputReference}
                                type="file"
                                webkitdirectory=""
                                directory=""
                                multiple
                                onChange={handleFileInputChange}
                                className="hidden"
                            />
                        </div>

                        {/* STAGED ITEMS QUEUE PREVIEW */}
                        {stagedDroppedItems.length > 0 && (
                            <div className="flex flex-col gap-2.5 mt-1">
                                <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
                                    <span className="text-xs font-semibold text-text flex items-center gap-2">
                                        <Layers className="h-4 w-4 text-accent" />
                                        <span>Staged Items</span>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent/15 text-accent">
                                            {stagedDroppedItems.length}
                                        </span>
                                    </span>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {stagedDroppedItems.some((item) => item.isImage) && (
                                            <div className="flex items-center gap-1.5 text-[11px] text-text-muted bg-surface-hover/70 px-2.5 py-1 rounded-lg border border-surface-border">
                                                <span className="font-medium">Images:</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSetAllImagesOcrMode('ocr_pdf')}
                                                    className="text-accent hover:underline font-semibold cursor-pointer"
                                                    title="Set all images to convert to PDF via Cloud OCR"
                                                >
                                                    All OCR to PDF
                                                </button>
                                                <span className="text-surface-border">•</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSetAllImagesOcrMode('normal_image')}
                                                    className="hover:text-text hover:underline cursor-pointer"
                                                    title="Set all images to upload as original image files"
                                                >
                                                    All Image Only
                                                </button>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1.5 text-[11px] text-text-muted bg-surface-hover/70 px-2.5 py-1 rounded-lg border border-surface-border">
                                            <span className="font-medium">Classification:</span>
                                            <button
                                                type="button"
                                                onClick={() => handleSetAllStagedClassification(constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED)}
                                                className="text-accent hover:underline font-medium cursor-pointer"
                                                title="Set all items to Auto AI classification"
                                            >
                                                Auto AI
                                            </button>
                                            <span className="text-surface-border">•</span>
                                            <button
                                                type="button"
                                                onClick={() => handleSetAllStagedClassification(constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC)}
                                                className="hover:text-text hover:underline cursor-pointer"
                                                title="Set all items to Public"
                                            >
                                                Public
                                            </button>
                                            <span className="text-surface-border">•</span>
                                            <button
                                                type="button"
                                                onClick={() => handleSetAllStagedClassification(constants.DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE)}
                                                className="hover:text-text hover:underline cursor-pointer"
                                                title="Set all items to Private"
                                            >
                                                Private
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleClearAllStagedItems}
                                            className="text-xs text-error hover:underline cursor-pointer font-medium px-1"
                                        >
                                            Clear All
                                        </button>
                                    </div>
                                </div>

                                <div className="max-h-60 overflow-y-auto divide-y divide-surface-border border border-surface-border rounded-xl bg-surface shadow-2xs">
                                    {stagedDroppedItems.map((stagedItem) => (
                                        <div
                                            key={stagedItem.id}
                                            className="px-3.5 py-2.5 flex items-center justify-between text-xs hover:bg-surface-hover/60 transition-colors gap-3"
                                        >
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                {stagedItem.previewUrl ? (
                                                    <img
                                                        src={stagedItem.previewUrl}
                                                        alt="Document Preview"
                                                        className="h-9 w-9 rounded-lg object-cover border border-accent/40 shadow-xs shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                                        onClick={() => handleOpenScanner(stagedItem)}
                                                        title="Click to re-adjust crop/whitening"
                                                    />
                                                ) : stagedItem.isImage ? (
                                                    stagedItem.ocrMode === 'ocr_pdf' ? (
                                                        <div className="h-9 w-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                                                            <ScanText className="h-4 w-4 text-accent" />
                                                        </div>
                                                    ) : (
                                                        <div className="h-9 w-9 rounded-lg bg-surface-hover border border-surface-border flex items-center justify-center shrink-0">
                                                            <ImageIcon className="h-4 w-4 text-information" />
                                                        </div>
                                                    )
                                                ) : (
                                                    <div className="h-9 w-9 rounded-lg bg-surface-hover border border-surface-border flex items-center justify-center shrink-0">
                                                        <FileText className="h-4 w-4 text-accent" />
                                                    </div>
                                                )}
                                                <div className="flex flex-col min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="truncate font-medium text-text font-mono text-[11px]" title={stagedItem.relativePath}>
                                                            {stagedItem.relativePath}
                                                        </span>
                                                        <span className="text-[10px] text-text-muted shrink-0 font-mono">
                                                            ({stagedItem.size})
                                                        </span>
                                                        {stagedItem.isScannerEnhanced && (
                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5 border ${
                                                                stagedItem.scannerFilter === 'original'
                                                                    ? 'bg-success/15 text-success border-success/30'
                                                                    : stagedItem.scannerFilter === 'bw'
                                                                    ? 'bg-neutral-800 text-neutral-200 border-neutral-700'
                                                                    : stagedItem.scannerFilter === 'gray'
                                                                    ? 'bg-neutral-700/50 text-neutral-300 border-neutral-600'
                                                                    : 'bg-accent/15 text-accent border-accent/30'
                                                            }`}>
                                                                <Sparkles className="h-2.5 w-2.5" />
                                                                {stagedItem.scannerFilter === 'original'
                                                                    ? 'Original'
                                                                    : stagedItem.scannerFilter === 'bw'
                                                                    ? 'B&W'
                                                                    : stagedItem.scannerFilter === 'gray'
                                                                    ? 'Grayscale'
                                                                    : 'Whitened'}
                                                            </span>
                                                        )}
                                                        {stagedItem.isMobileCaptured && (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 bg-accent/15 text-accent border border-accent/30">
                                                                <Smartphone className="h-2.5 w-2.5" />
                                                                Phone Capture
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                                                        {stagedItem.isImage && stagedItem.ocrMode === 'ocr_pdf' && (
                                                            <span className="text-[10px] text-accent font-medium flex items-center gap-1">
                                                                <span>➔ Convert to <strong>{(stagedItem.fileName || '').replace(/\.[^/.]+$/, '')}.pdf</strong> via Cloud OCR</span>
                                                            </span>
                                                        )}
                                                        <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                                                            <span className="font-medium">Class:</span>
                                                            <select
                                                                value={stagedItem.classification || constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED}
                                                                onChange={(e) => handleSetStagedItemClassification(stagedItem.id, e.target.value)}
                                                                className="text-[10px] py-0.5 px-2 rounded-md bg-surface hover:bg-surface-hover border border-surface-border text-text font-medium cursor-pointer focus:outline-none focus:border-accent"
                                                                title="Security classification for this document"
                                                            >
                                                                <option value={constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED}>✨ Auto (AI Classify)</option>
                                                                <option value={constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC}>Public</option>
                                                                <option value={constants.DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE}>Private</option>
                                                                <option value={constants.DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED}>Restricted</option>
                                                                <option value={constants.DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL}>Confidential</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                {/* SCANNER ADJUST / CROP BUTTON FOR IMAGES */}
                                                {stagedItem.isImage && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenScanner(stagedItem)}
                                                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium border cursor-pointer transition-all shadow-2xs ${
                                                            stagedItem.isScannerEnhanced
                                                                ? 'bg-accent/15 border-accent/40 text-accent hover:bg-accent/25'
                                                                : 'bg-surface-hover hover:bg-surface-border text-text hover:text-accent border-surface-border'
                                                        }`}
                                                        title="Open Scanner Studio to adjust 8-point crop, rotate 90°, and choose filter"
                                                    >
                                                        <Crop className="h-3 w-3 text-accent" />
                                                        <span>{stagedItem.isScannerEnhanced ? 'Edit Scan' : 'Adjust / Crop'}</span>
                                                    </button>
                                                )}

                                                {/* OCR MODE TOGGLE BUTTONS FOR IMAGES */}
                                                {stagedItem.isImage && (
                                                    <div className="flex items-center gap-0.5 bg-surface-hover p-0.5 rounded-lg border border-surface-border">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleOcrMode(stagedItem.id, 'ocr_pdf')}
                                                            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] transition-colors cursor-pointer ${
                                                                stagedItem.ocrMode === 'ocr_pdf'
                                                                    ? 'bg-accent text-text-inverted font-semibold shadow-xs'
                                                                    : 'text-text-muted hover:text-text'
                                                            }`}
                                                            title="Scan image text with Cloud OCR and convert into searchable PDF"
                                                        >
                                                            <ScanText className="h-3 w-3" />
                                                            <span>OCR</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleOcrMode(stagedItem.id, 'normal_image')}
                                                            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] transition-colors cursor-pointer ${
                                                                stagedItem.ocrMode === 'normal_image'
                                                                    ? 'bg-surface-border text-text font-semibold shadow-xs'
                                                                    : 'text-text-muted hover:text-text'
                                                            }`}
                                                            title="Upload file directly as normal image"
                                                        >
                                                            <ImageIcon className="h-3 w-3" />
                                                            <span>Raw</span>
                                                        </button>
                                                    </div>
                                                )}

                                                {stagedItem.isDuplicate && !stagedItem.resolved ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setConflictModalItem(stagedItem)}
                                                        className="h-7 w-7 rounded-md bg-warning/15 hover:bg-warning/25 text-warning border border-warning/30 flex items-center justify-center cursor-pointer transition-colors"
                                                        title="File already in system. Click to choose New Version or Ignore."
                                                    >
                                                        <span className="font-bold text-xs leading-none">!</span>
                                                    </button>
                                                ) : (
                                                    <>
                                                        {stagedItem.action === 'create_version' && (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent/15 text-accent border border-accent/30 font-mono">
                                                                v{stagedItem.nextVersion ?? 2}.0
                                                            </span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveStagedItem(stagedItem.id)}
                                                            className="group/btn h-7 w-7 rounded-lg hover:bg-error/10 text-text-muted hover:text-error flex items-center justify-center cursor-pointer transition-colors"
                                                            title="Click to remove from staging"
                                                        >
                                                            <Check className="h-4 w-4 text-accent group-hover/btn:hidden transition-all" />
                                                            <X className="h-4 w-4 text-error hidden group-hover/btn:block transition-all" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 3. MODE CONTENT B: FOLDER DETAILS FORM */}
                {creationMode === 'folder' && (
                    <div className="flex flex-col gap-4 mt-2">
                        <div className="p-3 rounded-xl bg-surface-hover/70 border border-surface-border flex items-center gap-2.5 text-xs text-text-muted">
                            <Folder className="h-4 w-4 text-accent shrink-0" />
                            <span>
                                Creating folder inside <strong className="text-text font-mono font-medium">{currentDirectoryLabel}</strong>
                            </span>
                        </div>

                        <TextField
                            label="Folder Name"
                            placeholder="e.g. Research Papers, Memorandums 2026..."
                            value={folderTitle}
                            onChange={(event) => {
                                setFolderTitle(event.target.value);
                                if (folderError) {
                                    setFolderError('');
                                }
                            }}
                            error={folderError}
                            leadingIcon={Folder}
                            required
                        />

                        <AreaField
                            label="Description / Purpose (Optional)"
                            placeholder="Add brief context or notes regarding this folder..."
                            value={folderDescription}
                            onChange={(event) => setFolderDescription(event.target.value)}
                            rows={3}
                        />
                    </div>
                )}
            </Modal>

            {/* CONFLICT RESOLUTION MODAL */}
            {conflictModalItem && (
                <Modal
                    isOpen={Boolean(conflictModalItem)}
                    onClose={() => setConflictModalItem(null)}
                    title="File Already Exists"
                    description={`"${conflictModalItem.fileName}" already exists in ${currentDirectoryLabel} (currently v${conflictModalItem.currentVersion}.0). How would you like to handle this file?`}
                    icon={AlertTriangle}
                    variant="warning"
                    size="md"
                    callout={
                        <div className="flex flex-col gap-1.5 leading-relaxed">
                            <div>• <strong>Create New Version:</strong> Upload as version {conflictModalItem.nextVersion}.0 while preserving previous revisions.</div>
                            <div>• <strong>Upload Anyway:</strong> Upload as a separate document, automatically suffixed with a unique number (e.g. <em>"{getUniqueFileName(conflictModalItem.fileName, currentFolderId, documents, stagedDroppedItems, conflictModalItem.id)}"</em>).</div>
                            <div>• <strong>Ignore:</strong> Remove this file from your upload staging queue.</div>
                        </div>
                    }
                    actions={
                        <div className="flex flex-wrap items-center justify-end gap-2.5 w-full">
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    handleRemoveStagedItem(conflictModalItem.id);
                                    setConflictModalItem(null);
                                }}
                                label="Ignore"
                            />
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    handleUploadAnyway(conflictModalItem);
                                }}
                                label="Upload Anyway"
                            />
                            <Button
                                variant="primary"
                                onClick={() => {
                                    setStagedDroppedItems((prev) =>
                                        prev.map((item) =>
                                            item.id === conflictModalItem.id
                                                ? { ...item, action: 'create_version', resolved: true }
                                                : item
                                        )
                                    );
                                    setConflictModalItem(null);
                                }}
                                label={`Create New Version (v${conflictModalItem.nextVersion}.0)`}
                            />
                        </div>
                    }
                />
            )}

            {/* CHILD RESTORE GUARD MODAL */}
            {restoreConflictModalItem && (
                <Modal
                    isOpen={Boolean(restoreConflictModalItem)}
                    onClose={() => setRestoreConflictModalItem(null)}
                    title="Archived Parent Folder Conflict"
                    description={`The original parent folder "${restoreConflictModalItem.parentFolder?.name || restoreConflictModalItem.parentFolder?.title || 'Parent Folder'}" is currently archived. To restore this item, its parent folder must also be restored.`}
                    icon={AlertTriangle}
                    variant="warning"
                    size={confirmActionModal?.actionKey === 'approve' && constants.isOfficerRole(currentUser?.role) ? 'md' : 'sm'}
                    callout={`Restoring "${restoreConflictModalItem.item?.title || restoreConflictModalItem.item?.name}" will restore parent folder "${restoreConflictModalItem.parentFolder?.name || restoreConflictModalItem.parentFolder?.title}" first into its original repository location.`}
                    primaryAction={{
                        label: 'Restore Parent & Item',
                        onClick: async () => {
                            const { item, parentFolder } = restoreConflictModalItem;
                            setRestoreConflictModalItem(null);
                            await handleRestoreWithParent(item, parentFolder);
                        },
                    }}
                    secondaryAction={{
                        label: 'Ignore',
                        onClick: () => setRestoreConflictModalItem(null),
                    }}
                />
            )}

            {/* DISCARD CONFIRMATION MODAL */}
            <Modal
                isOpen={isDiscardConfirmOpen}
                onClose={handleCancelDiscard}
                title="Discard Unsaved Items?"
                description={
                    stagedDroppedItems.length > 0
                        ? `You have ${stagedDroppedItems.length} staged ${stagedDroppedItems.length === 1 ? 'item' : 'items'} in the queue. Closing now will discard them without uploading.`
                        : 'You have entered unsaved folder details. Closing now will discard them.'
                }
                icon={AlertTriangle}
                size="sm"
                variant="destructive"
                callout="Any staged files, nested directory trees, or uncommitted folder forms will be discarded immediately from memory."
                primaryAction={{
                    label: 'Discard & Exit',
                    onClick: handleForceCloseCreateModal,
                    variant: 'destructive',
                }}
                secondaryAction={{
                    label: 'Keep Staged Items',
                    onClick: handleCancelDiscard,
                }}
            />

            {/* EDIT FOLDER / FILE MODAL */}
            {isEditModalOpen && editItem && (
                <Modal
                    isOpen={isEditModalOpen}
                    onClose={() => !isSavingEdit && !isGeneratingAiSummary && !isClassifyingAi && handleCloseEditModal()}
                    title={editItem.isFolder ? 'Edit Folder' : 'Edit File'}
                    description={
                        editItem.isFolder
                            ? 'Update directory properties in the institutional repository.'
                            : 'Update document metadata, security classification, and summary.'
                    }
                    icon={editItem.isFolder ? Folder : FileText}
                    size="md"
                    primaryAction={{
                        label: isSavingEdit ? 'Saving...' : 'Save Changes',
                        onClick: handleSaveEdit,
                        isLoading: isSavingEdit,
                        disabled: isSavingEdit || isGeneratingAiSummary || isClassifyingAi,
                    }}
                    secondaryAction={{
                        label: 'Cancel',
                        onClick: handleCloseEditModal,
                        disabled: isSavingEdit || isGeneratingAiSummary || isClassifyingAi,
                    }}
                >
                    <div className="flex flex-col gap-4 py-2">
                        {/* 1. NAME (REQUIRED FOR BOTH) */}
                        {editItem.isFolder ? (
                            <TextField
                                label="Name"
                                placeholder="Enter folder name..."
                                value={editFormName}
                                onChange={(event) => {
                                    setEditFormName(event.target.value);
                                    if (editFormErrors.name) setEditFormErrors((prev) => ({ ...prev, name: '' }));
                                }}
                                error={editFormErrors.name}
                                leadingIcon={Folder}
                                required
                            />
                        ) : (
                            <TextField
                                label="File Name"
                                placeholder="Enter document filename..."
                                value={editFormName}
                                onChange={(event) => {
                                    let val = event.target.value;
                                    if (editFormExtension && val.toLowerCase().endsWith(editFormExtension.toLowerCase())) {
                                        val = val.slice(0, -editFormExtension.length);
                                    }
                                    setEditFormName(val);
                                    if (editFormErrors.name) setEditFormErrors((prev) => ({ ...prev, name: '' }));
                                }}
                                suffixOptions={FILE_EXTENSION_OPTIONS}
                                selectedSuffix={editFormExtension}
                                onSuffixChange={(ext) => setEditFormExtension(ext)}
                                error={editFormErrors.name}
                                leadingIcon={FileText}
                                helperText={`Format: ${formatMimeTypeLabel(getMimeTypeFromFilename(`file${editFormExtension}`))}`}
                                required
                            />
                        )}

                        {/* 2. FOR FILES ONLY: CLASSIFICATION WITH SPARKLES AI BUTTON */}
                        {!editItem.isFolder && (
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-semibold text-text">
                                        Classification <span className="text-error">*</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleAutoClassifyWithAI}
                                        disabled={isClassifyingAi || isGeneratingAiSummary || isSavingEdit}
                                        className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-surface-hover hover:bg-surface-border text-text-muted hover:text-text border border-surface-border cursor-pointer transition-colors disabled:opacity-50"
                                        title="Classify automatically with AI"
                                    >
                                        <Sparkles className={`h-3 w-3 text-text-muted ${isClassifyingAi ? 'animate-spin' : ''}`} />
                                        <span>{isClassifyingAi ? 'Classifying...' : 'Classify with AI'}</span>
                                    </button>
                                </div>
                                <SelectField
                                    value={editFormClassification}
                                    onChange={(value) => {
                                        setEditFormClassification(value);
                                        if (editFormErrors.classification) setEditFormErrors((prev) => ({ ...prev, classification: '' }));
                                    }}
                                    options={CLASSIFICATION_OPTIONS}
                                    placeholder="Select classification..."
                                    required
                                    error={editFormErrors.classification}
                                />
                            </div>
                        )}

                        {/* 3. SUMMARY WITH SPARKLES AI BUTTON (DOCUMENTS ONLY) */}
                        {!editItem.isFolder && (
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-semibold text-text">
                                        Summary
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleGenerateSummaryWithAI}
                                        disabled={isGeneratingAiSummary || isClassifyingAi || isSavingEdit}
                                        className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-surface-hover hover:bg-surface-border text-text-muted hover:text-text border border-surface-border cursor-pointer transition-colors disabled:opacity-50"
                                        title="Generate AI summary with Vertex AI"
                                    >
                                        <Sparkles className={`h-3 w-3 text-text-muted ${isGeneratingAiSummary ? 'animate-spin' : ''}`} />
                                        <span>{isGeneratingAiSummary ? 'Summarizing...' : 'Summarize with AI'}</span>
                                    </button>
                                </div>
                                <AreaField
                                    placeholder="Enter document executive summary..."
                                    value={editFormSummary}
                                    onChange={(event) => {
                                        setEditFormSummary(event.target.value);
                                        if (editFormErrors.summary) setEditFormErrors((prev) => ({ ...prev, summary: '' }));
                                    }}
                                    error={editFormErrors.summary}
                                    rows={3}
                                />
                            </div>
                        )}

                        {/* 4. COMMENT (FOR BOTH - STRICTLY 100% HUMAN-ONLY, NO AI BUTTON) */}
                        <AreaField
                            label="Comment"
                            placeholder="Add administrative comment or notes..."
                            value={editFormComment}
                            onChange={(event) => setEditFormComment(event.target.value)}
                            rows={3}
                        />
                    </div>
                </Modal>
            )}

            {/* ARCHIVE CONFIRMATION MODAL */}
            {archivingItem && (
                <Modal
                    isOpen={Boolean(archivingItem)}
                    onClose={() => !isArchivingItem && setArchivingItem(null)}
                    title={
                        Array.isArray(archivingItem)
                            ? `Archive ${archivingItem.length} Items`
                            : archivingItem.isFolder
                            ? 'Archive Folder'
                            : 'Archive Document'
                    }
                    description={
                        Array.isArray(archivingItem)
                            ? `Are you sure you want to archive ${archivingItem.length} selected items and their contents?`
                            : archivingItem.isFolder
                            ? `Are you sure you want to archive folder "${archivingItem.title || archivingItem.name}" and all of its contents?`
                            : `Are you sure you want to archive document "${archivingItem.title || archivingItem.name}"?`
                    }
                    icon={AlertTriangle}
                    variant="destructive"
                    size="sm"
                    callout={
                        Array.isArray(archivingItem)
                            ? 'The selected items and their contents will be moved to the archives and hidden from the active repository. Directly archived items can be restored later.'
                            : archivingItem.isFolder
                            ? 'The folder and its active contents will be moved to the archives and hidden from the active repository. Directly archived items can be restored later.'
                            : 'The document will be moved to the archives and hidden from active views. It can be restored at any time.'
                    }
                    calloutVariant="destructive"
                    onConfirm={handleConfirmArchiveItem}
                    confirmLabel={
                        isArchivingItem
                            ? 'Archiving...'
                            : Array.isArray(archivingItem)
                            ? `Archive ${archivingItem.length} Items`
                            : archivingItem.isFolder
                            ? 'Archive Folder'
                            : 'Archive Document'
                    }
                    cancelLabel="Cancel"
                    isConfirmLoading={isArchivingItem}
                    isConfirmDisabled={isArchivingItem}
                />
            )}

            {/* RESTORE CONFIRMATION MODAL */}
            {restoringItem && (
                <Modal
                    isOpen={Boolean(restoringItem)}
                    onClose={() => !isRestoringItem && setRestoringItem(null)}
                    title={
                        Array.isArray(restoringItem)
                            ? `Restore all (${restoringItem.length})`
                            : restoringItem.isFolder
                            ? 'Restore Folder'
                            : 'Restore Document'
                    }
                    description={
                        Array.isArray(restoringItem)
                            ? `Are you sure you want to restore ${restoringItem.length} selected items to the active repository?`
                            : restoringItem.isFolder
                            ? `Are you sure you want to restore folder "${restoringItem.title || restoringItem.name}" to the active repository?`
                            : `Are you sure you want to restore document "${restoringItem.title || restoringItem.name}" to the active repository?`
                    }
                    icon={RotateCcw}
                    variant="primary"
                    size="sm"
                    callout={
                        Array.isArray(restoringItem)
                            ? 'The selected items will be moved back to the active repository and visible to permitted users.'
                            : restoringItem.isFolder
                            ? 'The folder and its directly active contents will be restored back to the repository.'
                            : 'The document will be restored back to its active repository location.'
                    }
                    calloutVariant="primary"
                    onConfirm={handleConfirmRestoreItem}
                    confirmLabel={
                        isRestoringItem
                            ? 'Restoring...'
                            : Array.isArray(restoringItem)
                            ? `Restore all (${restoringItem.length})`
                            : restoringItem.isFolder
                            ? 'Restore Folder'
                            : 'Restore Document'
                    }
                    cancelLabel="Cancel"
                    isConfirmLoading={isRestoringItem}
                    isConfirmDisabled={isRestoringItem}
                />
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {deletingItem && (
                <Modal
                    isOpen={Boolean(deletingItem)}
                    onClose={() => !isDeletingItemLoading && setDeletingItem(null)}
                    title={
                        Array.isArray(deletingItem)
                            ? `Delete ${deletingItem.length} Items`
                            : `Delete ${deletingItem.isFolder ? 'Folder' : 'Document'}`
                    }
                    description={
                        Array.isArray(deletingItem)
                            ? `Are you sure you want to delete ${deletingItem.length} selected items?`
                            : `Are you sure you want to delete "${deletingItem.title || deletingItem.name}"?`
                    }
                    icon={Trash2}
                    variant="destructive"
                    size="sm"
                    callout="This action cannot be undone and will permanently remove all associated version records from the database and storage files."
                    onConfirm={handleConfirmDeleteItem}
                    confirmLabel={
                        isDeletingItemLoading
                            ? 'Deleting...'
                            : Array.isArray(deletingItem)
                            ? `Delete ${deletingItem.length} Items`
                            : `Delete ${deletingItem.isFolder ? 'Folder' : 'Document'}`
                    }
                    cancelLabel="Cancel"
                    isConfirmLoading={isDeletingItemLoading}
                    isConfirmDisabled={isDeletingItemLoading}
                />
            )}

            {/* DOCUMENT VIEWER & IN-APP EDITOR MODAL */}
            <DocumentViewerModal
                isOpen={Boolean(previewingDocument)}
                item={previewingDocument}
                onClose={() => setPreviewingDocument(null)}
            />

            {/* DOCUMENT SCANNER STUDIO MODAL */}
            {scannerItem && (
                <DocumentScannerModal
                    isOpen={Boolean(scannerItem)}
                    file={scannerItem?.file}
                    onClose={() => setScannerItem(null)}
                    onApply={handleApplyScannerResults}
                />
            )}

            {/* MOBILE SCANNER PAIRING MODAL */}
            <MobileScanModal
                isOpen={isMobileScanModalOpen}
                onClose={() => setIsMobileScanModalOpen(false)}
                onImageReceived={handleMobileImageReceived}
                currentFolderLabel={currentDirectoryLabel}
            />

            {/* SHARE TO DEPARTMENT MODAL */}
            {Boolean(shareModalDocument) && (
                <Modal
                    isOpen={Boolean(shareModalDocument)}
                    onClose={() => {
                        setShareModalDocument(null);
                        setSelectedShareDepartmentIds([]);
                        setDepartmentSearchQuery('');
                    }}
                    title={Array.isArray(shareModalDocument)
                        ? `Share ${shareModalDocument.length} Items`
                        : `Share ${shareModalDocument.isFolder ? 'Folder' : 'Document'}: "${shareModalDocument.title || shareModalDocument.name}"`}
                    description={Array.isArray(shareModalDocument)
                        ? `Manage departmental distribution and review routing for ${shareModalDocument.length} selected documents.`
                        : `Manage departmental distribution and review routing for "${shareModalDocument.title || shareModalDocument.name}".`}
                    icon={Share2}
                    size="full"
                    className="max-w-6xl"
                    secondaryAction={{
                        label: 'Cancel',
                        isDisabled: isSharingDepartment,
                        onClick: () => {
                            if (!isSharingDepartment) {
                                setShareModalDocument(null);
                                setSelectedShareDepartmentIds([]);
                                setDepartmentSearchQuery('');
                            }
                        },
                    }}
                    primaryAction={{
                        label: 'Confirm',
                        variant: 'primary',
                        leadingIcon: Share2,
                        isLoading: isSharingDepartment,
                        isDisabled: selectedShareDepartmentIds.length === 0 || isSharingDepartment || affectedShareTree.totalActive === 0,
                        onClick: handleShareSubmit,
                    }}
                >
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                        {/* COLUMN 1: AFFECTED FILES DIRECTORY TREE */}
                        <div className="lg:col-span-4 flex flex-col gap-3.5 p-4 rounded-xl border border-surface-border bg-surface-hover/30">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <h4 className="text-xs font-bold text-text uppercase tracking-wider">
                                        Affected Files
                                    </h4>
                                    <p className="text-[11px] text-text-muted">
                                        {affectedShareTree.totalActive} included
                                        {affectedShareTree.hasExcluded ? ` (${excludedShareDocIds.size} excluded)` : ''}
                                    </p>
                                </div>
                                {affectedShareTree.hasExcluded && (
                                    <button
                                        type="button"
                                        onClick={() => setExcludedShareDocIds(new Set())}
                                        className="text-xs text-accent hover:underline font-medium cursor-pointer"
                                        title="Restore all excluded items"
                                    >
                                        Restore All
                                    </button>
                                )}
                            </div>

                            {/* MASTER TOGGLE ALL STAGED PDFS */}
                            {affectedShareTree.allPdfs.length > 0 && (() => {
                                const allPdfIds = affectedShareTree.allPdfs.map((p) => p.id);
                                const allMandatory = allPdfIds.length > 0 && allPdfIds.every((id) => Boolean(shareRequiresSignatureMap[id]));
                                const someMandatory = allPdfIds.some((id) => Boolean(shareRequiresSignatureMap[id]));
                                return (
                                    <div className="flex items-center justify-between p-2 rounded-lg bg-surface border border-surface-border text-xs">
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                role="checkbox"
                                                aria-checked={allMandatory}
                                                onClick={() => {
                                                    const nextVal = !allMandatory;
                                                    const updates = {};
                                                    allPdfIds.forEach((pid) => {
                                                        updates[pid] = nextVal;
                                                        documentService.setLocalRequiresSignature(pid, nextVal);
                                                    });
                                                    setShareRequiresSignatureMap((prev) => ({ ...prev, ...updates }));
                                                }}
                                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                                                    allMandatory
                                                        ? 'bg-amber-500 border-amber-500 text-white'
                                                        : someMandatory
                                                        ? 'bg-amber-500/30 border-amber-500 text-amber-300'
                                                        : 'border-surface-border bg-surface hover:border-amber-500/70'
                                                }`}
                                                title={allMandatory ? 'All PDFs mandatory. Click to uncheck all.' : 'Click to require signature on all staged PDFs.'}
                                            >
                                                {allMandatory && <Check className="h-3 w-3 stroke-[3]" />}
                                                {!allMandatory && someMandatory && <Minus className="h-3 w-3 stroke-[3]" />}
                                            </button>
                                            <span className="text-[11px] font-medium text-text">
                                                {allMandatory ? 'All PDFs Mandatory Sign' : 'Require Sign on All PDFs'}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-text-muted font-mono">
                                            {affectedShareTree.allPdfs.filter((p) => shareRequiresSignatureMap[p.id]).length}/{affectedShareTree.allPdfs.length}
                                        </span>
                                    </div>
                                );
                            })()}

                            {/* HIERARCHICAL TREE CONTAINER */}
                            <div
                                role="region"
                                aria-label="Affected files directory tree"
                                className="flex-1 overflow-y-auto max-h-[350px] pr-1 space-y-1 min-h-[220px]"
                            >
                                {affectedShareTree.roots.length === 0 ? (
                                    <div className="h-full min-h-[180px] flex flex-col items-center justify-center p-6 text-center rounded-lg border border-dashed border-surface-border bg-surface/50 text-xs text-text-muted gap-2">
                                        <FileText className="h-6 w-6 text-text-muted/50" />
                                        <span className="font-semibold text-text">No Items Selected</span>
                                        <span className="text-[11px] leading-relaxed">
                                            All staged items have been excluded. Click "Restore All" above to include them again.
                                        </span>
                                    </div>
                                ) : (
                                    affectedShareTree.roots.map(renderShareTreeNode)
                                )}
                            </div>

                            {/* TREE FOOTER */}
                            <div className="pt-2 border-t border-surface-border flex items-center justify-between gap-2 mt-auto text-[11px] text-text-muted">
                                <span>
                                    {affectedShareTree.allPdfs.length} {affectedShareTree.allPdfs.length === 1 ? 'PDF' : 'PDFs'}
                                </span>
                                {affectedShareTree.allPdfs.length > 0 && (
                                    <span className="text-amber-500 font-medium">
                                        {affectedShareTree.allPdfs.filter((p) => shareRequiresSignatureMap[p.id]).length} mandatory
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* COLUMN 2: DEPARTMENT PICKER */}
                        <div className="lg:col-span-4 flex flex-col gap-3.5 p-4 rounded-xl border border-surface-border bg-surface-hover/30">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <h4 className="text-xs font-bold text-text uppercase tracking-wider">
                                            Target Departments
                                        </h4>
                                        <p className="text-[11px] text-text-muted">
                                            Select departments to route for review
                                        </p>
                                    </div>
                                    {availableDepartmentsToShare.length > 0 && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={handleSelectAllDepartments}
                                                aria-label={selectedShareDepartmentIds.length === filteredAvailableDepartments.length && filteredAvailableDepartments.length > 0 ? 'Deselect all departments' : 'Select all departments'}
                                                className="text-xs text-accent hover:underline font-medium cursor-pointer"
                                            >
                                                {selectedShareDepartmentIds.length === filteredAvailableDepartments.length && filteredAvailableDepartments.length > 0
                                                    ? 'Deselect All'
                                                    : 'Select All'}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* SEARCH FILTER */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
                                    <input
                                        type="text"
                                        value={departmentSearchQuery}
                                        onChange={(e) => setDepartmentSearchQuery(e.target.value)}
                                        aria-label="Filter target departments"
                                        placeholder="Search departments by name or code..."
                                        className="w-full pl-8.5 pr-8 py-2 text-xs bg-surface border border-surface-border rounded-lg text-text focus:outline-none focus:border-accent transition-colors"
                                    />
                                    {departmentSearchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setDepartmentSearchQuery('')}
                                            aria-label="Clear department filter"
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text p-0.5 cursor-pointer"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* AVAILABLE DEPARTMENTS LIST */}
                                <div
                                    role="group"
                                    aria-label="Available departments to share with"
                                    className="flex-1 overflow-y-auto max-h-[290px] pr-1 space-y-1.5 min-h-[180px]"
                                >
                                    {availableDepartmentsToShare.length === 0 ? (
                                        <div className="h-full min-h-[180px] flex flex-col items-center justify-center p-6 text-center rounded-lg border border-dashed border-surface-border bg-surface/50 text-xs text-text-muted gap-2">
                                            <Building2 className="h-6 w-6 text-text-muted/50" />
                                            <span className="font-semibold text-text">No Departments Available</span>
                                            <span className="text-[11px] max-w-xs leading-relaxed">
                                                All eligible departments already have access to {Array.isArray(shareModalDocument) ? `${shareModalDocument.length} selected documents` : shareModalDocument.isFolder ? 'this folder' : 'this document'}.
                                            </span>
                                        </div>
                                    ) : filteredAvailableDepartments.length === 0 ? (
                                        <div className="h-full min-h-[180px] flex flex-col items-center justify-center p-6 text-center rounded-lg border border-dashed border-surface-border bg-surface/50 text-xs text-text-muted gap-1.5">
                                            <Search className="h-5 w-5 text-text-muted/50" />
                                            <span>No departments match &quot;{departmentSearchQuery}&quot;</span>
                                            <button
                                                type="button"
                                                onClick={() => setDepartmentSearchQuery('')}
                                                className="text-accent text-[11px] hover:underline mt-1 cursor-pointer"
                                            >
                                                Clear filter
                                            </button>
                                        </div>
                                    ) : (
                                        filteredAvailableDepartments.map((dept) => {
                                            const isSelected = selectedShareDepartmentIds.includes(dept.id);
                                            return (
                                                <div
                                                    key={dept.id}
                                                    role="checkbox"
                                                    aria-checked={isSelected}
                                                    tabIndex={0}
                                                    aria-label={`Select ${dept.name} department`}
                                                    onClick={() => handleToggleDepartmentSelection(dept.id)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === ' ' || e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleToggleDepartmentSelection(dept.id);
                                                        }
                                                    }}
                                                    className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                                                        isSelected
                                                            ? 'border-accent bg-accent/10 shadow-xs'
                                                            : 'border-surface-border bg-surface hover:border-surface-border-strong hover:bg-surface-hover'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                        <div
                                                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                                                isSelected
                                                                    ? 'bg-accent border-accent text-accent-foreground'
                                                                    : 'border-surface-border bg-surface'
                                                            }`}
                                                        >
                                                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-xs font-semibold text-text truncate">
                                                                {dept.name}
                                                            </span>
                                                            <span className="text-[10px] text-text-muted">
                                                                Code: {dept.code || 'DEPT'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <Badge
                                                        variant={isSelected ? 'accent' : 'neutral'}
                                                        size="xs"
                                                        label={dept.code || 'DEPT'}
                                                    />
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* DISPATCH FOOTER */}
                                <div className="pt-2 border-t border-surface-border flex items-center justify-between gap-3 mt-auto">
                                    <span className="text-[11px] text-text-muted">
                                        {selectedShareDepartmentIds.length} of {availableDepartmentsToShare.length} departments selected
                                    </span>
                                    {selectedShareDepartmentIds.length > 0 && (
                                        <span className="text-[11px] font-medium text-accent">
                                            Ready to confirm
                                        </span>
                                    )}
                                </div>
                            </div>

                        {/* COLUMN 3: ACTIVE SHARES LIST */}
                        <div className="lg:col-span-4 flex flex-col gap-3.5 p-4 rounded-xl border border-surface-border bg-surface">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-xs font-bold text-text uppercase tracking-wider">
                                            Active Shares
                                        </h4>
                                        <p className="text-[11px] text-text-muted">
                                            Currently granted access
                                        </p>
                                    </div>
                                    <Badge
                                        variant={activeSharesForModalDoc.length > 0 ? 'accent' : 'neutral'}
                                        size="xs"
                                        label={`${activeSharesForModalDoc.length} Shared`}
                                        aria-label={`${activeSharesForModalDoc.length} active department ${activeSharesForModalDoc.length === 1 ? 'share' : 'shares'}`}
                                    />
                                </div>

                                <div
                                    role="region"
                                    aria-label="Active departmental shares"
                                    className="flex-1 overflow-y-auto max-h-[360px] pr-1 space-y-2 min-h-[180px]"
                                >
                                    {activeSharesForModalDoc.length === 0 ? (
                                        <div className="h-full min-h-[180px] flex flex-col items-center justify-center p-6 text-center rounded-lg border border-dashed border-surface-border bg-surface-hover/30 text-xs text-text-muted gap-2">
                                            <Share2 className="h-6 w-6 text-text-muted/40" />
                                            <span className="font-semibold text-text">Not Shared Externally</span>
                                            <span className="text-[11px] leading-relaxed max-w-xs">
                                                {Array.isArray(shareModalDocument)
                                                    ? 'The selected documents are currently internal to your department. Use the picker on the left to share with other units.'
                                                    : `This ${shareModalDocument.isFolder ? 'folder' : 'document'} is currently internal to your department. Use the picker on the left to share with other units.`}
                                            </span>
                                        </div>
                                    ) : (
                                        activeSharesForModalDoc.map((share) => {
                                            const dept = departments.find(
                                                (d) => d.id === (share.department?.id ?? share.departmentId)
                                            );
                                            const badgeVariant =
                                                share.status === constants.DOCUMENT_SHARES_STATUS.PUBLISHED
                                                    ? 'success'
                                                    : share.status === constants.DOCUMENT_SHARES_STATUS.APPROVED
                                                    ? 'success'
                                                    : share.status === constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL
                                                    ? 'warning'
                                                    : 'neutral';

                                            const shareKey = share.id || (share.department?.id ?? share.departmentId);
                                            const isUnsharing = unsharingShareId === share.id || unsharingShareId === (share.department?.id ?? share.departmentId);

                                            return (
                                                <div
                                                    key={shareKey}
                                                    className="p-3 rounded-lg border border-surface-border bg-surface-hover/50 hover:bg-surface-hover transition-colors flex items-start justify-between gap-2.5"
                                                >
                                                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="font-semibold text-xs text-text truncate">
                                                                {dept?.name || 'Department'}
                                                            </span>
                                                            {dept?.code && (
                                                                <span className="text-[10px] text-text-muted font-mono">
                                                                    ({dept.code})
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <Badge variant={badgeVariant} size="xs" label={share.status} />
                                                            {!Array.isArray(shareModalDocument) && shareModalDocument.isFolder && (
                                                                <Badge variant="neutral" size="xs" label="Cascading" />
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] text-text-muted pt-0.5">
                                                            Shared {formatDateTime(share.createdAt)}
                                                        </span>
                                                    </div>

                                                    <Button
                                                        variant="destructive"
                                                        size="xs"
                                                        leadingIcon={Trash2}
                                                        isLoading={isUnsharing}
                                                        isDisabled={Boolean(unsharingShareId)}
                                                        onClick={() => handleUnshareClick(share, dept?.name)}
                                                        aria-label={`Unshare from ${dept?.name || 'department'}`}
                                                        className="shrink-0"
                                                    >
                                                        Revoke
                                                    </Button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                <div className="pt-2 border-t border-surface-border text-[11px] text-text-muted flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                                    <span>Routes to Department Officers for approval before director review.</span>
                                </div>
                            </div>
                        </div>
                </Modal>
            )}

            {/* PUBLISH TO DEPARTMENT MEMBERS MODAL */}
            {Boolean(publishModalDocument) && (
                <Modal
                    isOpen={Boolean(publishModalDocument)}
                    onClose={() => {
                        if (!isPublishingMembers) {
                            setPublishModalDocument(null);
                            setSelectedPublishMemberIds([]);
                            setMemberSearchQuery('');
                        }
                    }}
                    title={Array.isArray(publishModalDocument)
                        ? `Publish ${publishModalDocument.length} Items`
                        : `Publish ${publishModalDocument.isFolder ? 'Folder' : 'Document'}: "${publishModalDocument.title || publishModalDocument.name}"`}
                    description={Array.isArray(publishModalDocument)
                        ? `Manage faculty distribution and member access for ${publishModalDocument.length} selected documents in ${userDepartment}.`
                        : `Manage faculty distribution and member access for "${publishModalDocument.title || publishModalDocument.name}" in ${userDepartment}.`}
                    icon={Globe}
                    size="xl"
                    secondaryAction={{
                        label: 'Cancel',
                        isDisabled: isPublishingMembers,
                        onClick: () => {
                            if (!isPublishingMembers) {
                                setPublishModalDocument(null);
                                setSelectedPublishMemberIds([]);
                                setMemberSearchQuery('');
                            }
                        },
                    }}
                    primaryAction={{
                        label: isPublishingMembers
                            ? 'Publishing...'
                            : selectedPublishMemberIds.length > 0
                            ? `Publish to Selected (${selectedPublishMemberIds.length})`
                            : 'Confirm',
                        variant: 'primary',
                        leadingIcon: Globe,
                        isLoading: isPublishingMembers,
                        isDisabled: isPublishingMembers || selectedPublishMemberIds.length === 0,
                        onClick: handlePublishSubmit,
                    }}
                >
                    <div className="flex flex-col gap-4">
                        {/* AFFECTED DOCUMENTS PREVIEW SECTION */}
                        <ModalAffectedDocumentsSection
                            targetDocument={publishModalDocument}
                            allDocuments={documents}
                            actionType="publish"
                        />

                        {/* 2-COLUMN LAYOUT: LEFT = PICKER / DISPATCH, RIGHT = ACTIVE PUBLICATIONS */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                            {/* LEFT COLUMN: MEMBER PICKER */}
                            <div className="md:col-span-7 flex flex-col gap-3.5 p-4 rounded-xl border border-surface-border bg-surface-hover/30">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <h4 className="text-xs font-bold text-text uppercase tracking-wider">
                                            Target Members
                                        </h4>
                                        <p className="text-[11px] text-text-muted">
                                            Select faculty members to grant publication access
                                        </p>
                                    </div>
                                    {departmentMembers.length > 0 && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={handleSelectAllMembers}
                                                aria-label={
                                                    selectedPublishMemberIds.length === filteredDepartmentMembers.length && filteredDepartmentMembers.length > 0
                                                        ? 'Deselect all faculty members'
                                                        : 'Select all faculty members'
                                                }
                                                className="text-xs text-accent hover:underline font-medium cursor-pointer"
                                            >
                                                {selectedPublishMemberIds.length === filteredDepartmentMembers.length && filteredDepartmentMembers.length > 0
                                                    ? 'Deselect All'
                                                    : 'Select All'}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* SEARCH FILTER */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
                                    <input
                                        type="text"
                                        value={memberSearchQuery}
                                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                                        aria-label="Filter target members"
                                        placeholder="Search members by name, ID, or email..."
                                        className="w-full pl-8.5 pr-8 py-2 text-xs bg-surface border border-surface-border rounded-lg text-text focus:outline-none focus:border-accent transition-colors"
                                    />
                                    {memberSearchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setMemberSearchQuery('')}
                                            aria-label="Clear member filter"
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text p-0.5 cursor-pointer"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* AVAILABLE MEMBERS LIST */}
                                <div
                                    role="group"
                                    aria-label="Available faculty members to publish to"
                                    className="flex-1 overflow-y-auto max-h-[290px] pr-1 space-y-1.5 min-h-[180px]"
                                >
                                    {departmentMembers.length === 0 ? (
                                        <div className="h-full min-h-[180px] flex flex-col items-center justify-center p-6 text-center rounded-lg border border-dashed border-surface-border bg-surface/50 text-xs text-text-muted gap-2">
                                            <Users className="h-6 w-6 text-text-muted/50" />
                                            <span className="font-semibold text-text">
                                                {publishedMemberIdsForModalDoc.size > 0 ? 'All Members Published' : 'No Faculty Members Found'}
                                            </span>
                                            <span className="text-[11px] max-w-xs leading-relaxed">
                                                {publishedMemberIdsForModalDoc.size > 0
                                                    ? `All faculty members in ${userDepartment} already have active publication access.`
                                                    : `There are no active faculty members assigned to ${userDepartment}.`}
                                            </span>
                                        </div>
                                    ) : filteredDepartmentMembers.length === 0 ? (
                                        <div className="h-full min-h-[180px] flex flex-col items-center justify-center p-6 text-center rounded-lg border border-dashed border-surface-border bg-surface/50 text-xs text-text-muted gap-1.5">
                                            <Search className="h-5 w-5 text-text-muted/50" />
                                            <span>No members match &quot;{memberSearchQuery}&quot;</span>
                                            <button
                                                type="button"
                                                onClick={() => setMemberSearchQuery('')}
                                                className="text-accent text-[11px] hover:underline mt-1 cursor-pointer"
                                            >
                                                Clear filter
                                            </button>
                                        </div>
                                    ) : (
                                        filteredDepartmentMembers.map((member) => {
                                            const isSelected = selectedPublishMemberIds.includes(member.id);
                                            const avatarSrc = resolveUserAvatar(member, currentUser);
                                            const memberFullName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Faculty Member';

                                            return (
                                                <div
                                                    key={member.id}
                                                    role="checkbox"
                                                    aria-checked={isSelected}
                                                    tabIndex={0}
                                                    aria-label={`Select ${memberFullName}`}
                                                    onClick={() => handleToggleMemberSelection(member.id)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === ' ' || e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleToggleMemberSelection(member.id);
                                                        }
                                                    }}
                                                    className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                                                        isSelected
                                                            ? 'border-accent bg-accent/10 shadow-xs'
                                                            : 'border-surface-border bg-surface hover:border-surface-border-strong hover:bg-surface-hover'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                        <div
                                                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                                                isSelected
                                                                    ? 'bg-accent border-accent text-accent-foreground'
                                                                    : 'border-surface-border bg-surface'
                                                            }`}
                                                        >
                                                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                                                        </div>
                                                        <Avatar
                                                            src={avatarSrc}
                                                            alt={memberFullName}
                                                            size="sm"
                                                            className="shrink-0"
                                                        />
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-xs font-semibold text-text truncate">
                                                                {memberFullName}
                                                            </span>
                                                            <span className="text-[10px] text-text-muted truncate">
                                                                {member.universityId || member.email}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <Badge
                                                        variant={isSelected ? 'accent' : 'neutral'}
                                                        size="xs"
                                                        label={member.role}
                                                        className="shrink-0"
                                                    />
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* DISPATCH FOOTER */}
                                <div className="pt-2 border-t border-surface-border flex items-center justify-between gap-3 mt-auto">
                                    <span className="text-[11px] text-text-muted">
                                        {selectedPublishMemberIds.length} of {departmentMembers.length} available members selected
                                    </span>
                                    {selectedPublishMemberIds.length > 0 && (
                                        <span className="text-[11px] font-medium text-accent">
                                            Ready to confirm
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* RIGHT COLUMN: ACTIVE PUBLICATIONS LIST */}
                            <div className="md:col-span-5 flex flex-col gap-3.5 p-4 rounded-xl border border-surface-border bg-surface">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-xs font-bold text-text uppercase tracking-wider">
                                            Active Publications
                                        </h4>
                                        <p className="text-[11px] text-text-muted">
                                            Currently published access
                                        </p>
                                    </div>
                                    <Badge
                                        variant={activePublicationsForModalDoc.length > 0 ? 'accent' : 'neutral'}
                                        size="xs"
                                        label={`${activePublicationsForModalDoc.length} Published`}
                                        aria-label={`${activePublicationsForModalDoc.length} active faculty ${activePublicationsForModalDoc.length === 1 ? 'publication' : 'publications'}`}
                                    />
                                </div>

                                <div
                                    role="region"
                                    aria-label="Active faculty publications"
                                    className="flex-1 overflow-y-auto max-h-[360px] pr-1 space-y-2 min-h-[180px]"
                                >
                                    {activePublicationsForModalDoc.length === 0 ? (
                                        <div className="h-full min-h-[180px] flex flex-col items-center justify-center p-6 text-center rounded-lg border border-dashed border-surface-border bg-surface-hover/30 text-xs text-text-muted gap-2">
                                            <Globe className="h-6 w-6 text-text-muted/40" />
                                            <span className="font-semibold text-text">Not Published to Faculty</span>
                                            <span className="text-[11px] leading-relaxed max-w-xs">
                                                {Array.isArray(publishModalDocument)
                                                    ? 'The selected documents are not currently published to faculty members. Use the picker on the left to distribute to members.'
                                                    : `This ${publishModalDocument.isFolder ? 'folder' : 'document'} is not currently published to faculty members. Use the picker on the left to distribute to members.`}
                                            </span>
                                        </div>
                                    ) : (
                                        activePublicationsForModalDoc.map((pubItem) => {
                                            const isRevoking = unpublishingPublicationId === pubItem.id;
                                            const itemKey = pubItem.id || (pubItem.isBroadcast ? 'broadcast' : pubItem.recipientId);

                                            if (pubItem.isBroadcast) {
                                                return (
                                                    <div
                                                        key={itemKey}
                                                        className="p-3 rounded-lg border border-surface-border bg-surface-hover/50 hover:bg-surface-hover transition-colors flex items-start justify-between gap-2.5"
                                                    >
                                                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="font-semibold text-xs text-text truncate">
                                                                    Entire Department
                                                                </span>
                                                                <span className="text-[10px] text-text-muted font-mono">
                                                                    ({userDepartment})
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <Badge variant="success" size="xs" label="Broadcasting" />
                                                                {!Array.isArray(publishModalDocument) && publishModalDocument.isFolder && (
                                                                    <Badge variant="neutral" size="xs" label="Cascading" />
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] text-text-muted pt-0.5">
                                                                Published {formatDateTime(pubItem.updatedAt || pubItem.createdAt)}
                                                            </span>
                                                        </div>

                                                        <Button
                                                            variant="destructive"
                                                            size="xs"
                                                            leadingIcon={Trash2}
                                                            isLoading={isRevoking}
                                                            isDisabled={Boolean(unpublishingPublicationId)}
                                                            onClick={() => handleRevokePublicationClick(pubItem, 'department members')}
                                                            aria-label="Revoke broadcast publication"
                                                            className="shrink-0"
                                                        >
                                                            Revoke
                                                        </Button>
                                                    </div>
                                                );
                                            }

                                            const member = pubItem.recipient;
                                            const avatarSrc = resolveUserAvatar(member, currentUser);
                                            const memberFullName = `${member?.firstName || ''} ${member?.lastName || ''}`.trim() || 'Faculty Member';

                                            return (
                                                <div
                                                    key={itemKey}
                                                    className="p-3 rounded-lg border border-surface-border bg-surface-hover/50 hover:bg-surface-hover transition-colors flex items-start justify-between gap-2.5"
                                                >
                                                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <Avatar
                                                                src={avatarSrc}
                                                                alt={memberFullName}
                                                                size="xs"
                                                                className="shrink-0"
                                                            />
                                                            <span className="font-semibold text-xs text-text truncate">
                                                                {memberFullName}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <Badge variant="success" size="xs" label="Published" />
                                                            {!Array.isArray(publishModalDocument) && publishModalDocument.isFolder && (
                                                                <Badge variant="neutral" size="xs" label="Cascading" />
                                                            )}
                                                            {member?.role && (
                                                                <span className="text-[10px] text-text-muted font-mono">
                                                                    {member.role}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] text-text-muted pt-0.5">
                                                            Published {formatDateTime(pubItem.updatedAt || pubItem.createdAt)}
                                                        </span>
                                                    </div>

                                                    <Button
                                                        variant="destructive"
                                                        size="xs"
                                                        leadingIcon={Trash2}
                                                        isLoading={isRevoking}
                                                        isDisabled={Boolean(unpublishingPublicationId)}
                                                        onClick={() => handleRevokePublicationClick(pubItem, memberFullName)}
                                                        aria-label={`Revoke publication for ${memberFullName}`}
                                                        className="shrink-0"
                                                    >
                                                        Revoke
                                                    </Button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                <div className="pt-2 border-t border-surface-border text-[11px] text-text-muted flex items-center gap-1.5">
                                    <Globe className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                                    <span>Published items appear directly in faculty member dashboards.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ACTION CONFIRMATION MODAL */}
            {Boolean(confirmActionModal) && (
                <Modal
                    isOpen={Boolean(confirmActionModal)}
                    onClose={() => {
                        if (!isSubmittingAction) {
                            setConfirmActionModal(null);
                        }
                    }}
                    title={confirmActionModal.title}
                    description={confirmActionModal.message}
                    icon={confirmActionModal.icon || (confirmActionModal.actionKey === 'stash' ? Clock : (['restore', 'unshare'].includes(confirmActionModal.actionKey) ? RotateCcw : CheckCircle2))}
                    size={confirmActionModal?.actionKey === 'approve' && constants.isOfficerRole(currentUser?.role) ? 'md' : 'sm'}
                    confirmOnClose={false}
                    primaryAction={{
                        label: confirmActionModal.primaryLabel,
                        variant: confirmActionModal.variant || 'primary',
                        isLoading: isSubmittingAction,
                        isDisabled: isSubmittingAction,
                        onClick: handleConfirmAction,
                    }}
                    secondaryAction={{
                        label: 'Cancel',
                        isDisabled: isSubmittingAction,
                        onClick: () => setConfirmActionModal(null),
                    }}
                >
                    {confirmActionModal.actionKey === 'approve' && constants.isOfficerRole(currentUser?.role) ? (
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                                <span className="text-xs font-semibold text-text">
                                    Files to Approve ({stagedFilesForApproval.length})
                                </span>
                                {stagedFilesForApproval.map((file) => {
                                    const isPdf = isPdfFileItem(file, documentVersions);
                                    const isMandatory = Boolean(
                                        file.requiresSignature ||
                                        (documentService?.getLocalRequiresSignature && documentService.getLocalRequiresSignature(file.id)) ||
                                        file.share?.requiresSignature ||
                                        (documentShares || []).find((s) => cleanId(s.document?.id ?? s.documentId) === cleanId(file.id))?.requiresSignature
                                    );
                                    const isStampOn = isMandatory ? true : Boolean(stampSignatureMap[file.id]);

                                    return (
                                        <div
                                            key={file.id}
                                            className="flex items-center justify-between p-2.5 rounded-lg border border-surface-border bg-surface-hover/50 gap-2"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                <FileText className="w-4 h-4 text-accent shrink-0" />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs font-medium text-text truncate" title={file.name || file.title}>
                                                        {file.name || file.title}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        {isMandatory && (
                                                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded-full uppercase">
                                                                <Lock className="w-2.5 h-2.5" /> Mandatory Sign
                                                            </span>
                                                        )}
                                                        {!isPdf && (
                                                            <span className="text-[10px] text-text-muted">
                                                                Non-PDF
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {isPdf ? (
                                                <div className="flex items-center gap-2 shrink-0 select-none">
                                                    <span className="text-[11px] text-text-muted font-medium">Stamp:</span>
                                                    <button
                                                        type="button"
                                                        role="switch"
                                                        aria-checked={isStampOn}
                                                        disabled={isMandatory}
                                                        onClick={() => {
                                                            if (!isMandatory) {
                                                                setStampSignatureMap((prev) => ({
                                                                    ...prev,
                                                                    [file.id]: !isStampOn,
                                                                }));
                                                            }
                                                        }}
                                                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                                                            isStampOn ? 'bg-accent' : 'bg-surface-border'
                                                        } ${isMandatory ? 'opacity-85 cursor-not-allowed' : 'cursor-pointer'}`}
                                                        title={isMandatory ? 'Mandatory signature required by sender' : 'Toggle signature stamping'}
                                                    >
                                                        <span
                                                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                                                isStampOn ? 'translate-x-4' : 'translate-x-1'
                                                            }`}
                                                        />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span
                                                    className="text-[10px] font-medium text-text-muted px-2 py-0.5 rounded bg-surface border border-surface-border shrink-0 select-none"
                                                    title="Signature stamping is unavailable for non-PDF files"
                                                >
                                                    Unavailable
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="text-xs text-text-muted leading-relaxed">
                                {confirmActionModal.impact || 'Please confirm you wish to perform this action. The status will update immediately across departmental queues.'}
                            </div>
                        </div>
                    ) : (
                        <div className="text-xs text-text-muted leading-relaxed">
                            {confirmActionModal.impact || 'Please confirm you wish to perform this action. The status will update immediately across departmental queues.'}
                        </div>
                    )}
                </Modal>
            )}

            {/* OFFICER SIGNATURE STAMP MODAL */}
            {isOfficerStampModalOpen && (
                <OfficerSignatureStampModal
                    isOpen={isOfficerStampModalOpen}
                    onClose={() => {
                        if (!isSubmittingOfficerStamp) {
                            setIsOfficerStampModalOpen(false);
                            setOfficerStampModalQueue(null);
                        }
                    }}
                    queue={officerStampModalQueue}
                    currentUser={currentUser}
                    isSubmitting={isSubmittingOfficerStamp}
                    onConfirmApprove={handleOfficerStampConfirm}
                />
            )}

            {/* REJECTION FORM MODAL */}
            {Boolean(rejectionActionModal) && (
                <Modal
                    isOpen={Boolean(rejectionActionModal)}
                    onClose={() => {
                        if (!isSubmittingAction) {
                            setRejectionActionModal(null);
                            setRejectionReasonText('');
                        }
                    }}
                    title={Array.isArray(rejectionActionModal.item) ? `Reject Files (${rejectionActionModal.count})` : `Reject ${rejectionActionModal.item?.isFolder ? 'Folder' : 'Document'}`}
                    description={Array.isArray(rejectionActionModal.item) ? `Provide a reason for rejecting ${rejectionActionModal.count} selected files.` : `Provide a reason for rejecting "${rejectionActionModal.docTitle}". The item remains in your repository as Rejected.`}
                    icon={AlertTriangle}
                    size="md"
                    confirmOnClose={false}
                    primaryAction={{
                        label: 'Confirm Rejection',
                        variant: 'danger',
                        isLoading: isSubmittingAction,
                        isDisabled: isSubmittingAction || !rejectionReasonText.trim(),
                        onClick: handleConfirmRejection,
                    }}
                    secondaryAction={{
                        label: 'Cancel',
                        isDisabled: isSubmittingAction,
                        onClick: () => {
                            setRejectionActionModal(null);
                            setRejectionReasonText('');
                        },
                    }}
                >
                    <div className="flex flex-col gap-4">
                        <AreaField
                            label="Rejection Reason"
                            required
                            placeholder="Explain why this document is being rejected so the administrator can take corrective action..."
                            value={rejectionReasonText}
                            onChange={(e) => setRejectionReasonText(e.target.value)}
                            rows={4}
                        />
                        <p className="text-[11px] text-text-muted">
                            This reason will be recorded on the version audit log and shown to repository administrators.
                        </p>
                    </div>
                </Modal>
            )}
        </Container>
    );
};


// --- HELPERS ---
function getRecursiveFolderSizeBytes(folderId, docsList, versionsList) {
    let totalBytes = 0;
    const children = (docsList || []).filter((d) => (d.parentId ?? 'root') === folderId);
    for (const child of children) {
        if (child.isFolder) {
            totalBytes += getRecursiveFolderSizeBytes(child.id, docsList, versionsList);
        } else {
            const vers = (versionsList || []).filter(
                (v) => (v.document?.id ?? v.documentId) === child.id
            );
            const latestVer = vers.length > 0
                ? [...vers].sort((a, b) => b.version - a.version)[0]
                : null;
            totalBytes += Number(latestVer?.sizeBytes) || 0;
        }
    }
    return totalBytes;
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) {
        return '0 KB';
    }

    const kilobyte = 1024;
    const megabyte = kilobyte * 1024;

    if (bytes >= megabyte) {
        return `${(bytes / megabyte).toFixed(1)} MB`;
    }

    return `${Math.max(1, Math.round(bytes / kilobyte))} KB`;
}

async function readAllEntriesFromDirectoryReader(directoryReader) {
    const entries = [];
    let shouldContinueReading = true;

    while (shouldContinueReading) {
        const batch = await new Promise((resolve) => {
            directoryReader.readEntries(
                (results) => resolve(results),
                () => resolve([])
            );
        });

        if (batch && batch.length > 0) {
            entries.push(...batch);
        } else {
            shouldContinueReading = false;
        }
    }

    return entries;
}

async function traverseFileSystemEntry(entry, currentPathPrefix, folderPathParts, userDepartment, targetParentId, collectedItems) {
    if (entry.isFile) {
        const file = await new Promise((resolve) => {
            entry.file(resolve, () => resolve(null));
        });
        if (!file) return;

        const fullRelativePath = currentPathPrefix ? `${currentPathPrefix}/${file.name}` : `/${file.name}`;
        const isImage = ocrService.isImageFile(file);

        collectedItems.push({
            id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            parentId: targetParentId,
            relativePath: fullRelativePath,
            fileName: file.name,
            folderPathParts: folderPathParts ? [...folderPathParts] : [],
            title: fullRelativePath,
            subtitle: `DOC-${new Date().getFullYear()}-DIR-${Math.floor(100 + Math.random() * 900)}`,
            description: null,
            category: isImage ? 'Image' : 'Document',
            classification: constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED,
            version: 'v1.0',
            size: formatFileSize(file.size),
            sizeBytes: file.size,
            status: constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL,
            date: 'Just now',
            isFolder: false,
            file: file,
            isImage: isImage,
            ocrMode: isImage ? 'ocr_pdf' : 'normal_image',
            tags: [constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL, constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED],
        });
    } else if (entry.isDirectory) {
        const newPrefix = currentPathPrefix ? `${currentPathPrefix}/${entry.name}` : `/${entry.name}`;
        const newParts = folderPathParts ? [...folderPathParts, entry.name] : [entry.name];

        const reader = entry.createReader();
        const subEntries = await readAllEntriesFromDirectoryReader(reader);

        if (subEntries.length === 0) {
            collectedItems.push({
                id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                parentId: targetParentId,
                relativePath: newPrefix,
                fileName: entry.name,
                folderPathParts: newParts,
                title: newPrefix,
                subtitle: `DIR-${new Date().getFullYear()}-${entry.name.slice(0, 3).toUpperCase()}`,
                description: null,
                category: 'Folder',
                classification: null,
                version: '—',
                size: 'Folder',
                sizeBytes: 0,
                status: constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL,
                date: 'Just now',
                isFolder: true,
                tags: ['Folder'],
            });
        } else {
            for (let subIndex = 0; subIndex < subEntries.length; subIndex++) {
                await traverseFileSystemEntry(
                    subEntries[subIndex],
                    newPrefix,
                    newParts,
                    userDepartment,
                    targetParentId,
                    collectedItems
                );
            }
        }
    }
}

function getUniqueFileName(originalFileName, targetParentId, existingDocs = [], stagedItems = [], currentItemId = null) {
    const trimmed = (originalFileName || '').trim();
    if (!trimmed) return trimmed;

    const isParentMatch = (p1, p2) => {
        const norm1 = (!p1 || p1 === 'root') ? null : p1;
        const norm2 = (!p2 || p2 === 'root') ? null : p2;
        return norm1 === norm2;
    };

    const lastDotIndex = trimmed.lastIndexOf('.');
    let rawBase = lastDotIndex > 0 ? trimmed.slice(0, lastDotIndex) : trimmed;
    const ext = lastDotIndex > 0 ? trimmed.slice(lastDotIndex) : '';

    const match = rawBase.match(/^(.*?)\s*\((\d+)\)$/);
    const baseName = match ? match[1].trim() : rawBase;
    let index = match ? parseInt(match[2], 10) : 0;

    const isTaken = (name) => {
        const inDocs = (existingDocs || []).some(
            (d) => !d.isFolder &&
                   !d.isArchived &&
                   isParentMatch(d.parentId, targetParentId) &&
                   (d.name || d.title || '').toLowerCase() === name.toLowerCase()
        );
        if (inDocs) return true;
        const inStaged = (stagedItems || []).some(
            (s) => s.id !== currentItemId &&
                   isParentMatch(s.parentId, targetParentId) &&
                   (s.fileName || s.title || '').toLowerCase() === name.toLowerCase()
        );
        return inStaged;
    };

    // Since this is invoked when resolving conflict, start suffix at least at 1
    if (index === 0) index = 1;
    while (isTaken(`${baseName} (${index})${ext}`)) {
        index++;
    }
    return `${baseName} (${index})${ext}`;
}

function getUniqueFolderName(originalName, targetParentId, existingDocs = []) {
    const trimmed = (originalName || '').trim();
    if (!trimmed) return trimmed;

    const isParentMatch = (p1, p2) => {
        const norm1 = (!p1 || p1 === 'root') ? null : p1;
        const norm2 = (!p2 || p2 === 'root') ? null : p2;
        return norm1 === norm2;
    };

    const match = trimmed.match(/^(.*?)\s*\((\d+)\)$/);
    const baseName = match ? match[1].trim() : trimmed;
    let index = match ? parseInt(match[2], 10) : 0;

    const isTaken = (name) => (existingDocs || []).some(
        (d) => d.isFolder &&
               !d.isArchived &&
               isParentMatch(d.parentId, targetParentId) &&
               (d.name || d.title || '').toLowerCase() === name.toLowerCase()
    );

    let candidate = trimmed;
    if (isTaken(candidate)) {
        if (index === 0) index = 1;
        while (isTaken(`${baseName} (${index})`)) {
            index++;
        }
        candidate = `${baseName} (${index})`;
    }
    return candidate;
}

function annotateDuplicates(extractedList, targetParentId, existingDocs, existingVersions) {
    const activeParent = targetParentId === 'root' ? null : targetParentId;
    return extractedList.map((item) => {
        const isImage = item.isImage ?? ocrService.isImageFile(item.file || item.fileName);
        const ocrMode = item.ocrMode || (isImage ? 'ocr_pdf' : 'normal_image');

        let resolvedParentId = activeParent;
        if (item.folderPathParts && item.folderPathParts.length > 0) {
            let currentP = activeParent;
            let pathExists = true;
            for (const folderName of item.folderPathParts) {
                const folderDoc = (existingDocs || []).find(
                    (d) => d.isFolder && !d.isArchived && (d.parentId ?? null) === currentP && d.name.toLowerCase() === folderName.toLowerCase()
                );
                if (folderDoc) {
                    currentP = folderDoc.id;
                } else {
                    pathExists = false;
                    break;
                }
            }
            if (pathExists) {
                resolvedParentId = currentP;
            } else {
                resolvedParentId = 'will-create-folder';
            }
        }

        if (resolvedParentId !== 'will-create-folder') {
            const rawItemName = (item.fileName || item.title || '').trim();
            const cleanItemName = stripFileExtension(rawItemName);
            const matchingDoc = (existingDocs || []).find(
                (d) => !d.isFolder &&
                !d.isArchived &&
                (d.parentId ?? null) === resolvedParentId &&
                (
                    d.name.toLowerCase() === cleanItemName.toLowerCase() ||
                    d.name.toLowerCase() === rawItemName.toLowerCase()
                )
            );

            if (matchingDoc) {
                const docVersions = (existingVersions || []).filter(
                    (v) => (v.document?.id ?? v.documentId) === matchingDoc.id
                );
                const currentVer = docVersions.length > 0
                    ? Math.max(...docVersions.map((v) => v.version || 1))
                    : 1;

                return {
                    ...item,
                    isImage,
                    ocrMode,
                    isDuplicate: true,
                    existingDocumentId: matchingDoc.id,
                    currentVersion: currentVer,
                    nextVersion: currentVer + 1,
                    action: 'unresolved',
                    resolved: false,
                };
            }
        }

        return {
            ...item,
            isImage,
            ocrMode,
            isDuplicate: false,
            action: 'new',
            resolved: true,
        };
    });
}

async function processDataTransferPayload(dataTransfer, targetParentId, userDepartment) {
    const collectedItems = [];

    if (dataTransfer?.items && dataTransfer.items.length > 0) {
        const itemEntries = [];

        for (let itemIndex = 0; itemIndex < dataTransfer.items.length; itemIndex++) {
            const transferItem = dataTransfer.items[itemIndex];
            if (typeof transferItem.webkitGetAsEntry === 'function') {
                const entry = transferItem.webkitGetAsEntry();
                if (entry) {
                    itemEntries.push(entry);
                }
            }
        }

        if (itemEntries.length > 0) {
            for (let entryIndex = 0; entryIndex < itemEntries.length; entryIndex++) {
                await traverseFileSystemEntry(
                    itemEntries[entryIndex],
                    '',
                    [],
                    userDepartment,
                    targetParentId,
                    collectedItems
                );
            }
        } else {
            for (let fileIndex = 0; fileIndex < dataTransfer.files.length; fileIndex++) {
                const rawFile = dataTransfer.files[fileIndex];
                if (rawFile) {
                    const isImage = ocrService.isImageFile(rawFile);
                    collectedItems.push({
                        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        parentId: targetParentId,
                        relativePath: `/${rawFile.name}`,
                        fileName: rawFile.name,
                        folderPathParts: [],
                        title: `/${rawFile.name}`,
                        subtitle: `DOC-${new Date().getFullYear()}-GEN-${Math.floor(100 + Math.random() * 900)}`,
                        description: null,
                        category: isImage ? 'Image' : 'Document',
                        classification: constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED,
                        version: 'v1.0',
                        size: formatFileSize(rawFile.size),
                        sizeBytes: rawFile.size,
                        status: constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL,
                        date: 'Just now',
                        isFolder: false,
                        file: rawFile,
                        isImage: isImage,
                        ocrMode: isImage ? 'ocr_pdf' : 'normal_image',
                        tags: [constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL, constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED],
                    });
                }
            }
        }
    } else if (dataTransfer?.files && dataTransfer.files.length > 0) {
        for (let fileIndex = 0; fileIndex < dataTransfer.files.length; fileIndex++) {
            const rawFile = dataTransfer.files[fileIndex];
            const isImage = ocrService.isImageFile(rawFile);
            collectedItems.push({
                id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                parentId: targetParentId,
                relativePath: `/${rawFile.name}`,
                fileName: rawFile.name,
                folderPathParts: [],
                title: `/${rawFile.name}`,
                subtitle: `DOC-${new Date().getFullYear()}-GEN-${Math.floor(100 + Math.random() * 900)}`,
                description: null,
                category: isImage ? 'Image' : 'Document',
                classification: constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED,
                version: 'v1.0',
                size: formatFileSize(rawFile.size),
                sizeBytes: rawFile.size,
                status: constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL,
                date: 'Just now',
                isFolder: false,
                file: rawFile,
                isImage: isImage,
                ocrMode: isImage ? 'ocr_pdf' : 'normal_image',
                tags: [constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL, constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED],
            });
        }
    }

    return collectedItems;
}


// --- EXPORTS ---
export { DocumentsPage };
export default DocumentsPage;
