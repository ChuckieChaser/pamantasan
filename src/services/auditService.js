// --- IMPORTS ---
import { dataConnectService } from './dataConnectService';


// --- SERVICES ---
const auditService = {
    // CORE
    fetchAuditLogs: async () => {
        try {
            const data = await dataConnectService.executeQuery('FetchAuditLogs');
            const auditLogs = data?.auditLogs ?? [];

            return auditLogs.map(formatLiveAuditLog);
        } catch (error) {
            console.error('Failed to fetch audit logs from Firebase Data Connect:', error);
            return [];
        }
    },

    insertAuditLog: async (payload) => {
        const data = await dataConnectService.executeMutation('InsertAuditLog', {
            actorId: payload.actorId ?? null,
            entityType: payload.entityType,
            entityId: payload.entityId,
            action: payload.action,
            data: payload.data,
            createdAt: payload.createdAt,
        });

        return formatLiveAuditLog(data?.auditLog_insert ?? data?.auditLogs_insert);
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
