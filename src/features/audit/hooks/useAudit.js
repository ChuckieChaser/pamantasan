// --- USE AUDIT HOOK ---
import { useCallback } from 'react';
import { useAuditStore } from '../auditStore';


// --- HOOK ---

export const useAudit = () => {
    const auditLogs = useAuditStore((s) => s.auditLogs);
    const isLoading = useAuditStore((s) => s.isLoading);
    const error = useAuditStore((s) => s.error);

    const fetchAuditLogs = useAuditStore((s) => s.fetchAuditLogs);
    const fetchAuditLogsByActorId = useAuditStore((s) => s.fetchAuditLogsByActorId);
    const fetchAuditLogsByEntityId = useAuditStore((s) => s.fetchAuditLogsByEntityId);
    const createAuditLog = useAuditStore((s) => s.createAuditLog);
    const clearError = useAuditStore((s) => s.clearError);
    const reset = useAuditStore((s) => s.reset);


    // --- HANDLERS ---

    const handleFetchAuditLogs = useCallback(
        (filters) => fetchAuditLogs(filters),
        [fetchAuditLogs],
    );

    const handleFetchByActorId = useCallback(
        (filters) => fetchAuditLogsByActorId(filters),
        [fetchAuditLogsByActorId],
    );

    const handleFetchByEntityId = useCallback(
        (filters) => fetchAuditLogsByEntityId(filters),
        [fetchAuditLogsByEntityId],
    );

    /**
     * Fire-and-forget audit trail creation. Never awaited at call sites.
     * @param {Object} payload
     */
    const logAuditEvent = useCallback(
        (payload) => createAuditLog(payload),
        [createAuditLog],
    );


    return {
        // State
        auditLogs,
        isLoading,
        error,

        // Handlers
        handleFetchAuditLogs,
        handleFetchByActorId,
        handleFetchByEntityId,
        logAuditEvent,

        // Direct
        clearError,
        reset,
    };
};
