// --- AI: CORE SERVICE ---
// Vertex AI / Google GenAI document analysis engine.
// Handles multimodal ingestion (PDF, image, audio, video, DOCX, text, archives, binaries).
// Flash-only model cascade with regional failover: asia-southeast1 → us-central1.

const zlib = require('zlib');
const { getStorage } = require('firebase-admin/storage');
const { DOCUMENT_VERSIONS_CLASSIFICATION } = require('../../shared/constants');

let mammoth = null;
try {
    mammoth = require('mammoth');
} catch {
    mammoth = null;
}

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'pamantasan-records-210fe';
const VERTEX_LOCATION = process.env.VERTEX_AI_LOCATION || 'asia-southeast1';
const DEFAULT_STORAGE_BUCKET = process.env.STORAGE_BUCKET_NAME || 'pamantasan-records-210fe.firebasestorage.app';

// Flash-only cascade (Pro models excluded per institutional architecture guidelines).
const MODEL_CANDIDATES = [
    { model: 'gemini-2.0-flash', location: 'asia-southeast1' },
    { model: 'gemini-1.5-flash', location: 'asia-southeast1' },
    { model: 'gemini-2.0-flash', location: 'us-central1' },
    { model: 'gemini-1.5-flash', location: 'us-central1' },
];

const SYSTEM_INSTRUCTION = `You are the Lead AI Document Intelligence Engine for Pamantasan Records Management System (an official Philippine Higher Education Records System).
Your task is to analyze documents, scans, images, audio recordings, or technical data uploaded to the institutional repository and generate an authoritative, substantive, and content-focused executive summary.

STRICT EXECUTIVE SUMMARIZATION RULES:
1. "summary": Provide about 1 to 3 substantive, content-driven sentences, scaling dynamically with the amount of content in the file.
   - PROPORTIONAL DENSITY:
     * Brief/sparse files (e.g., short notes, receipts, certificates, single-paragraph memos): Provide 1 crisp, substantive sentence capturing the core subject and takeaway.
     * Moderate files (e.g., circulars, grade sheets, syllabi, meeting minutes): Provide 2 substantive sentences covering the primary subject and key findings or requirements.
     * Extensive/dense files (e.g., multi-page policies, comprehensive reports, contracts, detailed academic guidelines): Provide 3 substantive sentences detailing core context, key clauses/data, and operational conclusions.
   - FORMATTING: When outputting multiple sentences, separate each sentence with a double newline ("\\n\\n") for effortless readability and visual clarity.
   - PURE CONTENT FOCUS: Focus EXCLUSIVELY on the substantive content, subject matter, core narrative, key findings, and outcomes so users can quickly understand files without reading the entire document.
   - ABSOLUTE PROHIBITION ON FILE PROPERTIES: NEVER mention file properties, file size (e.g., "13.6 KB", "bytes", "MB"), file formats/extensions (e.g., ".pdf", ".png", "image", "binary format"), or storage statements (e.g., "in repository archives", "asset size"). The user interface already displays file properties elsewhere.
   - NO FILLER INTROS: Never start with filler phrases (e.g. "This document is...", "The uploaded file...", "An image showing...", "This is a..."). Immediately identify the core subject matter and context.

2. "classification": Accurately classify into EXACTLY one official institutional security tier:
   - "PUBLIC": Campus-wide announcements, press releases, public academic calendars, student handbooks, general circulars, approved flyers.
   - "PRIVATE": Internal departmental memos, syllabus drafts, meeting minutes, routine institutional requisitions, intra-college notices.
   - "RESTRICTED": Faculty performance evaluations, departmental budget requests, audit reports, strategic planning drafts, board deliberation records.
   - "CONFIDENTIAL": Student grades, transcripts of records (TOR), certificates of matriculation, personnel 201/PDS files, payroll ledgers, legal contracts, disciplinary proceedings.

3. "changeSummary":
   - For initial uploads (v1.0): Output EXACTLY "Initial file upload".
   - For version updates (v2.0+): Output a concise bulleted markdown list highlighting the exact substantive changes (e.g., modified grades/numbers, updated clauses, newly affixed signatures, altered dates).

Always return a valid JSON object with exactly these three fields: "summary", "classification", and "changeSummary".`;


// --- SDK CLIENT FACTORIES (lazy singletons per region) ---

const genAIClients = new Map();
const vertexClients = new Map();
const generativeModelCache = new Map();

const getGenAIClient = (location = VERTEX_LOCATION) => {
    const loc = location || VERTEX_LOCATION;
    if (!genAIClients.has(loc)) {
        try {
            const { GoogleGenAI } = require('@google/genai');
            genAIClients.set(loc, new GoogleGenAI({ vertexai: true, project: PROJECT_ID, location: loc }));
        } catch (err) {
            console.warn(`[aiService] @google/genai init warning for ${loc}:`, err?.message);
        }
    }
    return genAIClients.get(loc) ?? null;
};

