import { initializeApp, getApps } from 'firebase/app';
import {
    signInWithPopup,
    signOut,
    getAuth,
    onAuthStateChanged as onFirebaseAuthChanged,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions, googleProvider, FIREBASE_CONFIGURATION } from './firebase';
import { userService, hashPassword } from './userService';
import { constants } from '../constants';


// --- CONFIGURATIONS ---
const authListeners = new Set();
let cachedCurrentUser = undefined;
let unsubscribeFirebase = null;
let activeSessionCreationPromise = null;
const SESSION_STORAGE_KEY = 'pamantasan_session_id';
const LOCAL_STORAGE_KEY = 'pamantasan_active_session_id';
const USER_STORAGE_KEY = 'pamantasan_auth_user_id';
const DEVICE_STORAGE_KEY = 'pamantasan_client_device_id';

const getClientDeviceId = () => {
    if (typeof localStorage === 'undefined') return 'device-default';
    try {
        let deviceId = localStorage.getItem(DEVICE_STORAGE_KEY);
        if (!deviceId) {
            deviceId = `dev-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
            localStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
        }
        return deviceId;
    } catch {
        return 'device-default';
    }
};


// --- SERVICES ---
const authService = {
    // CORE
    loginWithUniversityId: async (universityId, password, options = {}) => {
        const cleanUniversityId = universityId?.trim();
        if (!cleanUniversityId) {
            throw new Error('University ID is required.');
        }

        if (!password) {
            throw new Error('Account password is required.');
        }

        // 1. Resolve University ID to database user
        let databaseUser = await userService.fetchUserByUniversityId(cleanUniversityId);

        if (!databaseUser && cleanUniversityId.includes('@')) {
            databaseUser = await userService.fetchUserByEmail(cleanUniversityId.toLowerCase());
        }

        if (!databaseUser) {
            throw new Error(`No registered university account found for University ID "${cleanUniversityId}". Please verify your credentials or contact your administrator.`);
        }

        if (databaseUser.status === constants.USERS_STATUS.SUSPENDED) {
            throw new Error('This account has been suspended. Please contact your system administrator.');
        }

        // 2. Fetch UserCredential from Data Connect and verify against passwordHash
        const userCredentials = await userService.fetchUserCredentialsByUserId(databaseUser.id);
        if (!userCredentials || !userCredentials.passwordHash) {
            throw new Error('Invalid University ID or password. Please verify your credentials.');
        }

        const hashedInput = await hashPassword(password);
        const isPasswordMatch = (
            userCredentials.passwordHash === password ||
            userCredentials.passwordHash === hashedInput
        );

        if (!isPasswordMatch) {
            throw new Error('Invalid University ID or password. Please verify your credentials.');
        }

        // Auto-upgrade plaintext seed password to SHA-256 hash in Data Connect
        if (userCredentials.passwordHash === password && password !== hashedInput) {
            userService.updateUserCredential(databaseUser.id, {
                passwordHash: hashedInput,
            }).catch((err) => console.warn('Failed to upgrade seed password hash:', err));
        }

        // 3. Concurrency Guard: 1 active user session at a time
        const clientDeviceId = getClientDeviceId();
        const existingSessions = await userService.fetchUserSessionsByUserId(databaseUser.id);
        const now = Date.now();
        const activeSessions = (existingSessions || []).filter((session) => {
            if (!session?.expiredAt) return true;
            return new Date(session.expiredAt).getTime() > now;
        });

        const currentSessionId = authService.getCurrentSessionId();
        const storedToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('pamantasan_session_token') : null;
        const otherActiveSessions = activeSessions.filter((s) => {
            if (s.id === currentSessionId || s.tokenHash === currentSessionId) return false;
            if (storedToken && s.tokenHash === storedToken) return false;
            // Supersede orphaned session from this client/browser after network disconnect
            if (s.tokenHash && s.tokenHash.startsWith(`${clientDeviceId}:`)) return false;
            return true;
        });

        // Clean up any orphaned sessions previously created on this same device
        const ownOrphanedSessions = activeSessions.filter((s) =>
            s.tokenHash && s.tokenHash.startsWith(`${clientDeviceId}:`) && s.id !== currentSessionId && s.tokenHash !== storedToken
        );
        for (const orphaned of ownOrphanedSessions) {
            await userService.deleteUserSession(orphaned.id).catch(() => {});
        }

        if (otherActiveSessions.length > 0) {
            if (options?.force) {
                for (const otherSession of otherActiveSessions) {
                    await userService.deleteUserSession(otherSession.id).catch(() => {});
                }
            } else {
                const error = new Error('Access restricted: This account is currently active in another session. Concurrent logins are not permitted. Please log out from the other session first.');
                error.code = 'ERR_CONCURRENT_SESSION';
                throw error;
            }
        }

        // 4. Record active session
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(USER_STORAGE_KEY, databaseUser.id);
            if (databaseUser.email) {
                localStorage.setItem('pamantasan_auth_user_email', databaseUser.email);
            }
        }
        await ensureUserSession(databaseUser);

        notifyAuthListeners(databaseUser);
        return databaseUser;
    },

    loginWithGoogle: async (options = {}) => {
        if (!googleProvider) {
            throw new Error('Firebase Google Auth is not initialized.');
        }

        let secondaryApp = getApps().find((app) => app.name === 'googleLoginApp');
        if (!secondaryApp) {
            secondaryApp = initializeApp(FIREBASE_CONFIGURATION, 'googleLoginApp');
        }
        const secondaryAuth = getAuth(secondaryApp);

        let userCredential;
        try {
            userCredential = await signInWithPopupImmediate(secondaryAuth, googleProvider);
            const rawEmail = userCredential.user.email;
            const googleEmail = rawEmail ? rawEmail.toLowerCase() : '';
            const googleUid = userCredential.user.uid;
            const institutionalDomain = constants.INSTITUTIONAL_CONFIGURATION.EMAIL_DOMAIN;

            if (!googleEmail.endsWith(institutionalDomain)) {
                await safeSignOutFirebase(secondaryAuth);
                throw new Error(`Access restricted. Please sign in with an official institutional account (${institutionalDomain}).`);
            }

            const databaseUser = await userService.fetchUserByEmail(googleEmail);
            
            if (!databaseUser) {
                await safeSignOutFirebase(secondaryAuth);
                throw new Error(`No registered university account found for "${googleEmail}".`);
            }

            // Reject Google SSO if user is not VERIFIED (e.g. unlinked, pending password/SSO setup, or suspended)
            if (databaseUser.status !== constants.USERS_STATUS.VERIFIED) {
                await safeSignOutFirebase(secondaryAuth);
                if (databaseUser.status === constants.USERS_STATUS.SUSPENDED) {
                    throw new Error('This account has been suspended. Please contact your system administrator.');
                }
                throw new Error(`Google SSO is not linked for ${googleEmail}. Sign in with University ID to link in Settings.`);
            }

            // Verify Google SSO linking
            const userCredentials = await userService.fetchUserCredentialsByUserId(databaseUser.id);
            if (!userCredentials?.googleId || userCredentials.googleId !== googleUid) {
                await safeSignOutFirebase(secondaryAuth);
                throw new Error('Google SSO verification failed: Account not linked.');
            }

            // Save Google photo URL if available and sync with database user
            const googlePhotoUrl = userCredential.user?.photoURL;
            if (googlePhotoUrl) {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(`pamantasan_google_photo_url_${databaseUser.id}`, googlePhotoUrl);
                }
                databaseUser.googlePhotoUrl = googlePhotoUrl;

                try {
                    const settings = await userService.fetchUserSettingsByUserId(databaseUser.id);
                    const shouldSyncGoogleAvatar = settings?.avatar === constants.USER_SETTINGS_AVATAR.GOOGLE ||
                        !databaseUser.avatarPath ||
                        databaseUser.avatarPath === 'avatars/defaultAvatar.png' ||
                        databaseUser.avatarPath.startsWith('http');

                    if (shouldSyncGoogleAvatar && databaseUser.avatarPath !== googlePhotoUrl) {
                        await userService.updateUser(databaseUser.id, { avatarPath: googlePhotoUrl });
                        databaseUser.avatarPath = googlePhotoUrl;
                    }
                } catch (avatarSyncErr) {
                    console.warn('Failed to sync Google avatar into user record:', avatarSyncErr);
                }
            }

            // --- CONCURRENCY GUARD: 1 ACTIVE USER SESSION AT A TIME ---
            const clientDeviceId = getClientDeviceId();
            const existingSessions = await userService.fetchUserSessionsByUserId(databaseUser.id);
            const now = Date.now();
            const activeSessions = (existingSessions || []).filter((session) => {
                if (!session?.expiredAt) return true;
                return new Date(session.expiredAt).getTime() > now;
            });

            const currentSessionId = authService.getCurrentSessionId();
            const storedToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('pamantasan_session_token') : null;
            const otherActiveSessions = activeSessions.filter((s) => {
                if (s.id === currentSessionId || s.tokenHash === currentSessionId) return false;
                if (storedToken && s.tokenHash === storedToken) return false;
                if (s.tokenHash && s.tokenHash.startsWith(`${clientDeviceId}:`)) return false;
                return true;
            });

            const ownOrphanedSessions = activeSessions.filter((s) =>
                s.tokenHash && s.tokenHash.startsWith(`${clientDeviceId}:`) && s.id !== currentSessionId && s.tokenHash !== storedToken
            );
            for (const orphaned of ownOrphanedSessions) {
                await userService.deleteUserSession(orphaned.id).catch(() => {});
            }

            if (otherActiveSessions.length > 0) {
                if (options?.force) {
                    for (const otherSession of otherActiveSessions) {
                        await userService.deleteUserSession(otherSession.id).catch(() => {});
                    }
                } else {
                    await signOut(secondaryAuth);
                    const error = new Error('Access restricted: This account is currently active in another session. Concurrent logins are not permitted. Please log out from the other session first.');
                    error.code = 'ERR_CONCURRENT_SESSION';
                    throw error;
                }
            }

            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(USER_STORAGE_KEY, databaseUser.id);
            }
            await ensureUserSession(databaseUser);

            await signOut(secondaryAuth);

            notifyAuthListeners(databaseUser);
            return databaseUser;
        } catch (error) {
            console.error('Google Sign-In failed:', error);
            
            if (secondaryAuth?.currentUser) {
                try {
                    await signOut(secondaryAuth);
                } catch {
                    /* ignore */
                }
            }

            if (error.code === 'auth/popup-closed-by-user') {
                throw new Error('Sign-in cancelled. The Google sign-in window was closed before completing.', { cause: error });
            }
            
            throw error;
        }
    },

    linkGoogleAccount: async (targetEmail) => {
        if (!googleProvider) {
            throw new Error('Firebase Google Auth is not initialized.');
        }

        const cleanTargetEmail = targetEmail?.trim().toLowerCase();
        if (!cleanTargetEmail) {
            throw new Error('A valid registered university email is required to link Google SSO.');
        }

        let secondaryApp = getApps().find((app) => app.name === 'googleLinkApp');
        if (!secondaryApp) {
            secondaryApp = initializeApp(FIREBASE_CONFIGURATION, 'googleLinkApp');
        }
        const secondaryAuth = getAuth(secondaryApp);

        let userCredential;
        try {
            userCredential = await signInWithPopupImmediate(secondaryAuth, googleProvider);
            const rawEmail = userCredential.user.email;
            const selectedEmail = rawEmail ? rawEmail.toLowerCase() : '';
            const googleUid = userCredential.user.uid;

            // Guard: Ensure chosen account strictly matches the user's assigned university email
            if (selectedEmail !== cleanTargetEmail) {
                await safeSignOutFirebase(secondaryAuth);
                throw new Error('Account email mismatch.');
            }

            // Resolve target user: from cachedCurrentUser OR database lookup
            let targetUser = cachedCurrentUser;
            if (!targetUser || !targetUser.id || (targetUser.email && targetUser.email.toLowerCase() !== cleanTargetEmail)) {
                targetUser = await userService.fetchUserByEmail(cleanTargetEmail);
            }

            if (!targetUser?.id) {
                await safeSignOutFirebase(secondaryAuth);
                throw new Error('Account not found.');
            }

            await userService.upsertUserCredential(targetUser.id, {
                googleId: googleUid,
            });

            // Save Google photo URL if available and sync with database user
            const googlePhotoUrl = userCredential.user?.photoURL;
            let updatedUser = targetUser;

            if (googlePhotoUrl) {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(`pamantasan_google_photo_url_${targetUser.id}`, googlePhotoUrl);
                }
                targetUser.googlePhotoUrl = googlePhotoUrl;
                updatedUser = { ...updatedUser, googlePhotoUrl: googlePhotoUrl };

                try {
                    const settings = await userService.fetchUserSettingsByUserId(targetUser.id);
                    const shouldSyncGoogleAvatar = settings?.avatar === constants.USER_SETTINGS_AVATAR.GOOGLE ||
                        !targetUser.avatarPath ||
                        targetUser.avatarPath === 'avatars/defaultAvatar.png' ||
                        targetUser.avatarPath.startsWith('http');

                    if (shouldSyncGoogleAvatar) {
                        const res = await userService.updateUser(targetUser.id, { avatarPath: googlePhotoUrl });
                        if (res) {
                            updatedUser = { ...updatedUser, ...res, avatarPath: googlePhotoUrl };
                        }
                    }
                } catch (avatarSyncErr) {
                    console.warn('Failed to sync Google avatar during linking:', avatarSyncErr);
                }
            }

            // If user status is PENDING_SSO, promote to VERIFIED
            if (targetUser.status === constants.USERS_STATUS.PENDING_SSO) {
                try {
                    const res = await userService.updateUser(targetUser.id, {
                        status: constants.USERS_STATUS.VERIFIED,
                    });
                    if (res) {
                        updatedUser = { ...updatedUser, ...res, status: constants.USERS_STATUS.VERIFIED };
                    }
                } catch (statusErr) {
                    console.warn('Failed to promote user status to VERIFIED:', statusErr);
                }
            }

            notifyAuthListeners(updatedUser);
            await safeSignOutFirebase(secondaryAuth);

            return { googleId: googleUid, email: selectedEmail, photoURL: googlePhotoUrl };
        } catch (error) {
            console.error('Google linking failed:', error);
            await safeSignOutFirebase(secondaryAuth);
            if (error.code === 'auth/popup-closed-by-user') {
                throw new Error('Linking cancelled.', { cause: error });
            }
            throw error;
        }
    },

    unlinkGoogleAccount: async (userId) => {
        if (!userId) {
            throw new Error('User ID is required to unlink Google account.');
        }

        await userService.upsertUserCredential(userId, {
            googleId: null,
        });

        // Demote user status to PENDING_SSO
        let updatedUser = cachedCurrentUser ? { ...cachedCurrentUser, status: constants.USERS_STATUS.PENDING_SSO } : null;
        try {
            const res = await userService.updateUser(userId, {
                status: constants.USERS_STATUS.PENDING_SSO,
            });
            if (res) {
                updatedUser = { ...(cachedCurrentUser || {}), ...res, status: constants.USERS_STATUS.PENDING_SSO };
            }
        } catch (statusError) {
            console.warn('Failed to update user status to PENDING_SSO on unlink:', statusError);
        }

        if (updatedUser) {
            notifyAuthListeners(updatedUser);
        }

        // If avatar preference was GOOGLE, switch back to SYSTEM
        if (typeof localStorage !== 'undefined') {
            const pref = localStorage.getItem(`pamantasan_avatar_source_${userId}`);
            if (pref === constants.USER_SETTINGS_AVATAR.GOOGLE) {
                localStorage.setItem(`pamantasan_avatar_source_${userId}`, constants.USER_SETTINGS_AVATAR.SYSTEM);
                window.dispatchEvent(new Event('pamantasan-avatar-changed'));
            }
        }

        return true;
    },

    sendPasswordResetOtp: async (email) => {
        const cleanEmail = email?.trim().toLowerCase() ?? '';
        if (!cleanEmail) {
            throw new Error('Institutional email is required.');
        }

        if (!constants.VALIDATION_PATTERNS.EMAIL.test(cleanEmail)) {
            throw new Error(`Email must belong to ${constants.INSTITUTIONAL_CONFIGURATION.EMAIL_DOMAIN}`);
        }

        // 1. Verify user exists in Data Connect
        const dbUser = await userService.fetchUserByEmail(cleanEmail);
        if (!dbUser) {
            throw new Error(`No registered account found for "${cleanEmail}".`);
        }

        if (dbUser.status === constants.USERS_STATUS.SUSPENDED) {
            throw new Error('This account has been suspended. Please contact the administrator.');
        }

        // 2. Dispatch 6-digit OTP via Cloud Functions
        if (functions) {
            try {
                const sendOtp = httpsCallable(functions, 'sendPasswordResetOtp');
                const result = await sendOtp({ email: cleanEmail });
                const token = result?.data?.token;
                if (token && typeof sessionStorage !== 'undefined') {
                    sessionStorage.setItem('pamantasan_pwd_reset_token', token);
                }
                return result?.data ?? { success: true };
            } catch (error) {
                console.error('Cloud Function sendPasswordResetOtp failed:', error);
                throw new Error(error?.message || 'Failed to dispatch verification code.', { cause: error });
            }
        } else {
            throw new Error('Firebase Functions is not configured.');
        }
    },

    verifyPasswordResetOtp: async (email, otp) => {
        const cleanEmail = email?.trim().toLowerCase() ?? '';
        const cleanOtp = otp?.trim() ?? '';

        if (!cleanEmail || !cleanOtp) {
            throw new Error('Email and verification code are required.');
        }

        if (functions) {
            try {
                const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('pamantasan_pwd_reset_token') : null;
                const verifyOtp = httpsCallable(functions, 'verifyPasswordResetOtp');
                const result = await verifyOtp({ email: cleanEmail, otp: cleanOtp, token });
                if (result?.data?.token && typeof sessionStorage !== 'undefined') {
                    sessionStorage.setItem('pamantasan_pwd_reset_token', result.data.token);
                }
                return result?.data ?? { success: true, verified: true };
            } catch (error) {
                console.warn('Cloud Function verifyPasswordResetOtp failed:', error);
                throw new Error(error?.message || 'Invalid or expired verification code.', { cause: error });
            }
        } else {
            throw new Error('Firebase Functions is not configured.');
        }
    },

    resetPasswordWithOtp: async (email, otp, newPassword) => {
        const cleanEmail = email?.trim().toLowerCase() ?? '';
        if (!cleanEmail || !newPassword) {
            throw new Error('Missing required fields for password reset.');
        }

        if (newPassword.length < 8) {
            throw new Error('Password must be at least 8 characters long.');
        }

        // 1. Verify user exists in Data Connect
        const dbUser = await userService.fetchUserByEmail(cleanEmail);
        if (!dbUser?.id) {
            throw new Error('User account not found.');
        }

        // 2. Update UserCredential in Data Connect with SHA-256 hashed password
        const hashedPassword = await hashPassword(newPassword);
        await userService.updateUserCredential(dbUser.id, {
            passwordHash: hashedPassword,
        });

        // 3. Clean up reset session
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('pamantasan_pwd_reset_token');
        }

        return { success: true };
    },

    requestPasswordReset: async (email) => {
        return await authService.sendPasswordResetOtp(email);
    },

    sendUserProvisionEmail: async ({ email, recipientName, universityId, temporaryPassword, loginUrl }) => {
        const cleanEmail = email?.trim().toLowerCase() ?? '';
        if (!cleanEmail) {
            throw new Error('Institutional email is required.');
        }

        if (!functions) {
            console.warn('Firebase Functions is not configured. Provisioning email was skipped.');
            return { simulated: true };
        }

        try {
            const sendProvision = httpsCallable(functions, 'sendUserProvisionEmail');
            const result = await sendProvision({
                email: cleanEmail,
                recipientName,
                universityId,
                temporaryPassword,
                loginUrl: (loginUrl && !loginUrl.includes('localhost') && !loginUrl.includes('127.0.0.1'))
                    ? loginUrl
                    : 'https://pamantasan-records-210fe.web.app/login',
            });
            return result?.data ?? { success: true };
        } catch (error) {
            console.warn('Cloud Function sendUserProvisionEmail failed:', error);
            return { error: error?.message, success: false };
        }
    },

    changePassword: async (currentPassword, newPassword) => {
        if (!cachedCurrentUser?.id) {
            throw new Error('No authenticated user session found.');
        }

        // 1. Fetch credentials from Data Connect
        const userCredentials = await userService.fetchUserCredentialsByUserId(cachedCurrentUser.id);
        if (!userCredentials || !userCredentials.passwordHash) {
            throw new Error('User credentials record not found.');
        }

        // 2. Verify current password
        const hashedCurrent = await hashPassword(currentPassword);
        const isMatch = (
            userCredentials.passwordHash === currentPassword ||
            userCredentials.passwordHash === hashedCurrent
        );

        if (!isMatch) {
            throw new Error('Current password is incorrect. Please try again.');
        }

        // 3. Hash new password and update in Data Connect
        const hashedNew = await hashPassword(newPassword);
        await userService.updateUserCredential(cachedCurrentUser.id, {
            passwordHash: hashedNew,
        });

        // 4. If status was PENDING_PASSWORD, promote to PENDING_SSO
        if (cachedCurrentUser.status === constants.USERS_STATUS.PENDING_PASSWORD) {
            try {
                const updatedUser = await userService.updateUser(cachedCurrentUser.id, {
                    status: constants.USERS_STATUS.PENDING_SSO,
                });
                if (updatedUser) {
                    notifyAuthListeners(updatedUser);
                }
            } catch (statusError) {
                console.warn('Failed to promote user status to PENDING_SSO:', statusError);
            }
        }
    },

    logout: async () => {
        const sessionId = authService.getCurrentSessionId();
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
            sessionStorage.removeItem('pamantasan_session_token');
            if (cachedCurrentUser?.id) {
                sessionStorage.removeItem(`pamantasan_session_skip_sso_${cachedCurrentUser.id}`);
            }
        }
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            localStorage.removeItem(USER_STORAGE_KEY);
            localStorage.removeItem('pamantasan_auth_user_email');
        }
        if (sessionId && !sessionId.startsWith('session-')) {
            try {
                await userService.deleteUserSession(sessionId);
            } catch (err) {
                console.warn('Failed to delete user session in database:', err);
            }
        }
        if (auth) {
            try {
                await signOut(auth);
            } catch {
                /* ignore */
            }
        }
        notifyAuthListeners(null);
    },

    hasSkippedSSOOnboarding: (userId) => {
        if (!userId) return false;
        try {
            const inSession = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(`pamantasan_session_skip_sso_${userId}`) === 'true';
            const inLocal = typeof localStorage !== 'undefined' && localStorage.getItem(`pamantasan_skip_sso_onboarding_${userId}`) === 'true';
            return inSession || inLocal;
        } catch {
            return false;
        }
    },

    setSkippedSSOOnboarding: (userId, persistOnPC = false) => {
        if (!userId) return;
        try {
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem(`pamantasan_session_skip_sso_${userId}`, 'true');
            }
            if (persistOnPC && typeof localStorage !== 'undefined') {
                localStorage.setItem(`pamantasan_skip_sso_onboarding_${userId}`, 'true');
            }
        } catch {
            /* ignore */
        }
    },

    getCurrentSessionId: () => {
        if (typeof sessionStorage !== 'undefined') {
            const sid = sessionStorage.getItem(SESSION_STORAGE_KEY);
            if (sid) return sid;
        }
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem(LOCAL_STORAGE_KEY);
        }
        return null;
    },

    // LISTENERS
    fetchCurrentUser: () => {
        return cachedCurrentUser;
    },

    resolveCurrentUser: () => {
        if (cachedCurrentUser !== undefined) {
            return Promise.resolve(cachedCurrentUser);
        }

        return new Promise((resolve) => {
            const unsubscribe = authService.onAuthStateChanged((user) => {
                unsubscribe();
                resolve(user);
            });
        });
    },

    onAuthStateChanged: (callback) => {
        authListeners.add(callback);

        if (cachedCurrentUser !== undefined) {
            callback(cachedCurrentUser);
        } else {
            const storedUserId = typeof localStorage !== 'undefined' ? localStorage.getItem(USER_STORAGE_KEY) : null;
            if (storedUserId) {
                (async () => {
                    try {
                        const databaseUser = await userService.fetchUserById(storedUserId);
                        if (!databaseUser || databaseUser.status === constants.USERS_STATUS.SUSPENDED) {
                            authService.logout();
                            return;
                        }

                        // Check active session concurrency
                        const clientDeviceId = getClientDeviceId();
                        const existingSessions = await userService.fetchUserSessionsByUserId(databaseUser.id);
                        const now = Date.now();
                        const activeSessions = (existingSessions || []).filter((s) => {
                            if (!s?.expiredAt) return true;
                            return new Date(s.expiredAt).getTime() > now;
                        });

                        const currentSessionId = authService.getCurrentSessionId();
                        const storedToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('pamantasan_session_token') : null;
                        const clientOwnsSession = currentSessionId && activeSessions.some((s) => (
                            s.id === currentSessionId ||
                            s.tokenHash === currentSessionId ||
                            (storedToken && s.tokenHash === storedToken) ||
                            (s.tokenHash && s.tokenHash.startsWith(`${clientDeviceId}:`))
                        ));

                        // If client has a session ID but no matching active session exists in database, terminate (only if online)
                        if (currentSessionId && !clientOwnsSession) {
                            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                                // Offline: do not terminate session
                            } else {
                                authService.logout();
                                return;
                            }
                        }

                        notifyAuthListeners(databaseUser);
                        ensureUserSession(databaseUser).catch(() => {});
                    } catch (error) {
                        console.error('Failed to restore user session:', error);
                        if (typeof navigator !== 'undefined' && !navigator.onLine) {
                            // Offline: retain cached session if available
                        } else {
                            notifyAuthListeners(null);
                        }
                    }
                })();
            } else if (!auth) {
                callback(null);
            }
        }

        if (!unsubscribeFirebase && auth) {
            unsubscribeFirebase = onFirebaseAuthChanged(auth, async (firebaseUser) => {
                const storedUserId = typeof localStorage !== 'undefined' ? localStorage.getItem(USER_STORAGE_KEY) : null;
                if (!firebaseUser) {
                    if (!storedUserId) {
                        notifyAuthListeners(null);
                    }
                    return;
                }

                try {
                    // If user is already authenticated via local database session, maintain it
                    if (storedUserId) {
                        const localUser = await userService.fetchUserById(storedUserId);
                        if (localUser && localUser.status !== constants.USERS_STATUS.SUSPENDED) {
                            notifyAuthListeners(localUser);
                            return;
                        }
                    }

                    let databaseUser = await userService.fetchUserByEmail(firebaseUser.email);
                    if (!databaseUser || databaseUser.status === constants.USERS_STATUS.SUSPENDED) {
                        await safeSignOutFirebase(auth);
                        if (!storedUserId) {
                            notifyAuthListeners(null);
                        }
                        return;
                    }

                    // Check that Google SSO is actually linked in the database
                    const userCredentials = await userService.fetchUserCredentialsByUserId(databaseUser.id);
                    if (!userCredentials?.googleId || userCredentials.googleId !== firebaseUser.uid) {
                        await safeSignOutFirebase(auth);
                        if (!storedUserId) {
                            notifyAuthListeners(null);
                        }
                        return;
                    }

                    // Check active session concurrency on resume/reload
                    const existingSessions = await userService.fetchUserSessionsByUserId(databaseUser.id);
                    const now = Date.now();
                    const activeSessions = (existingSessions || []).filter((s) => {
                        if (!s?.expiredAt) return true;
                        return new Date(s.expiredAt).getTime() > now;
                    });

                    const currentSessionId = authService.getCurrentSessionId();
                    const storedToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('pamantasan_session_token') : null;
                    const clientOwnsSession = !currentSessionId || activeSessions.some((s) => (
                        s.id === currentSessionId ||
                        s.tokenHash === currentSessionId ||
                        (storedToken && s.tokenHash === storedToken)
                    ));

                    if (activeSessions.length > 0 && currentSessionId && !clientOwnsSession) {
                        await safeSignOutFirebase(auth);
                        if (!storedUserId) {
                            notifyAuthListeners(null);
                        }
                        return;
                    }

                    if (typeof localStorage !== 'undefined') {
                        localStorage.setItem(USER_STORAGE_KEY, databaseUser.id);
                    }

                    notifyAuthListeners(databaseUser);
                    ensureUserSession(databaseUser).catch(() => {});
                } catch (error) {
                    console.error('Failed to sync authenticated user with database:', error);
                    if (!storedUserId) {
                        notifyAuthListeners(null);
                    }
                }
            });
        }

        return () => {
            authListeners.delete(callback);
            if (authListeners.size === 0 && unsubscribeFirebase) {
                unsubscribeFirebase();
                unsubscribeFirebase = null;
            }
        };
    },
};


// --- HELPERS ---
async function signInWithPopupImmediate(authInstance, provider) {
    let popupRef = null;
    const originalOpen = typeof window !== 'undefined' ? window.open : null;

    if (originalOpen && typeof window !== 'undefined') {
        window.open = function (...args) {
            popupRef = originalOpen.apply(this, args);
            return popupRef;
        };
    }

    let pollInterval = null;
    try {
        const popupPromise = signInWithPopup(authInstance, provider);

        if (originalOpen && typeof window !== 'undefined') {
            window.open = originalOpen;
        }

        const closeDetectorPromise = new Promise((_, reject) => {
            pollInterval = setInterval(() => {
                try {
                    if (popupRef && popupRef.closed) {
                        clearInterval(pollInterval);
                        pollInterval = null;
                        setTimeout(() => {
                            const err = new Error('Sign-in cancelled.');
                            err.code = 'auth/popup-closed-by-user';
                            reject(err);
                        }, 100);
                    }
                } catch {
                    /* ignore */
                }
            }, 150);
        });

        return await Promise.race([popupPromise, closeDetectorPromise]);
    } finally {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
        if (originalOpen && typeof window !== 'undefined') {
            window.open = originalOpen;
        }
    }
}

async function safeSignOutFirebase(authInstance) {
    if (authInstance) {
        try {
            await signOut(authInstance);
        } catch {
            /* ignore */
        }
    }
}

async function ensureUserSession(user) {
    if (!user?.id) {
        return null;
    }

    if (activeSessionCreationPromise) {
        return activeSessionCreationPromise;
    }

    activeSessionCreationPromise = (async () => {
        try {
            const cachedSessionId = authService.getCurrentSessionId();
            const storedToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('pamantasan_session_token') : null;

            if (cachedSessionId) {
                try {
                    const existingSessions = await userService.fetchUserSessionsByUserId(user.id);
                    const hasValidSession = (existingSessions || []).some(
                        (s) => s.id === cachedSessionId || s.tokenHash === cachedSessionId || (storedToken && s.tokenHash === storedToken)
                    );
                    if (hasValidSession) {
                        return { id: cachedSessionId };
                    }
                } catch {
                    // Fallback to cached on network blip
                    return { id: cachedSessionId };
                }
            }
            const timestamp = new Date().toISOString();
            const expiredAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            const rawUa = typeof navigator !== 'undefined' ? navigator.userAgent : '';
            const userAgent = parseUserAgent(rawUa);
            const clientDeviceId = getClientDeviceId();
            const rawUid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`;
            const tokenHash = `${clientDeviceId}:${rawUid}`;
            const ipAddress = await resolveClientIp();

            const createdSession = await userService.insertUserSession({
                userId: user.id,
                tokenHash: tokenHash,
                ipAddress: ipAddress,
                userAgent: userAgent,
                createdAt: timestamp,
                expiredAt: expiredAt,
            });

            const resultingSessionId = createdSession?.id || tokenHash;

            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem(SESSION_STORAGE_KEY, resultingSessionId);
                sessionStorage.setItem('pamantasan_session_token', tokenHash);
            }
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(LOCAL_STORAGE_KEY, resultingSessionId);
            }

            return createdSession;
        } catch (error) {
            console.warn('Failed to record user session in database:', error);
            return null;
        } finally {
            activeSessionCreationPromise = null;
        }
    })();

    return activeSessionCreationPromise;
}

