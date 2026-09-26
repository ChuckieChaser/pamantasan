// --- FIREBASE CLOUD FUNCTIONS ENTRY POINT ---

const { initializeApp } = require('firebase-admin/app');
const { onCall } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');

// Initialize Firebase Admin SDK
initializeApp();

// Region: asia-southeast1 (Singapore) — colocated with Cloud SQL, Data Connect, and Cloud Storage
setGlobalOptions({ region: 'asia-southeast1' });

// Lazy handler loaders: prevents deployment initialization timeout during specification discovery
// Reference: https://firebase.google.com/docs/functions/tips#avoid_deployment_timeouts_during_initialization
const getAuthHandlers = () => require('./features/auth/authHandlers');
const getNotificationHandlers = () => require('./features/notification/notificationHandlers');
const getAiHandlers = () => require('./features/ai/aiHandlers');
const getOcrHandlers = () => require('./features/ocr/ocrHandlers');


// --- AUTH ---

/** Verifies credentials, enforces concurrency checks/step-up OTP, and mints custom JWT with claims. */
exports.verifyCredentialsAndMintToken = onCall({ cors: true }, async (request) =>
    getAuthHandlers().handleVerifyCredentialsAndMintToken(request.data, request),
);

/** Verifies active session heartbeat and refreshes expiredAt timestamp. */
exports.verifySessionHeartbeat = onCall({ cors: true }, async (request) =>
    getAuthHandlers().handleVerifySessionHeartbeat(request.data, request),
);

/** Changes user password after verifying current password. */
exports.changeUserPassword = onCall({ cors: true }, async (request) =>
    getAuthHandlers().handleChangeUserPassword(request.data, request),
);

/** Sets custom user claims for role, status, and department. Admin only. */
exports.setUserClaims = onCall({ cors: true }, async (request) =>
    getAuthHandlers().handleSetUserClaims(request.data, request),
);

/** Provisions new user account with temporary password and welcome email. Admin only. */
exports.provisionUser = onCall({ cors: true }, async (request) =>
    getAuthHandlers().handleProvisionUser(request.data, request),
);

/** Generates and emails a 6-digit OTP for password recovery. */
exports.sendPasswordResetOtp = onCall({ cors: true }, async (request) =>
    getAuthHandlers().handleSendPasswordResetOtp(request.data),
);

/** Validates a 6-digit OTP against its signed stateless token. */
exports.verifyPasswordResetOtp = onCall({ cors: true }, async (request) =>
    getAuthHandlers().handleVerifyPasswordResetOtp(request.data),
);

/** Consumes the OTP session after a successful password update. */
exports.consumePasswordResetOtp = onCall({ cors: true }, async (request) =>
    getAuthHandlers().handleConsumePasswordResetOtp(request.data),
);

/** Sends official account provisioning credentials upon user creation. */
exports.sendUserProvisionEmail = onCall({ cors: true }, async (request) =>
    getAuthHandlers().handleSendUserProvisionEmail(request.data),
);


// --- NOTIFICATIONS ---

/** Dispatches a system notification email (document modified, coordinator request, etc.) */
exports.dispatchSystemNotification = onCall({ cors: true }, async (request) =>
    getNotificationHandlers().handleDispatchSystemNotification(request.data),
);


// --- AI (Vertex AI / Google Gen AI) ---

/** Analyzes uploaded documents, scans, images, audio, or binaries using Gemini 2.0 Flash. */
exports.analyzeDocumentFile = onCall(
    { cors: true, timeoutSeconds: 300, memory: '512MiB' },
    async (request) => getAiHandlers().handleAnalyzeDocumentFile(request.data),
);

/** Synthesizes an executive folder summary from child document metadata using Vertex AI. */
exports.synthesizeFolderSummary = onCall(
    { cors: true, timeoutSeconds: 60 },
    async (request) => getAiHandlers().handleSynthesizeFolderSummary(request.data),
);

/** Generates a 768-dimensional vector embedding using text-embedding-004 for semantic search. */
exports.generateTextEmbedding = onCall(
    { cors: true, timeoutSeconds: 60, memory: '256MiB' },
    async (request) => getAiHandlers().handleGenerateTextEmbedding(request.data),
);


// --- OCR (Cloud Vision + Vertex AI Gemini) ---

/** Scans an image and generates an ISO A4 searchable PDF with an invisible embedded text layer. */
exports.convertImageToSearchablePdf = onCall(
    { cors: true, timeoutSeconds: 180, memory: '1GiB' },
    async (request) => getOcrHandlers().handleConvertImageToSearchablePdf(request.data),
);

/** Extracts recognized lines and full text from an image via Cloud OCR. */
exports.extractTextFromImage = onCall(
    { cors: true, timeoutSeconds: 60, memory: '512MiB' },
    async (request) => getOcrHandlers().handleExtractTextFromImage(request.data),
);

/** Creates an ephemeral pairing session for desktop-to-phone camera scan sync. */
exports.createMobileScanSession = onCall(
    { cors: true, timeoutSeconds: 30, memory: '256MiB' },
    async (request) => getOcrHandlers().handleCreateMobileScanSession(request.data, request),
);

/** Submits a captured photo from a smartphone browser to the desktop session. */
exports.submitMobileScan = onCall(
    { cors: true, timeoutSeconds: 60, memory: '512MiB' },
    async (request) => getOcrHandlers().handleSubmitMobileScan(request.data),
);
