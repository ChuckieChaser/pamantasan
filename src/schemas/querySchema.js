// --- IMPORTS ---
import { z } from 'zod';

import { constants } from '../constants';
import { common } from './common.js';


// --- DEPARTMENT SCHEMAS ---
const DepartmentsSchema = z.object({
    id: z.string(),
    name: z.string().min(1).max(constants.INSTITUTIONAL_CONFIGURATION.MAX_NAME_LENGTH),
    code: z.string().min(1).max(constants.INSTITUTIONAL_CONFIGURATION.MAX_CODE_LENGTH),
    createdAt: common.IsoTimestampSchema,
    updatedAt: common.IsoTimestampSchema,
});


// --- USER SCHEMAS ---
const UsersSchema = z.object({
    id: z.string(),
    universityId: common.UniversityIdSchema,
    department: z.object({
        id: z.string(),
        name: z.string(),
        code: z.string(),
    }),
    role: common.UsersRoleSchema,
    email: common.InstitutionalEmailSchema,
    avatarPath: z.string().nullable(),
    firstName: z.string().min(1).max(constants.INSTITUTIONAL_CONFIGURATION.MAX_USER_NAME_LENGTH),
    middleName: z.string().max(constants.INSTITUTIONAL_CONFIGURATION.MAX_USER_NAME_LENGTH).nullable(),
    lastName: z.string().min(1).max(constants.INSTITUTIONAL_CONFIGURATION.MAX_USER_NAME_LENGTH),
    status: common.UsersStatusSchema.default(constants.USERS_STATUS.PENDING_PASSWORD),
    createdAt: common.IsoTimestampSchema,
    updatedAt: common.IsoTimestampSchema,
});

const UserCredentialsSchema = z.object({
    id: z.string().optional(),
    user: z.object({
        id: z.string(),
    }),
    passwordHash: z.string().min(1).max(255),
    googleId: z.string().max(255).nullable(),
    createdAt: common.IsoTimestampSchema,
    updatedAt: common.IsoTimestampSchema,
});

const UserSettingsSchema = z.object({
    id: z.string().optional(),
    user: z.object({
        id: z.string(),
    }),
    theme: common.UserSettingsThemeSchema.default(constants.USER_SETTINGS_THEME.SYSTEM),
    notification: common.UserSettingsNotificationSchema.default(constants.USER_SETTINGS_NOTIFICATION.ALL),
    avatar: common.UserSettingsAvatarSchema.default(constants.USER_SETTINGS_AVATAR.SYSTEM),
    createdAt: common.IsoTimestampSchema,
    updatedAt: common.IsoTimestampSchema,
});

const UserSessionsSchema = z.object({
    id: z.string(),
    user: z.object({
        id: z.string(),
    }),
    tokenHash: z.string().min(1).max(255),
    ipAddress: z.string().max(45).nullable(),
    userAgent: z.string().nullable(),
    createdAt: common.IsoTimestampSchema,
    expiredAt: common.IsoTimestampSchema.nullable(),
});


// --- DOCUMENT SCHEMAS ---
const DocumentsSchema = z.object({
    id: z.string(),
    parent: z.object({
        id: z.string(),
        name: z.string(),
    }).nullable(),
    uploader: z.object({
        id: z.string(),
        firstName: z.string(),
        lastName: z.string(),
        email: z.string(),
    }),
    name: z.string().min(1).max(constants.INSTITUTIONAL_CONFIGURATION.MAX_NAME_LENGTH),
    comment: z.string().nullable(),
    isFolder: z.boolean().default(false),
    isArchived: z.boolean().default(false),
    createdAt: common.IsoTimestampSchema,
    updatedAt: common.IsoTimestampSchema,
});

const DocumentVersionsSchema = z.object({
    id: z.string(),
    document: z.object({
        id: z.string(),
        name: z.string(),
    }),
    uploader: z.object({
        id: z.string(),
        firstName: z.string(),
        lastName: z.string(),
    }),
    approver: z.object({
        id: z.string(),
        firstName: z.string(),
        lastName: z.string(),
    }).nullable(),
    publisher: z.object({
        id: z.string(),
        firstName: z.string(),
        lastName: z.string(),
    }).nullable(),
    rejecter: z.object({
        id: z.string(),
        firstName: z.string(),
        lastName: z.string(),
    }).nullable(),
    version: z.number().int().positive().default(1),
    checksum: z.string().length(constants.INSTITUTIONAL_CONFIGURATION.CHECKSUM_HEX_LENGTH).nullable(),
    path: z.string().min(1).max(constants.INSTITUTIONAL_CONFIGURATION.MAX_PATH_LENGTH),
    sizeBytes: z.number().int().nonnegative(),
    mimeType: z.string().min(1).max(constants.INSTITUTIONAL_CONFIGURATION.MAX_MIME_TYPE_LENGTH),
    classification: common.DocumentVersionsClassificationSchema.default(constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED),
    changeSummary: z.string().nullable(),
    rejectionReason: z.string().nullable(),
    summary: z.string().nullable(),
    textHash: z.string().length(constants.INSTITUTIONAL_CONFIGURATION.CHECKSUM_HEX_LENGTH).nullable(),
    createdAt: common.IsoTimestampSchema,
    updatedAt: common.IsoTimestampSchema,
});

