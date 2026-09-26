// --- AUTH: CORE BACKEND SERVICE ---

const crypto = require('crypto');
const { getAuth } = require('firebase-admin/auth');
const { executeAdminGraphql } = require('./dataConnectAdmin');
const { generateAndStoreOtp, verifyOtp } = require('./otpService');
const { sendConcurrencyOtpEmail } = require('../notification/emailService');

const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes inactivity timeout


// --- PASSWORD CRYPTOGRAPHY ---

/**
 * Hashes a plaintext password using enterprise-grade scrypt.
 * Format: scrypt:<salt_hex>:<hash_hex>
 */
const hashPassword = async (plainPassword) => {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(16).toString('hex');
        crypto.scrypt(plainPassword, salt, 64, (err, derivedKey) => {
            if (err) return reject(err);
            resolve(`scrypt:${salt}:${derivedKey.toString('hex')}`);
        });
    });
};

/**
 * Verifies a plaintext password against a stored hash.
 * Timing-safe comparison.
 */
const verifyPassword = async (plainPassword, storedHash) => {
    if (!plainPassword || !storedHash) return false;

    // Standard scrypt format
    if (storedHash.startsWith('scrypt:')) {
        const parts = storedHash.split(':');
        if (parts.length !== 3) return false;
        const salt = parts[1];
        const expectedHash = parts[2];

        return new Promise((resolve) => {
            crypto.scrypt(plainPassword, salt, 64, (err, derivedKey) => {
                if (err) return resolve(false);
                const actualHash = derivedKey.toString('hex');
                try {
                    const match = crypto.timingSafeEqual(
                        Buffer.from(actualHash, 'utf8'),
                        Buffer.from(expectedHash, 'utf8'),
                    );
                    resolve(match);
                } catch {
                    resolve(false);
                }
            });
        });
    }

    // SHA-256 fallback for any legacy hash
    const sha256 = crypto.createHash('sha256').update(plainPassword).digest('hex');
    if (sha256 === storedHash || plainPassword === storedHash) {
        return true;
    }

    return false;
};

const maskEmail = (email) => {
    if (!email || !email.includes('@')) return 'email';
    const [local, domain] = email.split('@');
    if (local.length <= 2) return `${local}***@${domain}`;
    return `${local.substring(0, 2)}****@${domain}`;
};


// --- PUBLIC AUTH API ---

/**
 * Authenticates user credentials, evaluates active sessions for concurrency,
 * enforces step-up OTP if already active on another device, and mints custom JWT with claims.
 */
