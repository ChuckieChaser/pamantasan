// --- IMPORTS ---
import { z } from 'zod';

import { TimestampSchema } from '../../schemas';
import { EVENTS } from '../../constants';

import { UserForeignSchema } from '../user/userSchema';


// --- NOTIFICATION SCHEMAS ---
export const NotificationSchema = z.object({
    id: z.string().uuid(),
    recipient: UserForeignSchema,
    actor: UserForeignSchema.nullable(),
    entityId: z.string().uuid(),
    event: z.enum(Object.values(EVENTS)),
    isRead: z.boolean(),
    isEmailed: z.boolean(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
});

export const CreateNotificationSchema = z.object({
    recipientId: z.string().uuid(),
    actorId: z.string().uuid().nullable().optional(),
    entityId: z.string().uuid(),
    event: z.enum(Object.values(EVENTS)),
});

export const UpdateNotificationSchema = z.object({
    id: z.string().uuid(),
    isRead: z.boolean().optional(),
    isEmailed: z.boolean().optional(),
    updatedAt: TimestampSchema.optional(),
});

export const UpdateNotificationsSchema = z.object({
    ids: z.array(z.string().uuid()).min(1),
    isRead: z.boolean().optional(),
    isEmailed: z.boolean().optional(),
    updatedAt: TimestampSchema.optional(),
});

export const DeleteNotificationsSchema = z.object({
    ids: z.array(z.string().uuid()).min(1),
});
