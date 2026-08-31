// --- IMPORTS ---
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

// --- MODULE-LEVEL CACHE ---
const URL_CACHE = new Map();

// --- SERVICE IMPLEMENTATION ---
const storageService = {
    uploadAvatar: async (userId, file) => {
        const fileExtension = file.name.split('.').pop() || 'png';
        const sanitizedFileName = `avatar_${Date.now()}.${fileExtension}`;

        if (storage) {
            try {
                const avatarStorageReference = ref(storage, `avatars/${userId}/${sanitizedFileName}`);
                const uploadResult = await uploadBytes(avatarStorageReference, file, {
                    contentType: file.type,
                    customMetadata: {
                        uploaderId: userId,
                        uploadedAt: new Date().toISOString(),
                    },
                });

                const downloadUrl = await getDownloadURL(uploadResult.ref);
                return {
                    path: avatarStorageReference.fullPath,
                    downloadUrl,
                };
            } catch (error) {
                console.warn('Firebase Storage direct upload notice, using persistent base64 representation:', error);
            }
        }

        // Graceful fallback for local development or storage policy propagation
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        return {
            path: `avatars/${userId}/${sanitizedFileName}`,
            downloadUrl: dataUrl,
        };
    },

    uploadDocument: async (documentId, versionNumber, file) => {
        if (!storage) {
            throw new Error('Firebase Storage is not initialized.');
        }

        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const documentStorageReference = ref(
            storage,
            `documents/${documentId}/v${versionNumber}_${sanitizedFileName}`
        );

        const uploadResult = await uploadBytes(documentStorageReference, file, {
            contentType: file.type,
            customMetadata: {
                documentId,
                version: String(versionNumber),
                uploadedAt: new Date().toISOString(),
            },
        });

        const downloadUrl = await getDownloadURL(uploadResult.ref);
        return {
            path: documentStorageReference.fullPath,
            downloadUrl,
            sizeBytes: file.size,
            mimeType: file.type,
        };
    },

    getFileDownloadUrl: async (storagePath) => {
        if (!storagePath) {
            return null;
        }

        if (
            storagePath.startsWith('http://') ||
            storagePath.startsWith('https://') ||
            storagePath.startsWith('data:') ||
            storagePath.startsWith('blob:')
        ) {
            return storagePath;
        }

        const cleanPath = storagePath.replace(/^gs:\/\/[^/]+\//, '');

        if (URL_CACHE.has(cleanPath)) {
            return URL_CACHE.get(cleanPath);
        }

        if (!storage) {
            return null;
        }

        try {
            const fileReference = ref(storage, cleanPath);
            const downloadUrl = await getDownloadURL(fileReference);
            URL_CACHE.set(cleanPath, downloadUrl);
            return downloadUrl;
        } catch (error) {
            console.warn(`Failed to resolve download URL for storage pointer "${cleanPath}":`, error);
            return null;
        }
    },

    deleteFile: async (storagePath) => {
        if (!storage || !storagePath) {
            return false;
        }

        try {
            const fileReference = ref(storage, storagePath);
            await deleteObject(fileReference);
            return true;
        } catch (error) {
            console.warn(`Failed to delete file at "${storagePath}":`, error);
            return false;
        }
    },
};

export {
    storageService,
};

export default storageService;
