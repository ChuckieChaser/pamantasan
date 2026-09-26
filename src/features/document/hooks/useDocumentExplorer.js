// --- IMPORTS ---
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDocument } from './useDocument';


// --- HOOK ---
export const useDocumentExplorer = ({ currentUserId } = {}) => {
    // --- HOOKS & STORE ---
    const {
        documents,
        isLoading,
        isMutating,
        handleGetDocumentsByParentId,
        handleCreateFolder,
        selectedDocument,
        setSelectedDocument,
    } = useDocument();

    // --- NAVIGATION STATE ---
    const [folderStack, setFolderStack] = useState([{ id: null, name: 'Documents' }]);
    const currentFolder = folderStack[folderStack.length - 1];

    // --- FILTER & VIEW STATES ---
    const [searchQuery, setSearchQuery] = useState('');
    const [classificationFilter, setClassificationFilter] = useState('');
    const [viewMode, setViewMode] = useState('grid');

    // --- MODAL STATES ---
    const [isUploaderOpen, setIsUploaderOpen] = useState(false);
    const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [previewDocument, setPreviewDocument] = useState(null);

    // Fetch documents whenever the active parent folder changes
    useEffect(() => {
        handleGetDocumentsByParentId({ parentId: currentFolder.id });
    }, [currentFolder.id, handleGetDocumentsByParentId]);

    // --- COMPUTED / DERIVED ---
    const filteredDocuments = useMemo(() => {
        return (documents ?? []).filter((doc) => {
            const matchesClassification = !classificationFilter || doc.classification === classificationFilter;
            if (!matchesClassification) return false;

            if (!searchQuery.trim()) return true;

            const query = searchQuery.toLowerCase().trim();
            const name = (doc.name ?? '').toLowerCase();
            return name.includes(query);
        });
    }, [documents, searchQuery, classificationFilter]);

    // Sort folders first alphabetically, followed by files alphabetically
    const sortedDocuments = useMemo(() => {
        return [...filteredDocuments].sort((a, b) => {
            if (a.isFolder && !b.isFolder) return -1;
            if (!a.isFolder && b.isFolder) return 1;
            return (a.name || '').localeCompare(b.name || '');
        });
    }, [filteredDocuments]);

    // --- NAVIGATION HANDLERS ---
    const handleNavigateIntoFolder = useCallback((folder) => {
        setFolderStack((prev) => [...prev, { id: folder.id, name: folder.name }]);
        setSelectedDocument(null);
    }, [setSelectedDocument]);

    const handleNavigateBreadcrumb = useCallback((index) => {
        setFolderStack((prev) => prev.slice(0, index + 1));
        setSelectedDocument(null);
    }, [setSelectedDocument]);

    const handleNavigateUp = useCallback(() => {
        setFolderStack((prev) => {
            if (prev.length <= 1) return prev;
            return prev.slice(0, prev.length - 1);
        });
        setSelectedDocument(null);
    }, [setSelectedDocument]);

    // --- ACTION HANDLERS ---
    const handleCreateNewFolder = useCallback(async () => {
        if (!newFolderName.trim()) return;

        const result = await handleCreateFolder({
            id: crypto.randomUUID(),
            name: newFolderName.trim(),
            parentId: currentFolder.id,
            createdById: currentUserId,
        });

        setNewFolderName('');
        setIsNewFolderOpen(false);
        return result;
    }, [newFolderName, currentFolder.id, currentUserId, handleCreateFolder]);

    const refresh = useCallback(() => {
        return handleGetDocumentsByParentId({ parentId: currentFolder.id });
    }, [handleGetDocumentsByParentId, currentFolder.id]);

    return {
        // State
        documents,
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

        // Mutators
        setSearchQuery,
        setClassificationFilter,
        setViewMode,
        setSelectedDocument,
        setPreviewDocument,
        setIsUploaderOpen,
        setIsNewFolderOpen,
        setNewFolderName,

        // Handlers
        handleNavigateIntoFolder,
        handleNavigateBreadcrumb,
        handleNavigateUp,
        handleCreateNewFolder,
        refresh,
    };
};
