// --- IMPORTS ---
import {
    auth,
    googleProvider,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    onAuthStateChanged as onFirebaseAuthChanged,
} from './firebase';
import { userService } from './userService';

// --- CONFIGURATIONS ---
const authListeners = new Set();
let cachedCurrentUser = null;

// --- HELPERS ---
function mapUniversityIdToEmail(input) {
    const clean = (input ?? '').trim().toLowerCase();
    if (clean.includes('@')) {
        return clean;
    }

    if (clean.startsWith('admin.')) return `${clean}@plpasig.edu.ph`;
    if (clean.startsWith('coord.')) return `${clean}@plpasig.edu.ph`;
    if (clean.startsWith('director.')) return `${clean}@plpasig.edu.ph`;
    if (clean.startsWith('officer.')) return `${clean}@plpasig.edu.ph`;
    if (clean.startsWith('member.')) return `${clean}@plpasig.edu.ph`;

    const numericOnly = clean.replace(/-/g, '');
    if (clean === '20-00001' || numericOnly === '2000001') return '20-00001@plpasig.edu.ph';
    if (clean === '20-00002' || numericOnly === '2000002') return '20-00002@plpasig.edu.ph';
    if (clean === '20-00003' || numericOnly === '2000003') return '20-00003@plpasig.edu.ph';
    if (clean === '20-00004' || numericOnly === '2000004') return '20-00004@plpasig.edu.ph';
    if (clean === '20-00005' || numericOnly === '2000005') return '20-00005@plpasig.edu.ph';
    if (clean === '21-00001' || numericOnly === '2100001') return '21-00001@plpasig.edu.ph';
    if (clean === '21-00002' || numericOnly === '2100002') return '21-00002@plpasig.edu.ph';

    return `${clean}@plpasig.edu.ph`;
}

function notifyListeners(user) {
    cachedCurrentUser = user;
    authListeners.forEach((listener) => {
        try {
            listener(user);
        } catch {
            // Guard against listener execution failure
        }
    });
}

// --- AUTHENTICATION SERVICE IMPLEMENTATION ---
const authService = {
    loginWithEmail: async (email, password) => {
        return authService.loginWithUniversityId(email, password);
    },

    loginWithUniversityId: async (universityId, password) => {
        const resolvedEmail = mapUniversityIdToEmail(universityId);

        if (!auth) {
            throw new Error('Firebase Auth is not initialized.');
        }

        try {
            const userCredential = await signInWithEmailAndPassword(auth, resolvedEmail, password);
            const firebaseUser = userCredential.user;

            // Fetch live PostgreSQL profile
            let dbUser = await userService.fetchUserByEmail(firebaseUser.email);
            if (!dbUser && universityId) {
                dbUser = await userService.fetchUserByUniversityId(universityId);
            }

            const formattedUser = dbUser ?? {
                id: firebaseUser.uid,
                university_id: universityId,
                universityId: universityId,
                email: firebaseUser.email,
                name: firebaseUser.displayName ?? 'University User',
                first_name: firebaseUser.displayName?.split(' ')[0] ?? 'University',
                last_name: firebaseUser.displayName?.split(' ')[1] ?? 'User',
                role: 'MEMBER',
                department: 'College of Computer Studies',
                department_code: 'CCS',
                status: 'VERIFIED',
                avatar_path: firebaseUser.photoURL ?? null,
            };

            notifyListeners(formattedUser);
            return formattedUser;
        } catch (error) {
            console.error('Login failed:', error);
            const errorCode = error?.code;
            if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/wrong-password') {
                throw new Error('Invalid University ID or password. Please verify your credentials.', { cause: error });
            }
            if (errorCode === 'auth/user-not-found') {
                throw new Error(`Account for "${universityId}" not found.`, { cause: error });
            }
            throw new Error(error?.message ?? 'Authentication failed.', { cause: error });
        }
    },

    loginWithGoogle: async () => {
        if (!auth || !googleProvider) {
            throw new Error('Firebase Google Authentication is not initialized.');
        }

        try {
            const userCredential = await signInWithPopup(auth, googleProvider);
            const firebaseUser = userCredential.user;

            let dbUser = await userService.fetchUserByEmail(firebaseUser.email);

            const formattedUser = dbUser ?? {
                id: firebaseUser.uid,
                university_id: 'SSO-USER',
                universityId: 'SSO-USER',
                email: firebaseUser.email,
                name: firebaseUser.displayName ?? 'Google User',
                first_name: firebaseUser.displayName?.split(' ')[0] ?? 'Institutional',
                last_name: firebaseUser.displayName?.split(' ').slice(1).join(' ') || 'Member',
                role: 'MEMBER',
                department: 'College of Computer Studies',
                department_code: 'CCS',
                status: 'VERIFIED',
                avatar_path: firebaseUser.photoURL ?? null,
            };

            notifyListeners(formattedUser);
            return formattedUser;
        } catch (error) {
            console.error('Google Sign-In failed:', error);
            throw new Error(error?.message ?? 'Google authentication failed.', { cause: error });
        }
    },

    logout: async () => {
        if (auth) {
            await signOut(auth);
        }
        notifyListeners(null);
    },

    onAuthStateChanged: (callback) => {
        authListeners.add(callback);

        if (!auth) {
            callback(null);
            return () => authListeners.delete(callback);
        }

        const unsubscribeFirebase = onFirebaseAuthChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                notifyListeners(null);
                return;
            }

            try {
                let dbUser = await userService.fetchUserByEmail(firebaseUser.email);
                const resolvedUser = dbUser ?? {
                    id: firebaseUser.uid,
                    university_id: 'ACTIVE-USER',
                    universityId: 'ACTIVE-USER',
                    email: firebaseUser.email,
                    name: firebaseUser.displayName ?? 'Active User',
                    first_name: firebaseUser.displayName?.split(' ')[0] ?? 'Active',
                    last_name: firebaseUser.displayName?.split(' ').slice(1).join(' ') || 'User',
                    role: 'MEMBER',
                    department: 'College of Computer Studies',
                    department_code: 'CCS',
                    status: 'VERIFIED',
                    avatar_path: firebaseUser.photoURL ?? null,
                };
                notifyListeners(resolvedUser);
            } catch {
                notifyListeners(null);
            }
        });

        return () => {
            authListeners.delete(callback);
            unsubscribeFirebase();
        };
    },

    getCurrentUser: () => {
        return cachedCurrentUser;
    },
};

export {
    authService,
    mapUniversityIdToEmail,
};

export default authService;
