// --- IMPORTS ---
import { z } from 'zod';

import { constants } from '../constants';
import { common } from './common.js';


// --- DEPARTMENT SCHEMAS ---
const InsertDepartmentSchema = z.object({
    name: z.string().min(1).max(constants.INSTITUTIONAL_CONFIGURATION.MAX_NAME_LENGTH),
    code: z.string().min(1).max(constants.INSTITUTIONAL_CONFIGURATION.MAX_CODE_LENGTH),
    createdAt: common.IsoTimestampSchema.optional(),
    updatedAt: common.IsoTimestampSchema.optional(),
});

const UpdateDepartmentSchema = z.object({
    name: z.string().min(1).max(constants.INSTITUTIONAL_CONFIGURATION.MAX_NAME_LENGTH).optional(),
    code: z.string().min(1).max(constants.INSTITUTIONAL_CONFIGURATION.MAX_CODE_LENGTH).optional(),
    updatedAt: common.IsoTimestampSchema.optional(),
});


// --- USER SCHEMAS ---
const InsertUserSchema = z.object({
    universityId: common.UniversityIdSchema,
    departmentId: z.string(),
    role: common.UsersRoleSchema,
    email: common.InstitutionalEmailSchema,
    avatarPath: z.string().nullable().optional(),
    firstName: z.string().min(1).max(constants.INSTITUTIONAL_CONFIGURATION.MAX_USER_NAME_LENGTH),
    middleName: z.string().max(constants.INSTITUTIONAL_CONFIGURATION.MAX_USER_NAME_LENGTH).nullable().optional(),
    lastName: z.string().min(1).max(constants.INSTITUTIONAL_CONFIGURATION.MAX_USER_NAME_LENGTH),
    status: common.UsersStatusSchema.default(constants.USERS_STATUS.PENDING_PASSWORD),
    createdAt: common.IsoTimestampSchema.optional(),
    updatedAt: common.IsoTimestampSchema.optional(),
});

const UpdateUserSchema = z.object({
    departmentId: z.string().optional(),
    role: common.UsersRoleSchema.optional(),
    email: common.InstitutionalEmailSchema.optional(),
    avatarPath: z.string().nullable().optional(),
    firstName: z.string().min(1).max(constants.INSTITUTIONAL_CONFIGURATION.MAX_USER_NAME_LENGTH).optional(),
    middleName: z.string().max(constants.INSTITUTIONAL_CONFIGURATION.MAX_USER_NAME_LENGTH).nullable().optional(),
    lastName: z.string().min(1).max(constants.INSTITUTIONAL_CONFIGURATION.MAX_USER_NAME_LENGTH).optional(),
    status: common.UsersStatusSchema.optional(),
    updatedAt: common.IsoTimestampSchema.optional(),
});

const InsertUserCredentialSchema = z.object({
    userId: z.string(),
    passwordHash: z.string().min(1).max(255),
    googleId: z.string().max(255).nullable().optional(),
    createdAt: common.IsoTimestampSchema.optional(),
    updatedAt: common.IsoTimestampSchema.optional(),
});

const UpdateUserCredentialSchema = z.object({
    passwordHash: z.string().min(1).max(255).optional(),
    googleId: z.string().max(255).nullable().optional(),
    updatedAt: common.IsoTimestampSchema.optional(),
});

const InsertUserSettingSchema = z.object({
    userId: z.string(),
    theme: common.UserSettingsThemeSchema.default(constants.USER_SETTINGS_THEME.SYSTEM),
    notification: common.UserSettingsNotificationSchema.default(constants.USER_SETTINGS_NOTIFICATION.ALL),
    createdAt: common.IsoTimestampSchema.optional(),
    updatedAt: common.IsoTimestampSchema.optional(),
});

const UpdateUserSettingSchema = z.object({
    theme: common.UserSettingsThemeSchema.optional(),
    notification: common.UserSettingsNotificationSchema.optional(),
    updatedAt: common.IsoTimestampSchema.optional(),
});

const InsertUserSessionSchema = z.object({
    userId: z.string(),
    tokenHash: z.string().min(1).max(255),
    ipAddress: z.string().max(45).nullable().optional(),
    userAgent: z.string().nullable().optional(),
    createdAt: common.IsoTimestampSchema.optional(),
    expiredAt: common.IsoTimestampSchema.nullable().optional(),
});


