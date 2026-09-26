// --- OCR: CORE SERVICE ---
// Cloud Vision API (primary) + Vertex AI Gemini (fallback) OCR engine.
// Produces searchable ISO A4 PDFs with invisible embedded text layers.

const { PDFDocument, StandardFonts } = require('pdf-lib');
const sharp = require('sharp');

let vision = null;
try {
    vision = require('@google-cloud/vision');
} catch (vErr) {
    console.warn('[ocrService] @google-cloud/vision not loaded:', vErr?.message);
}

const { GoogleGenAI } = require('@google/genai');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'pamantasan-records-210fe';
const VERTEX_LOCATION = process.env.VERTEX_AI_LOCATION || 'asia-southeast1';


// --- CLIENT FACTORY ---

let visionClient = null;

const getVisionClient = () => {
    if (!visionClient && vision) {
        try {
            visionClient = new vision.ImageAnnotatorClient({ projectId: PROJECT_ID });
        } catch (err) {
            console.warn('[ocrService] Could not initialize ImageAnnotatorClient:', err?.message);
        }
    }
    return visionClient;
};


// --- UTILITY ---

/**
 * Sanitizes Unicode characters to WinAnsi/ASCII printable range.
 * Ensures pdf-lib Helvetica encoding never crashes on special characters.
 * @param {string} str - Input string.
 * @returns {string} Sanitized string.
 */
const sanitizeWinAnsiText = (str) => {
    if (!str) return '';
    return str
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/[\u2026]/g, '...')
        .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '-')
        .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')
        .trim();
};


// --- IMAGE ENHANCEMENT ---

/**
 * Enhances document illumination for improved OCR accuracy.
 * Normalizes uneven lighting/shadows, stretches paper tone to crisp white, deepens dark text.
 * @param {Buffer} imageBuffer - Raw image buffer.
 * @returns {Promise<{ buffer: Buffer, width: number, height: number, format: string }>}
 */
const enhanceDocumentWhitening = async (imageBuffer) => {
    try {
        const enhancedBuffer = await sharp(imageBuffer)
            .rotate()         // Auto-orient from EXIF
            .normalize()      // Stretch luminance to full 0-255 range
            .gamma(1.1)       // Brighten mid-tones
            .linear(1.15, -15) // Boost contrast: deeper blacks, cleaner whites
            .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
            .toBuffer();

        const metadata = await sharp(enhancedBuffer).metadata();

        return {
            buffer: enhancedBuffer,
            width: metadata.width || 800,
            height: metadata.height || 1100,
            format: 'jpeg',
        };
    } catch (err) {
        console.warn('[ocrService] Sharp enhancement failed, using raw image:', err?.message);

        try {
            const meta = await sharp(imageBuffer).metadata();
            return { buffer: imageBuffer, width: meta.width || 800, height: meta.height || 1100, format: meta.format || 'jpeg' };
        } catch {
            return { buffer: imageBuffer, width: 800, height: 1100, format: 'jpeg' };
        }
    }
};


// --- OCR ENGINE ---

/**
 * Runs OCR text recognition on an image buffer.
 * Primary: Google Cloud Vision API (documentTextDetection with exact bounding boxes).
 * Fallback: Vertex AI Gemini 2.0 Flash (multimodal OCR transcription).
 *
 * @param {Buffer} imageBuffer - Raw image buffer.
 * @param {boolean} [autoWhiten=true] - Whether to apply whitening enhancement first.
 * @returns {Promise<{ imageBuffer: Buffer, width: number, height: number, format: string, lines: Array, fullText: string, averageConfidence: number, linesCount: number, engine: string }>}
 */
