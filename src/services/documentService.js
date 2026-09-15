// --- IMPORTS ---
import { dataConnectService } from './dataConnectService';
import { constants } from '../constants';


// --- SERVICES ---
const documentService = {
    // DOCUMENTS
    fetchDocuments: async (isArchived = false) => {
        try {
            const data = await dataConnectService.executeQuery('FetchDocuments', { isArchived: isArchived });
            const documents = data?.documents ?? [];

            return documents.map(formatLiveDocument);
        } catch (error) {
            console.error('Failed to fetch documents from Firebase Data Connect:', error);
            return [];
        }
    },

    fetchDocumentById: async (id) => {
        try {
            const data = await dataConnectService.executeQuery('FetchDocumentById', { id: id });
            const documents = data?.documents ?? [];

            return documents.length > 0 ? formatLiveDocument(documents[0]) : null;
        } catch (error) {
            console.error(`Failed to fetch document with ID "${id}":`, error);
            return null;
        }
    },

    insertDocument: async (payload) => {
        const data = await dataConnectService.executeMutation('InsertDocument', {
            parentId: payload.parentId ?? null,
            uploaderId: payload.uploaderId,
            name: payload.name,
            comment: payload.comment ?? null,
            isFolder: payload.isFolder ?? false,
            isArchived: payload.isArchived ?? false,
            createdAt: payload.createdAt,
            updatedAt: payload.updatedAt,
        });

        return formatLiveDocument(data?.document_insert ?? data?.documents_insert);
    },

    updateDocument: async (id, payload) => {
        const data = await dataConnectService.executeMutation('UpdateDocument', {
            id: id,
            parentId: payload.parentId,
            name: payload.name,
            comment: payload.comment,
            isFolder: payload.isFolder,
            isArchived: payload.isArchived,
            updatedAt: payload.updatedAt,
        });

        return formatLiveDocument(data?.document_update ?? data?.documents_update);
    },

    deleteDocument: async (id) => {
        const data = await dataConnectService.executeMutation('DeleteDocument', { id: id });
        return Boolean(data?.document_delete ?? data?.documents_delete);
    },

    // VERSIONS
    fetchDocumentVersions: async (documentId) => {
        try {
            const data = await dataConnectService.executeQuery('FetchDocumentVersions', { documentId: documentId });
            const versions = data?.documentVersions ?? [];

            return versions.map(formatLiveDocumentVersion);
        } catch (error) {
            console.error(`Failed to fetch versions for document "${documentId}":`, error);
            return [];
        }
    },

    fetchDocumentVersionById: async (id) => {
        try {
            const data = await dataConnectService.executeQuery('FetchDocumentVersionById', { id: id });
            const versions = data?.documentVersions ?? [];

            return versions.length > 0 ? formatLiveDocumentVersion(versions[0]) : null;
        } catch (error) {
            console.error(`Failed to fetch document version with ID "${id}":`, error);
            return null;
        }
    },

    insertDocumentVersion: async (payload) => {
        const data = await dataConnectService.executeMutation('InsertDocumentVersion', {
            documentId: payload.documentId,
            uploaderId: payload.uploaderId,
            approverId: payload.approverId ?? null,
            publisherId: payload.publisherId ?? null,
            rejecterId: payload.rejecterId ?? null,
            version: payload.version,
            checksum: payload.checksum ?? null,
            path: payload.path,
            sizeBytes: payload.sizeBytes,
            mimeType: payload.mimeType,
            classification: payload.classification ?? constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED,
            changeSummary: payload.changeSummary ?? null,
            rejectionReason: payload.rejectionReason ?? null,
            summary: payload.summary ?? null,
            textHash: payload.textHash ?? null,
            createdAt: payload.createdAt,
            updatedAt: payload.updatedAt,
        });

        return formatLiveDocumentVersion(data?.documentVersion_insert ?? data?.documentVersions_insert);
    },

    updateDocumentVersion: async (id, payload) => {
        const data = await dataConnectService.executeMutation('UpdateDocumentVersion', {
            id: id,
            approverId: payload.approverId,
            publisherId: payload.publisherId,
            rejecterId: payload.rejecterId,
            checksum: payload.checksum,
            path: payload.path,
            sizeBytes: payload.sizeBytes,
            mimeType: payload.mimeType,
            classification: payload.classification,
            changeSummary: payload.changeSummary,
            rejectionReason: payload.rejectionReason,
            summary: payload.summary,
            textHash: payload.textHash,
            updatedAt: payload.updatedAt,
        });

        return formatLiveDocumentVersion(data?.documentVersion_update ?? data?.documentVersions_update);
    },

    deleteDocumentVersion: async (id) => {
        const data = await dataConnectService.executeMutation('DeleteDocumentVersion', { id: id });
        return Boolean(data?.documentVersion_delete ?? data?.documentVersions_delete);
    },

    // SHARES
    fetchDocumentShares: async (documentId) => {
        try {
            const data = await dataConnectService.executeQuery('FetchDocumentShares', { documentId: documentId });
            const shares = data?.documentShares ?? [];

            return shares.map(formatLiveDocumentShare);
        } catch (error) {
            console.error(`Failed to fetch shares for document "${documentId}":`, error);
            return [];
        }
    },

    fetchDocumentSharesByDepartmentId: async (departmentId) => {
        try {
            const data = await dataConnectService.executeQuery('FetchDocumentSharesByDepartmentId', { departmentId: departmentId });
            const shares = data?.documentShares ?? [];

            return shares.map(formatLiveDocumentShare);
        } catch (error) {
            console.error(`Failed to fetch shares for department "${departmentId}":`, error);
            return [];
        }
    },

    fetchDocumentSharesByRecipientId: async (recipientId) => {
        try {
            const data = await dataConnectService.executeQuery('FetchDocumentSharesByRecipientId', { recipientId: recipientId });
            const shares = data?.documentShares ?? [];

            return shares.map(formatLiveDocumentShare);
        } catch (error) {
            console.error(`Failed to fetch shares for recipient "${recipientId}":`, error);
            return [];
        }
    },

    fetchDocumentShareById: async (id) => {
        try {
            const data = await dataConnectService.executeQuery('FetchDocumentShareById', { id: id });
            const shares = data?.documentShares ?? [];

            return shares.length > 0 ? formatLiveDocumentShare(shares[0]) : null;
        } catch (error) {
            console.error(`Failed to fetch document share with ID "${id}":`, error);
            return null;
        }
    },

    insertDocumentShare: async (payload) => {
        const data = await dataConnectService.executeMutation('InsertDocumentShare', {
            documentId: payload.documentId,
            sharerId: payload.sharerId,
            recipientId: payload.recipientId ?? null,
            departmentId: payload.departmentId,
            status: payload.status ?? constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL,
            createdAt: payload.createdAt,
            updatedAt: payload.updatedAt,
        });

        return formatLiveDocumentShare(data?.documentShare_insert ?? data?.documentShares_insert);
    },

    updateDocumentShare: async (id, payload) => {
        const data = await dataConnectService.executeMutation('UpdateDocumentShare', {
            id: id,
            recipientId: payload.recipientId,
            departmentId: payload.departmentId,
            status: payload.status,
            updatedAt: payload.updatedAt,
        });

        return formatLiveDocumentShare(data?.documentShare_update ?? data?.documentShares_update);
    },

    deleteDocumentShare: async (id) => {
        const data = await dataConnectService.executeMutation('DeleteDocumentShare', { id: id });
        return Boolean(data?.documentShare_delete ?? data?.documentShares_delete);
    },

    // REQUESTS
    fetchDocumentRequests: async () => {
        try {
            const data = await dataConnectService.executeQuery('FetchDocumentRequests');
            const requests = data?.documentRequests ?? [];

            return requests.map(formatLiveDocumentRequest);
        } catch (error) {
            console.error('Failed to fetch document requests:', error);
            return [];
        }
    },

    fetchDocumentRequestsByRequesterId: async (requesterId) => {
        try {
            const data = await dataConnectService.executeQuery('FetchDocumentRequestsByRequesterId', { requesterId: requesterId });
            const requests = data?.documentRequests ?? [];

            return requests.map(formatLiveDocumentRequest);
        } catch (error) {
            console.error(`Failed to fetch document requests for requester "${requesterId}":`, error);
            return [];
        }
    },

    fetchDocumentRequestById: async (id) => {
        try {
            const data = await dataConnectService.executeQuery('FetchDocumentRequestById', { id: id });
            const requests = data?.documentRequests ?? [];

            return requests.length > 0 ? formatLiveDocumentRequest(requests[0]) : null;
        } catch (error) {
            console.error(`Failed to fetch document request with ID "${id}":`, error);
            return null;
        }
    },

    insertDocumentRequest: async (payload) => {
        const data = await dataConnectService.executeMutation('InsertDocumentRequest', {
            requesterId: payload.requesterId,
            resolverId: payload.resolverId ?? null,
            subject: payload.subject,
            status: payload.status ?? constants.DOCUMENT_REQUESTS_STATUS.OPEN,
            createdAt: payload.createdAt,
            updatedAt: payload.updatedAt,
        });

        return formatLiveDocumentRequest(data?.documentRequest_insert ?? data?.documentRequests_insert);
    },

    updateDocumentRequest: async (id, payload) => {
        const data = await dataConnectService.executeMutation('UpdateDocumentRequest', {
            id: id,
            resolverId: payload.resolverId,
            subject: payload.subject,
            status: payload.status,
            updatedAt: payload.updatedAt,
        });

        return formatLiveDocumentRequest(data?.documentRequest_update ?? data?.documentRequests_update);
    },

    deleteDocumentRequest: async (id) => {
        const data = await dataConnectService.executeMutation('DeleteDocumentRequest', { id: id });
        return Boolean(data?.documentRequest_delete ?? data?.documentRequests_delete);
    },

    // MESSAGES
    fetchDocumentRequestMessages: async (documentRequestId) => {
        try {
            const data = await dataConnectService.executeQuery('FetchDocumentRequestMessages', { documentRequestId: documentRequestId });
            const messages = data?.documentRequestMessages ?? [];

            return messages.map(formatLiveDocumentRequestMessage);
        } catch (error) {
            console.error(`Failed to fetch messages for request "${documentRequestId}":`, error);
            return [];
        }
    },

    insertDocumentRequestMessage: async (payload) => {
        const data = await dataConnectService.executeMutation('InsertDocumentRequestMessage', {
            documentRequestId: payload.documentRequestId,
            userId: payload.userId ?? null,
            message: payload.message,
            createdAt: payload.createdAt,
        });

        return formatLiveDocumentRequestMessage(data?.documentRequestMessage_insert ?? data?.documentRequestMessages_insert);
    },

    deleteDocumentRequestMessage: async (id) => {
        const data = await dataConnectService.executeMutation('DeleteDocumentRequestMessage', { id: id });
        return Boolean(data?.documentRequestMessage_delete ?? data?.documentRequestMessages_delete);
    },

    // ATTACHMENTS
    fetchDocumentRequestAttachments: async (documentRequestId) => {
        try {
            const data = await dataConnectService.executeQuery('FetchDocumentRequestAttachments', { documentRequestId: documentRequestId });
            const attachments = data?.documentRequestAttachments ?? [];

            return attachments.map(formatLiveDocumentRequestAttachment);
        } catch (error) {
            console.error(`Failed to fetch attachments for request "${documentRequestId}":`, error);
            return [];
        }
    },

    insertDocumentRequestAttachment: async (payload) => {
        const data = await dataConnectService.executeMutation('InsertDocumentRequestAttachment', {
            documentRequestId: payload.documentRequestId,
            documentId: payload.documentId,
            attachedById: payload.attachedById,
            createdAt: payload.createdAt,
        });

        return formatLiveDocumentRequestAttachment(data?.documentRequestAttachment_insert ?? data?.documentRequestAttachments_insert);
    },

    deleteDocumentRequestAttachment: async (id) => {
        const data = await dataConnectService.executeMutation('DeleteDocumentRequestAttachment', { id: id });
        return Boolean(data?.documentRequestAttachment_delete ?? data?.documentRequestAttachments_delete);
    },
};


