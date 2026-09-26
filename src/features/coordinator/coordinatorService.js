// --- IMPORTS ---
import { executeDataQuery, executeDataMutation } from '../../services/dataConnectService';
import { CreateCoordinatorRequestSchema, UpdateCoordinatorRequestSchema, UpdateCoordinatorRequestsSchema, DeleteCoordinatorRequestsSchema } from './coordinatorSchema';


// --- COORDINATOR REQUEST SERVICES ---
export const getCoordinatorRequests = async ({
    search = '',
    statuses,
    orderBy = [{ createdAt: 'DESC' }],
    limit = 100,
    offset = 0,
} = {}) => {
    const data = await executeDataQuery('GetCoordinatorRequests', {
        search,
        statuses,
        orderBy,
        limit,
        offset,
    });

    return data?.coordinatorRequests ?? [];
};

export const getCoordinatorRequestsByRequesterId = async ({
    search = '',
    requesterId,
    statuses,
    orderBy = [{ createdAt: 'DESC' }],
    limit = 100,
    offset = 0,
} = {}) => {
    if (!requesterId) {
        throw new Error('Requester ID is required to fetch coordinator requests.');
    }

    const data = await executeDataQuery('GetCoordinatorRequestsByRequesterId', {
        search,
        requesterId,
        statuses,
        orderBy,
        limit,
        offset,
    });

    return data?.coordinatorRequests ?? [];
};

export const getCoordinatorRequestById = async (id) => {
    if (!id) return null;

    const data = await executeDataQuery('GetCoordinatorRequestById', { id });
    const requests = data?.coordinatorRequests ?? [];

    return requests[0] ?? null;
};

export const createCoordinatorRequest = async (payload) => {
    const validated = CreateCoordinatorRequestSchema.parse(payload);

    const data = await executeDataMutation('CreateCoordinatorRequest', {
        requesterId: validated.requesterId,
        reviewerId: validated.reviewerId ?? null,
        action: validated.action,
        data: validated.data,
    });

    return data?.coordinatorRequest_insert ?? null;
};

export const updateCoordinatorRequest = async (id, payload) => {
    if (!id) {
        throw new Error('Coordinator request ID is required for update.');
    }

    const validated = UpdateCoordinatorRequestSchema.parse({ ...payload, id });

    const data = await executeDataMutation('UpdateCoordinatorRequest', {
        id: validated.id,
        reviewerId: validated.reviewerId,
        action: validated.action,
        data: validated.data,
        status: validated.status,
        rejectionReason: validated.rejectionReason,
        updatedAt: validated.updatedAt ?? new Date().toISOString(),
    });

    return data?.coordinatorRequest_update ?? null;
};

export const updateCoordinatorRequests = async (ids, payload = {}) => {
    const validated = UpdateCoordinatorRequestsSchema.parse({ ...payload, ids });

    const data = await executeDataMutation('UpdateCoordinatorRequests', {
        ids: validated.ids,
        reviewerId: validated.reviewerId,
        status: validated.status,
        rejectionReason: validated.rejectionReason,
        updatedAt: validated.updatedAt ?? new Date().toISOString(),
    });

    return data?.coordinatorRequest_updateMany ?? null;
};

export const deleteCoordinatorRequests = async (ids) => {
    const validated = DeleteCoordinatorRequestsSchema.parse({ ids });

    const data = await executeDataMutation('DeleteCoordinatorRequests', {
        ids: validated.ids,
    });

    return data?.coordinatorRequest_deleteMany ?? null;
};
