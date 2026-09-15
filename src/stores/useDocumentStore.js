// --- IMPORTS ---
import { create } from 'zustand';

import { mutationSchema } from '../schemas';
import { documentService } from '../services';


// --- STORE ---
const useDocumentStore = create((set, get) => ({
    // STATES
    documents: [],
    selectedDocument: null,
    documentVersions: [],
    selectedVersion: null,
    documentShares: [],
    departmentDocumentShares: [],
    recipientDocumentShares: [],
    selectedDocumentShare: null,
    documentRequests: [],
    requesterDocumentRequests: [],
    selectedDocumentRequest: null,
    documentRequestMessages: [],
    documentRequestAttachments: [],
    isLoading: false,
    error: null,

    // DOCUMENTS
    fetchDocuments: async (isArchived = false) => {
        set({ isLoading: true, error: null });

        try {
            const documents = await documentService.fetchDocuments(isArchived);
            set({ documents: documents, isLoading: false, error: null });

            return documents;
        } catch (error) {
            const message = error?.message ?? 'Failed to fetch documents.';
            set({ isLoading: false, error: message });

            return [];
        }
    },

    fetchDocumentById: async (id) => {
        set({ isLoading: true, error: null });

        try {
            let document = get().documents.find((item) => item.id === id);

            if (!document) {
                document = await documentService.fetchDocumentById(id);
            }

            set({ selectedDocument: document, isLoading: false, error: null });

            return document;
        } catch (error) {
            const message = error?.message ?? `Failed to fetch document with ID "${id}".`;
            set({ isLoading: false, error: message });

            return null;
        }
    },

    insertDocument: async (payload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedPayload = mutationSchema.InsertDocumentSchema.parse(payload);
            const newDocument = await documentService.insertDocument(validatedPayload);

            set((state) => ({
                documents: [...state.documents, newDocument],
                isLoading: false,
                error: null,
            }));

            return newDocument;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to insert document.';
            set({ isLoading: false, error: message });
            
            throw error;
        }
    },

    updateDocument: async (id, payload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedPayload = mutationSchema.UpdateDocumentSchema.parse(payload);
            const updatedDocument = await documentService.updateDocument(id, validatedPayload);

            set((state) => ({
                documents: state.documents.map((item) =>
                    item.id === id ? updatedDocument : item
                ),
                selectedDocument: state.selectedDocument?.id === id
                    ? updatedDocument
                    : state.selectedDocument,
                isLoading: false,
                error: null,
            }));

            return updatedDocument;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to update document.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    deleteDocument: async (id) => {
        set({ isLoading: true, error: null });

        try {
            const isDeleted = await documentService.deleteDocument(id);

            if (isDeleted) {
                set((state) => ({
                    documents: state.documents.filter((item) => item.id !== id),
                    selectedDocument: state.selectedDocument?.id === id
                        ? null
                        : state.selectedDocument,
                    isLoading: false,
                    error: null,
                }));
            } else {
                set({ isLoading: false });
            }

            return isDeleted;
        } catch (error) {
            const message = error?.message ?? 'Failed to delete document.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    // VERSIONS
    fetchDocumentVersions: async (documentId) => {
        set({ isLoading: true, error: null });

        try {
            const versions = await documentService.fetchDocumentVersions(documentId);
            set({ documentVersions: versions, isLoading: false, error: null });

            return versions;
        } catch (error) {
            const message = error?.message ?? `Failed to fetch versions for document "${documentId}".`;
            set({ isLoading: false, error: message });

            return [];
        }
    },

    fetchDocumentVersionById: async (id) => {
        set({ isLoading: true, error: null });

        try {
            let version = get().documentVersions.find((item) => item.id === id);

            if (!version) {
                version = await documentService.fetchDocumentVersionById(id);
            }

            set({ selectedVersion: version, isLoading: false, error: null });

            return version;
        } catch (error) {
            const message = error?.message ?? `Failed to fetch document version with ID "${id}".`;
            set({ isLoading: false, error: message });

            return null;
        }
    },

    insertDocumentVersion: async (payload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedPayload = mutationSchema.InsertDocumentVersionSchema.parse(payload);
            const newVersion = await documentService.insertDocumentVersion(validatedPayload);

            set((state) => ({
                documentVersions: [newVersion, ...state.documentVersions],
                isLoading: false,
                error: null,
            }));

            return newVersion;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to insert document version.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    updateDocumentVersion: async (id, payload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedPayload = mutationSchema.UpdateDocumentVersionSchema.parse(payload);
            const updatedVersion = await documentService.updateDocumentVersion(id, validatedPayload);

            set((state) => ({
                documentVersions: state.documentVersions.map((item) =>
                    item.id === id ? updatedVersion : item
                ),
                selectedVersion: state.selectedVersion?.id === id
                    ? updatedVersion
                    : state.selectedVersion,
                isLoading: false,
                error: null,
            }));

            return updatedVersion;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to update document version.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    deleteDocumentVersion: async (id) => {
        set({ isLoading: true, error: null });

        try {
            const isDeleted = await documentService.deleteDocumentVersion(id);

            if (isDeleted) {
                set((state) => ({
                    documentVersions: state.documentVersions.filter((item) => item.id !== id),
                    selectedVersion: state.selectedVersion?.id === id
                        ? null
                        : state.selectedVersion,
                    isLoading: false,
                    error: null,
                }));
            } else {
                set({ isLoading: false });
            }

            return isDeleted;
        } catch (error) {
            const message = error?.message ?? 'Failed to delete document version.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    // SHARES
    fetchDocumentShares: async (documentId) => {
        set({ isLoading: true, error: null });

        try {
            const shares = await documentService.fetchDocumentShares(documentId);
            set({ documentShares: shares, isLoading: false, error: null });

            return shares;
        } catch (error) {
            const message = error?.message ?? `Failed to fetch shares for document "${documentId}".`;
            set({ isLoading: false, error: message });

            return [];
        }
    },

    fetchDocumentSharesByDepartmentId: async (departmentId) => {
        set({ isLoading: true, error: null });

        try {
            const shares = await documentService.fetchDocumentSharesByDepartmentId(departmentId);
            set({ departmentDocumentShares: shares, isLoading: false, error: null });

            return shares;
        } catch (error) {
            const message = error?.message ?? `Failed to fetch shares for department "${departmentId}".`;
            set({ isLoading: false, error: message });

            return [];
        }
    },

    fetchDocumentSharesByRecipientId: async (recipientId) => {
        set({ isLoading: true, error: null });

        try {
            const shares = await documentService.fetchDocumentSharesByRecipientId(recipientId);
            set({ recipientDocumentShares: shares, isLoading: false, error: null });

            return shares;
        } catch (error) {
            const message = error?.message ?? `Failed to fetch shares for recipient "${recipientId}".`;
            set({ isLoading: false, error: message });

            return [];
        }
    },

    fetchDocumentShareById: async (id) => {
        set({ isLoading: true, error: null });

        try {
            let share = get().documentShares.find((item) => item.id === id);

            if (!share) {
                share = await documentService.fetchDocumentShareById(id);
            }

            set({ selectedDocumentShare: share, isLoading: false, error: null });

            return share;
        } catch (error) {
            const message = error?.message ?? `Failed to fetch document share with ID "${id}".`;
            set({ isLoading: false, error: message });

            return null;
        }
    },

    insertDocumentShare: async (payload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedPayload = mutationSchema.InsertDocumentShareSchema.parse(payload);
            const newShare = await documentService.insertDocumentShare(validatedPayload);

            set((state) => ({
                documentShares: [...state.documentShares, newShare],
                isLoading: false,
                error: null,
            }));

            return newShare;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to insert document share.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    updateDocumentShare: async (id, payload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedPayload = mutationSchema.UpdateDocumentShareSchema.parse(payload);
            const updatedShare = await documentService.updateDocumentShare(id, validatedPayload);

            set((state) => ({
                documentShares: state.documentShares.map((item) =>
                    item.id === id ? updatedShare : item
                ),
                isLoading: false,
                error: null,
            }));

            return updatedShare;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to update document share.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    deleteDocumentShare: async (id) => {
        set({ isLoading: true, error: null });

        try {
            const isDeleted = await documentService.deleteDocumentShare(id);

            if (isDeleted) {
                set((state) => ({
                    documentShares: state.documentShares.filter((item) => item.id !== id),
                    isLoading: false,
                    error: null,
                }));
            } else {
                set({ isLoading: false });
            }

            return isDeleted;
        } catch (error) {
            const message = error?.message ?? 'Failed to delete document share.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    // REQUESTS
    fetchDocumentRequests: async () => {
        set({ isLoading: true, error: null });

        try {
            const requests = await documentService.fetchDocumentRequests();
            set({ documentRequests: requests, isLoading: false, error: null });

            return requests;
        } catch (error) {
            const message = error?.message ?? 'Failed to fetch document requests.';
            set({ isLoading: false, error: message });

            return [];
        }
    },

    fetchDocumentRequestsByRequesterId: async (requesterId) => {
        set({ isLoading: true, error: null });

        try {
            const requests = await documentService.fetchDocumentRequestsByRequesterId(requesterId);
            set({ requesterDocumentRequests: requests, isLoading: false, error: null });

            return requests;
        } catch (error) {
            const message = error?.message ?? `Failed to fetch document requests for requester "${requesterId}".`;
            set({ isLoading: false, error: message });

            return [];
        }
    },

    fetchDocumentRequestById: async (id) => {
        set({ isLoading: true, error: null });

        try {
            let request = get().documentRequests.find((item) => item.id === id);

            if (!request) {
                request = await documentService.fetchDocumentRequestById(id);
            }

            set({ selectedDocumentRequest: request, isLoading: false, error: null });

            return request;
        } catch (error) {
            const message = error?.message ?? `Failed to fetch document request with ID "${id}".`;
            set({ isLoading: false, error: message });

            return null;
        }
    },

    insertDocumentRequest: async (payload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedPayload = mutationSchema.InsertDocumentRequestSchema.parse(payload);
            const newRequest = await documentService.insertDocumentRequest(validatedPayload);

            set((state) => ({
                documentRequests: [newRequest, ...state.documentRequests],
                isLoading: false,
                error: null,
            }));

            return newRequest;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to insert document request.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    updateDocumentRequest: async (id, payload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedPayload = mutationSchema.UpdateDocumentRequestSchema.parse(payload);
            const updatedRequest = await documentService.updateDocumentRequest(id, validatedPayload);

            set((state) => ({
                documentRequests: state.documentRequests.map((item) =>
                    item.id === id ? updatedRequest : item
                ),
                selectedDocumentRequest: state.selectedDocumentRequest?.id === id
                    ? updatedRequest
                    : state.selectedDocumentRequest,
                isLoading: false,
                error: null,
            }));

            return updatedRequest;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to update document request.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    deleteDocumentRequest: async (id) => {
        set({ isLoading: true, error: null });

        try {
            const isDeleted = await documentService.deleteDocumentRequest(id);

            if (isDeleted) {
                set((state) => ({
                    documentRequests: state.documentRequests.filter((item) => item.id !== id),
                    selectedDocumentRequest: state.selectedDocumentRequest?.id === id
                        ? null
                        : state.selectedDocumentRequest,
                    isLoading: false,
                    error: null,
                }));
            } else {
                set({ isLoading: false });
            }

            return isDeleted;
        } catch (error) {
            const message = error?.message ?? 'Failed to delete document request.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    // MESSAGES
    fetchDocumentRequestMessages: async (documentRequestId) => {
        set({ isLoading: true, error: null });

        try {
            const messages = await documentService.fetchDocumentRequestMessages(documentRequestId);
            set({ documentRequestMessages: messages, isLoading: false, error: null });

            return messages;
        } catch (error) {
            const message = error?.message ?? `Failed to fetch messages for request "${documentRequestId}".`;
            set({ isLoading: false, error: message });

            return [];
        }
    },

    insertDocumentRequestMessage: async (payload) => {
        set({ isLoading: true, error: null });

        try {
            const normalizedPayload = {
                documentRequestId: payload.documentRequestId ?? payload.document_request_id,
                userId: payload.userId ?? payload.user_id,
                message: payload.message,
                createdAt: payload.createdAt ?? payload.created_at,
            };
            const validatedPayload = mutationSchema.InsertDocumentRequestMessageSchema.parse(normalizedPayload);
            const newMessage = await documentService.insertDocumentRequestMessage(validatedPayload);

            set((state) => ({
                documentRequestMessages: [...state.documentRequestMessages, newMessage],
                isLoading: false,
                error: null,
            }));

            return newMessage;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to insert document request message.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    deleteDocumentRequestMessage: async (id) => {
        set({ isLoading: true, error: null });

        try {
            const isDeleted = await documentService.deleteDocumentRequestMessage(id);

            if (isDeleted) {
                set((state) => ({
                    documentRequestMessages: state.documentRequestMessages.filter((item) => item.id !== id),
                    isLoading: false,
                    error: null,
                }));
            } else {
                set({ isLoading: false });
            }

            return isDeleted;
        } catch (error) {
            const message = error?.message ?? 'Failed to delete document request message.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    // ATTACHMENTS
    fetchDocumentRequestAttachments: async (documentRequestId) => {
        set({ isLoading: true, error: null });

        try {
            const attachments = await documentService.fetchDocumentRequestAttachments(documentRequestId);
            set({ documentRequestAttachments: attachments, isLoading: false, error: null });

            return attachments;
        } catch (error) {
            const message = error?.message ?? `Failed to fetch attachments for request "${documentRequestId}".`;
            set({ isLoading: false, error: message });

            return [];
        }
    },

    insertDocumentRequestAttachment: async (payload) => {
        set({ isLoading: true, error: null });

        try {
            const normalizedPayload = {
                documentRequestId: payload.documentRequestId ?? payload.document_request_id,
                documentId: payload.documentId ?? payload.document_id,
                attachedById: payload.attachedById ?? payload.attached_by_id,
                createdAt: payload.createdAt ?? payload.created_at,
            };
            const validatedPayload = mutationSchema.InsertDocumentRequestAttachmentSchema.parse(normalizedPayload);
            const newAttachment = await documentService.insertDocumentRequestAttachment(validatedPayload);

            set((state) => ({
                documentRequestAttachments: [...state.documentRequestAttachments, newAttachment],
                isLoading: false,
                error: null,
            }));

            return newAttachment;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to insert document request attachment.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    deleteDocumentRequestAttachment: async (id) => {
        set({ isLoading: true, error: null });

        try {
            const isDeleted = await documentService.deleteDocumentRequestAttachment(id);

            if (isDeleted) {
                set((state) => ({
                    documentRequestAttachments: state.documentRequestAttachments.filter((item) => item.id !== id),
                    isLoading: false,
                    error: null,
                }));
            } else {
                set({ isLoading: false });
            }

            return isDeleted;
        } catch (error) {
            const message = error?.message ?? 'Failed to delete document request attachment.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    // CONTROLS
    setSelectedDocument: (document) => {
        set({ selectedDocument: document });
    },

    setSelectedDocumentShare: (share) => {
        set({ selectedDocumentShare: share });
    },

    setSelectedVersion: (version) => {
        set({ selectedVersion: version });
    },

    setSelectedDocumentRequest: (request) => {
        set({ selectedDocumentRequest: request });
    },

    clearError: () => {
        set({ error: null });
    },
}));


// --- EXPORTS ---
export { useDocumentStore };
