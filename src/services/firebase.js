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
import { getDataConnect } from 'firebase/data-connect';
import { getStorage } from 'firebase/storage';
import { INSTITUTIONAL_CONFIG } from '../constants';

// --- CONFIGURATIONS ---
const rawApiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim() ?? '';
const rawProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() ?? '';

const isConfigured = Boolean(rawApiKey !== '' && rawProjectId !== '');

const firebaseConfig = {
    apiKey: rawApiKey !== '' ? rawApiKey : 'AIzaSyB9sGybhkzstxlzb07HojVcb26lroIQ1sU',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() ?? 'pamantasan-records-210fe.firebaseapp.com',
    projectId: rawProjectId !== '' ? rawProjectId : 'pamantasan-records-210fe',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() ?? 'pamantasan-records-210fe.firebasestorage.app',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? '673717882853',
    appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim() ?? '1:673717882853:web:eac72c2d8a60e1cc1c690c',
};

// --- INITIALIZATION ---
let app;
let auth;
let storage;
let dataConnect;
let googleProvider;

try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    storage = getStorage(app);

    const serviceId = import.meta.env.VITE_FIREBASE_DATA_CONNECT_SERVICE ?? 'pamantasan-records-210fe-service';
    const location = import.meta.env.VITE_FIREBASE_DATA_CONNECT_LOCATION ?? 'asia-southeast1';

    dataConnect = getDataConnect(app, {
        service: serviceId,
        location: location,
        connector: 'default',
    });

    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({
        hd: INSTITUTIONAL_CONFIG.EMAIL_DOMAIN.replace('@', ''),
        prompt: 'select_account',
    });
} catch (error) {
    console.warn('Firebase initialization notice:', error);
}

export {
    app,
    auth,
    storage,
    dataConnect,
    googleProvider,
    isConfigured,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
};

export default app;
