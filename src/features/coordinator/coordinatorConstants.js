// --- COORDINATOR CONSTANTS ---
export const COORDINATOR_ACTION = Object.freeze({
    DEPARTMENT_CREATE: 'DEPARTMENT_CREATE',
    DEPARTMENT_UPDATE: 'DEPARTMENT_UPDATE',
    DEPARTMENT_DELETE: 'DEPARTMENT_DELETE',

    USER_CREATE: 'USER_CREATE',
    USER_UPDATE: 'USER_UPDATE',
    USER_SUSPEND: 'USER_SUSPEND',
    USER_UNSUSPEND: 'USER_UNSUSPEND',

    DOCUMENT_CREATE: 'DOCUMENT_CREATE',
    DOCUMENT_UPDATE: 'DOCUMENT_UPDATE',
    DOCUMENT_DELETE: 'DOCUMENT_DELETE',
    DOCUMENT_ARCHIVE: 'DOCUMENT_ARCHIVE',
    DOCUMENT_RESTORE: 'DOCUMENT_RESTORE',
    DOCUMENT_SHARE: 'DOCUMENT_SHARE',
    DOCUMENT_UNSHARE: 'DOCUMENT_UNSHARE',

    VERSION_CREATE: 'VERSION_CREATE',
    VERSION_REVERT: 'VERSION_REVERT',

    REQUEST_RESOLVE: 'REQUEST_RESOLVE',
    REQUEST_REJECT: 'REQUEST_REJECT',

    ATTACHMENT_CREATE: 'ATTACHMENT_CREATE',
    ATTACHMENT_DELETE: 'ATTACHMENT_DELETE',
});

export const COORDINATOR_STATUS = Object.freeze({
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
});


// --- OPTION CONSTANTS ---
export const COORDINATOR_SORT = Object.freeze({
    ACTION_ASCENDING: {
        label: 'Action (A → Z)',
        order: { action: 'ASC' },
    },
    ACTION_DESCENDING: {
        label: 'Action (Z → A)',
        order: { action: 'DESC' },
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

export const COORDINATOR_FILTER = Object.freeze({
    Action: COORDINATOR_ACTION,
    Status: COORDINATOR_STATUS,
});


// --- HELPERS ---
export const isPendingCoordinator = (status) => status === COORDINATOR_STATUS.PENDING;

export const isApprovedCoordinator = (status) => status === COORDINATOR_STATUS.APPROVED;

export const isRejectedCoordinator = (status) => status === COORDINATOR_STATUS.REJECTED;
