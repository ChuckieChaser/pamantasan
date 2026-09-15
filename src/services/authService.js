// --- IMPORTS ---
import { signInWithEmailAndPassword, signInWithPopup, signOut, sendPasswordResetEmail, onAuthStateChanged as onFirebaseAuthChanged } from 'firebase/auth';
import { auth, googleProvider } from './firebase';

import { userService } from './userService';
import { constants } from '../constants';


// --- CONFIGURATIONS ---
const authListeners = new Set();
let cachedCurrentUser = undefined;
let unsubscribeFirebase = null;


// --- SERVICES ---
const authService = {
    // CORE
    loginWithUniversityId: async (universityId, password) => {
        const resolvedEmail = mapUniversityIdToEmail(universityId);

        if (!auth) {
            throw new Error('Firebase Auth is not initialized.');
        }

        try {
            const userCredential = await signInWithEmailAndPassword(auth, resolvedEmail, password);
            const firebaseUser = userCredential.user;

            let databaseUser = await userService.fetchUserByEmail(firebaseUser.email);
            
            if (!databaseUser && universityId) {
                databaseUser = await userService.fetchUserByUniversityId(universityId);
            }

            if (!databaseUser) {
                await signOut(auth);
                throw new Error('No registered university account found for this user. Please contact your administrator to provision your account.');
            }

            if (databaseUser.status === constants.USERS_STATUS.SUSPENDED) {
                await signOut(auth);
                throw new Error('This account has been suspended. Please contact your system administrator.');
            }

            notifyAuthListeners(databaseUser);
            return databaseUser;
        } catch (error) {
            console.error('Login failed:', error);
            
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                throw new Error('Invalid University ID or password. Please verify your credentials.', { cause: error });
            }
            
            if (error.code === 'auth/user-not-found') {
                throw new Error(`Account for "${universityId}" not found.`, { cause: error });
            }
            
            throw error;
        }
    },

    loginWithGoogle: async () => {
        if (!auth || !googleProvider) {
            throw new Error('Firebase Google Auth is not initialized.');
        }

        try {
            const userCredential = await signInWithPopup(auth, googleProvider);
            const rawEmail = userCredential.user.email;
            const googleEmail = rawEmail ? rawEmail.toLowerCase() : '';
            const institutionalDomain = constants.INSTITUTIONAL_CONFIGURATION.EMAIL_DOMAIN;

            if (!googleEmail.endsWith(institutionalDomain)) {
                await signOut(auth);
                throw new Error(`Access restricted. Please sign in with an official institutional account (${institutionalDomain}).`);
            }

            const databaseUser = await userService.fetchUserByEmail(googleEmail);
            
            if (!databaseUser) {
                await signOut(auth);
                throw new Error('No registered university account found for this email. Please contact your system administrator to provision your account.');
            }

            if (databaseUser.status === constants.USERS_STATUS.SUSPENDED) {
                await signOut(auth);
                throw new Error('This account has been suspended. Please contact your system administrator.');
            }

            notifyAuthListeners(databaseUser);
            return databaseUser;
        } catch (error) {
            console.error('Google Sign-In failed:', error);
            
            if (error.code === 'auth/popup-closed-by-user') {
                throw new Error('Sign-in cancelled. The Google sign-in window was closed before completing.', { cause: error });
            }
            
            throw error;
        }
    },

    requestPasswordReset: async (email) => {
        if (!auth) {
            throw new Error('Firebase Auth is not initialized.');
        }

        const cleanEmail = email?.trim().toLowerCase() ?? '';

        if (!cleanEmail) {
            throw new Error('Institutional email is required.');
        }

        if (!constants.VALIDATION_PATTERNS.EMAIL.test(cleanEmail)) {
            throw new Error(`Email must belong to ${constants.INSTITUTIONAL_CONFIGURATION.EMAIL_DOMAIN}`);
        }

        try {
            await sendPasswordResetEmail(auth, cleanEmail);
        } catch (error) {
            console.error('Password reset request failed:', error);

            if (error.code === 'auth/user-not-found') {
                throw new Error(`No registered account found for "${cleanEmail}".`, { cause: error });
            }

            throw error;
        }
    },

    logout: async () => {
        if (auth) {
            await signOut(auth);
        }
        notifyAuthListeners(null);
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
        } else if (!auth) {
            callback(null);
        }

        if (!unsubscribeFirebase && auth) {
            unsubscribeFirebase = onFirebaseAuthChanged(auth, async (firebaseUser) => {
                if (!firebaseUser) {
                    notifyAuthListeners(null);
                    return;
                }

                try {
                    let databaseUser = await userService.fetchUserByEmail(firebaseUser.email);

                    if (!databaseUser && firebaseUser.email) {
                        const potentialUniversityId = firebaseUser.email.split('@')[0];
                        if (constants.VALIDATION_PATTERNS.UNIVERSITY_ID.test(potentialUniversityId)) {
                            databaseUser = await userService.fetchUserByUniversityId(potentialUniversityId);
                        }
                    }

                    if (!databaseUser || databaseUser.status === constants.USERS_STATUS.SUSPENDED) {
                        await signOut(auth);
                        notifyAuthListeners(null);
                        return;
                    }

                    notifyAuthListeners(databaseUser);
                } catch (error) {
                    console.error('Failed to sync authenticated user with database:', error);
                    notifyAuthListeners(null);
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
function mapUniversityIdToEmail(rawInput) {
    if (!rawInput) {
        return '';
    }

    const cleanInput = rawInput.trim().toLowerCase();
    
    if (cleanInput.includes('@')) {
        return cleanInput;
    }

    const domain = constants.INSTITUTIONAL_CONFIGURATION.EMAIL_DOMAIN;
    return `${cleanInput}${domain}`;
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

