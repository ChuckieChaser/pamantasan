// --- IMPORTS ---
import { EVENTS } from '../../constants';


// --- NOTIFICATION CONSTANTS ---
export const NOTIFICATION_STATUS = Object.freeze({
    ALL: 'ALL',
    UNREAD: 'UNREAD',
    READ: 'READ',
});

export const NOTIFICATION_EVENT = EVENTS;


// --- OPTION CONSTANTS ---
export const NOTIFICATION_SORT = Object.freeze({
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
    UPDATED_AT_DESCENDING: {
        label: 'Recently Updated',
        order: { updatedAt: 'DESC' },
    },
});

export const NOTIFICATION_FILTER = Object.freeze({
    Status: NOTIFICATION_STATUS,
});


// --- HELPERS ---
export const isUnreadNotification = (value) => value === false || value === NOTIFICATION_STATUS.UNREAD;

export const isReadNotification = (value) => value === true || value === NOTIFICATION_STATUS.READ;

export const isEmailedNotification = (isEmailed) => isEmailed === true;
