// ============================================================================
// PAMANTASAN DOCUMENT MANAGEMENT SYSTEM (DMS) — ZOD DATABASE SCHEMAS
// 100% Schema Replica of PostgreSQL Database (tables, domains, enums, & views)
// ============================================================================

import { z } from 'zod';
import {
    USER_ROLE_LIST,
    USER_STATUS_LIST,
    DEFAULT_USER_STATUS,
    THEME_MODE_LIST,
    DEFAULT_THEME_MODE,
    NOTIFICATION_SCOPE_LIST,
    DEFAULT_NOTIFICATION_SCOPE,
    DOCUMENT_CLASSIFICATION_LIST,
    DEFAULT_DOCUMENT_CLASSIFICATION,
    DOCUMENT_SHARE_STATUS_LIST,
    DEFAULT_DOCUMENT_SHARE_STATUS,
    DOCUMENT_REQUEST_STATUS_LIST,
    DEFAULT_DOCUMENT_REQUEST_STATUS,
    COORDINATOR_REQUEST_ACTION_LIST,
    COORDINATOR_REQUEST_STATUS_LIST,
    DEFAULT_COORDINATOR_REQUEST_STATUS,
    NOTIFICATION_ENTITY_TYPE_LIST,
    AUDIT_LOG_ENTITY_TYPE_LIST,
    SYSTEM_ACTION_LIST,
    VALIDATION_PATTERNS,
    INSTITUTIONAL_CONFIG,
    OFFICER_ALLOWED_SHARE_TRANSITIONS,
    DIRECTOR_ALLOWED_SHARE_TRANSITIONS,
    USER_ROLES,
} from '../constants';

// --- 1. PRIMITIVE & DOMAIN SCHEMAS ---

export const UuidSchema = z
    .string()
    .regex(VALIDATION_PATTERNS.UUID, 'Invalid UUID format');

export const UniversityIdSchema = z
    .string()
    .regex(VALIDATION_PATTERNS.UNIVERSITY_ID, 'University ID must match format: YY-NNNNN (e.g. 20-00001)');

export const InstitutionalEmailSchema = z
    .string()
    .email('Invalid email address')
    .regex(VALIDATION_PATTERNS.EMAIL, `Email must belong to ${INSTITUTIONAL_CONFIG.EMAIL_DOMAIN}`);

export const IsoTimestampSchema = z
    .string()
    .or(z.date().transform((date) => date.toISOString()));

export const UserRoleSchema = z.enum(USER_ROLE_LIST);
export const UserStatusSchema = z.enum(USER_STATUS_LIST);
export const ThemeModeSchema = z.enum(THEME_MODE_LIST);
export const NotificationScopeSchema = z.enum(NOTIFICATION_SCOPE_LIST);
export const DocumentClassificationSchema = z.enum(DOCUMENT_CLASSIFICATION_LIST);
export const DocumentShareStatusSchema = z.enum(DOCUMENT_SHARE_STATUS_LIST);
export const DocumentRequestStatusSchema = z.enum(DOCUMENT_REQUEST_STATUS_LIST);
export const CoordinatorRequestActionSchema = z.enum(COORDINATOR_REQUEST_ACTION_LIST);
export const CoordinatorRequestStatusSchema = z.enum(COORDINATOR_REQUEST_STATUS_LIST);
export const NotificationEntityTypeSchema = z.enum(NOTIFICATION_ENTITY_TYPE_LIST);
export const AuditLogEntityTypeSchema = z.enum(AUDIT_LOG_ENTITY_TYPE_LIST);
export const SystemActionSchema = z.enum(SYSTEM_ACTION_LIST);

// --- 2. DEPARTMENTS SCHEMA (departments) ---

export const DepartmentSchema = z.object({
    id: UuidSchema,
    name: z.string().min(1).max(INSTITUTIONAL_CONFIG.MAX_NAME_LENGTH),
    code: z.string().min(1).max(INSTITUTIONAL_CONFIG.MAX_CODE_LENGTH),
    created_at: IsoTimestampSchema,
    updated_at: IsoTimestampSchema,
});

export const DepartmentInsertSchema = DepartmentSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
}).extend({
    id: UuidSchema.optional(),
});

export const DepartmentUpdateSchema = DepartmentInsertSchema.partial();

// --- 3. USERS SCHEMA (users) ---

