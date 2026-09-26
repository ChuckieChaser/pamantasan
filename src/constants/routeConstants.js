// --- ROUTE CONSTANTS ---
export const ROUTES = Object.freeze({
    LOGIN: '/login',
    FORGOT_PASSWORD: '/forgot-password',
    ONBOARDING: '/onboarding',

    DASHBOARD: '/dashboard',
    DOCUMENTS: '/documents',
    REQUESTS: '/requests',

    DEPARTMENTS: '/departments',
    USERS: '/users',
    COORDINATOR: '/coordinator',
    ARCHIVES: '/archives',

    MOBILE_SCAN: '/scan/:sessionId',

    DENIED: '/denied',
    ACCESS_DENIED: '/access-denied',
});

export const getMobileScanPath = (sessionId) => `/scan/${sessionId}`;

