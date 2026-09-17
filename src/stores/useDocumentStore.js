// --- IMPORTS ---
import { create } from 'zustand';

import { constants } from '../constants';
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

export const getRecursiveDescendantDocIds = (rootDocId, allDocuments = []) => {
    if (!rootDocId) return [];
    const targetIds = [rootDocId];
    const queue = [rootDocId];
    while (queue.length > 0) {
        const currentParent = queue.shift();
        const children = allDocuments.filter(
            (d) => (d.parent?.id ?? d.parentId ?? d.parentFolderId) === currentParent
        );
        for (const child of children) {
            targetIds.push(child.id);
            if (child.isFolder) {
                queue.push(child.id);
            }
        }
    }
    return targetIds;
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
    shareModalDocument: null,
    publishModalDocument: null,
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
            const existing = (get().documentShares || []).find((item) => item.id === id);
            const deptId = payload.departmentId || existing?.department?.id || existing?.departmentId;
            const recId = payload.recipientId !== undefined ? payload.recipientId : (existing?.recipient?.id ?? existing?.recipientId ?? null);
            const validatedPayload = mutationSchema.UpdateDocumentShareSchema.parse({
                ...payload,
                departmentId: deptId,
                recipientId: recId,
            });
            const updatedShare = await documentService.updateDocumentShare(id, validatedPayload);

            const merged = {
                ...existing,
                ...updatedShare,
                departmentId: deptId ?? updatedShare.departmentId,
                department: updatedShare.department ?? existing?.department ?? (deptId ? { id: deptId } : null),
                recipientId: recId,
                recipient: updatedShare.recipient ?? existing?.recipient ?? (recId ? { id: recId } : null),
                documentId: existing?.documentId ?? existing?.document?.id,
                document: existing?.document ?? null,
            };

            set((state) => ({
                documentShares: state.documentShares.map((item) =>
                    item.id === id ? merged : item
                ),
                isLoading: false,
                error: null,
            }));

            return merged;
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

    setShareModalDocument: (doc) => {
        set({ shareModalDocument: doc });
    },

    setPublishModalDocument: (doc) => {
        set({ publishModalDocument: doc });
    },

    syncAllDocumentShares: async (currentUser, departments = []) => {
        try {
            if (!currentUser) return [];

            const isStaff = constants.isStaffRole(currentUser.role);

            if (isStaff) {
                const deptsToFetch = departments && departments.length > 0 ? departments : [];
                const results = await Promise.allSettled(
                    deptsToFetch.map((dept) => documentService.fetchDocumentSharesByDepartmentId(dept.id))
                );

                const aggregatedShares = [];
                const shareIdSet = new Set();

                results.forEach((result) => {
                    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
                        result.value.forEach((share) => {
                            if (!shareIdSet.has(share.id)) {
                                shareIdSet.add(share.id);
                                aggregatedShares.push(share);
                            }
                        });
                    }
                });

                set({ documentShares: aggregatedShares });
                return aggregatedShares;
            }

            if (currentUser.departmentId) {
                const shares = await documentService.fetchDocumentSharesByDepartmentId(currentUser.departmentId);
                set({ documentShares: shares, departmentDocumentShares: shares });
                return shares;
            }

            return [];
        } catch (error) {
            console.error('Failed to synchronize document shares:', error);
            return [];
        }
    },

    shareDocument: async (documentId, departmentId, sharerId) => {
        try {
            const timestamp = new Date().toISOString();
            const newShare = await documentService.insertDocumentShare({
                documentId,
                departmentId,
                sharerId,
                status: constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL,
                createdAt: timestamp,
                updatedAt: timestamp,
            });

            if (newShare) {
                set((state) => ({
                    documentShares: [
                        ...state.documentShares.filter((item) => item.id !== newShare.id),
                        newShare,
                    ],
                }));
            }

            return newShare;
        } catch (error) {
            console.error('Failed to share document:', error);
            throw error;
        }
    },

    shareDocumentRecursive: async (rootDocId, departmentIds = [], sharerId) => {
        try {
            const allDocs = get().documents || [];
            const targetDoc = allDocs.find((d) => d.id === rootDocId);
            const targetDocIds = targetDoc?.isFolder
                ? getRecursiveDescendantDocIds(rootDocId, allDocs)
                : [rootDocId];

            const deptIdList = Array.isArray(departmentIds) ? departmentIds : [departmentIds];
            const currentShares = get().documentShares || [];
            const timestamp = new Date().toISOString();

            const sharesToCreate = [];
            for (const deptId of deptIdList) {
                for (const docId of targetDocIds) {
                    const alreadyShared = currentShares.some(
                        (s) =>
                            (s.document?.id ?? s.documentId) === docId &&
                            (s.department?.id ?? s.departmentId) === deptId
                    );
                    if (!alreadyShared) {
                        sharesToCreate.push({
                            documentId: docId,
                            departmentId: deptId,
                            sharerId,
                            status: constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL,
                            createdAt: timestamp,
                            updatedAt: timestamp,
                        });
                    }
                }
            }

            if (sharesToCreate.length === 0) {
                return [];
            }

            const createdShares = [];
            const results = await Promise.allSettled(
                sharesToCreate.map((payload) => documentService.insertDocumentShare(payload))
            );

            results.forEach((res) => {
                if (res.status === 'fulfilled' && res.value) {
                    createdShares.push(res.value);
                }
            });

            if (createdShares.length > 0) {
                set((state) => ({
                    documentShares: [
                        ...state.documentShares.filter(
                            (s) => !createdShares.some((cs) => cs.id === s.id)
                        ),
                        ...createdShares,
                    ],
                }));
            }

            return createdShares;
        } catch (error) {
            console.error('Failed to share document recursively:', error);
            throw error;
        }
    },

    unshareDocumentRecursive: async (rootDocId, departmentId) => {
        try {
            const allDocs = get().documents || [];
            const targetDoc = allDocs.find((d) => d.id === rootDocId);
            const targetDocIds = targetDoc?.isFolder
                ? getRecursiveDescendantDocIds(rootDocId, allDocs)
                : [rootDocId];

            const currentShares = get().documentShares || [];
            const sharesToDelete = currentShares.filter(
                (s) =>
                    targetDocIds.includes(s.document?.id ?? s.documentId) &&
                    (s.department?.id ?? s.departmentId) === departmentId
            );

            if (sharesToDelete.length === 0) {
                return 0;
            }

            const results = await Promise.allSettled(
                sharesToDelete.map((s) => documentService.deleteDocumentShare(s.id))
            );

            const deletedIds = new Set();
            results.forEach((res, idx) => {
                if (res.status === 'fulfilled' && res.value) {
                    deletedIds.add(sharesToDelete[idx].id);
                }
            });

            set((state) => ({
                documentShares: state.documentShares.filter((s) => !deletedIds.has(s.id)),
            }));

            return deletedIds.size;
        } catch (error) {
            console.error('Failed to recursively unshare document:', error);
            throw error;
        }
    },

    unshareDocument: async (shareId) => {
        try {
            const isDeleted = await documentService.deleteDocumentShare(shareId);
            if (isDeleted) {
                set((state) => ({
                    documentShares: state.documentShares.filter((item) => item.id !== shareId),
                }));
            }
            return isDeleted;
        } catch (error) {
            console.error('Failed to unshare document:', error);
            throw error;
        }
    },

    updateShareStatusRecursive: async (rootDocId, departmentId, nextStatus) => {
        try {
            const allDocs = get().documents || [];
            const targetDoc = allDocs.find((d) => d.id === rootDocId);
            const targetDocIds = targetDoc?.isFolder
                ? getRecursiveDescendantDocIds(rootDocId, allDocs)
                : [rootDocId];

            const currentShares = get().documentShares || [];
            const sharesToUpdate = currentShares.filter(
                (s) =>
                    targetDocIds.includes(s.document?.id ?? s.documentId) &&
                    (s.department?.id ?? s.departmentId) === departmentId
            );

            if (sharesToUpdate.length === 0) {
                return [];
            }

            const timestamp = new Date().toISOString();
            await Promise.allSettled(
                sharesToUpdate.map((s) => {
                    const deptId = s.department?.id ?? s.departmentId ?? departmentId;
                    const recId = s.recipient?.id ?? s.recipientId;
                    return documentService.updateDocumentShare(s.id, {
                        status: nextStatus,
                        departmentId: deptId,
                        recipientId: recId,
                        updatedAt: timestamp,
                    });
                })
            );

            const targetShareIds = new Set(sharesToUpdate.map((s) => s.id));
            set((state) => ({
                documentShares: state.documentShares.map((item) => {
                    if (targetShareIds.has(item.id)) {
                        const deptId = item.department?.id ?? item.departmentId ?? departmentId;
                        return {
                            ...item,
                            status: nextStatus,
                            departmentId: deptId,
                            department: item.department ?? (deptId ? { id: deptId } : null),
                            updatedAt: timestamp,
                        };
                    }
                    return item;
                }),
            }));

            return sharesToUpdate.map((s) => ({
                ...s,
                status: nextStatus,
                updatedAt: timestamp,
            }));
        } catch (error) {
            console.error('Failed to update share status recursively:', error);
            throw error;
        }
    },

    publishDocumentToMembers: async (rootDocId, departmentId, targetMemberIds = [], publisherId) => {
        try {
            const allDocs = get().documents || [];
            const targetDoc = allDocs.find((d) => d.id === rootDocId);
            const targetDocIds = targetDoc?.isFolder
                ? getRecursiveDescendantDocIds(rootDocId, allDocs)
                : [rootDocId];

            const currentShares = get().documentShares || [];
            const timestamp = new Date().toISOString();

            if (!targetMemberIds || targetMemberIds.length === 0) {
                // 1. PUBLISH TO ALL DEPARTMENT MEMBERS
                const sharesToUpdate = currentShares.filter(
                    (s) =>
                        targetDocIds.includes(s.document?.id ?? s.documentId) &&
                        (s.department?.id ?? s.departmentId) === departmentId &&
                        !s.recipientId &&
                        !s.recipient
                );

                const updatedBaseShares = [];
                for (const s of sharesToUpdate) {
                    await documentService.updateDocumentShare(s.id, {
                        status: constants.DOCUMENT_SHARES_STATUS.PUBLISHED,
                        departmentId: departmentId,
                        recipientId: null,
                        updatedAt: timestamp,
                    });
                    updatedBaseShares.push({
                        ...s,
                        status: constants.DOCUMENT_SHARES_STATUS.PUBLISHED,
                        departmentId: departmentId,
                        department: s.department ?? (departmentId ? { id: departmentId } : null),
                        recipientId: null,
                        recipient: null,
                        updatedAt: timestamp,
                    });
                }

                const existingBaseDocIds = new Set(sharesToUpdate.map((s) => s.document?.id ?? s.documentId));
                for (const docId of targetDocIds) {
                    if (!existingBaseDocIds.has(docId)) {
                        const newShare = await documentService.insertDocumentShare({
                            documentId: docId,
                            departmentId: departmentId,
                            sharerId: publisherId,
                            recipientId: null,
                            status: constants.DOCUMENT_SHARES_STATUS.PUBLISHED,
                            createdAt: timestamp,
                            updatedAt: timestamp,
                        });
                        if (newShare) {
                            updatedBaseShares.push({
                                ...newShare,
                                documentId: docId,
                                departmentId: departmentId,
                            });
                        }
                    }
                }

                // Delete any existing member-specific shares to revert to broad access
                const existingSpecificShares = currentShares.filter(
                    (s) =>
                        targetDocIds.includes(s.document?.id ?? s.documentId) &&
                        (s.department?.id ?? s.departmentId) === departmentId &&
                        (s.recipient?.id ?? s.recipientId)
                );
                for (const ess of existingSpecificShares) {
                    await documentService.deleteDocumentShare(ess.id);
                }
                const removedSpecificIds = new Set(existingSpecificShares.map((s) => s.id));

                set((state) => ({
                    documentShares: [
                        ...state.documentShares
                            .filter((s) => !removedSpecificIds.has(s.id))
                            .map((s) => {
                                const found = updatedBaseShares.find((u) => u.id === s.id);
                                return found ? found : s;
                            }),
                        ...updatedBaseShares.filter((u) => !state.documentShares.some((s) => s.id === u.id)),
                    ],
                }));

                return updatedBaseShares;
            } else {
                // 2. PUBLISH TO SPECIFIC MEMBERS
                const createdOrUpdatedShares = [];

                // Keep base departmental share updated to PUBLISHED (for Officer & Director visibility)
                const baseShares = currentShares.filter(
                    (s) =>
                        targetDocIds.includes(s.document?.id ?? s.documentId) &&
                        (s.department?.id ?? s.departmentId) === departmentId &&
                        !s.recipientId &&
                        !s.recipient
                );
                for (const bs of baseShares) {
                    await documentService.updateDocumentShare(bs.id, {
                        status: constants.DOCUMENT_SHARES_STATUS.PUBLISHED,
                        departmentId: departmentId,
                        recipientId: null,
                        updatedAt: timestamp,
                    });
                    createdOrUpdatedShares.push({
                        ...bs,
                        status: constants.DOCUMENT_SHARES_STATUS.PUBLISHED,
                        departmentId: departmentId,
                        department: bs.department ?? (departmentId ? { id: departmentId } : null),
                        recipientId: null,
                        recipient: null,
                        updatedAt: timestamp,
                    });
                }

                const existingBaseDocIds = new Set(baseShares.map((s) => s.document?.id ?? s.documentId));
                for (const docId of targetDocIds) {
                    if (!existingBaseDocIds.has(docId)) {
                        const newBase = await documentService.insertDocumentShare({
                            documentId: docId,
                            departmentId: departmentId,
                            sharerId: publisherId,
                            recipientId: null,
                            status: constants.DOCUMENT_SHARES_STATUS.PUBLISHED,
                            createdAt: timestamp,
                            updatedAt: timestamp,
                        });
                        if (newBase) {
                            createdOrUpdatedShares.push({
                                ...newBase,
                                documentId: docId,
                                departmentId: departmentId,
                                recipientId: null,
                            });
                        }
                    }
                }

                // Insert or update shares for each chosen member
                for (const memberId of targetMemberIds) {
                    for (const docId of targetDocIds) {
                        const existingMemberShare = currentShares.find(
                            (s) =>
                                (s.document?.id ?? s.documentId) === docId &&
                                (s.department?.id ?? s.departmentId) === departmentId &&
                                (s.recipient?.id ?? s.recipientId) === memberId
                        );

                        if (existingMemberShare) {
                            await documentService.updateDocumentShare(existingMemberShare.id, {
                                status: constants.DOCUMENT_SHARES_STATUS.PUBLISHED,
                                departmentId: departmentId,
                                recipientId: memberId,
                                updatedAt: timestamp,
                            });
                            createdOrUpdatedShares.push({
                                ...existingMemberShare,
                                status: constants.DOCUMENT_SHARES_STATUS.PUBLISHED,
                                departmentId: departmentId,
                                recipientId: memberId,
                                updatedAt: timestamp,
                            });
                        } else {
                            const inserted = await documentService.insertDocumentShare({
                                documentId: docId,
                                departmentId: departmentId,
                                recipientId: memberId,
                                sharerId: publisherId,
                                status: constants.DOCUMENT_SHARES_STATUS.PUBLISHED,
                                createdAt: timestamp,
                                updatedAt: timestamp,
                            });
                            if (inserted) {
                                createdOrUpdatedShares.push({
                                    ...inserted,
                                    documentId: docId,
                                    departmentId: departmentId,
                                    recipientId: memberId,
                                });
                            }
                        }
                    }
                }

                // Remove shares for members who are no longer selected
                const unselectedMemberShares = currentShares.filter(
                    (s) =>
                        targetDocIds.includes(s.document?.id ?? s.documentId) &&
                        (s.department?.id ?? s.departmentId) === departmentId &&
                        (s.recipient?.id ?? s.recipientId) &&
                        !targetMemberIds.includes(s.recipient?.id ?? s.recipientId)
                );
                for (const ums of unselectedMemberShares) {
                    await documentService.deleteDocumentShare(ums.id);
                }
                const removedIds = new Set(unselectedMemberShares.map((s) => s.id));

                set((state) => ({
                    documentShares: [
                        ...state.documentShares
                            .filter((s) => !removedIds.has(s.id))
                            .map((s) => {
                                const found = createdOrUpdatedShares.find((u) => u.id === s.id);
                                return found ? found : s;
                            }),
                        ...createdOrUpdatedShares.filter((u) => !state.documentShares.some((s) => s.id === u.id)),
                    ],
                }));

                return createdOrUpdatedShares;
            }
        } catch (error) {
            console.error('Failed to publish document to members:', error);
            throw error;
        }
    },

    approveShare: async (shareId) => {
        try {
            const existing = (get().documentShares || []).find((s) => s.id === shareId);
            const deptId = existing?.department?.id ?? existing?.departmentId;
            const recId = existing?.recipient?.id ?? existing?.recipientId;
            const timestamp = new Date().toISOString();

            await documentService.updateDocumentShare(shareId, {
                status: constants.DOCUMENT_SHARES_STATUS.APPROVED,
                departmentId: deptId,
                recipientId: recId,
                updatedAt: timestamp,
            });

            const merged = {
                ...existing,
                status: constants.DOCUMENT_SHARES_STATUS.APPROVED,
                departmentId: deptId,
                department: existing?.department ?? (deptId ? { id: deptId } : null),
                recipientId: recId,
                updatedAt: timestamp,
            };

            set((state) => ({
                documentShares: state.documentShares.map((item) =>
                    item.id === shareId ? merged : item
                ),
            }));

            return merged;
        } catch (error) {
            console.error('Failed to approve document share:', error);
            throw error;
        }
    },

    unapproveShare: async (shareId) => {
        try {
            const existing = (get().documentShares || []).find((s) => s.id === shareId);
            const deptId = existing?.department?.id ?? existing?.departmentId;
            const recId = existing?.recipient?.id ?? existing?.recipientId;
            const timestamp = new Date().toISOString();

            await documentService.updateDocumentShare(shareId, {
                status: constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL,
                departmentId: deptId,
                recipientId: recId,
                updatedAt: timestamp,
            });

            const merged = {
                ...existing,
                status: constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL,
                departmentId: deptId,
                department: existing?.department ?? (deptId ? { id: deptId } : null),
                recipientId: recId,
                updatedAt: timestamp,
            };

            set((state) => ({
                documentShares: state.documentShares.map((item) =>
                    item.id === shareId ? merged : item
                ),
            }));

            return merged;
        } catch (error) {
            console.error('Failed to unapprove document share:', error);
            throw error;
        }
    },

    rejectShare: async (shareId) => {
        try {
            const isDeleted = await documentService.deleteDocumentShare(shareId);
            if (isDeleted) {
                set((state) => ({
                    documentShares: state.documentShares.filter((item) => item.id !== shareId),
                }));
            }
            return isDeleted;
        } catch (error) {
            console.error('Failed to reject document share:', error);
            throw error;
        }
    },

    publishShare: async (shareId) => {
        try {
            const existing = (get().documentShares || []).find((s) => s.id === shareId);
            const deptId = existing?.department?.id ?? existing?.departmentId;
            const recId = existing?.recipient?.id ?? existing?.recipientId;
            const timestamp = new Date().toISOString();

            await documentService.updateDocumentShare(shareId, {
                status: constants.DOCUMENT_SHARES_STATUS.PUBLISHED,
                departmentId: deptId,
                recipientId: recId,
                updatedAt: timestamp,
            });

            const merged = {
                ...existing,
                status: constants.DOCUMENT_SHARES_STATUS.PUBLISHED,
                departmentId: deptId,
                department: existing?.department ?? (deptId ? { id: deptId } : null),
                recipientId: recId,
                updatedAt: timestamp,
            };

            set((state) => ({
                documentShares: state.documentShares.map((item) =>
                    item.id === shareId ? merged : item
                ),
            }));

            return merged;
        } catch (error) {
            console.error('Failed to publish document share:', error);
            throw error;
        }
    },

    unpublishShare: async (shareId) => {
        try {
            const existing = (get().documentShares || []).find((s) => s.id === shareId);
            const deptId = existing?.department?.id ?? existing?.departmentId;
            const recId = existing?.recipient?.id ?? existing?.recipientId;
            const timestamp = new Date().toISOString();

            await documentService.updateDocumentShare(shareId, {
                status: constants.DOCUMENT_SHARES_STATUS.APPROVED,
                departmentId: deptId,
                recipientId: recId,
                updatedAt: timestamp,
            });

            const merged = {
                ...existing,
                status: constants.DOCUMENT_SHARES_STATUS.APPROVED,
                departmentId: deptId,
                department: existing?.department ?? (deptId ? { id: deptId } : null),
                recipientId: recId,
                updatedAt: timestamp,
            };

            set((state) => ({
                documentShares: state.documentShares.map((item) =>
                    item.id === shareId ? merged : item
                ),
            }));

            return merged;
        } catch (error) {
            console.error('Failed to unpublish document share:', error);
            throw error;
        }
    },

    stashShare: async (shareId) => {
        try {
            const existing = (get().documentShares || []).find((s) => s.id === shareId);
            const deptId = existing?.department?.id ?? existing?.departmentId;
            const recId = existing?.recipient?.id ?? existing?.recipientId;
            const timestamp = new Date().toISOString();

            await documentService.updateDocumentShare(shareId, {
                status: constants.DOCUMENT_SHARES_STATUS.STASHED,
                departmentId: deptId,
                recipientId: recId,
                updatedAt: timestamp,
            });

            const merged = {
                ...existing,
                status: constants.DOCUMENT_SHARES_STATUS.STASHED,
                departmentId: deptId,
                department: existing?.department ?? (deptId ? { id: deptId } : null),
                recipientId: recId,
                updatedAt: timestamp,
            };

            set((state) => ({
                documentShares: state.documentShares.map((item) =>
                    item.id === shareId ? merged : item
                ),
            }));

            return merged;
        } catch (error) {
            console.error('Failed to stash document share:', error);
            throw error;
        }
    },

    unstashShare: async (shareId) => {
        try {
            const existing = (get().documentShares || []).find((s) => s.id === shareId);
            const deptId = existing?.department?.id ?? existing?.departmentId;
            const recId = existing?.recipient?.id ?? existing?.recipientId;
            const timestamp = new Date().toISOString();

            await documentService.updateDocumentShare(shareId, {
                status: constants.DOCUMENT_SHARES_STATUS.APPROVED,
                departmentId: deptId,
                recipientId: recId,
                updatedAt: timestamp,
            });

            const merged = {
                ...existing,
                status: constants.DOCUMENT_SHARES_STATUS.APPROVED,
                departmentId: deptId,
                department: existing?.department ?? (deptId ? { id: deptId } : null),
                recipientId: recId,
                updatedAt: timestamp,
            };

            set((state) => ({
                documentShares: state.documentShares.map((item) =>
                    item.id === shareId ? merged : item
                ),
            }));

            return merged;
        } catch (error) {
            console.error('Failed to unstash document share:', error);
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
            const timestamp = new Date().toISOString();
            const payloadWithUpdate = {
                ...payload,
                updatedAt: payload?.updatedAt ?? timestamp,
            };
            const validatedPayload = mutationSchema.UpdateDocumentRequestSchema.parse(payloadWithUpdate);
            const existingRequest = get().documentRequests.find((item) => item?.id === id) ?? {};

            const result = await documentService.updateDocumentRequest(id, validatedPayload);

            const cleanResult = Object.fromEntries(
                Object.entries(result || {}).filter(([_, v]) => v !== undefined && v !== null)
            );
            const cleanPayload = Object.fromEntries(
                Object.entries(validatedPayload || {}).filter(([_, v]) => v !== undefined)
            );

            const mergedRequest = {
                ...existingRequest,
                ...cleanPayload,
                ...cleanResult,
                id: id,
                updatedAt: validatedPayload.updatedAt ?? timestamp,
            };

            set((state) => ({
                documentRequests: state.documentRequests.map((item) =>
                    item?.id === id ? mergedRequest : item
                ),
                selectedDocumentRequest: state.selectedDocumentRequest?.id === id
                    ? mergedRequest
                    : state.selectedDocumentRequest,
                isLoading: false,
                error: null,
            }));

            get().fetchDocumentRequests().catch(() => {});

            return mergedRequest;
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
        try {
            const messages = await documentService.fetchDocumentRequestMessages(documentRequestId);
            set((state) => {
                const otherMessages = (state.documentRequestMessages ?? []).filter(
                    (item) => (item.documentRequest?.id ?? item.documentRequestId) !== documentRequestId
                );
                return {
                    documentRequestMessages: [...otherMessages, ...messages],
                    error: null,
                };
            });

            return messages;
        } catch (error) {
            const message = error?.message ?? `Failed to fetch messages for request "${documentRequestId}".`;
            set({ error: message });

            return [];
        }
    },

    insertDocumentRequestMessage: async (payload) => {
        try {
            const validatedPayload = mutationSchema.InsertDocumentRequestMessageSchema.parse({
                documentRequestId: payload.documentRequestId,
                userId: payload.userId,
                message: payload.message,
                createdAt: payload.createdAt,
            });
            const newMessage = await documentService.insertDocumentRequestMessage(validatedPayload);

            set((state) => ({
                documentRequestMessages: [...(state.documentRequestMessages ?? []), newMessage],
                error: null,
            }));

            // Background fetch to sync with server
            get().fetchDocumentRequestMessages(payload.documentRequestId).catch(() => {});

            return newMessage;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to insert document request message.';
            set({ error: message });

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
        try {
            const attachments = await documentService.fetchDocumentRequestAttachments(documentRequestId);
            set((state) => {
                const otherAttachments = (state.documentRequestAttachments ?? []).filter(
                    (item) => (item.documentRequest?.id ?? item.documentRequestId) !== documentRequestId
                );
                return {
                    documentRequestAttachments: [...otherAttachments, ...attachments],
                    error: null,
                };
            });

            return attachments;
        } catch (error) {
            const message = error?.message ?? `Failed to fetch attachments for request "${documentRequestId}".`;
            set({ error: message });

            return [];
        }
    },

    insertDocumentRequestAttachment: async (payload) => {
        try {
            const validatedPayload = mutationSchema.InsertDocumentRequestAttachmentSchema.parse({
                documentRequestId: payload.documentRequestId,
                documentId: payload.documentId,
                attachedById: payload.attachedById,
                createdAt: payload.createdAt,
            });
            const newAttachment = await documentService.insertDocumentRequestAttachment({
                ...validatedPayload,
                name: payload.name,
            });

            set((state) => ({
                documentRequestAttachments: [...(state.documentRequestAttachments ?? []), newAttachment],
                error: null,
            }));

            // Background fetch to sync with server
            get().fetchDocumentRequestAttachments(payload.documentRequestId).catch(() => {});

            return newAttachment;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to insert document request attachment.';
            set({ error: message });

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

