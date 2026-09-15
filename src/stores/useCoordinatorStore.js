// --- IMPORTS ---
import { create } from 'zustand';

import { mutationSchema } from '../schemas';
import { coordinatorService } from '../services';


// --- STORE ---
const useCoordinatorStore = create((set, get) => ({
    // STATES
    coordinatorRequests: [],
    requesterCoordinatorRequests: [],
    selectedCoordinatorRequest: null,
    isLoading: false,
    error: null,

    // CORE
    fetchCoordinatorRequests: async () => {
        set({ isLoading: true, error: null });

        try {
            const coordinatorRequests = await coordinatorService.fetchCoordinatorRequests();
            set({ coordinatorRequests: coordinatorRequests, isLoading: false, error: null });

            return coordinatorRequests;
        } catch (error) {
            const message = error?.message ?? 'Failed to fetch coordinator requests.';
            set({ isLoading: false, error: message });

            return [];
        }
    },

    fetchCoordinatorRequestsByRequesterId: async (requesterId) => {
        set({ isLoading: true, error: null });

        try {
            const requesterCoordinatorRequests = await coordinatorService.fetchCoordinatorRequestsByRequesterId(requesterId);
            set({ requesterCoordinatorRequests: requesterCoordinatorRequests, isLoading: false, error: null });

            return requesterCoordinatorRequests;
        } catch (error) {
            const message = error?.message ?? `Failed to fetch coordinator requests for requester "${requesterId}".`;
            set({ isLoading: false, error: message });
            
            return [];
        }
    },

    fetchCoordinatorRequestById: async (id) => {
        set({ isLoading: true, error: null });

        try {
            let request = get().coordinatorRequests.find((item) => item.id === id);

            if (!request) {
                request = await coordinatorService.fetchCoordinatorRequestById(id);
            }

            set({ selectedCoordinatorRequest: request, isLoading: false, error: null });
            return request;
        } catch (error) {
            const message = error?.message ?? `Failed to fetch coordinator request with ID "${id}".`;
            set({ isLoading: false, error: message });

            return null;
        }
    },

    insertCoordinatorRequest: async (payload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedPayload = mutationSchema.InsertCoordinatorRequestSchema.parse(payload);
            const newRequest = await coordinatorService.insertCoordinatorRequest(validatedPayload);

            set((state) => ({
                coordinatorRequests: [newRequest, ...state.coordinatorRequests],
                isLoading: false,
                error: null,
            }));

            return newRequest;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to insert coordinator request.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    updateCoordinatorRequest: async (id, payload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedPayload = mutationSchema.UpdateCoordinatorRequestSchema.parse(payload);
            const updatedRequest = await coordinatorService.updateCoordinatorRequest(id, validatedPayload);

            set((state) => ({
                coordinatorRequests: state.coordinatorRequests.map((item) =>
                    item.id === id ? updatedRequest : item
                ),
                selectedCoordinatorRequest: state.selectedCoordinatorRequest?.id === id
                    ? updatedRequest
                    : state.selectedCoordinatorRequest,
                isLoading: false,
                error: null,
            }));

            return updatedRequest;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to update coordinator request.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    deleteCoordinatorRequest: async (id) => {
        set({ isLoading: true, error: null });

        try {
            const isDeleted = await coordinatorService.deleteCoordinatorRequest(id);

            if (isDeleted) {
                set((state) => ({
                    coordinatorRequests: state.coordinatorRequests.filter((item) => item.id !== id),
                    selectedCoordinatorRequest: state.selectedCoordinatorRequest?.id === id
                        ? null
                        : state.selectedCoordinatorRequest,
                    isLoading: false,
                    error: null,
                }));
            } else {
                set({ isLoading: false });
            }

            return isDeleted;
        } catch (error) {
            const message = error?.message ?? 'Failed to delete coordinator request.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    // CONTROLS
    setSelectedCoordinatorRequest: (request) => {
        set({ selectedCoordinatorRequest: request });
    },

    clearError: () => {
        set({ error: null });
    },
}));


// --- EXPORTS ---
export { useCoordinatorStore };
