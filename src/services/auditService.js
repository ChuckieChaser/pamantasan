// --- IMPORTS ---
import { dataConnectService } from './dataConnectService';


// --- SERVICES ---
const auditService = {
    // CORE
    fetchAuditLogs: async (variables = null) => {
        try {
            let data = null;
            if (variables && Object.keys(variables).length > 0) {
                try {
                    data = await dataConnectService.executeQuery('FetchAuditLogs', variables);
                } catch {
                    data = await dataConnectService.executeQuery('FetchAuditLogs');
                }
            } else {
                data = await dataConnectService.executeQuery('FetchAuditLogs');
            }
            const auditLogs = data?.auditLogs ?? [];

            return auditLogs
                .map(formatLiveAuditLog)
                .filter(Boolean)
                .sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0));
        } catch (error) {
            console.error('Failed to fetch audit logs from Firebase Data Connect:', error);
            return [];
        }
    },

    insertAuditLog: async (payload) => {
        const timestamp = payload.createdAt || new Date().toISOString();
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const validActorId = payload.actorId && uuidRegex.test(payload.actorId) ? payload.actorId : null;

        let raw = null;
        try {
            const data = await dataConnectService.executeMutation('InsertAuditLog', {
                actorId: validActorId,
                entityType: payload.entityType,
                entityId: payload.entityId,
                action: payload.action,
                data: payload.data,
                createdAt: timestamp,
            });
            raw = data?.auditLog_insert ?? data?.auditLogs_insert;
        } catch (error) {
            console.warn('Failed to insert audit log to Firebase Data Connect, creating local fallback record:', error);
        }

        const parsedData = payload.data ? (typeof payload.data === 'object' ? payload.data : (() => {
            try { return JSON.parse(payload.data); } catch { return {}; }
        })()) : {};

        const resolvedActor = payload.actor || (parsedData.actorName || parsedData.actorRole ? {
            id: payload.actorId || parsedData.actorId,
            firstName: parsedData.actorName?.split(' ')[0] || '',
            lastName: parsedData.actorName?.split(' ').slice(1).join(' ') || '',
            name: parsedData.actorName,
            role: parsedData.actorRole,
            email: parsedData.actorEmail,
        } : (payload.actorId ? { id: payload.actorId } : null));

        return {
            id: raw?.id ?? `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            actorId: payload.actorId ?? parsedData.actorId ?? null,
            actor: resolvedActor,
            entityType: payload.entityType,
            entityId: payload.entityId,
            action: payload.action,
            data: payload.data,
            createdAt: timestamp,
        };
    },
};


// --- HELPERS ---
function formatLiveAuditLog(rawAuditLog) {
    if (!rawAuditLog) {
        return null;
    }

    const parsedData = rawAuditLog.data ? (typeof rawAuditLog.data === 'object' ? rawAuditLog.data : (() => {
        try { return JSON.parse(rawAuditLog.data); } catch { return {}; }
    })()) : {};

    const resolvedActor = (rawAuditLog.actor && typeof rawAuditLog.actor === 'object')
        ? {
            ...rawAuditLog.actor,
            role: rawAuditLog.actor.role || parsedData.actorRole || null,
        }
        : (parsedData.actorName || parsedData.actorRole ? {
            id: parsedData.actorId,
            firstName: parsedData.actorName?.split(' ')[0] || '',
            lastName: parsedData.actorName?.split(' ').slice(1).join(' ') || '',
            name: parsedData.actorName,
            role: parsedData.actorRole,
            email: parsedData.actorEmail,
        } : null);

    return {
        id: rawAuditLog.id,
        actorId: rawAuditLog.actor?.id || parsedData.actorId || null,
        actor: resolvedActor,
        entityType: rawAuditLog.entityType,
        entityId: rawAuditLog.entityId,
        action: rawAuditLog.action,
        data: rawAuditLog.data,
        createdAt: rawAuditLog.createdAt,
    };
}


// --- EXPORTS ---
export { auditService };
