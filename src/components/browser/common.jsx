/* eslint-disable react-refresh/only-export-components */
// --- IMPORTS ---
import {
    Archive,
    Building2,
    FileArchive,
    FileCode,
    FileSpreadsheet,
    FileText,
    Film,
    Folder,
    Image,
    Inbox,
    Music,
    Presentation,
    UserCheck,
} from 'lucide-react';
import { Avatar } from '../Avatar';
import { Badge } from '../Badge';
import { constants } from '../../constants';
import { getMimeTypeFromFilename } from '../common';


// --- CONFIGURATIONS ---
const ICON_STYLE = 'h-4 w-4 shrink-0';
const LARGE_ICON_STYLE = 'h-4 w-4 shrink-0';


// --- HELPERS ---
const getResourceTitle = (resourceName) => {
    const titles = {
        users: 'Users Management',
        departments: 'Academic & Administrative Departments',
        coordinator_requests: 'Coordinator Requests',
        document_requests: 'Document Requests',
        documents: 'Documents Explorer',
        archives: 'Archived Records',
    };

    return titles[resourceName] ?? 'Resource Browser';
};

const getExtensionFromItem = (item) => {
    if (!item) return '';
    const raw = item.fileName || item.path || item.name || item.title || item.subject || '';
    if (typeof raw !== 'string') return '';
    const lastDot = raw.lastIndexOf('.');
    if (lastDot >= 0 && lastDot < raw.length - 1) {
        return raw.slice(lastDot + 1).toLowerCase().trim();
    }
    return '';
};

const getMimeTypeFromItem = (item) => {
    if (!item) return '';
    if (item.mimeType && item.mimeType !== 'application/octet-stream') {
        return item.mimeType;
    }
    if (item.type && item.type !== 'application/octet-stream') {
        return item.type;
    }
    if (item.contentType && item.contentType !== 'application/octet-stream') {
        return item.contentType;
    }
    const ext = getExtensionFromItem(item);
    if (ext) {
        return getMimeTypeFromFilename(`file.${ext}`);
    }
    return item.mimeType || item.type || item.contentType || '';
};

const renderMimeTypeIcon = (mimeType, ext, className = LARGE_ICON_STYLE) => {
    const lowerMime = (mimeType || '').toLowerCase();
    const lowerExt = (ext || '').toLowerCase().replace(/^\./, '');

    // 1. Image
    if (
        lowerMime.startsWith('image/') ||
        ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif', 'avif', 'heic', 'heif'].includes(lowerExt)
    ) {
        return <Image className={className} />;
    }

    // 2. Spreadsheet / Table
    if (
        lowerMime.includes('spreadsheetml') ||
        lowerMime.includes('ms-excel') ||
        lowerMime === 'text/csv' ||
        lowerMime === 'application/csv' ||
        ['xlsx', 'xls', 'csv', 'ods', 'xlsm', 'tsv'].includes(lowerExt)
    ) {
        return <FileSpreadsheet className={className} />;
    }

    // 3. Presentation / Slide deck
    if (
        lowerMime.includes('presentationml') ||
        lowerMime.includes('ms-powerpoint') ||
        ['pptx', 'ppt', 'odp', 'key'].includes(lowerExt)
    ) {
        return <Presentation className={className} />;
    }

    // 4. Code / Data Interchange / Config / Markup
    if (
        lowerMime === 'application/json' ||
        lowerMime.includes('xml') ||
        lowerMime.includes('javascript') ||
        lowerMime.includes('typescript') ||
        lowerMime === 'text/html' ||
        lowerMime === 'text/css' ||
        lowerMime === 'text/x-python' ||
        lowerMime === 'application/x-sh' ||
        lowerMime.includes('yaml') ||
        lowerMime.includes('sql') ||
        ['js', 'jsx', 'ts', 'tsx', 'json', 'html', 'htm', 'css', 'scss', 'sass', 'less', 'xml', 'py', 'sh', 'bash', 'zsh', 'yaml', 'yml', 'sql', 'env'].includes(lowerExt)
    ) {
        return <FileCode className={className} />;
    }

    // 5. Compressed Archive
    if (
        lowerMime.includes('zip') ||
        lowerMime.includes('tar') ||
        lowerMime.includes('compressed') ||
        lowerMime.includes('gzip') ||
        ['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2'].includes(lowerExt)
    ) {
        return <FileArchive className={className} />;
    }

    // 6. Audio
    if (
        lowerMime.startsWith('audio/') ||
        ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma', 'aiff'].includes(lowerExt)
    ) {
        return <Music className={className} />;
    }

    // 7. Video
    if (
        lowerMime.startsWith('video/') ||
        ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v'].includes(lowerExt)
    ) {
        return <Film className={className} />;
    }

    // 8. Documents (PDF, Word, Text, Markdown, Rich text)
    if (
        lowerMime === 'application/pdf' ||
        lowerMime.includes('wordprocessingml') ||
        lowerMime.includes('msword') ||
        lowerMime === 'text/plain' ||
        lowerMime === 'text/markdown' ||
        ['pdf', 'docx', 'doc', 'txt', 'text', 'md', 'markdown', 'rtf', 'odt'].includes(lowerExt)
    ) {
        return <FileText className={className} />;
    }

    // Default fallback icon
    return <FileText className={className} />;
};

