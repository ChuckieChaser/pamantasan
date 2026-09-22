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
        const timestamp = payload.createdAt || new Date().toISOString();
        const data = await dataConnectService.executeMutation('InsertCoordinatorRequest', {
            requesterId: payload.requesterId,
            reviewerId: payload.reviewerId ?? null,
            action: payload.action,
            data: payload.data,
            status: payload.status ?? constants.COORDINATOR_REQUESTS_STATUS.PENDING,
            rejectionReason: payload.rejectionReason ?? null,
            createdAt: timestamp,
            updatedAt: payload.updatedAt || timestamp,
        });

        const raw = data?.coordinatorRequest_insert ?? data?.coordinatorRequests_insert;
        const formatted = raw ? formatLiveCoordinatorRequest(raw) : null;
        const cleanFormatted = Object.fromEntries(
            Object.entries(formatted || {}).filter(([, v]) => v !== undefined && v !== null)
        );

        let parsedData = payload.data;
        if (typeof parsedData === 'string') {
            try {
                parsedData = JSON.parse(parsedData);
            } catch {
                parsedData = payload.data;
            }
        }

        return {
            id: raw?.id ?? cleanFormatted?.id,
            requesterId: payload.requesterId,
            requester: { id: payload.requesterId },
            reviewerId: payload.reviewerId ?? null,
            reviewer: payload.reviewerId ? { id: payload.reviewerId } : null,
            action: payload.action,
            data: parsedData,
            status: payload.status ?? constants.COORDINATOR_REQUESTS_STATUS.PENDING,
            rejectionReason: payload.rejectionReason ?? null,
            createdAt: timestamp,
            updatedAt: payload.updatedAt || timestamp,
            ...cleanFormatted,
        };
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
            Object.entries(formatted || {}).filter(([, v]) => v !== undefined && v !== null)
        );
        const cleanPayload = Object.fromEntries(
            Object.entries(payload || {}).filter(([, v]) => v !== undefined)
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

    let parsedData = rawCoordinatorRequest.data;
    if (typeof parsedData === 'string') {
        try {
            parsedData = JSON.parse(parsedData);
        } catch {
            parsedData = rawCoordinatorRequest.data;
        }
    }

    const requesterObj = typeof rawCoordinatorRequest.requester === 'object' ? rawCoordinatorRequest.requester : null;
    const requesterId = requesterObj?.id ?? rawCoordinatorRequest.requesterId ?? (typeof rawCoordinatorRequest.requester === 'string' ? rawCoordinatorRequest.requester : null);

    const reviewerObj = typeof rawCoordinatorRequest.reviewer === 'object' ? rawCoordinatorRequest.reviewer : null;
    const reviewerId = reviewerObj?.id ?? rawCoordinatorRequest.reviewerId ?? (typeof rawCoordinatorRequest.reviewer === 'string' ? rawCoordinatorRequest.reviewer : null);

    return {
        id: rawCoordinatorRequest.id,
        requester: rawCoordinatorRequest.requester ?? (requesterId ? { id: requesterId } : null),
        requesterId: requesterId,
        reviewer: rawCoordinatorRequest.reviewer ?? (reviewerObj ? reviewerObj : null),
        reviewerId: reviewerId,
        action: rawCoordinatorRequest.action,
        data: parsedData,
        status: rawCoordinatorRequest.status,
        rejectionReason: rawCoordinatorRequest.rejectionReason ?? null,
        createdAt: rawCoordinatorRequest.createdAt,
        updatedAt: rawCoordinatorRequest.updatedAt,
    };
}


// --- EXPORTS ---
export { coordinatorService };
