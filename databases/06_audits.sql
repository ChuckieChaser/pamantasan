--- DOMAINS ---
CREATE DOMAIN system_audit_logs_entity_type AS VARCHAR
CHECK (VALUE IN (
    'USER', 'DEPARTMENT', 'DOCUMENT', 'DOCUMENT_VERSION',
    'DOCUMENT_SHARE', 'DOCUMENT_REQUEST', 'DOCUMENT_REQUEST_ATTACHMENT',
    'COORDINATOR_REQUEST'
));

CREATE DOMAIN system_audit_logs_action AS VARCHAR
CHECK (VALUE IN (
    'CREATED', 'UPDATED', 'DELETED',
    'PENDING_APPROVAL', 'APPROVED', 'UNAPPROVED', 'REJECTED', 'STASHED',
    'UPLOADED', 'SHARED', 'UNSHARED', 'PUBLISHED', 'UNPUBLISHED',
    'ARCHIVED', 'UNARCHIVED', 'RESOLVED', 'COMMENTED', 'ATTACHED',
    'SUSPENDED', 'UNSUSPENDED', 'REVERTED'
));


--- TABLES ---
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NULL REFERENCES users(id) ON DELETE RESTRICT,

    entity_type system_audit_logs_entity_type NOT NULL,
    entity_id UUID NOT NULL,
    action system_audit_logs_action NOT NULL,
    data JSONB NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


--- INDEXES ---
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id
ON audit_logs(actor_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_target
ON audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_data
ON audit_logs
USING GIN (data);


--- ROW LEVEL SECURITY ---
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;


--- POLICIES ---
CREATE POLICY audit_logs_select_access
ON audit_logs
FOR SELECT USING (
    is_administrator_role()
    OR is_coordinator_role()
);

CREATE POLICY audit_logs_insert_access
ON audit_logs
FOR INSERT WITH CHECK (
    actor_id = get_current_user_id()
    OR (
        actor_id IS NULL
        AND get_current_user_id() IS NULL
    )
);
