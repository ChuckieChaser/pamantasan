// --- IMPORTS & CONFIGURATION ---
const { getStorage } = require('firebase-admin/storage');
const { DOCUMENT_VERSIONS_CLASSIFICATION } = require('../constants');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'pamantasan-records-210fe';
const VERTEX_LOCATION = process.env.VERTEX_AI_LOCATION || 'us-central1';
const DEFAULT_STORAGE_BUCKET = process.env.STORAGE_BUCKET_NAME || 'pamantasan-records-210fe.firebasestorage.app';

// Model cascade: Try Gemini 2.0 Flash first; fallback to Gemini 1.5 Flash if 503 capacity unavailable
const MODEL_CANDIDATES = ['gemini-2.0-flash-001', 'gemini-1.5-flash-002'];

// Lazy-loaded Vertex AI client instance
let vertexAIClient = null;
const generativeModelCache = new Map();

/**
 * Gets the initialized VertexAI client (lazy singleton).
 */
function getVertexAIClient() {
    if (!vertexAIClient) {
        const { VertexAI } = require('@google-cloud/vertexai');
        vertexAIClient = new VertexAI({
            project: PROJECT_ID,
            location: VERTEX_LOCATION,
        });
    }
    return vertexAIClient;
}

/**
 * Extracts the text content from a Vertex AI GenerateContentResult.
 * Handles both the standard .text() helper and the raw parts array.
 */
function extractResponseText(response) {
    // Try the SDK's built-in .text() convenience method first
    try {
        const text = response?.response?.text?.();
        if (text && typeof text === 'string' && text.trim()) {
            return text.trim();
        }
    } catch (_) {
        // .text() may throw if parts are not text type — continue to manual extraction
    }

    // Fallback: manually traverse candidates -> content -> parts
    const candidates = response?.response?.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) {
        return null;
    }

    const parts = candidates[0]?.content?.parts;
    if (!Array.isArray(parts) || parts.length === 0) {
        return null;
    }

    // Find the first part that has text
    for (const part of parts) {
        if (part?.text && typeof part.text === 'string' && part.text.trim()) {
            return part.text.trim();
        }
    }

    return null;
}

/**
 * Safely parses a JSON string that may have markdown code fences (```json ... ```).
 */
function safeParseJSON(rawText) {
    if (!rawText) return null;

    let text = rawText.trim();

    // Strip markdown code fences if present
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    try {
        return JSON.parse(text);
    } catch (parseErr) {
        console.warn('[aiService] JSON.parse failed. Raw text:', rawText.substring(0, 200), 'Error:', parseErr?.message);
        return null;
    }
}

/**
 * Initializes and returns a Vertex AI generative model instance for a specified model alias.
 * Gracefully handles missing package if dependency is not yet installed.
 */
function getGenerativeModel(modelName = 'gemini-2.0-flash-001') {
    if (generativeModelCache.has(modelName)) {
        return generativeModelCache.get(modelName);
    }

    try {
        const client = getVertexAIClient();

        const model = client.getGenerativeModel({
            model: modelName,
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.2,
            },
            systemInstruction: `You are the AI Document Intelligence Engine for Pamantasan Records Management System (an official Philippine Higher Education Records System).
Your task is to analyze documents, scans, images, audio recordings, or technical data uploaded to the institutional repository.

CRITICAL INSTRUCTIONS:
1. "summary": Provide a precise 2 to 3 sentence executive summary in formal Philippine institutional English. Describe the core subject, main entities, and administrative purpose. If an image, mention visible text, institutional seals, or official signatures. If audio/video, summarize the key discussion topics, official decisions, and action items.
2. "classification": Accurately classify the document into EXACTLY one of the official institutional classification tiers (output the exact string value):
   - "${DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC}": Press releases, public memos, academic calendars, general circulars, open campus flyers.
   - "${DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE}": Departmental memos, meeting minutes, syllabi, routine institutional forms, non-sensitive faculty files.
   - "${DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED}": Faculty performance evaluations, departmental budget allocations, audit reports, draft proposals.
   - "${DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL}": Student grades, transcripts of records (TOR), personal identification, payroll/salaries, contracts, legal proceedings, disciplinary records.
3. "changeSummary":
   - If the analysis represents the initial version (v1.0), output EXACTLY: "Initial file upload".
   - If analyzing a version update (comparing previous version with current version), output a concise bulleted markdown list highlighting the exact changes, such as updated clauses, revised numbers or amounts, added signatures, or newly introduced sections.

Always return a valid JSON object with exactly these three fields: summary, classification, changeSummary.`,
        });

        generativeModelCache.set(modelName, model);
        return model;
    } catch (err) {
        console.error(`[aiService] Vertex AI model ${modelName} could not be initialized:`, err?.message, err?.stack);
        return null;
    }
}

