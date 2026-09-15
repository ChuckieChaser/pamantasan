// --- IMPORTS ---
import { dataConnectService } from './dataConnectService';
import { storageService } from './storageService';
import { constants } from '../constants';


// --- SERVICES ---
const documentService = {
    // DOCUMENTS
    fetchDocuments: async (isArchived = null) => {
        try {
            let data;
            if (isArchived === null || isArchived === undefined) {
                data = await dataConnectService.executeQuery('FetchAllDocuments').catch(() => null);
                if (!data?.documents) {
                    data = await dataConnectService.executeQuery('FetchDocuments', { isArchived: false });
                }
            } else {
                data = await dataConnectService.executeQuery('FetchDocuments', { isArchived: isArchived });
            }
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
        const timestamp = payload.createdAt || new Date().toISOString();
        const updatedTimestamp = payload.updatedAt || timestamp;
        const data = await dataConnectService.executeMutation('InsertDocument', {
            parentId: payload.parentId ?? null,
            uploaderId: payload.uploaderId,
            name: payload.name,
            comment: payload.comment ?? null,
            isFolder: payload.isFolder ?? false,
            isArchived: payload.isArchived ?? false,
            directlyArchived: payload.directlyArchived ?? false,
            createdAt: timestamp,
            updatedAt: updatedTimestamp,
        });

        const raw = data?.document_insert ?? data?.documents_insert;
        const formatted = formatLiveDocument(raw);

        return {
            id: formatted?.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `doc-${Date.now()}`),
            parentId: payload.parentId ?? null,
            uploaderId: payload.uploaderId,
            name: payload.name,
            comment: payload.comment ?? null,
            isFolder: Boolean(payload.isFolder),
            isArchived: Boolean(payload.isArchived),
            directlyArchived: Boolean(payload.directlyArchived),
            createdAt: timestamp,
            updatedAt: updatedTimestamp,
        };
    },

    updateDocument: async (id, payload) => {
        const timestamp = payload.updatedAt || new Date().toISOString();
        let existing = null;
        try {
            existing = await documentService.fetchDocumentById(id);
        } catch (e) {
            console.warn('fetchDocumentById failed during updateDocument merge:', e);
        }

        const merged = {
            parentId: payload.parentId !== undefined ? payload.parentId : (existing?.parentId ?? null),
            name: payload.name !== undefined ? payload.name : (existing?.name ?? ''),
            comment: payload.comment !== undefined ? payload.comment : (existing?.comment ?? null),
            isFolder: payload.isFolder !== undefined ? payload.isFolder : Boolean(existing?.isFolder),
            isArchived: payload.isArchived !== undefined ? payload.isArchived : Boolean(existing?.isArchived),
            directlyArchived: payload.directlyArchived !== undefined ? payload.directlyArchived : Boolean(existing?.directlyArchived),
            updatedAt: timestamp,
        };

        const data = await dataConnectService.executeMutation('UpdateDocument', {
            id: id,
            parentId: merged.parentId,
            name: merged.name,
            comment: merged.comment,
            isFolder: merged.isFolder,
            isArchived: merged.isArchived,
            directlyArchived: merged.directlyArchived,
            updatedAt: timestamp,
        });

        const raw = data?.document_update ?? data?.documents_update;
        const formatted = formatLiveDocument(raw);

        return {
            ...(existing || {}),
            id: formatted?.id ?? id,
            ...merged,
            updatedAt: timestamp,
        };
    },

    archiveDocumentRecursive: async (id, isArchived, allDocuments = []) => {
        // Collect id and all descendants
        const targetIds = [id];
        const queue = [id];
        while (queue.length > 0) {
            const currentParent = queue.shift();
            const children = allDocuments.filter(
                (d) => (d.parent?.id ?? d.parentId) === currentParent
            );
            for (const child of children) {
                if (!isArchived) {
                    // UNARCHIVE RULE: If child was directly archived independently, do NOT unarchive it
                    if (child.directlyArchived) {
                        continue;
                    }
                }
                targetIds.push(child.id);
                if (child.isFolder) {
                    queue.push(child.id);
                }
            }
        }

        // Update all documents in parallel with deterministic directlyArchived state
        await Promise.all(
            targetIds.map((docId) => {
                const doc = allDocuments.find((d) => d.id === docId);
                let directlyArchivedVal = false;
                if (isArchived) {
                    // Explicit target is directlyArchived = true.
                    // Descendant that was ALREADY directly archived preserves directlyArchived = true.
                    // Active descendants being cascade-archived receive directlyArchived = false.
                    directlyArchivedVal = (docId === id) || Boolean(doc?.isArchived && doc?.directlyArchived);
                } else {
                    directlyArchivedVal = false;
                }

                return dataConnectService.executeMutation('UpdateDocument', {
                    id: docId,
                    isArchived: isArchived,
                    directlyArchived: directlyArchivedVal,
                    updatedAt: new Date().toISOString(),
                }).catch((err) => console.warn(`Failed to archive doc ${docId}:`, err));
            })
        );

        return targetIds;
    },

    deleteDocument: async (id) => {
        try {
            // Clean up storage binaries for all versions to maintain 100% database & storage integrity
            const versions = await documentService.fetchDocumentVersions(id);
            for (const ver of versions) {
                if (ver.path) {
                    await storageService.deleteDocument(ver.path).catch((err) =>
                        console.warn(`Failed to clean up storage path "${ver.path}":`, err)
                    );
                }
            }

            const data = await dataConnectService.executeMutation('DeleteDocument', { id: id });
            return Boolean(data?.document_delete ?? data?.documents_delete);
        } catch (error) {
            console.error(`Failed to delete document "${id}":`, error);
            throw error;
        }
    },

    deleteDocumentRecursive: async (id, allDocuments = []) => {
        // Collect id and all descendants
        const targetIds = [id];
        const queue = [id];
        while (queue.length > 0) {
            const currentParent = queue.shift();
            const children = allDocuments.filter(
                (d) => (d.parent?.id ?? d.parentId) === currentParent
            );
            for (const child of children) {
                targetIds.push(child.id);
                if (child.isFolder) {
                    queue.push(child.id);
                }
            }
        }

        // For each target document, purge storage binaries
        for (const docId of targetIds) {
            const versions = await documentService.fetchDocumentVersions(docId).catch(() => []);
            for (const ver of versions) {
                if (ver.path) {
                    await storageService.deleteDocument(ver.path).catch((err) =>
                        console.warn(`Failed to clean up storage path "${ver.path}":`, err)
                    );
                }
            }
        }

        // Delete records bottom-up (children first, then parents)
        const reverseOrder = [...targetIds].reverse();
        for (const docId of reverseOrder) {
            await dataConnectService.executeMutation('DeleteDocument', { id: docId }).catch((err) =>
                console.warn(`Failed to delete document row ${docId}:`, err)
            );
        }

        return targetIds;
    },

    // VERSIONS
    fetchAllDocumentVersions: async () => {
        try {
            const data = await dataConnectService.executeQuery('FetchAllDocumentVersions');
            const versions = data?.documentVersions ?? [];

            return versions.map(formatLiveDocumentVersion);
        } catch (error) {
            console.error('Failed to fetch all document versions from Firebase Data Connect:', error);
            return [];
        }
    },

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
        const timestamp = payload.createdAt || new Date().toISOString();
        const updatedTimestamp = payload.updatedAt || timestamp;
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
            embedding: payload.embedding ?? null,
            textHash: payload.textHash ?? null,
            createdAt: timestamp,
            updatedAt: updatedTimestamp,
        });

        const raw = data?.documentVersion_insert ?? data?.documentVersions_insert;
        const formatted = formatLiveDocumentVersion(raw);

        return {
            id: formatted?.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ver-${Date.now()}`),
            ...payload,
            createdAt: timestamp,
            updatedAt: updatedTimestamp,
        };
    },

    updateDocumentVersion: async (id, payload) => {
        const timestamp = payload.updatedAt || new Date().toISOString();
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
            embedding: payload.embedding !== undefined ? payload.embedding : undefined,
            textHash: payload.textHash,
            updatedAt: timestamp,
        });

        const raw = data?.documentVersion_update ?? data?.documentVersions_update;
        const formatted = formatLiveDocumentVersion(raw);

        return {
            id: formatted?.id ?? id,
            ...payload,
            updatedAt: timestamp,
        };
    },

    deleteDocumentVersion: async (id) => {
        const data = await dataConnectService.executeMutation('DeleteDocumentVersion', { id: id });
        return Boolean(data?.documentVersion_delete ?? data?.documentVersions_delete);
    },

    revertDocumentVersion: async (documentId, targetVersion, uploaderId) => {
        const timestamp = new Date().toISOString();
        const versions = await documentService.fetchDocumentVersions(documentId);
        const maxVer = versions.length > 0 ? Math.max(...versions.map((v) => v.version || 1)) : 1;
        const nextVersion = maxVer + 1;

        const newVersion = await documentService.insertDocumentVersion({
            documentId: documentId,
            uploaderId: uploaderId,
            version: nextVersion,
            checksum: targetVersion.checksum ?? null,
            path: targetVersion.path,
            sizeBytes: targetVersion.sizeBytes,
            mimeType: targetVersion.mimeType || 'application/octet-stream',
            classification: targetVersion.classification || constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED,
            changeSummary: `Reverted to version v${targetVersion.version}.0`,
            summary: targetVersion.summary ?? '',
            createdAt: timestamp,
            updatedAt: timestamp,
        });

        await documentService.updateDocument(documentId, {
            updatedAt: timestamp,
        }).catch(() => null);

        return newVersion;
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

    const parentId = typeof rawDocument.parent === 'object'
        ? rawDocument.parent?.id
        : (rawDocument.parentId ?? rawDocument.parent ?? null);

    return {
        id: rawDocument.id,
        parent: rawDocument.parent,
        parentId: parentId,
        uploader: rawDocument.uploader,
        name: rawDocument.name,
        comment: rawDocument.comment,
        isFolder: Boolean(rawDocument.isFolder),
        isArchived: Boolean(rawDocument.isArchived),
        directlyArchived: Boolean(rawDocument.directlyArchived ?? rawDocument.directly_archived ?? false),
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
        sizeBytes: rawVersion.sizeBytes != null ? Number(rawVersion.sizeBytes) : 0,
        mimeType: rawVersion.mimeType,
        classification: rawVersion.classification,
        changeSummary: rawVersion.changeSummary,
        rejectionReason: rawVersion.rejectionReason,
        summary: rawVersion.summary,
        embedding: rawVersion.embedding ?? null,
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
