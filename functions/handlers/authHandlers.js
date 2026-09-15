// --- IMPORTS ---
const { HttpsError } = require('firebase-functions/v2/https');
const { generateAndStoreOtp, verifyOtp, consumeOtp } = require('../services/otpService');
const { sendOtpEmail, sendUserProvisionEmail } = require('../services/emailService');

const INSTITUTIONAL_DOMAIN = '@plpasig.edu.ph';

/**
 * Callable function to generate and email a 6-digit OTP code to the user.
 */
async function handleSendPasswordResetOtp(data) {
    const rawEmail = data?.email || data?.data?.email;
    const cleanEmail = (rawEmail || '').toString().trim().toLowerCase();

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
            token: token,
            message: `Verification code sent to ${cleanEmail}.`,
        };
    } catch (error) {
        console.error('[handleSendPasswordResetOtp] Failed:', error);
        throw new HttpsError('internal', error.message || 'Failed to dispatch verification code.');
    }
}

/**
 * Callable function to verify the 6-digit OTP.
 */
async function handleVerifyPasswordResetOtp(data) {
    const rawEmail = data?.email || data?.data?.email;
    const rawOtp = data?.otp || data?.data?.otp;
    const rawToken = data?.token || data?.data?.token;
    const cleanEmail = (rawEmail || '').toString().trim().toLowerCase();
    const cleanOtp = (rawOtp || '').toString().trim();

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
}

/**
 * Callable function to consume the OTP after password reset.
 */
async function handleConsumePasswordResetOtp(data) {
    await consumeOtp();
    return { success: true };
}

/**
 * Callable function to send account provisioning email with credentials upon account creation.
 */
async function handleSendUserProvisionEmail(data) {
    const rawEmail = data?.email || data?.data?.email;
    const cleanEmail = (rawEmail || '').toString().trim().toLowerCase();
    const recipientName = data?.recipientName || data?.data?.recipientName || '';
    const universityId = (data?.universityId || data?.data?.universityId || '').toString().trim();
    const temporaryPassword = (data?.temporaryPassword || data?.data?.temporaryPassword || '').toString().trim();
    const loginUrl = data?.loginUrl || data?.data?.loginUrl || '';

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
}

module.exports = {
    handleSendPasswordResetOtp,
    handleVerifyPasswordResetOtp,
    handleConsumePasswordResetOtp,
    handleSendUserProvisionEmail,
};
