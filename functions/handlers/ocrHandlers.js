// --- IMPORTS ---
const crypto = require('crypto');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { convertImageToSearchablePdf, processImageOcr } = require('../services/ocrService');

let firestoreInstance = null;
function getDb() {
    if (!firestoreInstance) {
        firestoreInstance = getFirestore();
    }
    return firestoreInstance;
}

/**
 * Handles converting an image into a searchable PDF with invisible text layer via Cloud OCR.
 */
async function handleConvertImageToSearchablePdf(data = {}) {
    const { imageBase64, fileName = 'document.jpg', customTitle = null, autoWhiten = true } = data;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
        throw new Error('Missing or invalid imageBase64 payload');
    }

    // Strip optional data URI prefix (e.g. data:image/png;base64,...)
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z0-9+-]+;base64,/i, '').trim();
    const imageBuffer = Buffer.from(cleanBase64, 'base64');

    if (imageBuffer.length === 0) {
        throw new Error('Decoded image buffer is empty');
    }

    return await convertImageToSearchablePdf({
        imageBuffer,
        fileName,
        customTitle,
        autoWhiten: Boolean(autoWhiten),
    });
}

/**
 * Handles raw text extraction from an image using Cloud OCR.
 */
async function handleExtractTextFromImage(data = {}) {
    const { imageBase64, autoWhiten = true } = data;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
        throw new Error('Missing or invalid imageBase64 payload');
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z0-9+-]+;base64,/i, '').trim();
    const imageBuffer = Buffer.from(cleanBase64, 'base64');

    if (imageBuffer.length === 0) {
        throw new Error('Decoded image buffer is empty');
    }

    const result = await processImageOcr(imageBuffer, Boolean(autoWhiten));

    return {
        success: true,
        extractedText: result.fullText,
        lines: result.lines,
        linesCount: result.linesCount,
        averageConfidence: result.averageConfidence,
        engine: result.engine,
    };
}

/**
 * Creates an ephemeral mobile scan session for pairing a desktop with a phone camera.
 */
async function handleCreateMobileScanSession(data = {}, context = {}) {
    const adminUid = context.auth?.uid || data.adminUid || 'anonymous';
    const sessionId = `scan_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const token = crypto.randomBytes(16).toString('hex');
    const now = Date.now();
    const expiresAt = now + (15 * 60 * 1000); // 15-minute TTL

    const sessionData = {
        sessionId,
        token,
        adminUid,
        status: 'waiting', // waiting | connected | completed | expired
        createdAt: now,
        expiresAt,
    };

    const db = getDb();
    await db.collection('mobileScanSessions').doc(sessionId).set(sessionData);

    return {
        success: true,
        sessionId,
        token,
        expiresAt,
    };
}

/**
 * Handles a scanned photo submitted from a mobile phone browser.
 * Uploads high-res image directly to Firebase Storage to bypass Firestore's 1 MiB limit,
 * then updates the session document with the download URL.
 */
async function handleSubmitMobileScan(data = {}) {
    const { sessionId, token, imageBase64, fileName = 'mobile_scan.jpg' } = data;

    if (!sessionId || !token || !imageBase64) {
        throw new Error('Missing required scan payload (sessionId, token, or imageBase64)');
    }

    const db = getDb();
    const sessionDocRef = db.collection('mobileScanSessions').doc(sessionId);
    const sessionSnap = await sessionDocRef.get();

    if (!sessionSnap.exists) {
        throw new Error('Mobile scan session not found or has expired');
    }

    const sessionData = sessionSnap.data();

    if (Date.now() > (sessionData.expiresAt || 0)) {
        throw new Error('Mobile scan session has expired. Please refresh the QR code on your desktop.');
    }

    if (sessionData.token !== token) {
        throw new Error('Invalid mobile scan authorization token');
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z0-9+-]+;base64,/i, '').trim();
    const imageBuffer = Buffer.from(cleanBase64, 'base64');

    if (imageBuffer.length === 0) {
        throw new Error('Received scan buffer is empty');
    }

    // Save image to Firebase Storage so we never hit Firestore's 1 MiB document limit
    const bucketName = process.env.STORAGE_BUCKET || 'pamantasan-records-210fe.firebasestorage.app';
    const bucket = getStorage().bucket(bucketName);
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

    const updatePayload = {
        status: 'completed',
        downloadUrl,
        storagePath,
        fileName: fileName || 'mobile_scan.jpg',
        fileSize: imageBuffer.length,
        updatedAt: Date.now(),
    };

    if (cleanBase64.length < 300000) {
        updatePayload.imageBase64 = cleanBase64;
    } else {
        updatePayload.imageBase64 = null;
    }

    await sessionDocRef.update(updatePayload);

    return {
        success: true,
        message: 'Mobile scan successfully received and transferred to desktop',
        sessionId,
        downloadUrl,
    };
}

/**
 * Health check handler for Cloud OCR service.
 */
function handleOcrHealthCheck() {
    return {
        isAvailable: true,
        status: 'healthy',
        engine: 'Google Cloud Vision & Vertex AI Gemini (Cloud Functions)',
        timestamp: new Date().toISOString(),
    };
}

module.exports = {
    handleConvertImageToSearchablePdf,
    handleExtractTextFromImage,
    handleCreateMobileScanSession,
    handleSubmitMobileScan,
    handleOcrHealthCheck,
};

