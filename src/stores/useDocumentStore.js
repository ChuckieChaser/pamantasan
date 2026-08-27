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
    DOCUMENT_CLASSIFICATIONS,
    DOCUMENT_SHARE_STATUSES,
} from '../constants';
import {
    MOCK_DOCUMENTS,
    MOCK_DOCUMENT_VERSIONS,
    MOCK_DOCUMENT_SHARES,
} from '../mocks';

// --- STORE DEFINITION ---
const useDocumentStore = create((set, get) => ({
    // STATE
    documents: MOCK_DOCUMENTS,
    versions: MOCK_DOCUMENT_VERSIONS,
    shares: MOCK_DOCUMENT_SHARES,
    selectedDocument: null,
    isLoading: false,
    error: null,

    // 1. DOCUMENTS CRUD ACTIONS
    fetchDocuments: async (filterOptions = {}) => {
        set({ isLoading: true, error: null });

        try {
            let resultDocuments = [...get().documents];

            if (filterOptions.parentId !== undefined) {
                resultDocuments = resultDocuments.filter(
                    (item) => item.parent_id === filterOptions.parentId
                );
            }

            if (filterOptions.isArchived !== undefined) {
                resultDocuments = resultDocuments.filter(
                    (item) => item.is_archived === filterOptions.isArchived
                );
            }

            if (filterOptions.searchQuery) {
                const query = filterOptions.searchQuery.toLowerCase();
                resultDocuments = resultDocuments.filter((item) =>
                    item.name.toLowerCase().includes(query) ||
                    (item.comment ?? '').toLowerCase().includes(query)
                );
            }

            set({ isLoading: false });
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
            const document = get().documents.find((item) => item.id === documentId) ?? null;
            set({ selectedDocument: document, isLoading: false });
            return document;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to fetch document by identifier.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    fetchDocumentsByParentId: async (parentId) => {
        return get().fetchDocuments({ parentId });
    },

    createDocument: async (documentPayload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedData = DocumentInsertSchema.parse(documentPayload);
            const timestamp = new Date().toISOString();

            const newDocument = {
                id: validatedData.id ?? `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                parent_id: validatedData.parent_id ?? null,
                uploader_id: validatedData.uploader_id,
                name: validatedData.name,
                comment: validatedData.comment ?? null,
                is_folder: validatedData.is_folder ?? false,
                is_archived: validatedData.is_archived ?? false,
                created_at: timestamp,
                updated_at: timestamp,
            };

            set((state) => ({
                documents: [newDocument, ...state.documents],
                isLoading: false,
            }));

            return newDocument;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to create document.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    updateDocument: async (documentId, documentUpdates) => {
        set({ isLoading: true, error: null });

        try {
            const validatedUpdates = DocumentUpdateSchema.parse(documentUpdates);
            const targetDocument = get().documents.find((item) => item.id === documentId);

            if (!targetDocument) {
                throw new Error(`Document with identifier "${documentId}" was not found.`);
            }

            const updatedDocument = {
                ...targetDocument,
                ...validatedUpdates,
                updated_at: new Date().toISOString(),
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
            const errorMessage = error?.message ?? 'Failed to update document.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    deleteDocument: async (documentId) => {
        set({ isLoading: true, error: null });

        try {
            // Find all descendants if folder
            const findDescendantIds = (parentId, allDocs) => {
                const childDocs = allDocs.filter((item) => item.parent_id === parentId);
                let descendantIds = childDocs.map((item) => item.id);

                for (const child of childDocs) {
                    if (child.is_folder) {
                        descendantIds = [...descendantIds, ...findDescendantIds(child.id, allDocs)];
                    }
                }

                return descendantIds;
            };

            const allDescendants = findDescendantIds(documentId, get().documents);
            const idsToDelete = new Set([documentId, ...allDescendants]);

            set((state) => ({
                documents: state.documents.filter((item) => !idsToDelete.has(item.id)),
                versions: state.versions.filter((item) => !idsToDelete.has(item.document_id)),
                shares: state.shares.filter((item) => !idsToDelete.has(item.document_id)),
                selectedDocument: idsToDelete.has(state.selectedDocument?.id)
                    ? null
                    : state.selectedDocument,
                isLoading: false,
            }));

            return true;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to delete document.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    // 2. DOCUMENT VERSIONS ACTIONS
    fetchDocumentVersions: async (documentId) => {
        set({ isLoading: true, error: null });

        try {
            const documentVersions = get().versions
                .filter((item) => item.document_id === documentId)
                .sort((firstVersion, secondVersion) => secondVersion.version - firstVersion.version);

            set({ isLoading: false });
            return documentVersions;
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
            const timestamp = new Date().toISOString();

            // Auto increment version number if not provided
            const existingVersions = get().versions.filter(
                (item) => item.document_id === validatedData.document_id
            );
            const latestVersionNumber = existingVersions.reduce(
                (max, item) => Math.max(max, item.version),
                0
            );

            const newVersion = {
                id: validatedData.id ?? `ver-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                document_id: validatedData.document_id,
                uploader_id: validatedData.uploader_id,
                approver_id: validatedData.approver_id ?? null,
                publisher_id: validatedData.publisher_id ?? null,
                rejecter_id: validatedData.rejecter_id ?? null,
                version: validatedData.version ?? latestVersionNumber + 1,
                checksum: validatedData.checksum ?? null,
                path: validatedData.path,
                size_bytes: validatedData.size_bytes,
                mime_type: validatedData.mime_type,
                classification: validatedData.classification ?? DOCUMENT_CLASSIFICATIONS.UNCLASSIFIED,
                change_summary: validatedData.change_summary ?? null,
                rejection_reason: validatedData.rejection_reason ?? null,
                summary: validatedData.summary ?? null,
                embedding: validatedData.embedding ?? null,
                text_hash: validatedData.text_hash ?? null,
                created_at: timestamp,
                updated_at: timestamp,
            };

            set((state) => ({
                versions: [newVersion, ...state.versions],
                isLoading: false,
            }));

            return newVersion;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to create document version.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    // 3. DOCUMENT SHARES ACTIONS
    fetchDocumentShares: async (documentId) => {
        set({ isLoading: true, error: null });

        try {
            const documentShares = get().shares.filter(
                (item) => item.document_id === documentId
            );
            set({ isLoading: false });
            return documentShares;
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
            const timestamp = new Date().toISOString();

            const newShare = {
                id: validatedData.id ?? `share-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                document_id: validatedData.document_id,
                sharer_id: validatedData.sharer_id,
                recipient_id: validatedData.recipient_id ?? null,
                department_id: validatedData.department_id,
                status: validatedData.status ?? DOCUMENT_SHARE_STATUSES.PENDING_APPROVAL,
                created_at: timestamp,
                updated_at: timestamp,
            };

            set((state) => ({
                shares: [...state.shares, newShare],
                isLoading: false,
            }));

            return newShare;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to create document share.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    updateDocumentShareStatus: async (shareId, statusUpdates) => {
        set({ isLoading: true, error: null });

        try {
            const validatedUpdates = DocumentShareUpdateSchema.parse(statusUpdates);
            const targetShare = get().shares.find((item) => item.id === shareId);

            if (!targetShare) {
                throw new Error(`Share record with identifier "${shareId}" was not found.`);
            }

            const updatedShare = {
                ...targetShare,
                ...validatedUpdates,
                updated_at: new Date().toISOString(),
            };

            set((state) => ({
                shares: state.shares.map((item) =>
                    item.id === shareId ? updatedShare : item
                ),
                isLoading: false,
            }));

            return updatedShare;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to update document share status.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    deleteDocumentShare: async (shareId) => {
        set({ isLoading: true, error: null });

        try {
            set((state) => ({
                shares: state.shares.filter((item) => item.id !== shareId),
                isLoading: false,
            }));

            return true;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to delete document share.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    setSelectedDocument: (document) => {
        set({ selectedDocument: document });
    },

    clearError: () => {
        set({ error: null });
    },
}));

export {
    useDocumentStore,
};

export default useDocumentStore;
