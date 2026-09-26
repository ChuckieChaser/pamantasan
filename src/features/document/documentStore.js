// --- DOCUMENT STORE ---
import { create } from 'zustand';
import {
    getDocumentsByParentId,
    getDocumentsByIsArchived,
    getDocumentById,
    createFile,
    createFolder,
    updateDocument,
    updateDocuments,
    deleteDocuments,
    getDocumentVersionsByDocumentId,
    createDocumentVersion,
    updateDocumentVersion,
    updateDocumentVersions,
    getDocumentSharesByDocumentId,
    getDocumentSharesByDepartmentId,
    getDocumentSharesByRecipientId,
    createDocumentShare,
    createDocumentShares,
    updateDocumentShare,
    deleteDocumentShares,
} from './documentService';


// --- STORE ---

export const useDocumentStore = create((set, get) => ({
    // --- STATE ---
    documents: [],
    selectedDocument: null,
    versions: [],
    shares: [],
    isLoading: false,
    isMutating: false,
    error: null,


    // --- DOCUMENTS ---

    fetchDocumentsByParentId: async (filters = {}) => {
        set({ isLoading: true, error: null });
        try {
            const documents = await getDocumentsByParentId(filters);
            set({ documents, isLoading: false });
            return documents;
        } catch (error) {
            set({ isLoading: false, error: error?.message ?? 'Failed to fetch documents.' });
            return [];
        }
    },

    fetchDocumentsByIsArchived: async (filters = {}) => {
        set({ isLoading: true, error: null });
        try {
            const documents = await getDocumentsByIsArchived(filters);
            set({ documents, isLoading: false });
            return documents;
        } catch (error) {
            set({ isLoading: false, error: error?.message ?? 'Failed to fetch archived documents.' });
            return [];
        }
    },

    fetchDocumentById: async (id) => {
        set({ isLoading: true, error: null });
        try {
            const cached = get().documents.find((d) => d?.id === id);
            const document = cached ?? await getDocumentById(id);
            set({ selectedDocument: document, isLoading: false });
            return document;
        } catch (error) {
            set({ isLoading: false, error: error?.message ?? 'Failed to fetch document.' });
            return null;
        }
    },

    createFile: async (payload) => {
        set({ isMutating: true, error: null });
        try {
            const document = await createFile(payload);
            set((state) => ({
                documents: document ? [document, ...state.documents] : state.documents,
                isMutating: false,
            }));
            return document;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to create file.' });
            throw error;
        }
    },

    createFolder: async (payload) => {
        set({ isMutating: true, error: null });
        try {
            const document = await createFolder(payload);
            set((state) => ({
                documents: document ? [document, ...state.documents] : state.documents,
                isMutating: false,
            }));
            return document;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to create folder.' });
            throw error;
        }
    },

    updateDocument: async (id, payload) => {
        set({ isMutating: true, error: null });
        try {
            const updated = await updateDocument(id, payload);
            set((state) => ({
                documents: state.documents.map((d) => (d?.id === id ? { ...d, ...updated } : d)),
                selectedDocument: state.selectedDocument?.id === id ? { ...state.selectedDocument, ...updated } : state.selectedDocument,
                isMutating: false,
            }));
            return updated;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to update document.' });
            throw error;
        }
    },

    updateDocuments: async (ids, payload) => {
        set({ isMutating: true, error: null });
        try {
            const result = await updateDocuments(ids, payload);
            set({ isMutating: false });
            return result;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to update documents.' });
            throw error;
        }
    },

    deleteDocuments: async (ids) => {
        set({ isMutating: true, error: null });
        try {
            const result = await deleteDocuments(ids);
            set((state) => ({
                documents: state.documents.filter((d) => !ids.includes(d?.id)),
                selectedDocument: ids.includes(state.selectedDocument?.id) ? null : state.selectedDocument,
                isMutating: false,
            }));
            return result;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to delete documents.' });
            throw error;
        }
    },


    // --- VERSIONS ---

    fetchVersionsByDocumentId: async (documentId) => {
        set({ isLoading: true, error: null });
        try {
            const versions = await getDocumentVersionsByDocumentId(documentId);
            set({ versions, isLoading: false });
            return versions;
        } catch (error) {
            set({ isLoading: false, error: error?.message ?? 'Failed to fetch document versions.' });
            return [];
        }
    },

    createDocumentVersion: async (payload) => {
        set({ isMutating: true, error: null });
        try {
            const version = await createDocumentVersion(payload);
            set((state) => ({
                versions: version ? [version, ...state.versions] : state.versions,
                isMutating: false,
            }));
            return version;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to create document version.' });
            throw error;
        }
    },

    updateDocumentVersion: async (id, payload) => {
        set({ isMutating: true, error: null });
        try {
            const updated = await updateDocumentVersion(id, payload);
            set((state) => ({
                versions: state.versions.map((v) => (v?.id === id ? { ...v, ...updated } : v)),
                isMutating: false,
            }));
            return updated;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to update document version.' });
            throw error;
        }
    },

    updateDocumentVersions: async (ids, payload) => {
        set({ isMutating: true, error: null });
        try {
            const result = await updateDocumentVersions(ids, payload);
            set({ isMutating: false });
            return result;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to update document versions.' });
            throw error;
        }
    },


    // --- SHARES ---

    fetchSharesByDocumentId: async (documentId) => {
        set({ isLoading: true, error: null });
        try {
            const shares = await getDocumentSharesByDocumentId(documentId);
            set({ shares, isLoading: false });
            return shares;
        } catch (error) {
            set({ isLoading: false, error: error?.message ?? 'Failed to fetch document shares.' });
            return [];
        }
    },

    fetchSharesByDepartmentId: async (departmentId) => {
        try {
            return await getDocumentSharesByDepartmentId(departmentId);
        } catch (error) {
            set({ error: error?.message ?? 'Failed to fetch department shares.' });
            return [];
        }
    },

    fetchSharesByRecipientId: async (recipientId) => {
        try {
            return await getDocumentSharesByRecipientId(recipientId);
        } catch (error) {
            set({ error: error?.message ?? 'Failed to fetch recipient shares.' });
            return [];
        }
    },

    createDocumentShare: async (payload) => {
        set({ isMutating: true, error: null });
        try {
            const share = await createDocumentShare(payload);
            set((state) => ({
                shares: share ? [...state.shares, share] : state.shares,
                isMutating: false,
            }));
            return share;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to create document share.' });
            throw error;
        }
    },

    createDocumentShares: async (dataList) => {
        set({ isMutating: true, error: null });
        try {
            const result = await createDocumentShares(dataList);
            set({ isMutating: false });
            return result;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to create document shares.' });
            throw error;
        }
    },

    updateDocumentShare: async (id, payload) => {
        set({ isMutating: true, error: null });
        try {
            const updated = await updateDocumentShare(id, payload);
            set((state) => ({
                shares: state.shares.map((s) => (s?.id === id ? { ...s, ...updated } : s)),
                isMutating: false,
            }));
            return updated;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to update document share.' });
            throw error;
        }
    },

    deleteDocumentShares: async (ids) => {
        set({ isMutating: true, error: null });
        try {
            const result = await deleteDocumentShares(ids);
            set((state) => ({
                shares: state.shares.filter((s) => !ids.includes(s?.id)),
                isMutating: false,
            }));
            return result;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to delete document shares.' });
            throw error;
        }
    },


    // --- CONTROLS ---

    setSelectedDocument: (document) => set({ selectedDocument: document }),

    clearVersions: () => set({ versions: [] }),

    clearShares: () => set({ shares: [] }),

    clearError: () => set({ error: null }),

    reset: () => set({
        documents: [],
        selectedDocument: null,
        versions: [],
        shares: [],
        isLoading: false,
        isMutating: false,
        error: null,
    }),
}));
