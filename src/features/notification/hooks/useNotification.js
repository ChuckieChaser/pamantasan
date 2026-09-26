// --- USE NOTIFICATION HOOK ---
import { useCallback } from 'react';
import { useNotificationStore } from '../notificationStore';


// --- HOOK ---

export const useNotification = () => {
    const notifications = useNotificationStore((s) => s.notifications);
    const isLoading = useNotificationStore((s) => s.isLoading);
    const isMutating = useNotificationStore((s) => s.isMutating);
    const error = useNotificationStore((s) => s.error);

    const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
    const createNotification = useNotificationStore((s) => s.createNotification);
    const markAsRead = useNotificationStore((s) => s.markAsRead);
    const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
    const deleteNotifications = useNotificationStore((s) => s.deleteNotifications);
    const clearError = useNotificationStore((s) => s.clearError);
    const reset = useNotificationStore((s) => s.reset);

    const unreadCount = notifications.filter((n) => !n?.isRead).length;
    const hasUnread = unreadCount > 0;


    // --- HANDLERS ---

    const handleFetchNotifications = useCallback(
        (filters) => fetchNotifications(filters),
        [fetchNotifications],
    );

    const handleMarkAsRead = useCallback(
        (id) => markAsRead(id),
        [markAsRead],
    );

    const handleMarkAllAsRead = useCallback(
        () => {
            const unreadIds = notifications.filter((n) => !n?.isRead).map((n) => n.id);
            if (unreadIds.length === 0) return Promise.resolve();
            return markAllAsRead(unreadIds);
        },
        [notifications, markAllAsRead],
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
        handleFetchNotifications,
        handleMarkAsRead,
        handleMarkAllAsRead,
        handleDeleteNotifications,

        // Direct
        createNotification,
        clearError,
        reset,
    };
};
