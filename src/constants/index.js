// --- CONFIGURATIONS ---
const INSTITUTIONAL_CONFIGURATION = Object.freeze({
    EMAIL_DOMAIN: '@plpasig.edu.ph',
    VECTOR_DIMENSIONS: 768,
    CHECKSUM_HEX_LENGTH: 64,
    MAX_NAME_LENGTH: 255,
    MAX_CODE_LENGTH: 50,
    MAX_PATH_LENGTH: 512,
    MAX_MIME_TYPE_LENGTH: 100,
    MAX_USER_NAME_LENGTH: 100,
    MAX_UNIVERSITY_ID_LENGTH: 20,
});


// --- VALIDATIONS ---
const VALIDATION_PATTERNS = Object.freeze({
    UNIVERSITY_ID: /^[0-9]{2}-[0-9]{5}$/,
    EMAIL: /^[A-Za-z0-9._%+-]+@plpasig\.edu\.ph$/,
});


// --- TABLES ---
const DATABASE_TABLES = Object.freeze({
    DEPARTMENTS: 'departments',
    USERS: 'users',
    USER_CREDENTIALS: 'user_credentials',
    USER_SETTINGS: 'user_settings',
    USER_SESSIONS: 'user_sessions',
    DOCUMENTS: 'documents',
    DOCUMENT_VERSIONS: 'document_versions',
    DOCUMENT_SHARES: 'document_shares',
    DOCUMENT_REQUESTS: 'document_requests',
    DOCUMENT_REQUEST_MESSAGES: 'document_request_messages',
    DOCUMENT_REQUEST_ATTACHMENTS: 'document_request_attachments',
    COORDINATOR_REQUESTS: 'coordinator_requests',
    NOTIFICATIONS: 'notifications',
    AUDIT_LOGS: 'audit_logs',
});


// --- VIEWS ---
const DATABASE_VIEWS = Object.freeze({
    VIEW_NOTIFICATIONS: 'view_notifications',
});


// --- CONSTANTS ---
const USERS_ROLE = Object.freeze({
    ADMINISTRATOR: 'ADMINISTRATOR',
    COORDINATOR: 'COORDINATOR',
    DIRECTOR: 'DIRECTOR',
    OFFICER: 'OFFICER',
    MEMBER: 'MEMBER',
});

const USERS_STATUS = Object.freeze({
    PENDING_PASSWORD: 'PENDING_PASSWORD',
    PENDING_SSO: 'PENDING_SSO',
    VERIFIED: 'VERIFIED',
    SUSPENDED: 'SUSPENDED',
});

const USER_SETTINGS_THEME = Object.freeze({
    SYSTEM: 'SYSTEM',
    LIGHT: 'LIGHT',
    DARK: 'DARK',
});

const USER_SETTINGS_NOTIFICATION = Object.freeze({
    ALL: 'ALL',
    SYSTEM: 'SYSTEM',
    IMPORTANT: 'IMPORTANT',
});

const USER_SETTINGS_AVATAR = Object.freeze({
    SYSTEM: 'SYSTEM',
    GOOGLE: 'GOOGLE',
});

const USER_SETTINGS_AVATAR_OPTIONS = Object.freeze([
    { value: 'SYSTEM', label: 'SYSTEM' },
    { value: 'GOOGLE', label: 'GOOGLE' },
]);

const DOCUMENT_VERSIONS_CLASSIFICATION = Object.freeze({
    UNCLASSIFIED: 'UNCLASSIFIED',
    PUBLIC: 'PUBLIC',
    PRIVATE: 'PRIVATE',
    CONFIDENTIAL: 'CONFIDENTIAL',
    RESTRICTED: 'RESTRICTED',
});

const DOCUMENT_SHARES_STATUS = Object.freeze({
    PENDING_APPROVAL: 'PENDING_APPROVAL',
    APPROVED: 'APPROVED',
    PUBLISHED: 'PUBLISHED',
    STASHED: 'STASHED',
});

const DOCUMENT_REQUESTS_STATUS = Object.freeze({
    OPEN: 'OPEN',
    RESOLVED: 'RESOLVED',
    REJECTED: 'REJECTED',
});

const COORDINATOR_REQUESTS_ACTION = Object.freeze({
    USER_CREATE: 'USER_CREATE',
    USER_UPDATE: 'USER_UPDATE',
    USER_SUSPEND: 'USER_SUSPEND',
    DEPARTMENT_CREATE: 'DEPARTMENT_CREATE',
    DEPARTMENT_UPDATE: 'DEPARTMENT_UPDATE',
    DOCUMENT_UPLOAD: 'DOCUMENT_UPLOAD',
    DOCUMENT_UPDATE: 'DOCUMENT_UPDATE',
    DOCUMENT_DELETE: 'DOCUMENT_DELETE',
    DOCUMENT_SHARE: 'DOCUMENT_SHARE',
    DOCUMENT_ARCHIVE: 'DOCUMENT_ARCHIVE',
    DOCUMENT_ATTACH: 'DOCUMENT_ATTACH',
});

const COORDINATOR_REQUESTS_STATUS = Object.freeze({
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
});