// --- DOCUMENT SCHEMAS ---
const InsertDocumentSchema = z.object({
    parentId: z.string().nullable().optional(),
    uploaderId: z.string(),
    name: z.string().min(1).max(constants.INSTITUTIONAL_CONFIGURATION.MAX_NAME_LENGTH),
    comment: z.string().nullable().optional(),
    isFolder: z.boolean().default(false),
    isArchived: z.boolean().default(false),
    createdAt: common.IsoTimestampSchema.optional(),
    updatedAt: common.IsoTimestampSchema.optional(),
});

const UpdateDocumentSchema = z.object({
    parentId: z.string().nullable().optional(),
    name: z.string().min(1).max(constants.INSTITUTIONAL_CONFIGURATION.MAX_NAME_LENGTH).optional(),
    comment: z.string().nullable().optional(),
    isFolder: z.boolean().optional(),
    isArchived: z.boolean().optional(),
    updatedAt: common.IsoTimestampSchema.optional(),
});

const InsertDocumentVersionSchema = z.object({
    documentId: z.string(),
    uploaderId: z.string(),
    approverId: z.string().nullable().optional(),
    publisherId: z.string().nullable().optional(),
    rejecterId: z.string().nullable().optional(),
    version: z.number().int().positive().default(1),
    checksum: z.string().length(constants.INSTITUTIONAL_CONFIGURATION.CHECKSUM_HEX_LENGTH).nullable().optional(),
    path: z.string().min(1).max(constants.INSTITUTIONAL_CONFIGURATION.MAX_PATH_LENGTH),
    sizeBytes: z.number().int().nonnegative(),
    mimeType: z.string().min(1).max(constants.INSTITUTIONAL_CONFIGURATION.MAX_MIME_TYPE_LENGTH),
    classification: common.DocumentVersionsClassificationSchema.default(constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED),
    changeSummary: z.string().nullable().optional(),
    rejectionReason: z.string().nullable().optional(),
    summary: z.string().nullable().optional(),
    textHash: z.string().length(constants.INSTITUTIONAL_CONFIGURATION.CHECKSUM_HEX_LENGTH).nullable().optional(),
    createdAt: common.IsoTimestampSchema.optional(),
    updatedAt: common.IsoTimestampSchema.optional(),
});

const UpdateDocumentVersionSchema = z.object({
    approverId: z.string().nullable().optional(),
    publisherId: z.string().nullable().optional(),
    rejecterId: z.string().nullable().optional(),
    checksum: z.string().length(constants.INSTITUTIONAL_CONFIGURATION.CHECKSUM_HEX_LENGTH).nullable().optional(),
    path: z.string().min(1).max(constants.INSTITUTIONAL_CONFIGURATION.MAX_PATH_LENGTH).optional(),
    sizeBytes: z.number().int().nonnegative().optional(),
    mimeType: z.string().min(1).max(constants.INSTITUTIONAL_CONFIGURATION.MAX_MIME_TYPE_LENGTH).optional(),
    classification: common.DocumentVersionsClassificationSchema.optional(),
    changeSummary: z.string().nullable().optional(),
    rejectionReason: z.string().nullable().optional(),
    summary: z.string().nullable().optional(),
    textHash: z.string().length(constants.INSTITUTIONAL_CONFIGURATION.CHECKSUM_HEX_LENGTH).nullable().optional(),
    updatedAt: common.IsoTimestampSchema.optional(),
});

const InsertDocumentShareSchema = z.object({
    documentId: z.string(),
    sharerId: z.string(),
    recipientId: z.string().nullable().optional(),
    departmentId: z.string(),
    status: common.DocumentSharesStatusSchema.default(constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL),
    createdAt: common.IsoTimestampSchema.optional(),
    updatedAt: common.IsoTimestampSchema.optional(),
});

const UpdateDocumentShareSchema = z.object({
    recipientId: z.string().nullable().optional(),
    departmentId: z.string().optional(),
    status: common.DocumentSharesStatusSchema.optional(),
    updatedAt: common.IsoTimestampSchema.optional(),
});

