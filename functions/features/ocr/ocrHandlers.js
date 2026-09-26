// --- OCR: CALLABLE HANDLERS ---

const crypto = require('crypto');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { convertImageToSearchablePdf, processImageOcr } = require('./ocrService');

const STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'pamantasan-records-210fe.firebasestorage.app';


// --- FIRESTORE SINGLETON ---

let firestoreInstance = null;

const getDb = () => {
    if (!firestoreInstance) firestoreInstance = getFirestore();
    return firestoreInstance;
};


// --- HELPERS ---

/**
 * Decodes and validates a base64 image payload.
 * @param {string} imageBase64 - Raw base64 string (with or without data URI prefix).
 * @returns {Buffer} Decoded image buffer.
 * @throws {Error} If the payload is missing or decodes to an empty buffer.
 */
const decodeImageBase64 = (imageBase64) => {
    if (!imageBase64 || typeof imageBase64 !== 'string') {
        throw new Error('Missing or invalid imageBase64 payload');
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z0-9+-]+;base64,/i, '').trim();
    const imageBuffer = Buffer.from(cleanBase64, 'base64');

    if (imageBuffer.length === 0) {
        throw new Error('Decoded image buffer is empty');
    }

    return imageBuffer;
};


// --- HANDLERS ---

/**
 * Converts an image into a searchable PDF with invisible OCR text layer.
 */
const handleConvertImageToSearchablePdf = async (data = {}) => {
    const { imageBase64, fileName = 'document.jpg', customTitle = null, autoWhiten = true } = data;

    const imageBuffer = decodeImageBase64(imageBase64);

    return convertImageToSearchablePdf({
        imageBuffer,
        fileName,
        customTitle,
        autoWhiten: Boolean(autoWhiten),
    });
};

/**
 * Extracts recognized text lines from an image using Cloud OCR.
 */
const handleExtractTextFromImage = async (data = {}) => {
    const { imageBase64, autoWhiten = true } = data;

    const imageBuffer = decodeImageBase64(imageBase64);
    const result = await processImageOcr(imageBuffer, Boolean(autoWhiten));

    return {
        success: true,
        extractedText: result.fullText,
        lines: result.lines,
        linesCount: result.linesCount,
        averageConfidence: result.averageConfidence,
        engine: result.engine,
    };
};

/**
 * Creates an ephemeral mobile scan session for pairing a desktop with a phone camera.
 * Session TTL: 15 minutes.
 */
const handleCreateMobileScanSession = async (data = {}, context = {}) => {
    const adminUid = context.auth?.uid ?? data.adminUid ?? 'anonymous';
    const sessionId = `scan_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const token = crypto.randomBytes(16).toString('hex');
    const now = Date.now();
    const expiresAt = now + 15 * 60 * 1000;

    await getDb().collection('mobileScanSessions').doc(sessionId).set({
        sessionId,
        token,
        adminUid,
        status: 'waiting', // waiting | connected | completed | expired
        createdAt: now,
        expiresAt,
    });

    return { success: true, sessionId, token, expiresAt };
};

/**
 * Accepts a scanned photo from a mobile phone browser.
 * Uploads the high-res image to Firebase Storage (bypasses Firestore's 1 MiB limit)
 * and marks the session as completed.
 */
const handleSubmitMobileScan = async (data = {}) => {
    const { sessionId, token, imageBase64, fileName = 'mobile_scan.jpg' } = data;

    if (!sessionId || !token || !imageBase64) {
        throw new Error('Missing required scan payload (sessionId, token, or imageBase64)');
    }

    const db = getDb();
    const sessionRef = db.collection('mobileScanSessions').doc(sessionId);
    const sessionSnap = await sessionRef.get();

    if (!sessionSnap.exists) {
        throw new Error('Mobile scan session not found or has expired');
    }

    const session = sessionSnap.data();

    if (Date.now() > (session.expiresAt || 0)) {
        throw new Error('Mobile scan session has expired. Please refresh the QR code on your desktop.');
    }

    if (session.token !== token) {
        throw new Error('Invalid mobile scan authorization token');
    }

    const imageBuffer = decodeImageBase64(imageBase64);
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z0-9+-]+;base64,/i, '').trim();

    // Upload to Firebase Storage to avoid Firestore's 1 MiB document size limit
    const bucket = getStorage().bucket(STORAGE_BUCKET);
    const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeFileName = `${Date.now()}_${(fileName || 'mobile_scan.jpg').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const storagePath = `documents/temp_scans/${safeSessionId}/${safeFileName}`;
    const fileRef = bucket.file(storagePath);

    const tokenUuid = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

    await fileRef.save(imageBuffer, {
        contentType: 'image/jpeg',
        metadata: {
            contentType: 'image/jpeg',
            metadata: {
                sessionId,
                originalName: fileName,
                firebaseStorageDownloadTokens: tokenUuid,
            },
        },
    });

    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${tokenUuid}`;

    await sessionRef.update({
        status: 'completed',
        downloadUrl,
        storagePath,
        fileName,
        fileSize: imageBuffer.length,
        // Only embed base64 inline for small images; large ones are accessed via downloadUrl
        imageBase64: cleanBase64.length < 300000 ? cleanBase64 : null,
        updatedAt: Date.now(),
    });

    return {
        success: true,
        message: 'Mobile scan successfully received and transferred to desktop',
        sessionId,
        downloadUrl,
    };
};

/**
 * Health check for the Cloud OCR service.
 */
const handleOcrHealthCheck = () => ({
    isAvailable: true,
    status: 'healthy',
    engine: 'Google Cloud Vision & Vertex AI Gemini (Cloud Functions)',
    timestamp: new Date().toISOString(),
});

module.exports = {
    handleConvertImageToSearchablePdf,
    handleExtractTextFromImage,
    handleCreateMobileScanSession,
    handleSubmitMobileScan,
    handleOcrHealthCheck,
};