const NOTIFICATIONS_ENTITY_TYPE = Object.freeze({
    USER: 'USER',
    DEPARTMENT: 'DEPARTMENT',
    DOCUMENT: 'DOCUMENT',
    COORDINATOR_REQUEST: 'COORDINATOR_REQUEST',
    DOCUMENT_REQUEST: 'DOCUMENT_REQUEST',
});

const NOTIFICATIONS_ACTION = Object.freeze({
    CREATED: 'CREATED',
    UPDATED: 'UPDATED',
    DELETED: 'DELETED',
    PENDING_APPROVAL: 'PENDING_APPROVAL',
    APPROVED: 'APPROVED',
    UNAPPROVED: 'UNAPPROVED',
    REJECTED: 'REJECTED',
    STASHED: 'STASHED',
    UPLOADED: 'UPLOADED',
    SHARED: 'SHARED',
    UNSHARED: 'UNSHARED',
    PUBLISHED: 'PUBLISHED',
    UNPUBLISHED: 'UNPUBLISHED',
    ARCHIVED: 'ARCHIVED',
    UNARCHIVED: 'UNARCHIVED',
    RESOLVED: 'RESOLVED',
    COMMENTED: 'COMMENTED',
    ATTACHED: 'ATTACHED',
    SUSPENDED: 'SUSPENDED',
    UNSUSPENDED: 'UNSUSPENDED',
    REVERTED: 'REVERTED',
});

const AUDIT_LOGS_ENTITY_TYPE = Object.freeze({
    USER: 'USER',
    DEPARTMENT: 'DEPARTMENT',
    DOCUMENT: 'DOCUMENT',
    DOCUMENT_VERSION: 'DOCUMENT_VERSION',
    DOCUMENT_SHARE: 'DOCUMENT_SHARE',
    DOCUMENT_REQUEST: 'DOCUMENT_REQUEST',
    DOCUMENT_REQUEST_ATTACHMENT: 'DOCUMENT_REQUEST_ATTACHMENT',
    COORDINATOR_REQUEST: 'COORDINATOR_REQUEST',
});

const AUDIT_LOGS_ACTION = Object.freeze({
    CREATED: 'CREATED',
    UPDATED: 'UPDATED',
    DELETED: 'DELETED',
    PENDING_APPROVAL: 'PENDING_APPROVAL',
    APPROVED: 'APPROVED',
    UNAPPROVED: 'UNAPPROVED',
    REJECTED: 'REJECTED',
    STASHED: 'STASHED',
    UPLOADED: 'UPLOADED',
    SHARED: 'SHARED',
    UNSHARED: 'UNSHARED',
    PUBLISHED: 'PUBLISHED',
    UNPUBLISHED: 'UNPUBLISHED',
    ARCHIVED: 'ARCHIVED',
    UNARCHIVED: 'UNARCHIVED',
    RESOLVED: 'RESOLVED',
    COMMENTED: 'COMMENTED',
    ATTACHED: 'ATTACHED',
    SUSPENDED: 'SUSPENDED',
    UNSUSPENDED: 'UNSUSPENDED',
    REVERTED: 'REVERTED',
});


// --- ROLE HELPERS ---
export const isStaffRole = (role) => {
    if (!role) return false;
    const r = String(role).trim().toUpperCase();
    return (
        r === USERS_ROLE.ADMINISTRATOR ||
        r === USERS_ROLE.COORDINATOR ||
        r === 'ADMIN' ||
        r === 'COORD' ||
        r.includes('ADMIN') ||
        r.includes('COORD')
    );
};

export const isOfficerRole = (role) => {
    if (!role) return false;
    const r = String(role).trim().toUpperCase();
    return r === USERS_ROLE.OFFICER || r.includes('OFFICER');
};

export const isDirectorRole = (role) => {
    if (!role) return false;
    const r = String(role).trim().toUpperCase();
    return r === USERS_ROLE.DIRECTOR || r.includes('DIRECTOR');
};

export const isMemberRole = (role) => {
    if (!role) return false;
    const r = String(role).trim().toUpperCase();
    return r === USERS_ROLE.MEMBER || r.includes('MEMBER');
};


// --- EXPORTS ---
export const constants = Object.freeze({
    INSTITUTIONAL_CONFIGURATION,
    VALIDATION_PATTERNS,
    DATABASE_TABLES,
    DATABASE_VIEWS,
    USERS_ROLE,
    USERS_STATUS,
    USER_SETTINGS_THEME,
    USER_SETTINGS_NOTIFICATION,
    USER_SETTINGS_AVATAR,
    USER_SETTINGS_AVATAR_OPTIONS,
    DOCUMENT_VERSIONS_CLASSIFICATION,
    DOCUMENT_SHARES_STATUS,
    DOCUMENT_REQUESTS_STATUS,
    COORDINATOR_REQUESTS_ACTION,
    COORDINATOR_REQUESTS_STATUS,
    NOTIFICATIONS_ENTITY_TYPE,
    NOTIFICATIONS_ACTION,
    AUDIT_LOGS_ENTITY_TYPE,
    AUDIT_LOGS_ACTION,
    isStaffRole,
    isOfficerRole,
    isDirectorRole,
    isMemberRole,
});


