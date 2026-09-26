// --- IMPORTS ---
import { useEffect, useState } from 'react';
import { Download, ExternalLink, Eye, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/feedback/Modal';
import { useToast } from '../../../components/feedback/ToastProvider';
import { getDownloadUrl } from '../services/storageService';


// --- COMPONENTS ---
export const DocumentViewerModal = ({
    document = null,
    isOpen = false,
    onClose,
}) => {
    // --- HOOKS & STATE ---
    const { toast } = useToast();
    const [downloadUrl, setDownloadUrl] = useState(null);
    const [isLoadingUrl, setIsLoadingUrl] = useState(false);

    // Resolve URL on open
    useEffect(() => {
        if (!isOpen || !document || document.isFolder) {
            setDownloadUrl(null);
            return;
        }

        let isCancelled = false;
        setIsLoadingUrl(true);

        getDownloadUrl(document.storagePath)
            .then((url) => {
                if (!isCancelled) {
                    setDownloadUrl(url);
                }
            })
            .catch((err) => {
                if (!isCancelled) {
                    toast.error('Failed to load document preview', err?.message, err);
                }
            })
            .finally(() => {
                if (!isCancelled) {
                    setIsLoadingUrl(false);
                }
            });

        return () => {
            isCancelled = true;
        };
    }, [isOpen, document, toast]);

    // Guard: Hidden if not open or no document
    if (!isOpen || !document) {
        return null;
    }

    // --- DERIVED VALUES ---
    const mimeType = (document.currentMimeType || '').toLowerCase();
    const isPdf = mimeType.includes('pdf') || document.name?.toLowerCase()?.endsWith('.pdf');
    const isImage = mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(document.name || '');

    // --- HANDLERS ---
    const handleDownload = () => {
        if (!downloadUrl) return;
        const link = window.document.createElement('a');
        link.href = downloadUrl;
        link.download = document.originalName || document.name || 'document';
        link.target = '_blank';
        link.rel = 'noreferrer';
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
    };

    const handleOpenInNewTab = () => {
        if (!downloadUrl) return;
        window.open(downloadUrl, '_blank', 'noreferrer');
    };

    // --- RENDER ---
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={document.name}
            description={document.originalName ?? document.name}
            icon={Eye}
            size="full"
            hasCloseButton
            footerActions={
                <div className="flex items-center justify-between w-full">
                    <Badge variant="neutral" size="sm">
                        {document.classification?.replace(/_/g, ' ')}
                    </Badge>

                    <div className="flex items-center gap-2">
                        {downloadUrl && (
                            <>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    leadingIcon={ExternalLink}
                                    label="Open Full"
                                    onClick={handleOpenInNewTab}
                                />
                                <Button
                                    variant="primary"
                                    size="sm"
                                    leadingIcon={Download}
                                    label="Download"
                                    onClick={handleDownload}
                                />
                            </>
                        )}
                    </div>
                </div>
            }
        >
            <div className="h-full min-h-[50vh] sm:min-h-[65vh] flex items-center justify-center rounded-lg border border-surface-border bg-surface-hover/30 overflow-hidden relative">
                {isLoadingUrl ? (
                    <div className="flex flex-col items-center justify-center gap-2 text-text-muted">
                        <Loader2 className="h-6 w-6 animate-spin text-accent" />
                        <span className="text-xs">Loading document stream...</span>
                    </div>
                ) : !downloadUrl ? (
                    <div className="p-6 text-center text-xs text-text-muted flex flex-col items-center gap-2">
                        <FileText className="h-8 w-8 opacity-40" />
                        <span>Preview could not be rendered</span>
                    </div>
                ) : isPdf ? (
                    <iframe
                        src={`${downloadUrl}#toolbar=1`}
                        title={document.name}
                        className="w-full h-full min-h-[60vh] border-0"
                    />
                ) : isImage ? (
                    <div className="p-4 flex items-center justify-center max-h-[70vh] overflow-auto">
                        <img
                            src={downloadUrl}
                            alt={document.name}
                            className="max-h-[65vh] max-w-full rounded object-contain shadow-xs"
                        />
                    </div>
                ) : (
                    <div className="p-8 text-center flex flex-col items-center justify-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-surface border border-surface-border flex items-center justify-center text-accent">
                            <FileText className="h-6 w-6" />
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-sm font-semibold text-text">{document.name}</span>
                            <span className="text-xs text-text-muted mt-0.5">
                                Preview is not available for this binary format.
                            </span>
                        </div>
                        <Button
                            variant="primary"
                            leadingIcon={Download}
                            label="Download Document File"
                            onClick={handleDownload}
                            className="mt-2"
                        />
                    </div>
                )}
            </div>
        </Modal>
    );
};
