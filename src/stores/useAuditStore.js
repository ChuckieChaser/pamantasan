// --- IMPORTS ---
import { create } from 'zustand';

import { mutationSchema } from '../schemas';
import { auditService } from '../services/auditService';


// --- SYNC THROTTLES & MUTEX ---
let inFlightAuditPromise = null;
let lastFetchAuditTimestamp = 0;

// --- STORE ---
const useAuditStore = create((set, get) => ({
    // STATES
    auditLogs: [],
    isLoading: false,
    error: null,
    
    // CORE
    fetchAuditLogs: async (force = false) => {
        if (!force) {
            if (inFlightAuditPromise) {
                return inFlightAuditPromise;
            }
            if (Date.now() - lastFetchAuditTimestamp < 5000 && (get().auditLogs || []).length > 0) {
                return get().auditLogs || [];
            }
        }

        inFlightAuditPromise = (async () => {
            set({ isLoading: true, error: null });

            try {
                const auditLogs = await auditService.fetchAuditLogs();
                lastFetchAuditTimestamp = Date.now();
                const sortedLogs = [...auditLogs].sort(
                    (a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0)
                );

                set((state) => {
                    const serverIdSet = new Set(sortedLogs.map((l) => l.id));
                    const localOnlyLogs = (state.auditLogs || []).filter(
                        (l) => l && l.id && !serverIdSet.has(l.id)
                    );
                    return {
                        auditLogs: [...sortedLogs, ...localOnlyLogs].sort(
                            (a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0)
                        ),
                        isLoading: false,
                        error: null,
                    };
                });

                return sortedLogs;
            } catch (error) {
                const message = error?.message ?? 'Failed to fetch audit logs.';
                set({ isLoading: false, error: message });

                return [];
            } finally {
                inFlightAuditPromise = null;
            }
        })();

        return inFlightAuditPromise;
    },

    insertAuditLog: async (payload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedPayload = mutationSchema.InsertAuditLogSchema.parse(payload);
            const newAuditLog = await auditService.insertAuditLog(validatedPayload);

            set((state) => ({
                auditLogs: [newAuditLog, ...state.auditLogs].sort(
                    (a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0)
                ),
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
