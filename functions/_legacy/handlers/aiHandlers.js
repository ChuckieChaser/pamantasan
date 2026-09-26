// --- IMPORTS ---
const { HttpsError } = require('firebase-functions/v2/https');
const {
    analyzeDocumentFile,
    synthesizeFolderSummary,
    generateVectorEmbedding,
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
        extractedText,
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
            extractedText: extractedText || null,
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

/**
 * Callable handler to generate a 768-dimensional text embedding for semantic search / backfill.
 */
async function handleGenerateTextEmbedding(data) {
    const payload = data?.data || data || {};
    const { text } = payload;

    if (!text || typeof text !== 'string') {
        throw new HttpsError('invalid-argument', 'Text string is required to generate embedding.');
    }

    try {
        const embedding = await generateVectorEmbedding(text);
        if (!embedding || !Array.isArray(embedding)) {
            return {
                success: false,
                error: 'Failed to generate vector embedding from AI service.',
                embedding: null,
            };
        }
        return {
            success: true,
            embedding,
        };
    } catch (error) {
        console.error('[handleGenerateTextEmbedding] Error:', error);
        return {
            success: false,
            error: error?.message || 'Text embedding generation failed.',
            embedding: null,
        };
    }
}

module.exports = {
    handleAnalyzeDocumentFile,
    handleSynthesizeFolderSummary,
    handleGenerateTextEmbedding,
};
