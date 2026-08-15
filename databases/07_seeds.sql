--- DEPARTMENTS ---
INSERT INTO departments (id, name, code)
VALUES
    ('d0000001-0000-4000-8000-000000000001', 'College of Computer Studies', 'CCS'),
    ('d0000001-0000-4000-8000-000000000002', 'Human Resources', 'HR')
ON CONFLICT (code)
DO NOTHING;


--- USERS ---
INSERT INTO users (id, university_id, department_id, role, email, avatar_path, first_name, middle_name, last_name, status)
VALUES
    ('f1000001-0000-4000-8000-000000000001', '20-00001', 'd0000001-0000-4000-8000-000000000001', 'ADMINISTRATOR', 'admin.ccs@plpasig.edu.ph', '/avatars/manny.jpg', 'Arthur', NULL, 'Pendragon', 'VERIFIED'),
    ('f1000001-0000-4000-8000-000000000002', '20-00002', 'd0000001-0000-4000-8000-000000000001', 'COORDINATOR', 'coord.ccs@plpasig.edu.ph', '/avatars/bugs.jpg', 'Cora', NULL, 'Smith', 'VERIFIED'),
    ('f1000001-0000-4000-8000-000000000003', '20-00003', 'd0000001-0000-4000-8000-000000000001', 'DIRECTOR', 'director.ccs@plpasig.edu.ph', '/avatars/jerry.jpg', 'Diana', NULL, 'Prince', 'VERIFIED'),
    ('f1000001-0000-4000-8000-000000000004', '20-00004', 'd0000001-0000-4000-8000-000000000001', 'OFFICER', 'officer.ccs@plpasig.edu.ph', '/avatars/johnny.jpg', 'Oliver', NULL, 'Queen', 'VERIFIED'),
    ('f1000001-0000-4000-8000-000000000005', '20-00005', 'd0000001-0000-4000-8000-000000000001', 'MEMBER', 'member.ccs@plpasig.edu.ph', '/avatars/mort.jpg', 'Marcus', NULL, 'Aurelius', 'VERIFIED'),
    ('f1000001-0000-4000-8000-000000000006', '21-00001', 'd0000001-0000-4000-8000-000000000002', 'MEMBER', 'member1.hr@plpasig.edu.ph', '/avatars/sid.jpg', 'Helena', NULL, 'Roosevelt', 'VERIFIED'),
    ('f1000001-0000-4000-8000-000000000007', '21-00002', 'd0000001-0000-4000-8000-000000000002', 'MEMBER', 'member2.hr@plpasig.edu.ph', '/avatars/kowalski.jpg', 'Henry', NULL, 'Wallace', 'VERIFIED')
ON CONFLICT (university_id)
DO NOTHING;


--- USER CREDENTIALS ---
UPDATE user_credentials
SET password_hash = 'password'
WHERE user_id
IN (
    'f1000001-0000-4000-8000-000000000001',
    'f1000001-0000-4000-8000-000000000002',
    'f1000001-0000-4000-8000-000000000003',
    'f1000001-0000-4000-8000-000000000004',
    'f1000001-0000-4000-8000-000000000005',
    'f1000001-0000-4000-8000-000000000006',
    'f1000001-0000-4000-8000-000000000007'
);


--- USER SETTINGS ---
UPDATE user_settings
SET theme = 'DARK'
WHERE user_id
IN (
    'f1000001-0000-4000-8000-000000000002',
    'f1000001-0000-4000-8000-000000000004',
    'f1000001-0000-4000-8000-000000000007'
);
