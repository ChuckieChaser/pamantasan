// --- USE NOTIFICATION HOOK ---
import { useCallback } from 'react';
import { useNotificationStore } from '../notificationStore';


// --- HOOK ---

export const useNotification = () => {
    const notifications = useNotificationStore((s) => s.notifications);
    const isLoading = useNotificationStore((s) => s.isLoading);
    const isMutating = useNotificationStore((s) => s.isMutating);
    const error = useNotificationStore((s) => s.error);

    const getNotificationsByRecipientId = useNotificationStore((s) => s.getNotificationsByRecipientId);
    const createNotification = useNotificationStore((s) => s.createNotification);
    const updateNotification = useNotificationStore((s) => s.updateNotification);
    const updateNotifications = useNotificationStore((s) => s.updateNotifications);
    const deleteNotifications = useNotificationStore((s) => s.deleteNotifications);
    const clearError = useNotificationStore((s) => s.clearError);
    const reset = useNotificationStore((s) => s.reset);

    const unreadCount = notifications.filter((n) => !n?.isRead).length;
    const hasUnread = unreadCount > 0;


    // --- HANDLERS ---

    const handleGetNotifications = useCallback(
        (filters) => getNotificationsByRecipientId(filters),
        [getNotificationsByRecipientId],
    );

    const handleMarkAsRead = useCallback(
        (id) => updateNotification(id, { isRead: true }),
        [updateNotification],
    );

    const handleMarkAllAsRead = useCallback(
        () => {
            const unreadIds = notifications.filter((n) => !n?.isRead).map((n) => n.id);
            if (unreadIds.length === 0) return Promise.resolve();
            return updateNotifications(unreadIds, { isRead: true });
        },
        [notifications, updateNotifications],
    );

    const handleDeleteNotifications = useCallback(
        (ids) => deleteNotifications(ids),
        [deleteNotifications],
    );


    return {
        // State
        notifications,
        unreadCount,
        hasUnread,
        isLoading,
        isMutating,
        error,

        // Handlers
        handleGetNotifications,
        handleMarkAsRead,
        handleMarkAllAsRead,
        handleDeleteNotifications,

        // Direct
        getNotificationsByRecipientId,
        createNotification,
        updateNotification,
        updateNotifications,
        clearError,
        reset,
    };
};