const DocumentSharesSchema = z.object({
    id: z.string(),
    document: z.object({
        id: z.string(),
        name: z.string(),
    }),
    sharer: z.object({
        id: z.string(),
        firstName: z.string(),
        lastName: z.string(),
    }),
    recipient: z.object({
        id: z.string(),
        firstName: z.string(),
        lastName: z.string(),
    }).nullable(),
    department: z.object({
        id: z.string(),
        name: z.string(),
        code: z.string(),
    }),
    status: common.DocumentSharesStatusSchema.default(constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL),
    createdAt: common.IsoTimestampSchema,
    updatedAt: common.IsoTimestampSchema,
});

const DocumentRequestsSchema = z.object({
    id: z.string(),
    requester: z.object({
        id: z.string(),
        firstName: z.string(),
        lastName: z.string(),
        email: z.string(),
    }),
    resolver: z.object({
        id: z.string(),
        firstName: z.string(),
        lastName: z.string(),
        email: z.string(),
    }).nullable(),
    subject: z.string().min(1),
    status: common.DocumentRequestsStatusSchema.default(constants.DOCUMENT_REQUESTS_STATUS.OPEN),
    createdAt: common.IsoTimestampSchema,
    updatedAt: common.IsoTimestampSchema,
});

const DocumentRequestMessagesSchema = z.object({
    id: z.string(),
    documentRequest: z.object({
        id: z.string(),
    }),
    user: z.object({
        id: z.string(),
        firstName: z.string(),
        lastName: z.string(),
    }).nullable(),
    message: z.string().min(1),
    createdAt: common.IsoTimestampSchema,
});

const DocumentRequestAttachmentsSchema = z.object({
    id: z.string(),
    documentRequest: z.object({
        id: z.string(),
    }),
    document: z.object({
        id: z.string(),
        name: z.string(),
    }),
    attachedBy: z.object({
        id: z.string(),
        firstName: z.string(),
        lastName: z.string(),
    }),
    createdAt: common.IsoTimestampSchema,
});


// --- COORDINATOR REQUEST SCHEMAS ---
const CoordinatorRequestsSchema = z.object({
    id: z.string(),
    requester: z.object({
        id: z.string(),
        firstName: z.string(),
        lastName: z.string(),
    }),
    reviewer: z.object({
        id: z.string(),
        firstName: z.string(),
        lastName: z.string(),
    }).nullable(),
    action: common.CoordinatorRequestsActionSchema,
    data: z.string(),
    status: common.CoordinatorRequestsStatusSchema.default(constants.COORDINATOR_REQUESTS_STATUS.PENDING),
    rejectionReason: z.string().nullable(),
    createdAt: common.IsoTimestampSchema,
    updatedAt: common.IsoTimestampSchema,
});


// --- NOTIFICATION SCHEMAS ---
const NotificationsSchema = z.object({
    id: z.string(),
    recipient: z.object({
        id: z.string(),
    }),
    actor: z.object({
        id: z.string(),
        firstName: z.string(),
        lastName: z.string(),
    }).nullable(),
    entityType: common.NotificationsEntityTypeSchema,
    entityId: z.string(),
    action: common.NotificationsActionSchema,
    isRead: z.boolean().default(false),
    isEmailed: z.boolean().default(false),
    createdAt: common.IsoTimestampSchema,
    updatedAt: common.IsoTimestampSchema,
});

const ViewNotificationsSchema = z.object({
    recipientId: z.string(),
    entityType: common.NotificationsEntityTypeSchema,
    entityId: z.string(),
    action: common.NotificationsActionSchema,
    interactionCount: z.number().int().nonnegative(),
    lastInteractionAt: common.IsoTimestampSchema,
    actorIds: z.array(z.string().nullable()),
    notificationIds: z.array(z.string()),
    isRead: z.boolean(),
});


// --- AUDIT LOG SCHEMAS ---
const AuditLogsSchema = z.object({
    id: z.string(),
    actor: z.object({
        id: z.string(),
        firstName: z.string(),
        lastName: z.string(),
        email: z.string(),
    }).nullable(),
    entityType: common.AuditLogsEntityTypeSchema,
    entityId: z.string(),
    action: common.AuditLogsActionSchema,
    data: z.string(),
    createdAt: common.IsoTimestampSchema,
});


// --- EXPORTS ---
export const querySchema = Object.freeze({
    DepartmentsSchema,
    UsersSchema,
    UserCredentialsSchema,
    UserSettingsSchema,
    UserSessionsSchema,
    DocumentsSchema,
    DocumentVersionsSchema,
    DocumentSharesSchema,
    DocumentRequestsSchema,
    DocumentRequestMessagesSchema,
    DocumentRequestAttachmentsSchema,
    CoordinatorRequestsSchema,
    NotificationsSchema,
    ViewNotificationsSchema,
    AuditLogsSchema,
});
