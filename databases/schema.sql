-- ============================================================================
-- PAMANTASAN DOCUMENT MANAGEMENT SYSTEM
-- MASTER DATABASE SCHEMA (POSTGRESQL / FIREBASE DATA CONNECT READY)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 00. EXTENSIONS & SYSTEM FUNCTIONS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(
        COALESCE(
            current_setting('request.jwt.claim.sub', true),
            current_setting('firebase.auth.uid', true),
            current_setting('app.current_user_id', true)
        ),
        ''
    )::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN auth.uid();
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_current_department_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT department_id
        FROM public.users
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT role::TEXT
        FROM public.users
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_administrator_role()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_current_user_role() = 'ADMINISTRATOR';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_coordinator_role()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_current_user_role() = 'COORDINATOR';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_director_role()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_current_user_role() = 'DIRECTOR';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_officer_role()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_current_user_role() = 'OFFICER';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_member_role()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_current_user_role() = 'MEMBER';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_any_role()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_current_user_role() IS NOT NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ----------------------------------------------------------------------------
-- 01. DEPARTMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_departments_name UNIQUE (name),
    CONSTRAINT uq_departments_code UNIQUE (code)
);

DROP TRIGGER IF EXISTS trigger_set_timestamp_departments ON departments;
CREATE TRIGGER trigger_set_timestamp_departments
BEFORE UPDATE ON departments
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments FORCE ROW LEVEL SECURITY;

CREATE POLICY departments_select_access ON departments FOR SELECT USING (is_any_role());
CREATE POLICY departments_insert_access ON departments FOR INSERT WITH CHECK (is_administrator_role());
CREATE POLICY departments_update_access ON departments FOR UPDATE USING (is_administrator_role()) WITH CHECK (is_administrator_role());
CREATE POLICY departments_delete_access ON departments FOR DELETE USING (is_administrator_role());

-- ----------------------------------------------------------------------------
-- 02. USERS, CREDENTIALS, SETTINGS, SESSIONS
-- ----------------------------------------------------------------------------
CREATE DOMAIN system_users_role AS VARCHAR
CHECK (VALUE IN ('ADMINISTRATOR', 'COORDINATOR', 'DIRECTOR', 'OFFICER', 'MEMBER'));

CREATE DOMAIN system_users_status AS VARCHAR
CHECK (VALUE IN ('PENDING_PASSWORD', 'PENDING_SSO', 'VERIFIED', 'SUSPENDED'));

CREATE DOMAIN system_user_settings_theme AS VARCHAR
CHECK (VALUE IN ('SYSTEM', 'LIGHT', 'DARK'));

CREATE DOMAIN system_user_settings_notification AS VARCHAR
CHECK (VALUE IN ('ALL', 'SYSTEM', 'IMPORTANT'));

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    university_id VARCHAR(20) NOT NULL,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,

    role system_users_role NOT NULL,
    email VARCHAR(255) NOT NULL,
    avatar_path TEXT NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100) NULL,
    last_name VARCHAR(100) NOT NULL,
    status system_users_status NOT NULL DEFAULT 'PENDING_PASSWORD',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_users_university_id UNIQUE (university_id),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT chk_users_university_id CHECK (university_id ~ '^[0-9]{2}-[0-9]{5}$'),
    CONSTRAINT chk_users_email CHECK (email ~ '^[A-Za-z0-9._%+-]+@plpasig\.edu\.ph$')
);

CREATE TABLE IF NOT EXISTS user_credentials (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

    password_hash VARCHAR(255) NOT NULL,
    google_id VARCHAR(255) NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_user_credentials_google_id UNIQUE (google_id)
);

CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

    theme system_user_settings_theme NOT NULL DEFAULT 'SYSTEM',
    notification system_user_settings_notification NOT NULL DEFAULT 'ALL',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    token_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expired_at TIMESTAMPTZ NULL,

    CONSTRAINT uq_user_sessions_token_hash UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_users_department_role ON users(department_id, role);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);

CREATE OR REPLACE FUNCTION trigger_initialize_user_data()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_credentials (user_id, password_hash)
    VALUES (NEW.id, NEW.university_id)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_initialize_user_data ON users;
CREATE TRIGGER trigger_initialize_user_data
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION trigger_initialize_user_data();

