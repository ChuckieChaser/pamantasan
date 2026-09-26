// --- IMPORTS ---
import { ref, uploadBytes, getDownloadURL, listAll } from 'firebase/storage';

import { storage } from '../../../services/firebase';
import defaultAvatarSvg from '../../../assets/icons/defaultAvatar.svg';


// --- CONFIGURATIONS ---
const AVATAR_URL_CACHE = new Map();


// --- AVATAR SERVICES ---
export const getDefaultAvatarUrl = () => {
    return defaultAvatarSvg;
};

export const uploadUserAvatar = async (userId, file) => {
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
        contentType: file.type || 'image/png',
        customMetadata: {
            uploaderId: userId,
            uploadedAt: new Date().toISOString(),
        },
    });

    const downloadUrl = await getDownloadURL(uploadResult.ref);
    AVATAR_URL_CACHE.set(userId, downloadUrl);

    return {
        path: storageReference.fullPath,
        downloadUrl: downloadUrl,
        sizeBytes: file.size,
        mimeType: file.type || 'image/png',
    };
};

export const getUserAvatarUrl = async (userId) => {
    if (!userId) {
        return getDefaultAvatarUrl();
    }

    if (AVATAR_URL_CACHE.has(userId)) {
        return AVATAR_URL_CACHE.get(userId);
    }

    if (!storage) {
        return getDefaultAvatarUrl();
    }

    try {
        const folderReference = ref(storage, `avatars/${userId}`);
        const result = await listAll(folderReference);
        if (result.items && result.items.length > 0) {
            const latestItem = result.items[result.items.length - 1];
            const downloadUrl = await getDownloadURL(latestItem);
            AVATAR_URL_CACHE.set(userId, downloadUrl);
            return downloadUrl;
        }
    } catch {
        // Folder does not exist if user hasn't uploaded a custom avatar
    }

    return getDefaultAvatarUrl();
};
