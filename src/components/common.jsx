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


// --- EXPORTS ---
export { renderIcon, formatUniversityId, formatDateTime, getMimeTypeFromFilename };