export const UserSchema = z.object({
    id: UuidSchema,
    university_id: UniversityIdSchema,
    department_id: z.string().min(1, 'Department is required'),
    role: UserRoleSchema,
    email: InstitutionalEmailSchema,
    avatar_path: z.string().nullable().optional(),
    first_name: z.string().min(1).max(INSTITUTIONAL_CONFIG.MAX_USER_NAME_LENGTH),
    middle_name: z.string().max(INSTITUTIONAL_CONFIG.MAX_USER_NAME_LENGTH).nullable().optional(),
    last_name: z.string().min(1).max(INSTITUTIONAL_CONFIG.MAX_USER_NAME_LENGTH),
    status: UserStatusSchema.default(DEFAULT_USER_STATUS),
    created_at: IsoTimestampSchema,
    updated_at: IsoTimestampSchema,
});

export const UserInsertSchema = UserSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
}).extend({
    id: UuidSchema.optional(),
    status: UserStatusSchema.default(DEFAULT_USER_STATUS).optional(),
});

export const UserUpdateSchema = UserInsertSchema.partial();

// --- 4. USER CREDENTIALS SCHEMA (user_credentials) ---

export const UserCredentialSchema = z.object({
    user_id: UuidSchema,
    password_hash: z.string().min(1).max(255),
    google_id: z.string().max(255).nullable().optional(),
    created_at: IsoTimestampSchema,
    updated_at: IsoTimestampSchema,
});

export const UserCredentialInsertSchema = UserCredentialSchema.omit({
    created_at: true,
    updated_at: true,
});

export const UserCredentialUpdateSchema = UserCredentialInsertSchema.omit({
    user_id: true,
}).partial();

// --- 5. USER SETTINGS SCHEMA (user_settings) ---

export const UserSettingSchema = z.object({
    user_id: UuidSchema,
    theme: ThemeModeSchema.default(DEFAULT_THEME_MODE),
    notification: NotificationScopeSchema.default(DEFAULT_NOTIFICATION_SCOPE),
    created_at: IsoTimestampSchema,
    updated_at: IsoTimestampSchema,
});

export const UserSettingInsertSchema = UserSettingSchema.omit({
    created_at: true,
    updated_at: true,
}).extend({
    theme: ThemeModeSchema.default(DEFAULT_THEME_MODE).optional(),
    notification: NotificationScopeSchema.default(DEFAULT_NOTIFICATION_SCOPE).optional(),
});

export const UserSettingUpdateSchema = UserSettingInsertSchema.omit({
    user_id: true,
}).partial();

// --- 6. USER SESSIONS SCHEMA (user_sessions) ---

export const UserSessionSchema = z.object({
    id: UuidSchema,
    user_id: UuidSchema,
    token_hash: z.string().min(1).max(255),
    ip_address: z.string().max(45).nullable().optional(),
    user_agent: z.string().nullable().optional(),
    created_at: IsoTimestampSchema,
    expired_at: IsoTimestampSchema.nullable().optional(),
});

export const UserSessionInsertSchema = UserSessionSchema.omit({
    id: true,
    created_at: true,
}).extend({
    id: UuidSchema.optional(),
});

export const UserSessionUpdateSchema = UserSessionInsertSchema.partial();

// --- 7. DOCUMENTS SCHEMA (documents) ---

export const DocumentSchema = z.object({
    id: UuidSchema,
    parent_id: UuidSchema.nullable().optional(),
    uploader_id: UuidSchema,
    name: z.string().min(1).max(INSTITUTIONAL_CONFIG.MAX_NAME_LENGTH),
    comment: z.string().nullable().optional(),
    is_folder: z.boolean().default(false),
    is_archived: z.boolean().default(false),
    created_at: IsoTimestampSchema,
    updated_at: IsoTimestampSchema,
});

export const DocumentInsertSchema = DocumentSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
}).extend({
    id: UuidSchema.optional(),
    is_folder: z.boolean().default(false).optional(),
    is_archived: z.boolean().default(false).optional(),
});

export const DocumentUpdateSchema = DocumentInsertSchema.partial();

// --- 8. DOCUMENT VERSIONS SCHEMA (document_versions) ---