const processImageOcr = async (imageBuffer, autoWhiten = true) => {
    const { buffer: processedBuffer, width, height, format } = autoWhiten
        ? await enhanceDocumentWhitening(imageBuffer)
        : await (async () => {
            try {
                const m = await sharp(imageBuffer).rotate().toBuffer({ resolveWithObject: true });
                return { buffer: m.data, width: m.info.width, height: m.info.height, format: m.info.format };
            } catch {
                return { buffer: imageBuffer, width: 800, height: 1100, format: 'jpeg' };
            }
        })();

    let lineItems = [];
    let fullText = '';
    let totalConfidence = 0;
    let usedEngine = 'Cloud Vision';

    // ATTEMPT 1: Google Cloud Vision API
    const client = getVisionClient();
    if (client) {
        try {
            console.log('[ocrService] Running Cloud Vision documentTextDetection...');
            const [result] = await client.documentTextDetection({ image: { content: processedBuffer } });
            const annotation = result?.fullTextAnnotation;

            if (annotation?.text) {
                fullText = annotation.text.trim();

                let currentLineWords = [];
                let currentLineVertices = [];

                const commitCurrentLine = (confidence = 0.95) => {
                    if (currentLineWords.length === 0) return;
                    const lineText = currentLineWords.join(' ').trim();
                    if (!lineText) {
                        currentLineWords = [];
                        currentLineVertices = [];
                        return;
                    }

                    const xs = currentLineVertices.map((v) => v.x || 0);
                    const ys = currentLineVertices.map((v) => v.y || 0);

                    totalConfidence += confidence;
                    lineItems.push({
                        text: lineText,
                        box: { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) },
                        confidence: Math.round(confidence * 100) / 100,
                    });

                    currentLineWords = [];
                    currentLineVertices = [];
                };

                for (const page of annotation.pages || []) {
                    for (const block of page.blocks || []) {
                        for (const para of block.paragraphs || []) {
                            const paraConf = para.confidence || block.confidence || 0.95;
                            for (const word of para.words || []) {
                                const wordText = (word.symbols || []).map((s) => s.text).join('');
                                if (wordText) {
                                    currentLineWords.push(wordText);
                                    currentLineVertices.push(...(word.boundingBox?.vertices || []));
                                }

                                const lastSymbol = (word.symbols || []).at(-1);
                                const breakType = lastSymbol?.property?.detectedBreak?.type;
                                if (breakType === 'LINE_BREAK' || breakType === 'EOL_SURE_SPACE') {
                                    commitCurrentLine(paraConf);
                                }
                            }
                            commitCurrentLine(paraConf);
                        }
                    }
                }
            }
        } catch (visionErr) {
            console.warn('[ocrService] Cloud Vision failed, falling back to Vertex AI Gemini:', visionErr?.message);
        }
    }

    // ATTEMPT 2: Vertex AI Gemini 2.0 Flash (OCR fallback)
    if (lineItems.length === 0) {
        try {
            console.log('[ocrService] Using Vertex AI Gemini 2.0 Flash for OCR extraction...');
            const ai = new GoogleGenAI({ vertexai: true, project: PROJECT_ID, location: VERTEX_LOCATION });

            const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
            const prompt = `Perform complete, accurate Optical Character Recognition (OCR) on this scanned document.
Transcribe all text exactly as shown, preserving lines and paragraphs.
Do not add conversational comments, headers, or markdown formatting. Only output the transcribed text.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: [
                    { inlineData: { data: processedBuffer.toString('base64'), mimeType } },
                    { text: prompt },
                ],
            });

            const text = response?.text?.trim() ?? '';
            if (text) {
                fullText = text;
                usedEngine = 'Vertex AI Gemini';
                const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
                const stepY = height / Math.max(lines.length, 1);

                lineItems = lines.map((l, idx) => ({
                    text: l,
                    box: { minX: width * 0.05, maxX: width * 0.95, minY: idx * stepY, maxY: (idx + 1) * stepY },
                    confidence: 0.95,
                }));
            }
        } catch (geminiErr) {
            console.error('[ocrService] Vertex AI OCR fallback failed:', geminiErr?.message);
        }
    }

    const avgConf = lineItems.length > 0 ? totalConfidence / lineItems.length : 0.90;

    return {
        imageBuffer: processedBuffer,
        width,
        height,
        format,
        lines: lineItems,
        fullText,
        averageConfidence: Math.round(avgConf * 100) / 100,
        linesCount: lineItems.length,
        engine: usedEngine,
    };
};


// --- PDF GENERATION ---

/**
 * Creates an ISO A4 searchable PDF from an OCR result.
 * Embeds the scanned visual image with an invisible text layer mapped to bounding boxes.
 *
 * @param {Object} ocrResult - Result from processImageOcr.
 * @param {string} [title='Scanned Document'] - Document title for PDF metadata.
 * @returns {Promise<Buffer>} Searchable PDF buffer.
 */
const createSearchablePdf = async (ocrResult, title = 'Scanned Document') => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(title);
    pdfDoc.setProducer('Pamantasan Document Intelligence Cloud Engine');
    pdfDoc.setCreator('Pamantasan Records Management System');

    const { imageBuffer, width, height, format, lines } = ocrResult;

    const isLandscape = width > height;
    const pageWidth = isLandscape ? 841.89 : 595.28;
    const pageHeight = isLandscape ? 595.28 : 841.89;

    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    const margin = 18.0;
    const availWidth = pageWidth - margin * 2;
    const availHeight = pageHeight - margin * 2;
    const scale = Math.min(availWidth / width, availHeight / height);
    const targetWidth = width * scale;
    const targetHeight = height * scale;

    // Center the image on the A4 page
    const offsetX = margin + (availWidth - targetWidth) / 2;
    const offsetY = margin + (availHeight - targetHeight) / 2;

    const embeddedImage = format === 'png'
        ? await pdfDoc.embedPng(imageBuffer)
        : await pdfDoc.embedJpg(imageBuffer);

    page.drawImage(embeddedImage, { x: offsetX, y: offsetY, width: targetWidth, height: targetHeight });

    // Invisible text layer for searchability
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    for (const item of lines) {
        const text = (item.text || '').trim();
        if (!text) continue;

        const { minX = 0, minY = 0, maxY = height } = item.box || {};
        const boxHeight = (maxY - minY) * scale;
        const fontSize = Math.max(6, Math.min(24, Math.round(boxHeight * 0.75)));

        const cleanText = sanitizeWinAnsiText(text);
        if (!cleanText) continue;

        const pdfX = Math.max(margin, offsetX + minX * scale);
        const pdfY = Math.max(margin, pageHeight - (offsetY + maxY * scale));

        try {
            page.drawText(cleanText, { x: pdfX, y: pdfY, size: fontSize, font: helvetica, opacity: 0 });
        } catch {
            try {
                const asciiOnly = cleanText.replace(/[^\x20-\x7E]/g, ' ');
                page.drawText(asciiOnly, { x: pdfX, y: pdfY, size: fontSize, font: helvetica, opacity: 0 });
            } catch {
                // Ignore lines that cannot be rendered at all
            }
        }
    }

    return Buffer.from(await pdfDoc.save());
};


// --- PUBLIC API ---

/**
 * Converts an image into a searchable PDF with OCR metadata.
 *
 * @param {Object} params
 * @param {Buffer} params.imageBuffer - Raw image buffer.
 * @param {string} [params.fileName='document.jpg'] - Original file name.
 * @param {string|null} [params.customTitle=null] - Optional custom PDF title.
 * @param {boolean} [params.autoWhiten=true] - Apply whitening enhancement.
 * @returns {Promise<Object>} Result with pdfBase64, extractedText, engine metadata.
 */
const convertImageToSearchablePdf = async ({ imageBuffer, fileName = 'document.jpg', customTitle = null, autoWhiten = true }) => {
    console.log(`[ocrService] Processing "${fileName}" (${imageBuffer.length} bytes, autoWhiten=${autoWhiten})...`);

    const ocrResult = await processImageOcr(imageBuffer, autoWhiten);
    const title = customTitle ?? fileName.replace(/\.[^/.]+$/, '');
    const pdfBuffer = await createSearchablePdf(ocrResult, title);

    const baseName = fileName.replace(/\.[^/.]+$/, '') || 'document';
    const pdfFileName = `${baseName}.pdf`;

    console.log(`[ocrService] Generated "${pdfFileName}" (${pdfBuffer.length} bytes, ${ocrResult.linesCount} lines via ${ocrResult.engine})`);

    return {
        success: true,
        originalFileName: fileName,
        pdfFileName,
        pdfBase64: pdfBuffer.toString('base64'),
        sizeBytes: pdfBuffer.length,
        mimeType: 'application/pdf',
        extractedText: ocrResult.fullText,
        averageConfidence: ocrResult.averageConfidence,
        linesCount: ocrResult.linesCount,
        engine: ocrResult.engine,
    };
};

module.exports = {
    enhanceDocumentWhitening,
    processImageOcr,
    createSearchablePdf,
    convertImageToSearchablePdf,
};
