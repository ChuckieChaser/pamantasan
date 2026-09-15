// --- IMPORTS ---
const { initializeApp } = require('firebase-admin/app');
const { onCall } = require('firebase-functions/v2/https');

// Initialize Firebase Admin SDK
initializeApp();

const {
    handleSendPasswordResetOtp,
    handleVerifyPasswordResetOtp,
    handleConsumePasswordResetOtp,
    handleSendUserProvisionEmail,
} = require('./handlers/authHandlers');

const {
    handleDispatchSystemNotification,
} = require('./handlers/notificationHandlers');

const {
    handleAnalyzeDocumentFile,
    handleSynthesizeFolderSummary,
} = require('./handlers/aiHandlers');

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

/**
 * Sends official account provisioning credentials upon user creation.
 */
exports.sendUserProvisionEmail = onCall({ cors: true }, async (request) => {
    return await handleSendUserProvisionEmail(request.data);
});

/**
 * Analyzes uploaded documents, scans, images, audio, or binaries using Google Cloud Vertex AI (Gemini 2.0 Flash + text-embedding-004).
 */
exports.analyzeDocumentFile = onCall({ cors: true, timeoutSeconds: 300, memory: '512MiB' }, async (request) => {
    return await handleAnalyzeDocumentFile(request.data);
});

/**
 * Synthesizes an executive folder summary from child document metadata using Vertex AI.
 */
exports.synthesizeFolderSummary = onCall({ cors: true, timeoutSeconds: 60 }, async (request) => {
    return await handleSynthesizeFolderSummary(request.data);
});