DROP TRIGGER IF EXISTS trigger_set_timestamp_users ON users;
CREATE TRIGGER trigger_set_timestamp_users
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trigger_set_timestamp_user_credentials ON user_credentials;
CREATE TRIGGER trigger_set_timestamp_user_credentials
BEFORE UPDATE ON user_credentials
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trigger_set_timestamp_user_settings ON user_settings;
CREATE TRIGGER trigger_set_timestamp_user_settings
BEFORE UPDATE ON user_settings
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY users_select_access ON users FOR SELECT USING (is_any_role());
CREATE POLICY users_insert_access ON users FOR INSERT WITH CHECK (is_administrator_role());
CREATE POLICY users_update_access ON users FOR UPDATE USING (is_administrator_role()) WITH CHECK (is_administrator_role());

CREATE POLICY user_credentials_select_access ON user_credentials FOR SELECT USING (is_administrator_role());
CREATE POLICY user_credentials_insert_access ON user_credentials FOR INSERT WITH CHECK (is_administrator_role());
CREATE POLICY user_credentials_update_access ON user_credentials FOR UPDATE USING (user_id = get_current_user_id()) WITH CHECK (user_id = get_current_user_id());

CREATE POLICY user_settings_select_access ON user_settings FOR SELECT USING (user_id = get_current_user_id());
CREATE POLICY user_settings_insert_access ON user_settings FOR INSERT WITH CHECK (is_administrator_role());
CREATE POLICY user_settings_update_access ON user_settings FOR UPDATE USING (user_id = get_current_user_id()) WITH CHECK (user_id = get_current_user_id());

CREATE POLICY user_sessions_select_access ON user_sessions FOR SELECT USING (is_administrator_role() OR user_id = get_current_user_id());
CREATE POLICY user_sessions_insert_access ON user_sessions FOR INSERT WITH CHECK (user_id = get_current_user_id());
CREATE POLICY user_sessions_delete_access ON user_sessions FOR DELETE USING (is_administrator_role() OR user_id = get_current_user_id());

-- ----------------------------------------------------------------------------
-- 03. DOCUMENTS, VERSIONS, SHARES, REQUESTS, ATTACHMENTS
-- ----------------------------------------------------------------------------
CREATE DOMAIN system_document_versions_classification AS VARCHAR
CHECK (VALUE IN ('UNCLASSIFIED', 'PUBLIC', 'PRIVATE', 'CONFIDENTIAL', 'RESTRICTED'));

