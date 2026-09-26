// --- IMPORTS ---
import { httpsCallable } from 'firebase/functions';
import { signInWithPopup, signInWithCustomToken, signOut } from 'firebase/auth';

import { auth, functions, googleProvider } from '../../services/firebase';

import { LoginSchema, ForgotPasswordSchema, VerificationSchema, ResetPasswordSchema, ChangePasswordSchema } from './authSchema';
import { SYSTEM } from '../../constants';



// --- AUTHENTICATION SERVICES ---
export const loginWithUniversityId = async (payload) => {
    const rawPayload = {
        identifier: payload?.identifier || payload?.universityId,
        password: payload?.password,
        otp: payload?.otp,
        token: payload?.token,
    };
    const validated = LoginSchema.parse(rawPayload);

    if (!functions) {
        throw new Error('Firebase Functions is not initialized.');
    }

    const verifyCredentials = httpsCallable(functions, 'verifyCredentialsAndMintToken');
    const result = await verifyCredentials({
        identifier: validated.identifier,
        password: validated.password,
        otp: validated.otp ?? null,
        token: validated.token ?? null,
    });

    if (result?.data?.requiresStepUp) {
        return {
            requiresStepUp: true,
            maskedEmail: result.data.maskedEmail,
            token: result.data.token,
            message: result.data.message,
        };
    }

    const customToken = result?.data?.customToken;
    if (!customToken) {
        throw new Error('Authentication failed: No security token issued.');
    }

    if (result?.data?.sessionId) {
        try {
            localStorage.setItem('pamantasan_session_id', result.data.sessionId);
            localStorage.setItem('pamantasan_last_active_time', Date.now().toString());
        } catch {
            // Ignore storage write errors
        }
    }

    const userCredential = await signInWithCustomToken(auth, customToken);
    return {
        user: userCredential.user,
        sessionId: result.data.sessionId,
    };
};

export const verifySessionHeartbeat = async ({ sessionId, userId }) => {
    if (!functions || !sessionId || !userId) {
        return { valid: false };
    }

    try {
        const heartbeatFn = httpsCallable(functions, 'verifySessionHeartbeat');
        const res = await heartbeatFn({ sessionId, userId });
        return res?.data ?? { valid: false };
    } catch (err) {
        console.warn('[verifySessionHeartbeat] Session check failed:', err?.message);
        return { valid: false, reason: err?.message };
    }
};

export const terminateSession = async () => {
    try {
        localStorage.removeItem('pamantasan_session_id');
        localStorage.removeItem('pamantasan_last_active_time');
    } catch {
        // Ignore
    }
};

export const loginWithGoogle = async () => {
    if (!auth || !googleProvider) {
        throw new Error('Firebase Google Auth is not initialized.');
    }

    const userCredential = await signInWithPopup(auth, googleProvider);
    const email = userCredential.user?.email?.toLowerCase() ?? '';

    if (!email.endsWith(SYSTEM.EMAIL_DOMAIN)) {
        await signOut(auth);
        throw new Error(`Access restricted: Email must belong to ${SYSTEM.EMAIL_DOMAIN}`);
    }

    return userCredential.user;
};

export const logout = async () => {
    await terminateSession();
    if (auth) {
        await signOut(auth);
    }
};


// --- PASSWORD RECOVERY SERVICES ---
export const requestPasswordReset = async (payload) => {
    const validated = ForgotPasswordSchema.parse(payload);

    if (!functions) {
        throw new Error('Firebase Functions is not initialized.');
    }

    const sendOtp = httpsCallable(functions, 'sendPasswordResetOtp');
    const result = await sendOtp({ email: validated.email });

    return result?.data ?? { success: true };
};

export const verifyPasswordResetOtp = async (payload) => {
    const validated = VerificationSchema.parse(payload);

    if (!functions) {
        throw new Error('Firebase Functions is not initialized.');
    }

    const verifyOtp = httpsCallable(functions, 'verifyPasswordResetOtp');
    const result = await verifyOtp({
        email: validated.email,
        otp: validated.otp,
    });

    return result?.data ?? { success: true, verified: true };
};

export const resetPasswordWithOtp = async (payload) => {
    const validated = ResetPasswordSchema.parse(payload);

    if (!functions) {
        throw new Error('Firebase Functions is not initialized.');
    }

    const resetPwd = httpsCallable(functions, 'consumePasswordResetOtp');
    const result = await resetPwd({
        email: validated.email,
        otp: validated.otp,
        password: validated.password,
    });

    return result?.data ?? { success: true };
};


// --- ACCOUNT SERVICES ---
export const changePassword = async (payload) => {
    const validated = ChangePasswordSchema.parse(payload);

    if (!functions) {
        throw new Error('Firebase Functions is not initialized.');
    }

    const changePwd = httpsCallable(functions, 'changeUserPassword');
    const result = await changePwd({
        currentPassword: validated.currentPassword,
        newPassword: validated.newPassword,
    });

    return result?.data ?? { success: true };
};

export const linkGoogleAccount = async (targetEmail) => {
    if (!auth || !googleProvider) {
        throw new Error('Firebase Google Auth is not initialized.');
    }

    if (!targetEmail) {
        throw new Error('Target university email is required.');
    }

    const userCredential = await signInWithPopup(auth, googleProvider);
    const googleEmail = userCredential.user?.email?.toLowerCase() ?? '';
    const googleUid = userCredential.user?.uid;

    if (googleEmail !== targetEmail.toLowerCase()) {
        throw new Error('The selected Google account does not match your university email.');
    }

    return { googleId: googleUid, email: googleEmail };
};
