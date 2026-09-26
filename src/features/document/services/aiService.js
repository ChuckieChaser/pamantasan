// --- IMPORTS ---
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../services/firebase';
import { DOCUMENT_CLASSIFICATION } from '../documentConstants';


// --- HELPERS ---
const generateClientFallback = ({ fileName, extractedText, isVersionUpdate }) => {
    const cleaned = (extractedText || '').replace(/\r\n/g, '\n').trim();
    const cleanedName = (fileName || '').replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
    const lowerName = cleanedName.toLowerCase();
    const lowerText = cleaned.toLowerCase();

    let fallbackSummary;
    let fallbackClassification = DOCUMENT_CLASSIFICATION.UNCLASSIFIED;

    if (cleaned.length > 20) {
        const lines = cleaned.split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 2 && !/^(page \d+|confidential|official|date|printed)/i.test(l));

        if (
            /\b(memorandum|memo|circular|directive|governance|guidelines|guideline)\b/i.test(lowerText) ||
            /office of (the )?[a-z]+/i.test(lowerText)
        ) {
            const subjectMatch = lines.find((l) => /^subject[:\s]/i.test(l)) || lines.find((l) => /^re[:\s]/i.test(l));
            const fromMatch = lines.find((l) => /^from[:\s]/i.test(l));
            const issuingOffice = fromMatch
                ? fromMatch.replace(/^from[:\s]+/i, '').trim()
                : 'Executive Administration';
            const subject = subjectMatch
                ? subjectMatch.replace(/^subject[:\s]+/i, '').replace(/^re[:\s]+/i, '').trim()
                : 'official administrative procedures and operational standards';

            fallbackSummary = `Governance memorandum issued by the ${issuingOffice} regarding ${subject}.\n\nEstablishes formal guidelines mandating accurate data submission and secure records management.\n\nTakes effect immediately with operational compliance required across all concerned personnel.`;
            fallbackClassification = DOCUMENT_CLASSIFICATION.PRIVATE;
        } else if (
            /\b(grade|grades|scholastic|evaluation|cwa|gwa|units|transcript)\b/i.test(lowerText) ||
            /\b(tor|transcript of records)\b/i.test(lowerText)
        ) {
            fallbackSummary = `Official academic report presenting student scholastic evaluation and course performance metrics.\n\nDetails subject marks, earned credit units, and cumulative performance metrics.\n\nServes as authoritative academic record for prerequisite validation and registrar archiving.`;
            fallbackClassification = DOCUMENT_CLASSIFICATION.CONFIDENTIAL;
        } else if (/\b(syllabus|course outline|curriculum)\b/i.test(lowerText)) {
            fallbackSummary = `Academic course syllabus outlining curricular competencies, grading breakdown, and learning outcomes.\n\nEstablishes instructional objectives and student academic performance expectations for the academic term.`;
            fallbackClassification = DOCUMENT_CLASSIFICATION.PRIVATE;
        } else {
            const firstLine = lines[0] ? lines[0].substring(0, 110) : 'official university affairs';
            fallbackSummary = `Official documentation addressing ${firstLine}.\n\nMaintained for institutional reference, operational continuity, and administrative governance.`;
            fallbackClassification = DOCUMENT_CLASSIFICATION.UNCLASSIFIED;
        }
    } else if (lowerName.includes('profile') || lowerName.includes('user')) {
        fallbackSummary = `Institutional profile summary detailing verified user credentials, administrative status, and system permissions.`;
        fallbackClassification = DOCUMENT_CLASSIFICATION.CONFIDENTIAL;
    } else if (lowerName.includes('grade') || /\b(tor|transcript)\b/i.test(lowerName)) {
        fallbackSummary = `Official academic record presenting student course completions, semester evaluations, and scholastic standing.`;
        fallbackClassification = DOCUMENT_CLASSIFICATION.CONFIDENTIAL;
    } else if (lowerName.includes('memo') || lowerName.includes('circular')) {
        fallbackSummary = `Official administrative memorandum communicating institutional directives, operational guidelines, and policy updates.`;
        fallbackClassification = DOCUMENT_CLASSIFICATION.PRIVATE;
    } else {
        fallbackSummary = `Official university repository document: ${cleanedName}.`;
        fallbackClassification = DOCUMENT_CLASSIFICATION.UNCLASSIFIED;
    }

    return {
        success: true,
        summary: fallbackSummary,
        classification: fallbackClassification,
        changeSummary: isVersionUpdate ? 'Document version updated.' : 'Initial file upload',
        embedding: null,
    };
};


// --- SERVICES ---
export const analyzeDocumentFile = async ({
    storagePath,
    mimeType,
    fileName,
    fileSize = 0,
    isVersionUpdate = false,
    previousStoragePath = null,
    previousMimeType = null,
    nextVersion = null,
    extractedText = null,
}) => {
    if (!functions) {
        console.warn('[aiService] Firebase functions instance not available. Using local fallback.');
        return generateClientFallback({ fileName, extractedText, isVersionUpdate });
    }

    try {
        const analyzeCallable = httpsCallable(functions, 'analyzeDocumentFile');
        const response = await analyzeCallable({
            storagePath,
            mimeType,
            fileName,
            fileSize: Number(fileSize) || 0,
            isVersionUpdate: Boolean(isVersionUpdate),
            previousStoragePath,
            previousMimeType,
            nextVersion,
            extractedText,
        });

        return response?.data || generateClientFallback({ fileName, extractedText, isVersionUpdate });
    } catch (error) {
        console.warn('[aiService.analyzeDocumentFile] AI processing error:', error?.message);
        const fallback = generateClientFallback({ fileName, extractedText, isVersionUpdate });
        return {
            ...fallback,
            error: error?.message,
        };
    }
};

export const synthesizeFolderSummary = async ({ folderName, childDocuments = [] }) => {
    if (!functions) {
        return {
            success: false,
            summary: `Folder containing ${childDocuments.length} repository items for ${folderName}.`,
        };
    }

    try {
        const synthesizeCallable = httpsCallable(functions, 'synthesizeFolderSummary');
        const response = await synthesizeCallable({
            folderName,
            childDocuments,
        });

        return response?.data || {
            success: false,
            summary: `Folder containing ${childDocuments.length} repository items for ${folderName}.`,
        };
    } catch (error) {
        console.warn('[aiService.synthesizeFolderSummary] Folder synthesis error:', error?.message);
        return {
            success: false,
            error: error?.message,
            summary: `Folder containing ${childDocuments.length} repository items for ${folderName}.`,
        };
    }
};

export const generateTextEmbedding = async (text) => {
    if (!text || typeof text !== 'string' || !text.trim()) {
        return null;
    }

    if (!functions) {
        console.warn('[aiService] Firebase functions instance not available.');
        return null;
    }

    try {
        const embeddingCallable = httpsCallable(functions, 'generateTextEmbedding');
        const response = await embeddingCallable({ text: text.trim() });
        const embedding = response?.data?.embedding;
        if (Array.isArray(embedding) && embedding.length > 0) {
            return embedding;
        }
        return null;
    } catch (error) {
        console.warn('[aiService.generateTextEmbedding] Failed to generate embedding:', error?.message);
        return null;
    }
};

export const computeCosineSimilarity = (vecA, vecB) => {
    if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecB.length === 0) {
        return 0;
    }
    const len = Math.min(vecA.length, vecB.length);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < len; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};


// --- COMPOSITE SERVICE EXPORT ---
export const aiService = {
    analyzeDocumentFile,
    synthesizeFolderSummary,
    generateTextEmbedding,
    computeCosineSimilarity,
};
