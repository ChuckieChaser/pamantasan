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
        const data = await dataConnectService.executeMutation('InsertNotification', {
            recipientId: payload.recipientId,
            actorId: payload.actorId ?? null,
            entityType: payload.entityType,
            entityId: payload.entityId,
            action: payload.action,
            isRead: payload.isRead ?? false,
            isEmailed: payload.isEmailed ?? false,
            createdAt: payload.createdAt,
            updatedAt: payload.updatedAt,
        });

        return formatLiveNotification(data?.notification_insert ?? data?.notifications_insert);
    },

    updateNotification: async (id, payload) => {
        const data = await dataConnectService.executeMutation('UpdateNotification', {
            id: id,
            isRead: payload.isRead,
            isEmailed: payload.isEmailed,
            updatedAt: payload.updatedAt,
        });

        return formatLiveNotification(data?.notification_update ?? data?.notifications_update);
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

        try {
            const dispatch = httpsCallable(functions, 'dispatchSystemNotification');
            const result = await dispatch(payload);
            return result?.data;
        } catch (error) {
            console.error('[notificationService] Failed to dispatch notification email:', error);
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