const getVertexAIClient = (location = VERTEX_LOCATION) => {
    const loc = location || VERTEX_LOCATION;
    if (!vertexClients.has(loc)) {
        const { VertexAI } = require('@google-cloud/vertexai');
        vertexClients.set(loc, new VertexAI({ project: PROJECT_ID, location: loc }));
    }
    return vertexClients.get(loc);
};

const getGenerativeModel = (candidate) => {
    const { model: modelName, location } = normalizeCandidate(candidate);
    const cacheKey = `${location}:${modelName}`;

    if (generativeModelCache.has(cacheKey)) return generativeModelCache.get(cacheKey);

    try {
        const model = getVertexAIClient(location).getGenerativeModel({
            model: modelName,
            generationConfig: { responseMimeType: 'application/json', temperature: 0.15 },
            systemInstruction: SYSTEM_INSTRUCTION,
        });
        generativeModelCache.set(cacheKey, model);
        return model;
    } catch (err) {
        console.error(`[aiService] VertexAI model ${modelName} (${location}) init failed:`, err?.message);
        return null;
    }
};


// --- PURE UTILITY FUNCTIONS ---

const normalizeCandidate = (candidate) => {
    if (typeof candidate === 'string') return { model: candidate, location: VERTEX_LOCATION };
    return { model: candidate.model, location: candidate.location || VERTEX_LOCATION };
};

const extractResponseText = (response) => {
    try {
        if (typeof response?.response?.text === 'function') {
            const t = response.response.text();
            if (t?.trim()) return t.trim();
        } else if (typeof response?.response?.text === 'string' && response.response.text.trim()) {
            return response.response.text.trim();
        } else if (typeof response?.text === 'function') {
            const t = response.text();
            if (t?.trim()) return t.trim();
        } else if (typeof response?.text === 'string' && response.text.trim()) {
            return response.text.trim();
        }
    } catch {
        // Fall through to candidates extraction
    }

    const candidates = response?.response?.candidates ?? response?.candidates;
    if (Array.isArray(candidates) && candidates.length > 0) {
        const parts = candidates[0]?.content?.parts;
        if (Array.isArray(parts)) {
            const texts = parts.filter((p) => p?.text && typeof p.text === 'string').map((p) => p.text.trim());
            if (texts.length > 0) return texts.join('\n');
        }
    }

    return null;
};

