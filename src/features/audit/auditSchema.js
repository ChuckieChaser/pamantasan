// --- IMPORTS ---
import { z } from 'zod';

import { TimestampSchema } from '../../schemas';
import { EVENTS } from '../../constants';

import { UserForeignSchema } from '../user/userSchema';


// --- AUDIT LOG SCHEMAS ---
export const AuditLogSchema = z.object({
    id: z.string().uuid(),
    actor: UserForeignSchema.nullable(),
    entityId: z.string().uuid(),
    event: z.enum(Object.values(EVENTS)),
    data: z.string(),
    createdAt: TimestampSchema,
});

export const CreateAuditLogSchema = z.object({
    actorId: z.string().uuid().nullable().optional(),
    entityId: z.string().uuid(),
    event: z.enum(Object.values(EVENTS)),
    data: z.string().min(1),
});
