-- ============================================================================
-- PAMANTASAN SEED: INITIAL ADMINISTRATOR & DEPARTMENT
-- ============================================================================

-- 1. Ensure Default Department Exists
INSERT INTO "department" ("id", "name", "code", "created_at", "updated_at")
VALUES (
    'd0000001-0000-4000-8000-000000000001',
    'College of Computer Studies',
    'CCS',
    NOW(),
    NOW()
) ON CONFLICT ("id") DO NOTHING;

-- 2. Insert Administrator Record
INSERT INTO "user" (
    "id",
    "university_id",
    "department_id",
    "role",
    "email",
    "first_name",
    "middle_name",
    "last_name",
    "avatar_path",
    "status",
    "created_at",
    "updated_at"
) VALUES (
    'f1000001-0000-4000-8000-000000000001',
    '23-00165',
    'd0000001-0000-4000-8000-000000000001',
    'ADMINISTRATOR',
    'campos_charlesdustin@plpasig.edu.ph',
    'Charles Dustin',
    'Mondia',
    'Campos',
    'avatars/placeholder.png',
    'VERIFIED',
    NOW(),
    NOW()
) ON CONFLICT ("id") DO UPDATE SET
    "university_id" = EXCLUDED."university_id",
    "email" = EXCLUDED."email",
    "first_name" = EXCLUDED."first_name",
    "middle_name" = EXCLUDED."middle_name",
    "last_name" = EXCLUDED."last_name",
    "status" = EXCLUDED."status";

-- 3. Insert Admin Credentials & Settings
INSERT INTO "user_credential" ("user_id", "password_hash", "created_at", "updated_at")
VALUES (
    'f1000001-0000-4000-8000-000000000001',
    'password',
    NOW(),
    NOW()
) ON CONFLICT ("user_id") DO UPDATE SET
    "password_hash" = EXCLUDED."password_hash";

INSERT INTO "user_setting" ("user_id", "theme", "notification", "avatar", "created_at", "updated_at")
VALUES (
    'f1000001-0000-4000-8000-000000000001',
    'DARK',
    'ALL',
    'SYSTEM',
    NOW(),
    NOW()
) ON CONFLICT ("user_id") DO UPDATE SET
    "theme" = EXCLUDED."theme",
    "notification" = EXCLUDED."notification",
    "avatar" = EXCLUDED."avatar";