/**
 * Formats raw byte count to human-readable string.
 */
function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Checks if a file is a non-text machine binary.
 */
function isNonTextBinary(fileName = '', mimeType = '') {
    const lowerName = fileName.toLowerCase();
    const lowerMime = (mimeType || '').toLowerCase();

    const binaryExtensions = [
        '.exe', '.msi', '.dll', '.sys', '.bin', '.dat', '.iso', '.dmg',
        '.pkg', '.deb', '.rpm', '.apk', '.bak', '.img', '.vmdk', '.raw'
    ];

    if (binaryExtensions.some(ext => lowerName.endsWith(ext))) {
        return true;
    }

    if (
        lowerMime === 'application/x-msdownload' ||
        lowerMime === 'application/x-dosexec' ||
        lowerMime === 'application/x-iso9660-image'
    ) {
        return true;
    }

    return false;
}

/**
 * Checks if a file is a compressed archive.
 */
function isCompressedArchive(fileName = '', mimeType = '') {
    const lowerName = fileName.toLowerCase();
    const lowerMime = (mimeType || '').toLowerCase();

    const archiveExtensions = ['.zip', '.rar', '.7z', '.tar', '.gz', '.tgz', '.bz2', '.7zip'];
    if (archiveExtensions.some(ext => lowerName.endsWith(ext))) {
        return true;
    }

    if (
        lowerMime.includes('zip') ||
        lowerMime.includes('compressed') ||
        lowerMime.includes('tar') ||
        lowerMime.includes('gzip')
    ) {
        return true;
    }

    return false;
}

/**
 * Resolves standard MIME type for Gemini ingestion.
 */
function resolveGeminiMimeType(fileName = '', originalMime = '') {
    const lowerName = fileName.toLowerCase();
    const lowerMime = (originalMime || '').toLowerCase();

    if (lowerMime && lowerMime !== 'application/octet-stream') {
        return lowerMime;
    }

    if (lowerName.endsWith('.pdf')) return 'application/pdf';
    if (lowerName.endsWith('.png')) return 'image/png';
    if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
    if (lowerName.endsWith('.webp')) return 'image/webp';
    if (lowerName.endsWith('.svg')) return 'image/svg+xml';
    if (lowerName.endsWith('.txt')) return 'text/plain';
    if (lowerName.endsWith('.md')) return 'text/markdown';
    if (lowerName.endsWith('.json')) return 'application/json';
    if (lowerName.endsWith('.csv')) return 'text/csv';
    if (lowerName.endsWith('.mp3')) return 'audio/mpeg';
    if (lowerName.endsWith('.wav')) return 'audio/wav';
    if (lowerName.endsWith('.m4a')) return 'audio/mp4';
    if (lowerName.endsWith('.mp4')) return 'video/mp4';
    if (lowerName.endsWith('.webm')) return 'video/webm';

    return 'application/pdf'; // Default fallback
}

/**
 * Generates a 768-dimensional vector embedding for semantic search using text-embedding-004.
 * Uses the correct Vertex AI SDK path: client.preview.getEmbeddingModel.
 */
async function generateVectorEmbedding(inputText) {
    if (!inputText || !inputText.trim()) {
        return null;
    }

    try {
        const client = getVertexAIClient();
        // text-embedding-004 requires getEmbeddingModel (under preview), not getGenerativeModel
        const embeddingModel = client.preview.getEmbeddingModel({
            model: 'text-embedding-004',
        });

        const result = await embeddingModel.embedContent({
            content: {
                role: 'user',
                parts: [{ text: inputText.substring(0, 2048) }],
            },
        });

        const embeddingValues = result?.embedding?.values;
        if (Array.isArray(embeddingValues) && embeddingValues.length > 0) {
            return embeddingValues;
        }
        console.warn('[aiService] generateVectorEmbedding: embedding values empty or missing.');
        return null;
    } catch (err) {
        console.warn('[aiService] generateVectorEmbedding failed (non-fatal):', err?.message);
        return null;
    }
}

