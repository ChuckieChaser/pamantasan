// --- MOCK AUDITS & NOTIFICATIONS DATASET ---
// Reflects PostgreSQL schema: databases/05_notifications.sql & databases/06_audits.sql

export const MOCK_NOTIFICATIONS = [
    {
        id: 'notif-001',
        user_id: 'f1000001-0000-4000-8000-000000000001',
        action: 'COORDINATOR_REQUEST_SUBMITTED',
        entity_type: 'coordinator_requests',
        entity_id: 'cr-001',
        is_read: false,
        created_at: '2026-08-24T09:30:00.000Z',
    },
    {
        id: 'notif-002',
        user_id: 'f1000001-0000-4000-8000-000000000001',
        action: 'DOCUMENT_REQUEST_CREATED',
        entity_type: 'document_requests',
        entity_id: 'req-doc-001',
        is_read: false,
        created_at: '2026-08-23T10:00:00.000Z',
    },
    {
        id: 'notif-003',
        user_id: 'f1000001-0000-4000-8000-000000000001',
        action: 'DOCUMENT_VERSION_UPLOADED',
        entity_type: 'documents',
        entity_id: 'doc-file-001',
        is_read: true,
        created_at: '2026-08-22T09:15:00.000Z',
    },
    {
        id: 'notif-004',
        user_id: 'f1000001-0000-4000-8000-000000000001',
        action: 'USER_REGISTERED',
        entity_type: 'users',
        entity_id: 'f1000001-0000-4000-8000-000000000007',
        is_read: true,
        created_at: '2026-08-15T10:00:00.000Z',
    },
];

export const MOCK_AUDIT_LOGS = [
    {
        id: 'audit-001',
        actor_id: 'f1000001-0000-4000-8000-000000000001',
        action: 'DOCUMENT_APPROVE',
        entity_type: 'documents',
        entity_id: 'doc-file-001',
        metadata: {
            version: 3,
            classification: 'PUBLIC',
            previous_status: 'PENDING_APPROVAL',
            new_status: 'PUBLISHED',
        },
        created_at: '2026-08-22T09:20:00.000Z',
    },
    {
        id: 'audit-002',
        actor_id: 'f1000001-0000-4000-8000-000000000002',
        action: 'COORDINATOR_REQUEST_CREATE',
        entity_type: 'coordinator_requests',
        entity_id: 'cr-001',
        metadata: {
            request_action: 'DOCUMENT_SHARE',
            target_department: 'College of Engineering & Technology',
        },
        created_at: '2026-08-24T09:30:00.000Z',
    },
    {
        id: 'audit-003',
        actor_id: 'f1000001-0000-4000-8000-000000000005',
        action: 'DOCUMENT_REQUEST_SUBMIT',
        entity_type: 'document_requests',
        entity_id: 'req-doc-001',
        metadata: {
            subject: 'Official Transcript of Records (TOR) & CAV Verification',
            requester_university_id: '20-00005',
        },
        created_at: '2026-08-23T10:00:00.000Z',
    },
    {
        id: 'audit-004',
        actor_id: 'f1000001-0000-4000-8000-000000000001',
        action: 'USER_ROLE_UPDATE',
        entity_type: 'users',
        entity_id: 'f1000001-0000-4000-8000-000000000004',
        metadata: {
            previous_role: 'MEMBER',
            new_role: 'OFFICER',
            authorizer: 'Arthur Pendragon',
        },
        created_at: '2026-08-22T16:45:00.000Z',
    },
];

export default {
    MOCK_NOTIFICATIONS,
    MOCK_AUDIT_LOGS,
};
