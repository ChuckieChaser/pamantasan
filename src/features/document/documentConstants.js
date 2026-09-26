// --- DOCUMENT CONSTANTS ---
export const DOCUMENT_CLASSIFICATION = Object.freeze({
    UNCLASSIFIED: 'UNCLASSIFIED',
    PUBLIC: 'PUBLIC',
    PRIVATE: 'PRIVATE',
    CONFIDENTIAL: 'CONFIDENTIAL',
    RESTRICTED: 'RESTRICTED',
});


export const DOCUMENT_SHARE_STATUS = Object.freeze({
    PENDING_APPROVAL: 'PENDING_APPROVAL',
    APPROVED: 'APPROVED',
    PUBLISHED: 'PUBLISHED',
    STASHED: 'STASHED',
});


// --- OPTION CONSTANTS ---
export const DOCUMENT_SORT = Object.freeze({
    NAME_ASCENDING: {
        label: 'Name (A → Z)',
        order: [{ isFolder: 'DESC' }, { name: 'ASC' }],
    },
    NAME_DESCENDING: {
        label: 'Name (Z → A)',
        order: [{ isFolder: 'DESC' }, { name: 'DESC' }],
    },
    SIZE_ASCENDING: {
        label: 'Size (Smallest First)',
        order: [{ isFolder: 'DESC' }, { currentSizeBytes: 'ASC' }, { name: 'ASC' }],
    },
    SIZE_DESCENDING: {
        label: 'Size (Largest First)',
        order: [{ isFolder: 'DESC' }, { currentSizeBytes: 'DESC' }, { name: 'ASC' }],
    },
    MIME_TYPE_ASCENDING: {
        label: 'Type (A → Z)',
        order: [{ isFolder: 'DESC' }, { currentMimeType: 'ASC' }, { name: 'ASC' }],
    },
    MIME_TYPE_DESCENDING: {
        label: 'Type (Z → A)',
        order: [{ isFolder: 'DESC' }, { currentMimeType: 'DESC' }, { name: 'ASC' }],
    },
    CREATED_AT_DESCENDING: {
        label: 'Newest First',
        order: [{ isFolder: 'DESC' }, { createdAt: 'DESC' }],
    },
    CREATED_AT_ASCENDING: {
        label: 'Oldest First',
        order: [{ isFolder: 'DESC' }, { createdAt: 'ASC' }],
    },
    UPDATED_AT_DESCENDING: {
        label: 'Recently Modified',
        order: [{ isFolder: 'DESC' }, { updatedAt: 'DESC' }],
    },
});

export const DOCUMENT_FILTER = Object.freeze({
    Classification: DOCUMENT_CLASSIFICATION,
    Status: DOCUMENT_SHARE_STATUS,
});


// --- HELPERS ---
export const isUnclassifiedDocument = (classification) => classification === DOCUMENT_CLASSIFICATION.UNCLASSIFIED;

export const isPublicDocument = (classification) => classification === DOCUMENT_CLASSIFICATION.PUBLIC;

export const isPrivateDocument = (classification) => classification === DOCUMENT_CLASSIFICATION.PRIVATE;

export const isConfidentialDocument = (classification) => classification === DOCUMENT_CLASSIFICATION.CONFIDENTIAL;

export const isRestrictedDocument = (classification) => classification === DOCUMENT_CLASSIFICATION.RESTRICTED;


export const isPendingApprovalDocument = (status) => status === DOCUMENT_SHARE_STATUS.PENDING_APPROVAL;

export const isApprovedDocument = (status) => status === DOCUMENT_SHARE_STATUS.APPROVED;

export const isPublishedDocument = (status) => status === DOCUMENT_SHARE_STATUS.PUBLISHED;

export const isStashedDocument = (status) => status === DOCUMENT_SHARE_STATUS.STASHED;

