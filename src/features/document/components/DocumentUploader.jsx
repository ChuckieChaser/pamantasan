// --- IMPORTS ---
import { FileUp, HardDrive, Upload, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { FormField } from '../../../components/forms/FormField';
import { Input } from '../../../components/forms/Input';
import { Select } from '../../../components/forms/Select';
import { Modal } from '../../../components/feedback/Modal';
import { useToast } from '../../../components/feedback/ToastProvider';
import { useDocumentUpload } from '../hooks/useDocumentUpload';
import { DOCUMENT_CLASSIFICATION } from '../documentConstants';


// --- CONFIGURATIONS ---
const CLASSIFICATION_OPTIONS = Object.values(DOCUMENT_CLASSIFICATION).map((cls) => ({
    value: cls,
    label: cls.replace(/_/g, ' '),
}));

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};


// --- COMPONENTS ---
export const DocumentUploader = ({
    isOpen = false,
    onClose,
    parentId = null,
    currentUserId,
    onUploadComplete,
}) => {
    // --- HOOKS & STATE ---
    const { toast } = useToast();

    const {
        selectedFile,
        title,
        classification,
        isUploading,
        uploadProgress,
        fileInputRef,
        setTitle,
        setClassification,
        handleFileSelect,
        handleClearFile,
        handleDrop,
        handleUpload,
    } = useDocumentUpload({
        parentId,
        currentUserId,
        onSuccess: (createdRecord, file) => {
            toast.success('Document uploaded', `${file.name} was successfully stored and indexed.`);
            onUploadComplete?.(createdRecord);
        },
        onClose,
    });

    const onSubmit = async (event) => {
        if (!selectedFile) {
            toast.warning('No file selected', 'Please choose a document to upload.');
            return;
        }

        const toastId = toast.loading('Uploading document...', selectedFile.name);
        try {
            await handleUpload(event);
            toast.dismiss(toastId);
        } catch (err) {
            toast.dismiss(toastId);
            toast.error('Upload failed', err?.message || 'Could not complete file upload.', err);
        }
    };

    // --- RENDER ---
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Upload Document"
            description="Upload binary records, policies, forms, or transcripts to storage."
            icon={FileUp}
            confirmLabel="Start Upload"
            onConfirm={onSubmit}
            isConfirmLoading={isUploading}
            isConfirmDisabled={!selectedFile}
            size="md"
        >
            <div className="flex flex-col gap-4 py-1">
                {/* Drag & Drop Zone */}
                {!selectedFile ? (
                    <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className="p-6 border-2 border-dashed border-surface-border hover:border-accent rounded-xl bg-surface-hover/40 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors text-center touch-manipulation select-none"
                    >
                        <div className="h-10 w-10 rounded-full bg-accent-background text-accent flex items-center justify-center">
                            <Upload className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-text">
                                Tap to select or drag and drop
                            </span>
                            <span className="text-xs text-text-muted mt-0.5">
                                PDF, DOCX, XLSX, images up to 50MB
                            </span>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                    </div>
                ) : (
                    /* Selected File Card */
                    <Card
                        variant="subtle"
                        padding="sm"
                        className="flex-row items-center justify-between gap-3"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-lg bg-surface border border-surface-border flex items-center justify-center shrink-0 text-accent">
                                <HardDrive className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-semibold text-text truncate">
                                    {selectedFile.name}
                                </span>
                                <span className="text-xs text-text-muted">
                                    {formatBytes(selectedFile.size)} • {selectedFile.type || 'Binary'}
                                </span>
                            </div>
                        </div>

                        {!isUploading && (
                            <button
                                type="button"
                                onClick={handleClearFile}
                                className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </Card>
                )}

                {/* Document Metadata Form */}
                <FormField label="Document Title" isRequired>
                    <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Annual Academic Report 2026"
                        isDisabled={isUploading}
                    />
                </FormField>

                <FormField label="Security Classification">
                    <Select
                        value={classification}
                        onChange={(e) => setClassification(e.target.value)}
                        options={CLASSIFICATION_OPTIONS}
                        isDisabled={isUploading}
                    />
                </FormField>
            </div>
        </Modal>
    );
};
