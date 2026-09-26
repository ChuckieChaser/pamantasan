// --- IMPORTS ---
import { executeDataQuery, executeDataMutation } from '../../services/dataConnectService';
import { CreateRequestSchema, UpdateRequestSchema, UpdateRequestsSchema, DeleteRequestsSchema, CreateRequestMessageSchema, UpdateRequestMessageSchema, DeleteRequestMessagesSchema, CreateRequestAttachmentSchema, CreateRequestAttachmentsSchema, DeleteRequestAttachmentsSchema } from './requestSchema';


// --- REQUEST SERVICES ---
export const getRequests = async ({
    search = '',
    statuses,
    orderBy = [{ createdAt: 'DESC' }],
    limit = 100,
    offset = 0,
} = {}) => {
    const data = await executeDataQuery('GetRequests', {
        search,
        statuses,
        orderBy,
        limit,
        offset,
    });

    return data?.requests ?? [];
};

export const getRequestsByRequesterId = async ({
    search = '',
    requesterId,
    statuses,
    orderBy = [{ createdAt: 'DESC' }],
    limit = 100,
    offset = 0,
} = {}) => {
    if (!requesterId) {
        throw new Error('Requester ID is required to fetch user requests.');
    }

    const data = await executeDataQuery('GetRequestsByRequesterId', {
        search,
        requesterId,
        statuses,
        orderBy,
        limit,
        offset,
    });

    return data?.requests ?? [];
};

export const getRequestById = async (id) => {
    if (!id) return null;

    const data = await executeDataQuery('GetRequestById', { id });
    const requests = data?.requests ?? [];

    return requests[0] ?? null;
};

export const createRequest = async (payload) => {
    const validated = CreateRequestSchema.parse(payload);

    const data = await executeDataMutation('CreateRequest', {
        requesterId: validated.requesterId,
        reviewerId: validated.reviewerId ?? null,
        subject: validated.subject,
    });

    return data?.request_insert ?? null;
};

export const updateRequest = async (id, payload) => {
    if (!id) {
        throw new Error('Request ID is required for update.');
    }

    const validated = UpdateRequestSchema.parse({ ...payload, id });

    const data = await executeDataMutation('UpdateRequest', {
        id: validated.id,
        reviewerId: validated.reviewerId,
        subject: validated.subject,
        status: validated.status,
        updatedAt: validated.updatedAt ?? new Date().toISOString(),
    });

    return data?.request_update ?? null;
};

export const updateRequests = async (ids, payload = {}) => {
    const validated = UpdateRequestsSchema.parse({ ...payload, ids });

    const data = await executeDataMutation('UpdateRequests', {
        ids: validated.ids,
        reviewerId: validated.reviewerId,
        status: validated.status,
        updatedAt: validated.updatedAt ?? new Date().toISOString(),
    });

    return data?.request_updateMany ?? null;
};

export const deleteRequests = async (ids) => {
    const validated = DeleteRequestsSchema.parse({ ids });

    const data = await executeDataMutation('DeleteRequests', {
        ids: validated.ids,
    });

    return data?.request_deleteMany ?? null;
};


// --- REQUEST MESSAGE SERVICES ---
export const getRequestMessagesByRequestId = async (requestId) => {
    if (!requestId) return [];

    const data = await executeDataQuery('GetRequestMessagesByRequestId', {
        requestId,
    });

    return data?.requestMessages ?? [];
};

export const createRequestMessage = async (payload) => {
    const validated = CreateRequestMessageSchema.parse(payload);

    const data = await executeDataMutation('CreateRequestMessage', {
        requestId: validated.requestId,
        userId: validated.userId ?? null,
        message: validated.message,
    });

    return data?.requestMessage_insert ?? null;
};

export const updateRequestMessage = async (id, payload) => {
    if (!id) {
        throw new Error('Message ID is required for update.');
    }

    const validated = UpdateRequestMessageSchema.parse({ ...payload, id });

    const data = await executeDataMutation('UpdateRequestMessage', {
        id: validated.id,
        message: validated.message,
        updatedAt: validated.updatedAt ?? new Date().toISOString(),
    });

    return data?.requestMessage_update ?? null;
};

export const deleteRequestMessages = async (ids) => {
    const validated = DeleteRequestMessagesSchema.parse({ ids });

    const data = await executeDataMutation('DeleteRequestMessages', {
        ids: validated.ids,
    });

    return data?.requestMessage_deleteMany ?? null;
};


// --- REQUEST ATTACHMENT SERVICES ---
export const getRequestAttachmentsByRequestId = async (requestId) => {
    if (!requestId) return [];

    const data = await executeDataQuery('GetRequestAttachmentsByRequestId', {
        requestId,
    });

    return data?.requestAttachments ?? [];
};

export const createRequestAttachment = async (payload) => {
    const validated = CreateRequestAttachmentSchema.parse(payload);

    const data = await executeDataMutation('CreateRequestAttachment', {
        requestId: validated.requestId,
        messageId: validated.messageId ?? null,
        documentId: validated.documentId,
        attacherId: validated.attacherId,
    });

    return data?.requestAttachment_insert ?? null;
};

export const createRequestAttachments = async (dataList) => {
    const validated = CreateRequestAttachmentsSchema.parse(dataList);

    const data = await executeDataMutation('CreateRequestAttachments', {
        data: validated.map((item) => ({
            requestId: item.requestId,
            messageId: item.messageId ?? null,
            documentId: item.documentId,
            attacherId: item.attacherId,
        })),
    });

    return data?.requestAttachment_insertMany ?? null;
};

export const deleteRequestAttachments = async (ids) => {
    const validated = DeleteRequestAttachmentsSchema.parse({ ids });

    const data = await executeDataMutation('DeleteRequestAttachments', {
        ids: validated.ids,
    });

    return data?.requestAttachment_deleteMany ?? null;
};
