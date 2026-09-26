// --- IMPORTS ---
import { executeDataQuery, executeDataMutation } from '../../services/dataConnectService';
import { CreateFileSchema, CreateFolderSchema, UpdateDocumentSchema, UpdateDocumentsSchema, DeleteDocumentsSchema, CreateDocumentVersionSchema, UpdateDocumentVersionSchema, UpdateDocumentVersionsSchema, CreateDocumentShareSchema, CreateDocumentSharesSchema, UpdateDocumentShareSchema, DeleteDocumentSharesSchema } from './documentSchema';


// --- DOCUMENT SERVICES ---
export const getDocumentsByParentId = async ({
    search = '',
    parentId = null,
    isArchived = false,
    classifications,
    orderBy = [{ isFolder: 'DESC' }, { name: 'ASC' }],
    limit = 100,
    offset = 0,
} = {}) => {
    const data = await executeDataQuery('GetDocumentsByParentId', {
        search,
        parentId,
        isArchived,
        classifications,
        orderBy,
        limit,
        offset,
    });

    return data?.documents ?? [];
};

export const getDocumentsByIsArchived = async ({
    search = '',
    isArchived = true,
    classifications,
    orderBy = [{ updatedAt: 'DESC' }],
    limit = 100,
    offset = 0,
} = {}) => {
    const data = await executeDataQuery('GetDocumentsByIsArchived', {
        search,
        isArchived,
        classifications,
        orderBy,
        limit,
        offset,
    });

    return data?.documents ?? [];
};

export const getDocumentById = async (id) => {
    if (!id) return null;

    const data = await executeDataQuery('GetDocumentById', { id });
    const documents = data?.documents ?? [];

    return documents[0] ?? null;
};

export const createFile = async (payload) => {
    const validated = CreateFileSchema.parse(payload);

    const data = await executeDataMutation('CreateFile', {
        id: validated.id,
        parentId: validated.parentId ?? null,
        name: validated.name,
        comment: validated.comment ?? null,
        uploaderId: validated.uploaderId,
        checksum: validated.checksum ?? null,
        path: validated.path,
        sizeBytes: validated.sizeBytes,
        mimeType: validated.mimeType,
        classification: validated.classification,
    });

    return data?.document_insert ?? null;
};

export const createFolder = async (payload) => {
    const validated = CreateFolderSchema.parse(payload);

    const data = await executeDataMutation('CreateFolder', {
        parentId: validated.parentId ?? null,
        name: validated.name,
        comment: validated.comment ?? null,
    });

    return data?.document_insert ?? null;
};

export const updateDocument = async (id, payload) => {
    if (!id) {
        throw new Error('Document ID is required for update.');
    }

    const validated = UpdateDocumentSchema.parse({ ...payload, id });

    const data = await executeDataMutation('UpdateDocument', {
        id: validated.id,
        parentId: validated.parentId,
        name: validated.name,
        comment: validated.comment,
        isArchived: validated.isArchived,
        isDirectlyArchived: validated.isDirectlyArchived,
        updatedAt: validated.updatedAt ?? new Date().toISOString(),
    });

    return data?.document_update ?? null;
};

export const updateDocuments = async (ids, payload = {}) => {
    const validated = UpdateDocumentsSchema.parse({ ...payload, ids });

    const data = await executeDataMutation('UpdateDocuments', {
        ids: validated.ids,
        parentId: validated.parentId,
        comment: validated.comment,
        isArchived: validated.isArchived,
        isDirectlyArchived: validated.isDirectlyArchived,
        updatedAt: validated.updatedAt ?? new Date().toISOString(),
    });

    return data?.document_updateMany ?? null;
};

export const deleteDocuments = async (ids) => {
    const validated = DeleteDocumentsSchema.parse({ ids });

    const data = await executeDataMutation('DeleteDocuments', {
        ids: validated.ids,
    });

    return data?.document_deleteMany ?? null;
};


// --- DOCUMENT VERSION SERVICES ---
export const getDocumentVersionsByDocumentId = async (documentId) => {
    if (!documentId) return [];

    const data = await executeDataQuery('GetDocumentVersionsByDocumentId', {
        documentId,
    });

    return data?.documentVersions ?? [];
};

