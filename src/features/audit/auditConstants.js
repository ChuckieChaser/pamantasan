// --- IMPORTS ---
import { EVENTS } from '../../constants';


// --- AUDIT CONSTANTS ---
export const AUDIT_EVENT = EVENTS;


// --- OPTION CONSTANTS ---
export const AUDIT_SORT = Object.freeze({
    CREATED_AT_DESCENDING: {
        label: 'Newest First',
        order: { createdAt: 'DESC' },
    },
    CREATED_AT_ASCENDING: {
        label: 'Oldest First',
        order: { createdAt: 'ASC' },
    },
    EVENT_ASCENDING: {
        label: 'Event (A → Z)',
        order: { event: 'ASC' },
    },
    EVENT_DESCENDING: {
        label: 'Event (Z → A)',
        order: { event: 'DESC' },
    },
});

export const AUDIT_FILTER = Object.freeze({
    Event: AUDIT_EVENT,
});

