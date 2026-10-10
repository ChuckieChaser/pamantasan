// --- IMPORTS ---
import { useState, useMemo, useEffect } from 'react';
import {
    AlertTriangle,
    Trash2,
} from 'lucide-react';
import {
    Browser,
    Container,
    Modal,
    formatDateTime,
    getMimeTypeFromFilename,
} from '../components';
import { getSpecificMimeLabel } from '../components/browser/common';
import { useToast, useAuth } from '../hooks';
import { constants } from '../constants';
import { useDocumentStore, useDepartmentStore, useCoordinatorStore, useAuthStore } from '../stores';
import { storageService, coordinatorApprovalService, systemEventService } from '../services';


// --- CONFIGURATIONS ---
const DOCUMENT_COLUMNS = [
    { key: 'title', label: 'Name' },
    { key: 'classification', label: 'Classification' },
    { key: 'version', label: 'Version' },
    { key: 'size', label: 'Size' },
    { key: 'status', label: 'Status' },
    { key: 'date', label: 'Last Modified' },
];


// --- COMPONENTS ---
const ArchivesPage = ({
    currentUser: propUser = null,
    selectedItem = null,
    selectedItems = [],
    onSelectDocument = null,
    onSelectMultiple = null,
    className,
    ...props
}) => {
    // AUTH RESOLUTION
    const { currentUser: authUser } = useAuth();
    const storeUser = useAuthStore((state) => state.currentUser);
    const currentUser = propUser ?? authUser ?? storeUser ?? useAuthStore.getState().currentUser;
    const isCoordinator = constants.isCoordinatorRole(currentUser?.role);
    // STORES
    const documents = useDocumentStore((state) => state.documents);
    const documentVersions = useDocumentStore((state) => state.documentVersions ?? state.versions ?? []);
    const departments = useDepartmentStore((state) => state.departments);
    const fetchDocuments = useDocumentStore((state) => state.fetchDocuments);
    const fetchDepartments = useDepartmentStore((state) => state.fetchDepartments);

    // STATES
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [restoreConflictModalItem, setRestoreConflictModalItem] = useState(null);
    const [isRestoringConflict, setIsRestoringConflict] = useState(false);
    const [deletingItem, setDeletingItem] = useState(null);
    const [isDeletingItemLoading, setIsDeletingItemLoading] = useState(false);

    // HOOKS
    const { showToast } = useToast();

    // INITIAL DATA FETCH
    useEffect(() => {
        fetchDocuments().catch(() => {});
        fetchDepartments().catch(() => {});
    }, [fetchDocuments, fetchDepartments]);

    // DERIVED VALUES: REPOSITORY ITEMS
    const repositoryItems = useMemo(() => {
        return documents.map((doc) => {
            const isFolder = Boolean(doc.isFolder);
            const docVersions = documentVersions.filter((v) => (v.documentId ?? v.document?.id) === doc.id);
            const latestVer = docVersions.length > 0
                ? [...docVersions].sort((a, b) => b.version - a.version)[0]
                : null;
            const dept = departments.find((d) => d.id === doc.departmentId);

            const folderSizeBytes = isFolder
                ? getRecursiveFolderSizeBytes(doc.id, documents, documentVersions)
                : null;
            const formattedSize = isFolder
                ? formatFileSize(folderSizeBytes)
                : (latestVer?.sizeBytes ? formatFileSize(latestVer.sizeBytes) : '—');

            const dateValue = doc.updatedAt || latestVer?.createdAt || doc.createdAt;
            const formattedDate = dateValue && !isNaN(new Date(dateValue).getTime())
                ? formatDateTime(dateValue)
                : 'Active';

            const effectiveMime = isFolder
                ? 'folder'
                : (latestVer?.mimeType ?? doc.mimeType ?? (doc.name ? getMimeTypeFromFilename(doc.name) : null));
            const subtitleText = isFolder ? 'Directory' : getSpecificMimeLabel(effectiveMime, doc.name || doc.title);

            return {
                ...doc,
                id: doc.id,
                parentId: doc.parentId ?? 'root',
                name: doc.name || doc.title,
                title: doc.name || doc.title,
                subtitle: subtitleText,
                category: isFolder ? 'Folder' : 'Document',
                isFolder,
                fileName: doc.name || doc.title || null,
                path: latestVer?.path ?? doc.path ?? null,
                mimeType: effectiveMime,
                department: dept?.name || dept?.code || 'General',
                classification: isFolder
                    ? null
                    : (latestVer?.classification ?? doc.classification ?? constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED),
                version: isFolder ? '—' : (latestVer?.version ? `v${latestVer.version}.0` : 'v1.0'),
                size: formattedSize,
                sizeBytes: isFolder ? folderSizeBytes : (Number(latestVer?.sizeBytes ?? doc.sizeBytes ?? 0) || 0),
                status: '—',
                createdAt: doc.createdAt || latestVer?.createdAt || doc.updatedAt || null,
                updatedAt: doc.updatedAt || latestVer?.createdAt || doc.createdAt || null,
                rawDate: dateValue || null,
                date: formattedDate,
                tags: isFolder
                    ? ['Folder']
                    : [latestVer?.classification ?? constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED],
            };
        });
    }, [documents, documentVersions, departments]);

    // DERIVED VALUES: ARCHIVED ITEMS ONLY
    const archivedItems = useMemo(() => {
        return repositoryItems.filter((item) => {
            const matchesArchiveState = Boolean(item.isArchived);
            if (!matchesArchiveState) return false;
            // Internal contents of folders archived as a unit are hidden from root
            return item.directlyArchived !== false;
        });
    }, [repositoryItems]);

    // DYNAMIC FILTER OPTIONS
    const dynamicFilterOptions = useMemo(() => {
        const deptOptions = departments.map((dept) => ({
            value: dept.name || dept.code,
            label: dept.name || dept.code,
            category: 'Department',
        }));

        const classOptions = Object.values(constants.DOCUMENT_VERSIONS_CLASSIFICATION).map((cls) => ({
            value: cls,
            label: cls,
            category: 'Classification',
        }));

        return [...deptOptions, ...classOptions];
    }, [departments]);

    // LISTEN FOR EXTERNAL DELETE TRIGGER (E.G. FROM INSPECTOR QUICK ACTION)
    useEffect(() => {
        const handleDeleteDocEvent = (event) => {
            if (event.detail) {
                const targetDoc = Array.isArray(event.detail)
                    ? event.detail
                    : (documents.find((d) => d?.id === event.detail.id) ?? event.detail);
                setDeletingItem(targetDoc);
            }
        };
        window.addEventListener('pamantasan:delete-document', handleDeleteDocEvent);
        return () => window.removeEventListener('pamantasan:delete-document', handleDeleteDocEvent);
    }, [documents]);

    // HANDLERS
    const handleItemSelect = (item) => {
        setSelectedDocument(item);
        onSelectDocument?.(item);
    };

    const handleItemDoubleClick = (item) => {
        if (!item) return;
        if (item.isFolder) {
            showToast({
                type: 'warning',
                title: 'Archived Folder',
                description: 'Cannot browse contents of an archived folder. Restore the folder to view its contents.',
            });
        } else {
            showToast({
                type: 'warning',
                title: 'Archived Document',
                description: 'Cannot view an archived document. Restore the document to view its contents.',
            });
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
            });
        }
    };

    const handleRestoreWithParent = async (item, parentFolder) => {
        try {
            setIsRestoringConflict(true);
            const allDocs = useDocumentStore.getState().documents || [];
            let curr = parentFolder;
            const chain = [];
            while (curr && curr.isArchived) {
                chain.unshift(curr);
                const pId = curr.parentId && curr.parentId !== 'root' ? curr.parentId : null;
                curr = pId ? allDocs.find((d) => d.id === pId) : null;
            }

            for (const folder of chain) {
                await useDocumentStore.getState().archiveDocument(folder.id, false);
            }
            await useDocumentStore.getState().archiveDocument(item.id, false);

            if (selectedDocument?.id === item.id) {
                const updated = { ...selectedDocument, isArchived: false };
                setSelectedDocument(updated);
                onSelectDocument?.(updated);
            }

            showToast({
                type: 'success',
                title: 'Restored with Parent',
                description: `"${item.title || item.name}" and parent folder "${parentFolder.name || parentFolder.title}" restored.`,
            });
            setRestoreConflictModalItem(null);
        } catch (err) {
            showToast({
                type: 'error',
                title: 'Restore Failed',
                description: err?.message || 'Could not restore hierarchy.',
            });
        } finally {
            setIsRestoringConflict(false);
        }
    };

    const handleItemAction = async (actionKey, item) => {
        if (!item) return;

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

        if (actionKey === 'download') {
            const itemsToDownload = Array.isArray(item) ? item : [item];
            if (itemsToDownload.length > 1) {
                showToast({
                    type: 'information',
                    title: 'Batch Download Started',
                    description: `Packaging ${itemsToDownload.length} items into ZIP archive...`,
                });
                try {
                    await storageService.downloadMultipleAsZip(
                        itemsToDownload,
                        documents,
                        documentVersions,
                        'Documents.zip'
                    );
                    showToast({
                        type: 'success',
                        title: 'Batch Download Complete',
                        description: `Packaged ${itemsToDownload.length} items into Documents.zip.`,
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
                    } else {
                        const vers = (documentVersions || []).filter(
                            (v) => (v.document?.id ?? v.documentId) === downloadTarget.id
                        );
                        const latestVer = vers.length > 0
                            ? [...vers].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0]
                            : null;
                        const path = latestVer?.path || downloadTarget.path || downloadTarget.url || downloadTarget.downloadUrl;
                        await storageService.downloadDocument(path, fileName);
                        if (downloadTarget && currentUser?.id) {
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

        if (actionKey === 'restore') {
            const itemsToRestore = Array.isArray(item) ? item : [item];
            for (const singleItem of itemsToRestore) {
                const allDocs = useDocumentStore.getState().documents || [];
                const targetParentId = singleItem.parentId && singleItem.parentId !== 'root' ? singleItem.parentId : null;
                const parentDoc = targetParentId ? allDocs.find((d) => d.id === targetParentId) : null;

                // CHILD RESTORE GUARD: If original parent folder is currently archived, block and prompt
                if (parentDoc && parentDoc.isArchived) {
                    setRestoreConflictModalItem({ item: singleItem, parentFolder: parentDoc });
                    return;
                }

                await performRestoreItem(singleItem);
            }
            onSelectMultiple?.([]);
            return;
        }

        if (actionKey === 'delete') {
            setDeletingItem(item);
            return;
        }
    };

    const handleConfirmDeleteItem = async () => {
        const itemsToDelete = Array.isArray(deletingItem) ? deletingItem : (deletingItem?.id ? [deletingItem] : []);
        if (itemsToDelete.length === 0) return;
        setIsDeletingItemLoading(true);
        try {
            if (isCoordinator) {
                const requesterId = currentUser?.id ?? useAuthStore.getState().currentUser?.id;
                for (const singleItem of itemsToDelete) {
                    const deletePayload = {
                        documentId: singleItem.id,
                        documentTitle: singleItem.title || singleItem.name,
                        isFolder: Boolean(singleItem.isFolder),
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
            for (const singleItem of itemsToDelete) {
                await useDocumentStore.getState().deleteDocument(singleItem.id);
            }
            showToast({
                type: 'success',
                title: itemsToDelete.length > 1 ? 'Documents Deleted' : (itemsToDelete[0].isFolder ? 'Folder Deleted' : 'Document Deleted'),
                description: itemsToDelete.length > 1 ? `${itemsToDelete.length} items permanently deleted.` : `"${itemsToDelete[0].title || itemsToDelete[0].name}" has been permanently deleted.`,
            });
            if (selectedDocument && deleteIds.has(selectedDocument.id)) {
                setSelectedDocument(null);
                onSelectDocument?.(null);
            }
            onSelectMultiple?.([]);
            setDeletingItem(null);
        } catch (err) {
            showToast({
                type: 'error',
                title: 'Delete Failed',
                description: err?.message || 'Could not delete item.',
            });
        } finally {
            setIsDeletingItemLoading(false);
        }
    };

    // RENDER
    return (
        <Container
            variant="page"
            className={`relative ${className ?? ''}`.trim()}
            {...props}
        >
            <Browser
                resourceName="archives"
                title="Manage Archives"
                description="Historical repository, stashed document versions, and inactive department archives."
                data={archivedItems}
                columns={DOCUMENT_COLUMNS}
                filterOptions={dynamicFilterOptions}
                selectedItem={selectedItems.length > 1 ? null : (selectedDocument ?? selectedItem)}
                selectedIds={new Set((selectedItems || []).map((i) => i.id))}
                onSelectItem={handleItemSelect}
                onSelectMultipleItems={onSelectMultiple}
                onDoubleClickItem={handleItemDoubleClick}
                searchPlaceholder="Search archived documents by name, classification..."
                initialView="table"
                onItemAction={handleItemAction}
            />

            {/* PARENT FOLDER ARCHIVED RESTORE GUARD MODAL */}
            {restoreConflictModalItem && (
                <Modal
                    isOpen={Boolean(restoreConflictModalItem)}
                    onClose={() => !isRestoringConflict && setRestoreConflictModalItem(null)}
                    title="Parent Folder Archived"
                    description={`The original parent folder "${restoreConflictModalItem.parentFolder?.name || restoreConflictModalItem.parentFolder?.title || 'Parent Folder'}" is currently archived. To unarchive this item, its parent folder must also be restored.`}
                    icon={AlertTriangle}
                    variant="warning"
                    size="sm"
                    callout="Restoring this item requires unarchiving its enclosing directory structure so it has a valid repository path."
                    calloutVariant="warning"
                    onConfirm={() =>
                        handleRestoreWithParent(
                            restoreConflictModalItem.item,
                            restoreConflictModalItem.parentFolder
                        )
                    }
                    confirmLabel={isRestoringConflict ? 'Restoring...' : 'Unarchive Parent & File'}
                    cancelLabel="Cancel"
                    isConfirmLoading={isRestoringConflict}
                    isConfirmDisabled={isRestoringConflict}
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
                            ? `Are you sure you want to permanently delete ${deletingItem.length} selected items?`
                            : `Are you sure you want to delete "${deletingItem.title || deletingItem.name}"?`
                    }
                    icon={Trash2}
                    variant="destructive"
                    size="sm"
                    callout="This action cannot be undone and will permanently remove all associated version records from the database and storage files."
                    calloutVariant="destructive"
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


// --- EXPORTS ---
export { ArchivesPage };
export default ArchivesPage;
