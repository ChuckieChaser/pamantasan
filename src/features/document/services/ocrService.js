// --- IMPORTS ---
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../services/firebase';


// --- CONFIGURATIONS ---
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


// --- HELPERS ---
const base64ToBlob = (base64String, contentType = 'application/pdf') => {
    const cleanBase64 = base64String.replace(/^data:[^;]+;base64,/, '').trim();
    const byteCharacters = atob(cleanBase64);
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

const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
});


// --- SERVICES ---
export const isImageFile = (fileOrName) => {
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
};

export const checkOcrHealth = async () => {
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
};

export const extractTextFromImage = async (file, options = {}) => {
    const { autoWhiten = true } = options;

    if (!functions) {
        throw new Error('Firebase Functions instance not available.');
    }

    const extractCallable = httpsCallable(functions, 'extractTextFromImage');
    const imageBase64 = typeof file === 'string' ? file : await fileToBase64(file);

    const response = await extractCallable({
        imageBase64,
        autoWhiten: Boolean(autoWhiten),
    });

    if (response.data?.success) {
        return response.data;
    }

    throw new Error(response.data?.error || 'Cloud OCR text extraction failed.');
};

export const convertImageToSearchablePdf = async (file, options = {}) => {
    const {
        customTitle = null,
        autoWhiten = true,
    } = options;

    if (!functions) {
        throw new Error('Firebase Functions instance not available.');
    }

    const convertCallable = httpsCallable(functions, 'convertImageToSearchablePdf');
    const imageBase64 = typeof file === 'string' ? file : await fileToBase64(file);
    const fileName = typeof file === 'string' ? 'scan.jpg' : (file.name || file.fileName || 'document.jpg');

    const response = await convertCallable({
        imageBase64,
        fileName,
        customTitle: customTitle || null,
        autoWhiten: Boolean(autoWhiten),
    });

    const result = response.data;
    if (result?.success && result?.pdfBase64) {
        const pdfBlob = base64ToBlob(result.pdfBase64, 'application/pdf');
        const finalFileName = result.pdfFileName || `${fileName.replace(/\.[^/.]+$/, '')}.pdf`;
        const pdfFile = new File([pdfBlob], finalFileName, {
            type: 'application/pdf',
            lastModified: Date.now(),
        });

        return {
            success: true,
            pdfFile,
            pdfBlob,
            pdfFileName: finalFileName,
            originalFileName: result.originalFileName || fileName,
            sizeBytes: result.sizeBytes || pdfBlob.size,
            mimeType: 'application/pdf',
            extractedText: result.extractedText || '',
            averageConfidence: result.averageConfidence || 0,
            linesCount: result.linesCount || 0,
            engine: result.engine || 'Google Cloud OCR',
        };
    }

    throw new Error(result?.error || 'Cloud OCR searchable PDF conversion failed.');
};

export const createMobileScanSession = async (adminUid) => {
    if (!functions) {
        throw new Error('Firebase Functions instance not available.');
    }

    const createCallable = httpsCallable(functions, 'createMobileScanSession');
    const response = await createCallable({ adminUid: adminUid || 'anonymous' });

    if (response.data?.success) {
        return response.data;
    }

    throw new Error(response.data?.error || 'Failed to initialize mobile scan session.');
};

export const submitMobileScan = async ({ sessionId, token, file, autoWhiten = true }) => {
    if (!functions) {
        throw new Error('Firebase Functions instance not available.');
    }

    const submitCallable = httpsCallable(functions, 'submitMobileScan');
    const imageBase64 = typeof file === 'string' ? file : await fileToBase64(file);
    const fileName = typeof file === 'string' ? 'mobile_scan.jpg' : (file.name || 'mobile_scan.jpg');

    const response = await submitCallable({
        sessionId,
        token,
        imageBase64,
        autoWhiten: Boolean(autoWhiten),
        fileName,
    });

    if (response.data?.success) {
        return response.data;
    }

    throw new Error(response.data?.error || 'Failed to submit mobile scan capture.');
};


// --- COMPOSITE SERVICE EXPORT ---
export const ocrService = {
    isImageFile,
    checkHealth: checkOcrHealth,
    extractText: extractTextFromImage,
    convertImageToPdf: convertImageToSearchablePdf,
    createMobileScanSession,
    submitMobileScan,
};
