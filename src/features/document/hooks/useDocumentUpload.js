// --- IMPORTS ---
import { useCallback, useRef, useState } from 'react';
import { useDocument } from './useDocument';
import { uploadDocument } from '../services/storageService';
import { DOCUMENT_CLASSIFICATION } from '../documentConstants';


// --- HOOK ---
export const useDocumentUpload = ({
    parentId = null,
    currentUserId,
    onSuccess,
    onClose,
} = {}) => {
    // --- HOOKS & STATE ---
    const { handleCreateFile } = useDocument();
    const fileInputRef = useRef(null);

    const [selectedFile, setSelectedFile] = useState(null);
    const [title, setTitle] = useState('');
    const [classification, setClassification] = useState(DOCUMENT_CLASSIFICATION.UNCLASSIFIED);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState(null);

    // --- FILE SELECTION HELPERS ---
    const applyFile = useCallback((file) => {
        if (!file) return;
        setSelectedFile(file);
        setError(null);
        setTitle((prev) => {
            if (prev.trim()) return prev;
            return file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        });
    }, []);

    const handleFileSelect = useCallback((event) => {
        const file = event?.target?.files?.[0];
        if (file) {
            applyFile(file);
        }
    }, [applyFile]);

    const handleClearFile = useCallback(() => {
        setSelectedFile(null);
        setTitle('');
        setError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);

    // --- DRAG & DROP HANDLERS ---
    const handleDragOver = useCallback((event) => {
        event.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((event) => {
        event.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((event) => {
        event.preventDefault();
        setIsDragging(false);
        const file = event.dataTransfer?.files?.[0];
        if (file) {
            applyFile(file);
        }
    }, [applyFile]);

    // --- UPLOAD HANDLER ---
    const handleUpload = useCallback(async (event) => {
        event?.preventDefault?.();
        if (!selectedFile || !title.trim() || isUploading) return;

        try {
            setIsUploading(true);
            setError(null);
            setUploadProgress(20);

            const documentId = crypto.randomUUID();

            // 1. Upload binary to Firebase Storage
            const uploadResult = await uploadDocument(documentId, selectedFile, 1);
            setUploadProgress(60);

            // 2. Create document record in Data Connect
            const newDoc = await handleCreateFile({
                id: documentId,
                parentId: parentId || null,
                name: title.trim() || selectedFile.name,
                uploaderId: currentUserId,
                path: uploadResult.path,
                sizeBytes: uploadResult.sizeBytes,
                mimeType: uploadResult.mimeType,
                classification: classification,
            });
            setUploadProgress(100);

            onSuccess?.(newDoc, selectedFile);
            handleClearFile();
            onClose?.();
            return newDoc;
        } catch (err) {
            setError(err?.message || 'Failed to upload document.');
            throw err;
        } finally {
            setIsUploading(false);
        }
    }, [selectedFile, title, isUploading, parentId, classification, currentUserId, handleCreateFile, onSuccess, handleClearFile, onClose]);

    const reset = useCallback(() => {
        handleClearFile();
        setClassification(DOCUMENT_CLASSIFICATION.UNCLASSIFIED);
        setUploadProgress(0);
        setIsUploading(false);
        setError(null);
    }, [handleClearFile]);

    return {
        // State
        selectedFile,
        title,
        classification,
        isUploading,
        uploadProgress,
        isDragging,
        error,
        fileInputRef,

        // Mutators
        setTitle,
        setClassification,

        // Handlers
        handleFileSelect,
        handleClearFile,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        handleUpload,
        reset,
    };
};
