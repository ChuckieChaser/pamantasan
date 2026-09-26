// --- IMPORTS ---
import { useEffect, useState } from 'react';
import {
    Calendar,
    Download,
    Eye,
    FileText,
    Folder,
    HardDrive,
    Hash,
    Layers,
    Lock,
    Shield,
    Trash2,
} from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Panel } from '../../../components/layout/Panel';
import { useDialog } from '../../../components/feedback/DialogProvider';
import { useToast } from '../../../components/feedback/ToastProvider';
import { useDocument } from '../hooks/useDocument';
import { useAuth } from '../../auth/hooks/useAuth';
import { getDownloadUrl } from '../services/storageService';
import { DOCUMENT_CLASSIFICATION } from '../documentConstants';


// --- CONFIGURATIONS ---
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
export const DocumentInspector = ({
    document = null,
    isOpen = false,
    onClose,
    onPreview,
}) => {
    // --- HOOKS & STATE ---
    const {
        handleDeleteDocuments,
        handleGetDocumentVersionsByDocumentId,
        versions,
        isMutating,
    } = useDocument();

    const { confirm } = useDialog();
    const { toast } = useToast();
    const { currentUser } = useAuth();
    const canDelete = currentUser?.role === 'ADMINISTRATOR' || currentUser?.role === 'COORDINATOR';

    // Fetch versions when a document is selected
    useEffect(() => {
        if (isOpen && document?.id && !document.isFolder) {
            handleGetDocumentVersionsByDocumentId(document.id).catch(() => {});
        }
    }, [isOpen, document?.id, document?.isFolder, handleGetDocumentVersionsByDocumentId]);

    // Guard: Hidden if no document or not open
    if (!isOpen || !document) {
        return null;
    }

    // --- DERIVED VALUES ---
    const classificationVariant = CLASSIFICATION_BADGE_VARIANT[document.classification] ?? 'neutral';

    // --- HANDLERS ---
    const handleDownload = async () => {
        try {
            const url = await getDownloadUrl(document.storagePath);
            const link = window.document.createElement('a');
            link.href = url;
            link.download = document.originalName || document.name || 'document';
            link.target = '_blank';
            window.document.body.appendChild(link);
            link.click();
            window.document.body.removeChild(link);
        } catch (err) {
            toast.error('Download failed', err?.message, err);
        }
    };

    const handleDelete = async () => {
        const itemType = document.isFolder ? 'Folder' : 'Document';
        const confirmed = await confirm({
            title: `Delete ${itemType}?`,
            description: `Are you sure you want to delete "${document.name}"? This action cannot be reversed.`,
            confirmLabel: `Delete ${itemType}`,
            variant: 'destructive',
            icon: Trash2,
        });

        if (!confirmed) return;

        try {
            await handleDeleteDocuments([document.id]);
            toast.success(`${itemType} deleted`, `"${document.name}" was removed.`);
            onClose?.();
        } catch (err) {
            toast.error(`Failed to delete ${itemType.toLowerCase()}`, err?.message, err);
        }
    };

    // --- RENDER ---
    return (
        <Panel
            isOpen={isOpen}
            onClose={onClose}
            title={document.isFolder ? 'Folder Details' : 'Document Details'}
            subtitle={document.name}
            icon={document.isFolder ? Folder : FileText}
        >
            <div className="flex flex-col gap-6">
                {/* Header Card */}
                <div className="flex flex-col items-center text-center p-4 rounded-xl bg-surface-hover/50 border border-surface-border gap-3">
                    <div className="h-12 w-12 rounded-xl bg-surface border border-surface-border text-accent flex items-center justify-center shrink-0">
                        {document.isFolder ? <Folder className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                    </div>

                    <div className="flex flex-col items-center">
                        <h4 className="text-base font-bold text-text break-words line-clamp-2">
                            {document.name}
                        </h4>
                        {!document.isFolder && (
                            <span className="text-xs text-text-muted mt-0.5">
                                {formatBytes(document.currentSizeBytes)} • {document.currentMimeType || 'Binary'}
                            </span>
                        )}
                    </div>

                    {!document.isFolder && (
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant={classificationVariant} size="sm">
                                {document.classification?.replace(/_/g, ' ')}
                            </Badge>
                        </div>
                    )}
                </div>

                {/* Primary Quick Actions */}
                {!document.isFolder && (
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            variant="secondary"
                            leadingIcon={Eye}
                            label="Preview"
                            onClick={() => onPreview?.(document)}
                        />
                        <Button
                            variant="primary"
                            leadingIcon={Download}
                            label="Download"
                            onClick={handleDownload}
                        />
                    </div>
                )}

                {/* Metadata Properties */}
                <div className="flex flex-col gap-3">
                    <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                        File Attributes
                    </span>

                    <div className="flex flex-col divide-y divide-surface-border text-xs rounded-lg border border-surface-border bg-surface overflow-hidden">
                        <div className="p-3 flex items-center justify-between">
                            <span className="text-text-muted inline-flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5" />
                                <span>Created</span>
                            </span>
                            <span className="font-medium text-text">
                                {document.createdAt ? new Date(document.createdAt).toLocaleDateString() : '—'}
                            </span>
                        </div>

                        {!document.isFolder && (
                            <>
                                <div className="p-3 flex items-center justify-between">
                                    <span className="text-text-muted inline-flex items-center gap-2">
                                        <HardDrive className="h-3.5 w-3.5" />
                                        <span>Size</span>
                                    </span>
                                    <span className="font-semibold text-text">
                                        {formatBytes(document.currentSizeBytes)}
                                    </span>
                                </div>

                                <div className="p-3 flex items-center justify-between">
                                    <span className="text-text-muted inline-flex items-center gap-2">
                                        <Hash className="h-3.5 w-3.5" />
                                        <span>Storage Path</span>
                                    </span>
                                    <span className="font-mono text-[10px] text-text-muted truncate max-w-[170px] select-text">
                                        {document.storagePath || '—'}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Version History List (if document) */}
                {!document.isFolder && (versions?.length > 0) && (
                    <div className="flex flex-col gap-2.5">
                        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                            <Layers className="h-3.5 w-3.5" />
                            <span>Version History ({versions.length})</span>
                        </span>

                        <div className="flex flex-col gap-1.5">
                            {versions.map((ver) => (
                                <div
                                    key={ver.id}
                                    className="p-2.5 rounded-lg border border-surface-border bg-surface text-xs flex items-center justify-between gap-2"
                                >
                                    <div className="flex items-center gap-2">
                                        <Badge variant="neutral" size="sm">
                                            v{ver.versionNumber}
                                        </Badge>
                                        <span className="text-text-muted">
                                            {formatBytes(ver.sizeBytes)}
                                        </span>
                                    </div>
                                    <span className="text-[11px] text-text-muted">
                                        {ver.createdAt ? new Date(ver.createdAt).toLocaleDateString() : ''}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Danger Zone Actions */}
                {canDelete && (
                    <div className="flex flex-col gap-2 pt-2">
                        <Button
                            variant="destructive"
                            leadingIcon={Trash2}
                            label={`Delete ${document.isFolder ? 'Folder' : 'Document'}`}
                            onClick={handleDelete}
                            isLoading={isMutating}
                            className="w-full justify-start"
                        />
                    </div>
                )}
            </div>
        </Panel>
    );
};
