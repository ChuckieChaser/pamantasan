// --- IMPORTS ---
import { httpsCallable } from 'firebase/functions';
import { dataConnectService } from './dataConnectService';
import { functions } from './firebase';


// --- SERVICES ---
const notificationService = {
    // CORE
    fetchNotifications: async (recipientId) => {
        try {
            const data = await dataConnectService.executeQuery('FetchNotifications', { recipientId: recipientId });
            const notifications = data?.notifications ?? [];

            return notifications.map(formatLiveNotification);
        } catch (error) {
            console.error(`Failed to fetch notifications for recipient "${recipientId}":`, error);
            return [];
        }
    },

    fetchViewNotifications: async (recipientId) => {
        try {
            const data = await dataConnectService.executeQuery('FetchViewNotifications', { recipientId: recipientId });
            const viewNotifications = data?.viewNotifications ?? [];

            return viewNotifications.map(formatLiveViewNotification);
        } catch (error) {
            console.error(`Failed to fetch notification view for recipient "${recipientId}":`, error);
            return [];
        }
    },

    insertNotification: async (payload) => {
        const timestamp = payload.createdAt || new Date().toISOString();
        let raw = null;
        try {
            const data = await dataConnectService.executeMutation('InsertNotification', {
                recipientId: payload.recipientId,
                actorId: payload.actorId ?? null,
                entityType: payload.entityType,
                entityId: payload.entityId,
                action: payload.action,
                isRead: payload.isRead ?? false,
                isEmailed: payload.isEmailed ?? false,
                createdAt: timestamp,
                updatedAt: payload.updatedAt ?? timestamp,
            });
            raw = data?.notification_insert ?? data?.notifications_insert;
        } catch (error) {
            console.warn('Failed to insert notification to Firebase Data Connect, creating local fallback record:', error);
        }

        return {
            id: raw?.id ?? `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            recipientId: payload.recipientId,
            recipient: { id: payload.recipientId },
            actorId: payload.actorId ?? null,
            actor: payload.actorId ? { id: payload.actorId } : null,
            entityType: payload.entityType,
            entityId: payload.entityId,
            action: payload.action,
            isRead: payload.isRead ?? false,
            isEmailed: payload.isEmailed ?? false,
            createdAt: timestamp,
            updatedAt: payload.updatedAt ?? timestamp,
        };
    },

    updateNotification: async (id, payload) => {
        const timestamp = payload.updatedAt || new Date().toISOString();
        let raw = null;
        try {
            const data = await dataConnectService.executeMutation('UpdateNotification', {
                id: id,
                isRead: payload.isRead,
                isEmailed: payload.isEmailed,
                updatedAt: timestamp,
            });
            raw = data?.notification_update ?? data?.notifications_update;
        } catch (error) {
            console.warn(`Failed to update notification ${id} in Firebase Data Connect:`, error);
        }

        const formatted = raw ? formatLiveNotification(raw) : null;
        return {
            id: id,
            ...formatted,
            ...(payload.isRead !== undefined ? { isRead: payload.isRead } : {}),
            ...(payload.isEmailed !== undefined ? { isEmailed: payload.isEmailed } : {}),
            updatedAt: timestamp,
        };
    },

    deleteNotification: async (id) => {
        const data = await dataConnectService.executeMutation('DeleteNotification', { id: id });
        return Boolean(data?.notification_delete ?? data?.notifications_delete);
    },

    // EXTENSIBLE NOTIFICATION EMAIL DISPATCHER
    dispatchNotificationEmail: async (payload) => {
        if (!functions) {
            console.warn('[notificationService] Functions not configured; skipping email dispatch.');
            return null;
        }

        let targetEmail = payload?.toEmail;
        if (!targetEmail && payload?.recipientId) {
            try {
                const { useUserStore } = await import('../stores/useUserStore');
                const allUsers = useUserStore.getState().users || [];
                const user = allUsers.find((u) => String(u.id) === String(payload.recipientId));
                if (user?.email) {
                    targetEmail = user.email;
                }
            } catch {
                /* ignore */
            }
        }

        const cleanEmail = (targetEmail || '').toString().trim().toLowerCase();
        if (!cleanEmail) {
            // Silently skip if no email address is available rather than failing with an unhandled exception
            return null;
        }

        const title = payload.title || payload.subject || 'System Notification';
        const message = payload.message || payload.description || payload.reason || title;

        try {
            const dispatch = httpsCallable(functions, 'dispatchSystemNotification');
            const result = await dispatch({
                ...payload,
                toEmail: cleanEmail,
                title,
                message,
            });
            return result?.data;
        } catch (error) {
            console.warn('[notificationService] Notification email dispatch failed:', error?.message || error);
            return null;
        }
    },
};


// --- HELPERS ---
function formatLiveNotification(rawNotification) {
    if (!rawNotification) {
        return null;
    }

    return {
        id: rawNotification.id,
        recipient: rawNotification.recipient,
        actor: rawNotification.actor,
        entityType: rawNotification.entityType,
        entityId: rawNotification.entityId,
        action: rawNotification.action,
        isRead: rawNotification.isRead,
        isEmailed: rawNotification.isEmailed,
        createdAt: rawNotification.createdAt,
        updatedAt: rawNotification.updatedAt,
    };
}

function formatLiveViewNotification(rawViewNotification) {
    if (!rawViewNotification) {
        return null;
    }

    return {
        recipientId: rawViewNotification.recipientId,
        entityType: rawViewNotification.entityType,
        entityId: rawViewNotification.entityId,
        action: rawViewNotification.action,
        interactionCount: rawViewNotification.interactionCount,
        lastInteractionAt: rawViewNotification.lastInteractionAt,
        actorIds: rawViewNotification.actorIds,
        notificationIds: rawViewNotification.notificationIds,
        isRead: rawViewNotification.isRead,
    };
}


// --- EXPORTS ---
export { notificationService };
