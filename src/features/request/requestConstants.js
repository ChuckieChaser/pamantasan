// --- REQUEST CONSTANTS ---
export const REQUEST_STATUS = Object.freeze({
    OPEN: 'OPEN',
    RESOLVED: 'RESOLVED',
    REJECTED: 'REJECTED',
});


// --- OPTION CONSTANTS ---
export const REQUEST_SORT = Object.freeze({
    SUBJECT_ASCENDING: {
        label: 'Subject (A → Z)',
        order: { subject: 'ASC' },
    },
    SUBJECT_DESCENDING: {
        label: 'Subject (Z → A)',
        order: { subject: 'DESC' },
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

export const REQUEST_FILTER = Object.freeze({
    Status: REQUEST_STATUS,
});


// --- HELPERS ---
export const isOpenRequest = (status) => status === REQUEST_STATUS.OPEN;

export const isResolvedRequest = (status) => status === REQUEST_STATUS.RESOLVED;

export const isRejectedRequest = (status) => status === REQUEST_STATUS.REJECTED;
