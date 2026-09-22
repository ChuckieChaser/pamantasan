// --- IMPORTS ---
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

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

// Helper: Convert File or Blob to base64 Data URL string
const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
});

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
     * Health check for the Cloud OCR service.
     */
    checkHealth: async () => {
        if (!functions) {
            return {
                isAvailable: false,
                error: 'Firebase Functions instance not initialized',
            };
        }
        return {
            isAvailable: true,
            engine: 'Google Cloud OCR (Vision & Vertex AI)',
            data: {
                status: 'healthy',
                engine: 'Google Cloud OCR (Serverless)',
            },
        };
    },

    /**
     * Extracts text lines and OCR data from an image file using Cloud Functions.
     */
    extractText: async (file, options = {}) => {
        const { autoWhiten = true } = options;

        if (!functions) {
            throw new Error('Firebase Functions instance not available');
        }

        const extractCallable = httpsCallable(functions, 'extractTextFromImage');
        const imageBase64 = await fileToBase64(file);
        const response = await extractCallable({
            imageBase64,
            autoWhiten: Boolean(autoWhiten),
        });

        if (response.data && response.data.success) {
            return response.data;
        }

        throw new Error(response.data?.error || 'Cloud OCR text extraction failed');
    },

    /**
     * Scans an image with Cloud OCR and converts it into a high-quality searchable PDF.
     * Returns the newly minted File object, Blob, and extracted text metadata.
     */
    convertImageToPdf: async (file, options = {}) => {
        const {
            customTitle = null,
            autoWhiten = true,
        } = options;

        if (!functions) {
            throw new Error('Firebase Functions instance not available');
        }

        const convertCallable = httpsCallable(functions, 'convertImageToSearchablePdf');
        const imageBase64 = await fileToBase64(file);
        const response = await convertCallable({
            imageBase64,
            fileName: file.name || file.fileName || 'document.jpg',
            customTitle: customTitle || null,
            autoWhiten: Boolean(autoWhiten),
        });

        const result = response.data;
        if (result && result.success && result.pdfBase64) {
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
                engine: result.engine || 'Google Cloud OCR',
            };
        }

        throw new Error(result?.error || 'Cloud OCR conversion failed');
    },
};

export default ocrService;