/**
 * Analyzes a document file in Firebase Storage using Vertex AI.
 * Handles images, scans, PDFs, archives, binaries, encrypted documents, and version diffing.
 * Incorporates multi-model cascade (Gemini 2.0 Flash -> Gemini 1.5 Flash) if 503 capacity unavailable occurs.
 */
async function analyzeDocumentFile({
    storagePath,
    mimeType,
    fileName,
    fileSize = 0,
    isVersionUpdate = false,
    previousStoragePath = null,
    previousMimeType = null,
    nextVersion = null,
}) {
    console.log(`[aiService] analyzeDocumentFile called: fileName="${fileName}", mimeType="${mimeType}", storagePath="${storagePath}", isVersionUpdate=${isVersionUpdate}`);
    // -------------------------------------------------------------
    // SCENARIO 6: 0-Byte Empty File Guard (Preflight check)
    // -------------------------------------------------------------
    if (fileSize === 0) {
        return {
            success: true,
            summary: 'Empty document (0 bytes).',
            classification: DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED,
            changeSummary: isVersionUpdate ? 'Updated to empty file (0 bytes)' : 'Initial empty file upload',
            embedding: null,
            isZeroByte: true,
        };
    }

    // -------------------------------------------------------------
    // SCENARIO 2: Non-Text Binary File Fallback (.exe, .bin, .iso, etc.)
    // -------------------------------------------------------------
    if (isNonTextBinary(fileName, mimeType)) {
        const safeSummary = `Binary system/software asset: ${fileName} (${formatBytes(fileSize)}). Format: ${mimeType || 'application/octet-stream'}. Deep content inspection is bypassed for binary formats.`;
        const safeClassification = (fileName.toLowerCase().endsWith('.exe') || fileName.toLowerCase().endsWith('.msi') || fileName.toLowerCase().endsWith('.dll'))
            ? DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED
            : DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE;
        const safeChangeSummary = isVersionUpdate
            ? `Binary software asset updated to version ${nextVersion || 'revision'}.`
            : 'Initial binary asset upload';

        const embedding = await generateVectorEmbedding(`${fileName} ${mimeType} binary asset ${formatBytes(fileSize)}`);

        return {
            success: true,
            summary: safeSummary,
            classification: safeClassification,
            changeSummary: safeChangeSummary,
            embedding,
            isBinaryFallback: true,
        };
    }

    // -------------------------------------------------------------
    // SCENARIO 3: Compressed Archive Fallback (.zip, .rar, .7z, etc.)
    // -------------------------------------------------------------
    if (isCompressedArchive(fileName, mimeType)) {
        const safeSummary = `Compressed archive package: ${fileName} (${formatBytes(fileSize)}). Contains packaged documents, assets, or software bundles.`;
        const safeClassification = DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE;
        const safeChangeSummary = isVersionUpdate
            ? `Archive package updated with new contents.`
            : 'Initial file upload';

        const embedding = await generateVectorEmbedding(`${fileName} compressed archive package ${formatBytes(fileSize)}`);

        return {
            success: true,
            summary: safeSummary,
            classification: safeClassification,
            changeSummary: safeChangeSummary,
            embedding,
            isArchive: true,
        };
    }

    // -------------------------------------------------------------
    // MULTIMODAL INGESTION (PDFs, Images, Visual Scans, Audio, Text)
    // -------------------------------------------------------------
    let bucketName = DEFAULT_STORAGE_BUCKET;
    try {
        bucketName = getStorage().bucket().name || DEFAULT_STORAGE_BUCKET;
    } catch {
        bucketName = DEFAULT_STORAGE_BUCKET;
    }

    const currentGcsUri = `gs://${bucketName}/${storagePath}`;
    const effectiveMime = resolveGeminiMimeType(fileName, mimeType);

    console.log(`[aiService] GCS URI: ${currentGcsUri}, effectiveMime: ${effectiveMime}`);

    // Build prompt parts
    const parts = [];

    if (isVersionUpdate && previousStoragePath) {
        // SCENARIO 10: Version Diffing (v2.0+)
        const previousGcsUri = `gs://${bucketName}/${previousStoragePath}`;
        const previousEffectiveMime = resolveGeminiMimeType(fileName, previousMimeType || mimeType);

        parts.push({
            fileData: {
                fileUri: previousGcsUri,
                mimeType: previousEffectiveMime,
            },
        });

        parts.push({
            fileData: {
                fileUri: currentGcsUri,
                mimeType: effectiveMime,
            },
        });

        parts.push({
            text: `The first attached file is the PREVIOUS version of "${fileName}".
The second attached file is the NEW version of "${fileName}".

Compare the two versions carefully and return a JSON object with exactly these three fields:
{
  "summary": "2-3 sentence executive summary of the document content",
  "classification": "one of: ${DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC}, ${DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE}, ${DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED}, ${DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL}",
  "changeSummary": "bulleted markdown list of specific changes between the previous and new version"
}`,
        });
    } else {
        // Initial Version (v1.0)
        parts.push({
            fileData: {
                fileUri: currentGcsUri,
                mimeType: effectiveMime,
            },
        });

        parts.push({
            text: `Analyze this institutional document named "${fileName}" and return a JSON object with exactly these three fields:
{
  "summary": "2-3 sentence executive summary describing the core subject, entities, and administrative purpose. If an image, transcribe key text and mention visible seals/signatures.",
  "classification": "one of: ${DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC}, ${DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE}, ${DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED}, ${DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL}",
  "changeSummary": "Initial file upload"
}`,
        });
    }

    // Multi-model execution with automatic capacity fallback (e.g. 503 UNAVAILABLE)
    let parsedResponse = null;
    let isEncrypted = false;
    let isCapacityBusy = false;
    let lastError = null;

    for (const modelCandidate of MODEL_CANDIDATES) {
        const model = getGenerativeModel(modelCandidate);
        if (!model) {
            console.warn(`[aiService] Model ${modelCandidate} returned null from getGenerativeModel.`);
            continue;
        }

        try {
            console.log(`[aiService] Calling generateContent with model: ${modelCandidate}`);
            const response = await model.generateContent({
                contents: [{ role: 'user', parts }],
            });

            console.log(`[aiService] Raw response candidates from ${modelCandidate}:`, JSON.stringify(response?.response?.candidates?.[0]?.content || {}).substring(0, 500));

            const rawText = extractResponseText(response);
            console.log(`[aiService] Extracted text from ${modelCandidate}:`, rawText?.substring(0, 300));

            if (rawText) {
                parsedResponse = safeParseJSON(rawText);
                if (parsedResponse) {
                    console.log(`[aiService] Successfully parsed JSON from ${modelCandidate}:`, JSON.stringify(parsedResponse));
                    break; // Succeeded
                }
            }

            console.warn(`[aiService] Could not extract/parse text from ${modelCandidate} response. Trying next model.`);
        } catch (error) {
            lastError = error;
            const errorMsg = (error?.message || '').toLowerCase();
            console.error(`[aiService] Error with model ${modelCandidate}:`, error?.message);

            // SCENARIO 5: Encrypted / Password-Protected PDF Guard
            if (
                errorMsg.includes('password') ||
                errorMsg.includes('encrypted') ||
                errorMsg.includes('decrypt') ||
                errorMsg.includes('unsupported encryption')
            ) {
                console.warn(`[aiService] Encrypted document detected: ${fileName}`);
                isEncrypted = true;
                break;
            }

            // Check for 503 UNAVAILABLE / capacity / quota limits
            if (
                errorMsg.includes('unavailable') ||
                errorMsg.includes('503') ||
                errorMsg.includes('no capacity available') ||
                errorMsg.includes('resource_exhausted') ||
                errorMsg.includes('429')
            ) {
                console.warn(`[aiService] Model ${modelCandidate} capacity busy / 503. Attempting fallback...`);
                isCapacityBusy = true;
                continue; // Try next model candidate in cascade
            }

            // For other errors, still try next candidate
            console.warn(`[aiService] Unhandled error from ${modelCandidate}, trying next:`, error?.message);
        }
    }

    // SCENARIO 5: Encrypted PDF Fallback
    if (isEncrypted) {
        const encryptedSummary = `Encrypted document: ${fileName} (${formatBytes(fileSize)}). Content is password-protected and could not be extracted by automated AI.`;
        const embedding = await generateVectorEmbedding(`${fileName} encrypted document password protected`);

        return {
            success: true,
            summary: encryptedSummary,
            classification: DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL,
            changeSummary: isVersionUpdate
                ? 'Updated password-protected document'
                : 'Initial file upload (password-protected)',
            embedding,
            isEncryptedFallback: true,
        };
    }

    // SCENARIO 12: Capacity Unavailable / 503 Fallback (Never crash upload)
    if (!parsedResponse && isCapacityBusy) {
        console.warn(`[aiService] All AI models capacity busy. Returning graceful fallback for ${fileName}.`);
        return {
            success: true,
            summary: `Institutional document: ${fileName} (${formatBytes(fileSize)}). Automated AI analysis pending (AI capacity temporarily busy).`,
            classification: DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED,
            changeSummary: isVersionUpdate ? 'Document version updated' : 'Initial file upload',
            embedding: null,
            isCapacityUnavailable: true,
        };
    }

    // General fallback if all models failed for other reasons
    if (!parsedResponse) {
        console.error(`[aiService] All model candidates failed or returned unparseable responses for "${fileName}". Last error:`, lastError?.message);
        return {
            success: false,
            summary: `Institutional document: ${fileName} (${formatBytes(fileSize)}). AI analysis could not be completed.`,
            classification: DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED,
            changeSummary: isVersionUpdate ? 'Document version updated' : 'Initial file upload',
            embedding: null,
            isAIFailed: true,
        };
    }

    // Validate classification against allowed values
    const validClassifications = Object.values(DOCUMENT_VERSIONS_CLASSIFICATION);
    const finalClassification = (parsedResponse?.classification && validClassifications.includes(parsedResponse.classification))
        ? parsedResponse.classification
        : DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED;

    const finalSummary = parsedResponse?.summary || `Institutional document: ${fileName} (${formatBytes(fileSize)}).`;
    const finalChangeSummary = isVersionUpdate
        ? (parsedResponse?.changeSummary || 'Document updated to new version.')
        : (parsedResponse?.changeSummary || 'Initial file upload');

    console.log(`[aiService] Final result for "${fileName}": classification="${finalClassification}", summary="${finalSummary.substring(0, 80)}..."`);

    // Generate 768-dim Vector Embedding for semantic search
    const embedding = await generateVectorEmbedding(`${fileName} ${finalSummary} ${finalClassification}`);

    return {
        success: true,
        summary: finalSummary,
        classification: finalClassification,
        changeSummary: finalChangeSummary,
        embedding,
    };
}

