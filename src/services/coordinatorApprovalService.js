// --- IMPORTS ---
import {
    useCoordinatorStore,
    useUserStore,
    useDepartmentStore,
    useDocumentStore,
} from '../stores';
import { authService } from './authService';
import { systemEventService } from './systemEventService';
import { constants } from '../constants';


// --- HELPERS ---
function parsePayloadData(data) {
    if (!data) return {};
    if (typeof data === 'object') return data;
    try {
        return JSON.parse(data);
    } catch {
        return {};
    }
}


// --- SERVICES ---
const coordinatorApprovalService = {
    /**
     * Packages and submits a restricted action as a CoordinatorRequest for Administrator approval.
     */
    submitCoordinatorRequest: async ({ action, requesterId, data = {} }) => {
        if (!requesterId) {
            throw new Error('Requester identity is required to submit a coordinator request.');
        }
        if (!action) {
            throw new Error('Action type is required.');
        }

        const serializedData = typeof data === 'string' ? data : JSON.stringify(data);

        const newReq = await useCoordinatorStore.getState().insertCoordinatorRequest({
            requesterId: requesterId,
            action: action,
            data: serializedData,
            status: constants.COORDINATOR_REQUESTS_STATUS.PENDING,
        });

        systemEventService.recordSystemEvent({
            actorId: requesterId,
            entityType: constants.AUDIT_LOGS_ENTITY_TYPE.COORDINATOR_REQUEST,
            entityId: newReq.id,
            action: constants.AUDIT_LOGS_ACTION.PENDING_APPROVAL,
            data: {
                action: action,
                requestedBy: requesterId,
            },
            targetRoles: ['ADMINISTRATOR'],
            isMajor: true,
        }).catch(() => {});

        return newReq;
    },

    /**
     * Executes the requested action with Administrator privileges while attributing the operation
     * to the original coordinator (requesterId).
     */
    executeApprovedRequest: async (coordinatorRequest, adminUser) => {
        if (!coordinatorRequest?.id) {
            throw new Error('Valid coordinator request is required for execution.');
        }
        if (!adminUser?.id) {
            throw new Error('Administrator authentication is required to approve requests.');
        }

        const payloadData = parsePayloadData(coordinatorRequest.data);
        const coordinatorId =
            (typeof coordinatorRequest.requester === 'object'
                ? coordinatorRequest.requester?.id
                : coordinatorRequest.requesterId ?? coordinatorRequest.requester) || adminUser.id;

        const action = coordinatorRequest.action;

        switch (action) {
            case constants.COORDINATOR_REQUESTS_ACTION.USER_CREATE: {
                const userStore = useUserStore.getState();
                const targetUid = (payloadData.universityId || '').trim();
                const tempPassword = payloadData.password || targetUid;
                const targetEmail = (payloadData.email || '').trim().toLowerCase();

                const newUser = await userStore.insertUser({
                    universityId: targetUid,
                    password: tempPassword,
                    firstName: (payloadData.firstName || '').trim(),
                    middleName: (payloadData.middleName || '').trim() || null,
                    lastName: (payloadData.lastName || '').trim(),
                    email: targetEmail,
                    departmentId: payloadData.departmentId,
                    role: payloadData.role || constants.USERS_ROLE.MEMBER,
                    status: payloadData.status || constants.USERS_STATUS.PENDING_PASSWORD,
                    avatarPath: payloadData.avatarPath || null,
                });

                // Dispatch provisioning credentials email
                const fullName = `${payloadData.firstName} ${payloadData.lastName}`.trim();
                authService
                    .sendUserProvisionEmail({
                        email: targetEmail,
                        recipientName: fullName,
                        universityId: targetUid,
                        temporaryPassword: tempPassword,
                        loginUrl: 'https://pamantasan-records-210fe.web.app/login',
                    })
                    .catch((err) => {
                        console.warn('Background provision email error:', err);
                    });

                break;
            }

            case constants.COORDINATOR_REQUESTS_ACTION.USER_UPDATE: {
                const userStore = useUserStore.getState();
                const targetUserId = payloadData.userId ?? payloadData.id;
                const updates = payloadData.new ?? payloadData;
                if (!targetUserId) throw new Error('Target user ID missing from request payload.');
                await userStore.updateUser(targetUserId, updates);
                break;
            }

            case constants.COORDINATOR_REQUESTS_ACTION.USER_SUSPEND: {
                const userStore = useUserStore.getState();
                const targetUserId = payloadData.userId ?? payloadData.id;
                if (!targetUserId) throw new Error('Target user ID missing from request payload.');
                await userStore.updateUser(targetUserId, { status: constants.USERS_STATUS.SUSPENDED });
                break;
            }

            case constants.COORDINATOR_REQUESTS_ACTION.USER_DELETE: {
                const userStore = useUserStore.getState();
                const targetUserId = payloadData.userId ?? payloadData.id;
                if (!targetUserId) throw new Error('Target user ID missing from request payload.');
                await userStore.deleteUser(targetUserId);
                break;
            }

            case constants.COORDINATOR_REQUESTS_ACTION.DEPARTMENT_CREATE: {
                const deptStore = useDepartmentStore.getState();
                await deptStore.insertDepartment({
                    name: (payloadData.name || '').trim(),
                    code: (payloadData.code || '').trim().toUpperCase(),
                });
                break;
            }

            case constants.COORDINATOR_REQUESTS_ACTION.DEPARTMENT_UPDATE: {
                const deptStore = useDepartmentStore.getState();
                const deptId = payloadData.departmentId ?? payloadData.id;
                const updates = payloadData.new ?? payloadData;
                if (!deptId) throw new Error('Target department ID missing from request payload.');
                await deptStore.updateDepartment(deptId, updates);
                break;
            }

            case constants.COORDINATOR_REQUESTS_ACTION.DEPARTMENT_DELETE: {
                const deptStore = useDepartmentStore.getState();
                const deptId = payloadData.departmentId ?? payloadData.id;
                if (!deptId) throw new Error('Target department ID missing from request payload.');
                await deptStore.deleteDepartment(deptId);
                break;
            }

            case constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_SHARE: {
                const docStore = useDocumentStore.getState();
                const docId = payloadData.documentId ?? payloadData.id;
                if (!docId) throw new Error('Document ID missing from request payload.');

                // Attributing coordinatorId as the sharer
                if (payloadData.isRecursive || Array.isArray(payloadData.departmentIds)) {
                    const depts = payloadData.departmentIds || (payloadData.departmentId ? [payloadData.departmentId] : []);
                    await docStore.shareDocumentRecursive(docId, depts, coordinatorId);
                } else if (payloadData.departmentId) {
                    await docStore.shareDocument(docId, payloadData.departmentId, coordinatorId);
                }
                break;
            }

            case constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_UNSHARE: {
                const docStore = useDocumentStore.getState();
                if (payloadData.isRecursive && payloadData.documentId && payloadData.departmentId) {
                    await docStore.unshareDocumentRecursive(payloadData.documentId, payloadData.departmentId);
                } else if (payloadData.shareId) {
                    await docStore.unshareDocument(payloadData.shareId);
                } else if (payloadData.documentId && payloadData.departmentId) {
                    await docStore.unshareDocumentRecursive(payloadData.documentId, payloadData.departmentId);
                }
                break;
            }

            case constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_ARCHIVE: {
                const docStore = useDocumentStore.getState();
                const docId = payloadData.documentId ?? payloadData.id;
                if (!docId) throw new Error('Document ID missing from request payload.');
                await docStore.archiveDocument(docId, true);
                break;
            }

            case constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_UNARCHIVE: {
                const docStore = useDocumentStore.getState();
                const docId = payloadData.documentId ?? payloadData.id;
                if (!docId) throw new Error('Document ID missing from request payload.');
                await docStore.archiveDocument(docId, false);
                break;
            }

            case constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_DELETE: {
                const docStore = useDocumentStore.getState();
                const docId = payloadData.documentId ?? payloadData.id;
                if (!docId) throw new Error('Document ID missing from request payload.');
                await docStore.deleteDocument(docId);
                break;
            }

            case constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_UPDATE: {
                const docStore = useDocumentStore.getState();
                const docId = payloadData.documentId ?? payloadData.id;
                const updates = payloadData.new ?? payloadData;
                if (!docId) throw new Error('Document ID missing from request payload.');
                await docStore.updateDocument(docId, updates);
                break;
            }

            case constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_ATTACH:
            case constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_ATTACH: {
                const docStore = useDocumentStore.getState();
                const reqId = payloadData.documentRequestId ?? payloadData.id;
                if (!reqId) throw new Error('Document Request ID missing from request payload.');

                const attachedDocIds = [];
                if (Array.isArray(payloadData.attachments) && payloadData.attachments.length > 0) {
                    for (const att of payloadData.attachments) {
                        const docId = att.documentId ?? att.document?.id ?? att.id;
                        if (docId) {
                            attachedDocIds.push(docId);
                            await docStore.insertDocumentRequestAttachment({
                                documentRequestId: reqId,
                                documentId: docId,
                                attachedById: coordinatorId,
                            });
                        }
                    }
                }

                const rawMessage = (payloadData.message || '').trim();
                const fallbackMessage = (Array.isArray(payloadData.attachments) && payloadData.attachments.length > 0)
                    ? `Shared ${payloadData.attachments.length === 1 ? (payloadData.attachments[0].name || 'a document') : `${payloadData.attachments.length} documents`}`
                    : '';
                const baseText = rawMessage || fallbackMessage;
                if (baseText) {
                    const tagParts = [];
                    if (attachedDocIds.length > 0) {
                        tagParts.push(`<!-- attachments:[${attachedDocIds.join(',')}] -->`);
                    }
                    tagParts.push(`<!-- admin_approved:${adminUser?.id || 'admin'} -->`);
                    const taggedMessage = `${baseText} ${tagParts.join(' ')}`;
                    await docStore.insertDocumentRequestMessage({
                        documentRequestId: reqId,
                        userId: coordinatorId,
                        message: taggedMessage,
                    });
                }

                await docStore.fetchDocumentRequestMessages(reqId);
                await docStore.fetchDocumentRequestAttachments(reqId);
                break;
            }

            case constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_RESOLVE: {
                const docStore = useDocumentStore.getState();
                const reqId = payloadData.documentRequestId ?? payloadData.id;
                if (!reqId) throw new Error('Document Request ID missing from request payload.');
                await docStore.updateDocumentRequest(reqId, {
                    status: constants.DOCUMENT_REQUESTS_STATUS.RESOLVED,
                });
                break;
            }

            case constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_REJECT: {
                const docStore = useDocumentStore.getState();
                const reqId = payloadData.documentRequestId ?? payloadData.id;
                if (!reqId) throw new Error('Document Request ID missing from request payload.');
                await docStore.updateDocumentRequest(reqId, {
                    status: constants.DOCUMENT_REQUESTS_STATUS.REJECTED,
                });
                break;
            }

            case constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_REOPEN: {
                const docStore = useDocumentStore.getState();
                const reqId = payloadData.documentRequestId ?? payloadData.id;
                if (!reqId) throw new Error('Document Request ID missing from request payload.');
                await docStore.updateDocumentRequest(reqId, {
                    status: constants.DOCUMENT_REQUESTS_STATUS.OPEN,
                });
                break;
            }

            default:
                console.warn(`Unrecognized coordinator action "${action}". Marking as approved without mutation.`);
                break;
        }

        // Mark coordinator request as APPROVED
        const updated = await useCoordinatorStore.getState().updateCoordinatorRequest(
            coordinatorRequest.id,
            {
                reviewerId: adminUser.id,
                status: constants.COORDINATOR_REQUESTS_STATUS.APPROVED,
            }
        );

        systemEventService.recordSystemEvent({
            actorId: adminUser.id,
            entityType: constants.AUDIT_LOGS_ENTITY_TYPE.COORDINATOR_REQUEST,
            entityId: coordinatorRequest.id,
            action: constants.AUDIT_LOGS_ACTION.APPROVED,
            data: {
                action: action,
                approvedBy: adminUser.id,
                targetCoordinatorId: coordinatorId,
            },
            targetUserIds: coordinatorId ? [coordinatorId] : [],
            isMajor: true,
        }).catch(() => {});

        return updated;
    },

    /**
     * Rejects a coordinator request. Per user ruleset: "reject simply removes it, it wont go and do it".
     */
    rejectCoordinatorRequest: async (coordinatorRequest) => {
        if (!coordinatorRequest?.id) {
            throw new Error('Valid coordinator request is required.');
        }

        const coordinatorId =
            (typeof coordinatorRequest.requester === 'object'
                ? coordinatorRequest.requester?.id
                : coordinatorRequest.requesterId ?? coordinatorRequest.requester) || null;

        // Delete from store/database so it is cleanly removed
        const isDeleted = await useCoordinatorStore.getState().deleteCoordinatorRequest(coordinatorRequest.id);

        systemEventService.recordSystemEvent({
            actorId: null,
            entityType: constants.AUDIT_LOGS_ENTITY_TYPE.COORDINATOR_REQUEST,
            entityId: coordinatorRequest.id,
            action: constants.AUDIT_LOGS_ACTION.REJECTED,
            data: {
                action: coordinatorRequest.action,
                targetCoordinatorId: coordinatorId,
            },
            targetUserIds: coordinatorId ? [coordinatorId] : [],
            isMajor: true,
        }).catch(() => {});

        return isDeleted;
    },
};


// --- EXPORTS ---
export { coordinatorApprovalService };
