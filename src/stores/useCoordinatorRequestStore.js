// --- IMPORTS ---
import { create } from 'zustand';
import {
    CoordinatorRequestInsertSchema,
    CoordinatorRequestUpdateSchema,
} from '../schemas';
import {
    COORDINATOR_REQUEST_ACTIONS,
    COORDINATOR_REQUEST_STATUSES,
} from '../constants';
import { MOCK_COORDINATOR_REQUESTS } from '../mocks';
import { useUserStore } from './useUserStore';
import { useDepartmentStore } from './useDepartmentStore';
import { useDocumentStore } from './useDocumentStore';
import { useAuditLogStore } from './useAuditLogStore';
import { useNotificationStore } from './useNotificationStore';

// --- STORE DEFINITION ---
const useCoordinatorRequestStore = create((set, get) => ({
    // STATE
    coordinatorRequests: MOCK_COORDINATOR_REQUESTS,
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
                    (item) => item.status === filterOptions.status
                );
            }

            if (filterOptions.action) {
                resultRequests = resultRequests.filter(
                    (item) => item.action === filterOptions.action
                );
            }

            if (filterOptions.requesterId) {
                resultRequests = resultRequests.filter(
                    (item) => item.requester_id === filterOptions.requesterId
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
            const request = get().coordinatorRequests.find(
                (item) => item.id === requestId
            ) ?? null;

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
                id: validatedData.id ?? `cr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                requester_id: validatedData.requester_id,
                reviewer_id: null,
                action: validatedData.action,
                data: validatedData.data,
                status: validatedData.status ?? COORDINATOR_REQUEST_STATUSES.PENDING,
                rejection_reason: null,
                created_at: timestamp,
                updated_at: timestamp,
            };

            set((state) => ({
                coordinatorRequests: [newRequest, ...state.coordinatorRequests],
                isLoading: false,
            }));

            // Dispatch notification to Administrators
            useNotificationStore.getState().createNotification({
                recipient_id: 'f1000001-0000-4000-8000-000000000001',
                actor_id: validatedData.requester_id,
                entity_type: 'COORDINATOR_REQUEST',
                entity_id: newRequest.id,
                action: 'CREATED',
            });

            // Log to Audits
            useAuditLogStore.getState().createAuditLog({
                actor_id: validatedData.requester_id,
                entity_type: 'COORDINATOR_REQUEST',
                entity_id: newRequest.id,
                action: 'CREATED',
                data: {
                    action: validatedData.action,
                    payload: validatedData.data,
                },
            });

            return newRequest;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to create coordinator request.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    approveCoordinatorRequest: async (requestId, reviewerId = 'f1000001-0000-4000-8000-000000000001') => {
        set({ isLoading: true, error: null });

        try {
            const targetRequest = get().coordinatorRequests.find(
                (item) => item.id === requestId
            );

            if (!targetRequest) {
                throw new Error(`Coordinator request "${requestId}" was not found.`);
            }

            const timestamp = new Date().toISOString();
            const updatedRequest = {
                ...targetRequest,
                status: COORDINATOR_REQUEST_STATUSES.APPROVED,
                reviewer_id: reviewerId,
                rejection_reason: null,
                updated_at: timestamp,
            };

            // EXECUTE THE UNDERLYING ACTION USING ADMINISTRATOR PRIVILEGE
            const payload = targetRequest.data;
            switch (targetRequest.action) {
                case 'USER_CREATE':
                    await useUserStore.getState().createUser({
                        university_id: payload.university_id,
                        first_name: payload.first_name,
                        middle_name: payload.middle_name ?? null,
                        last_name: payload.last_name,
                        email: payload.email,
                        department_id: payload.department_id,
                        role: payload.role ?? 'MEMBER',
                        title: payload.title ?? 'University Member',
                        status: payload.status ?? 'PENDING_PASSWORD',
                    });
                    break;

                case 'USER_UPDATE':
                    if (payload.user_id) {
                        await useUserStore.getState().updateUser(payload.user_id, {
                            role: payload.role,
                            title: payload.title,
                            department_id: payload.department_id,
                            first_name: payload.first_name,
                            last_name: payload.last_name,
                        });
                    }
                    break;

                case 'USER_SUSPEND':
                    if (payload.user_id) {
                        await useUserStore.getState().updateUserStatus(payload.user_id, 'SUSPENDED');
                    }
                    break;

                case 'DEPARTMENT_CREATE':
                    await useDepartmentStore.getState().createDepartment({
                        name: payload.name,
                        code: payload.code,
                        description: payload.description,
                        division: payload.division,
                    });
                    break;

                case 'DEPARTMENT_UPDATE':
                    if (payload.department_id) {
                        await useDepartmentStore.getState().updateDepartment(payload.department_id, {
                            name: payload.name,
                            code: payload.code,
                            description: payload.description,
                        });
                    }
                    break;

                case 'DOCUMENT_UPLOAD':
                    await useDocumentStore.getState().createDocument({
                        name: payload.name ?? payload.document_name,
                        parent_id: payload.parent_id ?? null,
                        comment: payload.comment ?? payload.summary,
                        is_folder: false,
                        is_archived: false,
                    });
                    break;

                case 'DOCUMENT_SHARE':
                    await useDocumentStore.getState().shareDocument({
                        document_id: payload.document_id,
                        department_id: payload.target_department_id,
                        status: 'APPROVED',
                    });
                    break;

                case 'DOCUMENT_ARCHIVE':
                    if (payload.document_id) {
                        await useDocumentStore.getState().archiveDocument(payload.document_id);
                    }
                    break;

                case 'DOCUMENT_DELETE':
                    if (payload.document_id) {
                        await useDocumentStore.getState().deleteDocument(payload.document_id);
                    }
                    break;

                default:
                    break;
            }

            // Commit state
            set((state) => ({
                coordinatorRequests: state.coordinatorRequests.map((item) =>
                    item.id === requestId ? updatedRequest : item
                ),
                selectedCoordinatorRequest: state.selectedCoordinatorRequest?.id === requestId
                    ? updatedRequest
                    : state.selectedCoordinatorRequest,
                isLoading: false,
            }));

            // Notify coordinator of approval
            useNotificationStore.getState().createNotification({
                recipient_id: targetRequest.requester_id,
                actor_id: reviewerId,
                entity_type: 'COORDINATOR_REQUEST',
                entity_id: requestId,
                action: 'APPROVED',
            });

            // Log to Audit Log
            useAuditLogStore.getState().createAuditLog({
                actor_id: reviewerId,
                entity_type: 'COORDINATOR_REQUEST',
                entity_id: requestId,
                action: 'APPROVED',
                data: {
                    action: targetRequest.action,
                    payload: targetRequest.data,
                },
            });

            return updatedRequest;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to approve coordinator request.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    rejectCoordinatorRequest: async (requestId, rejectionReason, reviewerId = 'f1000001-0000-4000-8000-000000000001') => {
        set({ isLoading: true, error: null });

        try {
            const targetRequest = get().coordinatorRequests.find(
                (item) => item.id === requestId
            );

            if (!targetRequest) {
                throw new Error(`Coordinator request "${requestId}" was not found.`);
            }

            const timestamp = new Date().toISOString();
            const updatedRequest = {
                ...targetRequest,
                status: COORDINATOR_REQUEST_STATUSES.REJECTED,
                reviewer_id: reviewerId,
                rejection_reason: rejectionReason || 'Request rejected by Administrator.',
                updated_at: timestamp,
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

            // Notify coordinator of rejection
            useNotificationStore.getState().createNotification({
                recipient_id: targetRequest.requester_id,
                actor_id: reviewerId,
                entity_type: 'COORDINATOR_REQUEST',
                entity_id: requestId,
                action: 'REJECTED',
            });

            // Log to Audit Log
            useAuditLogStore.getState().createAuditLog({
                actor_id: reviewerId,
                entity_type: 'COORDINATOR_REQUEST',
                entity_id: requestId,
                action: 'REJECTED',
                data: {
                    action: targetRequest.action,
                    rejection_reason: rejectionReason,
                },
            });

            return updatedRequest;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to reject coordinator request.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    deleteCoordinatorRequest: async (requestId) => {
        set({ isLoading: true, error: null });

        try {
            set((state) => ({
                coordinatorRequests: state.coordinatorRequests.filter(
                    (item) => item.id !== requestId
                ),
                selectedCoordinatorRequest: state.selectedCoordinatorRequest?.id === requestId
                    ? null
                    : state.selectedCoordinatorRequest,
                isLoading: false,
            }));

            return true;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to delete coordinator request.';
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
