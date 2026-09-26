// --- IMPORTS ---
import { executeDataQuery, executeDataMutation } from '../../services/dataConnectService';
import { CreateAuditLogSchema } from './auditSchema';


// --- AUDIT LOG SERVICES ---
export const getAuditLogs = async ({
    search = '',
    events,
    orderBy = [{ createdAt: 'DESC' }],
    limit = 100,
    offset = 0,
} = {}) => {
    const data = await executeDataQuery('GetAuditLogs', {
        search,
        events,
        orderBy,
        limit,
        offset,
    });

    return data?.auditLogs ?? [];
};

export const getAuditLogsByActorId = async ({
    search = '',
    actorId,
    events,
    orderBy = [{ createdAt: 'DESC' }],
    limit = 100,
    offset = 0,
} = {}) => {
    if (!actorId) {
        throw new Error('Actor ID is required to fetch actor audit logs.');
    }

    const data = await executeDataQuery('GetAuditLogsByActorId', {
        search,
        actorId,
        events,
        orderBy,
        limit,
        offset,
    });

    return data?.auditLogs ?? [];
};

export const getAuditLogsByEntityId = async ({
    search = '',
    entityId,
    orderBy = [{ createdAt: 'DESC' }],
    limit = 100,
    offset = 0,
} = {}) => {
    if (!entityId) {
        throw new Error('Entity ID is required to fetch entity audit logs.');
    }

    const data = await executeDataQuery('GetAuditLogsByEntityId', {
        search,
        entityId,
        orderBy,
        limit,
        offset,
    });

    return data?.auditLogs ?? [];
};

export const createAuditLog = async (payload) => {
    const validated = CreateAuditLogSchema.parse(payload);

    const data = await executeDataMutation('CreateAuditLog', {
        actorId: validated.actorId ?? null,
        entityId: validated.entityId,
        event: validated.event,
        data: validated.data,
    });

    return data?.auditLog_insert ?? null;
};
