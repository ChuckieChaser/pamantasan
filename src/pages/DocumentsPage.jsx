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
} from 'lucide-react';
import {
    Browser,
    Button,
    Container,
    Modal,
    TextField,
    AreaField,
    SelectField,
    DocumentViewerModal,
    formatDateTime,
} from '../components';
import { useToast } from '../hooks';
import { constants } from '../constants';
import { useDocumentStore, useDepartmentStore } from '../stores';
import {
    storageService,
    documentService,
    aiService,
} from '../services';


// --- CONFIGURATIONS ---
const DOCUMENT_COLUMNS = [
    { key: 'title', label: 'Name' },
    { key: 'classification', label: 'Classification' },
    { key: 'version', label: 'Version' },
    { key: 'size', label: 'Size' },
    { key: 'status', label: 'Status' },
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
    currentUser = null,
    onUploadDocument = null,
    onSelectDocument,
    className,
    ...props
}) => {
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

    // HOOKS
    const { showToast, showProcessing } = useToast();
    const documents = useDocumentStore((state) => state.documents);
    const documentVersions = useDocumentStore((state) => state.documentVersions);
    const fetchDocuments = useDocumentStore((state) => state.fetchDocuments);
    const departments = useDepartmentStore((state) => state.departments);

    const dynamicFilterOptions = useMemo(() => {
        return [...BASE_FILTER_OPTIONS];
    }, []);

    useEffect(() => {
        fetchDocuments().catch(() => {});
    }, [fetchDocuments]);

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
            await useDocumentStore.getState().updateDocument(editItem.id, {
                name: editFormName.trim(),
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
                        summary: editFormSummary.trim() || null,
                        classification: editFormClassification,
                        changeSummary: 'Updated metadata via editor',
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
            showToast({
                type: 'information',
                title: 'Share Settings',
                description: `Access link for "${item.title || item.name}" copied to clipboard.`,
            });
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
        const folderCache = new Map();

        const CONCURRENCY_LIMIT = 2;
        let itemIndex = 0;

        const processItem = async (item) => {
            try {
                toastProcess.updateItem(item.id, {
                    progress: 15,
                    statusText: 'Resolving folder location...',
                });

                // 1. Resolve folder hierarchy if nested
                let targetParentId = rootTargetId;
                if (item.folderPathParts && item.folderPathParts.length > 0) {
                    let accumulated = '';
                    let currentParent = rootTargetId;

                    for (const folderName of item.folderPathParts) {
                        accumulated += '/' + folderName;
                        if (folderCache.has(accumulated)) {
                            currentParent = folderCache.get(accumulated);
                        } else {
                            const existingFolder = documents.find(
                                (d) => d.isFolder && (d.parentId ?? null) === currentParent && !d.isArchived && d.name.toLowerCase() === folderName.toLowerCase()
                            );
                            if (existingFolder) {
                                currentParent = existingFolder.id;
                            } else if (activeUserId) {
                                const createdFolder = await documentService.insertDocument({
                                    name: folderName,
                                    uploaderId: activeUserId,
                                    isFolder: true,
                                    isArchived: false,
                                    parentId: currentParent,
                                    comment: null,
                                });
                                currentParent = createdFolder.id;
                            }
                            folderCache.set(accumulated, currentParent);
                        }
                    }
                    targetParentId = currentParent;
                }

                // 2. Check if creating new version or new document
                let targetDocumentId = item.action === 'create_new' ? null : item.existingDocumentId;

                if (!targetDocumentId && activeUserId && item.action !== 'create_new') {
                    const existingDoc = documents.find(
                        (d) => !d.isFolder && (d.parentId ?? null) === targetParentId && !d.isArchived && d.name.toLowerCase() === (item.fileName || item.title).toLowerCase()
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
                        item.fileName || item.title
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
                            mimeType: storageResult.mimeType || item.file.type || 'application/octet-stream',
                            fileName: item.fileName || item.title,
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
                            mimeType: storageResult.mimeType || item.file.type || 'application/octet-stream',
                            classification: finalClassification,
                            changeSummary: aiResult?.changeSummary || `Version ${nextVersionNum}.0 update`,
                            summary: aiResult?.summary || null,
                            embedding: aiResult?.embedding || null,
                        });

                        await documentService.updateDocument(targetDocumentId, {
                            updatedAt: new Date().toISOString(),
                        }).catch(() => null);
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
                            name: item.fileName || item.title,
                            uploaderId: activeUserId,
                            isFolder: false,
                            isArchived: false,
                            parentId: targetParentId,
                            comment: null,
                        });
                        targetDocumentId = createdDoc.id;
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
                            item.fileName || item.title
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
                            mimeType: storageResult.mimeType || item.file.type || 'application/octet-stream',
                            fileName: item.fileName || item.title,
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
                                mimeType: storageResult.mimeType || item.file.type || 'application/octet-stream',
                                classification: finalClassification,
                                changeSummary: aiResult?.changeSummary || 'Initial file upload',
                                summary: aiResult?.summary || null,
                                embedding: aiResult?.embedding || null,
                            });
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
    };

    // MODAL DROPZONE DRAG & DROP HANDLERS
    const handleDropzoneDragOver = (dragEvent) => {
        dragEvent.preventDefault();
        dragEvent.stopPropagation();
        setIsDropzoneDragActive(true);
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
        if (!canUpload) {
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
        if (!canUpload) {
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
                await documentService.insertDocument({
                    name: uniqueFolderName,
                    uploaderId: activeUserId,
                    isFolder: true,
                    isArchived: false,
                    parentId: targetParentId,
                    comment: folderDescription.trim() || null,
                });
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
    const canUpload =
        userRole === constants.USERS_ROLE.ADMINISTRATOR ||
        userRole === constants.USERS_ROLE.COORDINATOR;

    const repositoryItems = useMemo(() => {
        const liveItems = documents.map((doc) => {
            const versionsForDoc = (documentVersions || []).filter(
                (v) => (v.document?.id ?? v.documentId) === doc.id
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
                    let curr = (documents || []).find((d) => d.id === doc.parentId);
                    while (curr) {
                        chain.unshift(curr.name || curr.title || 'Folder');
                        const pId = curr.parentId ?? curr.parentFolderId;
                        if (!pId || pId === 'root') break;
                        curr = (documents || []).find((d) => d.id === pId);
                    }
                    return chain.length > 0 ? chain.join(' / ') : 'Repository Root';
                })()
                : 'Repository Root';

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
                status: '—',
                date: (doc.updatedAt || latestVer?.createdAt || doc.createdAt) && !isNaN(new Date(doc.updatedAt || latestVer?.createdAt || doc.createdAt).getTime())
                    ? formatDateTime(doc.updatedAt || latestVer?.createdAt || doc.createdAt)
                    : 'Active',
                isFolder: Boolean(doc.isFolder),
                isArchived: Boolean(doc.isArchived),
                directlyArchived: doc.directlyArchived,
                originalLocation: originalLocation,
                tags: doc.isFolder
                    ? ['Folder']
                    : [latestVer?.classification ?? constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED],
            };
        });
        return [...localCreatedItems, ...liveItems];
    }, [documents, documentVersions, localCreatedItems, currentUser]);

    const currentFolderItems = useMemo(() => {
        return repositoryItems.filter((item) => {
            const matchesArchiveState = !item.isArchived && item.status !== constants.DOCUMENT_SHARES_STATUS.STASHED;
            if (!matchesArchiveState) return false;
            return (item.parentId ?? 'root') === currentFolderId;
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