/**
 * Synthesizes an executive overview for a folder based on its child documents.
 */
async function synthesizeFolderSummary({ folderName, childDocuments = [] }) {
    if (childDocuments.length === 0) {
        return {
            success: true,
            summary: `Folder containing 0 repository items for ${folderName}.`,
        };
    }

    for (const modelCandidate of MODEL_CANDIDATES) {
        const model = getGenerativeModel(modelCandidate);
        if (!model) continue;

        try {
            const docSummaries = childDocuments.slice(0, 20).map((d) => {
                return `- ${d.name} (${d.mimeType || 'file'}, classification: ${d.classification || DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED}): ${d.summary || 'No summary available'}`;
            }).join('\n');

            const prompt = `Synthesize a concise 2-sentence executive overview for an institutional folder named "${folderName}" containing the following records:\n${docSummaries}\n\nReturn JSON: {"summary": "2 sentences describing the collection and its institutional scope."}`;

            const response = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
            });

            const text = extractResponseText(response);
            if (text) {
                const parsed = safeParseJSON(text);
                if (parsed?.summary) {
                    return {
                        success: true,
                        summary: parsed.summary,
                    };
                }
            }
        } catch (err) {
            console.warn(`[aiService.synthesizeFolderSummary] Error with ${modelCandidate}:`, err?.message);
        }
    }

    return {
        success: true,
        summary: `Folder containing ${childDocuments.length} repository items for ${folderName}.`,
    };
}

module.exports = {
    analyzeDocumentFile,
    synthesizeFolderSummary,
    generateVectorEmbedding,
};
