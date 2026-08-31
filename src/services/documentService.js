// --- IMPORTS ---
import { dataConnectService } from './dataConnectService';

// --- HELPERS ---
function formatLiveDocument(rawDocument) {
    if (!rawDocument) {
        return null;
    }

    return {
        id: rawDocument.id,
        name: rawDocument.name,
        is_folder: rawDocument.isFolder ?? false,
        is_archived: rawDocument.isArchived ?? false,
        comment: rawDocument.comment ?? '',
        parent_id: rawDocument.parent?.id ?? null,
        parent_name: rawDocument.parent?.name ?? null,
        uploader_id: rawDocument.uploader?.id ?? null,
        uploader_name: rawDocument.uploader ? `${rawDocument.uploader.firstName} ${rawDocument.uploader.lastName}` : 'System',
    };
}

// --- SERVICE IMPLEMENTATION ---
const documentService = {
    fetchDocuments: async (isArchived = false) => {
        try {
            const data = await dataConnectService.executeQuery('ListDocuments', { isArchived });
            const documents = data?.documents ?? [];
            return documents.map(formatLiveDocument);
        } catch (error) {
            console.error('Failed to fetch documents from Firebase Data Connect:', error);
            return [];
        }
    },

    fetchDocumentById: async (id) => {
        try {
            const data = await dataConnectService.executeQuery('GetDocumentById', { id });
            return formatLiveDocument(data?.document);
        } catch (error) {
            console.error(`Failed to fetch document with id "${id}":`, error);
            return null;
        }
    },

    fetchDocumentVersions: async (documentId) => {
        try {
            const data = await dataConnectService.executeQuery('ListDocumentVersions', { documentId });
            return data?.documentVersions ?? [];
        } catch (error) {
            console.error(`Failed to fetch versions for document "${documentId}":`, error);
            return [];
        }
    },

    fetchDocumentShares: async (documentId) => {
        try {
            const data = await dataConnectService.executeQuery('ListDocumentShares', { documentId });
            return data?.documentShares ?? [];
        } catch (error) {
            console.error(`Failed to fetch shares for document "${documentId}":`, error);
            return [];
        }
    },

    createDocument: async (payload) => {
        const data = await dataConnectService.executeMutation('CreateDocument', {
            name: payload.name,
            uploaderId: payload.uploaderId ?? payload.uploader_id,
            isFolder: payload.isFolder ?? payload.is_folder ?? false,
            isArchived: payload.isArchived ?? payload.is_archived ?? false,
            comment: payload.comment ?? '',
        });
        return formatLiveDocument(data?.document_insert);
    },

    createDocumentVersion: async (payload) => {
        const data = await dataConnectService.executeMutation('CreateDocumentVersion', {
            documentId: payload.documentId ?? payload.document_id,
            uploaderId: payload.uploaderId ?? payload.uploader_id,
            version: payload.version,
            path: payload.path,
            sizeBytes: payload.sizeBytes ?? payload.size_bytes,
            mimeType: payload.mimeType ?? payload.mime_type,
            classification: payload.classification,
            changeSummary: payload.changeSummary ?? payload.change_summary ?? '',
            summary: payload.summary ?? '',
            textHash: payload.textHash ?? payload.text_hash ?? '',
        });
        return data?.documentVersion_insert ?? null;
    },
};

export {
    documentService,
    formatLiveDocument,
};

export default documentService;
