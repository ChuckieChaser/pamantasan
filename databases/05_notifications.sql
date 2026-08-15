--- DOMAINS ---
CREATE DOMAIN system_notifications_entity_type AS VARCHAR
CHECK (VALUE IN ('USER', 'DEPARTMENT', 'DOCUMENT', 'COORDINATOR_REQUEST', 'DOCUMENT_REQUEST'));

CREATE DOMAIN system_notifications_action AS VARCHAR
CHECK (VALUE IN (
    'CREATED', 'UPDATED', 'DELETED',
    'PENDING_APPROVAL', 'APPROVED', 'UNAPPROVED', 'REJECTED', 'STASHED',
    'UPLOADED', 'SHARED', 'UNSHARED', 'PUBLISHED', 'UNPUBLISHED',
    'ARCHIVED', 'UNARCHIVED', 'RESOLVED', 'COMMENTED', 'ATTACHED', 'SUSPENDED', 'UNSUSPENDED', 'REVERTED'
));


--- TABLES ---
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id UUID NULL REFERENCES users(id) ON DELETE RESTRICT,

    entity_type system_notifications_entity_type NOT NULL,
    entity_id UUID NOT NULL,
    action system_notifications_action NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    is_emailed BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


--- VIEWS ---
CREATE OR REPLACE VIEW view_notifications WITH (security_invoker = true) AS
SELECT
    recipient_id,
    entity_type,
    entity_id,
    action,
    COUNT(*) AS interaction_count,
    MAX(created_at) AS last_interaction_at,
    ARRAY_AGG(DISTINCT actor_id) AS actor_ids,
    ARRAY_AGG(id) AS notification_ids,
    BOOL_AND(is_read) AS is_read
FROM notifications
GROUP BY
    recipient_id,
    entity_type,
    entity_id,
    action;


--- INDEXES ---
CREATE INDEX IF NOT EXISTS idx_notifications_inbox
ON notifications(recipient_id, is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_target
ON notifications(entity_type, entity_id);


--- TRIGGERS ---
DROP TRIGGER IF EXISTS trigger_set_timestamp_notifications
ON notifications;

CREATE TRIGGER trigger_set_timestamp_notifications
BEFORE UPDATE ON notifications
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();


--- ROW LEVEL SECURITY ---
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;


--- POLICIES ---
CREATE POLICY notifications_select_access
ON notifications
FOR SELECT USING (
    recipient_id = get_current_user_id()
);

CREATE POLICY notifications_insert_access
ON notifications
FOR INSERT WITH CHECK (
    is_administrator_role()
);

CREATE POLICY notifications_update_access
ON notifications
FOR UPDATE USING (
    recipient_id = get_current_user_id()
) WITH CHECK (
    recipient_id = get_current_user_id()
);

CREATE POLICY notifications_delete_access
ON notifications
FOR DELETE USING (
    recipient_id = get_current_user_id()
);
