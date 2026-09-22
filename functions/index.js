
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
    handleGenerateTextEmbedding,
} = require('./handlers/aiHandlers');

const {
    handleConvertImageToSearchablePdf,
    handleExtractTextFromImage,
    handleCreateMobileScanSession,
    handleSubmitMobileScan,
} = require('./handlers/ocrHandlers');

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

/**
 * Generates 768-dimensional vector embedding for semantic search or backfill using Vertex AI (text-embedding-004).
 */
exports.generateTextEmbedding = onCall({ cors: true, timeoutSeconds: 60, memory: '256MiB' }, async (request) => {
    return await handleGenerateTextEmbedding(request.data);
});

/**
 * Cloud OCR: Scans an image and generates a high-quality ISO A4 Searchable PDF
 * with an invisible embedded text layer and full OCR transcription metadata.
 */
exports.convertImageToSearchablePdf = onCall({ cors: true, timeoutSeconds: 180, memory: '1GiB' }, async (request) => {
    return await handleConvertImageToSearchablePdf(request.data);
});

/**
 * Cloud OCR: Extracts recognized lines and full text from an image.
 */
exports.extractTextFromImage = onCall({ cors: true, timeoutSeconds: 60, memory: '512MiB' }, async (request) => {
    return await handleExtractTextFromImage(request.data);
});

/**
 * Mobile Phone Scanner: Creates an ephemeral pairing session for desktop-to-phone camera scan sync.
 */
exports.createMobileScanSession = onCall({ cors: true, timeoutSeconds: 30, memory: '256MiB' }, async (request) => {
    return await handleCreateMobileScanSession(request.data, request);
});

/**
 * Mobile Phone Scanner: Submits a captured photo from a smartphone browser to the desktop session.
 */
exports.submitMobileScan = onCall({ cors: true, timeoutSeconds: 60, memory: '512MiB' }, async (request) => {
    return await handleSubmitMobileScan(request.data);
});
