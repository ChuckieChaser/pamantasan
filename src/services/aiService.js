// --- IMPORTS ---
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { constants } from '../constants';

// --- AI SERVICE BRIDGE ---
export const aiService = {
    /**
     * Calls the backend Vertex AI function to analyze an uploaded document or revision.
     * Generates executive summary, security classification, 768-dim vector embedding, and version diffing notes.
     */
    analyzeDocumentFile: async ({
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
        const generateClientFallback = () => {
            const cleaned = (extractedText || '').replace(/\r\n/g, '\n').trim();
            const cleanedName = (fileName || '').replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
            const lowerName = cleanedName.toLowerCase();
            const lowerText = cleaned.toLowerCase();

            let fallbackSummary;
            let fallbackClassification = constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED;

            if (cleaned.length > 20) {
                const lines = cleaned.split('\n')
                    .map(l => l.trim())
                    .filter(l => l.length > 2 && !/^(page \d+|confidential|official|date|printed)/i.test(l));

                // 1. Memoranda, Directives, Circulars, Governance Guidelines
                if (
                    /\b(memorandum|memo|circular|directive|governance|guidelines|guideline)\b/i.test(lowerText) ||
                    /office of (the )?[a-z]+/i.test(lowerText)
                ) {
                    const subjectMatch = lines.find(l => /^subject[:\s]/i.test(l)) || lines.find(l => /^re[:\s]/i.test(l));
                    const fromMatch = lines.find(l => /^from[:\s]/i.test(l));
                    const purposeMatch = lines.find(l => /^(purpose|objective)[:\s]/i.test(l)) ||
                        lines.find(l => /establishes guidelines|guidelines for|this memorandum/i.test(l));

                    const issuingOffice = fromMatch
                        ? fromMatch.replace(/^from[:\s]+/i, '').trim()
                        : 'Executive Administration';
                    const subject = subjectMatch
                        ? subjectMatch.replace(/^subject[:\s]+/i, '').replace(/^re[:\s]+/i, '').trim()
                        : 'official administrative procedures and operational standards';
                    const purpose = purposeMatch
                        ? purposeMatch.replace(/^(purpose|objective)[:\s]+/i, '').trim()
                        : 'timely preparation, supervisory review, and submission of official department reports';

                    const line1 = `Governance memorandum issued by the ${issuingOffice} regarding ${subject}.`;
                    const line2 = `Establishes formal guidelines for ${purpose.replace(/[.]+$/, '')}, mandating accurate data submission and secure records management.`;
                    const line3 = `Takes effect immediately upon issuance with strict operational compliance required across all concerned offices and personnel.`;

                    fallbackSummary = `${line1}\n\n${line2}\n\n${line3}`;
                    fallbackClassification = constants.DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE;
                } else if (
                    /\b(grade|grades|scholastic|evaluation|cwa|gwa|units|transcript)\b/i.test(lowerText) ||
                    /\b(tor|transcript of records)\b/i.test(lowerText)
                ) {
                    const subjectLine = `Official academic report presenting student scholastic evaluation and course performance metrics.`;
                    const gradeDetails = lines.find(l => /cwa|gwa|average|grade|units/i.test(l)) || lines[1] || 'Details student scholastic performance, subject marks, and credit unit completion';
                    const detailsLine = `Covers ${gradeDetails.replace(/[:—]/g, ' ').trim()}.`;
                    const conclusionLine = `Serves as authoritative academic record for prerequisite validation, standing review, and registrar archiving.`;
                    fallbackSummary = `${subjectLine}\n\n${detailsLine}\n\n${conclusionLine}`;
                    fallbackClassification = constants.DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL;
                } else if (/\b(syllabus|course outline|curriculum)\b/i.test(lowerText)) {
                    const subjectLine = `Academic course syllabus outlining curricular competencies, grading breakdown, and learning outcomes.`;
                    const detailsLine = lines.slice(0, 2).join(' — ').substring(0, 130) + '.';
                    const conclusionLine = `Establishes instructional objectives and student academic performance expectations for the academic term.`;
                    fallbackSummary = `${subjectLine}\n\n${detailsLine}\n\n${conclusionLine}`;
                    fallbackClassification = constants.DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE;
                } else if (/\b(profile|curriculum vitae|pds|resume)\b/i.test(lowerText)) {
                    const subjectLine = `Institutional profile summary outlining verified user credentials, account status, and role privileges.`;
                    const detailsLine = lines.slice(0, 2).join(' — ').substring(0, 130) + '.';
                    const conclusionLine = `Maintained as verified reference documentation for user authorization and institutional identity oversight.`;
                    fallbackSummary = `${subjectLine}\n\n${detailsLine}\n\n${conclusionLine}`;
                    fallbackClassification = constants.DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL;
                } else {
                    const firstSentence = lines[0] ? lines[0].substring(0, 110) : 'official university affairs';
                    const secondSentence = lines[1] ? lines[1].substring(0, 120) : 'Details administrative transactions, operational policies, and formal notifications';
                    fallbackSummary = `Official documentation addressing ${firstSentence}.\n\n${secondSentence}.\n\nMaintained for institutional reference, operational continuity, and administrative governance.`;
                }
            } else if (lowerName.includes('profile') || lowerName.includes('user')) {
                fallbackSummary = `Institutional profile summary detailing verified user credentials, administrative status, and system permissions.\n\nOutlines departmental affiliation, role-based clearance, and operational authorization across university modules.\n\nServes as reference documentation for account identity verification and administrative governance.`;
                fallbackClassification = constants.DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL;
            } else if (lowerName.includes('grade') || /\b(tor|transcript)\b/i.test(lowerName)) {
                fallbackSummary = `Official academic record presenting student course completions, semester evaluations, and scholastic standing.\n\nDetails subject marks, earned credit units, and cumulative performance metrics for the recorded academic term.\n\nServes as authoritative record for credential verification, prerequisite clearance, and registrar archiving.`;
                fallbackClassification = constants.DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL;
            } else if (lowerName.includes('memo') || lowerName.includes('circular') || lowerName.includes('governance')) {
                fallbackSummary = `Official administrative memorandum communicating institutional directives, operational guidelines, and policy updates.\n\nDetails compliance expectations, implementation timelines, and responsibilities for relevant university departments.\n\nEnforces administrative standardization and operational coordination across institutional units.`;
                fallbackClassification = constants.DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE;
            } else if (lowerName.includes('syllabus') || lowerName.includes('curriculum')) {
                fallbackSummary = `Official academic course syllabus detailing subject curriculum, instructional competencies, and learning outcomes.\n\nOutlines modular lecture topics, evaluation criteria, grading policies, and required academic benchmarks.\n\nGuides instructional delivery and student academic performance standards for the enrolled course.`;
                fallbackClassification = constants.DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE;
            } else {
                const isRandomName = /^[a-z0-9_]{10,}$/i.test(cleanedName) || /^[asdfjklqwertyzxcvbnm]+$/i.test(cleanedName);
                const subjectLabel = isRandomName ? 'institutional administrative records' : `university matters concerning ${cleanedName}`;
                fallbackSummary = `Institutional documentation detailing official ${subjectLabel}.\n\nOutlines relevant administrative guidelines, subject transactions, and operational records for institutional stakeholders.\n\nMaintained as formal record for departmental reference, accountability, and operational continuity.`;
            }

            return {
                success: false,
                summary: fallbackSummary,
                classification: fallbackClassification,
                changeSummary: isVersionUpdate ? 'Document version updated.' : 'Initial file upload',
                embedding: null,
            };
        };

        if (!functions) {
            console.warn('[aiService] Firebase functions instance not available.');
            return generateClientFallback();
        }

        try {
            const analyzeCallable = httpsCallable(functions, 'analyzeDocumentFile');
            const response = await analyzeCallable({
                storagePath,
                mimeType,
                fileName,
                fileSize,
                isVersionUpdate,
                previousStoragePath,
                previousMimeType,
                nextVersion,
                extractedText,
            });

            return response?.data || generateClientFallback();
        } catch (error) {
            console.warn('[aiService.analyzeDocumentFile] AI processing error:', error?.message);
            const fallback = generateClientFallback();
            return {
                ...fallback,
                error: error?.message,
            };
        }
    },

    /**
     * Synthesizes an executive overview for a folder based on child document records.
     */
    synthesizeFolderSummary: async ({ folderName, childDocuments = [] }) => {
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
    },

    /**
     * Generates a 768-dimensional text embedding for a search query or document string.
     */
    generateTextEmbedding: async (text) => {
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
    },

    /**
     * Computes cosine similarity between two numeric embedding vectors.
     */
    computeCosineSimilarity: (vecA, vecB) => {
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
    },

    /**
     * Scans all document versions in Data Connect and populates embeddings for any records where embedding is null/missing.
     */
    backfillMissingEmbeddings: async ({ onProgress } = {}) => {
        const { default: documentService } = await import('./documentService');
        try {
            const allVersions = await documentService.fetchAllDocumentVersions();
            const missingVersions = (allVersions || []).filter(
                (v) => !v.embedding || !Array.isArray(v.embedding) || v.embedding.length === 0
            );

            console.log(`[aiService.backfillMissingEmbeddings] Found ${missingVersions.length} versions with missing embeddings out of ${allVersions.length} total.`);

            let updatedCount = 0;
            const errors = [];

            for (let i = 0; i < missingVersions.length; i++) {
                const version = missingVersions[i];
                const docName = version.document?.name || version.path || 'document';
                onProgress?.({
                    current: i + 1,
                    total: missingVersions.length,
                    fileName: docName,
                });

                const contextParts = [
                    docName,
                    version.summary,
                    version.changeSummary,
                    version.classification,
                ].filter(Boolean);

                const textToEmbed = contextParts.join('. ').trim();
                if (!textToEmbed) continue;

                try {
                    const embedding = await aiService.generateTextEmbedding(textToEmbed);
                    if (embedding && Array.isArray(embedding) && embedding.length > 0) {
                        await documentService.updateDocumentVersion(version.id, {
                            approverId: version.approver?.id ?? null,
                            publisherId: version.publisher?.id ?? null,
                            rejecterId: version.rejecter?.id ?? null,
                            checksum: version.checksum ?? null,
                            path: version.path,
                            sizeBytes: version.sizeBytes,
                            mimeType: version.mimeType,
                            classification: version.classification,
                            changeSummary: version.changeSummary,
                            rejectionReason: version.rejectionReason,
                            summary: version.summary,
                            embedding: embedding,
                            textHash: version.textHash,
                        });
                        updatedCount++;
                        console.log(`[aiService.backfillMissingEmbeddings] Populated ${embedding.length}-dim vector for version ${version.id} (${docName})`);
                    } else {
                        errors.push({ versionId: version.id, error: 'Empty embedding returned from AI' });
                    }
                } catch (verErr) {
                    console.error(`[aiService.backfillMissingEmbeddings] Error on version ${version.id}:`, verErr);
                    errors.push({ versionId: version.id, error: verErr?.message });
                }
            }

            return {
                totalChecked: allVersions.length,
                missingCount: missingVersions.length,
                updatedCount,
                errors,
            };
        } catch (error) {
            console.error('[aiService.backfillMissingEmbeddings] Backfill failed:', error);
            throw error;
        }
    },
};

export default aiService;
