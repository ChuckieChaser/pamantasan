// --- IMPORTS ---
import { initializeApp, deleteApp } from 'firebase/app';
import {
    getAuth,
    createUserWithEmailAndPassword,
    updateProfile,
    signOut,
} from 'firebase/auth';
import { isConfigured } from './firebase';
import { USER_ROLES, INSTITUTIONAL_CONFIG } from '../constants';

// --- CONFIGURATIONS ---
const CLOUD_SEEDS = [
    {
        universityId: '20-00001',
        email: `20-00001${INSTITUTIONAL_CONFIG.EMAIL_DOMAIN}`,
        password: 'password',
        displayName: 'Arthur Pendragon',
        role: USER_ROLES.ADMINISTRATOR,
        department: 'College of Computer Studies',
    },
    {
        universityId: '20-00002',
        email: `20-00002${INSTITUTIONAL_CONFIG.EMAIL_DOMAIN}`,
        password: 'password',
        displayName: 'Cora Smith',
        role: USER_ROLES.COORDINATOR,
        department: 'College of Computer Studies',
    },
    {
        universityId: '20-00003',
        email: `20-00003${INSTITUTIONAL_CONFIG.EMAIL_DOMAIN}`,
        password: 'password',
        displayName: 'Diana Prince',
        role: USER_ROLES.DIRECTOR,
        department: 'College of Computer Studies',
    },
    {
        universityId: '20-00004',
        email: `20-00004${INSTITUTIONAL_CONFIG.EMAIL_DOMAIN}`,
        password: 'password',
        displayName: 'Oliver Queen',
        role: USER_ROLES.OFFICER,
        department: 'College of Computer Studies',
    },
    {
        universityId: '20-00005',
        email: `20-00005${INSTITUTIONAL_CONFIG.EMAIL_DOMAIN}`,
        password: 'password',
        displayName: 'Marcus Aurelius',
        role: USER_ROLES.MEMBER,
        department: 'College of Computer Studies',
    },
    {
        universityId: '21-00001',
        email: `21-00001${INSTITUTIONAL_CONFIG.EMAIL_DOMAIN}`,
        password: 'password',
        displayName: 'Helena Roosevelt',
        role: USER_ROLES.MEMBER,
        department: 'Human Resources',
    },
    {
        universityId: '21-00002',
        email: `21-00002${INSTITUTIONAL_CONFIG.EMAIL_DOMAIN}`,
        password: 'password',
        displayName: 'Henry Wallace',
        role: USER_ROLES.MEMBER,
        department: 'Human Resources',
    },
];

// --- SEED SERVICE ---
const seedService = {
    pushSeedsToFirebaseCloud: async () => {
        if (!isConfigured) {
            throw new Error('Firebase configuration is missing in your .env file.');
        }

        const firebaseConfig = {
            apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
            authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
            projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
            storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
            messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
            appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
        };

        const tempAppName = `seedApp-${Date.now()}`;
        const tempApp = initializeApp(firebaseConfig, tempAppName);
        const tempAuth = getAuth(tempApp);

        const results = {
            created: 0,
            alreadyExisting: 0,
            failed: 0,
            errors: [],
            details: [],
        };

        try {
            for (const seed of CLOUD_SEEDS) {
                try {
                    const userCredential = await createUserWithEmailAndPassword(
                        tempAuth,
                        seed.email,
                        seed.password,
                    );

                    await updateProfile(userCredential.user, {
                        displayName: seed.displayName,
                    });

                    await signOut(tempAuth);

                    results.created += 1;
                    results.details.push({
                        universityId: seed.universityId,
                        email: seed.email,
                        status: 'created',
                    });
                } catch (error) {
                    if (error?.code === 'auth/email-already-in-use') {
                        results.alreadyExisting += 1;
                        results.details.push({
                            universityId: seed.universityId,
                            email: seed.email,
                            status: 'exists',
                        });
                    } else if (error?.code === 'auth/operation-not-allowed') {
                        results.failed += 1;
                        const message = 'Email/Password provider is disabled. Please enable "Email/Password" in Firebase Console under Authentication > Sign-in method.';
                        results.errors.push(message);
                        throw new Error(message);
                    } else {
                        results.failed += 1;
                        const errorMessage = `[${seed.universityId}] ${error.message}`;
                        results.errors.push(errorMessage);
                        results.details.push({
                            universityId: seed.universityId,
                            email: seed.email,
                            status: 'error',
                            error: error.message,
                        });
                    }
                }
            }
        } finally {
            try {
                await deleteApp(tempApp);
            } catch (cleanupError) {
                console.warn('Temporary seed app cleanup warning:', cleanupError);
            }
        }

        if (results.failed > 0 && results.created === 0 && results.alreadyExisting === 0) {
            const firstError = results.errors[0] ?? 'Unknown error occurred while pushing accounts.';
            throw new Error(firstError);
        }

        return results;
    },
};

export {
    seedService,
    CLOUD_SEEDS,
};

export default seedService;
