// --- IMPORTS ---
import { create } from 'zustand';
import {
    DocumentInsertSchema,
    DocumentUpdateSchema,
    DocumentVersionInsertSchema,
    DocumentShareInsertSchema,
    DocumentShareUpdateSchema,
} from '../schemas';
import {
    DOCUMENT_TYPES,
    DOCUMENT_SHARE_STATUSES,
} from '../constants';
import { documentService } from '../services';

// --- STORE DEFINITION ---
const useDocumentStore = create((set, get) => ({
    // STATE
    documents: [],
    documentVersions: [],
    versions: [],
    documentShares: [],
    shares: [],
    selectedDocument: null,
    selectedVersion: null,
    isLoading: false,
    error: null,

    // 1. DOCUMENTS ACTIONS
    fetchDocuments: async (filterOptions = {}) => {
        set({ isLoading: true, error: null });

        try {
            const isArchived = filterOptions.isArchived ?? false;
            const liveDocuments = await documentService.fetchDocuments(isArchived);
            let resultDocuments = [...liveDocuments];

            if (filterOptions.type === DOCUMENT_TYPES.FOLDER) {
                resultDocuments = resultDocuments.filter((doc) => doc.is_folder);
            } else if (filterOptions.type === DOCUMENT_TYPES.FILE) {
                resultDocuments = resultDocuments.filter((doc) => !doc.is_folder);
            }

            if (filterOptions.searchQuery) {
                const query = filterOptions.searchQuery.toLowerCase();
                resultDocuments = resultDocuments.filter((doc) =>
                    doc.name.toLowerCase().includes(query) ||
                    (doc.comment && doc.comment.toLowerCase().includes(query))
                );
            }

            set({ documents: liveDocuments, isLoading: false });
            return resultDocuments;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to fetch documents.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    fetchDocumentById: async (documentId) => {
        set({ isLoading: true, error: null });

        try {
            let document = get().documents.find((item) => item.id === documentId);
            if (!document) {
                document = await documentService.fetchDocumentById(documentId);
            }
            set({ selectedDocument: document, isLoading: false });
            return document;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to fetch document by identifier.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    createDocument: async (documentPayload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedData = DocumentInsertSchema.parse(documentPayload);
            const created = await documentService.createDocument(validatedData);

            const newDocument = created ?? {
                id: validatedData.id ?? `doc-${Date.now()}`,
                name: validatedData.name,
                uploader_id: validatedData.uploader_id,
                is_folder: validatedData.is_folder ?? false,
                is_archived: validatedData.is_archived ?? false,
                parent_id: validatedData.parent_id ?? null,
                comment: validatedData.comment ?? '',
            };

            set((state) => ({
                documents: [...state.documents, newDocument],
                isLoading: false,
            }));

            return newDocument;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to create document record.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    updateDocument: async (documentId, documentUpdates) => {
        set({ isLoading: true, error: null });

        try {
            const validatedUpdates = DocumentUpdateSchema.parse(documentUpdates);
            const targetDocument = get().documents.find((item) => item.id === documentId);

            const updatedDocument = {
                ...(targetDocument ?? {}),
                ...validatedUpdates,
                id: documentId,
            };

            set((state) => ({
                documents: state.documents.map((item) =>
                    item.id === documentId ? updatedDocument : item
                ),
                selectedDocument: state.selectedDocument?.id === documentId
                    ? updatedDocument
                    : state.selectedDocument,
                isLoading: false,
            }));

            return updatedDocument;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to update document record.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    deleteDocument: async (documentId) => {
        set({ isLoading: true, error: null });

        try {
            set((state) => ({
                documents: state.documents.filter((item) => item.id !== documentId),
                selectedDocument: state.selectedDocument?.id === documentId
                    ? null
                    : state.selectedDocument,
                isLoading: false,
            }));

            return true;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to delete document record.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    // 2. DOCUMENT VERSIONS ACTIONS
    fetchDocumentVersions: async (documentId) => {
        set({ isLoading: true, error: null });

        try {
            const versions = await documentService.fetchDocumentVersions(documentId);
            set({ documentVersions: versions, versions, isLoading: false });
            return versions;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to fetch document versions.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    createDocumentVersion: async (versionPayload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedData = DocumentVersionInsertSchema.parse(versionPayload);
            const created = await documentService.createDocumentVersion(validatedData);

            const newVersion = created ?? {
                id: validatedData.id ?? `ver-${Date.now()}`,
                ...validatedData,
            };

            set((state) => ({
                documentVersions: [newVersion, ...state.documentVersions],
                versions: [newVersion, ...state.documentVersions],
                isLoading: false,
            }));

            return newVersion;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to create document version.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    revertDocumentVersion: async (documentId, targetVersionObject, currentUserId) => {
        set({ isLoading: true, error: null });

        try {
            const allDocVersions = get().documentVersions.filter(
                (v) => (v.document_id ?? v.documentId) === documentId
            );
            const highestVersion = allDocVersions.reduce(
                (max, v) => Math.max(max, Number(v.version) || 1),
                1
            );
            const nextVersionNumber = highestVersion + 1;

            const newVersionPayload = {
                document_id: documentId,
                documentId: documentId,
                uploader_id: currentUserId ?? targetVersionObject.uploader_id ?? 'f1000001-0000-4000-8000-000000000001',
                uploaderId: currentUserId ?? targetVersionObject.uploader_id ?? 'f1000001-0000-4000-8000-000000000001',
                version: nextVersionNumber,
                path: targetVersionObject.path,
                size_bytes: targetVersionObject.size_bytes ?? targetVersionObject.sizeBytes ?? 1048576,
                sizeBytes: targetVersionObject.size_bytes ?? targetVersionObject.sizeBytes ?? 1048576,
                mime_type: targetVersionObject.mime_type ?? targetVersionObject.mimeType ?? 'application/pdf',
                mimeType: targetVersionObject.mime_type ?? targetVersionObject.mimeType ?? 'application/pdf',
                classification: targetVersionObject.classification ?? 'PUBLIC',
                change_summary: `Reverted to historical snapshot v${targetVersionObject.version}.0`,
                changeSummary: `Reverted to historical snapshot v${targetVersionObject.version}.0`,
                summary: targetVersionObject.summary ?? '',
                text_hash: '',
                textHash: '',
            };

            const createdVersion = await documentService.createDocumentVersion(newVersionPayload).catch(() => null);

            const newVersion = createdVersion ?? {
                id: `ver-${Date.now()}`,
                ...newVersionPayload,
                created_at: new Date().toISOString(),
            };

            set((state) => ({
                documentVersions: [newVersion, ...state.documentVersions],
                versions: [newVersion, ...state.documentVersions],
                isLoading: false,
            }));

            return newVersion;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to revert document version.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    // 3. DOCUMENT SHARES ACTIONS
    fetchDocumentShares: async (documentId) => {
        set({ isLoading: true, error: null });

        try {
            const shares = await documentService.fetchDocumentShares(documentId);
            set({ documentShares: shares, shares, isLoading: false });
            return shares;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to fetch document shares.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    createDocumentShare: async (sharePayload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedData = DocumentShareInsertSchema.parse(sharePayload);
            const newShare = {
                id: validatedData.id ?? `share-${Date.now()}`,
                ...validatedData,
                status: validatedData.status ?? DOCUMENT_SHARE_STATUSES.DRAFT,
            };

            set((state) => ({
                documentShares: [...state.documentShares, newShare],
                isLoading: false,
            }));

            return newShare;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to share document.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    updateDocumentShareStatus: async (shareId, statusUpdates) => {
        set({ isLoading: true, error: null });

        try {
            const validatedUpdates = DocumentShareUpdateSchema.parse(statusUpdates);
            set((state) => ({
                documentShares: state.documentShares.map((item) =>
                    item.id === shareId ? { ...item, ...validatedUpdates } : item
                ),
                isLoading: false,
            }));
            return true;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to update share status.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    setSelectedDocument: (document) => {
        set({ selectedDocument: document });
    },

    setSelectedVersion: (version) => {
        set({ selectedVersion: version });
    },

    clearError: () => {
        set({ error: null });
    },
}));

export {
    useDocumentStore,
};

export default useDocumentStore;
