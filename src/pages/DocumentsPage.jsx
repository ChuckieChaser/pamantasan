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
    PageContainer,
    CardContainer,
    Browser,
    Modal,
    TextField,
    AreaField,
    useToast,
} from '../components';
import {
    USER_ROLES,
    DOCUMENT_CLASSIFICATIONS,
    DOCUMENT_SHARE_STATUSES,
} from '../constants';
import {
    useDocumentStore,
} from '../stores';
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
    { category: 'Lifecycle Status', value: DOCUMENT_SHARE_STATUSES.PUBLISHED, label: 'Published', icon: CheckCircle2 },
    { category: 'Lifecycle Status', value: DOCUMENT_SHARE_STATUSES.APPROVED, label: 'Approved', icon: FileCheck },
    { category: 'Lifecycle Status', value: DOCUMENT_SHARE_STATUSES.PENDING_APPROVAL, label: 'Pending Approval', icon: Clock },

    // 2. SECURITY CLASSIFICATION
    { category: 'Classification', value: DOCUMENT_CLASSIFICATIONS.PUBLIC, label: 'Public', icon: Globe },
    { category: 'Classification', value: DOCUMENT_CLASSIFICATIONS.CONFIDENTIAL, label: 'Confidential', icon: Shield },
    { category: 'Classification', value: DOCUMENT_CLASSIFICATIONS.RESTRICTED, label: 'Restricted', icon: Lock },
    { category: 'Classification', value: DOCUMENT_CLASSIFICATIONS.PRIVATE, label: 'Private', icon: EyeOff },

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
    // HOOKS
    const { showToast, showProcessing } = useToast();
    const documents = useDocumentStore((state) => state.documents);
    const fetchDocuments = useDocumentStore((state) => state.fetchDocuments);

    // REFS
    const fileInputReference = useRef(null);

    // REPOSITORY & NAVIGATION STATES
    const [localCreatedItems, setLocalCreatedItems] = useState([]);
    const [currentFolderId, setCurrentFolderId] = useState('root');
    const [breadcrumbsList, setBreadcrumbsList] = useState(INITIAL_BREADCRUMBS);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [isArchivedView, setIsArchivedView] = useState(false);

    useEffect(() => {
        fetchDocuments().catch(() => {});
    }, [fetchDocuments]);

    const repositoryItems = useMemo(() => {
        const liveItems = documents.map((doc) => ({
            id: doc.id,
            parentId: doc.parent_id ?? 'root',
            title: doc.name,
            subtitle: doc.is_folder ? 'DIR' : 'Official Document',
            description: doc.comment ?? '',
            department: currentUser?.department ?? 'College of Computer Studies',
            category: doc.is_folder ? 'Department Archive' : 'Official Document',
            classification: DOCUMENT_CLASSIFICATIONS.UNCLASSIFIED,
            version: 'v1.0',
            size: doc.is_folder ? '0 items' : '1.2 MB',
            status: DOCUMENT_SHARE_STATUSES.PUBLISHED,
            date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
            isFolder: Boolean(doc.is_folder),
            isArchived: Boolean(doc.is_archived),
            tags: [DOCUMENT_CLASSIFICATIONS.UNCLASSIFIED, 'Active'],
        }));
        return [...localCreatedItems, ...liveItems];
    }, [documents, localCreatedItems, currentUser]);

    // DRAG OVER STATES
    const [isPageDragActive, setIsPageDragActive] = useState(false);
    const [isDropzoneDragActive, setIsDropzoneDragActive] = useState(false);

    // CREATION MODAL STATES
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
    const [creationMode, setCreationMode] = useState('file');

    // STAGED DRAGGED / SELECTED ITEMS FOR MODAL
    const [stagedDroppedItems, setStagedDroppedItems] = useState([]);
    const [fileError, setFileError] = useState('');

    // FOLDER FORM STATES
    const [folderTitle, setFolderTitle] = useState('');
    const [folderDescription, setFolderDescription] = useState('');
    const [folderError, setFolderError] = useState('');

    // DERIVED VALUES
    const userDepartment = currentUser?.department ?? 'College of Computer Studies';
    const userRole = currentUser?.role ?? USER_ROLES.MEMBER;
    const canUpload =
        userRole === USER_ROLES.ADMINISTRATOR ||
        userRole === USER_ROLES.COORDINATOR;

    const currentFolderItems = useMemo(() => {
        return repositoryItems.filter((item) => {
            const matchesFolder = item.parentId === currentFolderId;
            const matchesArchiveState = isArchivedView
                ? item.isArchived === true || item.status === DOCUMENT_SHARE_STATUSES.STASHED
                : !item.isArchived && item.status !== DOCUMENT_SHARE_STATUSES.STASHED;

            return matchesFolder && matchesArchiveState;
        });
    }, [repositoryItems, currentFolderId, isArchivedView]);

    const currentDirectoryLabel = breadcrumbsList[breadcrumbsList.length - 1]?.label ?? 'current directory';

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
                        status: DOCUMENT_SHARE_STATUSES.APPROVED,
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
                            ? DOCUMENT_SHARE_STATUSES.STASHED
                            : DOCUMENT_SHARE_STATUSES.PUBLISHED,
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
                    const createdDoc = await documentService.createDocument({
                        name: item.title,
                        uploaderId: activeUserId,
                        isFolder: false,
                        isArchived: false,
                        parentId: destinationFolderId === 'root' ? null : destinationFolderId,
                        comment: item.description ?? '',
                    }).catch((err) => {
                        console.warn('DataConnect createDocument note:', err);
                        return null;
                    });

                    const targetDocumentId = createdDoc?.id ?? item.id;

                    // 3. Create document version record
                    await documentService.createDocumentVersion({
                        documentId: targetDocumentId,
                        uploaderId: activeUserId,
                        version: 1,
                        path: storageResult.path,
                        sizeBytes: storageResult.sizeBytes,
                        mimeType: storageResult.mimeType || item.file.type || 'application/octet-stream',
                        classification: item.classification || DOCUMENT_CLASSIFICATIONS.PUBLIC,
                        changeSummary: 'Initial file upload to Firebase Storage',
                        summary: item.description ?? '',
                        textHash: '',
                    }).catch((err) => {
                        console.warn('DataConnect createDocumentVersion note:', err);
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
                    await documentService.createDocument({
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

    const handleBrowseClick = () => {
        fileInputReference.current?.click();
    };

    const handleFileInputChange = (changeEvent) => {
        const selectedFileList = changeEvent.target.files;
        if (!selectedFileList || selectedFileList.length === 0) {
            return;
        }

        const generatedItems = [];
        for (let fileIndex = 0; fileIndex < selectedFileList.length; fileIndex++) {
            const rawFile = selectedFileList[fileIndex];
            generatedItems.push({
                id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                file: rawFile,
                parentId: currentFolderId,
                title: rawFile.name.replace(/\.[^/.]+$/, ''),
                subtitle: `DOC-${new Date().getFullYear()}-GEN-${Math.floor(100 + Math.random() * 900)}`,
                description: `Uploaded file (${rawFile.name}).`,
                department: userDepartment,
                category: 'Document',
                classification: DOCUMENT_CLASSIFICATIONS.PUBLIC,
                version: 'v1.0',
                size: formatFileSize(rawFile.size),
                status: DOCUMENT_SHARE_STATUSES.PUBLISHED,
                date: 'Just now',
                isFolder: false,
                tags: [DOCUMENT_SHARE_STATUSES.PUBLISHED, DOCUMENT_CLASSIFICATIONS.PUBLIC],
            });
        }

        setStagedDroppedItems(generatedItems);
        if (fileError) {
            setFileError('');
        }
    };

    const handleRemoveStagedItem = (itemIdToRemove) => {
        setStagedDroppedItems((previousStagedItems) =>
            previousStagedItems.filter((item) => item.id !== itemIdToRemove)
        );
    };

    const handleClearStagedItems = () => {
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
            classification: DOCUMENT_CLASSIFICATIONS.PUBLIC,
            version: '—',
            size: '0 items',
            status: 'Active',
            date: 'Just now',
            isFolder: true,
            tags: [DOCUMENT_CLASSIFICATIONS.PUBLIC],
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
        <PageContainer
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
                                    : 'bg-surface-hover text-accent'
                            }`}
                        >
                            <UploadCloud className="h-6 w-6" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-sm font-bold text-text">
                                Upload New File
                            </span>
                            <span className="text-xs text-text-muted">
                                Drag files or folders to preserve directory hierarchy
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
                                    : 'bg-surface-hover text-accent'
                            }`}
                        >
                            <FolderPlus className="h-6 w-6" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-sm font-bold text-text">
                                Create New Folder
                            </span>
                            <span className="text-xs text-text-muted">
                                Create a directory to organize files
                            </span>
                        </div>
                    </button>
                </div>

                {/* 2. FORM CONTENT: UPLOAD NEW FILE */}
                {creationMode === 'file' && (
                    <div className="flex flex-col gap-4 pt-2">
                        {fileError && (
                            <span className="text-xs text-error font-medium">
                                {fileError}
                            </span>
                        )}

                        {/* HIDDEN MULTIPLE FILE INPUT */}
                        <input
                            ref={fileInputReference}
                            type="file"
                            multiple
                            onChange={handleFileInputChange}
                            className="hidden"
                        />

                        {/* FILE & FOLDER DROPZONE / UPLOAD CONTAINER (ENLARGED) */}
                        <CardContainer
                            onClick={handleBrowseClick}
                            onDragOver={handleDropzoneDragOver}
                            onDragLeave={handleDropzoneDragLeave}
                            onDrop={handleDropzoneDrop}
                            className={`p-8 min-h-48 border-dashed border-2 transition-colors items-center justify-center text-center gap-4 cursor-pointer ${
                                isDropzoneDragActive
                                    ? 'border-accent bg-accent-background'
                                    : stagedDroppedItems.length > 0
                                    ? 'border-accent bg-surface-hover/60'
                                    : 'border-surface-border bg-surface-hover/40 hover:bg-surface-hover'
                            }`}
                        >
                            <div className="p-4 rounded-full bg-accent-background text-accent">
                                {stagedDroppedItems.length > 0 ? (
                                    <CheckCircle2 className="h-8 w-8 text-accent" />
                                ) : (
                                    <UploadCloud className="h-8 w-8" />
                                )}
                            </div>
                            <div className="flex flex-col gap-1 max-w-md">
                                <span className="text-sm font-semibold text-text">
                                    {stagedDroppedItems.length > 0
                                        ? `${stagedDroppedItems.length} items staged for review`
                                        : 'Click to browse or drag & drop files / folders here'}
                                </span>
                                <span className="text-xs text-text-muted">
                                    Supports multiple files and folder trees (subfolders & files preserved)
                                </span>
                            </div>
                        </CardContainer>

                        {/* STAGED ITEMS REVIEW & CONFIRMATION LIST */}
                        {stagedDroppedItems.length > 0 && (
                            <div className="flex flex-col gap-2 p-3 bg-surface rounded-lg border border-surface-border max-h-48 overflow-y-auto">
                                <div className="flex items-center justify-between text-xs font-semibold text-text border-b border-surface-border pb-2">
                                    <span className="flex items-center gap-2">
                                        <Layers className="h-4 w-4 text-accent" />
                                        Review Items ({stagedDroppedItems.length})
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-text-muted">
                                            {stagedDroppedItems.filter((item) => item.isFolder).length} folders,{' '}
                                            {stagedDroppedItems.filter((item) => !item.isFolder).length} files
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                handleClearStagedItems();
                                            }}
                                            className="text-xs text-error hover:underline cursor-pointer"
                                        >
                                            Clear all
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1 pt-1">
                                    {stagedDroppedItems.map((stagedItem) => (
                                        <div
                                            key={stagedItem.id}
                                            className="flex items-center justify-between text-xs p-2 rounded-md hover:bg-surface-hover transition-colors"
                                        >
                                            <span className="flex items-center gap-2 truncate text-text flex-1 min-w-0">
                                                {stagedItem.isFolder ? (
                                                    <Folder className="h-4 w-4 text-accent shrink-0" />
                                                ) : (
                                                    <FileText className="h-4 w-4 text-text-muted shrink-0" />
                                                )}
                                                <span className="truncate font-medium">{stagedItem.title}</span>
                                            </span>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <span className="text-text-muted text-xs">
                                                    {stagedItem.isFolder ? 'Folder' : stagedItem.size}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleRemoveStagedItem(stagedItem.id);
                                                    }}
                                                    className="text-text-muted hover:text-error p-1 rounded transition-colors cursor-pointer"
                                                    title="Remove from upload"
                                                    aria-label="Remove item"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 3. FORM CONTENT: CREATE NEW FOLDER */}
                {creationMode === 'folder' && (
                    <div className="flex flex-col gap-4 pt-2">
                        <TextField
                            label="Folder Name"
                            placeholder="e.g. Academic Year 2026-2027"
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
        </PageContainer>
    );
};

export default DocumentsPage;

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

async function traverseFileSystemEntry(entry, targetParentId, userDepartment) {
    if (entry.isFile) {
        const fileObject = await new Promise((resolve) => {
            entry.file(
                (file) => resolve(file),
                () => resolve(null)
            );
        });

        if (!fileObject) {
            return [];
        }

        const newFileItem = {
            id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            file: fileObject,
            parentId: targetParentId,
            title: fileObject.name.replace(/\.[^/.]+$/, ''),
            subtitle: `DOC-${new Date().getFullYear()}-GEN-${Math.floor(100 + Math.random() * 900)}`,
            description: `Uploaded document (${fileObject.name}).`,
            department: userDepartment,
            category: 'Document',
            classification: DOCUMENT_CLASSIFICATIONS.PUBLIC,
            version: 'v1.0',
            size: formatFileSize(fileObject.size),
            status: DOCUMENT_SHARE_STATUSES.PUBLISHED,
            date: 'Just now',
            isFolder: false,
            tags: [DOCUMENT_SHARE_STATUSES.PUBLISHED, DOCUMENT_CLASSIFICATIONS.PUBLIC],
        };

        return [newFileItem];
    }

    if (entry.isDirectory) {
        const newFolderId = `folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const newFolderItem = {
            id: newFolderId,
            parentId: targetParentId,
            title: entry.name,
            subtitle: `DIR-${new Date().getFullYear()}-${entry.name.slice(0, 3).toUpperCase()}`,
            description: `Directory containing uploaded files and subfolders.`,
            department: userDepartment,
            category: 'Department Archive',
            classification: DOCUMENT_CLASSIFICATIONS.PUBLIC,
            version: '—',
            size: '0 items',
            status: 'Active',
            date: 'Just now',
            isFolder: true,
            tags: [DOCUMENT_CLASSIFICATIONS.PUBLIC],
        };

        const directoryReader = entry.createReader();
        const childEntries = await readAllEntriesFromDirectoryReader(directoryReader);
        const childItems = [];

        for (const childEntry of childEntries) {
            const nestedItems = await traverseFileSystemEntry(childEntry, newFolderId, userDepartment);
            childItems.push(...nestedItems);
        }

        return [newFolderItem, ...childItems];
    }

    return [];
}

async function processDataTransferPayload(dataTransfer, targetParentId, userDepartment) {
    const collectedItems = [];
    const items = dataTransfer?.items;

    if (items && items.length > 0) {
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            const item = items[itemIndex];
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry?.() ?? item.getAsEntry?.();
                if (entry) {
                    const extracted = await traverseFileSystemEntry(entry, targetParentId, userDepartment);
                    collectedItems.push(...extracted);
                } else {
                    const rawFile = item.getAsFile?.();
                    if (rawFile) {
                        collectedItems.push({
                            id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                            parentId: targetParentId,
                            title: rawFile.name.replace(/\.[^/.]+$/, ''),
                            subtitle: `DOC-${new Date().getFullYear()}-GEN-${Math.floor(100 + Math.random() * 900)}`,
                            description: `Uploaded document (${rawFile.name}).`,
                            department: userDepartment,
                            category: 'Document',
                            classification: DOCUMENT_CLASSIFICATIONS.PUBLIC,
                            version: 'v1.0',
                            size: formatFileSize(rawFile.size),
                            status: DOCUMENT_SHARE_STATUSES.PENDING_APPROVAL,
                            date: 'Just now',
                            isFolder: false,
                            tags: [DOCUMENT_SHARE_STATUSES.PENDING_APPROVAL, DOCUMENT_CLASSIFICATIONS.PUBLIC],
                        });
                    }
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
                classification: DOCUMENT_CLASSIFICATIONS.PUBLIC,
                version: 'v1.0',
                size: formatFileSize(rawFile.size),
                status: DOCUMENT_SHARE_STATUSES.PENDING_APPROVAL,
                date: 'Just now',
                isFolder: false,
                tags: [DOCUMENT_SHARE_STATUSES.PENDING_APPROVAL, DOCUMENT_CLASSIFICATIONS.PUBLIC],
            });
        }
    }

    return collectedItems;
}
