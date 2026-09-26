// --- IMPORTS ---
import { z } from 'zod';

import { TimestampSchema } from '../../schemas';
import { COORDINATOR_ACTION, COORDINATOR_STATUS } from './coordinatorConstants';

import { UserForeignSchema } from '../user/userSchema';


// --- COORDINATOR REQUEST SCHEMAS ---
export const CoordinatorRequestSchema = z.object({
    id: z.string().uuid(),
    requester: UserForeignSchema,
    reviewer: UserForeignSchema.nullable(),
    action: z.enum(Object.values(COORDINATOR_ACTION)),
    data: z.string().min(1),
    status: z.enum(Object.values(COORDINATOR_STATUS)),
    rejectionReason: z.string().max(512).nullable(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
});

export const CreateCoordinatorRequestSchema = z.object({
    requesterId: z.string().uuid(),
    reviewerId: z.string().uuid().nullable().optional(),
    action: z.enum(Object.values(COORDINATOR_ACTION)),
    data: z.string().min(1),
});

export const UpdateCoordinatorRequestSchema = z.object({
    id: z.string().uuid(),
    reviewerId: z.string().uuid().nullable().optional(),
    action: z.enum(Object.values(COORDINATOR_ACTION)).optional(),
    data: z.string().min(1).optional(),
    status: z.enum(Object.values(COORDINATOR_STATUS)).optional(),
    rejectionReason: z.string().max(512).nullable().optional(),
    updatedAt: TimestampSchema.optional(),
});

export const UpdateCoordinatorRequestsSchema = z.object({
    ids: z.array(z.string().uuid()).min(1),
    reviewerId: z.string().uuid().nullable().optional(),
    status: z.enum(Object.values(COORDINATOR_STATUS)).optional(),
    rejectionReason: z.string().max(512).nullable().optional(),
    updatedAt: TimestampSchema.optional(),
});

export const DeleteCoordinatorRequestsSchema = z.object({
    ids: z.array(z.string().uuid()).min(1),
});
