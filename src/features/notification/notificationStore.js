// --- NOTIFICATION STORE ---
import { create } from 'zustand';
import {
    getNotificationsByRecipientId,
    createNotification,
    updateNotification,
    updateNotifications,
    deleteNotifications,
} from './notificationService';


// --- STORE ---

export const useNotificationStore = create((set) => ({
    // --- STATE ---
    notifications: [],
    isLoading: false,
    isMutating: false,
    error: null,


    // --- QUERIES ---

    getNotificationsByRecipientId: async (filters = {}) => {
        set({ isLoading: true, error: null });
        try {
            const notifications = await getNotificationsByRecipientId(filters);
            set({ notifications, isLoading: false });
            return notifications;
        } catch (error) {
            set({ isLoading: false, error: error?.message ?? 'Failed to fetch notifications.' });
            return [];
        }
    },


    // --- MUTATIONS ---

    createNotification: async (payload) => {
        set({ isMutating: true, error: null });
        try {
            const notification = await createNotification(payload);
            set((state) => ({
                notifications: notification ? [notification, ...state.notifications] : state.notifications,
                isMutating: false,
            }));
            return notification;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to create notification.' });
            throw error;
        }
    },

    updateNotification: async (id, payload) => {
        set({ isMutating: true, error: null });
        try {
            const updated = await updateNotification(id, payload);
            set((state) => ({
                notifications: state.notifications.map((n) =>
                    n?.id === id ? { ...n, ...updated } : n
                ),
                isMutating: false,
            }));
            return updated;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to update notification.' });
            throw error;
        }
    },

    updateNotifications: async (ids, payload) => {
        set({ isMutating: true, error: null });
        try {
            const result = await updateNotifications(ids, payload);
            set((state) => ({
                notifications: state.notifications.map((n) =>
                    ids.includes(n?.id) ? { ...n, ...payload } : n
                ),
                isMutating: false,
            }));
            return result;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to update notifications.' });
            throw error;
        }
    },

    deleteNotifications: async (ids) => {
        set({ isMutating: true, error: null });
        try {
            const result = await deleteNotifications(ids);
            set((state) => ({
                notifications: state.notifications.filter((n) => !ids.includes(n?.id)),
                isMutating: false,
            }));
            return result;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to delete notifications.' });
            throw error;
        }
    },


    // --- CONTROLS ---

    clearError: () => set({ error: null }),

    reset: () => set({ notifications: [], isLoading: false, isMutating: false, error: null }),
}));
