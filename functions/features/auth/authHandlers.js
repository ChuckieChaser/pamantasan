// --- AUTH: CALLABLE HANDLERS ---

const { HttpsError } = require('firebase-functions/v2/https');
const { generateAndStoreOtp, verifyOtp, consumeOtp } = require('./otpService');
const { sendOtpEmail, sendUserProvisionEmail } = require('../notification/emailService');
const {
    verifyCredentialsAndMintToken,
    verifyAndHeartbeatSession,
    changeUserPassword,
    setUserClaims,
    provisionUser,
} = require('./authService');

const INSTITUTIONAL_DOMAIN = '@plpasig.edu.ph';


// --- HANDLERS ---

/**
 * Verifies University ID credentials, evaluates concurrency, enforces step-up OTP if active elsewhere,
 * and mints a custom token with role/department claims.
 */
const handleVerifyCredentialsAndMintToken = async (data, request) => {
    const rawData = data?.data ?? data;
    const identifier = rawData?.identifier;
    const password = rawData?.password;
    const otp = rawData?.otp;
    const token = rawData?.token;
    const ipAddress = request?.rawRequest?.ip || request?.ip || rawData?.ipAddress || 'Unknown IP';
    const userAgent = request?.rawRequest?.headers?.['user-agent'] || rawData?.userAgent || 'Unknown Device';

    try {
        return await verifyCredentialsAndMintToken({
            identifier,
            password,
            otp,
            token,
            ipAddress,
            userAgent,
        });
    } catch (error) {
        console.warn('[handleVerifyCredentialsAndMintToken] Failure:', error.message);
        throw new HttpsError('unauthenticated', error.message || 'Authentication failed.');
    }
};

/**
 * Validates active session heartbeat and refreshes expiredAt.
 * Immediately returns invalid if session was revoked/deleted on concurrency transfer.
 */
const handleVerifySessionHeartbeat = async (data, request) => {
    const rawData = data?.data ?? data;
    const sessionId = rawData?.sessionId;
    const userId = request?.auth?.uid || rawData?.userId;

    if (!sessionId || !userId) {
        throw new HttpsError('invalid-argument', 'Session ID and User ID are required.');
    }

    try {
        const result = await verifyAndHeartbeatSession({ sessionId, userId });
        return result;
    } catch (error) {
        console.error('[handleVerifySessionHeartbeat] Error:', error);
        throw new HttpsError('internal', error.message || 'Heartbeat verification failed.');
    }
};

/**
 * Changes user password with old password verification.
 */
const handleChangeUserPassword = async (data, request) => {
    const callerUid = request?.auth?.uid;
    if (!callerUid) {
        throw new HttpsError('unauthenticated', 'You must be signed in to change your password.');
    }

    const rawData = data?.data ?? data;
    const currentPassword = rawData?.currentPassword;
    const newPassword = rawData?.newPassword;

    try {
        return await changeUserPassword({
            uid: callerUid,
            currentPassword,
            newPassword,
        });
    } catch (error) {
        console.warn('[handleChangeUserPassword] Failed:', error.message);
        throw new HttpsError('invalid-argument', error.message || 'Failed to update password.');
    }
};

/**
 * Sets custom user claims (role, status, departmentId). Restricted to administrators.
 */
const handleSetUserClaims = async (data, request) => {
    const callerRole = request?.auth?.token?.role;
    if (callerRole !== 'ADMINISTRATOR') {
        throw new HttpsError('permission-denied', 'Only administrators can configure custom user claims.');
    }

    const rawData = data?.data ?? data;
    const targetUid = rawData?.uid || rawData?.targetUid;
    const role = rawData?.role;
    const status = rawData?.status;
    const departmentId = rawData?.departmentId;

    try {
        return await setUserClaims({ targetUid, role, status, departmentId });
    } catch (error) {
        console.error('[handleSetUserClaims] Error:', error);
        throw new HttpsError('internal', error.message || 'Failed to set user claims.');
    }
};

/**
 * Generates and emails a 6-digit OTP for password recovery.
 */
