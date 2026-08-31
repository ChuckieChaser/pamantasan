// --- IMPORTS ---
import { create } from 'zustand';
import {
    AuditLogInsertSchema,
} from '../schemas';

// --- STORE DEFINITION ---
const useAuditLogStore = create((set, get) => ({
    // STATE
    auditLogs: [],
    isLoading: false,
    error: null,

    // ACTIONS
    fetchAuditLogs: async (filterOptions = {}) => {
        set({ isLoading: true, error: null });

        try {
            let resultLogs = [...get().auditLogs];

            if (filterOptions.actorId) {
                resultLogs = resultLogs.filter(
                    (log) => log.actor_id === filterOptions.actorId
                );
            }

            if (filterOptions.entityType) {
                resultLogs = resultLogs.filter(
                    (log) => log.entity_type === filterOptions.entityType
                );
            }

            if (filterOptions.action) {
                resultLogs = resultLogs.filter(
                    (log) => log.action === filterOptions.action
                );
            }

            set({ isLoading: false });
            return resultLogs;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to fetch audit logs.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    createAuditLog: async (logPayload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedData = AuditLogInsertSchema.parse(logPayload);
            const newAuditLog = {
                id: validatedData.id ?? `audit-${Date.now()}`,
                actor_id: validatedData.actor_id ?? null,
                entity_type: validatedData.entity_type,
                entity_id: validatedData.entity_id,
                action: validatedData.action,
                data: validatedData.data ?? {},
                created_at: new Date().toISOString(),
            };

            set((state) => ({
                auditLogs: [newAuditLog, ...state.auditLogs],
                isLoading: false,
            }));

            return newAuditLog;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to create audit log.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    clearError: () => {
        set({ error: null });
    },
}));

export {
    useAuditLogStore,
};

export default useAuditLogStore;
