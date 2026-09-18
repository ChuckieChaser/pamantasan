// --- IMPORTS ---
const { HttpsError } = require('firebase-functions/v2/https');
const {
    analyzeDocumentFile,
    synthesizeFolderSummary,
} = require('../services/aiService');
const { DOCUMENT_VERSIONS_CLASSIFICATION } = require('../constants');

/**
 * Callable handler to analyze an uploaded document file or revision using Vertex AI.
 */
async function handleAnalyzeDocumentFile(data) {
    const payload = data?.data || data || {};
    const {
        storagePath,
        mimeType,
        fileName,
        fileSize,
        isVersionUpdate,
        previousStoragePath,
        previousMimeType,
        nextVersion,
    } = payload;

    if (!storagePath) {
        throw new HttpsError('invalid-argument', 'File storagePath is required for AI analysis.');
    }

    if (!fileName) {
        throw new HttpsError('invalid-argument', 'File fileName is required for AI analysis.');
    }

    try {
        const result = await analyzeDocumentFile({
            storagePath,
            mimeType,
            fileName,
            fileSize: Number(fileSize) || 0,
            isVersionUpdate: Boolean(isVersionUpdate),
            previousStoragePath: previousStoragePath || null,
            previousMimeType: previousMimeType || null,
            nextVersion: nextVersion || null,
        });

        return result;
    } catch (error) {
        console.error('[handleAnalyzeDocumentFile] Error analyzing document:', error);
        // Resilient fallback so client upload never fails
        return {
            success: false,
            error: error?.message || 'AI document analysis failed.',
            summary: `Institutional document: ${fileName}.`,
            classification: DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE,
            changeSummary: isVersionUpdate ? 'Document version updated.' : 'Initial file upload',
            embedding: null,
        };
    }
}

/**
 * Callable handler to synthesize an executive overview for a folder.
 */
async function handleSynthesizeFolderSummary(data) {
    const payload = data?.data || data || {};
    const { folderName, childDocuments } = payload;

    if (!folderName) {
        throw new HttpsError('invalid-argument', 'folderName is required.');
    }

    try {
        const result = await synthesizeFolderSummary({
            folderName,
            childDocuments: Array.isArray(childDocuments) ? childDocuments : [],
        });

        return result;
    } catch (error) {
        console.error('[handleSynthesizeFolderSummary] Error synthesizing folder summary:', error);
        return {
            success: false,
            error: error?.message,
            summary: `Folder containing items for ${folderName}.`,
        };
    }
}

module.exports = {
    handleAnalyzeDocumentFile,
    handleSynthesizeFolderSummary,
};