export const DocumentVersionSchema = z.object({
    id: UuidSchema,
    document_id: UuidSchema,
    uploader_id: UuidSchema,
    approver_id: UuidSchema.nullable().optional(),
    publisher_id: UuidSchema.nullable().optional(),
    rejecter_id: UuidSchema.nullable().optional(),
    version: z.number().int().positive().default(1),
    checksum: z.string().length(INSTITUTIONAL_CONFIG.CHECKSUM_HEX_LENGTH).nullable().optional(),
    path: z.string().min(1).max(INSTITUTIONAL_CONFIG.MAX_PATH_LENGTH),
    size_bytes: z.number().int().nonnegative(),
    mime_type: z.string().min(1).max(INSTITUTIONAL_CONFIG.MAX_MIME_TYPE_LENGTH),
    classification: DocumentClassificationSchema.default(DEFAULT_DOCUMENT_CLASSIFICATION),
    change_summary: z.string().nullable().optional(),
    rejection_reason: z.string().nullable().optional(),
    summary: z.string().nullable().optional(),
    embedding: z.array(z.number()).length(INSTITUTIONAL_CONFIG.VECTOR_DIMENSIONS).nullable().optional(),
    text_hash: z.string().length(INSTITUTIONAL_CONFIG.CHECKSUM_HEX_LENGTH).nullable().optional(),
    created_at: IsoTimestampSchema,
    updated_at: IsoTimestampSchema,
});

export const DocumentVersionInsertSchema = DocumentVersionSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
}).extend({
    id: UuidSchema.optional(),
    version: z.number().int().positive().default(1).optional(),
    classification: DocumentClassificationSchema.default(DEFAULT_DOCUMENT_CLASSIFICATION).optional(),
});

export const DocumentVersionUpdateSchema = DocumentVersionInsertSchema.partial();

// --- 9. DOCUMENT SHARES SCHEMA (document_shares) ---

export const DocumentShareSchema = z.object({
    id: UuidSchema,
    document_id: UuidSchema,
    sharer_id: UuidSchema,
    recipient_id: UuidSchema.nullable().optional(),
    department_id: UuidSchema,
    status: DocumentShareStatusSchema.default(DEFAULT_DOCUMENT_SHARE_STATUS),
    created_at: IsoTimestampSchema,
    updated_at: IsoTimestampSchema,
});

export const DocumentShareInsertSchema = DocumentShareSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
}).extend({
    id: UuidSchema.optional(),
    status: DocumentShareStatusSchema.default(DEFAULT_DOCUMENT_SHARE_STATUS).optional(),
});

export const DocumentShareUpdateSchema = DocumentShareInsertSchema.partial();

// --- 10. DOCUMENT REQUESTS SCHEMA (document_requests) ---

export const DocumentRequestSchema = z.object({
    id: UuidSchema,
    requester_id: UuidSchema,
    resolver_id: UuidSchema.nullable().optional(),
    subject: z.string().min(1),
    status: DocumentRequestStatusSchema.default(DEFAULT_DOCUMENT_REQUEST_STATUS),
    created_at: IsoTimestampSchema,
    updated_at: IsoTimestampSchema,
});

export const DocumentRequestInsertSchema = DocumentRequestSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
}).extend({
    id: UuidSchema.optional(),
    status: DocumentRequestStatusSchema.default(DEFAULT_DOCUMENT_REQUEST_STATUS).optional(),
});

export const DocumentRequestUpdateSchema = DocumentRequestInsertSchema.partial();

// --- 11. DOCUMENT REQUEST MESSAGES SCHEMA (document_request_messages) ---

export const DocumentRequestMessageSchema = z.object({
    id: UuidSchema,
    document_request_id: UuidSchema,
    user_id: UuidSchema.nullable().optional(),
    message: z.string().min(1),
    created_at: IsoTimestampSchema,
});

export const DocumentRequestMessageInsertSchema = DocumentRequestMessageSchema.omit({
    id: true,
    created_at: true,
}).extend({
    id: UuidSchema.optional(),
});

export const DocumentRequestMessageUpdateSchema = DocumentRequestMessageInsertSchema.partial();

// --- 12. DOCUMENT REQUEST ATTACHMENTS SCHEMA (document_request_attachments) ---

export const DocumentRequestAttachmentSchema = z.object({
    id: UuidSchema,
    document_request_id: UuidSchema,
    document_id: UuidSchema,
    attached_by_id: UuidSchema,
    created_at: IsoTimestampSchema,
});

export const DocumentRequestAttachmentInsertSchema = DocumentRequestAttachmentSchema.omit({
    id: true,
    created_at: true,
}).extend({
    id: UuidSchema.optional(),
});

export const DocumentRequestAttachmentUpdateSchema = DocumentRequestAttachmentInsertSchema.partial();

// --- 13. COORDINATOR REQUESTS SCHEMA (coordinator_requests) ---

export const CoordinatorRequestSchema = z.object({
    id: UuidSchema,
    requester_id: UuidSchema,
    reviewer_id: UuidSchema.nullable().optional(),
    action: CoordinatorRequestActionSchema,
    data: z.record(z.string(), z.any()),
    status: CoordinatorRequestStatusSchema.default(DEFAULT_COORDINATOR_REQUEST_STATUS),
    rejection_reason: z.string().nullable().optional(),
    created_at: IsoTimestampSchema,
    updated_at: IsoTimestampSchema,
});

