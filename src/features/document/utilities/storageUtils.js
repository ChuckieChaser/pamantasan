// --- STORAGE UTILITIES ---
export const cleanStoragePath = (storagePath) => {
    if (!storagePath || typeof storagePath !== 'string') {
        return '';
    }

    // Handle gs://bucket/path
    if (storagePath.startsWith('gs://')) {
        return storagePath.replace(/^gs:\/\/[^/]+\//, '');
    }

    // Handle Firebase Storage HTTP/HTTPS download URLs
    if (storagePath.includes('firebasestorage.googleapis.com/v0/b/')) {
        try {
            const parts = storagePath.split('/o/');
            if (parts.length > 1) {
                const encodedPath = parts[1].split('?')[0];
                return decodeURIComponent(encodedPath);
            }
        } catch (e) {
            console.warn('Failed to parse Firebase storage URL path:', e);
        }
    }

    // Strip leading slash if any
    return storagePath.replace(/^\/+/, '');
};

export const sanitizeFileName = (fileName) => {
    if (!fileName) {
        return `file_${Date.now()}`;
    }

    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
};
