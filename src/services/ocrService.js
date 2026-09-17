// --- IMPORTS ---

// --- CONFIGURATIONS ---
const OCR_SERVICE_BASE_URL = import.meta.env.VITE_OCR_SERVICE_URL || 'http://localhost:5005';

const SUPPORTED_IMAGE_EXTENSIONS = new Set([
    'png',
    'jpg',
    'jpeg',
    'webp',
    'bmp',
    'tiff',
    'tif',
    'jfif',
]);

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/bmp',
    'image/tiff',
    'image/x-png',
]);

// Helper: Convert Base64 string to Blob
const base64ToBlob = (base64String, contentType = 'application/pdf') => {
    const byteCharacters = atob(base64String);
    const byteArrays = [];
    const sliceSize = 512;

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: contentType });
};

// --- OCR SERVICE ---
export const ocrService = {
    /**
     * Determines whether a given file object or file name is a supported image.
     */
    isImageFile: (fileOrName) => {
        if (!fileOrName) return false;

        if (typeof fileOrName === 'object') {
            if (fileOrName.type && SUPPORTED_IMAGE_MIME_TYPES.has(fileOrName.type.toLowerCase())) {
                return true;
            }
            const name = fileOrName.name || fileOrName.fileName || '';
            const ext = name.split('.').pop()?.toLowerCase();
            return ext ? SUPPORTED_IMAGE_EXTENSIONS.has(ext) : false;
        }

        if (typeof fileOrName === 'string') {
            const ext = fileOrName.split('.').pop()?.toLowerCase();
            return ext ? SUPPORTED_IMAGE_EXTENSIONS.has(ext) : false;
        }

        return false;
    },

    /**
     * Health check for the PaddleOCR backend microservice.
     */
    checkHealth: async (baseUrl = OCR_SERVICE_BASE_URL) => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(`${baseUrl}/health`, {
                method: 'GET',
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                return { isAvailable: false, error: `HTTP ${response.status}` };
            }
            const data = await response.json();
            return { isAvailable: true, data };
        } catch (error) {
            return {
                isAvailable: false,
                error: error?.message || 'Cannot reach OCR service',
            };
        }
    },

    /**
     * Extracts text lines and OCR data from an image file.
     */
    extractText: async (file, options = {}) => {
        const { language = 'en', baseUrl = OCR_SERVICE_BASE_URL } = options;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('language', language);

        const response = await fetch(`${baseUrl}/ocr/extract-text`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `OCR Text Extraction failed with status ${response.status}`);
        }

        return await response.json();
    },

    /**
     * Scans an image with PaddleOCR and converts it into a high-quality searchable PDF.
     * Returns the newly minted File object, Blob, and extracted text metadata.
     */
    convertImageToPdf: async (file, options = {}) => {
        const {
            language = 'en',
            customTitle = null,
            baseUrl = OCR_SERVICE_BASE_URL,
        } = options;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('language', language);
        if (customTitle) {
            formData.append('customTitle', customTitle);
        }

        const response = await fetch(`${baseUrl}/ocr/convert-to-pdf`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `PaddleOCR conversion failed with status ${response.status}`);
        }

        const result = await response.json();
        const pdfBlob = base64ToBlob(result.pdfBase64, 'application/pdf');

        const finalFileName = result.pdfFileName || `${(file.name || 'document').replace(/\.[^/.]+$/, '')}.pdf`;
        const pdfFile = new File([pdfBlob], finalFileName, {
            type: 'application/pdf',
            lastModified: Date.now(),
        });

        return {
            success: true,
            pdfFile,
            pdfBlob,
            pdfFileName: finalFileName,
            originalFileName: result.originalFileName || file.name,
            sizeBytes: result.sizeBytes || pdfBlob.size,
            mimeType: 'application/pdf',
            extractedText: result.extractedText || '',
            averageConfidence: result.averageConfidence || 0,
            linesCount: result.linesCount || 0,
        };
    },
};

export default ocrService;
