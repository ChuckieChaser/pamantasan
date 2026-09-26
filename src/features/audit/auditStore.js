// --- AUDIT STORE ---
// Read-mostly store: audit logs are append-only. No update or delete operations.
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
    error: null,


    // --- QUERIES ---

    getAuditLogs: async (filters = {}) => {
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

    getAuditLogsByActorId: async (filters = {}) => {
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

    getAuditLogsByEntityId: async (filters = {}) => {
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
        // Audit log creation is fire-and-forget. Failure is non-fatal and must
        // never surface to the UI or block the primary action that triggered it.
        try {
            const log = await createAuditLog(payload);
            set((state) => ({
                auditLogs: log ? [log, ...state.auditLogs] : state.auditLogs,
            }));
            return log;
        } catch (error) {
            console.error('[useAuditStore] createAuditLog failed silently:', error?.message);
            return null;
        }
    },


    // --- CONTROLS ---

    clearError: () => set({ error: null }),

    reset: () => set({ auditLogs: [], isLoading: false, error: null }),
}));
