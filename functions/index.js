// --- IMPORTS ---
const { initializeApp } = require('firebase-admin/app');
const { onCall } = require('firebase-functions/v2/https');

// Initialize Firebase Admin SDK
initializeApp();

const {
    handleSendPasswordResetOtp,
    handleVerifyPasswordResetOtp,
    handleConsumePasswordResetOtp,
} = require('./handlers/authHandlers');

const {
    handleDispatchSystemNotification,
} = require('./handlers/notificationHandlers');

// --- CALLABLE EXPORTS ---

/**
 * Sends a 6-digit OTP code to an institutional email for password recovery.
 */
exports.sendPasswordResetOtp = onCall({ cors: true }, async (request) => {
    return await handleSendPasswordResetOtp(request.data);
});

/**
 * Validates a 6-digit OTP code against Firestore storage.
 */
exports.verifyPasswordResetOtp = onCall({ cors: true }, async (request) => {
    return await handleVerifyPasswordResetOtp(request.data);
});

/**
 * Consumes the OTP after the password has been reset.
 */
exports.consumePasswordResetOtp = onCall({ cors: true }, async (request) => {
    return await handleConsumePasswordResetOtp(request.data);
});

/**
 * Extensible notification dispatcher for sending email alerts on system actions (document modified, coordinator request, etc.)
 */
exports.dispatchSystemNotification = onCall({ cors: true }, async (request) => {
    return await handleDispatchSystemNotification(request.data);
});
