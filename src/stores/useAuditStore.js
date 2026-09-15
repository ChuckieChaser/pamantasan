// --- IMPORTS ---
import { create } from 'zustand';

import { mutationSchema } from '../schemas';
import { auditService } from '../services';


// --- STORE ---
const useAuditStore = create((set) => ({
    // STATES
    auditLogs: [],
    isLoading: false,
    error: null,

    // CORE
    fetchAuditLogs: async () => {
        set({ isLoading: true, error: null });

        try {
            const auditLogs = await auditService.fetchAuditLogs();
            set({ auditLogs: auditLogs, isLoading: false, error: null });

            return auditLogs;
        } catch (error) {
            const message = error?.message ?? 'Failed to fetch audit logs.';
            set({ isLoading: false, error: message });

            return [];
        }
    },

    insertAuditLog: async (payload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedPayload = mutationSchema.InsertAuditLogSchema.parse(payload);
            const newAuditLog = await auditService.insertAuditLog(validatedPayload);

            set((state) => ({
                auditLogs: [newAuditLog, ...state.auditLogs],
                isLoading: false,
                error: null,
            }));

            return newAuditLog;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to insert audit log.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    // CONTROLS
    clearError: () => {
        set({ error: null });
    },
}));


// --- EXPORTS ---
export { useAuditStore };
