// --- USER CONSTANTS ---
export const USER_ROLE = Object.freeze({
    ADMINISTRATOR: 'ADMINISTRATOR',
    COORDINATOR: 'COORDINATOR',
    DIRECTOR: 'DIRECTOR',
    OFFICER: 'OFFICER',
    MEMBER: 'MEMBER',
});

export const USER_STATUS = Object.freeze({
    PENDING_PASSWORD: 'PENDING_PASSWORD',
    PENDING_SSO: 'PENDING_SSO',
    VERIFIED: 'VERIFIED',
    SUSPENDED: 'SUSPENDED',
    ARCHIVED: 'ARCHIVED',
});


export const USER_SETTING_THEME = Object.freeze({
    SYSTEM: 'SYSTEM',
    LIGHT: 'LIGHT',
    DARK: 'DARK',
});

export const USER_SETTING_NOTIFICATION = Object.freeze({
    ALL: 'ALL',
    SYSTEM: 'SYSTEM',
    IMPORTANT: 'IMPORTANT',
});


// --- OPTION CONSTANTS ---
export const USER_SORT = Object.freeze({
    LAST_NAME_ASCENDING: {
        label: 'Name (A → Z)',
        order: { lastName: 'ASC' },
    },
    LAST_NAME_DESCENDING: {
        label: 'Name (Z → A)',
        order: { lastName: 'DESC' },
    },
    UNIVERSITY_ID_ASCENDING: {
        label: 'University ID (Ascending)',
        order: { universityId: 'ASC' },
    },
    UNIVERSITY_ID_DESCENDING: {
        label: 'University ID (Descending)',
        order: { universityId: 'DESC' },
    },
    CREATED_AT_DESCENDING: {
        label: 'Newest First',
        order: { createdAt: 'DESC' },
    },
    CREATED_AT_ASCENDING: {
        label: 'Oldest First',
        order: { createdAt: 'ASC' },
    },
    UPDATED_AT_DESCENDING: {
        label: 'Recently Updated',
        order: { updatedAt: 'DESC' },
    },
});

export const USER_FILTER = Object.freeze({
    Role: USER_ROLE,
    Status: USER_STATUS,
});


// --- HELPERS ---
export const isAdministrativeRole = (role) => role === USER_ROLE.ADMINISTRATOR || role === USER_ROLE.COORDINATOR;

export const isAdministratorRole = (role) => role === USER_ROLE.ADMINISTRATOR;

export const isCoordinatorRole = (role) => role === USER_ROLE.COORDINATOR;

export const isDirectorRole = (role) => role === USER_ROLE.DIRECTOR;

export const isOfficerRole = (role) => role === USER_ROLE.OFFICER;

export const isMemberRole = (role) => role === USER_ROLE.MEMBER;