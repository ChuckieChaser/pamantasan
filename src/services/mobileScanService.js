// --- IMPORTS ---
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot, getDoc, deleteDoc } from 'firebase/firestore';
import { functions, db } from './firebase';

// Helper: Convert Base64 string to Blob
const base64ToBlob = (base64String, contentType = 'image/jpeg') => {
    const byteCharacters = atob(base64String);
    const byteArrays = [];
    const sliceSize = 512;

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: contentType });
};

// Helper: Proxies Firebase Storage downloads through Vite dev server to bypass browser CORS on localhost & LAN
const toProxiedUrl = (url) => {
    if (!url || typeof url !== 'string') return url;
    if (typeof window !== 'undefined') {
        const isDev = window.location.port === '5173' ||
                      window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1' ||
                      window.location.hostname.startsWith('192.') ||
                      window.location.hostname.startsWith('10.') ||
                      window.location.hostname.startsWith('172.');
        if (isDev && url.startsWith('https://firebasestorage.googleapis.com')) {
            return url.replace('https://firebasestorage.googleapis.com', '/firebase-storage');
        }
    }
    return url;
};

export const mobileScanService = {
    /**
     * Initializes a new pairing session for smartphone camera capture.
     * Returns session ID, secret token, and the mobile URL to be encoded in the QR code.
     */
    createSession: async (adminUid = null) => {
        if (!functions) {
            throw new Error('Firebase Functions instance not available');
        }

        const createSessionCallable = httpsCallable(functions, 'createMobileScanSession');
        const response = await createSessionCallable({ adminUid });

        const { sessionId, token, expiresAt } = response.data;
        const origin = window.location.origin;
        const syncUrl = `${origin}/mobile-sync/${sessionId}?token=${token}`;

        return {
            sessionId,
            token,
            expiresAt,
            syncUrl,
        };
    },

    /**
     * Listens in real time for camera captures uploaded from the paired phone.
     * Supports both Storage downloadUrl and legacy Base64 with multi-page detection and polling fallback.
     */
    listenToSession: (sessionId, onImageReceived, onError) => {
        if (!db) {
            console.warn('[mobileScanService] Firestore instance not available for real-time sync');
            return () => {};
        }

        const docRef = doc(db, 'mobileScanSessions', sessionId);
        let lastHandledTimestamp = 0;
        let isProcessing = false;

        const processSessionData = async (data) => {
            if (!data || data.status !== 'completed' || isProcessing) return;

            const timestamp = data.updatedAt || Date.now();
            if (timestamp <= lastHandledTimestamp) return;

            isProcessing = true;
            try {
                let blob = null;

                if (data.downloadUrl) {
                    const proxiedUrl = toProxiedUrl(data.downloadUrl);
                    try {
                        const response = await fetch(proxiedUrl);
                        if (response.ok) {
                            blob = await response.blob();
                        }
                    } catch (fetchErr) {
                        console.warn('[mobileScanService] Proxied fetch error, trying direct fetch:', fetchErr);
                    }

                    if (!blob && proxiedUrl !== data.downloadUrl) {
                        try {
                            const directResponse = await fetch(data.downloadUrl);
                            if (directResponse.ok) {
                                blob = await directResponse.blob();
                            }
                        } catch (directErr) {
                            console.warn('[mobileScanService] Direct fetch error:', directErr);
                        }
                    }
                }

                if (!blob && data.imageBase64) {
                    blob = base64ToBlob(data.imageBase64, 'image/jpeg');
                }

                if (!blob) {
                    return;
                }

                lastHandledTimestamp = timestamp;
                const fileName = data.fileName || `mobile_scan_${Date.now()}.jpg`;
                const file = new File([blob], fileName, {
                    type: blob.type || 'image/jpeg',
                    lastModified: timestamp,
                });

                onImageReceived({
                    file,
                    fileName,
                    sizeBytes: blob.size,
                    timestamp,
                });
            } catch (err) {
                console.error('[mobileScanService] Error processing received scan:', err);
                if (onError) onError(err);
            } finally {
                isProcessing = false;
            }
        };

        // 1. Primary real-time Firestore listener
        const unsubscribeSnapshot = onSnapshot(
            docRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    processSessionData(snapshot.data());
                }
            },
            (error) => {
                console.warn('[mobileScanService] Realtime listener notice:', error?.message);
                if (onError) onError(error);
            }
        );

        // 2. Resilient backup poller (every 2s) in case client adblockers block WebSockets
        const pollingInterval = setInterval(async () => {
            try {
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    processSessionData(snap.data());
                }
            } catch {
                // Ignore transient polling blips
            }
        }, 2000);

        return () => {
            unsubscribeSnapshot();
            clearInterval(pollingInterval);
        };
    },

    /**
     * Submits a captured photo from a smartphone browser to the desktop session.
     */
    submitScan: async ({ sessionId, token, imageBase64, fileName = 'scan.jpg' }) => {
        if (!functions) {
            throw new Error('Firebase Functions instance not available');
        }

        const submitScanCallable = httpsCallable(functions, 'submitMobileScan');
        const response = await submitScanCallable({
            sessionId,
            token,
            imageBase64,
            fileName,
        });

        return response.data;
    },

    /**
     * Cleans up and deletes the ephemeral session document once complete or dismissed.
     */
    closeSession: async (sessionId) => {
        if (!db || !sessionId) return;
        try {
            const docRef = doc(db, 'mobileScanSessions', sessionId);
            await deleteDoc(docRef);
        } catch {
            // Ignore cleanup failure on expired or already deleted docs
        }
    },
};

export default mobileScanService;
