--- DOMAINS ---
CREATE DOMAIN system_users_role AS VARCHAR
CHECK (VALUE IN ('ADMINISTRATOR', 'COORDINATOR', 'DIRECTOR', 'OFFICER', 'MEMBER'));

CREATE DOMAIN system_users_status AS VARCHAR
CHECK (VALUE IN ('PENDING_PASSWORD', 'PENDING_SSO', 'VERIFIED', 'SUSPENDED'));

CREATE DOMAIN system_user_settings_theme AS VARCHAR
CHECK (VALUE IN ('SYSTEM', 'LIGHT', 'DARK'));

CREATE DOMAIN system_user_settings_notification AS VARCHAR
CHECK (VALUE IN ('ALL', 'SYSTEM', 'IMPORTANT'));


--- TABLES ---
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


--- INDEXES ---
CREATE INDEX IF NOT EXISTS idx_users_department_role
ON users(department_id, role);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
ON user_sessions(user_id);


--- TRIGGERS ---
DROP TRIGGER IF EXISTS trigger_initialize_user_data
ON users;

CREATE TRIGGER trigger_initialize_user_data
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION trigger_initialize_user_data();

DROP TRIGGER IF EXISTS trigger_set_timestamp_users
ON users;

CREATE TRIGGER trigger_set_timestamp_users
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trigger_set_timestamp_user_credentials
ON user_credentials;

CREATE TRIGGER trigger_set_timestamp_user_credentials
BEFORE UPDATE ON user_credentials
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trigger_set_timestamp_user_settings
ON user_settings;

CREATE TRIGGER trigger_set_timestamp_user_settings
BEFORE UPDATE ON user_settings
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();


--- ROW LEVEL SECURITY ---
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credentials FORCE ROW LEVEL SECURITY;

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings FORCE ROW LEVEL SECURITY;

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions FORCE ROW LEVEL SECURITY;


--- POLICIES ---
CREATE POLICY users_select_access
ON users
FOR SELECT USING (
    is_any_role()
);

CREATE POLICY users_insert_access
ON users
FOR INSERT WITH CHECK (
    is_administrator_role()
);

CREATE POLICY users_update_access
ON users
FOR UPDATE USING (
    is_administrator_role()
) WITH CHECK (
    is_administrator_role()
);

CREATE POLICY user_credentials_select_access
ON user_credentials
FOR SELECT USING (
    is_administrator_role()
);

CREATE POLICY user_credentials_insert_access
ON user_credentials
FOR INSERT WITH CHECK (
    is_administrator_role()
);

CREATE POLICY user_credentials_update_access
ON user_credentials
FOR UPDATE USING (
    user_id = get_current_user_id()
) WITH CHECK (
    user_id = get_current_user_id()
);

CREATE POLICY user_settings_select_access
ON user_settings
FOR SELECT USING (
    user_id = get_current_user_id()
);

CREATE POLICY user_settings_insert_access
ON user_settings
FOR INSERT WITH CHECK (
    is_administrator_role()
);

CREATE POLICY user_settings_update_access
ON user_settings
FOR UPDATE USING (
    user_id = get_current_user_id()
) WITH CHECK (
    user_id = get_current_user_id()
);

CREATE POLICY user_sessions_select_access
ON user_sessions
FOR SELECT USING (
    is_administrator_role()
    OR user_id = get_current_user_id()
);

CREATE POLICY user_sessions_insert_access
ON user_sessions
FOR INSERT WITH CHECK (
    user_id = get_current_user_id()
);

CREATE POLICY user_sessions_delete_access
ON user_sessions
FOR DELETE USING (
    is_administrator_role()
    OR user_id = get_current_user_id()
);
