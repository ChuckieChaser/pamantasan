// --- OPTION CONSTANTS ---
export const DEPARTMENT_SORT = Object.freeze({
    NAME_ASCENDING: {
        label: 'Name (A → Z)',
        order: { name: 'ASC' },
    },
    NAME_DESCENDING: {
        label: 'Name (Z → A)',
        order: { name: 'DESC' },
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
