// --- USE AUDIT HOOK ---
import { useCallback } from 'react';
import { useAuditStore } from '../auditStore';


// --- HOOK ---

export const useAudit = () => {
    const auditLogs = useAuditStore((s) => s.auditLogs);
    const isLoading = useAuditStore((s) => s.isLoading);
    const error = useAuditStore((s) => s.error);

    const getAuditLogs = useAuditStore((s) => s.getAuditLogs);
    const getAuditLogsByActorId = useAuditStore((s) => s.getAuditLogsByActorId);
    const getAuditLogsByEntityId = useAuditStore((s) => s.getAuditLogsByEntityId);
    const createAuditLog = useAuditStore((s) => s.createAuditLog);
    const clearError = useAuditStore((s) => s.clearError);
    const reset = useAuditStore((s) => s.reset);


    // --- HANDLERS ---

    const handleGetAuditLogs = useCallback(
        (filters) => getAuditLogs(filters),
        [getAuditLogs],
    );

    const handleGetAuditLogsByActorId = useCallback(
        (filters) => getAuditLogsByActorId(filters),
        [getAuditLogsByActorId],
    );

    const handleGetAuditLogsByEntityId = useCallback(
        (filters) => getAuditLogsByEntityId(filters),
        [getAuditLogsByEntityId],
    );

    /**
     * Fire-and-forget audit trail creation.
     * Never awaited at call sites — must not block the primary action.
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
        handleGetAuditLogs,
        handleGetAuditLogsByActorId,
        handleGetAuditLogsByEntityId,
        logAuditEvent,

        // Direct
        clearError,
        reset,
    };
};
