// --- IMPORTS ---
import { dataConnectService } from './dataConnectService';


// --- SERVICES ---
const auditService = {
    // CORE
    fetchAuditLogs: async () => {
        try {
            const data = await dataConnectService.executeQuery('FetchAuditLogs');
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

        return {
            id: raw?.id ?? `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            actorId: payload.actorId ?? null,
            actor: payload.actor || (payload.actorId ? { id: payload.actorId } : null),
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

    return {
        id: rawAuditLog.id,
        actor: rawAuditLog.actor,
        entityType: rawAuditLog.entityType,
        entityId: rawAuditLog.entityId,
        action: rawAuditLog.action,
        data: rawAuditLog.data,
        createdAt: rawAuditLog.createdAt,
    };
}


// --- EXPORTS ---
export { auditService };
