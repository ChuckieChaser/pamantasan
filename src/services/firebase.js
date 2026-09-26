// --- IMPORTS ---
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getDataConnect } from 'firebase/data-connect';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

import { SYSTEM } from '../constants';


// --- ENVIRONMENTS ---
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim() ?? '';
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() ?? '';
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() ?? '';
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() ?? '';
const appId = import.meta.env.VITE_FIREBASE_APP_ID?.trim() ?? '';
const serviceId = import.meta.env.VITE_FIREBASE_DATA_CONNECT_SERVICE?.trim() ?? '';
const location = import.meta.env.VITE_FIREBASE_DATA_CONNECT_LOCATION?.trim() || 'asia-southeast1';


// --- FIREBASE SERVICES ---
const initializeFirebaseServices = () => {
    if (!apiKey || !projectId || !serviceId) {
        console.warn('Firebase configuration is incomplete. Check environment variables in .env.');
        return {
            app: null,
            auth: null,
            storage: null,
            dataConnect: null,
            functions: null,
            googleProvider: null,
        };
    }

    try {
        const app = getApps().length > 0 ? getApp() : initializeApp({
            apiKey,
            authDomain,
            projectId,
            storageBucket,
            appId,
        });

        const auth = getAuth(app);
        const storage = getStorage(app);
        const functions = getFunctions(app, location);

        const dataConnect = getDataConnect(app, {
            service: serviceId,
            location: location,
            connector: 'default',
        });

        const googleProvider = new GoogleAuthProvider();
        googleProvider.setCustomParameters({
            hd: SYSTEM.EMAIL_DOMAIN.replace(/^@/, ''),
            prompt: 'select_account',
        });

        return {
            app,
            auth,
            storage,
            dataConnect,
            functions,
            googleProvider,
        };
    } catch (error) {
        console.error('Firebase initialization failure:', error);
        return {
            app: null,
            auth: null,
            storage: null,
            dataConnect: null,
            functions: null,
            googleProvider: null,
        };
    }
};

const services = initializeFirebaseServices();


// --- HELPERS ---
export const app = services.app;

export const auth = services.auth;

export const storage = services.storage;

export const dataConnect = services.dataConnect;

export const functions = services.functions;

export const googleProvider = services.googleProvider;
