// --- IMPORTS ---
const { PDFDocument, StandardFonts } = require('pdf-lib');
const sharp = require('sharp');
let vision = null;
try {
    vision = require('@google-cloud/vision');
} catch (vErr) {
    console.warn('[CloudOCR] @google-cloud/vision module not loaded:', vErr?.message);
}
const { GoogleGenAI } = require('@google/genai');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'pamantasan-records-210fe';
const VERTEX_LOCATION = process.env.VERTEX_AI_LOCATION || 'asia-southeast1';

let visionClient = null;
function getVisionClient() {
    if (!visionClient && vision) {
        try {
            visionClient = new vision.ImageAnnotatorClient({
                projectId: PROJECT_ID,
            });
        } catch (err) {
            console.warn('[CloudOCR] Could not initialize ImageAnnotatorClient:', err?.message);
        }
    }
    return visionClient;
}

/**
 * Sanitizes Unicode strings to WinAnsi/ASCII printable range
 * to guarantee that PDF-lib Helvetica font never crashes with encoding errors.
 */
function sanitizeWinAnsiText(str) {
    if (!str) return '';
    return str
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/[\u2026]/g, '...')
        .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '-')
        .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')
        .trim();
}

/**
 * Enhances document illumination and paper background whitening:
 * Normalizes uneven lighting/shadows, stretches paper tone to crisp white, and deepens dark text.
 */
async function enhanceDocumentWhitening(imageBuffer) {
    try {
        // Step 1: Normalize contrast and level illumination
        const enhancedBuffer = await sharp(imageBuffer)
            .rotate() // Auto-orient based on EXIF
            .normalize() // Stretch luminance to full 0-255 range
            .gamma(1.1) // Slightly brighten mid-tones
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
        console.warn('[CloudOCR] Sharp image enhancement error, using raw image:', err?.message);
        try {
            const meta = await sharp(imageBuffer).metadata();
            return {
                buffer: imageBuffer,
                width: meta.width || 800,
                height: meta.height || 1100,
                format: meta.format || 'jpeg',
            };
        } catch {
            return {
                buffer: imageBuffer,
                width: 800,
                height: 1100,
                format: 'jpeg',
            };
        }
    }
}

/**
 * Runs OCR text recognition on an image buffer.
 * Primary: Google Cloud Vision API (documentTextDetection for exact bounding boxes).
 * Fallback: Vertex AI Gemini 2.0 Flash (multimodal OCR transcription).
 */
