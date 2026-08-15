--- TABLES ---
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_departments_name UNIQUE (name),
    CONSTRAINT uq_departments_code UNIQUE (code)
);


--- TRIGGERS ---
DROP TRIGGER IF EXISTS trigger_set_timestamp_departments
ON departments;

CREATE TRIGGER trigger_set_timestamp_departments
BEFORE UPDATE ON departments
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();


--- ROW LEVEL SECURITY ---
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments FORCE ROW LEVEL SECURITY;


--- POLICIES ---
CREATE POLICY departments_select_access
ON departments
FOR SELECT USING (
    is_any_role()
);

CREATE POLICY departments_insert_access
ON departments
FOR INSERT WITH CHECK (
    is_administrator_role()
);

CREATE POLICY departments_update_access
ON departments
FOR UPDATE USING (
    is_administrator_role()
) WITH CHECK (
    is_administrator_role()
);

CREATE POLICY departments_delete_access
ON departments
FOR DELETE USING (
    is_administrator_role()
);
