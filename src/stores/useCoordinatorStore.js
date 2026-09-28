// --- IMPORTS ---
import { create } from 'zustand';

import { mutationSchema } from '../schemas';
import { coordinatorService } from '../services';
import { systemEventService } from '../services/systemEventService';
import { constants } from '../constants';
import { useAuthStore } from './useAuthStore';


// --- HELPERS ---
function parsePayloadData(data) {
    if (!data) return {};
    if (typeof data === 'object') return data;
    try {
        return JSON.parse(data);
    } catch {
        return {};
    }
}

function formatCoordinatorActionLabel(action, data = {}) {
    const act = String(action || '').toUpperCase();
    const payload = parsePayloadData(data);

    if (act === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_ATTACH || act === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_ATTACH) {
        return 'Document Attachment';
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_RESOLVE) {
        return 'Resolve Document Request';
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_REJECT) {
        return 'Reject Document Request';
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_REOPEN) {
        return 'Reopen Document Request';
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.USER_CREATE) {
        const identifier = payload.universityId || payload.email || 'New User';
        return `Create User (${identifier})`;
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.USER_UPDATE) {
        const identifier = payload.universityId || payload.name || payload.email || 'User';
        return `Update User (${identifier})`;
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.USER_SUSPEND) {
        const identifier = payload.universityId || payload.name || payload.email || 'User';
        return `Suspend User (${identifier})`;
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.USER_DELETE) {
        const identifier = payload.universityId || payload.name || payload.email || 'User';
        return `Delete User (${identifier})`;
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.DEPARTMENT_CREATE) {
        const identifier = payload.code || payload.name || 'New Department';
        return `Create Department (${identifier})`;
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.DEPARTMENT_UPDATE) {
        const identifier = payload.code || payload.name || 'Department';
        return `Update Department (${identifier})`;
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.DEPARTMENT_DELETE) {
        const identifier = payload.code || payload.name || 'Department';
        return `Delete Department (${identifier})`;
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_UPLOAD) {
        const identifier = payload.title || payload.name || 'Document';
        return `Upload Document (${identifier})`;
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_UPDATE) {
        const identifier = payload.title || payload.name || 'Document';
        return `Update Document (${identifier})`;
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_DELETE) {
        const identifier = payload.title || payload.name || 'Document';
        return `Delete Document (${identifier})`;
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_SHARE) {
        const identifier = payload.title || payload.name || 'Document';
        return `Share Document (${identifier})`;
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_UNSHARE) {
        const identifier = payload.title || payload.name || 'Document';
        return `Unshare Document (${identifier})`;
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_ARCHIVE) {
        const identifier = payload.title || payload.name || 'Document';
        return `Archive Document (${identifier})`;
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_UNARCHIVE) {
        const identifier = payload.title || payload.name || 'Document';
        return `Unarchive Document (${identifier})`;
    }
    return act.replace(/_/g, ' ') || 'Coordinator Request';
}


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

    insertCoordinatorRequest: async (payload, actor = null) => {
        set({ isLoading: true, error: null });

        try {
            const timestamp = new Date().toISOString();
            const payloadWithDates = {
                createdAt: timestamp,
                updatedAt: timestamp,
                ...payload,
            };
            const validatedPayload = mutationSchema.InsertCoordinatorRequestSchema.parse(payloadWithDates);
            const newRequest = await coordinatorService.insertCoordinatorRequest(validatedPayload);

            set((state) => ({
                coordinatorRequests: [newRequest, ...state.coordinatorRequests],
                isLoading: false,
                error: null,
            }));

            get().fetchCoordinatorRequests().catch(() => {});

            const resolvedActor = (actor && typeof actor === 'object') ? actor : useAuthStore.getState().currentUser;
            const resolvedActorId = resolvedActor?.id || (typeof actor === 'string' ? actor : null) || validatedPayload.requesterId || null;
            const requesterId = validatedPayload.requesterId || resolvedActorId;
            const actionLabel = formatCoordinatorActionLabel(validatedPayload.action, validatedPayload.data);

            systemEventService.recordSystemEvent({
                actor: resolvedActor,
                actorId: resolvedActorId,
                entityType: constants.AUDIT_LOGS_ENTITY_TYPE.COORDINATOR_REQUEST,
                entityId: newRequest.id,
                action: constants.AUDIT_LOGS_ACTION.CREATED,
                data: {
                    id: newRequest.id,
                    action: validatedPayload.action,
                    status: newRequest.status || constants.COORDINATOR_REQUESTS_STATUS.PENDING,
                    requesterId: requesterId,
                    title: `Coordinator Request Created: ${actionLabel}`,
                    targetName: actionLabel,
                    description: `Coordinator submitted a request for "${actionLabel}".`,
                },
                targetRoles: ['ADMINISTRATOR', 'COORDINATOR'],
                targetUserIds: requesterId ? [requesterId] : [],
                isMajor: true,
            }).catch((err) => {
                console.warn('[useCoordinatorStore] recordSystemEvent warning on insertCoordinatorRequest:', err);
            });

            return newRequest;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to insert coordinator request.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    updateCoordinatorRequest: async (id, payload, actor = null) => {
        set({ isLoading: true, error: null });

        try {
            const timestamp = new Date().toISOString();
            const existingRequest = get().coordinatorRequests.find((item) => item?.id === id) ?? {};

            // Strictly preserve action and data if not explicitly updated to prevent Data Connect NULL wipes
            const preservedAction = payload.action ?? existingRequest.action;
            const rawData = payload.data !== undefined ? payload.data : existingRequest.data;
            const serializedData = (typeof rawData === 'object' && rawData !== null)
                ? JSON.stringify(rawData)
                : (typeof rawData === 'string' ? rawData : (existingRequest.data ? (typeof existingRequest.data === 'string' ? existingRequest.data : JSON.stringify(existingRequest.data)) : undefined));

            const payloadWithUpdate = {
                action: preservedAction,
                ...payload,
                data: serializedData,
                updatedAt: payload?.updatedAt ?? timestamp,
            };
            const validatedPayload = mutationSchema.UpdateCoordinatorRequestSchema.parse(payloadWithUpdate);

            const result = await coordinatorService.updateCoordinatorRequest(id, validatedPayload);

            const cleanResult = Object.fromEntries(
                Object.entries(result || {}).filter(([, v]) => v !== undefined && v !== null)
            );
            const cleanPayload = Object.fromEntries(
                Object.entries(validatedPayload || {}).filter(([, v]) => v !== undefined)
            );

            const mergedRequest = {
                ...existingRequest,
                ...cleanPayload,
                ...cleanResult,
                id: id,
                updatedAt: validatedPayload.updatedAt ?? timestamp,
            };

            set((state) => ({
                coordinatorRequests: state.coordinatorRequests.map((item) =>
                    item?.id === id ? mergedRequest : item
                ),
                selectedCoordinatorRequest: state.selectedCoordinatorRequest?.id === id
                    ? mergedRequest
                    : state.selectedCoordinatorRequest,
                isLoading: false,
                error: null,
            }));

            get().fetchCoordinatorRequests().catch(() => {});

            // Compute old vs new diff for affected fields
            const previousData = {};
            const newData = {};
            Object.keys(validatedPayload).forEach((k) => {
                if (existingRequest && existingRequest[k] !== undefined && existingRequest[k] !== validatedPayload[k]) {
                    previousData[k] = existingRequest[k];
                    newData[k] = validatedPayload[k];
                }
            });

            const resolvedActor = (actor && typeof actor === 'object') ? actor : useAuthStore.getState().currentUser;
            const resolvedActorId = resolvedActor?.id || (typeof actor === 'string' ? actor : null) || validatedPayload.reviewerId || null;
            const coordinatorId = (typeof existingRequest.requester === 'object'
                ? existingRequest.requester?.id
                : (existingRequest.requesterId ?? existingRequest.requester)) || null;

            const actionType = existingRequest.action || validatedPayload.action;
            const actionLabel = formatCoordinatorActionLabel(actionType, validatedPayload.data || existingRequest.data);

            const isApproved = validatedPayload.status === constants.COORDINATOR_REQUESTS_STATUS.APPROVED ||
                (existingRequest.status !== constants.COORDINATOR_REQUESTS_STATUS.APPROVED && mergedRequest.status === constants.COORDINATOR_REQUESTS_STATUS.APPROVED);
            const isRejected = validatedPayload.status === constants.COORDINATOR_REQUESTS_STATUS.REJECTED ||
                (existingRequest.status !== constants.COORDINATOR_REQUESTS_STATUS.REJECTED && mergedRequest.status === constants.COORDINATOR_REQUESTS_STATUS.REJECTED);

            let auditAction = constants.AUDIT_LOGS_ACTION.UPDATED;
            let eventTitle = `Coordinator Request Updated: ${actionLabel}`;
            let eventDescription = `Coordinator request details for "${actionLabel}" were updated.`;

            if (isApproved) {
                auditAction = constants.AUDIT_LOGS_ACTION.APPROVED;
                eventTitle = `Coordinator Request Approved: ${actionLabel}`;
                eventDescription = `Administrator approved coordinator request for "${actionLabel}".`;
            } else if (isRejected) {
                auditAction = constants.AUDIT_LOGS_ACTION.REJECTED;
                const reason = validatedPayload.rejectionReason || existingRequest.rejectionReason || '';
                eventTitle = `Coordinator Request Rejected: ${actionLabel}`;
                eventDescription = `Administrator rejected coordinator request for "${actionLabel}".${reason ? ` Reason: ${reason}` : ''}`;
            }

            systemEventService.recordSystemEvent({
                actor: resolvedActor,
                actorId: resolvedActorId,
                entityType: constants.AUDIT_LOGS_ENTITY_TYPE.COORDINATOR_REQUEST,
                entityId: id,
                action: auditAction,
                data: {
                    id,
                    old: previousData,
                    new: newData,
                    action: actionType,
                    status: mergedRequest.status,
                    rejectionReason: mergedRequest.rejectionReason || null,
                    reviewerId: mergedRequest.reviewerId || null,
                    targetCoordinatorId: coordinatorId,
                    title: eventTitle,
                    targetName: actionLabel,
                    description: eventDescription,
                },
                targetRoles: ['ADMINISTRATOR', 'COORDINATOR'],
                targetUserIds: coordinatorId ? [coordinatorId] : [],
                isMajor: true,
            }).catch((err) => {
                console.warn('[useCoordinatorStore] recordSystemEvent warning on updateCoordinatorRequest:', err);
            });

            return mergedRequest;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to update coordinator request.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    deleteCoordinatorRequest: async (id, actor = null) => {
        set({ isLoading: true, error: null });

        const existingRequest = get().coordinatorRequests.find((item) => item?.id === id) ?? {};
        const coordinatorId = (typeof existingRequest.requester === 'object'
            ? existingRequest.requester?.id
            : (existingRequest.requesterId ?? existingRequest.requester)) || null;

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

                const resolvedActor = (actor && typeof actor === 'object') ? actor : useAuthStore.getState().currentUser;
                const resolvedActorId = resolvedActor?.id || (typeof actor === 'string' ? actor : null) || null;
                const actionLabel = formatCoordinatorActionLabel(existingRequest.action, existingRequest.data);

                systemEventService.recordSystemEvent({
                    actor: resolvedActor,
                    actorId: resolvedActorId,
                    entityType: constants.AUDIT_LOGS_ENTITY_TYPE.COORDINATOR_REQUEST,
                    entityId: id,
                    action: constants.AUDIT_LOGS_ACTION.DELETED,
                    data: {
                        id,
                        action: existingRequest.action,
                        status: existingRequest.status,
                        requesterId: coordinatorId,
                        title: `Coordinator Request Deleted: ${actionLabel}`,
                        targetName: actionLabel,
                        description: `Coordinator request for "${actionLabel}" was deleted.`,
                    },
                    targetRoles: ['ADMINISTRATOR', 'COORDINATOR'],
                    targetUserIds: coordinatorId ? [coordinatorId] : [],
                    isMajor: true,
                }).catch((err) => {
                    console.warn('[useCoordinatorStore] recordSystemEvent warning on deleteCoordinatorRequest:', err);
                });
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