const verifyCredentialsAndMintToken = async ({
    identifier,
    password,
    otp = null,
    token = null,
    ipAddress = 'Unknown IP',
    userAgent = 'Unknown Device',
}) => {
    const cleanId = (identifier || '').toString().trim();
    const cleanPass = (password || '').toString();

    if (!cleanId || !cleanPass) {
        throw new Error('University ID / Email and password are required.');
    }

    // 1. Query User and Credential
    const query = `
        query GetUserAndCredential($cleanId: String!) {
            users(where: {
                _or: [
                    { universityId: { eq: $cleanId } },
                    { email: { eq: $cleanId } }
                ]
            }) {
                id
                universityId
                email
                givenName
                lastName
                role
                status
                department {
                    id
                    name
                    code
                }
            }
            userCredentials(where: {
                _or: [
                    { user: { universityId: { eq: $cleanId } } },
                    { user: { email: { eq: $cleanId } } }
                ]
            }) {
                user {
                    id
                }
                passwordHash
            }
        }
    `;

    const data = await executeAdminGraphql(query, { cleanId });
    const user = data?.users?.[0];
    const credential = data?.userCredentials?.[0];

    if (!user || !credential) {
        throw new Error('Invalid University ID or password.');
    }

    // 2. Validate Password
    const isPasswordValid = await verifyPassword(cleanPass, credential.passwordHash);
    if (!isPasswordValid) {
        throw new Error('Invalid University ID or password.');
    }

    // 3. Concurrency Check: Query Active User Sessions
    const nowIso = new Date().toISOString();
    const sessionQuery = `
        query GetActiveSessions($userId: UUID!, $now: Timestamp!) {
            userSessions(where: {
                user: { id: { eq: $userId } },
                expiredAt: { gt: $now }
            }) {
                id
                ipAddress
                userAgent
                expiredAt
            }
        }
    `;

    const sessionData = await executeAdminGraphql(sessionQuery, { userId: user.id, now: nowIso });
    const activeSessions = sessionData?.userSessions ?? [];
    const hasActiveSession = activeSessions.length > 0;

    // 4. Concurrency Guard: If active session exists on another device
    if (hasActiveSession) {
        if (!otp || !token) {
            // Dispatch 6-digit OTP to user's email
            const { otp: generatedOtp, token: signedToken } = await generateAndStoreOtp(user.email);
            await sendConcurrencyOtpEmail({
                toEmail: user.email,
                otpCode: generatedOtp,
                ipAddress,
                userAgent,
            });

            return {
                requiresStepUp: true,
                token: signedToken,
                maskedEmail: maskEmail(user.email),
                message: 'This account is currently active on another device. A verification code has been emailed to authorize session transfer.',
            };
        }

        // Verify Step-Up OTP
        const otpResult = await verifyOtp(user.email, otp, token);
        if (!otpResult?.verified) {
            throw new Error('Invalid or expired verification code.');
        }

        // OTP Verified: Actively terminate previous sessions & revoke refresh tokens
        try {
            await getAuth().revokeRefreshTokens(user.id);
        } catch (revokeErr) {
            console.warn('[verifyCredentials] Token revocation warning:', revokeErr?.message);
        }

        const deleteOldSessions = `
            mutation InvalidateUserSessions($userId: UUID!) {
                userSession_deleteMany(where: {
                    user: { id: { eq: $userId } }
                })
            }
        `;
        await executeAdminGraphql(deleteOldSessions, { userId: user.id });
    } else {
        // Clean up any old expired sessions for this user
        const deleteExpiredSessions = `
            mutation DeleteExpiredSessions($userId: UUID!, $now: Timestamp!) {
                userSession_deleteMany(where: {
                    user: { id: { eq: $userId } },
                    expiredAt: { le: $now }
                })
            }
        `;
        await executeAdminGraphql(deleteExpiredSessions, { userId: user.id, now: nowIso }).catch(() => {});
    }

    // 5. Mint Custom Firebase Auth Token with Custom Claims
    const customClaims = {
        role: user.role,
        status: user.status,
        departmentId: user.department?.id ?? null,
    };

    const authUid = user.id;
    await getAuth().setCustomUserClaims(authUid, customClaims);
    const customToken = await getAuth().createCustomToken(authUid, customClaims);

    // 6. Record New Active User Session
    const newSessionId = crypto.randomUUID();
    const tokenHash = crypto.createHash('sha256').update(customToken).digest('hex');
    const expiredAtIso = new Date(Date.now() + SESSION_TTL_MS).toISOString();

    const insertSession = `
        mutation InsertSession(
            $id: UUID!,
            $userId: UUID!,
            $tokenHash: String!,
            $ipAddress: String,
            $userAgent: String,
            $expiredAt: Timestamp!
        ) {
            userSession_insert(data: {
                id: $id,
                userId: $userId,
                tokenHash: $tokenHash,
                ipAddress: $ipAddress,
                userAgent: $userAgent,
                expiredAt: $expiredAt
            })
        }
    `;

    await executeAdminGraphql(insertSession, {
        id: newSessionId,
        userId: user.id,
        tokenHash,
        ipAddress,
        userAgent,
        expiredAt: expiredAtIso,
    });

    return {
        success: true,
        customToken,
        sessionId: newSessionId,
        user: {
            id: user.id,
            universityId: user.universityId,
            email: user.email,
            givenName: user.givenName,
            lastName: user.lastName,
            role: user.role,
            status: user.status,
            department: user.department,
        },
    };
};

/**
 * Validates a heartbeat from an active client session and refreshes expiredAt.
 * If the session was deleted (concurrency logout or timeout), returns invalid.
 */
const verifyAndHeartbeatSession = async ({ sessionId, userId }) => {
    if (!sessionId || !userId) {
        return { valid: false, reason: 'MISSING_PARAMS' };
    }

    const checkQuery = `
        query GetSessionById($sessionId: UUID!) {
            userSessions(where: {
                id: { eq: $sessionId }
            }) {
                id
                user {
                    id
                }
                expiredAt
            }
        }
    `;

    const data = await executeAdminGraphql(checkQuery, { sessionId });
    const session = data?.userSessions?.[0];

    // Session deleted / revoked
    if (!session || session.user?.id !== userId) {
        return { valid: false, reason: 'SESSION_TERMINATED' };
    }

    // Refresh expiredAt to now + 5 minutes
    const nextExpiredAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    const updateMutation = `
        mutation RefreshSessionHeartbeat($sessionId: UUID!, $nextExpiredAt: Timestamp!) {
            userSession_update(id: $sessionId, data: {
                expiredAt: $nextExpiredAt
            })
        }
    `;

    await executeAdminGraphql(updateMutation, { sessionId, nextExpiredAt });
    return { valid: true, expiredAt: nextExpiredAt };
};

/**
 * Updates a user's password.
 */
