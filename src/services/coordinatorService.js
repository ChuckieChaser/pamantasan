// --- IMPORTS ---
import { dataConnectService } from './dataConnectService';
import { constants } from '../constants';


// --- SERVICES ---
const coordinatorService = {
    // CORE
    fetchCoordinatorRequests: async () => {
        try {
            const data = await dataConnectService.executeQuery('FetchCoordinatorRequests');
            const coordinatorRequests = data?.coordinatorRequests ?? [];

            return coordinatorRequests.map(formatLiveCoordinatorRequest);
        } catch (error) {
            console.error('Failed to fetch coordinator requests from Firebase Data Connect:', error);
            return [];
        }
    },

    fetchCoordinatorRequestsByRequesterId: async (requesterId) => {
        try {
            const data = await dataConnectService.executeQuery('FetchCoordinatorRequestsByRequesterId', { requesterId: requesterId });
            const coordinatorRequests = data?.coordinatorRequests ?? [];

            return coordinatorRequests.map(formatLiveCoordinatorRequest);
        } catch (error) {
            console.error(`Failed to fetch coordinator requests for requester "${requesterId}":`, error);
            return [];
        }
    },

    fetchCoordinatorRequestById: async (id) => {
        try {
            const data = await dataConnectService.executeQuery('FetchCoordinatorRequestById', { id: id });
            const coordinatorRequests = data?.coordinatorRequests ?? [];

            return coordinatorRequests.length > 0 ? formatLiveCoordinatorRequest(coordinatorRequests[0]) : null;
        } catch (error) {
            console.error(`Failed to fetch coordinator request with ID "${id}":`, error);
            return null;
        }
    },

    insertCoordinatorRequest: async (payload) => {
        const data = await dataConnectService.executeMutation('InsertCoordinatorRequest', {
            requesterId: payload.requesterId,
            reviewerId: payload.reviewerId ?? null,
            action: payload.action,
            data: payload.data,
            status: payload.status ?? constants.COORDINATOR_REQUESTS_STATUS.PENDING,
            rejectionReason: payload.rejectionReason ?? null,
            createdAt: payload.createdAt,
            updatedAt: payload.updatedAt,
        });

        return formatLiveCoordinatorRequest(data?.coordinatorRequest_insert ?? data?.coordinatorRequests_insert);
    },

    updateCoordinatorRequest: async (id, payload) => {
        const timestamp = payload.updatedAt || new Date().toISOString();
        const data = await dataConnectService.executeMutation('UpdateCoordinatorRequest', {
            id: id,
            reviewerId: payload.reviewerId,
            action: payload.action,
            data: payload.data,
            status: payload.status,
            rejectionReason: payload.rejectionReason,
            updatedAt: timestamp,
        });

        const raw = data?.coordinatorRequest_update ?? data?.coordinatorRequests_update;
        const formatted = raw ? formatLiveCoordinatorRequest(raw) : null;
        const cleanFormatted = Object.fromEntries(
            Object.entries(formatted || {}).filter(([_, v]) => v !== undefined && v !== null)
        );
        const cleanPayload = Object.fromEntries(
            Object.entries(payload || {}).filter(([_, v]) => v !== undefined)
        );

        return {
            id: id,
            ...cleanPayload,
            ...cleanFormatted,
            updatedAt: timestamp,
        };
    },

    deleteCoordinatorRequest: async (id) => {
        const data = await dataConnectService.executeMutation('DeleteCoordinatorRequest', { id: id });
        return Boolean(data?.coordinatorRequest_delete ?? data?.coordinatorRequests_delete);
    },
};


// --- HELPERS ---
function formatLiveCoordinatorRequest(rawCoordinatorRequest) {
    if (!rawCoordinatorRequest) {
        return null;
    }

    return {
        id: rawCoordinatorRequest.id,
        requester: rawCoordinatorRequest.requester,
        reviewer: rawCoordinatorRequest.reviewer,
        action: rawCoordinatorRequest.action,
        data: rawCoordinatorRequest.data,
        status: rawCoordinatorRequest.status,
        rejectionReason: rawCoordinatorRequest.rejectionReason,
        createdAt: rawCoordinatorRequest.createdAt,
        updatedAt: rawCoordinatorRequest.updatedAt,
    };
}


// --- EXPORTS ---
export { coordinatorService };