export const createDocumentVersion = async (payload) => {
    const validated = CreateDocumentVersionSchema.parse(payload);

    const data = await executeDataMutation('CreateDocumentVersion', {
        documentId: validated.documentId,
        uploaderId: validated.uploaderId,
        version: validated.version,
        checksum: validated.checksum ?? null,
        path: validated.path,
        sizeBytes: validated.sizeBytes,
        mimeType: validated.mimeType,
        classification: validated.classification,
        changeSummary: validated.changeSummary ?? null,
    });

    return data?.documentVersion_insert ?? null;
};

export const updateDocumentVersion = async (id, payload) => {
    if (!id) {
        throw new Error('Document version ID is required for update.');
    }

    const validated = UpdateDocumentVersionSchema.parse({ ...payload, id });

    const data = await executeDataMutation('UpdateDocumentVersion', {
        id: validated.id,
        reviewerId: validated.reviewerId,
        publisherId: validated.publisherId,
        mimeType: validated.mimeType,
        classification: validated.classification,
        contentSummary: validated.contentSummary,
        changeSummary: validated.changeSummary,
        rejectionReason: validated.rejectionReason,
        updatedAt: validated.updatedAt ?? new Date().toISOString(),
    });

    return data?.documentVersion_update ?? null;
};

export const updateDocumentVersions = async (ids, payload = {}) => {
    const validated = UpdateDocumentVersionsSchema.parse({ ...payload, ids });

    const data = await executeDataMutation('UpdateDocumentVersions', {
        ids: validated.ids,
        reviewerId: validated.reviewerId,
        publisherId: validated.publisherId,
        rejectionReason: validated.rejectionReason,
        updatedAt: validated.updatedAt ?? new Date().toISOString(),
    });

    return data?.documentVersion_updateMany ?? null;
};


// --- DOCUMENT SHARE SERVICES ---
export const getDocumentSharesByDocumentId = async (documentId) => {
    if (!documentId) return [];

    const data = await executeDataQuery('GetDocumentSharesByDocumentId', {
        documentId,
    });

    return data?.documentShares ?? [];
};

export const getDocumentSharesByDepartmentId = async (departmentId) => {
    if (!departmentId) return [];

    const data = await executeDataQuery('GetDocumentSharesByDepartmentId', {
        departmentId,
    });

    return data?.documentShares ?? [];
};

export const getDocumentSharesByRecipientId = async (recipientId) => {
    if (!recipientId) return [];

    const data = await executeDataQuery('GetDocumentSharesByRecipientId', {
        recipientId,
    });

    return data?.documentShares ?? [];
};

export const createDocumentShare = async (payload) => {
    const validated = CreateDocumentShareSchema.parse(payload);

    const data = await executeDataMutation('CreateDocumentShare', {
        documentId: validated.documentId,
        sharerId: validated.sharerId,
        recipientId: validated.recipientId ?? null,
        departmentId: validated.departmentId,
    });

    return data?.documentShare_insert ?? null;
};

export const createDocumentShares = async (dataList) => {
    const validated = CreateDocumentSharesSchema.parse(dataList);

    const data = await executeDataMutation('CreateDocumentShares', {
        data: validated.map((item) => ({
            documentId: item.documentId,
            sharerId: item.sharerId,
            recipientId: item.recipientId ?? null,
            departmentId: item.departmentId,
        })),
    });

    return data?.documentShare_insertMany ?? null;
};

export const updateDocumentShare = async (id, payload) => {
    if (!id) {
        throw new Error('Share ID is required for update.');
    }

    const validated = UpdateDocumentShareSchema.parse({ ...payload, id });

    const data = await executeDataMutation('UpdateDocumentShare', {
        id: validated.id,
        recipientId: validated.recipientId,
        departmentId: validated.departmentId,
        status: validated.status,
        updatedAt: validated.updatedAt ?? new Date().toISOString(),
    });

    return data?.documentShare_update ?? null;
};

export const deleteDocumentShares = async (ids) => {
    const validated = DeleteDocumentSharesSchema.parse({ ids });

    const data = await executeDataMutation('DeleteDocumentShares', {
        ids: validated.ids,
    });

    return data?.documentShare_deleteMany ?? null;
};
