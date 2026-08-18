// --- IMPORTS ---
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
    getAuth,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged,
} from 'firebase/auth';

// --- CONFIGURATIONS ---
const rawApiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim() || '';
const rawProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() || '';

const isConfigured = Boolean(rawApiKey && rawProjectId);

// Fallback dummy config with valid dummy format prevents crash on initial load before .env is populated
const firebaseConfig = {
    apiKey: rawApiKey || 'AIzaSyDummyKeyForInitializationOnly00000',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || 'pamantasan-dms.firebaseapp.com',
    projectId: rawProjectId || 'pamantasan-dms',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() || 'pamantasan-dms.appspot.com',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() || '123456789012',
    appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim() || '1:123456789012:web:abcdef1234567890abcdef',
};

// --- INITIALIZATION ---
let app;
let auth;
let googleProvider;

try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({
        hd: 'plpasig.edu.ph',
        prompt: 'select_account',
    });
} catch (error) {
    console.warn('Firebase initialization fallback:', error);
}

export {
    app,
    auth,
    googleProvider,
    isConfigured,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
};

export default app;
