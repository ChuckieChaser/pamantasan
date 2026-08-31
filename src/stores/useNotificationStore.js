// --- IMPORTS ---
import { create } from 'zustand';
import {
    NotificationInsertSchema,
} from '../schemas';

// --- STORE DEFINITION ---
const useNotificationStore = create((set, get) => ({
    // STATE
    notifications: [],
    isLoading: false,
    error: null,

    // ACTIONS
    fetchNotificationsByRecipientId: async (recipientId) => {
        set({ isLoading: true, error: null });

        try {
            const userNotifications = get().notifications.filter(
                (item) => item.recipient_id === recipientId
            );
            set({ isLoading: false });
            return userNotifications;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to fetch notifications.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    createNotification: async (notificationPayload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedData = NotificationInsertSchema.parse(notificationPayload);
            const newNotification = {
                id: validatedData.id ?? `notif-${Date.now()}`,
                recipient_id: validatedData.recipient_id,
                actor_id: validatedData.actor_id ?? null,
                entity_type: validatedData.entity_type,
                entity_id: validatedData.entity_id,
                action: validatedData.action,
                is_read: false,
                is_emailed: false,
                created_at: new Date().toISOString(),
            };

            set((state) => ({
                notifications: [newNotification, ...state.notifications],
                isLoading: false,
            }));

            return newNotification;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to create notification.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    markNotificationAsRead: async (notificationId) => {
        set({ isLoading: true, error: null });

        try {
            set((state) => ({
                notifications: state.notifications.map((item) =>
                    item.id === notificationId ? { ...item, is_read: true } : item
                ),
                isLoading: false,
            }));
            return true;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to update notification read status.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    markAllNotificationsAsRead: async (recipientId) => {
        set({ isLoading: true, error: null });

        try {
            set((state) => ({
                notifications: state.notifications.map((item) =>
                    item.recipient_id === recipientId ? { ...item, is_read: true } : item
                ),
                isLoading: false,
            }));
            return true;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to mark all notifications as read.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    deleteNotification: async (notificationId) => {
        set({ isLoading: true, error: null });

        try {
            set((state) => ({
                notifications: state.notifications.filter((item) => item.id !== notificationId),
                isLoading: false,
            }));
            return true;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to delete notification.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    clearError: () => {
        set({ error: null });
    },
}));

export {
    useNotificationStore,
};

export default useNotificationStore;
