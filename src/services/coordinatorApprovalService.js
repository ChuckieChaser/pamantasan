// --- IMPORTS ---
import { useCoordinatorStore } from '../stores/useCoordinatorStore';
import { useUserStore } from '../stores/useUserStore';
import { useDepartmentStore } from '../stores/useDepartmentStore';
import { useDocumentStore } from '../stores/useDocumentStore';
import { useAuthStore } from '../stores/useAuthStore';
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


function formatCoordinatorActionLabel(action, data = {}) {
    const act = String(action || '').toUpperCase();
    const payload = parsePayloadData(data);

    if (act === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_ATTACH || act === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_ATTACH) {
        return 'Document Attachment';
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_RESOLVE) {
        return 'Resolve Document Request';
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_REJECT) {
        return 'Reject Document Request';
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_REOPEN) {
        return 'Reopen Document Request';
    }

    const resolveUserIdentifier = (p) => {
        let identifier = p.universityId || p.name || p.email;
        if (!identifier && (p.userId || p.id)) {
            const u = useUserStore.getState().users?.find((x) => String(x.id) === String(p.userId || p.id));
            if (u) identifier = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.universityId || u.email;
        }
        return identifier;
    };

    const resolveDeptIdentifier = (p) => {
        let identifier = p.code || p.name;
        if (!identifier && (p.departmentId || p.id)) {
            const d = useDepartmentStore.getState().departments?.find((x) => String(x.id) === String(p.departmentId || p.id));
            if (d) identifier = d.code || d.name;
        }
        return identifier;
    };

    const resolveDocIdentifier = (p) => {
        let identifier = p.title || p.name;
        if (!identifier && (p.documentId || p.id)) {
            const doc = useDocumentStore.getState().documents?.find((x) => String(x.id) === String(p.documentId || p.id));
            if (doc) identifier = doc.name || doc.title;
        }
        return identifier;
    };

    if (act === constants.COORDINATOR_REQUESTS_ACTION.USER_CREATE) {
        const identifier = resolveUserIdentifier(payload) || 'New User';
        return `Create User (${identifier})`;
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.USER_UPDATE) {
        const identifier = resolveUserIdentifier(payload) || 'User';
        return `Update User (${identifier})`;
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.USER_SUSPEND) {
        const identifier = resolveUserIdentifier(payload) || 'User';
        return `Suspend User (${identifier})`;
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.USER_DELETE) {
        const identifier = resolveUserIdentifier(payload) || 'User';
        return `Delete User (${identifier})`;
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.DEPARTMENT_CREATE) {
        const identifier = resolveDeptIdentifier(payload) || 'New Department';
        return `Create Department (${identifier})`;
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.DEPARTMENT_UPDATE) {
        const identifier = resolveDeptIdentifier(payload) || 'Department';
        return `Update Department (${identifier})`;
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.DEPARTMENT_DELETE) {
        const identifier = resolveDeptIdentifier(payload) || 'Department';
        return `Delete Department (${identifier})`;
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_UPLOAD) {
        const identifier = resolveDocIdentifier(payload) || 'Document';
        return `Upload Document (${identifier})`;
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_UPDATE) {
        const identifier = resolveDocIdentifier(payload) || 'Document';
        return `Update Document (${identifier})`;
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_DELETE) {
        const identifier = resolveDocIdentifier(payload) || 'Document';
        return `Delete Document (${identifier})`;
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_SHARE) {
        const identifier = resolveDocIdentifier(payload) || 'Document';
        return `Share Document (${identifier})`;
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_UNSHARE) {
        const identifier = resolveDocIdentifier(payload) || 'Document';
        return `Unshare Document (${identifier})`;
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_ARCHIVE) {
        const identifier = resolveDocIdentifier(payload) || 'Document';
        return `Archive Document (${identifier})`;
    }
    if (act === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_UNARCHIVE) {
        const identifier = resolveDocIdentifier(payload) || 'Document';
        return `Unarchive Document (${identifier})`;
    }
    return act ? act.replace(/_/g, ' ') : 'Coordinator Request';
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
        }, requesterId);

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

        // CONCURRENT UPDATE-PENDING GUARD FOR DELETION (A5)
        const isDeleteAction = [
            constants.COORDINATOR_REQUESTS_ACTION.USER_DELETE,
            constants.COORDINATOR_REQUESTS_ACTION.DEPARTMENT_DELETE,
            constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_DELETE,
        ].includes(action);

        if (isDeleteAction) {
            const store = useCoordinatorStore.getState();
            const pendingRequests = (store.coordinatorRequests || []).filter(
                (r) => r.id !== coordinatorRequest.id && r.status === constants.COORDINATOR_REQUESTS_STATUS.PENDING
            );

            const targetUserId = payloadData.userId ?? payloadData.id;
            const targetDeptId = payloadData.departmentId ?? payloadData.id;
            const targetDocId = payloadData.documentId ?? payloadData.id;

            const hasConflictingPending = pendingRequests.some((r) => {
                const rData = parsePayloadData(r.data);
                if (action === constants.COORDINATOR_REQUESTS_ACTION.USER_DELETE && targetUserId) {
                    const rUserId = rData.userId ?? rData.id;
                    return String(rUserId) === String(targetUserId);
                }
                if (action === constants.COORDINATOR_REQUESTS_ACTION.DEPARTMENT_DELETE && targetDeptId) {
                    const rDeptId = rData.departmentId ?? rData.id;
                    return String(rDeptId) === String(targetDeptId);
                }
                if (action === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_DELETE && targetDocId) {
                    const rDocId = rData.documentId ?? rData.id;
                    return String(rDocId) === String(targetDocId);
                }
                return false;
            });

            if (hasConflictingPending) {
                throw new Error('Cannot approve deletion: a pending request exists for this target.');
            }
        }

        switch (action) {
            case constants.COORDINATOR_REQUESTS_ACTION.USER_CREATE: {
                const userStore = useUserStore.getState();
                const targetUid = (payloadData.universityId || '').trim();
                const tempPassword = payloadData.password || targetUid;
                const targetEmail = (payloadData.email || '').trim().toLowerCase();

                await userStore.insertUser({
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
                }, adminUser);

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
                await userStore.updateUser(targetUserId, updates, adminUser);
                break;
            }

            case constants.COORDINATOR_REQUESTS_ACTION.USER_SUSPEND: {
                const userStore = useUserStore.getState();
                const targetUserId = payloadData.userId ?? payloadData.id;
                const targetStatus = payloadData.new?.status || payloadData.status || constants.USERS_STATUS.SUSPENDED;
                if (!targetUserId) throw new Error('Target user ID missing from request payload.');
                await userStore.updateUser(targetUserId, { status: targetStatus }, adminUser);
                break;
            }

            case constants.COORDINATOR_REQUESTS_ACTION.USER_DELETE: {
                const userStore = useUserStore.getState();
                const targetUserId = payloadData.userId ?? payloadData.id;
                if (!targetUserId) throw new Error('Target user ID missing from request payload.');
                await userStore.deleteUser(targetUserId, adminUser);
                break;
            }

            case constants.COORDINATOR_REQUESTS_ACTION.DEPARTMENT_CREATE: {
                const deptStore = useDepartmentStore.getState();
                await deptStore.insertDepartment({
                    name: (payloadData.name || '').trim(),
                    code: (payloadData.code || '').trim().toUpperCase(),
                }, adminUser);
                break;
            }

            case constants.COORDINATOR_REQUESTS_ACTION.DEPARTMENT_UPDATE: {
                const deptStore = useDepartmentStore.getState();
                const deptId = payloadData.departmentId ?? payloadData.id;
                const updates = payloadData.new ?? payloadData;
                if (!deptId) throw new Error('Target department ID missing from request payload.');
                await deptStore.updateDepartment(deptId, updates, adminUser);
                break;
            }

            case constants.COORDINATOR_REQUESTS_ACTION.DEPARTMENT_DELETE: {
                const deptStore = useDepartmentStore.getState();
                const deptId = payloadData.departmentId ?? payloadData.id;
                if (!deptId) throw new Error('Target department ID missing from request payload.');
                await deptStore.deleteDepartment(deptId, adminUser);
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
                const reason = payloadData.rejectionReason || null;
                await docStore.updateDocumentRequest(reqId, {
                    status: constants.DOCUMENT_REQUESTS_STATUS.REJECTED,
                    rejectionReason: reason,
                });
                if (reason) {
                    await docStore.insertDocumentRequestMessage({
                        documentRequestId: reqId,
                        userId: adminUser?.id || coordinatorId,
                        message: `Rejection Note: ${reason}`,
                    }).catch(() => {});
                }
                break;
            }

            case constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_REOPEN: {
                throw new Error('Closed and resolved document requests cannot be reopened for compliance and auditing.');
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
            },
            adminUser
        );

        return updated;
    },

    /**
     * Updates coordinator request status with rejectionReason and syncs data payload.
     */
    updateCoordinatorRequestStatus: async ({ requestId, status, rejectionReason = null }) => {
        if (!requestId) throw new Error('Request ID is required.');
        const coordinatorStore = useCoordinatorStore.getState();
        const existing = coordinatorStore.coordinatorRequests.find((r) => r.id === requestId);
        const currentData = parsePayloadData(existing?.data);
        const reason = rejectionReason || currentData.rejectionReason || null;
        const updatedData = {
            ...currentData,
            ...(reason ? { rejectionReason: reason } : {}),
        };
        return await coordinatorStore.updateCoordinatorRequest(requestId, {
            status,
            rejectionReason: reason,
            data: JSON.stringify(updatedData),
        });
    },

    /**
     * Rejects a coordinator request and updates its status to REJECTED with optional rejection reason.
     */
    rejectCoordinatorRequest: async (coordinatorRequest, adminUser = null) => {
        if (!coordinatorRequest?.id) {
            throw new Error('Valid coordinator request is required.');
        }

        const resolvedAdmin = adminUser || useAuthStore.getState().currentUser || null;
        const currentData = parsePayloadData(coordinatorRequest.data);
        const reason = coordinatorRequest.rejectionReason || currentData.rejectionReason || null;
        const updatedData = {
            ...currentData,
            rejectionReason: reason,
        };

        const updated = await useCoordinatorStore.getState().updateCoordinatorRequest(
            coordinatorRequest.id,
            {
                reviewerId: resolvedAdmin?.id || null,
                status: constants.COORDINATOR_REQUESTS_STATUS.REJECTED,
                rejectionReason: reason,
                data: JSON.stringify(updatedData),
            },
            resolvedAdmin
        );

        return updated;
    },
};


// --- EXPORTS ---
export { coordinatorApprovalService, formatCoordinatorActionLabel };
