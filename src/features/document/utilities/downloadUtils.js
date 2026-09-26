// --- CONFIGURATIONS ---
const MIME_TYPE_MAP = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.zip': 'application/zip',
};


// --- DOWNLOAD UTILITIES ---
export const triggerBrowserDownload = async (blob, fileName) => {
    if (typeof window === 'undefined' || typeof document === 'undefined' || !blob) {
        return;
    }

    const dotIndex = fileName.lastIndexOf('.');
    const ext = dotIndex !== -1 ? fileName.slice(dotIndex).toLowerCase() : '';
    const resolvedMime = blob.type && blob.type !== 'application/octet-stream'
        ? blob.type
        : (MIME_TYPE_MAP[ext] ?? 'application/octet-stream');

    if (typeof window.showSaveFilePicker === 'function') {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: fileName,
                types: ext ? [{
                    description: `${ext.slice(1).toUpperCase()} File`,
                    accept: { [resolvedMime]: [ext] },
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
            // SecurityError or expired user gesture falls back to anchor download
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

    setTimeout(() => {
        if (anchor.parentNode) {
            anchor.parentNode.removeChild(anchor);
        }
        window.URL.revokeObjectURL(blobUrl);
    }, 15000);
};