function parseUserAgent(uaString) {
    if (!uaString) return 'Google Chrome on Windows';

    let browser = 'Web Browser';
    let os = 'Windows';

    if (/Edg\//i.test(uaString)) {
        browser = 'Microsoft Edge';
    } else if (/OPR\//i.test(uaString) || /Opera/i.test(uaString)) {
        browser = 'Opera';
    } else if (/Chrome\//i.test(uaString)) {
        browser = 'Google Chrome';
    } else if (/Firefox\//i.test(uaString)) {
        browser = 'Mozilla Firefox';
    } else if (/Safari\//i.test(uaString)) {
        browser = 'Apple Safari';
    }

    if (/Windows/i.test(uaString)) {
        os = 'Windows';
    } else if (/Macintosh|Mac OS/i.test(uaString)) {
        os = 'macOS';
    } else if (/Android/i.test(uaString)) {
        os = 'Android';
    } else if (/iPhone|iPad|iPod/i.test(uaString)) {
        os = 'iOS';
    } else if (/Linux/i.test(uaString)) {
        os = 'Linux';
    }

    return `${browser} on ${os}`;
}

async function resolveClientIp() {
    if (typeof window === 'undefined') return '127.0.0.1';
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);
        const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
            const data = await res.json();
            if (data?.ip) return data.ip;
        }
    } catch {
        // Fallback for offline / intranet
    }
    return '127.0.0.1';
}

function notifyAuthListeners(user) {
    cachedCurrentUser = user;
    authListeners.forEach((listener) => {
        try {
            listener(user);
        } catch (error) {
            console.error('Auth listener execution failure:', error);
        }
    });
}


// --- EXPORTS ---
export { authService };


