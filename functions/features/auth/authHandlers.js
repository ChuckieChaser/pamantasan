// --- AUTH: CALLABLE HANDLERS ---

const { HttpsError } = require('firebase-functions/v2/https');
const { generateAndStoreOtp, verifyOtp, consumeOtp } = require('./otpService');
const { sendOtpEmail, sendUserProvisionEmail } = require('../notification/emailService');

const INSTITUTIONAL_DOMAIN = '@plpasig.edu.ph';


// --- HANDLERS ---

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

module.exports = {
    handleSendPasswordResetOtp,
    handleVerifyPasswordResetOtp,
    handleConsumePasswordResetOtp,
    handleSendUserProvisionEmail,
};
