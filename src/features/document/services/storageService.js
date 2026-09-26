// --- IMPORTS ---
import { ref, uploadBytes, getDownloadURL, deleteObject, getBlob } from 'firebase/storage';

import { storage } from '../../../services/firebase';
import { cleanStoragePath, sanitizeFileName } from '../utilities/storageUtils';


// --- CONFIGURATIONS ---
const URL_CACHE = new Map();
const CACHE_TTL_MS = 45 * 60 * 1000; // 45 minutes TTL
const MAX_CACHE_ENTRIES = 200;

const getCachedUrl = (key) => {
    const entry = URL_CACHE.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        URL_CACHE.delete(key);
        return null;
    }
    return entry.url;
};

const setCachedUrl = (key, url) => {
    if (URL_CACHE.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = URL_CACHE.keys().next().value;
        URL_CACHE.delete(oldestKey);
    }
    URL_CACHE.set(key, { url, expiresAt: Date.now() + CACHE_TTL_MS });
};


// --- DOCUMENT STORAGE SERVICES ---
export const getDownloadUrl = async (storagePath) => {
    if (!storagePath) {
        throw new Error('Storage path is required to resolve download URL.');
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
    const cachedUrl = getCachedUrl(cleanPath);
    if (cachedUrl) {
        return cachedUrl;
    }

    if (!storage) {
        throw new Error('Firebase Storage is not initialized.');
    }

    const fileReference = ref(storage, cleanPath);
    const downloadUrl = await getDownloadURL(fileReference);
    setCachedUrl(cleanPath, downloadUrl);

    return downloadUrl;
};

export const getFileBlob = async (storagePath) => {
    if (!storagePath) {
        throw new Error('Storage path is required to retrieve file blob.');
    }

    const cleanPath = cleanStoragePath(storagePath);

    if (!storage) {
        throw new Error('Firebase Storage is not initialized.');
    }

    try {
        const fileReference = ref(storage, cleanPath);
        return await getBlob(fileReference, 100 * 1024 * 1024);
    } catch (err) {
        // Fallback: If getBlob fails due to SDK limits or CORS, attempt direct signed URL fetch
        try {
            const downloadUrl = await getDownloadUrl(cleanPath);
            const response = await fetch(downloadUrl);
            if (response.ok) {
                return await response.blob();
            }
        } catch {
            // Intentionally suppress secondary failure and bubble the primary storage exception below
        }
        throw new Error(`Failed to retrieve file binary for "${cleanPath}": ${err?.message || 'File not found'}`);
    }
};

export const uploadDocument = async (documentId, file, versionNumber = 1, customFileName = null) => {
    if (!storage) {
        throw new Error('Firebase Storage is not initialized.');
    }

    if (!documentId || !file) {
        throw new Error('Document ID and file binary are required for upload.');
    }

    const effectiveFileName = customFileName || file.name;
    const sanitizedFileName = sanitizeFileName(effectiveFileName);
    const storagePath = `documents/${documentId}/v${versionNumber}_${sanitizedFileName}`;
    const storageReference = ref(storage, storagePath);

    const uploadResult = await uploadBytes(storageReference, file, {
        contentType: file.type || 'application/octet-stream',
        customMetadata: {
            documentId: documentId,
            version: String(versionNumber),
            uploadedAt: new Date().toISOString(),
        },
    });

    const downloadUrl = await getDownloadURL(uploadResult.ref);
    setCachedUrl(storageReference.fullPath, downloadUrl);

    const actualSizeBytes = uploadResult.metadata?.size != null
        ? Number(uploadResult.metadata.size)
        : Number(file.size);

    return {
        path: storageReference.fullPath,
        downloadUrl: downloadUrl,
        sizeBytes: actualSizeBytes,
        mimeType: file.type || 'application/octet-stream',
    };
};

export const deleteDocument = async (storagePath) => {
    if (!storage) {
        throw new Error('Firebase Storage is not initialized.');
    }

    if (!storagePath) {
        throw new Error('Storage path is required for deletion.');
    }

    const cleanPath = cleanStoragePath(storagePath);
    const fileReference = ref(storage, cleanPath);
    await deleteObject(fileReference);
    URL_CACHE.delete(cleanPath);

    return true;
};
