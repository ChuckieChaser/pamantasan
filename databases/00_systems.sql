--- EXTENSIONS ---
CREATE EXTENSION IF NOT EXISTS vector;


--- FUNCTIONS ---
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

CREATE OR REPLACE FUNCTION trigger_initialize_user_data()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_credentials (user_id, password_hash)
    VALUES (NEW.id, NEW.university_id)
    ON CONFLICT (user_id)
    DO NOTHING;

    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id)
    DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION trigger_cascade_folder_status()
RETURNS TRIGGER AS $$
DECLARE
    target_is_folder BOOLEAN;
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    IF OLD.status IS DISTINCT FROM NEW.status THEN
        SELECT is_folder
        INTO target_is_folder
        FROM public.documents
        WHERE id = NEW.document_id;

        IF target_is_folder THEN
            WITH RECURSIVE descendants
            AS (
                SELECT id
                FROM public.documents
                WHERE parent_id = NEW.document_id
                UNION ALL SELECT documents.id
                FROM public.documents
                JOIN descendants
                ON documents.parent_id = descendants.id
            )
            UPDATE public.document_shares
            SET status = NEW.status
            WHERE department_id = NEW.department_id
            AND document_id
            IN (
                SELECT id
                FROM descendants
            );
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

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
