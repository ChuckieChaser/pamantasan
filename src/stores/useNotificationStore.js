// --- IMPORTS ---
import { create } from 'zustand';

import { mutationSchema } from '../schemas';
import { notificationService } from '../services';


// --- STORE ---
const useNotificationStore = create((set, get) => ({
    // STATES
    recipientId: null,
    notifications: [],
    viewNotifications: [],
    isLoading: false,
    error: null,

    // CORE
    fetchNotifications: async (recipientId) => {
        set({ isLoading: true, error: null });

        try {
            const notifications = await notificationService.fetchNotifications(recipientId);
            set({ recipientId: recipientId, notifications: notifications, isLoading: false, error: null });

            return notifications;
        } catch (error) {
            const message = error?.message ?? `Failed to fetch notifications for recipient "${recipientId}".`;
            set({ isLoading: false, error: message });

            return [];
        }
    },

    fetchViewNotifications: async (recipientId) => {
        set({ isLoading: true, error: null });

        try {
            const viewNotifications = await notificationService.fetchViewNotifications(recipientId);
            set({ recipientId: recipientId, viewNotifications: viewNotifications, isLoading: false, error: null });

            return viewNotifications;
        } catch (error) {
            const message = error?.message ?? `Failed to fetch notification views for recipient "${recipientId}".`;
            set({ isLoading: false, error: message });

            return [];
        }
    },

    insertNotification: async (payload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedPayload = mutationSchema.InsertNotificationSchema.parse(payload);
            const newNotification = await notificationService.insertNotification(validatedPayload);

            set((state) => ({
                notifications: [newNotification, ...state.notifications],
                isLoading: false,
                error: null,
            }));

            return newNotification;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to insert notification.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    updateNotification: async (id, payload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedPayload = mutationSchema.UpdateNotificationSchema.parse(payload);
            const updatedNotification = await notificationService.updateNotification(id, validatedPayload);

            const recipientId = get().recipientId;

            const [viewNotifications] = await Promise.all([
                recipientId ? notificationService.fetchViewNotifications(recipientId) : Promise.resolve(get().viewNotifications),
            ]);

            set((state) => ({
                notifications: state.notifications.map((item) =>
                    item.id === id ? updatedNotification : item
                ),
                viewNotifications: viewNotifications,
                isLoading: false,
                error: null,
            }));

            return updatedNotification;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to update notification.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    deleteNotification: async (id) => {
        set({ isLoading: true, error: null });

        try {
            const isDeleted = await notificationService.deleteNotification(id);

            if (isDeleted) {
                const recipientId = get().recipientId;

                const viewNotifications = recipientId
                    ? await notificationService.fetchViewNotifications(recipientId)
                    : get().viewNotifications;

                set((state) => ({
                    notifications: state.notifications.filter((item) => item.id !== id),
                    viewNotifications: viewNotifications,
                    isLoading: false,
                    error: null,
                }));
            } else {
                set({ isLoading: false });
            }

            return isDeleted;
        } catch (error) {
            const message = error?.message ?? 'Failed to delete notification.';
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
export { useNotificationStore };
