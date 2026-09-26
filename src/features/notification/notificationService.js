// --- IMPORTS ---
import { executeDataQuery, executeDataMutation } from '../../services/dataConnectService';
import { CreateNotificationSchema, UpdateNotificationSchema, UpdateNotificationsSchema, DeleteNotificationsSchema } from './notificationSchema';


// --- NOTIFICATION SERVICES ---
export const getNotificationsByRecipientId = async ({
    search = '',
    recipientId,
    events,
    orderBy = [{ createdAt: 'DESC' }],
    limit = 100,
    offset = 0,
} = {}) => {
    if (!recipientId) {
        throw new Error('Recipient ID is required to fetch notifications.');
    }

    const data = await executeDataQuery('GetNotificationsByRecipientId', {
        search,
        recipientId,
        events,
        orderBy,
        limit,
        offset,
    });

    return data?.notifications ?? [];
};

export const createNotification = async (payload) => {
    const validated = CreateNotificationSchema.parse(payload);

    const data = await executeDataMutation('CreateNotification', {
        recipientId: validated.recipientId,
        actorId: validated.actorId ?? null,
        entityId: validated.entityId,
        event: validated.event,
    });

    return data?.notification_insert ?? null;
};

export const updateNotification = async (id, payload = {}) => {
    if (!id) {
        throw new Error('Notification ID is required for update.');
    }

    const validated = UpdateNotificationSchema.parse({ ...payload, id });

    const data = await executeDataMutation('UpdateNotification', {
        id: validated.id,
        isRead: validated.isRead,
        isEmailed: validated.isEmailed,
        updatedAt: validated.updatedAt ?? new Date().toISOString(),
    });

    return data?.notification_update ?? null;
};

export const updateNotifications = async (ids, payload = {}) => {
    const validated = UpdateNotificationsSchema.parse({ ...payload, ids });

    const data = await executeDataMutation('UpdateNotifications', {
        ids: validated.ids,
        isRead: validated.isRead,
        isEmailed: validated.isEmailed,
        updatedAt: validated.updatedAt ?? new Date().toISOString(),
    });

    return data?.notification_updateMany ?? null;
};

export const deleteNotifications = async (ids) => {
    const validated = DeleteNotificationsSchema.parse({ ids });

    const data = await executeDataMutation('DeleteNotifications', {
        ids: validated.ids,
    });

    return data?.notification_deleteMany ?? null;
};
