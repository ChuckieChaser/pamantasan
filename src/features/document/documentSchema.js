// --- IMPORTS ---
import { z } from 'zod';

import { TimestampSchema } from '../../schemas';
import { DOCUMENT_CLASSIFICATION, DOCUMENT_SHARE_STATUS } from './documentConstants';

import { UserForeignSchema } from '../user/userSchema';
import { DepartmentForeignSchema } from '../department/departmentSchema';


// --- FOREIGN SCHEMAS ---
export const DocumentForeignSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(256),
    isFolder: z.boolean(),
    isArchived: z.boolean(),
});


// --- DOCUMENT SCHEMAS ---
export const DocumentSchema = z.object({
    id: z.string().uuid(),
    parent: DocumentForeignSchema.nullable(),
    name: z.string().min(1).max(256),
    comment: z.string().nullable(),
    isFolder: z.boolean(),
    isArchived: z.boolean(),
    isDirectlyArchived: z.boolean(),
    currentVersion: z.number().int().positive(),
    currentSizeBytes: z.number().int().nonnegative(),
    currentMimeType: z.string().min(1).max(128),
    currentClassification: z.enum(Object.values(DOCUMENT_CLASSIFICATION)),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
});

export const CreateFileSchema = z.object({
    id: z.string().uuid(),
    parentId: z.string().uuid().nullable().optional(),
    name: z.string().min(1).max(256),
    comment: z.string().nullable().optional(),
    uploaderId: z.string().uuid(),
    checksum: z.string().max(64).nullable().optional(),
    path: z.string().min(1).max(256),
    sizeBytes: z.number().int().nonnegative(),
    mimeType: z.string().min(1).max(128),
    classification: z.enum(Object.values(DOCUMENT_CLASSIFICATION)).optional(),
});

export const CreateFolderSchema = z.object({
    parentId: z.string().uuid().nullable().optional(),
    name: z.string().min(1).max(256),
    comment: z.string().nullable().optional(),
});

export const UpdateDocumentSchema = z.object({
    id: z.string().uuid(),
    parentId: z.string().uuid().nullable().optional(),
    name: z.string().min(1).max(256).optional(),
    comment: z.string().nullable().optional(),
    isArchived: z.boolean().optional(),
    isDirectlyArchived: z.boolean().optional(),
    updatedAt: TimestampSchema.optional(),
});

export const UpdateDocumentsSchema = z.object({
    ids: z.array(z.string().uuid()).min(1),
    parentId: z.string().uuid().nullable().optional(),
    comment: z.string().nullable().optional(),
    isArchived: z.boolean().optional(),
    isDirectlyArchived: z.boolean().optional(),
    updatedAt: TimestampSchema.optional(),
});

export const DeleteDocumentsSchema = z.object({
    ids: z.array(z.string().uuid()).min(1),
});


// --- DOCUMENT VERSION SCHEMAS ---
export const DocumentVersionSchema = z.object({
    id: z.string().uuid(),
    document: DocumentForeignSchema,
    uploader: UserForeignSchema,
    reviewer: UserForeignSchema.nullable(),
    publisher: UserForeignSchema.nullable(),
    version: z.number().int().positive(),
    checksum: z.string().max(64).nullable(),
    path: z.string().min(1).max(256),
    sizeBytes: z.number().int().nonnegative(),
    mimeType: z.string().min(1).max(128),
    classification: z.enum(Object.values(DOCUMENT_CLASSIFICATION)),
    contentSummary: z.string().nullable(),
    changeSummary: z.string().max(512).nullable(),
    rejectionReason: z.string().max(512).nullable(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
});

export const CreateDocumentVersionSchema = z.object({
    documentId: z.string().uuid(),
    uploaderId: z.string().uuid(),
    version: z.number().int().positive(),
    checksum: z.string().max(64).nullable().optional(),
    path: z.string().min(1).max(256),
    sizeBytes: z.number().int().nonnegative(),
    mimeType: z.string().min(1).max(128),
    classification: z.enum(Object.values(DOCUMENT_CLASSIFICATION)).optional(),
    changeSummary: z.string().max(512).nullable().optional(),
});

export const UpdateDocumentVersionSchema = z.object({
    id: z.string().uuid(),
    reviewerId: z.string().uuid().nullable().optional(),
    publisherId: z.string().uuid().nullable().optional(),
    mimeType: z.string().max(128).optional(),
    classification: z.enum(Object.values(DOCUMENT_CLASSIFICATION)).optional(),
    contentSummary: z.string().nullable().optional(),
    changeSummary: z.string().max(512).nullable().optional(),
    rejectionReason: z.string().max(512).nullable().optional(),
    updatedAt: TimestampSchema.optional(),
});

export const UpdateDocumentVersionsSchema = z.object({
    ids: z.array(z.string().uuid()).min(1),
    reviewerId: z.string().uuid().nullable().optional(),
    publisherId: z.string().uuid().nullable().optional(),
    rejectionReason: z.string().max(512).nullable().optional(),
    updatedAt: TimestampSchema.optional(),
});


// --- DOCUMENT SHARE SCHEMAS ---
export const DocumentShareSchema = z.object({
    id: z.string().uuid(),
    document: DocumentForeignSchema,
    sharer: UserForeignSchema,
    recipient: UserForeignSchema.nullable(),
    department: DepartmentForeignSchema,
    status: z.enum(Object.values(DOCUMENT_SHARE_STATUS)),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
});

export const CreateDocumentShareSchema = z.object({
    documentId: z.string().uuid(),
    sharerId: z.string().uuid(),
    recipientId: z.string().uuid().nullable().optional(),
    departmentId: z.string().uuid(),
});

export const CreateDocumentSharesSchema = z.array(CreateDocumentShareSchema).min(1);

export const UpdateDocumentShareSchema = z.object({
    id: z.string().uuid(),
    recipientId: z.string().uuid().nullable().optional(),
    departmentId: z.string().uuid().optional(),
    status: z.enum(Object.values(DOCUMENT_SHARE_STATUS)).optional(),
    updatedAt: TimestampSchema.optional(),
});

export const DeleteDocumentSharesSchema = z.object({
    ids: z.array(z.string().uuid()).min(1),
});
