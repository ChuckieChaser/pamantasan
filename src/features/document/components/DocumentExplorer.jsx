// --- IMPORTS ---
import {
    ChevronRight,
    FileText,
    Folder,
    FolderPlus,
    Grid as GridIcon,
    HardDrive,
    List as ListIcon,
    Plus,
    Search,
    Upload,
} from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Input } from '../../../components/forms/Input';
import { Select } from '../../../components/forms/Select';
import { Modal } from '../../../components/feedback/Modal';
import { FormField } from '../../../components/forms/FormField';
import { LoadingSpinner } from '../../../components/feedback/LoadingSpinner';
import { useToast } from '../../../components/feedback/ToastProvider';
import { useDocumentExplorer } from '../hooks/useDocumentExplorer';
import { DOCUMENT_CLASSIFICATION } from '../documentConstants';
import { DocumentUploader } from './DocumentUploader';
import { DocumentInspector } from './DocumentInspector';
import { DocumentViewerModal } from './DocumentViewerModal';
import { useAuth } from '../../auth/hooks/useAuth';


// --- CONFIGURATIONS ---
const VIEW_OPTIONS = [
    { value: 'grid', label: 'Grid', icon: GridIcon },
    { value: 'list', label: 'List', icon: ListIcon },
];

const CLASSIFICATION_FILTER_OPTIONS = [
    { value: '', label: 'All Classifications' },
    ...Object.values(DOCUMENT_CLASSIFICATION).map((cls) => ({
        value: cls,
        label: cls.replace(/_/g, ' '),
    })),
];

const CLASSIFICATION_BADGE_VARIANT = {
    [DOCUMENT_CLASSIFICATION.UNCLASSIFIED]: 'neutral',
    [DOCUMENT_CLASSIFICATION.PUBLIC]:       'success',
    [DOCUMENT_CLASSIFICATION.PRIVATE]:      'information',
    [DOCUMENT_CLASSIFICATION.CONFIDENTIAL]: 'warning',
    [DOCUMENT_CLASSIFICATION.RESTRICTED]:   'error',
};

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};


