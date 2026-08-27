// --- IMPORTS ---
import { create } from 'zustand';
import { AuditLogInsertSchema } from '../schemas';
import {
    AUDIT_LOG_ENTITY_TYPES,
    SYSTEM_ACTIONS,
} from '../constants';
import { MOCK_AUDIT_LOGS } from '../mocks';

// --- STORE DEFINITION ---
const useAuditLogStore = create((set, get) => ({
    // STATE
    auditLogs: MOCK_AUDIT_LOGS,
    isLoading: false,
    error: null,

    // ACTIONS
    fetchAuditLogs: async (filterOptions = {}) => {
        set({ isLoading: true, error: null });

        try {
            let resultLogs = [...get().auditLogs];

            if (filterOptions.actorId) {
                resultLogs = resultLogs.filter(
                    (item) => item.actor_id === filterOptions.actorId
                );
            }

            if (filterOptions.entityType) {
                resultLogs = resultLogs.filter(
                    (item) => item.entity_type === filterOptions.entityType
                );
            }

            if (filterOptions.entityId) {
                resultLogs = resultLogs.filter(
                    (item) => item.entity_id === filterOptions.entityId
                );
            }

            if (filterOptions.action) {
                resultLogs = resultLogs.filter(
                    (item) => item.action === filterOptions.action
                );
            }

            // Order by created_at DESC
            resultLogs.sort(
                (firstItem, secondItem) =>
                    new Date(secondItem.created_at) - new Date(firstItem.created_at)
            );

            set({ isLoading: false });
            return resultLogs;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to fetch audit logs.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    createAuditLog: async (auditPayload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedData = AuditLogInsertSchema.parse(auditPayload);
            const timestamp = new Date().toISOString();

            const newLog = {
                id: validatedData.id ?? `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                actor_id: validatedData.actor_id ?? null,
                entity_type: validatedData.entity_type,
                entity_id: validatedData.entity_id,
                action: validatedData.action,
                data: validatedData.data,
                created_at: timestamp,
            };

            set((state) => ({
                auditLogs: [newLog, ...state.auditLogs],
                isLoading: false,
            }));

            return newLog;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to create audit log entry.';
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
