// --- IMPORTS ---
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';


// --- CONFIGURATIONS ---
const URL_CACHE = new Map();


// --- SERVICES ---
const storageService = {
    // DOCUMENTS
    getFileDownloadUrl: async (storagePath) => {
        return storageService.fetchDocument(storagePath);
    },

    fetchDocument: async (storagePath) => {
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

        const cleanPath = cleanStoragePath(storagePath);

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
            console.error(`Failed to resolve download URL for "${cleanPath}":`, error);
            return null;
        }
    },

    uploadDocument: async (documentId, file, versionNumber = 1) => {
        if (!storage) {
            throw new Error('Firebase Storage is not initialized.');
        }

        if (!documentId || !file) {
            throw new Error('Document ID and file binary are required for upload.');
        }

        const sanitizedFileName = sanitizeFileName(file.name);
        const storagePath = `documents/${documentId}/v${versionNumber}_${sanitizedFileName}`;
        const storageReference = ref(storage, storagePath);

        const uploadResult = await uploadBytes(storageReference, file, {
            contentType: file.type,
            customMetadata: {
                documentId: documentId,
                version: String(versionNumber),
                uploadedAt: new Date().toISOString(),
            },
        });

        const downloadUrl = await getDownloadURL(uploadResult.ref);
        URL_CACHE.set(storageReference.fullPath, downloadUrl);

        return {
            path: storageReference.fullPath,
            downloadUrl: downloadUrl,
            sizeBytes: file.size,
            mimeType: file.type,
        };
    },

    downloadDocument: async (storagePath, fileName) => {
        const downloadUrl = await storageService.fetchDocument(storagePath);
        if (!downloadUrl) {
            return null;
        }

        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            try {
                const response = await fetch(downloadUrl);
                const blob = await response.blob();
                const blobUrl = window.URL.createObjectURL(blob);
                const anchor = document.createElement('a');

                anchor.href = blobUrl;
                anchor.download = fileName || storagePath.split('/').pop() || 'download';
                
                document.body.appendChild(anchor);
                anchor.click();
                
                document.body.removeChild(anchor);
                window.URL.revokeObjectURL(blobUrl);
            } catch (error) {
                console.error('Direct download failed, opening in new tab:', error);
                window.open(downloadUrl, '_blank');
            }
        }

        return downloadUrl;
    },

    deleteDocument: async (storagePath) => {
        if (!storage || !storagePath) {
            return false;
        }

        const cleanPath = cleanStoragePath(storagePath);

        try {
            const fileReference = ref(storage, cleanPath);
            await deleteObject(fileReference);
            URL_CACHE.delete(cleanPath);

            return true;
        } catch (error) {
            console.error(`Failed to delete document at "${cleanPath}":`, error);
            return false;
        }
    },

    // AVATARS
    uploadAvatar: async (userId, file) => {
        if (!storage) {
            throw new Error('Firebase Storage is not initialized.');
        }

        if (!userId || !file) {
            throw new Error('User ID and avatar file are required for upload.');
        }

        const fileExtension = file.name ? file.name.split('.').pop() : 'png';
        const sanitizedFileName = `avatar_${Date.now()}.${fileExtension}`;
        const storagePath = `avatars/${userId}/${sanitizedFileName}`;
        const storageReference = ref(storage, storagePath);

        const uploadResult = await uploadBytes(storageReference, file, {
            contentType: file.type,
            customMetadata: {
                uploaderId: userId,
                uploadedAt: new Date().toISOString(),
            },
        });

        const downloadUrl = await getDownloadURL(uploadResult.ref);
        URL_CACHE.set(storageReference.fullPath, downloadUrl);

        return {
            path: storageReference.fullPath,
            downloadUrl: downloadUrl,
            sizeBytes: file.size,
            mimeType: file.type,
        };
    },
};


// --- HELPERS ---
function cleanStoragePath(storagePath) {
    if (!storagePath) {
        return '';
    }

    return storagePath.replace(/^gs:\/\/[^/]+\//, '');
}

function sanitizeFileName(fileName) {
    if (!fileName) {
        return `file_${Date.now()}`;
    }

    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}


// --- EXPORTS ---
export { storageService };