// --- HELPERS ---
function formatLiveDocument(rawDocument) {
    if (!rawDocument) {
        return null;
    }

    return {
        id: rawDocument.id,
        parent: rawDocument.parent,
        uploader: rawDocument.uploader,
        name: rawDocument.name,
        comment: rawDocument.comment,
        isFolder: rawDocument.isFolder,
        isArchived: rawDocument.isArchived,
        createdAt: rawDocument.createdAt,
        updatedAt: rawDocument.updatedAt,
    };
}

function formatLiveDocumentVersion(rawVersion) {
    if (!rawVersion) {
        return null;
    }

    return {
        id: rawVersion.id,
        document: rawVersion.document,
        uploader: rawVersion.uploader,
        approver: rawVersion.approver,
        publisher: rawVersion.publisher,
        rejecter: rawVersion.rejecter,
        version: rawVersion.version,
        checksum: rawVersion.checksum,
        path: rawVersion.path,
        sizeBytes: rawVersion.sizeBytes,
        mimeType: rawVersion.mimeType,
        classification: rawVersion.classification,
        changeSummary: rawVersion.changeSummary,
        rejectionReason: rawVersion.rejectionReason,
        summary: rawVersion.summary,
        textHash: rawVersion.textHash,
        createdAt: rawVersion.createdAt,
        updatedAt: rawVersion.updatedAt,
    };
}

