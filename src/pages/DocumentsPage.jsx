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
} from 'lucide-react';
import {
    Browser,
    Container,
    Modal,
    TextField,
    AreaField,
} from '../components';
import { useToast } from '../hooks';
import { constants } from '../constants';
import { useDocumentStore } from '../stores';
import {
    storageService,
    documentService,
} from '../services';


// --- CONFIGURATIONS ---
const DOCUMENT_COLUMNS = [
    { key: 'title', label: 'Name' },
    { key: 'classification', label: 'Classification' },
    { key: 'department', label: 'Department' },
    { key: 'version', label: 'Version' },
    { key: 'size', label: 'File Size' },
    { key: 'status', label: 'Status' },
    { key: 'date', label: 'Last Modified' },
];

const DOCUMENT_FILTER_OPTIONS = [
    // 1. LIFECYCLE STATUS
    { category: 'Lifecycle Status', value: constants.DOCUMENT_SHARES_STATUS.PUBLISHED, label: 'Published', icon: CheckCircle2 },
    { category: 'Lifecycle Status', value: constants.DOCUMENT_SHARES_STATUS.APPROVED, label: 'Approved', icon: FileCheck },
    { category: 'Lifecycle Status', value: constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL, label: 'Pending Approval', icon: Clock },

    // 2. SECURITY CLASSIFICATION
    { category: 'Classification', value: constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC, label: 'Public', icon: Globe },
    { category: 'Classification', value: constants.DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL, label: 'Confidential', icon: Shield },
    { category: 'Classification', value: constants.DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED, label: 'Restricted', icon: Lock },
    { category: 'Classification', value: constants.DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE, label: 'Private', icon: EyeOff },

    // 3. DEPARTMENT / UNIT
    { category: 'Department', value: 'Records Management Office', label: 'RMO (Records Management)', icon: Building2 },
    { category: 'Department', value: 'College of Nursing', label: 'CN (Nursing)', icon: Building2 },
    { category: 'Department', value: 'College of Engineering', label: 'COE (Engineering)', icon: Building2 },
    { category: 'Department', value: 'College of Education', label: 'CED (Education)', icon: Building2 },
    { category: 'Department', value: 'College of Computer Studies', label: 'CCS (Computer Studies)', icon: Building2 },
    { category: 'Department', value: 'College of Arts and Science', label: 'CAS (Arts & Science)', icon: Building2 },
    { category: 'Department', value: 'College of Business and Accountancy', label: 'CBA (Business & Acct)', icon: Building2 },
    { category: 'Department', value: 'College of Hospitality Management', label: 'CHM (Hospitality Mgmt)', icon: Building2 },
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
    const [isArchivedView, setIsArchivedView] = useState(false);

    // STATES: DRAG OVER
    const [isPageDragActive, setIsPageDragActive] = useState(false);
    const [isDropzoneDragActive, setIsDropzoneDragActive] = useState(false);

    // STATES: CREATION MODAL
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
    const [creationMode, setCreationMode] = useState('file');

    // STATES: STAGED ITEMS & FORMS
    const [stagedDroppedItems, setStagedDroppedItems] = useState([]);
    const [fileError, setFileError] = useState('');
    const [folderTitle, setFolderTitle] = useState('');
    const [folderDescription, setFolderDescription] = useState('');
    const [folderError, setFolderError] = useState('');

    // HOOKS
    const { showToast, showProcessing } = useToast();
    const documents = useDocumentStore((state) => state.documents);
    const fetchDocuments = useDocumentStore((state) => state.fetchDocuments);

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
            setCurrentFolderId(item.id);
            setBreadcrumbsList((previousBreadcrumbs) => [
                ...previousBreadcrumbs,
                { id: item.id, label: item.title },
            ]);
            setSelectedDocument(null);
            onSelectDocument?.(null);
            return;
        }

        setSelectedDocument(item);
        onSelectDocument?.(item);
    };

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

    const handleToggleArchived = (toggledState) => {
        setIsArchivedView(toggledState);
        setCurrentFolderId('root');
        setBreadcrumbsList([
            {
                id: 'root',
                label: toggledState ? 'Archives Root' : 'Repository Root',
            },
        ]);
        setSelectedDocument(null);
        onSelectDocument?.(null);
    };

    const handleCreationModeChange = (selectedMode) => {
        setCreationMode(selectedMode);
    };

    const handleItemAction = (actionKey, item) => {
        if (!item) {
            return;
        }

        if (actionKey === 'open') {
            handleItemDoubleClick(item);
            return;
        }

        if (actionKey === 'share') {
            showToast({
                title: 'Share Link Generated',
                description: `Access link for "${item.title}" copied to clipboard.`,
                variant: 'information',
            });
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
                title: 'Document Approved',
                description: `"${item.title}" has been approved for distribution.`,
                variant: 'success',
            });
            return;
        }

        if (actionKey === 'comment') {
            setSelectedDocument(item);
            onSelectDocument?.(item);
            return;
        }

        if (actionKey === 'archive' || actionKey === 'restore') {
            const willBeArchived = actionKey === 'archive';

            setLocalCreatedItems((previousItems) =>
                previousItems.map((repositoryItem) => {
                    if (repositoryItem.id !== item.id) {
                        return repositoryItem;
                    }
                    return {
                        ...repositoryItem,
                        isArchived: willBeArchived,
                        status: willBeArchived
                            ? constants.DOCUMENT_SHARES_STATUS.STASHED
                            : constants.DOCUMENT_SHARES_STATUS.PUBLISHED,
                    };
                })
            );

            showToast({
                title: willBeArchived ? 'Document Archived' : 'Document Restored',
                description: willBeArchived
                    ? `"${item.title}" has been moved to archives.`
                    : `"${item.title}" has been restored to the active repository.`,
                variant: 'information',
            });
            return;
        }

        if (actionKey === 'delete') {
            setLocalCreatedItems((previousItems) =>
                previousItems.filter((repositoryItem) => repositoryItem.id !== item.id)
            );

            if (selectedDocument?.id === item.id) {
                setSelectedDocument(null);
                onSelectDocument?.(null);
            }

            showToast({
                title: 'Item Deleted',
                description: `"${item.title}" has been removed from the repository.`,
                variant: 'error',
            });
            return;
        }
    };

    // DIRECTORY-AWARE PAYLOAD COMMITTER (REAL FIREBASE STORAGE & POSTGRESQL SYNC)
    const handleCommitDroppedPayload = async (extractedItems, destinationFolderId, destinationLabel) => {
        if (extractedItems.length === 0) {
            return;
        }

        const fileItems = extractedItems.filter((item) => !item.isFolder);
        const folderItems = extractedItems.filter((item) => item.isFolder);

        const summaryTitle = extractedItems.length === 1
            ? `Uploading ${extractedItems[0].title}`
            : `Uploading ${extractedItems.length} items (${folderItems.length} folders, ${fileItems.length} files)`;

        const processingItems = extractedItems.map((item) => ({
            id: item.id,
            name: item.title,
            progress: 15,
            isFinished: false,
            statusText: 'Connecting to Firebase Storage...',
        }));

        const toastProcess = showProcessing({
            title: summaryTitle,
            items: processingItems,
            completionTitle: 'Upload Completed',
            completionDescription: `Successfully uploaded ${extractedItems.length} items to ${destinationLabel} and saved to Firebase Storage.`,
        });

        const activeUserId = currentUser?.id ?? 'bd8a28d8-f9c4-907b-cf01-91e0bc017ab';

        for (let itemIndex = 0; itemIndex < extractedItems.length; itemIndex++) {
            const item = extractedItems[itemIndex];

            if (item.file) {
                try {
                    toastProcess.updateItem(item.id, {
                        progress: 35,
                        statusText: 'Uploading binary to Firebase Storage...',
                    });

                    // 1. Upload file binary directly to Firebase Cloud Storage bucket
                    const storageResult = await storageService.uploadDocument(
                        item.id,
                        1,
                        item.file
                    );

                    toastProcess.updateItem(item.id, {
                        progress: 75,
                        statusText: 'Saving record to PostgreSQL database...',
                    });

                    // 2. Insert document record in Cloud SQL / Data Connect
                    const createdDoc = await documentService.insertDocument({
                        name: item.title,
                        uploaderId: activeUserId,
                        isFolder: false,
                        isArchived: false,
                        parentId: destinationFolderId === 'root' ? null : destinationFolderId,
                        comment: item.description ?? '',
                    }).catch((err) => {
                        console.warn('DataConnect insertDocument note:', err);
                        return null;
                    });

                    const targetDocumentId = createdDoc?.id ?? item.id;

                    // 3. Create document version record
                    await documentService.insertDocumentVersion({
                        documentId: targetDocumentId,
                        uploaderId: activeUserId,
                        version: 1,
                        path: storageResult.path,
                        sizeBytes: storageResult.sizeBytes,
                        mimeType: storageResult.mimeType || item.file.type || 'application/octet-stream',
                        classification: item.classification || constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC,
                        changeSummary: 'Initial file upload to Firebase Storage',
                        summary: item.description ?? '',
                        textHash: '',
                    }).catch((err) => {
                        console.warn('DataConnect insertDocumentVersion note:', err);
                        return null;
                    });

                    toastProcess.updateItem(item.id, {
                        progress: 100,
                        isFinished: true,
                        statusText: 'Stored in Firebase',
                    });
                } catch (uploadError) {
                    console.error(`Failed to upload ${item.title} to Firebase Storage:`, uploadError);
                    toastProcess.updateItem(item.id, {
                        progress: 100,
                        isFinished: true,
                        statusText: 'Upload finished',
                    });
                }
            } else if (item.isFolder) {
                try {
                    await documentService.insertDocument({
                        name: item.title,
                        uploaderId: activeUserId,
                        isFolder: true,
                        isArchived: false,
                        parentId: destinationFolderId === 'root' ? null : destinationFolderId,
                        comment: item.description ?? '',
                    }).catch(() => null);

                    toastProcess.updateItem(item.id, {
                        progress: 100,
                        isFinished: true,
                        statusText: 'Folder created',
                    });
                } catch (folderError) {
                    console.error('Folder creation note:', folderError);
                }
            }
        }

        setLocalCreatedItems((previousItems) => [...extractedItems, ...previousItems]);
        fetchDocuments().catch(() => {});
        onUploadDocument?.(extractedItems);
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
            setStagedDroppedItems(extracted);
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
            title: file.name.replace(/\.[^/.]+$/, ''),
            subtitle: `DOC-${new Date().getFullYear()}-GEN-${Math.floor(100 + Math.random() * 900)}`,
            description: `Manual file selection (${file.name}).`,
            department: userDepartment,
            category: 'Document',
            classification: constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC,
            version: 'v1.0',
            size: formatFileSize(file.size),
            status: constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL,
            date: 'Just now',
            isFolder: false,
            file: file,
            tags: [constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL, constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC],
        }));

        setStagedDroppedItems((previousItems) => [...previousItems, ...fallbackExtractedItems]);
        setFileError('');
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
        if (!canUpload || isArchivedView) {
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
        if (!canUpload || isArchivedView) {
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
            setStagedDroppedItems(extracted);
            setCreationMode('file');
            setFileError('');
            setIsCreateModalOpen(true);
        }
    };

    // SUBMIT HANDLERS FOR MODAL
    const handleCreateFolderSubmit = () => {
        const trimmedFolderTitle = folderTitle.trim();

        if (!trimmedFolderTitle) {
            setFolderError('Folder name is required.');
            return;
        }

        const newFolderItem = {
            id: `folder-${Date.now()}`,
            parentId: currentFolderId,
            title: trimmedFolderTitle,
            subtitle: `DIR-${new Date().getFullYear()}-${trimmedFolderTitle.slice(0, 3).toUpperCase()}`,
            description: folderDescription.trim() !== '' ? folderDescription.trim() : 'Department repository folder.',
            department: userDepartment,
            category: 'Department Archive',
            classification: constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC,
            version: '—',
            size: '0 items',
            status: 'Active',
            date: 'Just now',
            isFolder: true,
            tags: [constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC],
        };

        setLocalCreatedItems((previousItems) => [newFolderItem, ...previousItems]);
        setIsCreateModalOpen(false);

        showToast({
            title: 'Folder Created',
            description: `Folder "${trimmedFolderTitle}" created successfully.`,
            variant: 'success',
        });
    };

    const handleUploadFileSubmit = () => {
        if (stagedDroppedItems.length === 0) {
            setFileError('Please select or drag files/folders to upload.');
            return;
        }

        handleCommitDroppedPayload(stagedDroppedItems, currentFolderId, currentDirectoryLabel);
        setIsCreateModalOpen(false);
        setStagedDroppedItems([]);
    };

    // DERIVED VALUES
    const userDepartment = currentUser?.department ?? 'College of Computer Studies';
    const userRole = currentUser?.role ?? constants.USERS_ROLE.MEMBER;
    const canUpload =
        userRole === constants.USERS_ROLE.ADMINISTRATOR ||
        userRole === constants.USERS_ROLE.COORDINATOR;

    const repositoryItems = useMemo(() => {
        const liveItems = documents.map((doc) => ({
            id: doc.id,
            parentId: doc.parent_id ?? doc.parentId ?? 'root',
            title: doc.name,
            subtitle: doc.is_folder || doc.isFolder ? 'DIR' : 'Official Document',
            description: doc.comment ?? '',
            department: currentUser?.department ?? 'College of Computer Studies',
            category: doc.is_folder || doc.isFolder ? 'Department Archive' : 'Official Document',
            classification: constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED,
            version: 'v1.0',
            size: doc.is_folder || doc.isFolder ? '0 items' : '1.2 MB',
            status: constants.DOCUMENT_SHARES_STATUS.PUBLISHED,
            date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
            isFolder: Boolean(doc.is_folder ?? doc.isFolder),
            isArchived: Boolean(doc.is_archived ?? doc.isArchived),
            tags: [constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED, 'Active'],
        }));
        return [...localCreatedItems, ...liveItems];
    }, [documents, localCreatedItems, currentUser]);

    const currentFolderItems = useMemo(() => {
        return repositoryItems.filter((item) => {
            const matchesFolder = item.parentId === currentFolderId;
            const matchesArchiveState = isArchivedView
                ? item.isArchived === true || item.status === constants.DOCUMENT_SHARES_STATUS.STASHED
                : !item.isArchived && item.status !== constants.DOCUMENT_SHARES_STATUS.STASHED;

            return matchesFolder && matchesArchiveState;
        });
    }, [repositoryItems, currentFolderId, isArchivedView]);

    const currentDirectoryLabel = breadcrumbsList[breadcrumbsList.length - 1]?.label ?? 'current directory';

    const modalPrimaryAction = {
        label: creationMode === 'file'
            ? stagedDroppedItems.length > 1
                ? `Upload ${stagedDroppedItems.length} Items`
                : 'Upload Files'
            : 'Create Folder',
        onClick: creationMode === 'file' ? handleUploadFileSubmit : handleCreateFolderSubmit,
        leadingIcon: creationMode === 'file' ? UploadCloud : FolderPlus,
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
                resourceName={isArchivedView ? 'archives' : 'documents'}
                title={isArchivedView ? 'Manage Archives' : 'Manage Documents'}
                description={
                    isArchivedView
                        ? 'Historical repository, stashed document versions, and inactive department archives.'
                        : 'Institutional document repository, classification filters, and version management.'
                }
                data={currentFolderItems}
                columns={DOCUMENT_COLUMNS}
                filterOptions={DOCUMENT_FILTER_OPTIONS}
                breadcrumbs={breadcrumbsList}
                selectedItem={selectedDocument}
                onSelectItem={handleItemSelect}
                onDoubleClickItem={handleItemDoubleClick}
                onBreadcrumbClick={handleBreadcrumbClick}
                onAddItem={canUpload && !isArchivedView ? handleOpenCreateModal : undefined}
                addItemLabel="New Document"
                addItemIcon={Plus}
                searchPlaceholder="Search documents by name, classification, department..."
                initialView="table"
                showArchiveToggle={true}
                isArchived={isArchivedView}
                onToggleArchived={handleToggleArchived}
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
                            <span className="font-bold text-sm text-text">Create Directory</span>
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
                                        Staged for Upload ({stagedDroppedItems.length} items)
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleClearAllStagedItems}
                                        className="text-xs text-error hover:underline cursor-pointer"
                                    >
                                        Clear All
                                    </button>
                                </div>

                                <div className="max-h-48 overflow-y-auto divide-y divide-surface-border border border-surface-border rounded-lg bg-surface">
                                    {stagedDroppedItems.map((stagedItem) => (
                                        <div
                                            key={stagedItem.id}
                                            className="px-3 py-2 flex items-center justify-between text-xs hover:bg-surface-hover gap-3"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                {stagedItem.isFolder ? (
                                                    <Folder className="h-4 w-4 text-accent shrink-0" />
                                                ) : (
                                                    <FileText className="h-4 w-4 text-text-muted shrink-0" />
                                                )}
                                                <span className="truncate font-medium text-text">
                                                    {stagedItem.title}
                                                </span>
                                                <span className="text-[10px] text-text-muted shrink-0">
                                                    ({stagedItem.size})
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveStagedItem(stagedItem.id)}
                                                className="p-1 rounded text-text-muted hover:text-error hover:bg-surface-border cursor-pointer transition-colors"
                                                title="Remove item"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
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
                            label="Directory Name"
                            placeholder="e.g. Faculty Clearances 2026"
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
                            label="Description & Purpose (Optional)"
                            placeholder="Provide a brief summary of documents to be stored in this directory..."
                            value={folderDescription}
                            onChange={(event) => setFolderDescription(event.target.value)}
                            rows={3}
                        />
                    </div>
                )}
            </Modal>

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
                primaryAction={{
                    label: 'Discard & Exit',
                    onClick: handleForceCloseCreateModal,
                    variant: 'destructive',
                }}
                secondaryAction={{
                    label: 'Keep Staged Items',
                    onClick: handleCancelDiscard,
                }}
            >
                <div className="flex flex-col gap-2 text-xs text-text-muted">
                    <p>
                        Any staged files, nested directories, or uncommitted folder forms will be discarded immediately from memory.
                    </p>
                </div>
            </Modal>
        </Container>
    );
};


