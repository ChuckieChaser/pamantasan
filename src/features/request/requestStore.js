// --- REQUEST STORE ---
import { create } from 'zustand';
import {
    getRequests,
    getRequestsByRequesterId,
    getRequestById,
    createRequest,
    updateRequest,
    updateRequests,
    deleteRequests,
    getRequestMessagesByRequestId,
    createRequestMessage,
    updateRequestMessage,
    deleteRequestMessages,
    getRequestAttachmentsByRequestId,
    createRequestAttachment,
    createRequestAttachments,
    deleteRequestAttachments,
} from './requestService';


// --- STORE ---

export const useRequestStore = create((set, get) => ({
    // --- STATE ---
    requests: [],
    selectedRequest: null,
    messages: [],
    attachments: [],
    isLoading: false,
    isMutating: false,
    error: null,


    // --- REQUEST QUERIES ---

    getRequests: async (filters = {}) => {
        set({ isLoading: true, error: null });
        try {
            const requests = await getRequests(filters);
            set({ requests, isLoading: false });
            return requests;
        } catch (error) {
            set({ isLoading: false, error: error?.message ?? 'Failed to fetch requests.' });
            return [];
        }
    },

    getRequestsByRequesterId: async (filters = {}) => {
        set({ isLoading: true, error: null });
        try {
            const requests = await getRequestsByRequesterId(filters);
            set({ requests, isLoading: false });
            return requests;
        } catch (error) {
            set({ isLoading: false, error: error?.message ?? 'Failed to fetch user requests.' });
            return [];
        }
    },

    getRequestById: async (id) => {
        set({ isLoading: true, error: null });
        try {
            const cached = get().requests.find((r) => r?.id === id);
            const request = cached ?? await getRequestById(id);
            set({ selectedRequest: request, isLoading: false });
            return request;
        } catch (error) {
            set({ isLoading: false, error: error?.message ?? 'Failed to fetch request.' });
            return null;
        }
    },


    // --- REQUEST MUTATIONS ---

    createRequest: async (payload) => {
        set({ isMutating: true, error: null });
        try {
            const request = await createRequest(payload);
            set((state) => ({
                requests: request ? [request, ...state.requests] : state.requests,
                isMutating: false,
            }));
            return request;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to create request.' });
            throw error;
        }
    },

    updateRequest: async (id, payload) => {
        set({ isMutating: true, error: null });
        try {
            const updated = await updateRequest(id, payload);
            set((state) => ({
                requests: state.requests.map((r) => (r?.id === id ? { ...r, ...updated } : r)),
                selectedRequest: state.selectedRequest?.id === id ? { ...state.selectedRequest, ...updated } : state.selectedRequest,
                isMutating: false,
            }));
            return updated;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to update request.' });
            throw error;
        }
    },

    updateRequests: async (ids, payload) => {
        set({ isMutating: true, error: null });
        try {
            const result = await updateRequests(ids, payload);
            set({ isMutating: false });
            return result;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to update requests.' });
            throw error;
        }
    },

    deleteRequests: async (ids) => {
        set({ isMutating: true, error: null });
        try {
            const result = await deleteRequests(ids);
            set((state) => ({
                requests: state.requests.filter((r) => !ids.includes(r?.id)),
                selectedRequest: ids.includes(state.selectedRequest?.id) ? null : state.selectedRequest,
                isMutating: false,
            }));
            return result;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to delete requests.' });
            throw error;
        }
    },


    // --- MESSAGE QUERIES ---

    getRequestMessagesByRequestId: async (requestId) => {
        set({ isLoading: true, error: null });
        try {
            const messages = await getRequestMessagesByRequestId(requestId);
            set({ messages, isLoading: false });
            return messages;
        } catch (error) {
            set({ isLoading: false, error: error?.message ?? 'Failed to fetch request messages.' });
            return [];
        }
    },


    // --- MESSAGE MUTATIONS ---

    createRequestMessage: async (payload) => {
        set({ isMutating: true, error: null });
        try {
            const message = await createRequestMessage(payload);
            set((state) => ({
                messages: message ? [...state.messages, message] : state.messages,
                isMutating: false,
            }));
            return message;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to create message.' });
            throw error;
        }
    },

    updateRequestMessage: async (id, payload) => {
        set({ isMutating: true, error: null });
        try {
            const updated = await updateRequestMessage(id, payload);
            set((state) => ({
                messages: state.messages.map((m) => (m?.id === id ? { ...m, ...updated } : m)),
                isMutating: false,
            }));
            return updated;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to update message.' });
            throw error;
        }
    },

    deleteRequestMessages: async (ids) => {
        set({ isMutating: true, error: null });
        try {
            const result = await deleteRequestMessages(ids);
            set((state) => ({
                messages: state.messages.filter((m) => !ids.includes(m?.id)),
                isMutating: false,
            }));
            return result;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to delete messages.' });
            throw error;
        }
    },


    // --- ATTACHMENT QUERIES ---

    getRequestAttachmentsByRequestId: async (requestId) => {
        set({ isLoading: true, error: null });
        try {
            const attachments = await getRequestAttachmentsByRequestId(requestId);
            set({ attachments, isLoading: false });
            return attachments;
        } catch (error) {
            set({ isLoading: false, error: error?.message ?? 'Failed to fetch request attachments.' });
            return [];
        }
    },


    // --- ATTACHMENT MUTATIONS ---

    createRequestAttachment: async (payload) => {
        set({ isMutating: true, error: null });
        try {
            const attachment = await createRequestAttachment(payload);
            set((state) => ({
                attachments: attachment ? [...state.attachments, attachment] : state.attachments,
                isMutating: false,
            }));
            return attachment;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to create attachment.' });
            throw error;
        }
    },

    createRequestAttachments: async (dataList) => {
        set({ isMutating: true, error: null });
        try {
            const result = await createRequestAttachments(dataList);
            set({ isMutating: false });
            return result;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to create attachments.' });
            throw error;
        }
    },

    deleteRequestAttachments: async (ids) => {
        set({ isMutating: true, error: null });
        try {
            const result = await deleteRequestAttachments(ids);
            set((state) => ({
                attachments: state.attachments.filter((a) => !ids.includes(a?.id)),
                isMutating: false,
            }));
            return result;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to delete attachments.' });
            throw error;
        }
    },


    // --- CONTROLS ---

    setSelectedRequest: (request) => set({ selectedRequest: request }),

    clearMessages: () => set({ messages: [] }),

    clearAttachments: () => set({ attachments: [] }),

    clearError: () => set({ error: null }),

    reset: () => set({
        requests: [],
        selectedRequest: null,
        messages: [],
        attachments: [],
        isLoading: false,
        isMutating: false,
        error: null,
    }),
}));