const getItemCategoryRank = (item) => {
    if (!item) return 9;
    if (item.isFolder || item.category === 'Folder' || item.mimeType === 'folder') {
        return 0;
    }

    const mime = (getMimeTypeFromItem(item) || '').toLowerCase();
    const ext = getExtensionFromItem(item).toLowerCase();

    // 1. Documents (PDF, Word, Text, Markdown, Rich text)
    if (
        mime === 'application/pdf' ||
        mime.includes('wordprocessingml') ||
        mime.includes('msword') ||
        mime === 'text/plain' ||
        mime === 'text/markdown' ||
        ['pdf', 'docx', 'doc', 'txt', 'text', 'md', 'markdown', 'rtf', 'odt'].includes(ext)
    ) {
        return 1;
    }

    // 2. Spreadsheets (Excel, CSV, etc.)
    if (
        mime.includes('spreadsheetml') ||
        mime.includes('ms-excel') ||
        mime === 'text/csv' ||
        mime === 'application/csv' ||
        ['xlsx', 'xls', 'csv', 'ods', 'xlsm', 'tsv'].includes(ext)
    ) {
        return 2;
    }

    // 3. Presentations (PowerPoint, Keynote, etc.)
    if (
        mime.includes('presentationml') ||
        mime.includes('ms-powerpoint') ||
        ['pptx', 'ppt', 'odp', 'key'].includes(ext)
    ) {
        return 3;
    }

    // 4. Images
    if (
        mime.startsWith('image/') ||
        ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif', 'avif', 'heic', 'heif'].includes(ext)
    ) {
        return 4;
    }

    // 5. Code & Data
    if (
        mime === 'application/json' ||
        mime.includes('xml') ||
        mime.includes('javascript') ||
        mime.includes('typescript') ||
        mime === 'text/html' ||
        mime === 'text/css' ||
        mime === 'text/x-python' ||
        mime === 'application/x-sh' ||
        mime.includes('yaml') ||
        mime.includes('sql') ||
        ['js', 'jsx', 'ts', 'tsx', 'json', 'html', 'htm', 'css', 'scss', 'sass', 'less', 'xml', 'py', 'sh', 'bash', 'zsh', 'yaml', 'yml', 'sql', 'env'].includes(ext)
    ) {
        return 5;
    }

    // 6. Archives
    if (
        mime.includes('zip') ||
        mime.includes('tar') ||
        mime.includes('compressed') ||
        mime.includes('gzip') ||
        ['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2'].includes(ext)
    ) {
        return 6;
    }

    // 7. Audio
    if (
        mime.startsWith('audio/') ||
        ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma', 'aiff'].includes(ext)
    ) {
        return 7;
    }

    // 8. Video
    if (
        mime.startsWith('video/') ||
        ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v'].includes(ext)
    ) {
        return 8;
    }

    return 9;
};