export const CoordinatorRequestInsertSchema = CoordinatorRequestSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
}).extend({
    id: UuidSchema.optional(),
    status: CoordinatorRequestStatusSchema.default(DEFAULT_COORDINATOR_REQUEST_STATUS).optional(),
});

export const CoordinatorRequestUpdateSchema = CoordinatorRequestInsertSchema.partial();

export const CoordinatorRequestReviewSchema = z.object({
    status: CoordinatorRequestStatusSchema,
    rejection_reason: z.string().nullable().optional(),
    reviewer_id: UuidSchema.nullable().optional(),
});

export {
    DocumentRequestMessageInsertSchema as RequestMessageInsertSchema,
    DocumentRequestAttachmentInsertSchema as RequestAttachmentInsertSchema,
};

// --- 14. NOTIFICATIONS SCHEMA (notifications) ---

export const NotificationSchema = z.object({
    id: UuidSchema,
    recipient_id: UuidSchema,
    actor_id: UuidSchema.nullable().optional(),
    entity_type: NotificationEntityTypeSchema,
    entity_id: UuidSchema,
    action: SystemActionSchema,
    is_read: z.boolean().default(false),
    is_emailed: z.boolean().default(false),
    created_at: IsoTimestampSchema,
    updated_at: IsoTimestampSchema,
});

export const NotificationInsertSchema = NotificationSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
}).extend({
    id: UuidSchema.optional(),
    is_read: z.boolean().default(false).optional(),
    is_emailed: z.boolean().default(false).optional(),
});

export const NotificationUpdateSchema = NotificationInsertSchema.partial();

// --- 15. AUDIT LOGS SCHEMA (audit_logs) ---

export const AuditLogSchema = z.object({
    id: UuidSchema,
    actor_id: UuidSchema.nullable().optional(),
    entity_type: AuditLogEntityTypeSchema,
    entity_id: UuidSchema,
    action: SystemActionSchema,
    data: z.record(z.string(), z.any()),
    created_at: IsoTimestampSchema,
});

export const AuditLogInsertSchema = AuditLogSchema.omit({
    id: true,
    created_at: true,
}).extend({
    id: UuidSchema.optional(),
});

// --- 16. NOTIFICATIONS VIEW SCHEMA (view_notifications) ---

export const ViewNotificationSchema = z.object({
    recipient_id: UuidSchema,
    entity_type: NotificationEntityTypeSchema,
    entity_id: UuidSchema,
    action: SystemActionSchema,
    interaction_count: z.number().int().nonnegative(),
    last_interaction_at: IsoTimestampSchema,
    actor_ids: z.array(UuidSchema.nullable()),
    notification_ids: z.array(UuidSchema),
    is_read: z.boolean(),
});

// --- 17. REPLICA VALIDATION HELPERS ---

/**
 * Validates a share status transition in accordance with trigger_enforce_share_status()
 * @param {string} userRole - The role of the performing user (ADMINISTRATOR, DIRECTOR, OFFICER, MEMBER)
 * @param {string} oldStatus - Previous share status
 * @param {string} newStatus - Desired target share status
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateShareTransition(userRole, oldStatus, newStatus) {
    if (oldStatus === newStatus) {
        return { valid: true };
    }

    if (userRole === USER_ROLES.ADMINISTRATOR) {
        return { valid: true };
    }

    if (userRole === USER_ROLES.OFFICER) {
        const isAllowed = OFFICER_ALLOWED_SHARE_TRANSITIONS.some(
            (transition) => transition.from === oldStatus && transition.to === newStatus,
        );

        if (!isAllowed) {
            return {
                valid: false,
                error: `Officers can only transition between PENDING_APPROVAL and APPROVED. Attempted: ${oldStatus} -> ${newStatus}`,
            };
        }

        return { valid: true };
    }

    if (userRole === USER_ROLES.DIRECTOR) {
        const isAllowed = DIRECTOR_ALLOWED_SHARE_TRANSITIONS.some(
            (transition) => transition.from === oldStatus && transition.to === newStatus,
        );

        if (!isAllowed) {
            return {
                valid: false,
                error: `Directors can only transition between APPROVED and PUBLISHED or APPROVED and STASHED. Attempted: ${oldStatus} -> ${newStatus}`,
            };
        }

        return { valid: true };
    }

    return {
        valid: false,
        error: `Unauthorized share state transition attempted by ${userRole}: ${oldStatus} -> ${newStatus}`,
    };
}
