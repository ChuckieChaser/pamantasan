// --- COORDINATOR STORE ---
import { create } from 'zustand';
import {
    getCoordinatorRequests,
    getCoordinatorRequestsByRequesterId,
    getCoordinatorRequestById,
    createCoordinatorRequest,
    updateCoordinatorRequest,
    updateCoordinatorRequests,
    deleteCoordinatorRequests,
} from './coordinatorService';


// --- STORE ---

export const useCoordinatorStore = create((set, get) => ({
    // --- STATE ---
    coordinatorRequests: [],
    selectedCoordinatorRequest: null,
    isLoading: false,
    isMutating: false,
    error: null,


    // --- QUERIES ---

    getCoordinatorRequests: async (filters = {}) => {
        set({ isLoading: true, error: null });
        try {
            const coordinatorRequests = await getCoordinatorRequests(filters);
            set({ coordinatorRequests, isLoading: false });
            return coordinatorRequests;
        } catch (error) {
            set({ isLoading: false, error: error?.message ?? 'Failed to fetch coordinator requests.' });
            return [];
        }
    },

    getCoordinatorRequestsByRequesterId: async (filters = {}) => {
        set({ isLoading: true, error: null });
        try {
            const coordinatorRequests = await getCoordinatorRequestsByRequesterId(filters);
            set({ coordinatorRequests, isLoading: false });
            return coordinatorRequests;
        } catch (error) {
            set({ isLoading: false, error: error?.message ?? 'Failed to fetch coordinator requests by requester.' });
            return [];
        }
    },

    getCoordinatorRequestById: async (id) => {
        set({ isLoading: true, error: null });
        try {
            const cached = get().coordinatorRequests.find((r) => r?.id === id);
            const request = cached ?? await getCoordinatorRequestById(id);
            set({ selectedCoordinatorRequest: request, isLoading: false });
            return request;
        } catch (error) {
            set({ isLoading: false, error: error?.message ?? 'Failed to fetch coordinator request.' });
            return null;
        }
    },


    // --- MUTATIONS ---

    createCoordinatorRequest: async (payload) => {
        set({ isMutating: true, error: null });
        try {
            const request = await createCoordinatorRequest(payload);
            set((state) => ({
                coordinatorRequests: request ? [request, ...state.coordinatorRequests] : state.coordinatorRequests,
                isMutating: false,
            }));
            return request;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to create coordinator request.' });
            throw error;
        }
    },

    updateCoordinatorRequest: async (id, payload) => {
        set({ isMutating: true, error: null });
        try {
            const updated = await updateCoordinatorRequest(id, payload);
            set((state) => ({
                coordinatorRequests: state.coordinatorRequests.map((r) => (r?.id === id ? { ...r, ...updated } : r)),
                selectedCoordinatorRequest: state.selectedCoordinatorRequest?.id === id ? { ...state.selectedCoordinatorRequest, ...updated } : state.selectedCoordinatorRequest,
                isMutating: false,
            }));
            return updated;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to update coordinator request.' });
            throw error;
        }
    },

    updateCoordinatorRequests: async (ids, payload) => {
        set({ isMutating: true, error: null });
        try {
            const result = await updateCoordinatorRequests(ids, payload);
            set({ isMutating: false });
            return result;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to bulk update coordinator requests.' });
            throw error;
        }
    },

    deleteCoordinatorRequests: async (ids) => {
        set({ isMutating: true, error: null });
        try {
            const result = await deleteCoordinatorRequests(ids);
            set((state) => ({
                coordinatorRequests: state.coordinatorRequests.filter((r) => !ids.includes(r?.id)),
                selectedCoordinatorRequest: ids.includes(state.selectedCoordinatorRequest?.id) ? null : state.selectedCoordinatorRequest,
                isMutating: false,
            }));
            return result;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to delete coordinator requests.' });
            throw error;
        }
    },


    // --- CONTROLS ---

    setSelectedCoordinatorRequest: (request) => set({ selectedCoordinatorRequest: request }),

    clearError: () => set({ error: null }),

    reset: () => set({
        coordinatorRequests: [],
        selectedCoordinatorRequest: null,
        isLoading: false,
        isMutating: false,
        error: null,
    }),
}));
