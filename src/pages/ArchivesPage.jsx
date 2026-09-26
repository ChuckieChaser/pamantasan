// --- IMPORTS ---
import { useEffect, useMemo, useState } from 'react';
import { Archive, ArrowUpLeft, Search, Trash2, FileText, Folder } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/forms/Input';
import { LoadingSpinner } from '../components/feedback/LoadingSpinner';
import { useToast } from '../components/feedback/ToastProvider';
import { useDocument } from '../features/document/hooks/useDocument';
import { DOCUMENT_CLASSIFICATION } from '../features/document/documentConstants';


// --- CONFIGURATIONS ---
const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const CLASSIFICATION_BADGE_VARIANT = {
    [DOCUMENT_CLASSIFICATION.UNCLASSIFIED]: 'neutral',
    [DOCUMENT_CLASSIFICATION.PUBLIC]:       'success',
    [DOCUMENT_CLASSIFICATION.PRIVATE]:      'information',
    [DOCUMENT_CLASSIFICATION.CONFIDENTIAL]: 'warning',
    [DOCUMENT_CLASSIFICATION.RESTRICTED]:   'error',
};


// --- COMPONENTS ---
export const ArchivesPage = () => {
    // --- HOOKS & STATE ---
    const {
        documents,
        isLoading,
        isMutating,
        handleGetDocumentsByIsArchived,
        handleUpdateDocument,
        handleDeleteDocuments,
    } = useDocument();

    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        handleGetDocumentsByIsArchived({ isArchived: true });
    }, [handleGetDocumentsByIsArchived]);

    // --- DERIVED VALUES ---
    const filteredDocuments = useMemo(() => {
        if (!searchQuery.trim()) return documents ?? [];
        const query = searchQuery.toLowerCase().trim();
        return (documents ?? []).filter((doc) => {
            const name = (doc.name ?? '').toLowerCase();
            return name.includes(query);
        });
    }, [documents, searchQuery]);

    // --- HANDLERS ---
    const handleRestore = async (doc) => {
        try {
            await handleUpdateDocument(doc.id, { isArchived: false, isDirectlyArchived: false });
            toast.success('Document restored', `"${doc.name}" has been unarchived.`);
            handleGetDocumentsByIsArchived({ isArchived: true });
        } catch (err) {
            toast.error('Failed to restore document', err?.message, err);
        }
    };

    const handleDeletePermanent = async (doc) => {
        try {
            await handleDeleteDocuments([doc.id]);
            toast.success('Document deleted', `"${doc.name}" was permanently removed.`);
            handleGetDocumentsByIsArchived({ isArchived: true });
        } catch (err) {
            toast.error('Failed to delete document', err?.message, err);
        }
    };

    // --- RENDER ---
    return (
        <div className="flex-1 w-full h-full p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <div className="flex flex-col gap-5 w-full">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center">
                            <Archive className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-text">Archived Repository</h1>
                            <p className="text-xs text-text-muted">Restore or purge decommissioned files and folders</p>
                        </div>
                    </div>

                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search archived files..."
                        leadingIcon={Search}
                        isClearable
                        onClear={() => setSearchQuery('')}
                        className="sm:w-72"
                    />
                </div>

                {/* Content Viewport */}
                {isLoading && (!documents || documents.length === 0) ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-3">
                        <LoadingSpinner size="lg" variant="accent" label="Loading archives..." />
                    </div>
                ) : filteredDocuments.length === 0 ? (
                    <Card className="py-16 px-4 flex flex-col items-center justify-center text-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-surface-hover flex items-center justify-center text-text-muted">
                            <Archive className="h-6 w-6" />
                        </div>
                        <div className="flex flex-col gap-1 max-w-sm">
                            <span className="text-sm font-semibold text-text">No archived items found</span>
                            <span className="text-xs text-text-muted">
                                {searchQuery ? 'No documents match your search query.' : 'There are currently no archived records in this repository.'}
                            </span>
                        </div>
                    </Card>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-surface-border bg-surface shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-surface-border bg-surface-hover/50 text-[11px] font-semibold text-text-muted uppercase tracking-wider select-none">
                                    <th className="py-3 px-4">Item Name</th>
                                    <th className="py-3 px-4">Size</th>
                                    <th className="py-3 px-4">Classification</th>
                                    <th className="py-3 px-4">Archived Date</th>
                                    <th className="py-3 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-border text-sm">
                                {filteredDocuments.map((doc) => (
                                    <tr key={doc.id} className="hover:bg-surface-hover/60 transition-colors">
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3 min-w-0">
                                                {doc.isFolder ? (
                                                    <Folder className="h-5 w-5 text-accent shrink-0" />
                                                ) : (
                                                    <FileText className="h-5 w-5 text-text-muted shrink-0" />
                                                )}
                                                <span className="font-medium text-text truncate max-w-xs sm:max-w-sm">
                                                    {doc.name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-xs text-text-muted">
                                            {doc.isFolder ? '—' : formatBytes(doc.currentSizeBytes)}
                                        </td>
                                        <td className="py-3 px-4">
                                            <Badge variant={CLASSIFICATION_BADGE_VARIANT[doc.classification] ?? 'neutral'} size="sm">
                                                {doc.classification ?? 'UNCLASSIFIED'}
                                            </Badge>
                                        </td>
                                        <td className="py-3 px-4 text-xs text-text-muted">
                                            {doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString() : '—'}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    leadingIcon={ArrowUpLeft}
                                                    onClick={() => handleRestore(doc)}
                                                    isLoading={isMutating}
                                                >
                                                    Restore
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    leadingIcon={Trash2}
                                                    onClick={() => handleDeletePermanent(doc)}
                                                    isLoading={isMutating}
                                                >
                                                    Purge
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
