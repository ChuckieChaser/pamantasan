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
} from '../components';
import { useToast } from '../hooks';
import { constants } from '../constants';
import { useDocumentStore, useDepartmentStore } from '../stores';
import { storageService } from '../services';


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
    currentUser = null,
    onSelectDocument = null,
    className,
    ...props
}) => {
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

            return {
                ...doc,
                id: doc.id,
                parentId: doc.parentId ?? 'root',
                name: doc.name || doc.title,
                title: doc.name || doc.title,
                subtitle: isFolder ? 'DIR' : 'Document',
                category: isFolder ? 'Folder' : 'Document',
                isFolder,
                department: dept?.name || dept?.code || 'General',
                classification: isFolder
                    ? null
                    : (latestVer?.classification ?? doc.classification ?? constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED),
                version: isFolder ? '—' : (latestVer?.version ? `v${latestVer.version}.0` : 'v1.0'),
                size: formattedSize,
                sizeBytes: isFolder ? folderSizeBytes : (Number(latestVer?.sizeBytes ?? doc.sizeBytes ?? 0) || 0),
                status: '—',
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

    const handleConfirmDeleteItem = async () => {
        if (!deletingItem) return;
        setIsDeletingItemLoading(true);
        try {
            await useDocumentStore.getState().deleteDocument(deletingItem.id);
            showToast({
                type: 'success',
                title: deletingItem.isFolder ? 'Folder Deleted' : 'Document Deleted',
                description: `"${deletingItem.title || deletingItem.name}" has been permanently removed.`,
            });
            if (selectedDocument?.id === deletingItem.id) {
                setSelectedDocument(null);
                onSelectDocument?.(null);
            }
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
                selectedItem={selectedDocument}
                onSelectItem={handleItemSelect}
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
                    title={`Delete ${deletingItem.isFolder ? 'Folder' : 'Document'}`}
                    description={`Are you sure you want to delete "${deletingItem.title || deletingItem.name}"?`}
                    icon={Trash2}
                    variant="destructive"
                    size="sm"
                    callout="This action cannot be undone and will permanently remove all associated version records from the database and storage files."
                    calloutVariant="destructive"
                    onConfirm={handleConfirmDeleteItem}
                    confirmLabel={isDeletingItemLoading ? 'Deleting...' : `Delete ${deletingItem.isFolder ? 'Folder' : 'Document'}`}
                    cancelLabel="Cancel"
                    isConfirmLoading={isDeletingItemLoading}
                    isConfirmDisabled={isDeletingItemLoading}
                />
            )}
        </Container>
    );
};


// --- HELPERS ---
function getFolderItemCount(folderId, docsList) {
    return (docsList || []).filter((d) => (d.parentId ?? 'root') === folderId).length;
}

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