// --- COMPONENTS ---
export const DocumentExplorer = ({ currentUserId }) => {
    // --- HOOKS & STATE ---
    const { toast } = useToast();
    const { currentUser } = useAuth();
    const canManage = currentUser?.role === 'ADMINISTRATOR' || currentUser?.role === 'COORDINATOR';

    const {
        sortedDocuments,
        folderStack,
        currentFolder,
        searchQuery,
        classificationFilter,
        viewMode,
        isLoading,
        isMutating,
        selectedDocument,
        previewDocument,
        isUploaderOpen,
        isNewFolderOpen,
        newFolderName,
        setSearchQuery,
        setClassificationFilter,
        setViewMode,
        setSelectedDocument,
        setPreviewDocument,
        setIsUploaderOpen,
        setIsNewFolderOpen,
        setNewFolderName,
        handleNavigateIntoFolder,
        handleNavigateBreadcrumb,
        handleCreateNewFolder,
        refresh,
    } = useDocumentExplorer({ currentUserId });

    const onCreateFolderSubmit = async (e) => {
        e?.preventDefault?.();
        if (!newFolderName.trim()) return;

        try {
            await handleCreateNewFolder();
            toast.success('Folder created', `Folder "${newFolderName.trim()}" was created.`);
        } catch (err) {
            toast.error('Failed to create folder', err?.message, err);
        }
    };

    // --- RENDER ---
    return (
        <div className="flex flex-col gap-5 w-full">
            {/* Top Action Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-2xl">
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search files and folders..."
                        leadingIcon={Search}
                        isClearable
                        onClear={() => setSearchQuery('')}
                        className="sm:w-72"
                    />

                    <Select
                        value={classificationFilter}
                        onChange={(e) => setClassificationFilter(e.target.value)}
                        options={CLASSIFICATION_FILTER_OPTIONS}
                        className="sm:w-44"
                    />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <SegmentedControl
                        value={viewMode}
                        onChange={setViewMode}
                        options={VIEW_OPTIONS}
                    />

                    {canManage && (
                        <>
                            <Button
                                variant="secondary"
                                leadingIcon={FolderPlus}
                                label="New Folder"
                                onClick={() => setIsNewFolderOpen(true)}
                            />

                            <Button
                                variant="primary"
                                leadingIcon={Upload}
                                label="Upload"
                                onClick={() => setIsUploaderOpen(true)}
                            />
                        </>
                    )}
                </div>
            </div>

            {/* Breadcrumbs Trail */}
            <div className="flex items-center gap-1.5 py-1 text-xs text-text-muted overflow-x-auto no-scrollbar shrink-0 select-none">
                {folderStack.map((item, index) => {
                    const isLast = index === folderStack.length - 1;
                    return (
                        <div key={item.id ?? 'root'} className="flex items-center gap-1.5 shrink-0">
                            {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-text-muted" />}
                            <button
                                type="button"
                                disabled={isLast}
                                onClick={() => handleNavigateBreadcrumb(index)}
                                className={`rounded px-1.5 py-1 font-medium transition-colors ${
                                    isLast ? 'text-text font-semibold cursor-default' : 'hover:text-text hover:bg-surface-hover cursor-pointer'
                                }`}
                            >
                                {item.name}
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Document Browser Area */}
            {isLoading && (!documents || documents.length === 0) ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                    <LoadingSpinner size="lg" />
                    <span className="text-xs text-text-muted">Loading repository contents...</span>
                </div>
            ) : sortedDocuments.length === 0 ? (
                <div className="py-16 text-center rounded-xl border border-dashed border-surface-border bg-surface/50 p-6 flex flex-col items-center justify-center gap-2">
                    <Folder className="h-8 w-8 text-text-muted opacity-50" />
                    <h3 className="text-sm font-semibold text-text">This folder is empty</h3>
                    <p className="text-xs text-text-muted max-w-sm">
                        No files or folders here. Click "Upload" to store your first document or create a new folder.
                    </p>
                </div>
            ) : viewMode === 'grid' ? (
                /* Grid View */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {sortedDocuments.map((doc) => {
                        const isSelected = selectedDocument?.id === doc.id;
                        const badgeVariant = CLASSIFICATION_BADGE_VARIANT[doc.classification] ?? 'neutral';

                        return (
                            <Card
                                key={doc.id}
                                variant="interactive"
                                padding="sm"
                                onClick={() => doc.isFolder ? handleNavigateIntoFolder(doc) : setSelectedDocument(doc)}
                                className={`flex flex-col items-center text-center justify-between min-h-[140px] select-none ${
                                    isSelected ? 'border-accent ring-1 ring-accent' : ''
                                }`}
                            >
                                <div className="h-12 w-12 rounded-xl bg-surface-hover flex items-center justify-center mt-2 text-text-muted">
                                    {doc.isFolder ? (
                                        <Folder className="h-7 w-7 text-accent" />
                                    ) : (
                                        <FileText className="h-7 w-7 text-text-muted" />
                                    )}
                                </div>

                                <div className="w-full flex flex-col items-center px-1 my-2">
                                    <span className="text-xs font-semibold text-text truncate w-full" title={doc.name}>
                                        {doc.name}
                                    </span>
                                    <span className="text-[10px] text-text-muted mt-0.5">
                                        {doc.isFolder ? 'Folder' : formatBytes(doc.currentSizeBytes)}
                                    </span>
                                </div>

                                {!doc.isFolder && (
                                    <Badge variant={badgeVariant} size="sm" className="scale-90 mb-1">
                                        {doc.classification}
                                    </Badge>
                                )}
                            </Card>
                        );
                    })}
                </div>
            ) : (
                /* List View */
                <div className="overflow-x-auto rounded-xl border border-surface-border bg-surface shadow-xs">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-surface-border bg-surface-hover/50 text-[11px] font-semibold text-text-muted uppercase tracking-wider select-none">
                                <th className="py-3 px-4">Name</th>
                                <th className="py-3 px-4">Size</th>
                                <th className="py-3 px-4">Classification</th>
                                <th className="py-3 px-4">Modified</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-border text-sm">
                            {sortedDocuments.map((doc) => {
                                const isSelected = selectedDocument?.id === doc.id;
                                const badgeVariant = CLASSIFICATION_BADGE_VARIANT[doc.classification] ?? 'neutral';

                                return (
                                    <tr
                                        key={doc.id}
                                        onClick={() => doc.isFolder ? handleNavigateIntoFolder(doc) : setSelectedDocument(doc)}
                                        className={`hover:bg-surface-hover/70 cursor-pointer transition-colors ${
                                            isSelected ? 'bg-accent/5' : ''
                                        }`}
                                    >
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                {doc.isFolder ? (
                                                    <Folder className="h-5 w-5 text-accent shrink-0" />
                                                ) : (
                                                    <FileText className="h-5 w-5 text-text-muted shrink-0" />
                                                )}
                                                <span className="font-medium text-text truncate max-w-sm">
                                                    {doc.name}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="py-3 px-4 text-xs text-text-muted">
                                            {doc.isFolder ? '—' : formatBytes(doc.currentSizeBytes)}
                                        </td>

                                        <td className="py-3 px-4">
                                            {!doc.isFolder ? (
                                                <Badge variant={badgeVariant} size="sm">
                                                    {doc.classification}
                                                </Badge>
                                            ) : (
                                                <span className="text-xs text-text-muted">—</span>
                                            )}
                                        </td>

                                        <td className="py-3 px-4 text-xs text-text-muted">
                                            {doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString() : '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Document Details Inspector */}
            <DocumentInspector
                document={selectedDocument}
                isOpen={Boolean(selectedDocument)}
                onClose={() => setSelectedDocument(null)}
                onPreview={(doc) => setPreviewDocument(doc)}
            />

            {/* Document Previewer Modal */}
            <DocumentViewerModal
                document={previewDocument}
                isOpen={Boolean(previewDocument)}
                onClose={() => setPreviewDocument(null)}
            />

            {/* File Upload Modal */}
            <DocumentUploader
                isOpen={isUploaderOpen}
                onClose={() => setIsUploaderOpen(false)}
                parentId={currentFolder.id}
                currentUserId={currentUserId}
                onUploadComplete={() => {
                    refresh();
                }}
            />

            {/* New Folder Modal */}
            <Modal
                isOpen={isNewFolderOpen}
                onClose={() => setIsNewFolderOpen(false)}
                title="Create New Folder"
                description={`Create a folder inside "${currentFolder.name}".`}
                icon={FolderPlus}
                confirmLabel="Create Folder"
                onConfirm={onCreateFolderSubmit}
                isConfirmLoading={isMutating}
                size="sm"
            >
                <form onSubmit={onCreateFolderSubmit} className="py-1">
                    <FormField label="Folder Name" isRequired>
                        <Input
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="e.g. Official Transcripts"
                            autoFocus
                        />
                    </FormField>
                </form>
            </Modal>
        </div>
    );
};