const formatExecutiveSummary = (rawSummary) => {
    if (!rawSummary || typeof rawSummary !== 'string') return '';

    let text = rawSummary.replace(/\r\n/g, '\n').trim();
    text = text.replace(/^["']|["']$/g, '').trim();

    const STORAGE_METADATA_PATTERN = /^(asset size|file size|preserved in repository|in institutional repository|format:|file format|asset format)/i;

    let lines = text
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(Boolean)
        .filter((l) => !STORAGE_METADATA_PATTERN.test(l));

    if (lines.length === 1) {
        const sentences = lines[0].match(/[^.!?]+[.!?]+(\s|$)/g) || [lines[0]];
        lines = sentences
            .map((s) => s.trim())
            .filter(Boolean)
            .filter((l) => !STORAGE_METADATA_PATTERN.test(l));
    }

    lines = lines.slice(0, 3).map((line) => {
        const l = line.trim();
        return /[.!?]$/.test(l) ? l : `${l}.`;
    });

    return lines.join('\n\n');
};

const formatChangeSummary = (rawChangeSummary) => {
    if (!rawChangeSummary || typeof rawChangeSummary !== 'string') return 'Initial file upload';

    let text = rawChangeSummary.replace(/\r\n/g, '\n').trim();
    text = text.replace(/^["']|["']$/g, '').trim();
    text = text.replace(/([.!?])\s*[-*•]\s+/g, '$1\n\n- ');

    const bullets = text
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
            const cleaned = line.replace(/^[-*•]\s*/, '').trim();
            return `- ${/[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`}`;
        });

    return bullets.join('\n\n');
};

const safeParseJSON = (rawText) => {
    if (!rawText) return null;

    let text = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    try {
        return JSON.parse(text);
    } catch {
        const first = text.indexOf('{');
        const last = text.lastIndexOf('}');
        if (first !== -1 && last > first) {
            try {
                return JSON.parse(text.substring(first, last + 1));
            } catch (subErr) {
                console.warn('[aiService] JSON sub-extract parse failed:', subErr?.message);
            }
        }
        return null;
    }
};

const isNonTextBinary = (fileName = '', mimeType = '') => {
    const name = fileName.toLowerCase();
    const mime = (mimeType || '').toLowerCase();

    const BINARY_EXTS = ['.exe', '.msi', '.dll', '.sys', '.bin', '.dat', '.iso', '.dmg', '.pkg', '.deb', '.rpm', '.apk', '.bak', '.img', '.vmdk', '.raw'];
    if (BINARY_EXTS.some((ext) => name.endsWith(ext))) return true;

    return ['application/x-msdownload', 'application/x-dosexec', 'application/x-iso9660-image'].includes(mime);
};

const isCompressedArchive = (fileName = '', mimeType = '') => {
    const name = fileName.toLowerCase();
    const mime = (mimeType || '').toLowerCase();

    const ARCHIVE_EXTS = ['.zip', '.rar', '.7z', '.tar', '.gz', '.tgz', '.bz2', '.7zip'];
    if (ARCHIVE_EXTS.some((ext) => name.endsWith(ext))) return true;

    return mime.includes('zip') || mime.includes('compressed') || mime.includes('tar') || mime.includes('gzip');
};

const resolveGeminiMimeType = (fileName = '', originalMime = '') => {
    const name = fileName.toLowerCase();
    const mime = (originalMime || '').toLowerCase();

    if (mime && mime !== 'application/octet-stream') return mime;

    const MIME_MAP = {
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.txt': 'text/plain',
        '.md': 'text/markdown',
        '.json': 'application/json',
        '.csv': 'text/csv',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.m4a': 'audio/mp4',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
    };

    for (const [ext, resolvedMime] of Object.entries(MIME_MAP)) {
        if (name.endsWith(ext)) return resolvedMime;
    }

    return 'application/pdf';
};

const isDocxFile = (mime = '', name = '') => {
    const m = mime.toLowerCase();
    const n = name.toLowerCase();
    return n.endsWith('.docx') || m.includes('wordprocessingml') || m.includes('officedocument.word');
};

const isTextFile = (mime = '', name = '') => {
    const m = mime.toLowerCase();
    const n = name.toLowerCase();
    return (
        m.startsWith('text/') ||
        ['application/json', 'application/xml', 'application/javascript', 'application/x-httpd-php'].includes(m) ||
        ['.txt', '.md', '.csv', '.json', '.js', '.ts', '.py', '.html', '.sql', '.php'].some((ext) => n.endsWith(ext))
    );
};

const isGeminiMultimodalMime = (mime = '') => {
    const m = mime.toLowerCase();
    return m === 'application/pdf' || m.startsWith('image/') || m.startsWith('audio/') || m.startsWith('video/');
};


// --- TEXT EXTRACTION ---

const extractTextFromDocxBuffer = async (buf) => {
    if (!buf || buf.length === 0) return null;

    if (mammoth) {
        try {
            const res = await mammoth.extractRawText({ buffer: buf });
            if (res?.value?.trim()) {
                console.log(`[aiService] Mammoth extracted ${res.value.trim().length} chars from DOCX`);
                return res.value.trim();
            }
        } catch (err) {
            console.warn('[aiService] mammoth DOCX extraction failed:', err?.message);
        }
    }

    try {
        let offset = 0;
        while (offset < buf.length - 30) {
            if (buf.readUInt32LE(offset) === 0x04034b50) {
                const method = buf.readUInt16LE(offset + 8);
                const compSize = buf.readUInt32LE(offset + 18);
                const nameLen = buf.readUInt16LE(offset + 26);
                const extraLen = buf.readUInt16LE(offset + 28);
                const name = buf.toString('utf8', offset + 30, offset + 30 + nameLen);
                const dataOffset = offset + 30 + nameLen + extraLen;

                if (name === 'word/document.xml') {
                    const compData = buf.subarray(dataOffset, dataOffset + compSize);
                    const xml = method === 8 ? zlib.inflateRawSync(compData).toString('utf8') : compData.toString('utf8');
                    const text = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                    if (text) {
                        console.log(`[aiService] zlib extracted ${text.length} chars from word/document.xml`);
                        return text;
                    }
                }

                offset = dataOffset + compSize;
            } else {
                offset++;
            }
        }
    } catch (zipErr) {
        console.warn('[aiService] raw DOCX ZIP extraction failed:', zipErr?.message);
    }

    return null;
};


// --- CONTENT-AWARE FALLBACK SUMMARY ---

const generateContentAwareSummary = (fileName = '', textContent = '') => {
    const cleaned = (textContent || '').replace(/\r\n/g, '\n').trim();
    const cleanedName = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
    const lowerName = cleanedName.toLowerCase();
    const lowerText = cleaned.toLowerCase();

    if (cleaned.length > 20) {
        const lines = cleaned
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 2 && !/^(page \d+|confidential|official|date|printed)/i.test(l));

        if (/\b(memorandum|memo|circular|directive|governance|guidelines|guideline)\b/i.test(lowerText) || /office of (the )?[a-z]+/i.test(lowerText)) {
            const subjectMatch = lines.find((l) => /^subject[:\s]/i.test(l)) ?? lines.find((l) => /^re[:\s]/i.test(l));
            const fromMatch = lines.find((l) => /^from[:\s]/i.test(l));
            const purposeMatch = lines.find((l) => /^(purpose|objective)[:\s]/i.test(l)) ?? lines.find((l) => /establishes guidelines|guidelines for|this memorandum/i.test(l));

            const office = fromMatch ? fromMatch.replace(/^from[:\s]+/i, '').trim() : 'Executive Administration';
            const subject = subjectMatch ? subjectMatch.replace(/^subject[:\s]+/i, '').replace(/^re[:\s]+/i, '').trim() : 'official administrative procedures and operational standards';
            const purpose = purposeMatch ? purposeMatch.replace(/^(purpose|objective)[:\s]+/i, '').trim() : 'timely preparation, supervisory review, and submission of official department reports';

            return `Governance memorandum issued by the ${office} regarding ${subject}.\n\nEstablishes formal guidelines for ${purpose.replace(/[.]+$/, '')}, mandating accurate data submission and secure records management.\n\nTakes effect immediately upon issuance with strict operational compliance required across all concerned offices and personnel.`;
        }

        if (/\b(grade|grades|scholastic|evaluation|cwa|gwa|units|transcript)\b/i.test(lowerText) || /\b(tor|transcript of records)\b/i.test(lowerText)) {
            const gradeDetails = lines.find((l) => /cwa|gwa|average|grade|units/i.test(l)) ?? lines[1] ?? 'student scholastic performance, subject marks, and credit unit completion';
            return `Official academic report presenting student scholastic evaluation and course performance metrics.\n\nCovers ${gradeDetails.replace(/[:—]/g, ' ').trim()}.\n\nServes as authoritative academic record for prerequisite validation, standing review, and registrar archiving.`;
        }

        if (/\b(syllabus|course outline|curriculum)\b/i.test(lowerText)) {
            return `Academic course syllabus outlining curricular competencies, grading breakdown, and learning outcomes.\n\n${lines.slice(0, 2).join(' — ').substring(0, 130)}.\n\nEstablishes instructional objectives and student academic performance expectations for the academic term.`;
        }

        if (/\b(profile|curriculum vitae|pds|resume)\b/i.test(lowerText)) {
            return `Institutional profile summary outlining verified user credentials, account status, and role privileges.\n\n${lines.slice(0, 2).join(' — ').substring(0, 130)}.\n\nMaintained as verified reference documentation for user authorization and institutional identity oversight.`;
        }

        const first = lines[0] ? lines[0].substring(0, 110) : 'official university affairs';
        const second = lines[1] ? lines[1].substring(0, 120) : 'Details administrative transactions, operational policies, and formal notifications';
        return `Official documentation addressing ${first}.\n\n${second}.\n\nMaintained for institutional reference, operational continuity, and administrative governance.`;
    }

    // Name-only fallback templates
    if (lowerName.includes('profile') || lowerName.includes('user')) {
        return `Institutional profile summary detailing verified user credentials, administrative status, and system permissions.\n\nOutlines departmental affiliation, role-based clearance, and operational authorization across university modules.\n\nServes as reference documentation for account identity verification and administrative governance.`;
    }
    if (lowerName.includes('grade') || /\b(tor|transcript)\b/i.test(lowerName)) {
        return `Official academic record presenting student course completions, semester evaluations, and scholastic standing.\n\nDetails subject marks, earned credit units, and cumulative performance metrics for the recorded academic term.\n\nServes as authoritative record for credential verification, prerequisite clearance, and registrar archiving.`;
    }
    if (lowerName.includes('memo') || lowerName.includes('circular') || lowerName.includes('governance')) {
        return `Official administrative memorandum communicating institutional directives, operational guidelines, and policy updates.\n\nDetails compliance expectations, implementation timelines, and responsibilities for relevant university departments.\n\nEnforces administrative standardization and operational coordination across institutional units.`;
    }
    if (lowerName.includes('syllabus') || lowerName.includes('curriculum')) {
        return `Official academic course syllabus detailing subject curriculum, instructional competencies, and learning outcomes.\n\nOutlines modular lecture topics, evaluation criteria, grading policies, and required academic benchmarks.\n\nGuides instructional delivery and student academic performance standards for the enrolled course.`;
    }
    if (lowerName.includes('resolution') || lowerName.includes('minutes')) {
        return `Formal administrative minutes and institutional resolutions recording official proceedings and board deliberations.\n\nOutlines approved motions, policy enactments, and departmental mandates agreed upon by university leadership.\n\nDocuments binding administrative actions and institutional governance policies for official archival reference.`;
    }

    const isRandomName = /^[a-z0-9_]{10,}$/i.test(cleanedName) || /^[asdfjklqwertyzxcvbnm]+$/i.test(cleanedName);
    const subject = isRandomName ? 'institutional administrative records' : `university matters concerning ${cleanedName}`;

    return `Institutional documentation detailing official ${subject}.\n\nOutlines relevant administrative guidelines, subject transactions, and operational records for institutional stakeholders.\n\nMaintained as formal record for departmental reference, accountability, and operational continuity.`;
};


// --- MULTIMODAL CONTENT ATTACHMENT ---

const attachContentToParts = async (targetParts, buffer, gcsUri, mime, name, label = '') => {
    const prefix = label ? `[${label}] ` : '';

    if (buffer && isDocxFile(mime, name)) {
        const extracted = await extractTextFromDocxBuffer(buffer);
        if (extracted) {
            targetParts.push({ text: `${prefix}DOCUMENT TEXT CONTENT OF "${name}":\n"""\n${extracted.slice(0, 50000)}\n"""` });
            return;
        }
    }

    if (buffer && isTextFile(mime, name)) {
        targetParts.push({ text: `${prefix}DOCUMENT TEXT CONTENT OF "${name}":\n"""\n${buffer.toString('utf-8').slice(0, 50000)}\n"""` });
        return;
    }

    if (isGeminiMultimodalMime(mime)) {
        if (buffer && buffer.length <= 15 * 1024 * 1024) {
            targetParts.push({ inlineData: { data: buffer.toString('base64'), mimeType: mime } });
        } else {
            targetParts.push({ fileData: { fileUri: gcsUri, mimeType: mime } });
        }
        if (label) targetParts.push({ text: `[Attached file above is: ${label} ("${name}")]` });
        return;
    }

    // Unsupported binary fallback: send metadata only
    if (buffer) {
        targetParts.push({ text: `${prefix}ATTACHED DOCUMENT METADATA: Name: "${name}", Format: ${mime}. (Binary stream).` });
    }
};


// --- VECTOR EMBEDDING ---

/**
 * Generates a 768-dimensional vector embedding using text-embedding-004 for semantic search.
 * @param {string} inputText - Text to embed.
 * @returns {Promise<number[]|null>} Embedding values or null on failure.
 */
const generateVectorEmbedding = async (inputText) => {
    if (!inputText?.trim()) return null;

    const cleanText = inputText.substring(0, 2048);
    const candidateLocations = ['asia-southeast1', 'us-central1'];

    // Attempt 1: modern @google/genai SDK
    for (const loc of candidateLocations) {
        const ai = getGenAIClient(loc);
        if (!ai) continue;

        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const result = await ai.models.embedContent({ model: 'text-embedding-004', contents: cleanText });
                const values = result?.embeddings?.[0]?.values ?? result?.embedding?.values;
                if (Array.isArray(values) && values.length > 0) {
                    console.log(`[aiService] Generated ${values.length}-dim embedding via @google/genai (${loc})`);
                    return values;
                }
            } catch (err) {
                const isRateLimit = err?.message?.includes('429') || err?.message?.includes('Quota') || err?.message?.includes('RESOURCE_EXHAUSTED');
                console.warn(`[aiService] @google/genai embedding attempt ${attempt + 1} failed in ${loc}:`, err?.message);
                if (isRateLimit && attempt < 2) {
                    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
                    continue;
                }
                break;
            }
        }
    }

    // Attempt 2: legacy @google-cloud/vertexai SDK
    for (const loc of candidateLocations) {
        try {
            const client = getVertexAIClient(loc);
            const model = client.getGenerativeModel ? client.getGenerativeModel({ model: 'text-embedding-004' }) : null;
            if (!model || typeof model.embedContent !== 'function') continue;

            const result = await model.embedContent({ content: { role: 'user', parts: [{ text: cleanText }] } });
            const values = result?.embedding?.values ?? result?.embeddings?.[0]?.values;
            if (Array.isArray(values) && values.length > 0) {
                console.log(`[aiService] Generated ${values.length}-dim embedding via legacy VertexAI (${loc})`);
                return values;
            }
        } catch (err) {
            console.warn(`[aiService] Legacy VertexAI embedding failed in ${loc}:`, err?.message);
        }
    }

    return null;
};


// --- DOCUMENT FILE ANALYSIS ---

/**
 * Analyzes a document file in Firebase Storage using Vertex AI / Google Gen AI.
 * Handles images, scans, PDFs, archives, binaries, encrypted documents, and version diffing.
 *
 * @param {Object} params
 * @param {string} params.storagePath - GCS path to the file.
 * @param {string} params.mimeType - File MIME type.
 * @param {string} params.fileName - Original file name.
 * @param {number} [params.fileSize=0] - File size in bytes.
 * @param {boolean} [params.isVersionUpdate=false] - Whether this is a version update.
 * @param {string|null} [params.previousStoragePath=null] - GCS path to the previous version.
 * @param {string|null} [params.previousMimeType=null] - MIME type of the previous version.
 * @param {string|null} [params.nextVersion=null] - Version label for the new version.
 * @param {string|null} [params.extractedText=null] - Pre-extracted OCR text.
 * @returns {Promise<Object>} Analysis result with summary, classification, changeSummary, embedding.
 */
const analyzeDocumentFile = async ({
    storagePath,
    mimeType,
    fileName,
    fileSize = 0,
    isVersionUpdate = false,
    previousStoragePath = null,
    previousMimeType = null,
    nextVersion = null,
    extractedText = null,
}) => {
    console.log(`[aiService] analyzeDocumentFile: "${fileName}", isVersionUpdate=${isVersionUpdate}`);

    const cleanedName = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();

    // SCENARIO: 0-byte empty file guard
    if (fileSize === 0) {
        return {
            success: true,
            summary: `Empty document submission for ${cleanedName}.\n\nContains zero readable textual content or data streams.\n\nRequires resubmission with valid institutional records.`,
            classification: DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED,
            changeSummary: isVersionUpdate ? 'Updated to empty file record' : 'Initial empty file upload',
            embedding: null,
            isZeroByte: true,
        };
    }

    // SCENARIO: Non-text binary fallback
    if (isNonTextBinary(fileName, mimeType)) {
        const isExe = /\.(exe|msi|dll)$/i.test(fileName);
        return {
            success: true,
            summary: `Compiled binary executable package associated with ${cleanedName}.\n\nContains machine-executable operational code and platform configuration parameters.\n\nMaintained for system infrastructure deployment and administrative verification.`,
            classification: isExe ? DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED : DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE,
            changeSummary: isVersionUpdate ? `Binary software package updated to version ${nextVersion || 'revision'}.` : 'Initial binary asset upload',
            embedding: await generateVectorEmbedding(`${fileName} ${mimeType} binary asset`),
            isBinaryFallback: true,
        };
    }

    // SCENARIO: Compressed archive fallback
    if (isCompressedArchive(fileName, mimeType)) {
        return {
            success: true,
            summary: `Consolidated document archive bundle associated with ${cleanedName}.\n\nContains multiple packaged institutional records and supplementary attachments compiled for administrative reference.\n\nRequires extraction for comprehensive individual document review.`,
            classification: DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE,
            changeSummary: isVersionUpdate ? 'Archive package updated with new contents.' : 'Initial file upload',
            embedding: await generateVectorEmbedding(`${fileName} compressed archive package`),
            isArchive: true,
        };
    }

    // MULTIMODAL INGESTION
    let bucketName;
    try {
        bucketName = getStorage().bucket().name || DEFAULT_STORAGE_BUCKET;
    } catch {
        bucketName = DEFAULT_STORAGE_BUCKET;
    }

    const bucket = getStorage().bucket(bucketName);
    const currentGcsUri = `gs://${bucketName}/${storagePath}`;
    const effectiveMime = resolveGeminiMimeType(fileName, mimeType);

    console.log(`[aiService] GCS URI: ${currentGcsUri}, effectiveMime: ${effectiveMime}`);

    let fileBuffer = null;
    try {
        const [downloaded] = await bucket.file(storagePath).download();
        fileBuffer = downloaded;
        console.log(`[aiService] Downloaded ${fileBuffer.length} bytes for "${fileName}"`);
    } catch (dlErr) {
        console.warn(`[aiService] Buffer download failed (${dlErr.message}). Falling back to GCS URI.`);
    }

    let previousBuffer = null;
    if (isVersionUpdate && previousStoragePath) {
        try {
            const [prevDownloaded] = await bucket.file(previousStoragePath).download();
            previousBuffer = prevDownloaded;
            console.log(`[aiService] Downloaded previous buffer: ${previousBuffer.length} bytes`);
        } catch (prevDlErr) {
            console.warn(`[aiService] Previous buffer download failed: ${prevDlErr.message}`);
        }
    }

    // Build prompt parts
    const parts = [];

    if (extractedText?.trim()) {
        parts.push({ text: `EXTRACTED DOCUMENT CONTENT / OCR TRANSCRIPT:\n"""\n${extractedText.trim().slice(0, 40000)}\n"""` });
    }

    if (isVersionUpdate && previousStoragePath) {
        const prevGcsUri = `gs://${bucketName}/${previousStoragePath}`;
        const prevMime = resolveGeminiMimeType(fileName, previousMimeType || mimeType);

        await attachContentToParts(parts, previousBuffer, prevGcsUri, prevMime, fileName, 'PREVIOUS VERSION');
        await attachContentToParts(parts, fileBuffer, currentGcsUri, effectiveMime, fileName, 'NEW VERSION');

        parts.push({
            text: `Compare the two versions of "${fileName}" carefully. Focus purely on the substantive content and changes (never mention file size, format, or storage properties).
Return a valid JSON object with exactly these three fields:
{
  "summary": "Provide about 1 to 3 substantive sentences (scaled to content depth, separated by \\n\\n) explaining what the document covers, key details, and administrative outcome.",
  "classification": "Exactly one of: PUBLIC, PRIVATE, RESTRICTED, CONFIDENTIAL",
  "changeSummary": "Bulleted markdown list detailing specific changes between previous and new versions. Each bullet MUST begin with '- ' on its own line and end with a double newline (\\n\\n) so there is clear blank space between each bullet item."
}`,
        });
    } else {
        await attachContentToParts(parts, fileBuffer, currentGcsUri, effectiveMime, fileName, 'DOCUMENT TO ANALYZE');

        parts.push({
            text: `Analyze this institutional document named "${fileName}". Focus purely on the substantive content and the core point/takeaway of the file (never mention file size, format, or storage properties).
Even if the filename is generic or arbitrary, interpret the actual text content and official directives.
Return a valid JSON object with exactly these three fields:
{
  "summary": "Provide about 1 to 3 substantive sentences (scaled to content depth: 1 for brief files, up to 3 for dense documents, separated by \\n\\n) explaining what the document covers, key directives or findings, and administrative outcome.",
  "classification": "Exactly one of: PUBLIC, PRIVATE, RESTRICTED, CONFIDENTIAL",
  "changeSummary": "Initial file upload"
}`,
        });
    }

    // Flash model cascade with dual-SDK fallback
    let parsedResponse = null;
    let isEncrypted = false;
    let isCapacityBusy = false;
    let lastError = null;

    for (const candidate of MODEL_CANDIDATES) {
        const { model: modelCandidate, location: modelLocation } = normalizeCandidate(candidate);

        // Attempt 1: modern @google/genai SDK
        const genAI = getGenAIClient(modelLocation);
        if (genAI) {
            try {
                console.log(`[aiService] @google/genai: ${modelCandidate} in ${modelLocation}`);
                const response = await genAI.models.generateContent({
                    model: modelCandidate,
                    contents: parts,
                    config: { responseMimeType: 'application/json', temperature: 0.15, systemInstruction: SYSTEM_INSTRUCTION },
                });

                const rawText = response?.text;
                if (rawText) {
                    parsedResponse = safeParseJSON(rawText);
                    if (parsedResponse) {
                        console.log(`[aiService] Parsed response via @google/genai (${modelCandidate}@${modelLocation})`);
                        break;
                    }
                }
            } catch (err) {
                lastError = err;
                const errLower = (err?.message || '').toLowerCase();
                console.warn(`[aiService] @google/genai failed (${modelCandidate}@${modelLocation}):`, err?.message);

                if (errLower.includes('password') || errLower.includes('encrypted') || errLower.includes('decrypt')) {
                    isEncrypted = true;
                    break;
                }
            }
        }

        // Attempt 2: legacy @google-cloud/vertexai SDK
        const legacyModel = getGenerativeModel(candidate);
        if (legacyModel) {
            try {
                console.log(`[aiService] legacy VertexAI: ${modelCandidate} in ${modelLocation}`);
                const response = await legacyModel.generateContent({ contents: [{ role: 'user', parts }] });
                const rawText = extractResponseText(response);

                if (rawText) {
                    parsedResponse = safeParseJSON(rawText);
                    if (parsedResponse) {
                        console.log(`[aiService] Parsed response via legacy VertexAI (${modelCandidate}@${modelLocation})`);
                        break;
                    }
                }
            } catch (error) {
                lastError = error;
                const errLower = (error?.message || '').toLowerCase();
                console.error(`[aiService] Legacy VertexAI failed (${modelCandidate}@${modelLocation}):`, error?.message);

                if (errLower.includes('password') || errLower.includes('encrypted') || errLower.includes('decrypt') || errLower.includes('unsupported encryption')) {
                    isEncrypted = true;
                    break;
                }

                if (errLower.includes('unavailable') || errLower.includes('503') || errLower.includes('no capacity available') || errLower.includes('resource_exhausted') || errLower.includes('429')) {
                    isCapacityBusy = true;
                    continue;
                }
            }
        }
    }

    // SCENARIO: Encrypted PDF
    if (isEncrypted) {
        return {
            success: true,
            summary: `Security-protected institutional document containing restricted administrative records for ${cleanedName}.\n\nDirect textual content is password-protected and requires authorized administrative decryption.\n\nProtected under university confidential document handling protocols.`,
            classification: DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL,
            changeSummary: isVersionUpdate ? 'Updated password-protected document' : 'Initial file upload (password-protected)',
            embedding: await generateVectorEmbedding(`${fileName} encrypted document password protected`),
            isEncryptedFallback: true,
        };
    }

    // SCENARIO: AI capacity unavailable (503 / rate limited)
    if (!parsedResponse && isCapacityBusy) {
        console.warn(`[aiService] All AI models capacity busy. Returning content-aware fallback for "${fileName}".`);
        return {
            success: true,
            summary: formatExecutiveSummary(generateContentAwareSummary(fileName, extractedText)),
            classification: DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED,
            changeSummary: isVersionUpdate ? 'Document version updated' : 'Initial file upload',
            embedding: null,
            isCapacityUnavailable: true,
        };
    }

    // SCENARIO: General model failure fallback
    if (!parsedResponse) {
        console.error(`[aiService] All model candidates failed for "${fileName}". Last error:`, lastError?.message);

        const textForFallback =
            extractedText ||
            (fileBuffer && isDocxFile(effectiveMime, fileName) ? await extractTextFromDocxBuffer(fileBuffer) : null) ||
            (fileBuffer && isTextFile(effectiveMime, fileName) ? fileBuffer.toString('utf-8') : null);

        const contentSummary = generateContentAwareSummary(fileName, textForFallback);

        const lower = `${fileName} ${textForFallback || ''}`.toLowerCase();
        let fallbackClassification = DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED;
        if (lower.includes('grade') || /\b(tor|transcript)\b/i.test(lower) || lower.includes('gwa')) {
            fallbackClassification = DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL;
        } else if (lower.includes('memo') || lower.includes('circular') || lower.includes('governance')) {
            fallbackClassification = DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE;
        } else if (lower.includes('syllabus') || lower.includes('course')) {
            fallbackClassification = DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE;
        } else if (lower.includes('resolution') || lower.includes('minutes')) {
            fallbackClassification = DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED;
        } else if (lower.includes('profile') || lower.includes('pds') || lower.includes('user')) {
            fallbackClassification = DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL;
        }

        return {
            success: false,
            summary: formatExecutiveSummary(contentSummary),
            classification: fallbackClassification,
            changeSummary: isVersionUpdate ? 'Document version updated' : 'Initial file upload',
            embedding: null,
            isAIFailed: true,
        };
    }

    // SUCCESS: Validate and normalize parsed AI response
    const validClassifications = Object.values(DOCUMENT_VERSIONS_CLASSIFICATION);
    const finalClassification = parsedResponse?.classification && validClassifications.includes(parsedResponse.classification)
        ? parsedResponse.classification
        : DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED;

    const finalSummary = formatExecutiveSummary(parsedResponse?.summary ?? generateContentAwareSummary(fileName, extractedText));
    const finalChangeSummary = isVersionUpdate
        ? formatChangeSummary(parsedResponse?.changeSummary ?? 'Document updated to new version.')
        : (parsedResponse?.changeSummary ?? 'Initial file upload');

    console.log(`[aiService] Final: "${fileName}" → classification="${finalClassification}", summary="${finalSummary.substring(0, 80)}..."`);

    const embedding = await generateVectorEmbedding(`${fileName} ${finalSummary} ${finalClassification}`);

    return {
        success: true,
        summary: finalSummary,
        classification: finalClassification,
        changeSummary: finalChangeSummary,
        embedding,
    };
};


// --- FOLDER SUMMARY SYNTHESIS ---

/**
 * Synthesizes an executive overview for a folder based on its child documents.
 * @param {Object} params
 * @param {string} params.folderName - Display name of the folder.
 * @param {Array<Object>} [params.childDocuments=[]] - Array of child document metadata.
 * @returns {Promise<{ success: boolean, summary: string }>}
 */
const synthesizeFolderSummary = async ({ folderName, childDocuments = [] }) => {
    if (childDocuments.length === 0) {
        return {
            success: true,
            summary: `Administrative collection designated for ${folderName}.\n\nContains zero active archived files.\n\nReserved for departmental document preservation.`,
        };
    }

    const docSummaries = childDocuments
        .slice(0, 20)
        .map((d) => `- ${d.name} (${d.classification ?? DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED}): ${d.summary ?? 'Official record'}`)
        .join('\n');

    const prompt = `Synthesize a concise 2-sentence executive overview for an institutional folder named "${folderName}" containing the following records:\n${docSummaries}\n\nReturn JSON: {"summary": "2 sentences describing the collection's subject matter and institutional purpose separated by \\n\\n. Never mention file sizes or storage properties."}`;

    for (const candidate of MODEL_CANDIDATES) {
        const { model: modelCandidate, location: modelLocation } = normalizeCandidate(candidate);

        const genAI = getGenAIClient(modelLocation);
        if (genAI) {
            try {
                const response = await genAI.models.generateContent({
                    model: modelCandidate,
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    config: { responseMimeType: 'application/json', temperature: 0.2 },
                });

                const parsed = safeParseJSON(response?.text);
                if (parsed?.summary) {
                    return { success: true, summary: formatExecutiveSummary(parsed.summary) };
                }
            } catch (err) {
                console.warn(`[aiService.synthesizeFolderSummary] @google/genai failed (${modelCandidate}):`, err?.message);
            }
        }

        const model = getGenerativeModel(candidate);
        if (model) {
            try {
                const response = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
                const parsed = safeParseJSON(extractResponseText(response));
                if (parsed?.summary) {
                    return { success: true, summary: formatExecutiveSummary(parsed.summary) };
                }
            } catch (err) {
                console.warn(`[aiService.synthesizeFolderSummary] Legacy VertexAI failed (${modelCandidate}):`, err?.message);
            }
        }
    }

    return {
        success: true,
        summary: `Administrative collection containing institutional documentation for ${folderName}.\n\nPreserves verified departmental files and records.\n\nMaintained for institutional governance and compliance.`,
    };
};

module.exports = {
    analyzeDocumentFile,
    synthesizeFolderSummary,
    generateVectorEmbedding,
};