CREATE DOMAIN system_document_shares_status AS VARCHAR
CHECK (VALUE IN ('PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'STASHED'));

CREATE DOMAIN system_document_requests_status AS VARCHAR
CHECK (VALUE IN ('OPEN', 'RESOLVED', 'REJECTED'));

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

CREATE INDEX IF NOT EXISTS idx_documents_parent_id ON documents(parent_id);
CREATE INDEX IF NOT EXISTS idx_documents_is_archived ON documents(is_archived);
CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_embedding ON document_versions USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_document_shares_sharer_id ON document_shares(sharer_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_recipient_routing ON document_shares(document_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_department_routing ON document_shares(document_id, department_id, status);
CREATE INDEX IF NOT EXISTS idx_document_requests_requester_id ON document_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_document_requests_status ON document_requests(status);
CREATE INDEX IF NOT EXISTS idx_document_request_messages_document_request_id ON document_request_messages(document_request_id);
CREATE INDEX IF NOT EXISTS idx_document_request_messages_thread ON document_request_messages(document_request_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_document_request_attachments_routing ON document_request_attachments(document_request_id, document_id);

CREATE OR REPLACE FUNCTION trigger_cascade_folder_status()
RETURNS TRIGGER AS $$
DECLARE
    target_is_folder BOOLEAN;
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    IF OLD.status IS DISTINCT FROM NEW.status THEN
        SELECT is_folder INTO target_is_folder
        FROM public.documents
        WHERE id = NEW.document_id;

        IF target_is_folder THEN
            WITH RECURSIVE descendants AS (
                SELECT id FROM public.documents WHERE parent_id = NEW.document_id
                UNION ALL
                SELECT documents.id FROM public.documents JOIN descendants ON documents.parent_id = descendants.id
            )
            UPDATE public.document_shares
            SET status = NEW.status
            WHERE department_id = NEW.department_id
            AND document_id IN (SELECT id FROM descendants);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION trigger_enforce_share_status()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = NEW.status OR is_administrator_role() THEN
        RETURN NEW;
    END IF;

    IF is_officer_role() THEN
        IF (OLD.status = 'PENDING_APPROVAL' AND NEW.status = 'APPROVED') OR (OLD.status = 'APPROVED' AND NEW.status = 'PENDING_APPROVAL') THEN
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Officers can only transition shares between valid states. Attempted: % -> %', OLD.status, NEW.status;
        END IF;
    END IF;

    IF is_director_role() THEN
        IF (OLD.status = 'APPROVED' AND NEW.status = 'PUBLISHED') OR (OLD.status = 'PUBLISHED' AND NEW.status = 'APPROVED') OR (OLD.status = 'APPROVED' AND NEW.status = 'STASHED') OR (OLD.status = 'STASHED' AND NEW.status = 'APPROVED') THEN
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Directors can only transition shares between valid states. Attempted: % -> %', OLD.status, NEW.status;
        END IF;
    END IF;

    RAISE EXCEPTION 'Unauthorized state transition attempted: % -> %', OLD.status, NEW.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_set_timestamp_documents ON documents;
CREATE TRIGGER trigger_set_timestamp_documents BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trigger_set_timestamp_document_versions ON document_versions;
CREATE TRIGGER trigger_set_timestamp_document_versions BEFORE UPDATE ON document_versions FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trigger_cascade_folder_status ON document_shares;
CREATE TRIGGER trigger_cascade_folder_status AFTER UPDATE OF status ON document_shares FOR EACH ROW EXECUTE FUNCTION trigger_cascade_folder_status();

DROP TRIGGER IF EXISTS trigger_enforce_share_status ON document_shares;
CREATE TRIGGER trigger_enforce_share_status BEFORE UPDATE OF status ON document_shares FOR EACH ROW EXECUTE FUNCTION trigger_enforce_share_status();

DROP TRIGGER IF EXISTS trigger_set_timestamp_document_shares ON document_shares;
CREATE TRIGGER trigger_set_timestamp_document_shares BEFORE UPDATE ON document_shares FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trigger_set_timestamp_document_requests ON document_requests;
CREATE TRIGGER trigger_set_timestamp_document_requests BEFORE UPDATE ON document_requests FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

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

CREATE POLICY documents_select_access ON documents FOR SELECT USING (
    is_administrator_role()
    OR is_coordinator_role()
    OR (
        is_archived = FALSE
        AND (
            uploader_id = get_current_user_id()
            OR EXISTS (
                SELECT 1 FROM document_shares
                WHERE document_shares.document_id = documents.id
                AND document_shares.department_id = get_current_department_id()
                AND (
                    (document_shares.status IN ('PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'STASHED') AND is_officer_role())
                    OR (document_shares.status IN ('APPROVED', 'PUBLISHED', 'STASHED') AND is_director_role())
                    OR (document_shares.status = 'PUBLISHED' AND is_member_role() AND (document_shares.recipient_id IS NULL OR document_shares.recipient_id = get_current_user_id()))
                )
            )
            OR EXISTS (
                SELECT 1 FROM document_request_attachments
                JOIN document_requests ON document_request_attachments.document_request_id = document_requests.id
                WHERE document_request_attachments.document_id = documents.id
                AND document_requests.requester_id = get_current_user_id()
            )
        )
    )
);

CREATE POLICY documents_insert_access ON documents FOR INSERT WITH CHECK (is_administrator_role() OR is_coordinator_role());
CREATE POLICY documents_update_access ON documents FOR UPDATE USING (
    is_administrator_role()
    OR EXISTS (
        SELECT 1 FROM document_shares
        WHERE document_shares.document_id = documents.id
        AND document_shares.department_id = get_current_department_id()
        AND (
            (document_shares.status IN ('PENDING_APPROVAL', 'APPROVED') AND is_officer_role())
            OR (document_shares.status IN ('APPROVED', 'PUBLISHED') AND is_director_role())
        )
    )
) WITH CHECK (
    is_administrator_role()
    OR EXISTS (
        SELECT 1 FROM document_shares
        WHERE document_shares.document_id = documents.id
        AND document_shares.department_id = get_current_department_id()
        AND (
            (document_shares.status IN ('PENDING_APPROVAL', 'APPROVED') AND is_officer_role())
            OR (document_shares.status IN ('APPROVED', 'PUBLISHED') AND is_director_role())
        )
    )
);
CREATE POLICY documents_delete_access ON documents FOR DELETE USING (is_administrator_role());

CREATE POLICY document_versions_select_access ON document_versions FOR SELECT USING (is_administrator_role() OR is_coordinator_role() OR EXISTS (SELECT 1 FROM documents WHERE documents.id = document_versions.document_id));
CREATE POLICY document_versions_insert_access ON document_versions FOR INSERT WITH CHECK (is_administrator_role() OR is_coordinator_role() OR EXISTS (SELECT 1 FROM documents WHERE documents.id = document_versions.document_id AND documents.uploader_id = get_current_user_id()));
CREATE POLICY document_versions_delete_access ON document_versions FOR DELETE USING (is_administrator_role() OR is_coordinator_role() OR EXISTS (SELECT 1 FROM documents WHERE documents.id = document_versions.document_id AND documents.uploader_id = get_current_user_id()));

CREATE POLICY document_shares_select_access ON document_shares FOR SELECT USING (is_administrator_role() OR is_coordinator_role() OR ((is_director_role() OR is_officer_role()) AND department_id = get_current_department_id()) OR sharer_id = get_current_user_id() OR recipient_id = get_current_user_id() OR department_id = get_current_department_id());
CREATE POLICY document_shares_insert_access ON document_shares FOR INSERT WITH CHECK (is_administrator_role() OR (is_director_role() AND department_id = get_current_department_id()));
CREATE POLICY document_shares_update_access ON document_shares FOR UPDATE USING (is_administrator_role() OR ((is_director_role() OR is_officer_role()) AND department_id = get_current_department_id())) WITH CHECK (is_administrator_role() OR ((is_director_role() OR is_officer_role()) AND department_id = get_current_department_id()));
CREATE POLICY document_shares_delete_access ON document_shares FOR DELETE USING (is_administrator_role() OR ((is_director_role() OR is_officer_role()) AND department_id = get_current_department_id()));

CREATE POLICY document_requests_select_access ON document_requests FOR SELECT USING (is_administrator_role() OR is_coordinator_role() OR requester_id = get_current_user_id());
CREATE POLICY document_requests_insert_access ON document_requests FOR INSERT WITH CHECK (requester_id = get_current_user_id() AND NOT is_administrator_role() AND NOT is_coordinator_role());
CREATE POLICY document_requests_update_access ON document_requests FOR UPDATE USING (is_administrator_role() OR is_coordinator_role()) WITH CHECK (is_administrator_role() OR is_coordinator_role());
CREATE POLICY document_requests_delete_access ON document_requests FOR DELETE USING (requester_id = get_current_user_id() AND status = 'OPEN');

CREATE POLICY document_request_messages_select_access ON document_request_messages FOR SELECT USING (is_administrator_role() OR is_coordinator_role() OR EXISTS (SELECT 1 FROM document_requests WHERE document_requests.id = document_request_messages.document_request_id AND document_requests.requester_id = get_current_user_id()));
CREATE POLICY document_request_messages_insert_access ON document_request_messages FOR INSERT WITH CHECK (is_administrator_role() OR is_coordinator_role() OR (user_id = get_current_user_id() AND EXISTS (SELECT 1 FROM document_requests WHERE document_requests.id = document_request_messages.document_request_id AND document_requests.status = 'OPEN' AND (is_administrator_role() OR document_requests.requester_id = get_current_user_id()))));

CREATE POLICY document_request_attachments_select_access ON document_request_attachments FOR SELECT USING (is_administrator_role() OR is_coordinator_role() OR EXISTS (SELECT 1 FROM document_requests WHERE document_requests.id = document_request_attachments.document_request_id AND document_requests.requester_id = get_current_user_id()));
CREATE POLICY document_request_attachments_insert_access ON document_request_attachments FOR INSERT WITH CHECK (is_administrator_role());
CREATE POLICY document_request_attachments_delete_access ON document_request_attachments FOR DELETE USING (is_administrator_role());

-- ----------------------------------------------------------------------------
-- 04. COORDINATOR REQUESTS
-- ----------------------------------------------------------------------------
CREATE DOMAIN system_coordinator_requests_action AS VARCHAR
CHECK (VALUE IN (
    'USER_CREATE', 'USER_UPDATE', 'USER_SUSPEND',
    'DEPARTMENT_CREATE', 'DEPARTMENT_UPDATE',
    'DOCUMENT_UPLOAD', 'DOCUMENT_UPDATE', 'DOCUMENT_DELETE',
    'DOCUMENT_SHARE', 'DOCUMENT_ARCHIVE', 'DOCUMENT_ATTACH'
));

CREATE DOMAIN system_coordinator_requests_status AS VARCHAR
CHECK (VALUE IN ('PENDING', 'APPROVED', 'REJECTED'));

CREATE TABLE IF NOT EXISTS coordinator_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reviewer_id UUID REFERENCES users(id) ON DELETE RESTRICT,

    action system_coordinator_requests_action NOT NULL,
    data JSONB NOT NULL,
    status system_coordinator_requests_status NOT NULL DEFAULT 'PENDING',
    rejection_reason TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coordinator_requests_requester_id ON coordinator_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_coordinator_requests_status ON coordinator_requests(status);
CREATE INDEX IF NOT EXISTS idx_coordinator_requests_action ON coordinator_requests(action);
CREATE INDEX IF NOT EXISTS idx_coordinator_requests_data ON coordinator_requests USING GIN (data);

DROP TRIGGER IF EXISTS trigger_set_timestamp_coordinator_requests ON coordinator_requests;
CREATE TRIGGER trigger_set_timestamp_coordinator_requests BEFORE UPDATE ON coordinator_requests FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

ALTER TABLE coordinator_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE coordinator_requests FORCE ROW LEVEL SECURITY;

CREATE POLICY coordinator_requests_select_access ON coordinator_requests FOR SELECT USING (is_administrator_role() OR requester_id = get_current_user_id());
CREATE POLICY coordinator_requests_insert_access ON coordinator_requests FOR INSERT WITH CHECK (is_coordinator_role() AND requester_id = get_current_user_id());
CREATE POLICY coordinator_requests_update_access ON coordinator_requests FOR UPDATE USING (is_administrator_role()) WITH CHECK (is_administrator_role());
CREATE POLICY coordinator_requests_delete_access ON coordinator_requests FOR DELETE USING (requester_id = get_current_user_id() AND status = 'PENDING');

-- ----------------------------------------------------------------------------
-- 05. NOTIFICATIONS
-- ----------------------------------------------------------------------------
CREATE DOMAIN system_notifications_entity_type AS VARCHAR
CHECK (VALUE IN ('USER', 'DEPARTMENT', 'DOCUMENT', 'COORDINATOR_REQUEST', 'DOCUMENT_REQUEST'));

CREATE DOMAIN system_notifications_action AS VARCHAR
CHECK (VALUE IN (
    'CREATED', 'UPDATED', 'DELETED',
    'PENDING_APPROVAL', 'APPROVED', 'UNAPPROVED', 'REJECTED', 'STASHED',
    'UPLOADED', 'SHARED', 'UNSHARED', 'PUBLISHED', 'UNPUBLISHED',
    'ARCHIVED', 'UNARCHIVED', 'RESOLVED', 'COMMENTED', 'ATTACHED', 'SUSPENDED', 'UNSUSPENDED', 'REVERTED'
));

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
GROUP BY recipient_id, entity_type, entity_id, action;

CREATE INDEX IF NOT EXISTS idx_notifications_inbox ON notifications(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications(entity_type, entity_id);

DROP TRIGGER IF EXISTS trigger_set_timestamp_notifications ON notifications;
CREATE TRIGGER trigger_set_timestamp_notifications BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;

CREATE POLICY notifications_select_access ON notifications FOR SELECT USING (recipient_id = get_current_user_id());
CREATE POLICY notifications_insert_access ON notifications FOR INSERT WITH CHECK (is_administrator_role());
CREATE POLICY notifications_update_access ON notifications FOR UPDATE USING (recipient_id = get_current_user_id()) WITH CHECK (recipient_id = get_current_user_id());
CREATE POLICY notifications_delete_access ON notifications FOR DELETE USING (recipient_id = get_current_user_id());

-- ----------------------------------------------------------------------------
-- 06. AUDIT LOGS
-- ----------------------------------------------------------------------------
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

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NULL REFERENCES users(id) ON DELETE RESTRICT,

    entity_type system_audit_logs_entity_type NOT NULL,
    entity_id UUID NOT NULL,
    action system_audit_logs_action NOT NULL,
    data JSONB NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_data ON audit_logs USING GIN (data);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_select_access ON audit_logs FOR SELECT USING (is_administrator_role() OR is_coordinator_role());
CREATE POLICY audit_logs_insert_access ON audit_logs FOR INSERT WITH CHECK (actor_id = get_current_user_id() OR (actor_id IS NULL AND get_current_user_id() IS NULL));

-- ----------------------------------------------------------------------------
-- 07. SEED DATA
-- ----------------------------------------------------------------------------
INSERT INTO departments (id, name, code)
VALUES
    ('d0000001-0000-4000-8000-000000000001', 'College of Computer Studies', 'CCS'),
    ('d0000001-0000-4000-8000-000000000002', 'Human Resources', 'HR')
ON CONFLICT (code) DO NOTHING;

INSERT INTO users (id, university_id, department_id, role, email, avatar_path, first_name, middle_name, last_name, status)
VALUES
    ('f1000001-0000-4000-8000-000000000001', '20-00001', 'd0000001-0000-4000-8000-000000000001', 'ADMINISTRATOR', 'admin.ccs@plpasig.edu.ph', '/avatars/manny.jpg', 'Arthur', NULL, 'Pendragon', 'VERIFIED'),
    ('f1000001-0000-4000-8000-000000000002', '20-00002', 'd0000001-0000-4000-8000-000000000001', 'COORDINATOR', 'coord.ccs@plpasig.edu.ph', '/avatars/bugs.jpg', 'Cora', NULL, 'Smith', 'VERIFIED'),
    ('f1000001-0000-4000-8000-000000000003', '20-00003', 'd0000001-0000-4000-8000-000000000001', 'DIRECTOR', 'director.ccs@plpasig.edu.ph', '/avatars/jerry.jpg', 'Diana', NULL, 'Prince', 'VERIFIED'),
    ('f1000001-0000-4000-8000-000000000004', '20-00004', 'd0000001-0000-4000-8000-000000000001', 'OFFICER', 'officer.ccs@plpasig.edu.ph', '/avatars/johnny.jpg', 'Oliver', NULL, 'Queen', 'VERIFIED'),
    ('f1000001-0000-4000-8000-000000000005', '20-00005', 'd0000001-0000-4000-8000-000000000001', 'MEMBER', 'member.ccs@plpasig.edu.ph', '/avatars/mort.jpg', 'Marcus', NULL, 'Aurelius', 'VERIFIED'),
    ('f1000001-0000-4000-8000-000000000006', '21-00001', 'd0000001-0000-4000-8000-000000000002', 'MEMBER', 'member1.hr@plpasig.edu.ph', '/avatars/sid.jpg', 'Helena', NULL, 'Roosevelt', 'VERIFIED'),
    ('f1000001-0000-4000-8000-000000000007', '21-00002', 'd0000001-0000-4000-8000-000000000002', 'MEMBER', 'member2.hr@plpasig.edu.ph', '/avatars/kowalski.jpg', 'Henry', NULL, 'Wallace', 'VERIFIED')
ON CONFLICT (university_id) DO NOTHING;

UPDATE user_credentials
SET password_hash = 'password'
WHERE user_id IN (
    'f1000001-0000-4000-8000-000000000001',
    'f1000001-0000-4000-8000-000000000002',
    'f1000001-0000-4000-8000-000000000003',
    'f1000001-0000-4000-8000-000000000004',
    'f1000001-0000-4000-8000-000000000005',
    'f1000001-0000-4000-8000-000000000006',
    'f1000001-0000-4000-8000-000000000007'
);

UPDATE user_settings
SET theme = 'DARK'
WHERE user_id IN (
    'f1000001-0000-4000-8000-000000000002',
    'f1000001-0000-4000-8000-000000000004',
    'f1000001-0000-4000-8000-000000000007'
);

COMMIT;