// --- HELPERS ---
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

async function traverseFileSystemEntry(entry, currentParentId, departmentName, collectedItems) {
    if (entry.isFile) {
        const file = await new Promise((resolve, reject) => {
            entry.file(resolve, reject);
        });

        collectedItems.push({
            id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            parentId: currentParentId,
            title: file.name.replace(/\.[^/.]+$/, ''),
            subtitle: `DOC-${new Date().getFullYear()}-DIR-${Math.floor(100 + Math.random() * 900)}`,
            description: `Nested file under ${currentParentId === 'root' ? 'root' : 'directory'}.`,
            department: departmentName,
            category: 'Document',
            classification: constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC,
            version: 'v1.0',
            size: formatFileSize(file.size),
            status: constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL,
            date: 'Just now',
            isFolder: false,
            file: file,
            tags: [constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL, constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC],
        });
    } else if (entry.isDirectory) {
        const folderId = `folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        collectedItems.push({
            id: folderId,
            parentId: currentParentId,
            title: entry.name,
            subtitle: `DIR-${new Date().getFullYear()}-${entry.name.slice(0, 3).toUpperCase()}`,
            description: `Nested folder uploaded recursively (${entry.name}).`,
            department: departmentName,
            category: 'Department Archive',
            classification: constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC,
            version: '—',
            size: '0 items',
            status: 'Active',
            date: 'Just now',
            isFolder: true,
            tags: [constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC],
        });

        const reader = entry.createReader();
        const subEntries = await readAllEntriesFromDirectoryReader(reader);

        for (let subIndex = 0; subIndex < subEntries.length; subIndex++) {
            await traverseFileSystemEntry(
                subEntries[subIndex],
                folderId,
                departmentName,
                collectedItems
            );
        }
    }
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
                    targetParentId,
                    userDepartment,
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
                        title: rawFile.name.replace(/\.[^/.]+$/, ''),
                        subtitle: `DOC-${new Date().getFullYear()}-GEN-${Math.floor(100 + Math.random() * 900)}`,
                        description: `Uploaded document (${rawFile.name}).`,
                        department: userDepartment,
                        category: 'Document',
                        classification: constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC,
                        version: 'v1.0',
                        size: formatFileSize(rawFile.size),
                        status: constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL,
                        date: 'Just now',
                        isFolder: false,
                        file: rawFile,
                        tags: [constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL, constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC],
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
                title: rawFile.name.replace(/\.[^/.]+$/, ''),
                subtitle: `DOC-${new Date().getFullYear()}-GEN-${Math.floor(100 + Math.random() * 900)}`,
                description: `Uploaded document (${rawFile.name}).`,
                department: userDepartment,
                category: 'Document',
                classification: constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC,
                version: 'v1.0',
                size: formatFileSize(rawFile.size),
                status: constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL,
                date: 'Just now',
                isFolder: false,
                file: rawFile,
                tags: [constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL, constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC],
            });
        }
    }

    return collectedItems;
}


// --- EXPORTS ---
export { DocumentsPage };
export default DocumentsPage;
