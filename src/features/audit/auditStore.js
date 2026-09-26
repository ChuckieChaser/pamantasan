// --- AUDIT STORE ---
// Read-mostly store: audit logs are append-only; no update or delete operations.
import { create } from 'zustand';
import {
    getAuditLogs,
    getAuditLogsByActorId,
    getAuditLogsByEntityId,
    createAuditLog,
} from './auditService';


// --- STORE ---

export const useAuditStore = create((set) => ({
    // --- STATE ---
    auditLogs: [],
    isLoading: false,
    isMutating: false,
    error: null,


    // --- QUERIES ---

    fetchAuditLogs: async (filters = {}) => {
        set({ isLoading: true, error: null });
        try {
            const auditLogs = await getAuditLogs(filters);
            set({ auditLogs, isLoading: false });
            return auditLogs;
        } catch (error) {
            set({ isLoading: false, error: error?.message ?? 'Failed to fetch audit logs.' });
            return [];
        }
    },

    fetchAuditLogsByActorId: async (filters = {}) => {
        set({ isLoading: true, error: null });
        try {
            const auditLogs = await getAuditLogsByActorId(filters);
            set({ auditLogs, isLoading: false });
            return auditLogs;
        } catch (error) {
            set({ isLoading: false, error: error?.message ?? 'Failed to fetch audit logs by actor.' });
            return [];
        }
    },

    fetchAuditLogsByEntityId: async (filters = {}) => {
        set({ isLoading: true, error: null });
        try {
            const auditLogs = await getAuditLogsByEntityId(filters);
            set({ auditLogs, isLoading: false });
            return auditLogs;
        } catch (error) {
            set({ isLoading: false, error: error?.message ?? 'Failed to fetch audit logs by entity.' });
            return [];
        }
    },


    // --- MUTATIONS ---

    createAuditLog: async (payload) => {
        set({ isMutating: true, error: null });
        try {
            const log = await createAuditLog(payload);
            set((state) => ({
                auditLogs: log ? [log, ...state.auditLogs] : state.auditLogs,
                isMutating: false,
            }));
            return log;
        } catch (error) {
            // Audit log creation failure is non-fatal — log but don't surface to UI
            console.error('[useAuditStore] Failed to create audit log:', error?.message);
            set({ isMutating: false });
            return null;
        }
    },


    // --- CONTROLS ---

    clearError: () => set({ error: null }),

    reset: () => set({ auditLogs: [], isLoading: false, isMutating: false, error: null }),
}));
