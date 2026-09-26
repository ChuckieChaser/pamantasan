// --- AUTH: OTP SERVICE ---
// Stateless OTP generation and verification backed by HMAC-signed tokens.
// No Firestore dependency — tokens are self-contained and cryptographically bound.

const crypto = require('crypto');

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;


// --- INTERNAL HELPERS ---

const getSecret = () =>
    process.env.OTP_SECRET ||
    process.env.GMAIL_APP_PASSWORD ||
    'plp-pamantasan-records-secret-key';

const hashOtp = (otp, email) =>
    crypto.createHash('sha256').update(`${otp}:${email.toLowerCase()}`).digest('hex');

const signToken = (payload) => {
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
    return `${data}.${signature}`;
};

const verifyToken = (token) => {
    if (!token || typeof token !== 'string') {
        throw new Error('Verification session expired or missing. Please request a new code.');
    }

    const dotIndex = token.lastIndexOf('.');
    if (dotIndex === -1) {
        throw new Error('Invalid verification token. Please request a new code.');
    }

    const data = token.substring(0, dotIndex);
    const signature = token.substring(dotIndex + 1);

    const expectedSig = crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSig);

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
        throw new Error('Invalid or tampered verification token. Please request a new code.');
    }

    try {
        return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    } catch {
        throw new Error('Malformed verification token.');
    }
};


// --- PUBLIC API ---

/**
 * Generates a 6-digit cryptographic OTP and returns a signed stateless token.
 * @param {string} email - Institutional email address.
 * @returns {{ otp: string, token: string, expiresAt: number }}
 */
const generateAndStoreOtp = async (email) => {
    const cleanEmail = email.trim().toLowerCase();
    const otp = crypto.randomInt(100000, 999999).toString();
    const codeHash = hashOtp(otp, cleanEmail);
    const expiresAt = Date.now() + OTP_EXPIRY_MS;

    const token = signToken({
        email: cleanEmail,
        codeHash,
        expiresAt,
        attempts: 0,
    });

    return { otp, token, expiresAt };
};

/**
 * Validates a provided OTP against the signed cryptographic token.
 * @param {string} email - Institutional email address.
 * @param {string} inputOtp - User-provided 6-digit code.
 * @param {string} token - Signed token from generateAndStoreOtp.
 * @returns {{ verified: boolean, token: string }}
 */
const verifyOtp = async (email, inputOtp, token) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = (inputOtp || '').toString().trim();

    const payload = verifyToken(token);

    if (payload.email !== cleanEmail) {
        throw new Error('Email does not match this verification session.');
    }

    if (Date.now() > payload.expiresAt) {
        throw new Error('Verification code has expired. Please request a new code.');
    }

    // Token already verified — idempotent success
    if (payload.verified) {
        return { verified: true, token };
    }

    if (!cleanOtp || cleanOtp.length !== 6) {
        throw new Error('Please enter a valid 6-digit code.');
    }

    const currentAttempts = payload.attempts || 0;
    if (currentAttempts >= MAX_ATTEMPTS) {
        throw new Error('Too many invalid attempts. Please request a new code.');
    }

    const expectedHash = hashOtp(cleanOtp, cleanEmail);
    if (payload.codeHash !== expectedHash) {
        const nextAttempts = currentAttempts + 1;
        const remaining = MAX_ATTEMPTS - nextAttempts;
        throw new Error(
            remaining > 0
                ? `Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
                : 'Too many invalid attempts. Please request a new code.',
        );
    }

    const verifiedToken = signToken({
        email: cleanEmail,
        verified: true,
        expiresAt: Date.now() + OTP_EXPIRY_MS,
    });

    return { verified: true, token: verifiedToken };
};

/**
 * No-op: OTP tokens are stateless — consumption is implicit on password change.
 * Kept for API contract compatibility.
 */
const consumeOtp = async () => true;

module.exports = {
    generateAndStoreOtp,
    verifyOtp,
    consumeOtp,
};