const getSpecificMimeLabel = (mimeType, candidateNameOrExt) => {
    let ext = '';
    if (typeof candidateNameOrExt === 'string' && candidateNameOrExt.trim()) {
        const raw = candidateNameOrExt.trim();
        const lastDot = raw.lastIndexOf('.');
        ext = (lastDot >= 0 && lastDot < raw.length - 1 ? raw.slice(lastDot + 1) : raw).toLowerCase();
    }

    const mime = (mimeType || '').toLowerCase();

    // 1. Folders
    if (mime === 'folder' || ext === 'folder') {
        return 'Directory';
    }

    // 2. Documents
    if (mime === 'application/pdf' || ext === 'pdf') {
        return 'PDF';
    }
    if (mime.includes('wordprocessingml') || ext === 'docx') {
        return 'DOCX';
    }
    if (mime.includes('msword') || ext === 'doc') {
        return 'DOC';
    }
    if (ext === 'odt') {
        return 'ODT';
    }
    if (mime === 'text/plain' || ext === 'txt' || ext === 'text') {
        return 'TXT';
    }
    if (mime === 'text/markdown' || ext === 'md' || ext === 'markdown') {
        return 'MD';
    }
    if (ext === 'rtf') {
        return 'RTF';
    }

    // 3. Spreadsheets
    if (mime.includes('spreadsheetml') || ext === 'xlsx') {
        return 'XLSX';
    }
    if (mime.includes('ms-excel') || ext === 'xls') {
        return 'XLS';
    }
    if (mime === 'text/csv' || mime === 'application/csv' || ext === 'csv') {
        return 'CSV';
    }
    if (ext === 'ods') {
        return 'ODS';
    }

    // 4. Presentations
    if (mime.includes('presentationml') || ext === 'pptx') {
        return 'PPTX';
    }
    if (mime.includes('ms-powerpoint') || ext === 'ppt') {
        return 'PPT';
    }
    if (ext === 'odp') {
        return 'ODP';
    }
    if (ext === 'key') {
        return 'KEY';
    }

    // 5. Images
    if (mime === 'image/png' || ext === 'png') {
        return 'PNG';
    }
    if (mime === 'image/jpeg' || mime === 'image/jpg' || ext === 'jpg' || ext === 'jpeg') {
        return 'JPG';
    }
    if (mime === 'image/webp' || ext === 'webp') {
        return 'WEBP';
    }
    if (mime === 'image/gif' || ext === 'gif') {
        return 'GIF';
    }
    if (mime === 'image/svg+xml' || ext === 'svg') {
        return 'SVG';
    }
    if (mime.startsWith('image/')) {
        return ext ? ext.toUpperCase() : 'IMAGE';
    }

    // 6. Audio
    if (mime === 'audio/mpeg' || mime === 'audio/mp3' || ext === 'mp3') {
        return 'MP3';
    }
    if (mime === 'audio/wav' || ext === 'wav') {
        return 'WAV';
    }
    if (mime === 'audio/ogg' || ext === 'ogg') {
        return 'OGG';
    }
    if (mime === 'audio/flac' || ext === 'flac') {
        return 'FLAC';
    }
    if (mime === 'audio/aac' || ext === 'aac') {
        return 'AAC';
    }
    if (mime === 'audio/m4a' || ext === 'm4a') {
        return 'M4A';
    }
    if (mime.startsWith('audio/')) {
        return ext ? ext.toUpperCase() : 'AUDIO';
    }

    // 7. Video
    if (mime === 'video/mp4' || ext === 'mp4') {
        return 'MP4';
    }
    if (mime === 'video/webm' || ext === 'webm') {
        return 'WEBM';
    }
    if (mime === 'video/quicktime' || ext === 'mov') {
        return 'MOV';
    }
    if (mime === 'video/x-msvideo' || ext === 'avi') {
        return 'AVI';
    }
    if (ext === 'mkv') {
        return 'MKV';
    }
    if (mime.startsWith('video/')) {
        return ext ? ext.toUpperCase() : 'VIDEO';
    }

    // 8. Code & Data
    if (mime === 'application/json' || ext === 'json') {
        return 'JSON';
    }
    if (mime.includes('xml') || ext === 'xml') {
        return 'XML';
    }
    if (mime.includes('javascript') || ext === 'js' || ext === 'mjs' || ext === 'cjs') {
        return 'JS';
    }
    if (ext === 'jsx') {
        return 'JSX';
    }
    if (mime.includes('typescript') || ext === 'ts') {
        return 'TS';
    }
    if (ext === 'tsx') {
        return 'TSX';
    }
    if (mime === 'text/html' || ext === 'html' || ext === 'htm') {
        return 'HTML';
    }
    if (mime === 'text/css' || ext === 'css' || ext === 'scss' || ext === 'sass' || ext === 'less') {
        return ext ? ext.toUpperCase() : 'CSS';
    }
    if (mime === 'text/x-python' || ext === 'py') {
        return 'PY';
    }
    if (mime === 'application/x-sh' || ext === 'sh' || ext === 'bash') {
        return 'SH';
    }
    if (mime.includes('yaml') || ext === 'yaml' || ext === 'yml') {
        return 'YAML';
    }
    if (mime.includes('sql') || ext === 'sql') {
        return 'SQL';
    }

    // 9. Archives
    if (mime === 'application/zip' || ext === 'zip') {
        return 'ZIP';
    }
    if (mime === 'application/x-tar' || ext === 'tar') {
        return 'TAR';
    }
    if (mime === 'application/gzip' || ext === 'gz' || ext === 'tgz') {
        return 'GZ';
    }
    if (mime === 'application/x-7z-compressed' || ext === '7z') {
        return '7Z';
    }
    if (mime.includes('rar') || ext === 'rar') {
        return 'RAR';
    }

    if (ext) {
        return ext.toUpperCase();
    }

    return 'FILE';
};

