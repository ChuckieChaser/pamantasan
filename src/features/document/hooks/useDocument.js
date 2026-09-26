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

    const getDocumentsByParentId = useDocumentStore((s) => s.getDocumentsByParentId);
    const getDocumentsByIsArchived = useDocumentStore((s) => s.getDocumentsByIsArchived);
    const getDocumentById = useDocumentStore((s) => s.getDocumentById);
    const createFile = useDocumentStore((s) => s.createFile);
    const createFolder = useDocumentStore((s) => s.createFolder);
    const updateDocument = useDocumentStore((s) => s.updateDocument);
    const updateDocuments = useDocumentStore((s) => s.updateDocuments);
    const deleteDocuments = useDocumentStore((s) => s.deleteDocuments);
    const getDocumentVersionsByDocumentId = useDocumentStore((s) => s.getDocumentVersionsByDocumentId);
    const createDocumentVersion = useDocumentStore((s) => s.createDocumentVersion);
    const updateDocumentVersion = useDocumentStore((s) => s.updateDocumentVersion);
    const updateDocumentVersions = useDocumentStore((s) => s.updateDocumentVersions);
    const getDocumentSharesByDocumentId = useDocumentStore((s) => s.getDocumentSharesByDocumentId);
    const getDocumentSharesByDepartmentId = useDocumentStore((s) => s.getDocumentSharesByDepartmentId);
    const getDocumentSharesByRecipientId = useDocumentStore((s) => s.getDocumentSharesByRecipientId);
    const createDocumentShare = useDocumentStore((s) => s.createDocumentShare);
    const createDocumentShares = useDocumentStore((s) => s.createDocumentShares);
    const updateDocumentShare = useDocumentStore((s) => s.updateDocumentShare);
    const deleteDocumentShares = useDocumentStore((s) => s.deleteDocumentShares);
    const setSelectedDocument = useDocumentStore((s) => s.setSelectedDocument);
    const clearError = useDocumentStore((s) => s.clearError);
    const reset = useDocumentStore((s) => s.reset);


    // --- HANDLERS ---

    const handleGetDocumentsByParentId = useCallback(
        (filters) => getDocumentsByParentId(filters),
        [getDocumentsByParentId],
    );

    const handleGetDocumentsByIsArchived = useCallback(
        (filters) => getDocumentsByIsArchived(filters),
        [getDocumentsByIsArchived],
    );

    const handleGetDocumentById = useCallback(
        (id) => getDocumentById(id),
        [getDocumentById],
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

    const handleGetDocumentVersionsByDocumentId = useCallback(
        (documentId) => getDocumentVersionsByDocumentId(documentId),
        [getDocumentVersionsByDocumentId],
    );

    const handleCreateDocumentVersion = useCallback(
        (payload) => createDocumentVersion(payload),
        [createDocumentVersion],
    );

    const handleUpdateDocumentVersion = useCallback(
        (id, payload) => updateDocumentVersion(id, payload),
        [updateDocumentVersion],
    );

    const handleGetDocumentSharesByDocumentId = useCallback(
        (documentId) => getDocumentSharesByDocumentId(documentId),
        [getDocumentSharesByDocumentId],
    );

    const handleCreateDocumentShare = useCallback(
        (payload) => createDocumentShare(payload),
        [createDocumentShare],
    );

    const handleDeleteDocumentShares = useCallback(
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
        handleGetDocumentsByParentId,
        handleGetDocumentsByIsArchived,
        handleGetDocumentById,
        handleCreateFile,
        handleCreateFolder,
        handleUpdateDocument,
        handleDeleteDocuments,
        handleGetDocumentVersionsByDocumentId,
        handleCreateDocumentVersion,
        handleUpdateDocumentVersion,
        handleGetDocumentSharesByDocumentId,
        handleCreateDocumentShare,
        handleDeleteDocumentShares,

        // Direct
        updateDocuments,
        updateDocumentVersions,
        getDocumentSharesByDepartmentId,
        getDocumentSharesByRecipientId,
        createDocumentShares,
        updateDocumentShare,
        setSelectedDocument,
        clearError,
        reset,
    };
};
