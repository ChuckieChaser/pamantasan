// --- FILE NAME UTILITIES ---
// Institutional reference numbers frequently contain periods (e.g. "PSSC-NOTICE_NO. 37-2026"),
// so extensions must be matched against a known list instead of "whatever follows the last dot".

const KNOWN_FILE_EXTENSION_PATTERN = /\.(pdf|png|jpe?g|jfif|webp|gif|bmp|tiff?|heic|heif|svg|docx?|xlsx?|xlsm|csv|pptx?|odt|ods|odp|rtf|txt|md|json|xml|html?|zip|rar|7z|tar|gz|mp3|wav|m4a|ogg|mp4|mov|avi|mkv|webm)$/i;

/**
 * Removes a trailing file extension only when it is a recognized file format.
 * "report.pdf" -> "report", "PSSC-NOTICE_NO. 37-2026" -> unchanged.
 */
export function stripFileExtension(name) {
    if (!name || typeof name !== 'string') return '';
    return name.replace(KNOWN_FILE_EXTENSION_PATTERN, '').trim();
}

/**
 * Returns the recognized extension (including the dot) or an empty string.
 */
export function getKnownFileExtension(name) {
    if (!name || typeof name !== 'string') return '';
    const match = name.match(KNOWN_FILE_EXTENSION_PATTERN);
    return match ? match[0].toLowerCase() : '';
}

/**
 * Detects meaningless camera, messenger, scanner, or download filenames
 * (e.g. "831165538_1779552356494090_2291586515403907043_n", "IMG_20261003_1145", "1234").
 */
export function isGenericFileName(name) {
    const base = stripFileExtension(name || '').trim();
    if (!base) return true;

    // Pure numbers / numeric hashes with separators and optional 1-letter suffix (Facebook "_n", "_o")
    if (/^\d+(?:[\s_-]+\d+)*(?:[\s_-]?[a-z])?$/i.test(base)) return true;

    // UUIDs and long hex hashes
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(base)) return true;
    if (/^[0-9a-f]{16,}$/i.test(base)) return true;

    // Camera / screenshot / scanner / messenger defaults followed only by dates, numbers, or counters
    if (/^(?:img|image|pxl|dsc|dscn|dcim|photo|picture|pic|scan|scanned|mobile[\s_-]?scan|screenshot|screen[\s_-]?shot|camscanner|whatsapp[\s_-]?image|messenger[\s_-]?creation|received|download|document|untitled|file|new[\s_-]?document|blob)(?:[\s_\-.:()]*(?:\d+|at|am|pm|copy|[a-f0-9]{6,}))*[\s_\-.()]*$/i.test(base)) return true;

    return false;
}

/**
 * Derives an official title from OCR / extracted document text.
 * Priority: institutional reference number (e.g. "PLP-AAO-ND-NS-MEM-2026-45", "PSSC-NOTICE_NO. 35-2026"),
 * then the SUBJECT line. Returns null when nothing reliable is found.
 */
export function deriveTitleFromDocumentText(text) {
    if (!text || typeof text !== 'string') return null;
    const raw = text.replace(/\r\n/g, '\n');

    const referenceMatch = raw.match(/\b[A-Z]{2,}(?:[-_][A-Z0-9]+)+(?:[.\s]*\d+)?(?:\s*[-_]\s*\d{1,4})*/);
    if (referenceMatch && /\d/.test(referenceMatch[0])) {
        const reference = sanitizeTitle(referenceMatch[0].replace(/\s*([-_])\s*/g, '$1'));
        if (reference && reference.length >= 6) return reference;
    }

    const subjectMatch = raw.match(/\bSUBJECT\s*[:;\u2014-]\s*([^\n]+)/i);
    if (subjectMatch) {
        const subject = sanitizeTitle(subjectMatch[1]);
        if (subject && subject.length >= 4) return subject;
    }

    return null;
}

function sanitizeTitle(value) {
    return (value || '')
        .replace(/[\\/:*?"<>|]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120)
        .trim();
}
