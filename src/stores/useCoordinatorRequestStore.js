// --- IMPORTS ---
import { create } from 'zustand';
import {
    CoordinatorRequestInsertSchema,
    CoordinatorRequestReviewSchema,
} from '../schemas';
import {
    COORDINATOR_REQUEST_STATUSES,
} from '../constants';

// --- STORE DEFINITION ---
const useCoordinatorRequestStore = create((set, get) => ({
    // STATE
    coordinatorRequests: [],
    selectedCoordinatorRequest: null,
    isLoading: false,
    error: null,

    // ACTIONS
    fetchCoordinatorRequests: async (filterOptions = {}) => {
        set({ isLoading: true, error: null });

        try {
            let resultRequests = [...get().coordinatorRequests];

            if (filterOptions.status) {
                resultRequests = resultRequests.filter(
                    (req) => req.status === filterOptions.status
                );
            }

            if (filterOptions.action) {
                resultRequests = resultRequests.filter(
                    (req) => req.action === filterOptions.action
                );
            }

            if (filterOptions.requesterId) {
                resultRequests = resultRequests.filter(
                    (req) => req.requester_id === filterOptions.requesterId
                );
            }

            set({ isLoading: false });
            return resultRequests;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to fetch coordinator requests.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    fetchCoordinatorRequestById: async (requestId) => {
        set({ isLoading: true, error: null });

        try {
            const request = get().coordinatorRequests.find((item) => item.id === requestId) ?? null;
            set({ selectedCoordinatorRequest: request, isLoading: false });
            return request;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to fetch coordinator request by identifier.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    createCoordinatorRequest: async (requestPayload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedData = CoordinatorRequestInsertSchema.parse(requestPayload);
            const timestamp = new Date().toISOString();

            const newRequest = {
                id: validatedData.id ?? `creq-${Date.now()}`,
                requester_id: validatedData.requester_id,
                reviewer_id: validatedData.reviewer_id ?? null,
                action: validatedData.action,
                data: validatedData.data ?? {},
                status: validatedData.status ?? COORDINATOR_REQUEST_STATUSES.PENDING,
                rejection_reason: null,
                created_at: timestamp,
                updated_at: timestamp,
            };

            set((state) => ({
                coordinatorRequests: [newRequest, ...state.coordinatorRequests],
                isLoading: false,
            }));

            return newRequest;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to create coordinator request.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    reviewCoordinatorRequest: async (requestId, reviewPayload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedReview = CoordinatorRequestReviewSchema.parse(reviewPayload);
            const targetRequest = get().coordinatorRequests.find((item) => item.id === requestId);

            if (!targetRequest) {
                throw new Error(`Coordinator request with identifier "${requestId}" was not found.`);
            }

            const updatedRequest = {
                ...targetRequest,
                status: validatedReview.status,
                rejection_reason: validatedReview.rejection_reason ?? null,
                reviewer_id: validatedReview.reviewer_id ?? targetRequest.reviewer_id,
                updated_at: new Date().toISOString(),
            };

            set((state) => ({
                coordinatorRequests: state.coordinatorRequests.map((item) =>
                    item.id === requestId ? updatedRequest : item
                ),
                selectedCoordinatorRequest: state.selectedCoordinatorRequest?.id === requestId
                    ? updatedRequest
                    : state.selectedCoordinatorRequest,
                isLoading: false,
            }));

            return updatedRequest;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to review coordinator request.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    setSelectedCoordinatorRequest: (request) => {
        set({ selectedCoordinatorRequest: request });
    },

    clearError: () => {
        set({ error: null });
    },
}));

export {
    useCoordinatorRequestStore,
};

export default useCoordinatorRequestStore;
