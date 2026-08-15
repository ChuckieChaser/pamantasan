--- DOMAINS ---
CREATE DOMAIN system_document_versions_classification
AS VARCHAR CHECK (VALUE IN ('UNCLASSIFIED', 'PUBLIC', 'PRIVATE', 'CONFIDENTIAL', 'RESTRICTED'));

CREATE DOMAIN system_document_shares_status
AS VARCHAR CHECK (VALUE IN ('PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'STASHED'));

CREATE DOMAIN system_document_requests_status
AS VARCHAR CHECK (VALUE IN ('OPEN', 'RESOLVED', 'REJECTED'));


--- TABLES ---
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    name VARCHAR(255) NOT NULL,
    comment TEXT NULL,
    is_folder BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approver_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    publisher_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    rejecter_id UUID REFERENCES users(id) ON DELETE RESTRICT,

    version INT NOT NULL DEFAULT 1,
    checksum VARCHAR(64) NULL,
    path VARCHAR(512) NOT NULL,
    size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    classification system_document_versions_classification NOT NULL DEFAULT 'UNCLASSIFIED',
    change_summary TEXT NULL,
    rejection_reason TEXT NULL,
    summary TEXT NULL,

    embedding vector(768) NULL,
    text_hash VARCHAR(64) NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_document_versions_document_id_version UNIQUE (document_id, version),
    CONSTRAINT chk_document_versions_version CHECK (version > 0)
);

CREATE TABLE IF NOT EXISTS document_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    sharer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    recipient_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,

    status system_document_shares_status NOT NULL DEFAULT 'PENDING_APPROVAL',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    resolver_id UUID REFERENCES users(id) ON DELETE RESTRICT,

    subject TEXT NOT NULL,
    status system_document_requests_status NOT NULL DEFAULT 'OPEN',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_request_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_request_id UUID NOT NULL REFERENCES document_requests(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE RESTRICT,

    message TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_request_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_request_id UUID NOT NULL REFERENCES document_requests(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    attached_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_document_request_attachments UNIQUE (document_request_id, document_id)
);


--- INDEXES ---
CREATE INDEX IF NOT EXISTS idx_documents_parent_id
ON documents(parent_id);

CREATE INDEX IF NOT EXISTS idx_documents_is_archived
ON documents(is_archived);

CREATE INDEX IF NOT EXISTS idx_document_versions_document_id
ON document_versions(document_id);

CREATE INDEX IF NOT EXISTS idx_document_versions_embedding
ON document_versions
USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_document_shares_sharer_id
ON document_shares(sharer_id);

CREATE INDEX IF NOT EXISTS idx_document_shares_recipient_routing
ON document_shares(document_id, recipient_id);

CREATE INDEX IF NOT EXISTS idx_document_shares_department_routing
ON document_shares(document_id, department_id, status);

CREATE INDEX IF NOT EXISTS idx_document_requests_requester_id
ON document_requests(requester_id);

CREATE INDEX IF NOT EXISTS idx_document_requests_status
ON document_requests(status);

CREATE INDEX IF NOT EXISTS idx_document_request_messages_document_request_id
ON document_request_messages(document_request_id);

CREATE INDEX IF NOT EXISTS idx_document_request_messages_thread
ON document_request_messages(document_request_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_document_request_attachments_routing
ON document_request_attachments(document_request_id, document_id);


--- TRIGGERS ---
DROP TRIGGER IF EXISTS trigger_set_timestamp_documents
ON documents;

CREATE TRIGGER trigger_set_timestamp_documents
BEFORE UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trigger_set_timestamp_document_versions
ON document_versions;

CREATE TRIGGER trigger_set_timestamp_document_versions
BEFORE UPDATE ON document_versions
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trigger_cascade_folder_status
ON document_shares;

CREATE TRIGGER trigger_cascade_folder_status
AFTER UPDATE OF status
ON document_shares
FOR EACH ROW EXECUTE FUNCTION trigger_cascade_folder_status();

DROP TRIGGER IF EXISTS trigger_enforce_share_status
ON document_shares;

CREATE TRIGGER trigger_enforce_share_status
BEFORE UPDATE OF status
ON document_shares
FOR EACH ROW EXECUTE FUNCTION trigger_enforce_share_status();

DROP TRIGGER IF EXISTS trigger_set_timestamp_document_shares
ON document_shares;

CREATE TRIGGER trigger_set_timestamp_document_shares
BEFORE UPDATE ON document_shares
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trigger_set_timestamp_document_requests
ON document_requests;

CREATE TRIGGER trigger_set_timestamp_document_requests
BEFORE UPDATE ON document_requests
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();


--- ROW LEVEL SECURITY ---
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions FORCE ROW LEVEL SECURITY;

ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_shares FORCE ROW LEVEL SECURITY;

ALTER TABLE document_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_requests FORCE ROW LEVEL SECURITY;

ALTER TABLE document_request_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_request_messages FORCE ROW LEVEL SECURITY;

ALTER TABLE document_request_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_request_attachments FORCE ROW LEVEL SECURITY;


--- POLICIES ---
CREATE POLICY documents_select_access
ON documents
FOR SELECT USING (
    is_administrator_role()
    OR is_coordinator_role()
    OR (
        is_archived = FALSE
        AND (
            uploader_id = get_current_user_id()
            OR EXISTS (
                SELECT 1
                FROM document_shares
                WHERE document_shares.document_id = documents.id
                AND document_shares.department_id = get_current_department_id()
                AND (
                    (
                        document_shares.status IN ('PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'STASHED')
                        AND is_officer_role()
                    )
                    OR (
                        document_shares.status IN ('APPROVED', 'PUBLISHED', 'STASHED')
                        AND is_director_role()
                    )
                    OR (
                        document_shares.status = 'PUBLISHED'
                        AND is_member_role()
                        AND (
                            document_shares.recipient_id IS NULL
                            OR document_shares.recipient_id = get_current_user_id()
                        )
                    )
                )
            )
            OR EXISTS (
                SELECT 1
                FROM document_request_attachments
                JOIN document_requests
                ON document_request_attachments.document_request_id = document_requests.id
                WHERE document_request_attachments.document_id = documents.id
                AND document_requests.requester_id = get_current_user_id()
            )
        )
    )
);

CREATE POLICY documents_insert_access
ON documents
FOR INSERT WITH CHECK (
    is_administrator_role()
    OR is_coordinator_role()
);

CREATE POLICY documents_update_access
ON documents
FOR UPDATE USING (
    is_administrator_role()
    OR EXISTS (
        SELECT 1
        FROM document_shares
        WHERE document_shares.document_id = documents.id
        AND document_shares.department_id = get_current_department_id()
        AND (
            (
                document_shares.status IN ('PENDING_APPROVAL', 'APPROVED')
                AND is_officer_role()
            )
            OR (
                document_shares.status IN ('APPROVED', 'PUBLISHED')
                AND is_director_role()
            )
        )
    )
) WITH CHECK (
    is_administrator_role()
    OR EXISTS (
        SELECT 1
        FROM document_shares
        WHERE document_shares.document_id = documents.id
        AND document_shares.department_id = get_current_department_id()
        AND (
            (
                document_shares.status IN ('PENDING_APPROVAL', 'APPROVED')
                AND is_officer_role()
            )
            OR (
                document_shares.status IN ('APPROVED', 'PUBLISHED')
                AND is_director_role()
            )
        )
    )
);

CREATE POLICY documents_delete_access
ON documents
FOR DELETE USING (
    is_administrator_role()
);

CREATE POLICY document_versions_select_access
ON document_versions
FOR SELECT USING (
    is_administrator_role()
    OR is_coordinator_role()
    OR EXISTS (
        SELECT 1
        FROM documents
        WHERE documents.id = document_versions.document_id
    )
);

CREATE POLICY document_versions_insert_access
ON document_versions
FOR INSERT WITH CHECK (
    is_administrator_role()
    OR is_coordinator_role()
    OR EXISTS (
        SELECT 1
        FROM documents
        WHERE documents.id = document_versions.document_id
        AND documents.uploader_id = get_current_user_id()
    )
);

CREATE POLICY document_versions_delete_access
ON document_versions
FOR DELETE USING (
    is_administrator_role()
    OR is_coordinator_role()
    OR EXISTS (
        SELECT 1
        FROM documents
        WHERE documents.id = document_versions.document_id
        AND documents.uploader_id = get_current_user_id()
    )
);

CREATE POLICY document_shares_select_access
ON document_shares
FOR SELECT USING (
    is_administrator_role()
    OR is_coordinator_role()
    OR (
        (
            is_director_role()
            OR is_officer_role()
        )
        AND department_id = get_current_department_id()
    )
    OR sharer_id = get_current_user_id()
    OR recipient_id = get_current_user_id()
    OR department_id = get_current_department_id()
);

CREATE POLICY document_shares_insert_access
ON document_shares
FOR INSERT WITH CHECK (
    is_administrator_role()
    OR (
        is_director_role()
        AND department_id = get_current_department_id()
    )
);

CREATE POLICY document_shares_update_access
ON document_shares
FOR UPDATE USING (
    is_administrator_role()
    OR (
        (
            is_director_role()
            OR is_officer_role()
        )
        AND department_id = get_current_department_id()
    )
) WITH CHECK (
    is_administrator_role()
    OR (
        (
            is_director_role()
            OR is_officer_role()
        )
        AND department_id = get_current_department_id()
    )
);

CREATE POLICY document_shares_delete_access
ON document_shares
FOR DELETE USING (
    is_administrator_role()
    OR (
        (
            is_director_role()
            OR is_officer_role()
        )
        AND department_id = get_current_department_id()
    )
);

CREATE POLICY document_requests_select_access
ON document_requests
FOR SELECT USING (
    is_administrator_role()
    OR is_coordinator_role()
    OR requester_id = get_current_user_id()
);

CREATE POLICY document_requests_insert_access
ON document_requests
FOR INSERT WITH CHECK (
    requester_id = get_current_user_id()
    AND NOT is_administrator_role()
    AND NOT is_coordinator_role()
);

CREATE POLICY document_requests_update_access
ON document_requests
FOR UPDATE USING (
    is_administrator_role()
    OR is_coordinator_role()
) WITH CHECK (
    is_administrator_role()
    OR is_coordinator_role()
);

CREATE POLICY document_requests_delete_access
ON document_requests
FOR DELETE USING (
    requester_id = get_current_user_id()
    AND status = 'OPEN'
);

CREATE POLICY document_request_messages_select_access
ON document_request_messages
FOR SELECT USING (
    is_administrator_role()
    OR is_coordinator_role()
    OR EXISTS (
        SELECT 1
        FROM document_requests
        WHERE document_requests.id = document_request_messages.document_request_id
        AND document_requests.requester_id = get_current_user_id()
    )
);

CREATE POLICY document_request_messages_insert_access
ON document_request_messages
FOR INSERT WITH CHECK (
    is_administrator_role()
    OR is_coordinator_role()
    OR (
        user_id = get_current_user_id()
        AND EXISTS (
            SELECT 1
            FROM document_requests
            WHERE document_requests.id = document_request_messages.document_request_id
            AND document_requests.status = 'OPEN'
            AND (
                is_administrator_role()
                OR document_requests.requester_id = get_current_user_id()
            )
        )
    )
);

CREATE POLICY document_request_attachments_select_access
ON document_request_attachments
FOR SELECT USING (
    is_administrator_role()
    OR is_coordinator_role()
    OR EXISTS (
        SELECT 1
        FROM document_requests
        WHERE document_requests.id = document_request_attachments.document_request_id
        AND document_requests.requester_id = get_current_user_id()
    )
);

CREATE POLICY document_request_attachments_insert_access
ON document_request_attachments
FOR INSERT WITH CHECK (
    is_administrator_role()
);

CREATE POLICY document_request_attachments_delete_access
ON document_request_attachments
FOR DELETE USING (
    is_administrator_role()
);
