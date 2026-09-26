// --- IMPORTS ---
import { z } from 'zod';

import { TimestampSchema } from '../../schemas';
import { REQUEST_STATUS } from './requestConstants';

import { UserForeignSchema } from '../user/userSchema';
import { DocumentForeignSchema } from '../document/documentSchema';


// --- FOREIGN SCHEMAS ---
export const RequestForeignSchema = z.object({
    id: z.string().uuid(),
    subject: z.string().min(1).max(128),
    status: z.enum(Object.values(REQUEST_STATUS)),
});


// --- REQUEST SCHEMAS ---
export const RequestSchema = z.object({
    id: z.string().uuid(),
    requester: UserForeignSchema,
    reviewer: UserForeignSchema.nullable(),
    subject: z.string().min(1).max(128),
    status: z.enum(Object.values(REQUEST_STATUS)),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
});

export const CreateRequestSchema = z.object({
    requesterId: z.string().uuid(),
    reviewerId: z.string().uuid().nullable().optional(),
    subject: z.string().min(1).max(128),
});

export const UpdateRequestSchema = z.object({
    id: z.string().uuid(),
    reviewerId: z.string().uuid().nullable().optional(),
    subject: z.string().min(1).max(128).optional(),
    status: z.enum(Object.values(REQUEST_STATUS)).optional(),
    updatedAt: TimestampSchema.optional(),
});

export const UpdateRequestsSchema = z.object({
    ids: z.array(z.string().uuid()).min(1),
    reviewerId: z.string().uuid().nullable().optional(),
    status: z.enum(Object.values(REQUEST_STATUS)).optional(),
    updatedAt: TimestampSchema.optional(),
});

export const DeleteRequestsSchema = z.object({
    ids: z.array(z.string().uuid()).min(1),
});


// --- REQUEST MESSAGE SCHEMAS ---
export const RequestMessageSchema = z.object({
    id: z.string().uuid(),
    request: RequestForeignSchema,
    user: UserForeignSchema.nullable(),
    message: z.string().min(1),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
});

export const CreateRequestMessageSchema = z.object({
    requestId: z.string().uuid(),
    userId: z.string().uuid().nullable().optional(),
    message: z.string().min(1),
});

export const UpdateRequestMessageSchema = z.object({
    id: z.string().uuid(),
    message: z.string().min(1),
    updatedAt: TimestampSchema.optional(),
});

export const DeleteRequestMessagesSchema = z.object({
    ids: z.array(z.string().uuid()).min(1),
});


// --- REQUEST ATTACHMENT SCHEMAS ---
export const RequestAttachmentSchema = z.object({
    id: z.string().uuid(),
    request: RequestForeignSchema,
    message: z.object({ id: z.string().uuid() }).nullable(),
    document: DocumentForeignSchema,
    attacher: UserForeignSchema,
    createdAt: TimestampSchema,
});

export const CreateRequestAttachmentSchema = z.object({
    requestId: z.string().uuid(),
    messageId: z.string().uuid().nullable().optional(),
    documentId: z.string().uuid(),
    attacherId: z.string().uuid(),
});

export const CreateRequestAttachmentsSchema = z.array(CreateRequestAttachmentSchema).min(1);

export const DeleteRequestAttachmentsSchema = z.object({
    ids: z.array(z.string().uuid()).min(1),
});
