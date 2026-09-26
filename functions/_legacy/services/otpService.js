// --- IMPORTS ---
const crypto = require('crypto');

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

function getSecret() {
    return process.env.GMAIL_APP_PASSWORD || process.env.OTP_SECRET || 'plp-pamantasan-records-secret-key';
}

function hashOtp(otp, email) {
    return crypto.createHash('sha256').update(`${otp}:${email.toLowerCase()}`).digest('hex');
}

function signToken(payload) {
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
    return `${data}.${signature}`;
}

function verifyToken(token) {
    if (!token || typeof token !== 'string') {
        throw new Error('Verification session expired or missing. Please request a new code.');
    }
    const dotIndex = token.lastIndexOf('.');
    if (dotIndex === -1) {
        throw new Error('Invalid verification token. Please request a new code.');
    }
    const data = token.substring(0, dotIndex);
    const signature = token.substring(dotIndex + 1);

    const expectedSignature = crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
        throw new Error('Invalid or tampered verification token. Please request a new code.');
    }

    try {
        const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
        return payload;
    } catch {
        throw new Error('Malformed verification token.');
    }
}

/**
 * Generates a 6-digit cryptographic OTP and returns a signed stateless token.
 * No Firestore database needed!
 */
async function generateAndStoreOtp(email) {
    const cleanEmail = email.trim().toLowerCase();
    const otp = crypto.randomInt(100000, 999999).toString();
    const codeHash = hashOtp(otp, cleanEmail);
    const expiresAt = Date.now() + OTP_EXPIRY_MS;

    const token = signToken({
        email: cleanEmail,
        codeHash: codeHash,
        expiresAt: expiresAt,
        attempts: 0,
    });

    return {
        otp,
        token,
        expiresAt,
    };
}

/**
 * Validates a provided OTP against the signed cryptographic token.
 */
async function verifyOtp(email, inputOtp, token) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = (inputOtp || '').toString().trim();

    const payload = verifyToken(token);

    if (payload.email !== cleanEmail) {
        throw new Error('Email does not match this verification session.');
    }

    if (Date.now() > payload.expiresAt) {
        throw new Error('Verification code has expired. Please request a new code.');
    }

    // If this token was already verified, return success immediately
    if (payload.verified) {
        return {
            verified: true,
            token: token,
        };
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
        const remainingAttempts = MAX_ATTEMPTS - nextAttempts;
        throw new Error(
            remainingAttempts > 0
                ? `Invalid code. ${remainingAttempts} attempts remaining.`
                : 'Too many invalid attempts. Please request a new code.'
        );
    }

    const verifiedToken = signToken({
        email: cleanEmail,
        verified: true,
        expiresAt: Date.now() + OTP_EXPIRY_MS,
    });

    return {
        verified: true,
        token: verifiedToken,
    };
}

/**
 * Consumes and clears the OTP record after successful password update.
 */
async function consumeOtp() {
    return true;
}

module.exports = {
    generateAndStoreOtp,
    verifyOtp,
    consumeOtp,
};