function formatLiveDocumentShare(rawShare) {
    if (!rawShare) {
        return null;
    }

    return {
        id: rawShare.id,
        document: rawShare.document,
        sharer: rawShare.sharer,
        recipient: rawShare.recipient,
        department: rawShare.department,
        status: rawShare.status,
        createdAt: rawShare.createdAt,
        updatedAt: rawShare.updatedAt,
    };
}

function formatLiveDocumentRequest(rawRequest) {
    if (!rawRequest) {
        return null;
    }

    return {
        id: rawRequest.id,
        requester: rawRequest.requester,
        resolver: rawRequest.resolver,
        subject: rawRequest.subject,
        status: rawRequest.status,
        createdAt: rawRequest.createdAt,
        updatedAt: rawRequest.updatedAt,
    };
}

function formatLiveDocumentRequestMessage(rawMessage) {
    if (!rawMessage) {
        return null;
    }

    return {
        id: rawMessage.id,
        documentRequest: rawMessage.documentRequest,
        user: rawMessage.user,
        message: rawMessage.message,
        createdAt: rawMessage.createdAt,
    };
}

function formatLiveDocumentRequestAttachment(rawAttachment) {
    if (!rawAttachment) {
        return null;
    }

    return {
        id: rawAttachment.id,
        documentRequest: rawAttachment.documentRequest,
        document: rawAttachment.document,
        attachedBy: rawAttachment.attachedBy,
        createdAt: rawAttachment.createdAt,
    };
}


// --- EXPORTS ---
export { documentService };
