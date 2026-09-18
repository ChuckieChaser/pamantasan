// --- IMPORTS ---
import { useState, useMemo, useRef, useEffect } from 'react';
import {
    Plus,
    UploadCloud,
    FolderPlus,
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
    Building2,
    FileCheck,
    Sparkles,
    Trash2,
    Share2,
    RotateCcw,
    XCircle,
    Search,
    Users,
    UserCheck,
    Send,
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
    Avatar,
    resolveUserAvatar,
    formatDateTime,
    getMimeTypeFromFilename,
} from '../components';
import { useToast, useAuth } from '../hooks';
import { constants } from '../constants';
import {
    useDocumentStore,
    useDepartmentStore,
    useUserStore,
    useCoordinatorStore,
    useAuthStore,
    useAuditStore,
} from '../stores';
import {
    storageService,
    documentService,
    aiService,
    coordinatorApprovalService,
    systemEventService,
} from '../services';


// --- CONFIGURATIONS ---
const DOCUMENT_COLUMNS = [
    { key: 'title', label: 'Name' },
    { key: 'classification', label: 'Classification' },
    { key: 'version', label: 'Version' },
    { key: 'size', label: 'Size' },
    { key: 'date', label: 'Last Modified' },
];

const ARCHIVE_DOCUMENT_COLUMNS = [
    { key: 'title', label: 'Name' },
    { key: 'originalLocation', label: 'Original Location' },
    { key: 'classification', label: 'Classification' },
    { key: 'version', label: 'Version' },
    { key: 'size', label: 'Size' },
    { key: 'date', label: 'Archived / Modified' },
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


// --- COMPONENTS ---
const DocumentsPage = ({
    currentUser: propUser = null,
    onUploadDocument = null,
    onSelectDocument,
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

    // STATES: STAGED ITEMS & FORMS
    const [stagedDroppedItems, setStagedDroppedItems] = useState([]);
    const [conflictModalItem, setConflictModalItem] = useState(null);
    const [fileError, setFileError] = useState('');
    const [folderTitle, setFolderTitle] = useState('');
    const [folderDescription, setFolderDescription] = useState('');
    const [folderError, setFolderError] = useState('');
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);

    // STATES: ARCHIVE CONFIRMATION & RESTORE GUARD
    const [archivingItem, setArchivingItem] = useState(null);
    const [isArchivingItem, setIsArchivingItem] = useState(false);
    const [restoreConflictModalItem, setRestoreConflictModalItem] = useState(null);

    // STATES: DELETE CONFIRMATION
    const [deletingItem, setDeletingItem] = useState(null);
    const [isDeletingItemLoading, setIsDeletingItemLoading] = useState(false);

    // STATES: EDIT MODAL
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [editFormName, setEditFormName] = useState('');
    const [editFormSummary, setEditFormSummary] = useState('');
    const [editFormClassification, setEditFormClassification] = useState(constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED);
    const [editFormComment, setEditFormComment] = useState('');
    const [editFormErrors, setEditFormErrors] = useState({});
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [isGeneratingAiSummary, setIsGeneratingAiSummary] = useState(false);

    // STATES: SHARE MODAL
    const [selectedShareDepartmentIds, setSelectedShareDepartmentIds] = useState([]);
    const [departmentSearchQuery, setDepartmentSearchQuery] = useState('');
    const [isSharingDepartment, setIsSharingDepartment] = useState(false);
    const [unsharingShareId, setUnsharingShareId] = useState(null);

    // STATES: PUBLISH TO MEMBERS MODAL
    const [publishMode, setPublishMode] = useState('all'); // 'all' | 'specific'
    const [selectedPublishMemberIds, setSelectedPublishMemberIds] = useState([]);
    const [memberSearchQuery, setMemberSearchQuery] = useState('');
    const [isPublishingMembers, setIsPublishingMembers] = useState(false);

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
    }, [currentUser, departments?.length, syncAllDocumentShares]);

    useEffect(() => {
        if (publishModalDocument) {
            const existingSpecific = (documentShares || []).filter(
                (s) =>
                    (s.document?.id ?? s.documentId) === publishModalDocument.id &&
                    (s.department?.id ?? s.departmentId) === currentUser?.departmentId &&
                    (s.recipient?.id ?? s.recipientId)
            );
            if (existingSpecific.length > 0) {
                setPublishMode('specific');
                const validMemberIds = (users || [])
                    .filter((u) => u.departmentId === currentUser?.departmentId && constants.isMemberRole(u.role))
                    .map((u) => u.id);
                setSelectedPublishMemberIds(
                    existingSpecific
                        .map((s) => s.recipient?.id ?? s.recipientId)
                        .filter((id) => Boolean(id) && validMemberIds.includes(id))
                );
            } else {
                setPublishMode('all');
                setSelectedPublishMemberIds([]);
            }
            setMemberSearchQuery('');
        }
    }, [publishModalDocument, documentShares, currentUser, users]);

    // HANDLERS
    const handleBreadcrumbClick = (breadcrumbItem, breadcrumbIndex) => {
        setCurrentFolderId(breadcrumbItem.id);
        setBreadcrumbsList((previousBreadcrumbs) =>
            previousBreadcrumbs.slice(0, breadcrumbIndex + 1),
        );
        setSelectedDocument(null);
        onSelectDocument?.(null);
    };

    const handleItemSelect = (item) => {
        setSelectedDocument(item);
        onSelectDocument?.(item);
    };

    const handleItemDoubleClick = (item) => {
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
    };

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
    }, [documents, handleItemDoubleClick]);

    // LISTEN FOR EXTERNAL ARCHIVE TRIGGER (E.G. FROM INSPECTOR QUICK ACTION)
    useEffect(() => {
        const handleArchiveDocEvent = (event) => {
            if (event.detail) {
                const targetDoc = documents.find((d) => d?.id === event.detail.id) ?? event.detail;
                setArchivingItem(targetDoc);
            }
        };
        window.addEventListener('pamantasan:archive-document', handleArchiveDocEvent);
        return () => window.removeEventListener('pamantasan:archive-document', handleArchiveDocEvent);
    }, [documents]);

    useEffect(() => {
        if (isCreateModalOpen) {
            setIsPageDragActive(false);
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

                showToast({
                    type: 'information',
                    title: 'Synthesizing Folder Overview',
                    description: `Analyzing ${childDocs.length} items in "${editFormName || editItem.name}" with Vertex AI...`,
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
                        title: 'AI Summary Synthesized',
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

                if (path) {
                    showToast({
                        type: 'information',
                        title: 'Analyzing Document with AI',
                        description: `Reading content of "${editFormName || editItem.name}" via Vertex AI Gemini Flash...`,
                    });

                    const res = await aiService.analyzeDocumentFile({
                        storagePath: path,
                        mimeType: latestVer?.mimeType || 'application/octet-stream',
                        fileName: editFormName.trim() || editItem.name || 'document',
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
                        title: 'AI Analysis Complete',
                        description: `Summary and classification updated (${res?.classification || 'Analyzed'}).`,
                    });
                } else {
                    const cleanedName = editFormName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
                    const generated = `Institutional documentation and operational records pertaining to ${cleanedName}.`;
                    setEditFormSummary(generated);
                    if (editFormErrors.summary) {
                        setEditFormErrors((prev) => ({ ...prev, summary: '' }));
                    }
                    showToast({
                        type: 'information',
                        title: 'AI Summary Generated',
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
        const vers = (documentVersions || []).filter(
            (v) => (v.document?.id ?? v.documentId) === editItem.id
        );
        const latestVer = vers.length > 0
            ? [...vers].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0]
            : null;
        const path = latestVer?.path || editItem.path;

        if (path) {
            showToast({
                type: 'information',
                title: 'Classifying Document',
                description: 'Evaluating sensitivity level with Vertex AI...',
            });
            try {
                const res = await aiService.analyzeDocumentFile({
                    storagePath: path,
                    mimeType: latestVer?.mimeType || 'application/octet-stream',
                    fileName: editFormName.trim() || editItem.name || 'document',
                    fileSize: latestVer?.sizeBytes || 0,
                });
                if (res?.classification && res.classification !== 'UNCLASSIFIED') {
                    setEditFormClassification(res.classification);
                    if (editFormErrors.classification) {
                        setEditFormErrors((prev) => ({ ...prev, classification: '' }));
                    }
                    showToast({
                        type: 'success',
                        title: 'AI Classified',
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
            type: 'information',
            title: 'AI Classification',
            description: `Classified as ${suggested} based on document content keywords.`,
        });
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

        setIsSavingEdit(true);
        try {
            if (isCoordinator) {
                const docPayload = {
                    documentId: editItem.id,
                    documentTitle: editFormName.trim(),
                    isFolder: Boolean(editItem.isFolder),
                    new: {
                        name: editFormName.trim(),
                        comment: editFormComment.trim() || null,
                        summary: editItem.isFolder ? null : (editFormSummary.trim() || null),
                        classification: editItem.isFolder ? null : editFormClassification,
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
                    description: `Edit request for "${editFormName.trim()}" sent for Administrator approval.`,
                });
                setIsEditModalOpen(false);
                return;
            }

            await useDocumentStore.getState().updateDocument(editItem.id, {
                name: editFormName.trim(),
                comment: editFormComment.trim() || null,
            });

            let updatedMimeType = editItem.mimeType;
            if (!editItem.isFolder) {
                const vers = (documentVersions || []).filter(
                    (v) => (v.document?.id ?? v.documentId) === editItem.id
                );
                const latestVer = vers.length > 0
                    ? [...vers].sort((a, b) => b.version - a.version)[0]
                    : null;
                if (latestVer) {
                    const derivedMimeType = getMimeTypeFromFilename(editFormName.trim());
                    updatedMimeType = derivedMimeType;
                    await useDocumentStore.getState().updateDocumentVersion(latestVer.id, {
                        summary: editFormSummary.trim() || null,
                        classification: editFormClassification,
                        changeSummary: 'Updated metadata via editor',
                        ...(derivedMimeType ? { mimeType: derivedMimeType } : {}),
                    });
                }
            }

            await fetchDocuments();

            const timestamp = new Date().toISOString();
            const updatedSelected = {
                ...editItem,
                name: editFormName.trim(),
                title: editFormName.trim(),
                comment: editFormComment.trim() || null,
                description: editItem.isFolder ? (editFormComment.trim() || null) : (editFormSummary.trim() || null),
                summary: editItem.isFolder ? null : (editFormSummary.trim() || null),
                classification: editItem.isFolder ? '—' : editFormClassification,
                mimeType: editItem.isFolder ? undefined : updatedMimeType,
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
                description: `Changes to "${editFormName.trim()}" have been saved.`,
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

    const handleItemAction = async (actionKey, item) => {
        if (!item) {
            return;
        }

        if (actionKey === 'open' || actionKey === 'open_folder') {
            handleItemDoubleClick(item);
            return;
        }

        if (actionKey === 'share') {
            setShareModalDocument(item);
            return;
        }

        if (actionKey === 'publish') {
            setPublishModalDocument(item);
            return;
        }

        if (['approve', 'unapprove', 'reject', 'unpublish', 'stash', 'unstash', 'unshare'].includes(actionKey)) {
            let shareRecord = item.share;
            if (!shareRecord) {
                if (actionKey === 'unshare' && (item.departmentId || item.department)) {
                    shareRecord = item;
                } else if (currentUser?.departmentId) {
                    shareRecord = (documentShares || []).find(
                        (s) =>
                            (s.document?.id ?? s.documentId) === item.id &&
                            (s.department?.id ?? s.departmentId) === currentUser.departmentId
                    );
                } else {
                    shareRecord = (documentShares || []).find((s) => (s.document?.id ?? s.documentId) === item.id);
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
            try {
                if (actionKey === 'approve') {
                    if (item.isFolder && deptId) {
                        await updateShareStatusRecursive(item.id, deptId, constants.DOCUMENT_SHARES_STATUS.APPROVED);
                    } else {
                        await approveShare(shareId);
                    }
                    showToast({
                        type: 'success',
                        title: item.isFolder ? 'Folder Approved' : 'Document Approved',
                        description: `Approved "${docTitle}" for department director review.`,
                    });
                } else if (actionKey === 'unapprove') {
                    if (item.isFolder && deptId) {
                        await updateShareStatusRecursive(item.id, deptId, constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL);
                    } else {
                        await unapproveShare(shareId);
                    }
                    showToast({
                        type: 'information',
                        title: 'Approval Revoked',
                        description: `Reverted "${docTitle}" to pending approval.`,
                    });
                } else if (actionKey === 'reject') {
                    if (item.isFolder && deptId) {
                        await unshareDocumentRecursive(item.id, deptId);
                    } else {
                        await rejectShare(shareId);
                    }
                    showToast({
                        type: 'warning',
                        title: item.isFolder ? 'Folder Rejected' : 'Document Rejected',
                        description: `Rejected "${docTitle}" and removed from department view.`,
                    });
                    if (selectedDocument?.id === item.id) {
                        setSelectedDocument(null);
                        onSelectDocument?.(null);
                    }
                } else if (actionKey === 'publish') {
                    if (item.isFolder && deptId) {
                        await updateShareStatusRecursive(item.id, deptId, constants.DOCUMENT_SHARES_STATUS.PUBLISHED);
                    } else {
                        await publishShare(shareId);
                    }
                    showToast({
                        type: 'success',
                        title: item.isFolder ? 'Folder Published' : 'Document Published',
                        description: `Published "${docTitle}" to all department members.`,
                    });
                } else if (actionKey === 'unpublish') {
                    if (item.isFolder && deptId) {
                        await updateShareStatusRecursive(item.id, deptId, constants.DOCUMENT_SHARES_STATUS.APPROVED);
                    } else {
                        await unpublishShare(shareId);
                    }
                    showToast({
                        type: 'information',
                        title: item.isFolder ? 'Folder Unpublished' : 'Document Unpublished',
                        description: `Unpublished "${docTitle}" from department members.`,
                    });
                } else if (actionKey === 'stash') {
                    if (item.isFolder && deptId) {
                        await updateShareStatusRecursive(item.id, deptId, constants.DOCUMENT_SHARES_STATUS.STASHED);
                    } else {
                        await stashShare(shareId);
                    }
                    showToast({
                        type: 'information',
                        title: item.isFolder ? 'Folder Stashed' : 'Document Stashed',
                        description: `Stashed "${docTitle}" at upper management level.`,
                    });
                } else if (actionKey === 'unstash') {
                    if (item.isFolder && deptId) {
                        await updateShareStatusRecursive(item.id, deptId, constants.DOCUMENT_SHARES_STATUS.APPROVED);
                    } else {
                        await unstashShare(shareId);
                    }
                    showToast({
                        type: 'success',
                        title: item.isFolder ? 'Folder Unstashed' : 'Document Unstashed',
                        description: `Restored "${docTitle}" to approved state.`,
                    });
                } else if (actionKey === 'unshare') {
                    if (item.isFolder && deptId) {
                        await unshareDocumentRecursive(item.id, deptId);
                    } else {
                        await unshareDocument(shareId);
                    }
                    showToast({
                        type: 'success',
                        title: 'Share Removed',
                        description: `Removed department share for "${docTitle}".`,
                    });
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

        if (['view_information', 'view_content', 'view_version', 'view_share'].includes(actionKey)) {
            const tabMap = {
                view_information: 'information',
                view_content: 'contents',
                view_version: 'versions',
                view_share: 'shares',
            };
            const targetTab = tabMap[actionKey] || 'information';
            const itemWithTab = { ...item, _targetTab: targetTab };
            setSelectedDocument(itemWithTab);
            onSelectDocument?.(itemWithTab);
            return;
        }

        if (actionKey === 'edit') {
            setEditItem(item);
            setEditFormName(item.name || item.title || '');
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
            const fileName = item.name || item.title || 'document';
            try {
                if (item.isFolder) {
                    await storageService.downloadFolder(
                        item,
                        documents,
                        documentVersions
                    );
                } else {
                    const vers = (documentVersions || []).filter(
                        (v) => (v.document?.id ?? v.documentId) === item.id
                    );
                    const latestVer = vers.length > 0
                        ? [...vers].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0]
                        : null;
                    const path = latestVer?.path || item.path || item.url || item.downloadUrl;
                    await storageService.downloadDocument(path, fileName);
                }
            } catch (err) {
                showToast({
                    type: 'error',
                    title: 'Download Failed',
                    description: err?.message || 'Could not download file.',
                });
            }
            return;
        }

        if (actionKey === 'approve') {
            setLocalCreatedItems((previousItems) =>
                previousItems.map((repositoryItem) => {
                    if (repositoryItem.id !== item.id) {
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
                title: 'Document Approved',
                description: `"${item.title || item.name}" has been approved for distribution.`,
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
            const allDocs = useDocumentStore.getState().documents || [];
            const targetParentId = item.parentId && item.parentId !== 'root' ? item.parentId : null;
            const parentDoc = targetParentId ? allDocs.find((d) => d.id === targetParentId) : null;

            // CHILD RESTORE GUARD: If original parent folder is currently archived, block and prompt
            if (parentDoc && parentDoc.isArchived) {
                setRestoreConflictModalItem({ item, parentFolder: parentDoc });
                return;
            }

            await performRestoreItem(item);
            return;
        }

        if (actionKey === 'delete') {
            setDeletingItem(item);
            return;
        }
    };

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
        if (!archivingItem?.id) {
            return;
        }
        setIsArchivingItem(true);
        try {
            if (isCoordinator) {
                const archivePayload = {
                    documentId: archivingItem.id,
                    documentTitle: archivingItem.title || archivingItem.name,
                    isArchived: true,
                    isFolder: Boolean(archivingItem.isFolder),
                };

                const requesterId = currentUser?.id ?? useAuthStore.getState().currentUser?.id;
                await coordinatorApprovalService.submitCoordinatorRequest({
                    action: constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_ARCHIVE,
                    requesterId,
                    data: archivePayload,
                });
                useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});

                showToast({
                    type: 'success',
                    title: 'Request Submitted',
                    description: `Archive request for "${archivingItem.title || archivingItem.name}" sent for Administrator approval.`,
                });
                setArchivingItem(null);
                return;
            }

            await useDocumentStore.getState().archiveDocument(archivingItem.id, true);
            setLocalCreatedItems((previousItems) =>
                previousItems.map((repositoryItem) => {
                    if (repositoryItem.id !== archivingItem.id) {
                        return repositoryItem;
                    }
                    return {
                        ...repositoryItem,
                        isArchived: true,
                        directlyArchived: true,
                    };
                })
            );
            if (selectedDocument?.id === archivingItem.id) {
                const updated = { ...selectedDocument, isArchived: true, directlyArchived: true };
                setSelectedDocument(updated);
                onSelectDocument?.(updated);
            }
            showToast({
                type: 'success',
                title: archivingItem.isFolder ? 'Folder Archived' : 'Document Archived',
                description: `"${archivingItem.title || archivingItem.name}" moved to archives.`,
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

    const handleConfirmDeleteItem = async () => {
        if (!deletingItem?.id) {
            return;
        }
        setIsDeletingItemLoading(true);
        try {
            if (isCoordinator) {
                const deletePayload = {
                    documentId: deletingItem.id,
                    documentTitle: deletingItem.title || deletingItem.name,
                    isFolder: Boolean(deletingItem.isFolder),
                };

                const requesterId = currentUser?.id ?? useAuthStore.getState().currentUser?.id;
                await coordinatorApprovalService.submitCoordinatorRequest({
                    action: constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_DELETE,
                    requesterId,
                    data: deletePayload,
                });
                useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});

                showToast({
                    type: 'success',
                    title: 'Request Submitted',
                    description: `Delete request for "${deletingItem.title || deletingItem.name}" sent for Administrator approval.`,
                });
                setDeletingItem(null);
                return;
            }

            await useDocumentStore.getState().deleteDocument(deletingItem.id);
            setLocalCreatedItems((previousItems) =>
                previousItems.filter((repositoryItem) => repositoryItem.id !== deletingItem.id)
            );
            if (selectedDocument?.id === deletingItem.id) {
                setSelectedDocument(null);
                onSelectDocument?.(null);
            }
            showToast({
                type: 'success',
                title: deletingItem.isFolder ? 'Folder Deleted' : 'Document Deleted',
                description: `"${deletingItem.title || deletingItem.name}" removed from repository.`,
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

                toastProcess.updateItem(item.id, {
                    progress: 15,
                    statusText: 'Resolving folder location...',
                });

                // 1. Resolve exact target parent folder ID from precomputed map
                let targetParentId = rootTargetId;
                if (item.folderPathParts && item.folderPathParts.length > 0) {
                    const itemDirPath = item.folderPathParts.join('/');
                    targetParentId = folderPathToIdMap.get(itemDirPath) ?? rootTargetId;
                }

                const finalFileName = item.fileName || item.file?.name || (item.title ? item.title.split('/').pop() : 'document');

                // 2. Check if creating new version or new document
                let targetDocumentId = item.action === 'create_new' ? null : item.existingDocumentId;

                if (!targetDocumentId && activeUserId && item.action !== 'create_new') {
                    const existingDoc = knownDocs.find(
                        (d) => !d.isFolder && (d.parentId ?? null) === targetParentId && !d.isArchived && d.name.toLowerCase() === finalFileName.toLowerCase()
                    );
                    if (existingDoc) {
                        targetDocumentId = existingDoc.id;
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
                        aiResult = await aiService.analyzeDocumentFile({
                            storagePath: storageResult.path,
                            mimeType: storageResult.mimeType || item.file.type || getMimeTypeFromFilename(finalFileName),
                            fileName: finalFileName,
                            fileSize: storageResult.sizeBytes || item.file.size || 0,
                            isVersionUpdate: true,
                            previousStoragePath: latestPriorVer?.path || null,
                            previousMimeType: latestPriorVer?.mimeType || null,
                            nextVersion: nextVersionNum,
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
                            summary: aiResult?.summary || null,
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
                                title: finalFileName,
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
                            name: finalFileName,
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
                        aiResult = await aiService.analyzeDocumentFile({
                            storagePath: storageResult.path,
                            mimeType: storageResult.mimeType || item.file.type || getMimeTypeFromFilename(finalFileName),
                            fileName: finalFileName,
                            fileSize: storageResult.sizeBytes || item.file.size || 0,
                            isVersionUpdate: false,
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
                                summary: aiResult?.summary || null,
                                embedding: aiResult?.embedding || null,
                            });

                            useAuditStore.getState().insertAuditLog({
                                actorId: activeUserId,
                                entityType: constants.AUDIT_LOGS_ENTITY_TYPE.DOCUMENT,
                                entityId: String(targetDocumentId),
                                action: constants.AUDIT_LOGS_ACTION.UPLOADED,
                                data: JSON.stringify({
                                    title: finalFileName,
                                    version: 1,
                                    isVersionUpdate: false,
                                    isFolder: false,
                                    location: currentDirectoryLabel,
                                }),
                                createdAt: new Date().toISOString(),
                            }).catch(() => {});
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

        await fetchDocuments().catch(() => {});
        toastProcess.complete();

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

        const fallbackExtractedItems = selectedFiles.map((file) => ({
            id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            parentId: currentFolderId,
            relativePath: `/${file.name}`,
            fileName: file.name,
            folderPathParts: [],
            title: `/${file.name}`,
            subtitle: `DOC-${new Date().getFullYear()}-GEN-${Math.floor(100 + Math.random() * 900)}`,
            description: null,
            category: 'Document',
            classification: constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED,
            version: 'v1.0',
            size: formatFileSize(file.size),
            sizeBytes: file.size,
            status: constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL,
            date: 'Just now',
            isFolder: false,
            file: file,
            tags: [constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL, constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED],
        }));

        const annotated = annotateDuplicates(fallbackExtractedItems, currentFolderId, documents, documentVersions);
        setStagedDroppedItems((previousItems) => [...previousItems, ...annotated]);
        setFileError('');
        if (event.target) {
            event.target.value = '';
        }
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
                await fetchDocuments();
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

    // DERIVED VALUES
    const userDepartment = currentUser?.department ?? 'General Repository';
    const userRole = currentUser?.role ?? constants.USERS_ROLE.MEMBER;
    const isStaff = constants.isStaffRole(userRole);
    const isOfficer = constants.isOfficerRole(userRole);
    const isDirector = constants.isDirectorRole(userRole);
    const isMember = constants.isMemberRole(userRole);
    const canUpload = isStaff;

    // ACTIVE SHARES AND OPTIONS FOR SHARE MODAL
    const activeSharesForModalDoc = useMemo(() => {
        if (!shareModalDocument) return [];
        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
        const modalClean = cleanId(shareModalDocument.id);
        return (documentShares || []).filter(
            (s) => cleanId(s.document?.id ?? s.documentId) === modalClean
        );
    }, [shareModalDocument, documentShares]);

    const availableDepartmentsToShare = useMemo(() => {
        if (!shareModalDocument) return [];
        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
        const sharedDeptIds = new Set(
            activeSharesForModalDoc.map((s) => cleanId(s.department?.id ?? s.departmentId))
        );
        return (departments || []).filter((d) => !sharedDeptIds.has(cleanId(d.id)));
    }, [departments, activeSharesForModalDoc, shareModalDocument]);

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
            const isFolder = Boolean(shareModalDocument.isFolder);
            const targetCount = selectedShareDepartmentIds.length;
            const docTitle = shareModalDocument.title || shareModalDocument.name || 'document';

            if (isCoordinator) {
                const sharePayload = {
                    documentId: shareModalDocument.id,
                    documentTitle: docTitle,
                    departmentIds: selectedShareDepartmentIds,
                    isRecursive: isFolder,
                };

                const requesterId = currentUser?.id ?? useAuthStore.getState().currentUser?.id;
                await coordinatorApprovalService.submitCoordinatorRequest({
                    action: constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_SHARE,
                    requesterId,
                    data: sharePayload,
                });
                useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});

                showToast({
                    type: 'success',
                    title: 'Request Submitted',
                    description: `Share request for "${docTitle}" sent for Administrator approval.`,
                });

                setSelectedShareDepartmentIds([]);
                setDepartmentSearchQuery('');
                setShareModalDocument(null);
                return;
            }

            if (isFolder) {
                await shareDocumentRecursive(
                    shareModalDocument.id,
                    selectedShareDepartmentIds,
                    currentUser.id
                );
                showToast({
                    type: 'success',
                    title: 'Folder Shared with Cascade',
                    description: `Folder "${docTitle}" and all nested contents shared with ${targetCount} department${targetCount > 1 ? 's' : ''}. Status set to Pending Approval.`,
                });
            } else {
                await Promise.all(
                    selectedShareDepartmentIds.map((deptId) =>
                        shareDocument(shareModalDocument.id, deptId, currentUser.id)
                    )
                );
                showToast({
                    type: 'success',
                    title: 'Document Shared',
                    description: `Shared "${docTitle}" with ${targetCount} department${targetCount > 1 ? 's' : ''}. Status set to Pending Approval.`,
                });
            }

            setSelectedShareDepartmentIds([]);
            setDepartmentSearchQuery('');
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
                    title: 'Share Removed',
                    description: `Removed "${docTitle}" and all nested contents from ${departmentName || 'department'}.`,
                });
            } else if (shareId) {
                await unshareDocument(shareId);
                showToast({
                    type: 'success',
                    title: 'Share Removed',
                    description: `Removed share for ${departmentName || 'department'}.`,
                });
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

    // HANDLERS: PUBLISH TO MEMBERS MODAL
    const departmentMembers = useMemo(() => {
        if (!currentUser?.departmentId) return [];
        return (users || []).filter(
            (u) =>
                u.departmentId === currentUser.departmentId &&
                u.id !== currentUser.id &&
                u.status !== constants.USERS_STATUS.SUSPENDED &&
                constants.isMemberRole(u.role)
        );
    }, [users, currentUser]);

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

    const handlePublishSubmit = async () => {
        if (!publishModalDocument || !currentUser?.departmentId) return;

        setIsPublishingMembers(true);
        const docTitle = publishModalDocument.title || publishModalDocument.name || 'document';
        const isFolder = Boolean(publishModalDocument.isFolder);
        const targetIds = publishMode === 'all' ? [] : selectedPublishMemberIds;

        try {
            await publishDocumentToMembers(
                publishModalDocument.id,
                currentUser.departmentId,
                targetIds,
                currentUser.id
            );

            showToast({
                type: 'success',
                title: isFolder ? 'Folder Published' : 'Document Published',
                description:
                    publishMode === 'all'
                        ? `Published "${docTitle}" to all members in ${userDepartment}.`
                        : `Published "${docTitle}" to ${targetIds.length} selected member${targetIds.length === 1 ? '' : 's'}.`,
            });
            setPublishModalDocument(null);
            setSelectedPublishMemberIds([]);
            setMemberSearchQuery('');
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

    const repositoryItems = useMemo(() => {
        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
        const userDeptClean = cleanId(currentUser?.departmentId || currentUser?.department?.id);

        // 1. Identify accessible documents and folders and their resolved share status
        const accessibleItemMap = new Map(); // docId -> { status, share, shares }
        const setAccessibleItem = (id, meta) => {
            accessibleItemMap.set(id, meta);
            const cId = cleanId(id);
            if (cId) accessibleItemMap.set(cId, meta);
        };

        documents.forEach((doc) => {
            const docClean = cleanId(doc.id);
            const docShares = (documentShares || []).filter(
                (s) => cleanId(s.document?.id ?? s.documentId) === docClean
            );

            if (isStaff) {
                // Admin and Coord see everything
                let resolvedStatus = '—';
                if (docShares.length > 0) {
                    if (docShares.some((s) => s.status === constants.DOCUMENT_SHARES_STATUS.PUBLISHED)) {
                        resolvedStatus = constants.DOCUMENT_SHARES_STATUS.PUBLISHED;
                    } else if (docShares.some((s) => s.status === constants.DOCUMENT_SHARES_STATUS.APPROVED)) {
                        resolvedStatus = constants.DOCUMENT_SHARES_STATUS.APPROVED;
                    } else if (docShares.some((s) => s.status === constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL)) {
                        resolvedStatus = constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL;
                    } else if (docShares.some((s) => s.status === constants.DOCUMENT_SHARES_STATUS.STASHED)) {
                        resolvedStatus = constants.DOCUMENT_SHARES_STATUS.STASHED;
                    } else {
                        resolvedStatus = docShares[0].status;
                    }
                }
                setAccessibleItem(doc.id, {
                    status: resolvedStatus,
                    share: docShares[0] || null,
                    shares: docShares,
                });
                return;
            }

            // For departmental users (Officer, Director, Member):
            // 1. Collect all shares for this document that belong to the user's department
            const directDeptShares = docShares.filter(
                (s) => cleanId(s.department?.id ?? s.departmentId) === userDeptClean
            );

            // 2. If no direct share row for this item, check if an ancestor folder has a share row for this department
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
                            cleanId(s.department?.id ?? s.departmentId) === userDeptClean
                    );
                    if (parentDeptShares.length > 0) {
                        effectiveDeptShares = parentDeptShares;
                        isInheritedFromFolder = true;
                        break;
                    }
                    pId = parentDoc.parentId ?? parentDoc.parentFolderId;
                }
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
            } else {
                resolvedStatus = effectiveDeptShares[0]?.status ?? '—';
            }

            const primaryShare = effectiveDeptShares.find((s) => s.status === resolvedStatus) || effectiveDeptShares[0];

            // Role-based status gating:
            // OFFICER: PENDING_APPROVAL, APPROVED, STASHED, PUBLISHED
            if (isOfficer) {
                if (
                    [
                        constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL,
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

        // 3. Filter documents to accessible ones
        const accessibleDocs = documents.filter((doc) => {
            if (doc.isFolder) {
                return accessibleFolderIdSet.has(doc.id) || accessibleFolderIdSet.has(cleanId(doc.id));
            }
            return accessibleItemMap.has(doc.id) || accessibleItemMap.has(cleanId(doc.id));
        });

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

            return {
                id: doc.id,
                parentId: doc.parentId ?? 'root',
                title: doc.name,
                name: doc.name,
                subtitle: doc.isFolder ? 'DIR' : 'Document',
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
                shares: shareMeta?.shares ?? [],
                date: (doc.updatedAt || latestVer?.createdAt || doc.createdAt) && !isNaN(new Date(doc.updatedAt || latestVer?.createdAt || doc.createdAt).getTime())
                    ? formatDateTime(doc.updatedAt || latestVer?.createdAt || doc.createdAt)
                    : 'Active',
                isFolder: Boolean(doc.isFolder),
                isArchived: Boolean(doc.isArchived),
                directlyArchived: doc.directlyArchived,
                originalLocation: originalLocation,
                tags: doc.isFolder
                    ? ['Folder']
                    : [
                        latestVer?.classification ?? constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED,
                        ...(itemStatus && itemStatus !== '—' ? [itemStatus] : []),
                    ],
            };
        });

        return [...localCreatedItems, ...liveItems];
    }, [documents, documentVersions, documentShares, localCreatedItems, currentUser, isStaff, isOfficer, isDirector, isMember]);

    const currentFolderItems = useMemo(() => {
        const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
        return repositoryItems.filter((item) => {
            const matchesArchiveState = !item.isArchived;
            if (!matchesArchiveState) return false;
            const itemParent = item.parentId ?? 'root';
            if (currentFolderId === 'root') {
                return !itemParent || itemParent === 'root';
            }
            return cleanId(itemParent) === cleanId(currentFolderId);
        });
    }, [repositoryItems, currentFolderId]);

    const currentDirectoryLabel = breadcrumbsList[breadcrumbsList.length - 1]?.label ?? 'current directory';

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
                breadcrumbs={breadcrumbsList}
                selectedItem={selectedDocument}
                onSelectItem={handleItemSelect}
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
                title="Add to Repository"
                description={`Choose an action to add items into ${currentDirectoryLabel}.`}
                icon={creationMode === 'file' ? FileUp : FolderPlus}
                size="lg"
                primaryAction={modalPrimaryAction}
                secondaryAction={modalSecondaryAction}
            >
                {/* 1. CREATION MODE SELECTOR: TWO BIG SQUARE BUTTONS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                        type="button"
                        onClick={() => handleCreationModeChange('file')}
                        className={`p-5 rounded-xl border-2 flex flex-col items-center justify-center text-center gap-3 transition-colors cursor-pointer select-none ${
                            creationMode === 'file'
                                ? 'bg-accent-background border-accent text-text'
                                : 'bg-surface border-surface-border hover:bg-surface-hover hover:border-surface-border text-text'
                        }`}
                    >
                        <div
                            className={`p-3 rounded-full transition-colors ${
                                creationMode === 'file'
                                    ? 'bg-accent text-text-inverted'
                                    : 'bg-surface-hover text-text-muted'
                            }`}
                        >
                            <FileUp className="h-6 w-6" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="font-bold text-sm text-text">Upload Documents</span>
                            <span className="text-xs text-text-muted">
                                Upload single files or entire nested directories
                            </span>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleCreationModeChange('folder')}
                        className={`p-5 rounded-xl border-2 flex flex-col items-center justify-center text-center gap-3 transition-colors cursor-pointer select-none ${
                            creationMode === 'folder'
                                ? 'bg-accent-background border-accent text-text'
                                : 'bg-surface border-surface-border hover:bg-surface-hover hover:border-surface-border text-text'
                        }`}
                    >
                        <div
                            className={`p-3 rounded-full transition-colors ${
                                creationMode === 'folder'
                                    ? 'bg-accent text-text-inverted'
                                    : 'bg-surface-hover text-text-muted'
                            }`}
                        >
                            <FolderPlus className="h-6 w-6" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="font-bold text-sm text-text">Create Folder</span>
                            <span className="text-xs text-text-muted">
                                Group and organize documents into department folders
                            </span>
                        </div>
                    </button>
                </div>

                {/* 2. MODE CONTENT A: FILE / FOLDER DROPZONE */}
                {creationMode === 'file' && (
                    <div className="flex flex-col gap-4 mt-2">
                        {fileError && (
                            <div className="p-3 rounded-lg bg-error-background border border-error-border text-xs text-error">
                                {fileError}
                            </div>
                        )}

                        {/* DROPZONE AREA */}
                        <div
                            onDragOver={handleDropzoneDragOver}
                            onDragLeave={handleDropzoneDragLeave}
                            onDrop={handleDropzoneDrop}
                            onClick={() => fileInputReference.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3 transition-colors cursor-pointer ${
                                isDropzoneDragActive
                                    ? 'border-accent bg-accent-background/50 scale-[0.99]'
                                    : 'border-surface-border hover:border-accent/60 bg-surface hover:bg-surface-hover/50'
                            }`}
                        >
                            <div className="p-3 rounded-full bg-surface-hover border border-surface-border text-text-muted">
                                <UploadCloud className="h-8 w-8 text-accent" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-sm font-semibold text-text">
                                    Click to browse files or drag & drop here
                                </span>
                                <span className="text-xs text-text-muted">
                                    Drop single files or nested folder structures to upload
                                </span>
                            </div>
                            <span className="text-xs font-medium text-text-muted px-3 py-1 rounded-full bg-surface-hover border border-surface-border">
                                Destination: {currentDirectoryLabel}
                            </span>
                            <input
                                ref={fileInputReference}
                                type="file"
                                multiple
                                onChange={handleFileInputChange}
                                className="hidden"
                            />
                        </div>

                        {/* STAGED ITEMS QUEUE PREVIEW */}
                        {stagedDroppedItems.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-text flex items-center gap-2">
                                        <Layers className="h-4 w-4 text-accent" />
                                        Staged for Upload ({stagedDroppedItems.length} {stagedDroppedItems.length === 1 ? 'item' : 'items'})
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleClearAllStagedItems}
                                        className="text-xs text-error hover:underline cursor-pointer"
                                    >
                                        Clear All
                                    </button>
                                </div>

                                <div className="max-h-56 overflow-y-auto divide-y divide-surface-border border border-surface-border rounded-lg bg-surface">
                                    {stagedDroppedItems.map((stagedItem) => (
                                        <div
                                            key={stagedItem.id}
                                            className="px-3 py-2.5 flex items-center justify-between text-xs hover:bg-surface-hover gap-3"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                <FileText className="h-4 w-4 text-accent shrink-0" />
                                                <span className="truncate font-medium text-text font-mono text-[11px]" title={stagedItem.relativePath}>
                                                    {stagedItem.relativePath}
                                                </span>
                                                <span className="text-[10px] text-text-muted shrink-0">
                                                    ({stagedItem.size})
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
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
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent/15 text-accent border border-accent/30">
                                                                v{stagedItem.nextVersion ?? 2}.0
                                                            </span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveStagedItem(stagedItem.id)}
                                                            className="group/btn h-7 w-7 rounded-md hover:bg-error/10 text-text-muted hover:text-error flex items-center justify-center cursor-pointer transition-colors"
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
                        <TextField
                            label="Name"
                            placeholder="Enter folder name"
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
                            label="Comment"
                            placeholder="Enter comment..."
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
                    description={`The original parent folder "${restoreConflictModalItem.parentFolder?.name || restoreConflictModalItem.parentFolder?.title || 'Parent Folder'}" is currently archived. To unarchive this item, its parent folder must also be restored.`}
                    icon={AlertTriangle}
                    variant="warning"
                    size="sm"
                    callout={`Restoring "${restoreConflictModalItem.item?.title || restoreConflictModalItem.item?.name}" will restore parent folder "${restoreConflictModalItem.parentFolder?.name || restoreConflictModalItem.parentFolder?.title}" first into its original repository location.`}
                    primaryAction={{
                        label: 'Unarchive Parent & File',
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
                    onClose={handleCloseEditModal}
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
                    }}
                    secondaryAction={{
                        label: 'Cancel',
                        onClick: handleCloseEditModal,
                        disabled: isSavingEdit,
                    }}
                >
                    <div className="flex flex-col gap-4 py-2">
                        {/* 1. NAME (REQUIRED FOR BOTH) */}
                        <TextField
                            label="Name"
                            placeholder={editItem.isFolder ? 'Enter folder name...' : 'Enter document filename...'}
                            value={editFormName}
                            onChange={(event) => {
                                setEditFormName(event.target.value);
                                if (editFormErrors.name) setEditFormErrors((prev) => ({ ...prev, name: '' }));
                            }}
                            error={editFormErrors.name}
                            leadingIcon={editItem.isFolder ? Folder : FileText}
                            required
                        />

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
                                        className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-surface-hover hover:bg-surface-border text-text-muted hover:text-text border border-surface-border cursor-pointer transition-colors"
                                        title="Classify automatically with AI"
                                    >
                                        <Sparkles className="h-3 w-3 text-text-muted" />
                                        <span>AI Classify</span>
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

                        {/* 3. SUMMARY / OVERVIEW WITH SPARKLES AI BUTTON */}
                        {!editItem.isFolder ? (
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-semibold text-text">
                                        Summary
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleGenerateSummaryWithAI}
                                        disabled={isGeneratingAiSummary}
                                        className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-surface-hover hover:bg-surface-border text-text-muted hover:text-text border border-surface-border cursor-pointer transition-colors disabled:opacity-50"
                                        title="Generate AI summary with Vertex AI"
                                    >
                                        <Sparkles className={`h-3 w-3 text-text-muted ${isGeneratingAiSummary ? 'animate-spin' : ''}`} />
                                        <span>{isGeneratingAiSummary ? 'Analyzing...' : 'Generate with AI'}</span>
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
                        ) : (
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-semibold text-text">
                                        Folder Overview
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleGenerateSummaryWithAI}
                                        disabled={isGeneratingAiSummary}
                                        className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-surface-hover hover:bg-surface-border text-text-muted hover:text-text border border-surface-border cursor-pointer transition-colors disabled:opacity-50"
                                        title="Synthesize overview of child records with Vertex AI"
                                    >
                                        <Sparkles className={`h-3 w-3 text-text-muted ${isGeneratingAiSummary ? 'animate-spin' : ''}`} />
                                        <span>{isGeneratingAiSummary ? 'Synthesizing...' : 'Synthesize with AI'}</span>
                                    </button>
                                </div>
                                <AreaField
                                    placeholder="Overview of records stored in this folder..."
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
                    title={archivingItem.isFolder ? 'Archive Folder' : 'Archive Document'}
                    description={
                        archivingItem.isFolder
                            ? `Are you sure you want to archive folder "${archivingItem.title || archivingItem.name}" and all of its contents?`
                            : `Are you sure you want to archive document "${archivingItem.title || archivingItem.name}"?`
                    }
                    icon={AlertTriangle}
                    variant="destructive"
                    size="sm"
                    callout={
                        archivingItem.isFolder
                            ? 'The folder and its active contents will be moved to the archives and hidden from the active repository. Directly archived items can be restored later.'
                            : 'The document will be moved to the archives and hidden from active views. It can be restored at any time.'
                    }
                    calloutVariant="destructive"
                    onConfirm={handleConfirmArchiveItem}
                    confirmLabel={
                        isArchivingItem
                            ? 'Archiving...'
                            : archivingItem.isFolder
                            ? 'Archive Folder'
                            : 'Archive Document'
                    }
                    cancelLabel="Cancel"
                    isConfirmLoading={isArchivingItem}
                    isConfirmDisabled={isArchivingItem}
                />
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {deletingItem && (
                <Modal
                    isOpen={Boolean(deletingItem)}
                    onClose={() => !isDeletingItemLoading && setDeletingItem(null)}
                    title={`Delete ${deletingItem.isFolder ? 'Folder' : 'Document'}`}
                    description={`Are you sure you want to delete "${deletingItem.title || deletingItem.name}"?`}
                    icon={Trash2}
                    variant="destructive"
                    size="sm"
                    callout="This action cannot be undone and will permanently remove all associated version records from the database and storage files."
                    onConfirm={handleConfirmDeleteItem}
                    confirmLabel={isDeletingItemLoading ? 'Deleting...' : `Delete ${deletingItem.isFolder ? 'Folder' : 'Document'}`}
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

            {/* SHARE TO DEPARTMENT MODAL */}
            {Boolean(shareModalDocument) && (
                <Modal
                    isOpen={Boolean(shareModalDocument)}
                    onClose={() => {
                        setShareModalDocument(null);
                        setSelectedShareDepartmentIds([]);
                        setDepartmentSearchQuery('');
                    }}
                    title={`Share ${shareModalDocument.isFolder ? 'Folder' : 'Document'} to Departments`}
                    description={`Configure department access and review permissions for "${shareModalDocument.title || shareModalDocument.name}".`}
                    icon={Share2}
                    size="md"
                    secondaryAction={{
                        label: 'Done',
                        onClick: () => {
                            setShareModalDocument(null);
                            setSelectedShareDepartmentIds([]);
                            setDepartmentSearchQuery('');
                        },
                    }}
                >
                    <div className="flex flex-col gap-5">
                        {/* FOLDER CASCADING SHARE BANNER */}
                        {shareModalDocument.isFolder && (
                            <div className="p-3.5 rounded-xl border border-accent/20 bg-accent/5 flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-accent/10 text-accent shrink-0">
                                    <Folder className="h-4 w-4" />
                                </div>
                                <div className="flex flex-col gap-0.5 text-xs">
                                    <span className="font-semibold text-text">Recursive Folder Cascade</span>
                                    <span className="text-text-muted leading-relaxed">
                                        Sharing this folder will automatically share all nested files and subfolders to the selected departments with <strong className="text-text">Pending Approval</strong> status.
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* 1. SELECT TARGET DEPARTMENTS (MULTI-SELECT) */}
                        <div className="p-4 rounded-xl border border-surface-border bg-surface-hover flex flex-col gap-3">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-text">
                                    Target Departments ({selectedShareDepartmentIds.length} of {availableDepartmentsToShare.length} selected)
                                </span>
                                {availableDepartmentsToShare.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={handleSelectAllDepartments}
                                            className="text-xs text-accent hover:underline font-medium cursor-pointer"
                                        >
                                            {selectedShareDepartmentIds.length === filteredAvailableDepartments.length && filteredAvailableDepartments.length > 0
                                                ? 'Deselect All'
                                                : 'Select All'}
                                        </button>
                                        {selectedShareDepartmentIds.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedShareDepartmentIds([])}
                                                className="text-xs text-text-muted hover:text-text cursor-pointer"
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {availableDepartmentsToShare.length === 0 ? (
                                <div className="p-3 rounded-lg border border-surface-border bg-surface text-center text-xs text-text-muted">
                                    All available departments already have access to this {shareModalDocument.isFolder ? 'folder' : 'document'}.
                                </div>
                            ) : (
                                <>
                                    {availableDepartmentsToShare.length > 4 && (
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
                                            <input
                                                type="text"
                                                value={departmentSearchQuery}
                                                onChange={(e) => setDepartmentSearchQuery(e.target.value)}
                                                placeholder="Filter departments..."
                                                className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-surface border border-surface-border rounded-lg text-text focus:outline-none focus:border-accent"
                                            />
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                                        {filteredAvailableDepartments.map((dept) => {
                                            const isSelected = selectedShareDepartmentIds.includes(dept.id);
                                            return (
                                                <div
                                                    key={dept.id}
                                                    onClick={() => handleToggleDepartmentSelection(dept.id)}
                                                    className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 ${
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
                                                                {dept.code}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <Badge variant="neutral" size="xs" label={dept.code} />
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="flex items-center justify-between pt-1 gap-2">
                                        <span className="text-[11px] text-text-muted">
                                            Routes to Department Officers for approval before director review.
                                        </span>
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            leadingIcon={Share2}
                                            isLoading={isSharingDepartment}
                                            isDisabled={selectedShareDepartmentIds.length === 0 || isSharingDepartment}
                                            onClick={handleShareSubmit}
                                            className="shrink-0"
                                        >
                                            {selectedShareDepartmentIds.length > 1
                                                ? `Share to ${selectedShareDepartmentIds.length} Departments`
                                                : selectedShareDepartmentIds.length === 1
                                                ? 'Share to 1 Department'
                                                : 'Share'}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* 2. ACTIVE SHARES LIST */}
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-text">
                                    Current Department Shares ({activeSharesForModalDoc.length})
                                </span>
                            </div>

                            {activeSharesForModalDoc.length === 0 ? (
                                <div className="p-4 rounded-xl border border-surface-border bg-surface text-center text-xs text-text-muted">
                                    This {shareModalDocument.isFolder ? 'folder' : 'document'} is currently unshared (status: —). Only Administrators and Coordinators have access.
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                                    {activeSharesForModalDoc.map((share) => {
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
                                                className="p-3 rounded-xl border border-surface-border bg-surface flex items-center justify-between gap-3"
                                            >
                                                <div className="flex flex-col gap-1 min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-semibold text-xs text-text truncate">
                                                            {dept?.name || 'Department'}
                                                        </span>
                                                        <Badge variant={badgeVariant} label={share.status} />
                                                        {shareModalDocument.isFolder && (
                                                            <Badge variant="neutral" size="xs" label="Cascading" />
                                                        )}
                                                    </div>
                                                    <span className="text-[11px] text-text-muted">
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
                                                    className="shrink-0"
                                                >
                                                    Unshare
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </Modal>
            )}

            {/* PUBLISH TO DEPARTMENT MEMBERS MODAL */}
            {Boolean(publishModalDocument) && (
                <Modal
                    isOpen={Boolean(publishModalDocument)}
                    onClose={() => {
                        setPublishModalDocument(null);
                        setSelectedPublishMemberIds([]);
                        setMemberSearchQuery('');
                    }}
                    title={`Publish ${publishModalDocument.isFolder ? 'Folder' : 'Document'} to Department Members`}
                    description={`Configure faculty member visibility within ${userDepartment}. You can publish to all department members or choose specific members.`}
                    icon={Send}
                    size="md"
                    secondaryAction={{
                        label: 'Cancel',
                        onClick: () => {
                            setPublishModalDocument(null);
                            setSelectedPublishMemberIds([]);
                            setMemberSearchQuery('');
                        },
                    }}
                >
                    <div className="flex flex-col gap-5">
                        {/* RECURSIVE FOLDER CASCADE BANNER */}
                        {publishModalDocument.isFolder && (
                            <div className="p-3.5 rounded-xl border border-accent/20 bg-accent/5 flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-accent/10 text-accent shrink-0">
                                    <Folder className="h-4 w-4" />
                                </div>
                                <div className="flex flex-col gap-0.5 text-xs">
                                    <span className="font-semibold text-text">Recursive Folder Cascade</span>
                                    <span className="text-text-muted leading-relaxed">
                                        Publishing this folder will automatically publish all nested files and subfolders to the selected members with <strong className="text-text">Published</strong> status.
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* AUDIENCE SELECTOR: ALL MEMBERS vs SPECIFIC MEMBERS */}
                        <div className="flex flex-col gap-2">
                            <span className="text-xs font-semibold text-text">
                                Publication Scope
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div
                                    onClick={() => setPublishMode('all')}
                                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                                        publishMode === 'all'
                                            ? 'border-accent bg-accent/10 shadow-xs'
                                            : 'border-surface-border bg-surface hover:border-surface-border-strong hover:bg-surface-hover'
                                    }`}
                                >
                                    <div className="p-2 rounded-lg bg-surface border border-surface-border text-accent shrink-0">
                                        <Users className="h-4 w-4" />
                                    </div>
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                        <span className="text-xs font-bold text-text">All Department Members</span>
                                        <span className="text-[11px] text-text-muted leading-tight">
                                            Every member in {userDepartment} can view and download.
                                        </span>
                                    </div>
                                </div>

                                <div
                                    onClick={() => setPublishMode('specific')}
                                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                                        publishMode === 'specific'
                                            ? 'border-accent bg-accent/10 shadow-xs'
                                            : 'border-surface-border bg-surface hover:border-surface-border-strong hover:bg-surface-hover'
                                    }`}
                                >
                                    <div className="p-2 rounded-lg bg-surface border border-surface-border text-accent shrink-0">
                                        <UserCheck className="h-4 w-4" />
                                    </div>
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                        <span className="text-xs font-bold text-text">Select Specific Members</span>
                                        <span className="text-[11px] text-text-muted leading-tight">
                                            Only designated department members receive access.
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SPECIFIC MEMBER PICKER */}
                        {publishMode === 'specific' && (
                            <div className="p-4 rounded-xl border border-surface-border bg-surface-hover flex flex-col gap-3">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-text">
                                        Department Members ({selectedPublishMemberIds.length} of {departmentMembers.length} selected)
                                    </span>
                                    {departmentMembers.length > 0 && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={handleSelectAllMembers}
                                                className="text-xs text-accent hover:underline font-medium cursor-pointer"
                                            >
                                                {selectedPublishMemberIds.length === filteredDepartmentMembers.length && filteredDepartmentMembers.length > 0
                                                    ? 'Deselect All'
                                                    : 'Select All'}
                                            </button>
                                            {selectedPublishMemberIds.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedPublishMemberIds([])}
                                                    className="text-xs text-text-muted hover:text-text cursor-pointer"
                                                >
                                                    Clear
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {departmentMembers.length === 0 ? (
                                    <div className="p-3 rounded-lg border border-surface-border bg-surface text-center text-xs text-text-muted">
                                        No other active members found in {userDepartment}.
                                    </div>
                                ) : (
                                    <>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
                                            <input
                                                type="text"
                                                value={memberSearchQuery}
                                                onChange={(e) => setMemberSearchQuery(e.target.value)}
                                                placeholder="Search members by name, ID, or email..."
                                                className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-surface border border-surface-border rounded-lg text-text focus:outline-none focus:border-accent"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                                            {filteredDepartmentMembers.map((member) => {
                                                const isSelected = selectedPublishMemberIds.includes(member.id);
                                                const avatarSrc = resolveUserAvatar(member, currentUser);
                                                const memberFullName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Faculty Member';

                                                return (
                                                    <div
                                                        key={member.id}
                                                        onClick={() => handleToggleMemberSelection(member.id)}
                                                        className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
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
                                                            variant="neutral"
                                                            size="xs"
                                                            label={member.role}
                                                            className="shrink-0"
                                                        />
                                                    </div>
                                                );
                                            })}
                                            {filteredDepartmentMembers.length === 0 && (
                                                <div className="p-3 text-center text-xs text-text-muted">
                                                    No members match &quot;{memberSearchQuery}&quot;.
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* SUBMIT BUTTON */}
                        <div className="flex items-center justify-between pt-1 gap-2 border-t border-surface-border">
                            <span className="text-[11px] text-text-muted">
                                Officers and Director retain persistent management access.
                            </span>
                            <Button
                                variant="primary"
                                size="sm"
                                leadingIcon={Send}
                                isLoading={isPublishingMembers}
                                isDisabled={isPublishingMembers || (publishMode === 'specific' && selectedPublishMemberIds.length === 0)}
                                onClick={handlePublishSubmit}
                                className="shrink-0"
                            >
                                {publishMode === 'all'
                                    ? 'Publish to All Members'
                                    : selectedPublishMemberIds.length > 1
                                    ? `Publish to ${selectedPublishMemberIds.length} Members`
                                    : selectedPublishMemberIds.length === 1
                                    ? 'Publish to 1 Member'
                                    : 'Select Members'}
                            </Button>
                        </div>
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

        collectedItems.push({
            id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            parentId: targetParentId,
            relativePath: fullRelativePath,
            fileName: file.name,
            folderPathParts: folderPathParts ? [...folderPathParts] : [],
            title: fullRelativePath,
            subtitle: `DOC-${new Date().getFullYear()}-DIR-${Math.floor(100 + Math.random() * 900)}`,
            description: null,
            category: 'Document',
            classification: constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED,
            version: 'v1.0',
            size: formatFileSize(file.size),
            sizeBytes: file.size,
            status: constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL,
            date: 'Just now',
            isFolder: false,
            file: file,
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
            const matchingDoc = (existingDocs || []).find(
                (d) => !d.isFolder &&
                !d.isArchived &&
                (d.parentId ?? null) === resolvedParentId &&
                d.name.toLowerCase() === (item.fileName || item.title).toLowerCase()
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
                    collectedItems.push({
                        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        parentId: targetParentId,
                        relativePath: `/${rawFile.name}`,
                        fileName: rawFile.name,
                        folderPathParts: [],
                        title: `/${rawFile.name}`,
                        subtitle: `DOC-${new Date().getFullYear()}-GEN-${Math.floor(100 + Math.random() * 900)}`,
                        description: null,
                        category: 'Document',
                        classification: constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED,
                        version: 'v1.0',
                        size: formatFileSize(rawFile.size),
                        sizeBytes: rawFile.size,
                        status: constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL,
                        date: 'Just now',
                        isFolder: false,
                        file: rawFile,
                        tags: [constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL, constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED],
                    });
                }
            }
        }
    } else if (dataTransfer?.files && dataTransfer.files.length > 0) {
        for (let fileIndex = 0; fileIndex < dataTransfer.files.length; fileIndex++) {
            const rawFile = dataTransfer.files[fileIndex];
            collectedItems.push({
                id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                parentId: targetParentId,
                relativePath: `/${rawFile.name}`,
                fileName: rawFile.name,
                folderPathParts: [],
                title: `/${rawFile.name}`,
                subtitle: `DOC-${new Date().getFullYear()}-GEN-${Math.floor(100 + Math.random() * 900)}`,
                description: null,
                category: 'Document',
                classification: constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED,
                version: 'v1.0',
                size: formatFileSize(rawFile.size),
                sizeBytes: rawFile.size,
                status: constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL,
                date: 'Just now',
                isFolder: false,
                file: rawFile,
                tags: [constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL, constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED],
            });
        }
    }

    return collectedItems;
}


// --- EXPORTS ---
export { DocumentsPage };
export default DocumentsPage;
