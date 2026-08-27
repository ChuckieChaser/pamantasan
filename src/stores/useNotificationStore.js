// --- IMPORTS ---
import { create } from 'zustand';
import {
    NotificationInsertSchema,
    NotificationUpdateSchema,
} from '../schemas';
import {
    NOTIFICATION_ENTITY_TYPES,
    SYSTEM_ACTIONS,
} from '../constants';
import { MOCK_NOTIFICATIONS } from '../mocks';

// --- STORE DEFINITION ---
const useNotificationStore = create((set, get) => ({
    // STATE
    notifications: MOCK_NOTIFICATIONS,
    isLoading: false,
    error: null,

    // ACTIONS
    fetchNotifications: async (recipientId = null) => {
        set({ isLoading: true, error: null });

        try {
            let resultNotifications = [...get().notifications];

            if (recipientId) {
                resultNotifications = resultNotifications.filter(
                    (item) => item.recipient_id === recipientId
                );
            }

            set({ isLoading: false });
            return resultNotifications;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to fetch notifications.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    fetchViewNotifications: async (recipientId) => {
        set({ isLoading: true, error: null });

        try {
            const allNotifications = get().notifications.filter(
                (item) => !recipientId || item.recipient_id === recipientId
            );

            // Group by recipient_id, entity_type, entity_id, action (Replica of view_notifications SQL view)
            const groupedMap = new Map();

            for (const item of allNotifications) {
                const groupKey = `${item.recipient_id}|${item.entity_type}|${item.entity_id}|${item.action}`;

                if (!groupedMap.has(groupKey)) {
                    groupedMap.set(groupKey, {
                        recipient_id: item.recipient_id,
                        entity_type: item.entity_type,
                        entity_id: item.entity_id,
                        action: item.action,
                        interaction_count: 1,
                        last_interaction_at: item.created_at,
                        actor_ids: item.actor_id ? [item.actor_id] : [],
                        notification_ids: [item.id],
                        is_read: item.is_read,
                    });
                } else {
                    const existingGroup = groupedMap.get(groupKey);
                    existingGroup.interaction_count += 1;
                    if (new Date(item.created_at) > new Date(existingGroup.last_interaction_at)) {
                        existingGroup.last_interaction_at = item.created_at;
                    }
                    if (item.actor_id && !existingGroup.actor_ids.includes(item.actor_id)) {
                        existingGroup.actor_ids.push(item.actor_id);
                    }
                    existingGroup.notification_ids.push(item.id);
                    existingGroup.is_read = existingGroup.is_read && item.is_read;
                }
            }

            const aggregatedView = Array.from(groupedMap.values()).sort(
                (firstItem, secondItem) =>
                    new Date(secondItem.last_interaction_at) - new Date(firstItem.last_interaction_at)
            );

            set({ isLoading: false });
            return aggregatedView;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to aggregate notifications view.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    createNotification: async (notificationPayload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedData = NotificationInsertSchema.parse(notificationPayload);
            const timestamp = new Date().toISOString();

            const newNotification = {
                id: validatedData.id ?? `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                recipient_id: validatedData.recipient_id,
                actor_id: validatedData.actor_id ?? null,
                entity_type: validatedData.entity_type,
                entity_id: validatedData.entity_id,
                action: validatedData.action,
                is_read: validatedData.is_read ?? false,
                is_emailed: validatedData.is_emailed ?? false,
                created_at: timestamp,
                updated_at: timestamp,
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
                    item.id === notificationId
                        ? { ...item, is_read: true, updated_at: new Date().toISOString() }
                        : item
                ),
                isLoading: false,
            }));

            return true;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to mark notification as read.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    markAllNotificationsAsRead: async (recipientId) => {
        set({ isLoading: true, error: null });

        try {
            set((state) => ({
                notifications: state.notifications.map((item) =>
                    !recipientId || item.recipient_id === recipientId
                        ? { ...item, is_read: true, updated_at: new Date().toISOString() }
                        : item
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
                notifications: state.notifications.filter(
                    (item) => item.id !== notificationId
                ),
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
