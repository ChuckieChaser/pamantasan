// --- AUTH CONSTANTS ---

export const AUTH_STEP = Object.freeze({
    CREDENTIALS: 'credentials',
    OTP:         'otp',
});

export const SESSION_STORAGE_KEY = Object.freeze({
    SESSION_ID:  'pamantasan_session_id',
    LAST_ACTIVE: 'pamantasan_last_active_time',
});

export const SESSION_CONFIG = Object.freeze({
    TIMEOUT_MS:            5 * 60 * 1000, // 5 minutes inactivity timeout
    HEARTBEAT_INTERVAL_MS: 30 * 1000,      // 30 seconds heartbeat beat
    CHECK_INTERVAL_MS:     5000,           // 5 seconds watchdog check
    THROTTLE_INTERVAL_MS:  2000,           // 2 seconds activity event throttle
});

export const PASSWORD_POLICY = Object.freeze({
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
});

export const OTP_POLICY = Object.freeze({
    LENGTH:         6,
    EXPIRY_MINUTES: 10,
});

export const ACTIVITY_EVENTS = Object.freeze([
    'mousedown',
    'mousemove',
    'keydown',
    'scroll',
    'touchstart',
    'click',
]);
