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
    }) => {
        if (!functions) {
            console.warn('[aiService] Firebase functions instance not available.');
            return {
                success: false,
                summary: `Institutional document: ${fileName}.`,
                classification: constants.DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE,
                changeSummary: isVersionUpdate ? 'Document version updated.' : 'Initial file upload',
                embedding: null,
            };
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
            });

            return response?.data || {
                success: false,
                summary: `Institutional document: ${fileName}.`,
                classification: constants.DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE,
                changeSummary: isVersionUpdate ? 'Document version updated.' : 'Initial file upload',
                embedding: null,
            };
        } catch (error) {
            console.warn('[aiService.analyzeDocumentFile] AI processing error:', error?.message);
            return {
                success: false,
                error: error?.message,
                summary: `Institutional document: ${fileName}.`,
                classification: constants.DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE,
                changeSummary: isVersionUpdate ? 'Document version updated.' : 'Initial file upload',
                embedding: null,
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
};

export default aiService;
