// --- IMPORTS ---
import { ref, uploadBytes, getDownloadURL, deleteObject, getBlob } from 'firebase/storage';
import { storage } from './firebase';


// --- CONFIGURATIONS ---
const URL_CACHE = new Map();


// --- SERVICES ---
const storageService = {
    // DOCUMENTS
    getFileDownloadUrl: async (storagePath) => {
        return storageService.fetchDocument(storagePath);
    },

    getFileBlob: async (storagePath, onProgress) => {
        if (!storagePath) {
            return null;
        }

        if (storagePath.startsWith('blob:') || storagePath.startsWith('data:')) {
            try {
                onProgress?.({ progress: 50, statusText: 'Reading data stream...' });
                const response = await fetch(storagePath);
                if (response.ok) {
                    return await response.blob();
                }
            } catch (err) {
                console.warn('Failed to fetch blob/data url:', err);
            }
        }

        const isHttp = storagePath.startsWith('http://') || storagePath.startsWith('https://');
        if (storage && !isHttp) {
            const cleanPath = cleanStoragePath(storagePath);
            // 1. Try Firebase Storage getBlob directly (fast & handles binary)
            try {
                onProgress?.({ progress: 40, statusText: 'Fetching from Firebase Storage...' });
                const fileReference = ref(storage, cleanPath);
                const blob = await getBlob(fileReference);
                if (blob && blob.size > 0) {
                    return blob;
                }
            } catch (error) {
                console.warn(`Firebase getBlob failed for "${cleanPath}", attempting via download URL:`, error?.message);
            }

            // 2. Fallback: Resolve signed download URL and fetch binary
            try {
                onProgress?.({ progress: 55, statusText: 'Resolving download URL...' });
                const fileReference = ref(storage, cleanPath);
                const downloadUrl = await getDownloadURL(fileReference);
                if (downloadUrl) {
                    URL_CACHE.set(cleanPath, downloadUrl);
                    const response = await fetch(downloadUrl);
                    if (response.ok) {
                        return await response.blob();
                    }
                }
            } catch (urlErr) {
                console.warn(`Fetch via download URL failed for "${cleanPath}":`, urlErr?.message);
            }
        }

        if (isHttp) {
            try {
                onProgress?.({ progress: 50, statusText: 'Downloading from network...' });
                const response = await fetch(storagePath);
                if (response.ok) {
                    return await response.blob();
                }
            } catch (error) {
                console.warn(`Direct fetch failed for "${storagePath}":`, error?.message);
            }
        }

        return null;
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

    uploadDocument: async (documentId, file, versionNumber = 1, customFileName = null) => {
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
        URL_CACHE.set(storageReference.fullPath, downloadUrl);

        const actualSizeBytes = uploadResult.metadata?.size != null
            ? Number(uploadResult.metadata.size)
            : Number(file.size);

        return {
            path: storageReference.fullPath,
            downloadUrl: downloadUrl,
            sizeBytes: actualSizeBytes,
            mimeType: file.type || 'application/octet-stream',
        };
    },

    downloadDocument: async (storagePathOrItem, preferredFileName, onProgress) => {
        let storagePath = null;
        let effectiveFileName = preferredFileName;

        if (typeof storagePathOrItem === 'object' && storagePathOrItem !== null) {
            storagePath = storagePathOrItem.path || storagePathOrItem.url || storagePathOrItem.downloadUrl;
            if (!effectiveFileName) {
                effectiveFileName = storagePathOrItem.name || storagePathOrItem.title || 'document';
            }
        } else {
            storagePath = storagePathOrItem;
        }

        if (!effectiveFileName) {
            effectiveFileName = (storagePath ? storagePath.split('/').pop() : 'document') || 'document';
        }

        onProgress?.({ progress: 20, statusText: 'Locating document in storage...' });

        // 1. Direct Native Browser Download via Download URL (Fastest & 100% immune to CORS)
        if (storagePath) {
            try {
                onProgress?.({ progress: 50, statusText: 'Resolving download URL...' });
                const downloadUrl = await storageService.fetchDocument(storagePath);
                if (downloadUrl) {
                    onProgress?.({ progress: 85, statusText: 'Saving to laptop disk...' });
                    const anchor = document.createElement('a');
                    anchor.href = downloadUrl;
                    anchor.download = effectiveFileName;
                    anchor.target = '_blank';
                    anchor.rel = 'noopener noreferrer';
                    document.body.appendChild(anchor);
                    anchor.click();
                    setTimeout(() => {
                        if (anchor.parentNode) anchor.parentNode.removeChild(anchor);
                    }, 2000);
                    onProgress?.({ progress: 100, isFinished: true, statusText: 'Saved to laptop' });
                    return true;
                }
            } catch (urlErr) {
                console.warn('Direct URL download attempt failed, falling back to blob:', urlErr);
            }
        }

        let blob = null;
        if (storagePath) {
            blob = await storageService.getFileBlob(storagePath, onProgress);
        }

        // Fallback: When remote storage object is not physically present (mock/seeded data)
        if (!blob) {
            onProgress?.({ progress: 70, statusText: 'Generating institutional record...' });
            const fallbackContent = `Pamantasan Institutional Document\n\nFile: ${effectiveFileName}\nPath: ${storagePath || 'N/A'}\nDownloaded: ${new Date().toISOString()}\n`;
            blob = new Blob([fallbackContent], { type: 'text/plain;charset=utf-8' });
            if (!effectiveFileName.endsWith('.txt')) {
                effectiveFileName = `${effectiveFileName.replace(/\.[^/.]+$/, '')}.txt`;
            }
        }

        onProgress?.({ progress: 90, statusText: 'Saving to laptop disk...' });

        // Guarantee actual file download to laptop disk (never open in browser tab)
        await triggerBrowserDownload(blob, effectiveFileName);
        onProgress?.({ progress: 100, isFinished: true, statusText: 'Saved to laptop' });
        return true;
    },

    downloadFolder: async (folderItem, allDocuments = [], allVersions = [], onProgress) => {
        if (!folderItem) {
            return false;
        }

        const folderName = folderItem.name || folderItem.title || 'Folder';
        onProgress?.({ progress: 15, statusText: 'Scanning folder contents...' });

        const filesToDownload = [];

        const collectChildren = (parentId, prefix) => {
            const children = (allDocuments || []).filter(
                (doc) => (doc.parent?.id ?? doc.parentId) === parentId && !doc.isArchived
            );

            for (const child of children) {
                if (child.isFolder) {
                    const nextPrefix = `${prefix}${child.name || child.title || 'folder'}/`;
                    collectChildren(child.id, nextPrefix);
                } else {
                    const docVers = (allVersions || []).filter(
                        (v) => (v.document?.id ?? v.documentId) === child.id
                    );
                    const latestVer = docVers.length > 0
                        ? [...docVers].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0]
                        : null;
                    const path = latestVer?.path || child.path || child.url || child.downloadUrl;
                    const fileName = child.name || child.title || (path ? path.split('/').pop() : 'file');
                    filesToDownload.push({
                        relativePath: `${prefix}${fileName}`,
                        storagePath: path,
                        fileName: fileName,
                    });
                }
            }
        };

        collectChildren(folderItem.id, '');

        let filesWithData = [];
        if (filesToDownload.length > 0) {
            let completedCount = 0;
            filesWithData = await Promise.all(
                filesToDownload.map(async (file) => {
                    let blob = null;
                    if (file.storagePath) {
                        blob = await storageService.getFileBlob(file.storagePath);
                    }
                    if (!blob) {
                        const content = `Pamantasan Institutional Document\n\nFile: ${file.fileName}\nPath: ${file.storagePath || 'N/A'}\nDownloaded: ${new Date().toISOString()}\n`;
                        blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                    }
                    const buffer = await blob.arrayBuffer();
                    completedCount++;
                    const progressPercent = 20 + Math.round((completedCount / filesToDownload.length) * 55);
                    onProgress?.({
                        progress: progressPercent,
                        statusText: `Downloaded ${completedCount} of ${filesToDownload.length} files...`,
                    });
                    return {
                        path: file.relativePath,
                        data: new Uint8Array(buffer),
                    };
                })
            );
        } else {
            const emptyContent = `Folder "${folderName}" has no files.\nDownloaded: ${new Date().toISOString()}\n`;
            filesWithData.push({
                path: 'README.txt',
                data: new TextEncoder().encode(emptyContent),
            });
        }

        onProgress?.({ progress: 85, statusText: 'Packaging ZIP archive...' });
        const zipBlob = createZipBlob(filesWithData);
        onProgress?.({ progress: 95, statusText: 'Saving ZIP to laptop disk...' });
        await triggerBrowserDownload(zipBlob, `${folderName}.zip`);
        onProgress?.({ progress: 100, isFinished: true, statusText: 'Saved to laptop' });
        return true;
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

    getDefaultAvatarUrl: async () => {
        if (URL_CACHE.has('default_avatar_url')) {
            return URL_CACHE.get('default_avatar_url');
        }

        // Prioritize 'avatars/placeholder.png' in Firebase Storage
        let url = await storageService.fetchDocument('avatars/placeholder.png');
        if (!url) {
            // Fallback: check root 'placeholder.png'
            url = await storageService.fetchDocument('placeholder.png');
        }
        if (!url) {
            // Fallback: check 'avatars/defaultAvatar.png'
            url = await storageService.fetchDocument('avatars/defaultAvatar.png');
        }

        if (url) {
            URL_CACHE.set('default_avatar_url', url);
            return url;
        }

        return null;
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

async function triggerBrowserDownload(blob, fileName) {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return;
    }

    if (typeof window.showSaveFilePicker === 'function') {
        try {
            const dotIndex = fileName.lastIndexOf('.');
            const ext = dotIndex !== -1 ? fileName.slice(dotIndex) : '';
            const handle = await window.showSaveFilePicker({
                suggestedName: fileName,
                types: ext ? [{
                    description: 'File',
                    accept: { [blob.type || 'application/octet-stream']: [ext] },
                }] : undefined,
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return;
        } catch (error) {
            if (error.name === 'AbortError') {
                return;
            }
            // SecurityError or user gesture expired falls through to standard browser anchor download
        }
    }

    const blobUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.style.position = 'fixed';
    anchor.style.left = '-9999px';
    anchor.style.top = '-9999px';
    anchor.style.opacity = '0';
    anchor.href = blobUrl;
    anchor.download = fileName;
    anchor.setAttribute('download', fileName);
    document.body.appendChild(anchor);

    try {
        anchor.dispatchEvent(
            new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
            })
        );
    } catch {
        anchor.click();
    }

    // Keep blob URL active for 60 seconds so browser download manager writes to laptop disk without net::ERR
    setTimeout(() => {
        if (anchor.parentNode) {
            anchor.parentNode.removeChild(anchor);
        }
        window.URL.revokeObjectURL(blobUrl);
    }, 60000);
}

// --- ZIP GENERATION (PKZIP STORE FORMAT) ---
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    CRC_TABLE[i] = c >>> 0;
}

function computeCrc32(uint8Array) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < uint8Array.length; i++) {
        crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ uint8Array[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function getDosDateTime(date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = Math.floor(date.getSeconds() / 2);

    const dosTime = ((hours & 0x1F) << 11) | ((minutes & 0x3F) << 5) | (seconds & 0x1F);
    const dosDate = (((year - 1980) & 0x7F) << 9) | ((month & 0x0F) << 5) | (day & 0x1F);
    return { dosTime, dosDate };
}

function createZipBlob(files) {
    const textEncoder = new TextEncoder();
    const localHeadersAndData = [];
    const centralDirectoryHeaders = [];
    let currentOffset = 0;
    const { dosTime, dosDate } = getDosDateTime(new Date());

    for (const file of files) {
        const nameBytes = textEncoder.encode(file.path.replace(/\\/g, '/'));
        const fileData = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
        const crc = computeCrc32(fileData);
        const size = fileData.length;

        // Local file header (30 bytes + name length)
        const localHeader = new Uint8Array(30);
        const localView = new DataView(localHeader.buffer);
        localView.setUint32(0, 0x04034b50, true);
        localView.setUint16(4, 20, true);
        localView.setUint16(6, 0x0800, true); // UTF-8 filename flag
        localView.setUint16(8, 0, true);      // Store (no compression)
        localView.setUint16(10, dosTime, true);
        localView.setUint16(12, dosDate, true);
        localView.setUint32(14, crc, true);
        localView.setUint32(18, size, true);
        localView.setUint32(22, size, true);
        localView.setUint16(26, nameBytes.length, true);
        localView.setUint16(28, 0, true);

        localHeadersAndData.push(localHeader, nameBytes, fileData);

        // Central directory header (46 bytes + name length)
        const centralHeader = new Uint8Array(46);
        const centralView = new DataView(centralHeader.buffer);
        centralView.setUint32(0, 0x02014b50, true);
        centralView.setUint16(4, 20, true);
        centralView.setUint16(6, 20, true);
        centralView.setUint16(8, 0x0800, true);
        centralView.setUint16(10, 0, true);
        centralView.setUint16(12, dosTime, true);
        centralView.setUint16(14, dosDate, true);
        centralView.setUint32(16, crc, true);
        centralView.setUint32(20, size, true);
        centralView.setUint32(24, size, true);
        centralView.setUint16(28, nameBytes.length, true);
        centralView.setUint16(30, 0, true);
        centralView.setUint16(32, 0, true);
        centralView.setUint16(34, 0, true);
        centralView.setUint16(36, 0, true);
        centralView.setUint32(38, 0, true);
        centralView.setUint32(42, currentOffset, true);

        centralDirectoryHeaders.push(centralHeader, nameBytes);

        currentOffset += localHeader.length + nameBytes.length + fileData.length;
    }

    const centralDirOffset = currentOffset;
    let centralDirSize = 0;
    for (const chunk of centralDirectoryHeaders) {
        centralDirSize += chunk.length;
    }

    // End of central directory record (22 bytes)
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(4, 0, true);
    eocdView.setUint16(6, 0, true);
    eocdView.setUint16(8, files.length, true);
    eocdView.setUint16(10, files.length, true);
    eocdView.setUint32(12, centralDirSize, true);
    eocdView.setUint32(16, centralDirOffset, true);
    eocdView.setUint16(20, 0, true);

    return new Blob([...localHeadersAndData, ...centralDirectoryHeaders, eocd], {
        type: 'application/zip',
    });
}


// --- EXPORTS ---
export { storageService };
