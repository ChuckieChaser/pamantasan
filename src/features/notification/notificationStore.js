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

export const useNotificationStore = create((set, get) => ({
    // --- STATE ---
    notifications: [],
    isLoading: false,
    isMutating: false,
    error: null,


    // --- QUERIES ---

    fetchNotifications: async (filters = {}) => {
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

    markAsRead: async (id) => {
        set({ isMutating: true, error: null });
        try {
            const updated = await updateNotification(id, { isRead: true });
            set((state) => ({
                notifications: state.notifications.map((n) =>
                    n?.id === id ? { ...n, isRead: true, ...updated } : n
                ),
                isMutating: false,
            }));
            return updated;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to mark notification as read.' });
            throw error;
        }
    },

    markAllAsRead: async (ids) => {
        set({ isMutating: true, error: null });
        try {
            const result = await updateNotifications(ids, { isRead: true });
            set((state) => ({
                notifications: state.notifications.map((n) =>
                    ids.includes(n?.id) ? { ...n, isRead: true } : n
                ),
                isMutating: false,
            }));
            return result;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to mark all notifications as read.' });
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
