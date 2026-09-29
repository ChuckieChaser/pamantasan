// --- IMPORTS ---
import { cloneElement, isValidElement } from 'react';


// --- HELPERS ---
const renderIcon = (icon, iconStyle) => {
    if (!icon) {
        return null;
    }

    if (isValidElement(icon)) {
        const iconClassName = `${iconStyle} ${icon.props.className ?? ''}`.trim();
        return cloneElement(icon, { className: iconClassName });
    }

    const IconComponent = icon;
    return <IconComponent className={iconStyle} />;
};


const formatUniversityId = (value) => {
    if (!value) return '';
    const digits = String(value).replace(/\D/g, '').slice(0, 7);
    if (digits.length <= 2) {
        return digits;
    }
    return `${digits.slice(0, 2)}-${digits.slice(2, 7)}`;
};


const formatDateTime = (dateInput) => {
    if (!dateInput) return '—';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return typeof dateInput === 'string' ? dateInput : '—';
    const datePart = d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
    const timePart = d.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
    return `${datePart} at ${timePart}`;
};


const getMimeTypeFromFilename = (filename) => {
    if (!filename || typeof filename !== 'string') {
        return 'application/octet-stream';
    }

    const dotIndex = filename.lastIndexOf('.');
    if (dotIndex < 0) {
        return 'application/octet-stream';
    }

    const extension = filename.slice(dotIndex + 1).toLowerCase();
    const mimeTypes = {
        pdf:  'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        doc:  'application/msword',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        xls:  'application/vnd.ms-excel',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ppt:  'application/vnd.ms-powerpoint',
        png:  'image/png',
        jpg:  'image/jpeg',
        jpeg: 'image/jpeg',
        gif:  'image/gif',
        webp: 'image/webp',
        svg:  'image/svg+xml',
        txt:  'text/plain',
        text: 'text/plain',
        csv:  'text/csv',
        md:   'text/markdown',
        markdown: 'text/markdown',
        json: 'application/json',
        xml:  'application/xml',
        html: 'text/html',
        htm:  'text/html',
        css:  'text/css',
        js:   'application/javascript',
        jsx:  'text/javascript',
        ts:   'application/typescript',
        tsx:  'application/typescript',
        py:   'text/x-python',
        sh:   'application/x-sh',
        zip:  'application/zip',
        tar:  'application/x-tar',
        gz:   'application/gzip',
        '7z': 'application/x-7z-compressed',
        mp3:  'audio/mpeg',
        mp4:  'video/mp4',
        wav:  'audio/wav',
    };

    return mimeTypes[extension] ?? 'application/octet-stream';
};

const formatMimeTypeLabel = (mimeType) => {
    if (!mimeType || typeof mimeType !== 'string') return 'Unknown File';
    const lower = mimeType.toLowerCase();
    if (lower.includes('wordprocessingml') || lower.includes('msword') || lower === 'application/docx') {
        return 'Word Document (.docx)';
    }
    if (lower.includes('spreadsheetml') || lower.includes('ms-excel') || lower === 'application/xlsx') {
        return 'Excel Spreadsheet (.xlsx)';
    }
    if (lower.includes('presentationml') || lower.includes('ms-powerpoint') || lower === 'application/pptx') {
        return 'PowerPoint (.pptx)';
    }
    if (lower === 'application/pdf') return 'PDF Document (.pdf)';
    if (lower === 'text/plain') return 'Plain Text (.txt)';
    if (lower === 'text/csv') return 'CSV Document (.csv)';
    if (lower === 'text/markdown') return 'Markdown (.md)';
    if (lower === 'application/json') return 'JSON Document (.json)';
    if (lower === 'image/png') return 'PNG Image (.png)';
    if (lower === 'image/jpeg' || lower === 'image/jpg') return 'JPEG Image (.jpg)';
    if (lower === 'image/webp') return 'WebP Image (.webp)';
    if (lower === 'image/svg+xml') return 'SVG Vector (.svg)';
    if (lower === 'image/gif') return 'GIF Image (.gif)';
    if (lower.includes('zip') || lower.includes('tar') || lower.includes('compressed') || lower.includes('7z')) {
        return 'Compressed Archive (.zip)';
    }
    if (lower.startsWith('audio/')) return 'Audio Recording';
    if (lower.startsWith('video/')) return 'Video Recording';
    if (lower === 'folder') return 'Directory Folder';
    return mimeType;
};

const getExtensionFromMimeType = (mimeType) => {
    if (!mimeType) return '.pdf';
    const lower = mimeType.toLowerCase();
    if (lower.includes('wordprocessingml') || lower.includes('msword') || lower === 'application/docx') return '.docx';
    if (lower.includes('spreadsheetml') || lower.includes('ms-excel') || lower === 'application/xlsx') return '.xlsx';
    if (lower.includes('presentationml') || lower.includes('powerpoint') || lower === 'application/pptx') return '.pptx';
    if (lower.includes('pdf')) return '.pdf';
    if (lower.includes('text/plain')) return '.txt';
    if (lower.includes('text/csv')) return '.csv';
    if (lower.includes('markdown')) return '.md';
    if (lower.includes('json')) return '.json';
    if (lower.includes('png')) return '.png';
    if (lower.includes('jpeg') || lower.includes('jpg')) return '.jpg';
    if (lower.includes('webp')) return '.webp';
    return '.pdf';
};

const fileToBase64 = (file) => new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
});

// --- EXPORTS ---
export {
    renderIcon,
    formatUniversityId,
    formatDateTime,
    getMimeTypeFromFilename,
    formatMimeTypeLabel,
    getExtensionFromMimeType,
    fileToBase64,
};

