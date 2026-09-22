import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getDataConnect } from 'firebase/data-connect';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import { getFirestore } from 'firebase/firestore';

import { constants } from '../constants';


// --- CONFIGURATIONS ---
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim() ?? '';
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() ?? '';
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() ?? '';
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() ?? '';
const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? '';
const appId = import.meta.env.VITE_FIREBASE_APP_ID?.trim() ?? '';
const serviceId = import.meta.env.VITE_FIREBASE_DATA_CONNECT_SERVICE?.trim() ?? '';
const location = import.meta.env.VITE_FIREBASE_DATA_CONNECT_LOCATION?.trim() ?? '';

const isConfigured = Boolean(apiKey !== '' && projectId !== '' && serviceId !== '' && location !== '');

const FIREBASE_CONFIGURATION = Object.freeze({
    apiKey: apiKey,
    authDomain: authDomain,
    projectId: projectId,
    storageBucket: storageBucket,
    messagingSenderId: messagingSenderId,
    appId: appId,
});


// --- INITIALIZATION ---
let app;
let auth;
let storage;
let dataConnect;
let functions;
let googleProvider;
let db;

if (isConfigured) {
    try {
        app = getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIGURATION);
        auth = getAuth(app);
        storage = getStorage(app);
        functions = getFunctions(app, location || 'asia-southeast1');
        db = getFirestore(app);

        dataConnect = getDataConnect(app, {
            service: serviceId,
            location: location,
            connector: 'default',
        });

        googleProvider = new GoogleAuthProvider();
        
        googleProvider.setCustomParameters({
            hd: constants.INSTITUTIONAL_CONFIGURATION.EMAIL_DOMAIN.replace('@', ''),
            prompt: 'select_account',
        });
    } catch (error) {
        console.error('Firebase initialization failure:', error);
    }
} else {
    console.warn('Firebase configuration is incomplete. Please check your environment variables in .env.');
}


// --- EXPORTS ---
export { auth, storage, dataConnect, functions, googleProvider, db, isConfigured, FIREBASE_CONFIGURATION };