const InsertDocumentRequestSchema = z.object({
    requesterId: z.string(),
    resolverId: z.string().nullable().optional(),
    subject: z.string().min(1),
    status: common.DocumentRequestsStatusSchema.default(constants.DOCUMENT_REQUESTS_STATUS.OPEN),
    createdAt: common.IsoTimestampSchema.optional(),
    updatedAt: common.IsoTimestampSchema.optional(),
});

const UpdateDocumentRequestSchema = z.object({
    resolverId: z.string().nullable().optional(),
    subject: z.string().min(1).optional(),
    status: common.DocumentRequestsStatusSchema.optional(),
    updatedAt: common.IsoTimestampSchema.optional(),
});

const InsertDocumentRequestMessageSchema = z.object({
    documentRequestId: z.string(),
    userId: z.string().nullable().optional(),
    message: z.string().min(1),
    createdAt: common.IsoTimestampSchema.optional(),
});

const InsertDocumentRequestAttachmentSchema = z.object({
    documentRequestId: z.string(),
    documentId: z.string(),
    attachedById: z.string(),
    createdAt: common.IsoTimestampSchema.optional(),
});


// --- COORDINATOR REQUEST SCHEMAS ---
const InsertCoordinatorRequestSchema = z.object({
    requesterId: z.string(),
    reviewerId: z.string().nullable().optional(),
    action: common.CoordinatorRequestsActionSchema,
    data: z.string(),
    status: common.CoordinatorRequestsStatusSchema.default(constants.COORDINATOR_REQUESTS_STATUS.PENDING),
    rejectionReason: z.string().nullable().optional(),
    createdAt: common.IsoTimestampSchema.optional(),
    updatedAt: common.IsoTimestampSchema.optional(),
});

const UpdateCoordinatorRequestSchema = z.object({
    reviewerId: z.string().nullable().optional(),
    action: common.CoordinatorRequestsActionSchema.optional(),
    data: z.string().optional(),
    status: common.CoordinatorRequestsStatusSchema.optional(),
    rejectionReason: z.string().nullable().optional(),
    updatedAt: common.IsoTimestampSchema.optional(),
});


// --- NOTIFICATION SCHEMAS ---
const InsertNotificationSchema = z.object({
    recipientId: z.string(),
    actorId: z.string().nullable().optional(),
    entityType: common.NotificationsEntityTypeSchema,
    entityId: z.string(),
    action: common.NotificationsActionSchema,
    isRead: z.boolean().default(false),
    isEmailed: z.boolean().default(false),
    createdAt: common.IsoTimestampSchema.optional(),
    updatedAt: common.IsoTimestampSchema.optional(),
});

const UpdateNotificationSchema = z.object({
    isRead: z.boolean().optional(),
    isEmailed: z.boolean().optional(),
    updatedAt: common.IsoTimestampSchema.optional(),
});


// --- AUDIT LOG SCHEMAS ---
const InsertAuditLogSchema = z.object({
    actorId: z.string().nullable().optional(),
    entityType: common.AuditLogsEntityTypeSchema,
    entityId: z.string(),
    action: common.AuditLogsActionSchema,
    data: z.string(),
    createdAt: common.IsoTimestampSchema.optional(),
});


// --- EXPORTS ---
export const mutationSchema = Object.freeze({
    InsertDepartmentSchema,
    UpdateDepartmentSchema,
    InsertUserSchema,
    UpdateUserSchema,
    InsertUserCredentialSchema,
    UpdateUserCredentialSchema,
    InsertUserSettingSchema,
    UpdateUserSettingSchema,
    InsertUserSessionSchema,
    InsertDocumentSchema,
    UpdateDocumentSchema,
    InsertDocumentVersionSchema,
    UpdateDocumentVersionSchema,
    InsertDocumentShareSchema,
    UpdateDocumentShareSchema,
    InsertDocumentRequestSchema,
    UpdateDocumentRequestSchema,
    InsertDocumentRequestMessageSchema,
    InsertDocumentRequestAttachmentSchema,
    InsertCoordinatorRequestSchema,
    UpdateCoordinatorRequestSchema,
    InsertNotificationSchema,
    UpdateNotificationSchema,
    InsertAuditLogSchema,
});