async function processImageOcr(imageBuffer, autoWhiten = true) {
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
            console.log(`[CloudOCR] Running Google Cloud Vision documentTextDetection...`);
            const [result] = await client.documentTextDetection({
                image: { content: processedBuffer },
            });

            const annotation = result?.fullTextAnnotation;
            if (annotation && annotation.text) {
                fullText = annotation.text.trim();

                // Extract lines with tight bounding boxes using detected line breaks
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

                    const xs = currentLineVertices.map(v => v.x || 0);
                    const ys = currentLineVertices.map(v => v.y || 0);
                    const minX = Math.min(...xs);
                    const maxX = Math.max(...xs);
                    const minY = Math.min(...ys);
                    const maxY = Math.max(...ys);

                    totalConfidence += confidence;
                    lineItems.push({
                        text: lineText,
                        box: { minX, minY, maxX, maxY },
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
                                const wordText = (word.symbols || []).map(s => s.text).join('');
                                if (wordText) {
                                    currentLineWords.push(wordText);
                                    const wordVerts = word.boundingBox?.vertices || [];
                                    currentLineVertices.push(...wordVerts);
                                }

                                const lastSymbol = (word.symbols || [])[(word.symbols || []).length - 1];
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
            console.warn('[CloudOCR] Cloud Vision API failed, falling back to Vertex AI Gemini:', visionErr?.message);
        }
    }

    // ATTEMPT 2: Vertex AI Gemini 2.0 Flash (Dual-engine fallback)
    if (lineItems.length === 0) {
        try {
            console.log(`[CloudOCR] Using Vertex AI Gemini 2.0 Flash for OCR extraction...`);
            const ai = new GoogleGenAI({
                vertexai: true,
                project: PROJECT_ID,
                location: VERTEX_LOCATION,
            });

            const prompt = `Perform complete, accurate Optical Character Recognition (OCR) on this scanned document.
Transcribe all text exactly as shown, preserving lines and paragraphs.
Do not add conversational comments, headers, or markdown formatting. Only output the transcribed text.`;

            const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: [
                    {
                        inlineData: {
                            data: processedBuffer.toString('base64'),
                            mimeType,
                        },
                    },
                    { text: prompt },
                ],
            });

            const text = response?.text ? response.text.trim() : '';
            if (text) {
                fullText = text;
                usedEngine = 'Vertex AI Gemini';
                const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                const stepY = height / Math.max(lines.length, 1);

                lines.forEach((l, idx) => {
                    lineItems.push({
                        text: l,
                        box: {
                            minX: width * 0.05,
                            maxX: width * 0.95,
                            minY: idx * stepY,
                            maxY: (idx + 1) * stepY,
                        },
                        confidence: 0.95,
                    });
                });
            }
        } catch (geminiErr) {
            console.error('[CloudOCR] Vertex AI OCR fallback failed:', geminiErr?.message);
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
}

/**
 * Creates an ISO A4 searchable PDF containing the scanned visual image
 * and an embedded invisible text layer mapped to recognized bounding boxes.
 */
async function createSearchablePdf(ocrResult, title = 'Scanned Document') {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(title);
    pdfDoc.setProducer('Pamantasan Document Intelligence Cloud Engine');
    pdfDoc.setCreator('Pamantasan Records Management System');

    const { imageBuffer, width, height, format, lines } = ocrResult;

    // ISO A4 canvas dimensions in points (72 points per inch)
    const isLandscape = width > height;
    const pageWidth = isLandscape ? 841.89 : 595.28;
    const pageHeight = isLandscape ? 595.28 : 841.89;

    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Proportional scaling to fit standard A4 canvas with consistent margin
    const margin = 18.0;
    const availWidth = pageWidth - (margin * 2.0);
    const availHeight = pageHeight - (margin * 2.0);

    const scale = Math.min(availWidth / width, availHeight / height);
    const targetWidth = width * scale;
    const targetHeight = height * scale;

    // Center image on A4 page
    const offsetX = margin + (availWidth - targetWidth) / 2.0;
    const offsetY = margin + (availHeight - targetHeight) / 2.0;

    // Embed the visual scanned image
    let embeddedImage;
    if (format === 'png') {
        embeddedImage = await pdfDoc.embedPng(imageBuffer);
    } else {
        embeddedImage = await pdfDoc.embedJpg(imageBuffer);
    }

    page.drawImage(embeddedImage, {
        x: offsetX,
        y: offsetY,
        width: targetWidth,
        height: targetHeight,
    });

    // Embed invisible selectable text layer on top of detected bounding boxes
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    for (const item of lines) {
        const text = (item.text || '').trim();
        if (!text) continue;

        const box = item.box || {};
        const minX = box.minX || 0;
        const minY = box.minY || 0;
        const maxY = box.maxY || height;

        const scaledMinX = offsetX + (minX * scale);
        const scaledMaxY = offsetY + (maxY * scale);
        const boxHeight = (maxY - minY) * scale;

        // PDF coordinate origin (0, 0) is at bottom-left corner
        const pdfX = Math.max(margin, scaledMinX);
        const pdfY = Math.max(margin, pageHeight - scaledMaxY);
        const fontSize = Math.max(6, Math.min(24, Math.round(boxHeight * 0.75)));

        const cleanText = sanitizeWinAnsiText(text);
        if (!cleanText) continue;

        try {
            // Invisible text layer: opacity 0 makes it invisible visually, but 100% searchable and copyable
            page.drawText(cleanText, {
                x: pdfX,
                y: pdfY,
                size: fontSize,
                font: helvetica,
                opacity: 0,
            });
        } catch {
            // Character drawing fallback with strict ASCII
            try {
                const asciiOnly = cleanText.replace(/[^\x20-\x7E]/g, ' ');
                page.drawText(asciiOnly, {
                    x: pdfX,
                    y: pdfY,
                    size: fontSize,
                    font: helvetica,
                    opacity: 0,
                });
            } catch {
                // Ignore if line cannot be rendered
            }
        }
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}

/**
 * Main service method: Converts an image into a searchable PDF with OCR metadata.
 */
async function convertImageToSearchablePdf({
    imageBuffer,
    fileName = 'document.jpg',
    customTitle = null,
    autoWhiten = true,
}) {
    console.log(`[CloudOCR] Processing image for "${fileName}" (${imageBuffer.length} bytes, autoWhiten=${autoWhiten})...`);

    const ocrResult = await processImageOcr(imageBuffer, autoWhiten);
    const title = customTitle || fileName.replace(/\.[^/.]+$/, '');
    const pdfBuffer = await createSearchablePdf(ocrResult, title);

    const baseName = fileName.replace(/\.[^/.]+$/, '') || 'document';
    const pdfFileName = `${baseName}.pdf`;

    console.log(`[CloudOCR] Successfully generated searchable PDF "${pdfFileName}" (${pdfBuffer.length} bytes, ${ocrResult.linesCount} lines recognized via ${ocrResult.engine})`);

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
}

module.exports = {
    enhanceDocumentWhitening,
    processImageOcr,
    createSearchablePdf,
    convertImageToSearchablePdf,
};