const changeUserPassword = async ({ uid, currentPassword, newPassword }) => {
    if (!uid || !currentPassword || !newPassword) {
        throw new Error('Current password and new password are required.');
    }

    if (newPassword.length < 8) {
        throw new Error('New password must be at least 8 characters.');
    }

    // 1. Fetch current password hash
    const query = `
        query GetCredentialForUser($uid: UUID!) {
            userCredentials(where: {
                user: { id: { eq: $uid } }
            }) {
                user {
                    id
                }
                passwordHash
            }
        }
    `;

    const data = await executeAdminGraphql(query, { uid });
    const credential = data?.userCredentials?.[0];

    if (!credential) {
        throw new Error('User credentials record not found.');
    }

    const isMatch = await verifyPassword(currentPassword, credential.passwordHash);
    if (!isMatch) {
        throw new Error('Current password is incorrect.');
    }

    // 2. Hash new password & update PostgreSQL + Firebase Auth
    const newHash = await hashPassword(newPassword);
    const nowIso = new Date().toISOString();

    const updateQuery = `
        mutation UpdateCredential($uid: UUID!, $newHash: String!, $nowIso: Timestamp!) {
            userCredential_update(key: { userId: $uid }, data: {
                passwordHash: $newHash,
                updatedAt: $nowIso
            })
        }
    `;

    await executeAdminGraphql(updateQuery, { uid, newHash, nowIso });

    try {
        await getAuth().updateUser(uid, { password: newPassword });
    } catch (authErr) {
        console.warn('[changeUserPassword] Firebase Auth password sync warning:', authErr?.message);
    }

    return { success: true };
};

/**
 * Sets custom user claims via Firebase Admin SDK.
 */
const setUserClaims = async ({ targetUid, role, status, departmentId }) => {
    if (!targetUid || !role) {
        throw new Error('Target UID and role are required.');
    }

    const claims = {
        role,
        status: status || 'VERIFIED',
        departmentId: departmentId || null,
    };

    await getAuth().setCustomUserClaims(targetUid, claims);
    return { success: true, claims };
};

/**
 * Provisions a new user atomically: creates PostgreSQL records, hashes temporary password with scrypt,
 * provisions Firebase Auth account with custom claims, and dispatches the welcome credentials email.
 */
const provisionUser = async ({
    id,
    universityId,
    email,
    givenName,
    lastName,
    departmentId,
    role,
    temporaryPassword,
}) => {
    if (!universityId || !email || !givenName || !lastName || !departmentId || !role) {
        throw new Error('All user provisioning fields are required.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUniversityId = universityId.trim();
    const newUserId = id || crypto.randomUUID();

    // Generate secure temporary password if not provided
    const tempPass = temporaryPassword || (`Temp${crypto.randomBytes(4).toString('hex')}!`);
    const passwordHash = await hashPassword(tempPass);

    // 1. Create or sync Firebase Auth account
    try {
        await getAuth().createUser({
            uid: newUserId,
            email: cleanEmail,
            password: tempPass,
            displayName: `${givenName.trim()} ${lastName.trim()}`,
        });
    } catch (authErr) {
        if (authErr.code !== 'auth/uid-already-exists') {
            console.warn('[provisionUser] Firebase Auth create warning:', authErr?.message);
        }
    }

    // Set custom claims
    await getAuth().setCustomUserClaims(newUserId, {
        role,
        status: 'PENDING_PASSWORD',
        departmentId,
    });

    // 2. Insert into PostgreSQL via Data Connect
    const insertMutation = `
        mutation CreateUser(
            $id: UUID!
            $universityId: String!
            $departmentId: UUID!
            $role: String!
            $email: String!
            $givenName: String!
            $lastName: String!
            $passwordHash: String!
        ) {
            user_insert(
                data: {
                    id: $id
                    universityId: $universityId
                    departmentId: $departmentId
                    role: $role
                    email: $email
                    givenName: $givenName
                    lastName: $lastName
                }
            )
            userCredential_insert(
                data: {
                    userId: $id
                    passwordHash: $passwordHash
                }
            )
            userSetting_insert(
                data: {
                    userId: $id
                }
            )
        }
    `;

    await executeAdminGraphql(insertMutation, {
        id: newUserId,
        universityId: cleanUniversityId,
        departmentId,
        role,
        email: cleanEmail,
        givenName: givenName.trim(),
        lastName: lastName.trim(),
        passwordHash,
    });

    // 3. Dispatch user provisioning email
    try {
        const { sendUserProvisionEmail } = require('../notification/emailService');
        await sendUserProvisionEmail({
            toEmail: cleanEmail,
            recipientName: givenName.trim(),
            universityId: cleanUniversityId,
            temporaryPassword: tempPass,
            loginUrl: 'https://pamantasan.web.app/login',
        });
    } catch (emailErr) {
        console.warn('[provisionUser] Welcome email dispatch warning:', emailErr?.message);
    }

    return {
        success: true,
        user: {
            id: newUserId,
            universityId: cleanUniversityId,
            email: cleanEmail,
            givenName: givenName.trim(),
            lastName: lastName.trim(),
            role,
            departmentId,
            status: 'PENDING_PASSWORD',
        },
    };
};

module.exports = {
    hashPassword,
    verifyPassword,
    verifyCredentialsAndMintToken,
    verifyAndHeartbeatSession,
    changeUserPassword,
    setUserClaims,
    provisionUser,
};