const handleSendPasswordResetOtp = async (data) => {
    const cleanEmail = ((data?.email ?? data?.data?.email) || '').toString().trim().toLowerCase();

    if (!cleanEmail) {
        throw new HttpsError('invalid-argument', 'Institutional email address is required.');
    }

    if (!cleanEmail.endsWith(INSTITUTIONAL_DOMAIN)) {
        throw new HttpsError('invalid-argument', `Email must belong to ${INSTITUTIONAL_DOMAIN}.`);
    }

    try {
        const { otp, token } = await generateAndStoreOtp(cleanEmail);
        await sendOtpEmail(cleanEmail, otp);

        return {
            success: true,
            token,
            message: `Verification code sent to ${cleanEmail}.`,
        };
    } catch (error) {
        console.error('[handleSendPasswordResetOtp] Failed:', error);
        throw new HttpsError('internal', error.message || 'Failed to dispatch verification code.');
    }
};

/**
 * Validates the 6-digit OTP against its signed token.
 */
const handleVerifyPasswordResetOtp = async (data) => {
    const cleanEmail = ((data?.email ?? data?.data?.email) || '').toString().trim().toLowerCase();
    const cleanOtp = ((data?.otp ?? data?.data?.otp) || '').toString().trim();
    const rawToken = data?.token ?? data?.data?.token;

    if (!cleanEmail || !cleanOtp) {
        throw new HttpsError('invalid-argument', 'Email and verification code are required.');
    }

    try {
        const result = await verifyOtp(cleanEmail, cleanOtp, rawToken);

        return {
            success: true,
            verified: true,
            token: result.token,
            message: 'Verification code confirmed.',
        };
    } catch (error) {
        console.warn('[handleVerifyPasswordResetOtp] Verification failure:', error.message);
        throw new HttpsError('invalid-argument', error.message || 'Invalid or expired verification code.');
    }
};

/**
 * Consumes and clears the OTP session after a successful password update.
 */
const handleConsumePasswordResetOtp = async () => {
    await consumeOtp();
    return { success: true };
};

/**
 * Sends account provisioning credentials upon user creation.
 */
const handleSendUserProvisionEmail = async (data) => {
    const cleanEmail = ((data?.email ?? data?.data?.email) || '').toString().trim().toLowerCase();
    const recipientName = (data?.recipientName ?? data?.data?.recipientName) || '';
    const universityId = ((data?.universityId ?? data?.data?.universityId) || '').toString().trim();
    const temporaryPassword = ((data?.temporaryPassword ?? data?.data?.temporaryPassword) || '').toString().trim();
    const loginUrl = (data?.loginUrl ?? data?.data?.loginUrl) || '';

    if (!cleanEmail) {
        throw new HttpsError('invalid-argument', 'Institutional email address is required.');
    }

    if (!universityId || !temporaryPassword) {
        throw new HttpsError('invalid-argument', 'University ID and temporary password are required.');
    }

    try {
        await sendUserProvisionEmail({
            toEmail: cleanEmail,
            recipientName,
            universityId,
            temporaryPassword,
            loginUrl,
        });

        return {
            success: true,
            message: `Provisioning credentials sent to ${cleanEmail}.`,
        };
    } catch (error) {
        console.error('[handleSendUserProvisionEmail] Failed:', error);
        throw new HttpsError('internal', error.message || 'Failed to dispatch user credentials.');
    }
};

/**
 * Provisions a user with secure server-side temporary password hashing, Firebase Auth creation, and email dispatch.
 * Restricted to administrators.
 */
const handleProvisionUser = async (data, request) => {
    const callerRole = request?.auth?.token?.role;
    if (callerRole !== 'ADMINISTRATOR') {
        throw new HttpsError('permission-denied', 'Only administrators can provision new user accounts.');
    }

    const rawData = data?.data ?? data;

    try {
        return await provisionUser(rawData);
    } catch (error) {
        console.error('[handleProvisionUser] Error:', error);
        throw new HttpsError('internal', error.message || 'Failed to provision user.');
    }
};

module.exports = {
    handleVerifyCredentialsAndMintToken,
    handleVerifySessionHeartbeat,
    handleChangeUserPassword,
    handleSetUserClaims,
    handleProvisionUser,
    handleSendPasswordResetOtp,
    handleVerifyPasswordResetOtp,
    handleConsumePasswordResetOtp,
    handleSendUserProvisionEmail,
};