const renderItemIcon = (item = {}, resourceName, customClassName = LARGE_ICON_STYLE) => {
    if (item?.isFolder || item?.category === 'Folder' || item?.mimeType === 'folder') {
        return <Folder className={customClassName} />;
    }

    if (resourceName === 'users' || item?.universityId) {
        return (
            <Avatar
                src={item?.avatarPath}
                user={item?.user ?? item}
                alt={item?.title ?? item?.name}
                size="small"
                className="h-full w-full rounded-full aspect-square"
            />
        );
    }

    if (resourceName === 'departments') {
        return <Building2 className={customClassName} />;
    }

    if (resourceName === 'coordinator_requests') {
        return <UserCheck className={customClassName} />;
    }

    if (resourceName === 'document_requests' && !item?.mimeType && !getExtensionFromItem(item)) {
        return <Inbox className={customClassName} />;
    }

    // If an archive resource empty placeholder or item without file/mime
    if (resourceName === 'archives' && !item?.id && !item?.mimeType && !getExtensionFromItem(item)) {
        return <Archive className={customClassName} />;
    }

    const effectiveMime = getMimeTypeFromItem(item);
    const effectiveExt = getExtensionFromItem(item);

    if (effectiveMime || effectiveExt) {
        return renderMimeTypeIcon(effectiveMime, effectiveExt, customClassName);
    }

    if (resourceName === 'archives') {
        return <Archive className={customClassName} />;
    }

    return <FileText className={customClassName} />;
};

const renderItemBadge = (item, columnKey) => {
    if (!item) return null;

    if (columnKey === 'role') {
        if (!item.role) return null;
        return <Badge variant="neutral" label={item.role} />;
    }

    if (columnKey === 'status') {
        if (!item.status || item.status === '—' || item.status === '--') {
            return <span className="text-text-muted whitespace-nowrap">—</span>;
        }
        const upper = String(item.status).toUpperCase();
        const variant = (upper === 'PENDING_APPROVAL' || upper.includes('PENDING'))
            ? 'warning'
            : (upper.includes('VERIF') || upper.includes('APPROV') || upper.includes('RESOLV') || upper.includes('PUBLISH') || upper.includes('ACTIVE'))
            ? 'success'
            : (upper.includes('PENDING_SSO') || upper === 'OPEN' || upper.includes('OPEN'))
            ? 'information'
            : (upper.includes('REJECT') || upper.includes('SUSPEND') || upper.includes('RESTRICT'))
            ? 'error'
            : 'neutral';
        return <Badge variant={variant} label={item.status} />;
    }

    if (columnKey === 'classification') {
        if (!item.classification || item.classification === '—' || item.classification === '--' || item.isFolder) {
            return <span className="text-text-muted whitespace-nowrap">—</span>;
        }
        const variant = item.classification === constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC
            ? 'success'
            : item.classification === constants.DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE
            ? 'information'
            : item.classification === constants.DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL
            ? 'warning'
            : item.classification === constants.DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED
            ? 'error'
            : 'neutral';
        return <Badge variant={variant} label={item.classification} />;
    }

    if (!item.isFolder && item.classification && item.classification !== '—' && item.classification !== '--') {
        const variant = item.classification === constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC
            ? 'success'
            : item.classification === constants.DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE
            ? 'information'
            : item.classification === constants.DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL
            ? 'warning'
            : item.classification === constants.DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED
            ? 'error'
            : 'neutral';
        return <Badge variant={variant} label={item.classification} />;
    }

    const isDocumentOrFolder = item.isFolder || item.category === 'Document' || item.category === 'Folder';

    if (item.status && !isDocumentOrFolder) {
        const upper = String(item.status).toUpperCase();
        const variant = (upper === 'PENDING_APPROVAL' || upper.includes('PENDING'))
            ? 'warning'
            : (upper.includes('VERIF') || upper.includes('APPROV') || upper.includes('RESOLV') || upper.includes('PUBLISH') || upper.includes('ACTIVE'))
            ? 'success'
            : (upper.includes('PENDING_SSO') || upper === 'OPEN' || upper.includes('OPEN'))
            ? 'information'
            : (upper.includes('REJECT') || upper.includes('SUSPEND') || upper.includes('CONFIDENT'))
            ? 'error'
            : 'neutral';
        return <Badge variant={variant} label={item.status} />;
    }

    if (item.role) {
        return <Badge variant="neutral" label={item.role} />;
    }

    if (item.badge) {
        return <Badge variant="neutral" label={item.badge} />;
    }

    return null;
};


// --- EXPORTS ---
export {
    ICON_STYLE,
    LARGE_ICON_STYLE,
    getResourceTitle,
    renderItemIcon,
    renderItemBadge,
    renderMimeTypeIcon,
    getMimeTypeFromItem,
    getExtensionFromItem,
    getItemCategoryRank,
    getSpecificMimeLabel,
};
