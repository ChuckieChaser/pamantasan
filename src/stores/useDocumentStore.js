// --- IMPORTS ---
import { create } from 'zustand';

import { mutationSchema } from '../schemas';
import { documentService } from '../services';


// --- CONFIGURATIONS ---
// Cleanup legacy client-side directly-archived key if it exists
try {
    localStorage.removeItem('pamantasan_directly_archived_ids');
} catch {}

const isAncestorArchived = (doc, allDocs = []) => {
    let parentId = doc.parentId ?? doc.parentFolderId;
    while (parentId && parentId !== 'root') {
        const parent = allDocs.find((d) => d.id === parentId);
        if (!parent) break;
        if (parent.isArchived) return true;
        parentId = parent.parentId ?? parent.parentFolderId;
    }
    return false;
};

const annotateDirectlyArchived = (docs = []) => {
    return docs.map((doc) => {
        if (!doc.isArchived) {
            return { ...doc, directlyArchived: false };
        }
        // Prioritize native database field, fallback to ancestor hierarchy check if unmigrated
        if (typeof doc.directlyArchived === 'boolean') {
            return doc;
        }
        return { ...doc, directlyArchived: !isAncestorArchived(doc, docs) };
    });
};


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
    fetchDocuments: async (isArchived = null) => {
        set({ isLoading: true, error: null });

        try {
            const [documents, versions] = await Promise.all([
                documentService.fetchDocuments(isArchived),
                documentService.fetchAllDocumentVersions().catch(() => []),
            ]);
            const annotated = annotateDirectlyArchived(documents);
            set({ documents: annotated, documentVersions: versions, isLoading: false, error: null });

            return annotated;
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
            const timestamp = new Date().toISOString();
            const existingDoc = get().documents.find((item) => item?.id === id);
            const payloadWithDates = {
                ...payload,
                updatedAt: payload?.updatedAt || timestamp,
            };
            const validatedPayload = mutationSchema.UpdateDocumentSchema.parse(payloadWithDates);
            const result = await documentService.updateDocument(id, validatedPayload);

            const updatedDocument = {
                ...existingDoc,
                ...validatedPayload,
                ...result,
                id: id,
                updatedAt: result?.updatedAt ?? validatedPayload.updatedAt ?? timestamp,
            };

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

    archiveDocument: async (id, isArchived) => {
        set({ isLoading: true, error: null });

        try {
            const allDocs = get().documents;
            const targetIds = await documentService.archiveDocumentRecursive(id, isArchived, allDocs);
            const timestamp = new Date().toISOString();

            set((state) => {
                const updatedDocs = state.documents.map((doc) => {
                    if (!targetIds.includes(doc.id)) return doc;
                    const isDirect = isArchived ? (doc.id === id || Boolean(doc.isArchived && doc.directlyArchived)) : false;
                    return {
                        ...doc,
                        isArchived: isArchived,
                        directlyArchived: isDirect,
                        updatedAt: timestamp,
                    };
                });

                const updatedSelected = state.selectedDocument && targetIds.includes(state.selectedDocument.id)
                    ? {
                          ...state.selectedDocument,
                          isArchived: isArchived,
                          directlyArchived: isArchived
                              ? (state.selectedDocument.id === id || Boolean(state.selectedDocument.isArchived && state.selectedDocument.directlyArchived))
                              : false,
                          updatedAt: timestamp,
                      }
                    : state.selectedDocument;

                return {
                    documents: updatedDocs,
                    selectedDocument: updatedSelected,
                    isLoading: false,
                    error: null,
                };
            });

            return targetIds;
        } catch (error) {
            const message = error?.message ?? 'Failed to archive document.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    deleteDocument: async (id) => {
        set({ isLoading: true, error: null });

        try {
            const allDocs = get().documents;
            const targetIds = await documentService.deleteDocumentRecursive(id, allDocs);

            set((state) => ({
                documents: state.documents.filter((item) => !targetIds.includes(item.id)),
                documentVersions: state.documentVersions.filter(
                    (v) => !targetIds.includes(v.document?.id ?? v.documentId)
                ),
                selectedDocument: state.selectedDocument && targetIds.includes(state.selectedDocument.id)
                    ? null
                    : state.selectedDocument,
                isLoading: false,
                error: null,
            }));

            return true;
        } catch (error) {
            const message = error?.message ?? 'Failed to delete document.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    // VERSIONS
    fetchAllDocumentVersions: async () => {
        try {
            const versions = await documentService.fetchAllDocumentVersions();
            set({ documentVersions: versions });
            return versions;
        } catch (error) {
            console.warn('Failed to fetch all document versions:', error);
            return [];
        }
    },

    fetchDocumentVersions: async (documentId) => {
        set({ isLoading: true, error: null });

        try {
            const versions = await documentService.fetchDocumentVersions(documentId);
            set((state) => {
                const otherVersions = state.documentVersions.filter(
                    (v) => (v.document?.id ?? v.documentId) !== documentId
                );
                return {
                    documentVersions: [...versions, ...otherVersions],
                    isLoading: false,
                    error: null,
                };
            });

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
            const timestamp = new Date().toISOString();
            const payloadWithDates = {
                createdAt: timestamp,
                updatedAt: timestamp,
                ...payload,
            };
            const validatedPayload = mutationSchema.InsertDocumentVersionSchema.parse(payloadWithDates);
            const newVersion = await documentService.insertDocumentVersion(validatedPayload);

            const docId = validatedPayload.documentId;
            if (docId) {
                await documentService.updateDocument(docId, { updatedAt: timestamp }).catch(() => null);
            }

            set((state) => ({
                documentVersions: [newVersion, ...state.documentVersions],
                documents: docId
                    ? state.documents.map((d) => (d.id === docId ? { ...d, updatedAt: timestamp } : d))
                    : state.documents,
                selectedDocument: (docId && state.selectedDocument?.id === docId)
                    ? { ...state.selectedDocument, updatedAt: timestamp }
                    : state.selectedDocument,
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
            const timestamp = new Date().toISOString();
            const payloadWithDates = {
                updatedAt: timestamp,
                ...payload,
            };
            const validatedPayload = mutationSchema.UpdateDocumentVersionSchema.parse(payloadWithDates);
            const updatedVersion = await documentService.updateDocumentVersion(id, validatedPayload);

            const docId = updatedVersion?.documentId ?? updatedVersion?.document?.id;
            if (docId) {
                await documentService.updateDocument(docId, { updatedAt: timestamp }).catch(() => null);
            }

            set((state) => ({
                documentVersions: state.documentVersions.map((item) =>
                    item.id === id ? updatedVersion : item
                ),
                documents: docId
                    ? state.documents.map((d) => (d.id === docId ? { ...d, updatedAt: timestamp } : d))
                    : state.documents,
                selectedDocument: (docId && state.selectedDocument?.id === docId)
                    ? { ...state.selectedDocument, updatedAt: timestamp }
                    : state.selectedDocument,
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

    revertDocumentVersion: async (documentId, targetVersion, uploaderId) => {
        set({ isLoading: true, error: null });

        try {
            const timestamp = new Date().toISOString();
            const newVersion = await documentService.revertDocumentVersion(documentId, targetVersion, uploaderId);

            set((state) => ({
                documentVersions: [newVersion, ...state.documentVersions],
                documents: state.documents.map((d) =>
                    d.id === documentId ? { ...d, updatedAt: timestamp } : d
                ),
                selectedDocument: state.selectedDocument?.id === documentId
                    ? { ...state.selectedDocument, updatedAt: timestamp }
                    : state.selectedDocument,
                isLoading: false,
                error: null,
            }));

            return newVersion;
        } catch (error) {
            const message = error?.message ?? 'Failed to revert document version.';
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
            const validatedPayload = mutationSchema.InsertDocumentRequestMessageSchema.parse({
                documentRequestId: payload.documentRequestId,
                userId: payload.userId,
                message: payload.message,
                createdAt: payload.createdAt,
            });
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
            const validatedPayload = mutationSchema.InsertDocumentRequestAttachmentSchema.parse({
                documentRequestId: payload.documentRequestId,
                documentId: payload.documentId,
                attachedById: payload.attachedById,
                createdAt: payload.createdAt,
            });
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
