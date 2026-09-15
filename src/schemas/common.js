// --- IMPORTS ---
import { z } from 'zod';
import { constants } from '../constants';


// --- VALIDATIONS ---
const UniversityIdSchema = z
    .string()
    .regex(constants.VALIDATION_PATTERNS.UNIVERSITY_ID, 'University ID must match format: YY-NNNNN (e.g. 20-00001)');

const InstitutionalEmailSchema = z
    .string()
    .regex(constants.VALIDATION_PATTERNS.EMAIL, `Email must belong to ${constants.INSTITUTIONAL_CONFIGURATION.EMAIL_DOMAIN}`);

const IsoTimestampSchema = z
    .string()
    .or(z.date().transform((date) => date.toISOString()));


// --- ENUM SCHEMAS ---
const UsersRoleSchema = z.enum(Object.values(constants.USERS_ROLE));
const UsersStatusSchema = z.enum(Object.values(constants.USERS_STATUS));
const UserSettingsThemeSchema = z.enum(Object.values(constants.USER_SETTINGS_THEME));
const UserSettingsNotificationSchema = z.enum(Object.values(constants.USER_SETTINGS_NOTIFICATION));
const DocumentVersionsClassificationSchema = z.enum(Object.values(constants.DOCUMENT_VERSIONS_CLASSIFICATION));
const DocumentSharesStatusSchema = z.enum(Object.values(constants.DOCUMENT_SHARES_STATUS));
const DocumentRequestsStatusSchema = z.enum(Object.values(constants.DOCUMENT_REQUESTS_STATUS));
const CoordinatorRequestsActionSchema = z.enum(Object.values(constants.COORDINATOR_REQUESTS_ACTION));
const CoordinatorRequestsStatusSchema = z.enum(Object.values(constants.COORDINATOR_REQUESTS_STATUS));
const NotificationsEntityTypeSchema = z.enum(Object.values(constants.NOTIFICATIONS_ENTITY_TYPE));
const NotificationsActionSchema = z.enum(Object.values(constants.NOTIFICATIONS_ACTION));
const AuditLogsEntityTypeSchema = z.enum(Object.values(constants.AUDIT_LOGS_ENTITY_TYPE));
const AuditLogsActionSchema = z.enum(Object.values(constants.AUDIT_LOGS_ACTION));


// --- EXPORTS ---
export const common = Object.freeze({
    UniversityIdSchema,
    InstitutionalEmailSchema,
    IsoTimestampSchema,
    UsersRoleSchema,
    UsersStatusSchema,
    UserSettingsThemeSchema,
    UserSettingsNotificationSchema,
    DocumentVersionsClassificationSchema,
    DocumentSharesStatusSchema,
    DocumentRequestsStatusSchema,
    CoordinatorRequestsActionSchema,
    CoordinatorRequestsStatusSchema,
    NotificationsEntityTypeSchema,
    NotificationsActionSchema,
    AuditLogsEntityTypeSchema,
    AuditLogsActionSchema,
});

