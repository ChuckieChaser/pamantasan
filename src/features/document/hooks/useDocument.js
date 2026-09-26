// --- USE DOCUMENT HOOK ---
import { useCallback } from 'react';
import { useDocumentStore } from '../documentStore';


// --- HOOK ---

export const useDocument = () => {
    const documents = useDocumentStore((s) => s.documents);
    const selectedDocument = useDocumentStore((s) => s.selectedDocument);
    const versions = useDocumentStore((s) => s.versions);
    const shares = useDocumentStore((s) => s.shares);
    const isLoading = useDocumentStore((s) => s.isLoading);
    const isMutating = useDocumentStore((s) => s.isMutating);
    const error = useDocumentStore((s) => s.error);

    const fetchDocumentsByParentId = useDocumentStore((s) => s.fetchDocumentsByParentId);
    const fetchDocumentsByIsArchived = useDocumentStore((s) => s.fetchDocumentsByIsArchived);
    const fetchDocumentById = useDocumentStore((s) => s.fetchDocumentById);
    const createFile = useDocumentStore((s) => s.createFile);
    const createFolder = useDocumentStore((s) => s.createFolder);
    const updateDocument = useDocumentStore((s) => s.updateDocument);
    const updateDocuments = useDocumentStore((s) => s.updateDocuments);
    const deleteDocuments = useDocumentStore((s) => s.deleteDocuments);
    const fetchVersionsByDocumentId = useDocumentStore((s) => s.fetchVersionsByDocumentId);
    const createDocumentVersion = useDocumentStore((s) => s.createDocumentVersion);
    const updateDocumentVersion = useDocumentStore((s) => s.updateDocumentVersion);
    const updateDocumentVersions = useDocumentStore((s) => s.updateDocumentVersions);
    const fetchSharesByDocumentId = useDocumentStore((s) => s.fetchSharesByDocumentId);
    const fetchSharesByDepartmentId = useDocumentStore((s) => s.fetchSharesByDepartmentId);
    const fetchSharesByRecipientId = useDocumentStore((s) => s.fetchSharesByRecipientId);
    const createDocumentShare = useDocumentStore((s) => s.createDocumentShare);
    const createDocumentShares = useDocumentStore((s) => s.createDocumentShares);
    const updateDocumentShare = useDocumentStore((s) => s.updateDocumentShare);
    const deleteDocumentShares = useDocumentStore((s) => s.deleteDocumentShares);
    const setSelectedDocument = useDocumentStore((s) => s.setSelectedDocument);
    const clearError = useDocumentStore((s) => s.clearError);
    const reset = useDocumentStore((s) => s.reset);


    // --- HANDLERS ---

    const handleFetchByParentId = useCallback(
        (filters) => fetchDocumentsByParentId(filters),
        [fetchDocumentsByParentId],
    );

    const handleFetchArchived = useCallback(
        (filters) => fetchDocumentsByIsArchived(filters),
        [fetchDocumentsByIsArchived],
    );

    const handleFetchById = useCallback(
        (id) => fetchDocumentById(id),
        [fetchDocumentById],
    );

    const handleCreateFile = useCallback(
        (payload) => createFile(payload),
        [createFile],
    );

    const handleCreateFolder = useCallback(
        (payload) => createFolder(payload),
        [createFolder],
    );

    const handleUpdateDocument = useCallback(
        (id, payload) => updateDocument(id, payload),
        [updateDocument],
    );

    const handleDeleteDocuments = useCallback(
        (ids) => deleteDocuments(ids),
        [deleteDocuments],
    );

    const handleFetchVersions = useCallback(
        (documentId) => fetchVersionsByDocumentId(documentId),
        [fetchVersionsByDocumentId],
    );

    const handleCreateVersion = useCallback(
        (payload) => createDocumentVersion(payload),
        [createDocumentVersion],
    );

    const handleUpdateVersion = useCallback(
        (id, payload) => updateDocumentVersion(id, payload),
        [updateDocumentVersion],
    );

    const handleFetchShares = useCallback(
        (documentId) => fetchSharesByDocumentId(documentId),
        [fetchSharesByDocumentId],
    );

    const handleCreateShare = useCallback(
        (payload) => createDocumentShare(payload),
        [createDocumentShare],
    );

    const handleDeleteShares = useCallback(
        (ids) => deleteDocumentShares(ids),
        [deleteDocumentShares],
    );


    return {
        // State
        documents,
        selectedDocument,
        versions,
        shares,
        isLoading,
        isMutating,
        error,

        // Handlers
        handleFetchByParentId,
        handleFetchArchived,
        handleFetchById,
        handleCreateFile,
        handleCreateFolder,
        handleUpdateDocument,
        handleDeleteDocuments,
        handleFetchVersions,
        handleCreateVersion,
        handleUpdateVersion,
        handleFetchShares,
        handleCreateShare,
        handleDeleteShares,

        // Direct (for bulk and advanced share ops)
        updateDocuments,
        updateDocumentVersions,
        fetchSharesByDepartmentId,
        fetchSharesByRecipientId,
        createDocumentShares,
        updateDocumentShare,
        setSelectedDocument,
        clearError,
        reset,
    };
};
