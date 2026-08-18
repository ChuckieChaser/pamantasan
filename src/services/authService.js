// --- IMPORTS ---
import {
    auth,
    googleProvider,
    isConfigured,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
} from './firebase';

// --- CONFIGURATIONS ---
const INSTITUTIONAL_DOMAIN = 'plpasig.edu.ph';

// --- HELPERS ---
function mapUniversityIdToEmail(universityId) {
    if (universityId.includes('@')) {
        return universityId;
    }

    return `${universityId}@${INSTITUTIONAL_DOMAIN}`;
}

function parseUserRoleFromClaims(firebaseUser) {
    const userEmail = (firebaseUser.email || '').toLowerCase();
    const displayName = (firebaseUser.displayName || '').toLowerCase();

    if (userEmail.startsWith('20-00001') || userEmail.includes('admin') || displayName.includes('arthur')) {
        return 'admin';
    }

    if (userEmail.startsWith('20-00003') || userEmail.includes('director') || userEmail.includes('dean') || displayName.includes('diana')) {
        return 'dean';
    }

    if (userEmail.startsWith('20-00002') || userEmail.includes('coord') || displayName.includes('cora')) {
        return 'coordinator';
    }

    if (userEmail.startsWith('20-00004') || userEmail.includes('officer') || displayName.includes('oliver')) {
        return 'reviewer';
    }

    return 'faculty';
}

function parseDepartmentFromUser(firebaseUser) {
    const userEmail = (firebaseUser.email || '').toLowerCase();
    if (userEmail.includes('.hr@') || userEmail.startsWith('21-')) {
        return 'Human Resources';
    }
    return 'College of Computer Studies';
}

// --- AUTHENTICATION SERVICE ---
const authService = {
    loginWithUniversityId: async (universityId, password) => {
        if (!isConfigured || !auth) {
            throw new Error('Firebase configuration missing in .env file.');
        }

        const cleanId = universityId.trim();
        const primaryEmail = mapUniversityIdToEmail(cleanId);

        try {
            const userCredential = await signInWithEmailAndPassword(auth, primaryEmail, password);
            const firebaseUser = userCredential.user;

            return {
                id: firebaseUser.uid,
                universityId: cleanId,
                email: firebaseUser.email,
                name: firebaseUser.displayName || cleanId,
                role: parseUserRoleFromClaims(firebaseUser),
                department: parseDepartmentFromUser(firebaseUser),
            };
        } catch (primaryError) {
            // Secondary attempt: try unhyphenated format
            if (cleanId.includes('-')) {
                const unhyphenatedEmail = `${cleanId.replace(/-/g, '')}@${INSTITUTIONAL_DOMAIN}`;
                try {
                    const fallbackCredential = await signInWithEmailAndPassword(auth, unhyphenatedEmail, password);
                    const fallbackUser = fallbackCredential.user;

                    return {
                        id: fallbackUser.uid,
                        universityId: cleanId,
                        email: fallbackUser.email,
                        name: fallbackUser.displayName || cleanId,
                        role: parseUserRoleFromClaims(fallbackUser),
                        department: parseDepartmentFromUser(fallbackUser),
                    };
                } catch {
                    throw primaryError;
                }
            }

            throw primaryError;
        }
    },

    loginWithGoogle: async () => {
        if (!isConfigured || !auth) {
            throw new Error('Firebase configuration missing in .env file.');
        }

        const userCredential = await signInWithPopup(auth, googleProvider);
        const firebaseUser = userCredential.user;

        return {
            id: firebaseUser.uid,
            universityId: '20-00099',
            email: firebaseUser.email,
            name: firebaseUser.displayName || 'Google User',
            role: parseUserRoleFromClaims(firebaseUser),
            department: parseDepartmentFromUser(firebaseUser),
        };
    },

    logout: async () => {
        if (auth) {
            await signOut(auth);
        }
    },

    onAuthStateChanged: (callback) => {
        if (!auth) {
            callback(null);
            return () => { };
        }

        return onAuthStateChanged(auth, (firebaseUser) => {
            if (!firebaseUser) {
                callback(null);
                return;
            }

            callback({
                id: firebaseUser.uid,
                email: firebaseUser.email,
                name: firebaseUser.displayName || firebaseUser.email,
                role: parseUserRoleFromClaims(firebaseUser),
                department: parseDepartmentFromUser(firebaseUser),
            });
        });
    },
};

export {
    authService,
    mapUniversityIdToEmail,
    parseUserRoleFromClaims,
    parseDepartmentFromUser,
};

export default authService;
