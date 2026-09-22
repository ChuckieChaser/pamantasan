// --- IMPORTS & CONFIGURATION ---
const { getStorage } = require('firebase-admin/storage');
const zlib = require('zlib');
let mammoth = null;
try {
    mammoth = require('mammoth');
} catch {
    mammoth = null;
}
const { DOCUMENT_VERSIONS_CLASSIFICATION } = require('../constants');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'pamantasan-records-210fe';
// Colocated with Firebase Storage bucket in ASIA-SOUTHEAST1 (Singapore)
const VERTEX_LOCATION = process.env.VERTEX_AI_LOCATION || 'asia-southeast1';
const DEFAULT_STORAGE_BUCKET = process.env.STORAGE_BUCKET_NAME || 'pamantasan-records-210fe.firebasestorage.app';

// Model cascade: strictly Flash models (Pro models excluded per institutional architecture guidelines).
// Primary location: asia-southeast1 (Singapore - colocated with Firebase Storage)
// Fallback location: us-central1 (for global deployment redundancy)
const MODEL_CANDIDATES = [
    { model: 'gemini-2.0-flash', location: 'us-central1' },
    { model: 'gemini-2.0-flash-001', location: 'us-central1' },
    { model: 'gemini-1.5-flash', location: 'us-central1' },
    { model: 'gemini-3.5-flash', location: 'asia-southeast1' },
    { model: 'gemini-2.0-flash', location: 'asia-southeast1' },
    { model: 'gemini-1.5-flash', location: 'asia-southeast1' },
];

const SYSTEM_INSTRUCTION = `You are the Lead AI Document Intelligence Engine for Pamantasan Records Management System (an official Philippine Higher Education Records System).
Your task is to analyze documents, scans, images, audio recordings, or technical data uploaded to the institutional repository and generate an authoritative, substantive, and content-focused executive summary.

STRICT EXECUTIVE SUMMARIZATION RULES:
1. "summary": Provide EXACTLY 2 to 3 substantive, content-driven sentences. Separate each sentence with a double newline ("\\n\\n") to make readability and visual clarity effortless.
   - PURE CONTENT FOCUS: Focus EXCLUSIVELY on the substantive content, subject matter, core narrative, key findings, and outcomes so users can quickly understand long complex files without reading the entire document.
   - ABSOLUTE PROHIBITION ON FILE PROPERTIES: NEVER mention file properties, file size (e.g., "13.6 KB", "bytes", "MB"), file formats/extensions (e.g., ".pdf", ".png", "image", "binary format"), or storage statements (e.g., "in repository archives", "asset size"). The user interface already displays file properties elsewhere.
   - NO FILLER INTROS: Never start with filler phrases (e.g. "This document is...", "The uploaded file...", "An image showing...", "This is a..."). Immediately identify the core subject matter and context.
   - STRUCTURE (3 distinct lines separated by "\\n\\n"):
     * Line 1 (Sentence 1 - Core Subject & Context): State the specific subject matter, the institutional context, and the primary objective of the document.
     * Line 2 (Sentence 2 - Substantive Findings & Key Data): Detail the key findings, specific entities, concrete numbers/grades/amounts, core clauses, or policy directives discussed in the content.
     * Line 3 (Sentence 3 - Conclusions & Outcomes): State the overarching takeaway, required action, compliance directive, or official conclusion established by the document.
   - CATEGORY-SPECIFIC GUIDELINES:
     * ACADEMIC RECORDS & GRADES:
       Line 1: Identify the official record type and issuing academic authority.
       Line 2: Detail student name, student number, degree program, academic term, and concrete scholastic performance (CWA/GWA, units, or remarks).
       Line 3: Note official processing date, signatory authority, or institutional endorsement.
     * MEMORANDA, CIRCULARS & POLICIES:
       Line 1: State the issuing executive office and official subject title/memo number.
       Line 2: Synthesize the specific policy requirements, administrative directives, or procedural changes.
       Line 3: State the effective timeline, affected departments, and mandatory compliance obligations.
     * COURSE SYLLABI & CURRICULUM:
       Line 1: State course code, descriptive title, and credit unit weight.
       Line 2: Outline key competencies, modular topics, and grading/evaluation breakdown.
       Line 3: State instructional objectives and academic department clearance.
     * MEETING MINUTES & RESOLUTIONS:
       Line 1: State governing body and session focus.
       Line 2: Detail specific approved resolutions, policy motions, and key deliberation outcomes.
       Line 3: State executive approval and implementation timeline.
     * PROFILES & PERSONNEL RECORDS:
       Line 1: State user identity, institutional role, and assigned college/department.
       Line 2: Summarize active system authorizations, access tiers, and verified credentials.
       Line 3: State administrative verification status and supervisory designation.

2. "classification": Accurately classify into EXACTLY one official institutional security tier:
   - "${DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC}": Campus-wide announcements, press releases, public academic calendars, student handbooks, general circulars, approved flyers.
   - "${DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE}": Internal departmental memos, syllabus drafts, meeting minutes, routine institutional requisitions, intra-college notices.
   - "${DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED}": Faculty performance evaluations, departmental budget requests, audit reports, strategic planning drafts, board deliberation records.
   - "${DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL}": Student grades, transcripts of records (TOR), certificates of matriculation, personnel 201/PDS files, payroll ledgers, legal contracts, disciplinary proceedings.

3. "changeSummary":
   - For initial uploads (v1.0): Output EXACTLY "Initial file upload".
   - For version updates (v2.0+): Output a concise bulleted markdown list highlighting the exact substantive changes (e.g., modified grades/numbers, updated clauses, newly affixed signatures, altered dates).

Always return a valid JSON object with exactly these three fields: "summary", "classification", and "changeSummary".`;

// Modern Google Gen AI Client (@google/genai) per region
const genAIClients = new Map();

function getGenAIClient(location = VERTEX_LOCATION) {
    const loc = location || VERTEX_LOCATION;
    if (!genAIClients.has(loc)) {
        try {
            const { GoogleGenAI } = require('@google/genai');
            const client = new GoogleGenAI({
                vertexai: true,
                project: PROJECT_ID,
                location: loc,
            });
            genAIClients.set(loc, client);
        } catch (err) {
            console.warn(`[aiService] @google/genai initialization warning for ${loc}:`, err?.message);
        }
    }
    return genAIClients.get(loc);
}

// Legacy Vertex AI client instances per location
const vertexClients = new Map();
const generativeModelCache = new Map();

/**
 * Gets the initialized VertexAI client for a specific GCP location (lazy singleton).
 */
function getVertexAIClient(location = VERTEX_LOCATION) {
    const loc = location || VERTEX_LOCATION;
    if (!vertexClients.has(loc)) {
        const { VertexAI } = require('@google-cloud/vertexai');
        vertexClients.set(loc, new VertexAI({
            project: PROJECT_ID,
            location: loc,
        }));
    }
    return vertexClients.get(loc);
}

/**
 * Normalizes a candidate entry (string or object) to { model, location }.
 */
function normalizeCandidate(candidate) {
    if (typeof candidate === 'string') {
        return { model: candidate, location: VERTEX_LOCATION };
    }
    return {
        model: candidate.model,
        location: candidate.location || VERTEX_LOCATION,
    };
}

/**
 * Extracts the text content from a Vertex AI GenerateContentResult.
 * Handles both the standard .text() helper and the raw parts array.
 */
function extractResponseText(response) {
    try {
        if (typeof response?.response?.text === 'function') {
            const text = response.response.text();
            if (text && typeof text === 'string' && text.trim()) return text.trim();
        } else if (typeof response?.response?.text === 'string' && response.response.text.trim()) {
            return response.response.text.trim();
        } else if (typeof response?.text === 'function') {
            const text = response.text();
            if (text && typeof text === 'string' && text.trim()) return text.trim();
        } else if (typeof response?.text === 'string' && response.text.trim()) {
            return response.text.trim();
        }
    } catch {
        // Continue to manual extraction
    }

    const candidates = response?.response?.candidates || response?.candidates;
    if (Array.isArray(candidates) && candidates.length > 0) {
        const parts = candidates[0]?.content?.parts;
        if (Array.isArray(parts)) {
            const textParts = parts.filter(p => p?.text && typeof p.text === 'string').map(p => p.text.trim());
            if (textParts.length > 0) {
                return textParts.join('\n');
            }
        }
    }

    return null;
}

/**
 * Normalizes and formats executive summaries to guarantee 2 to 3 concise sentences separated by \n\n.
 * Automatically cleanses any residual file properties, sizes, or repository storage mentions.
 */
function formatExecutiveSummary(rawSummary) {
    if (!rawSummary || typeof rawSummary !== 'string') return '';

    let text = rawSummary.replace(/\r\n/g, '\n').trim();
    text = text.replace(/^["']|["']$/g, '').trim();

    // Strip any accidental property lines (sizes, formats, repository storage metadata)
    let lines = text.split(/\n+/)
        .map(l => l.trim())
        .filter(Boolean)
        .filter(l => !/^(asset size|file size|preserved in repository|in institutional repository|format:|file format|asset format)/i.test(l));

    if (lines.length === 1) {
        const sentences = lines[0].match(/[^.!?]+[.!?]+(\s|$)/g) || [lines[0]];
        lines = sentences
            .map(s => s.trim())
            .filter(Boolean)
            .filter(l => !/^(asset size|file size|preserved in repository|in institutional repository)/i.test(l));
    }

    if (lines.length > 3) {
        lines = lines.slice(0, 3);
    }

    lines = lines.map(line => {
        let l = line.trim();
        if (!/[.!?]$/.test(l)) {
            l += '.';
        }
        return l;
    });

    return lines.join('\n\n');
}

/**
 * Normalizes and formats change summaries for document version diffs.
 * Guarantees every bullet starts with "- " and each item is separated by a double newline ("\n\n").
 */
function formatChangeSummary(rawChangeSummary) {
    if (!rawChangeSummary || typeof rawChangeSummary !== 'string') return 'Initial file upload';

    let text = rawChangeSummary.replace(/\r\n/g, '\n').trim();
    text = text.replace(/^["']|["']$/g, '').trim();

    // If bullets are strung together inline (e.g. "...story. - Removed all..."), separate with double newlines
    text = text.replace(/([.!?])\s*[-*•]\s+/g, '$1\n\n- ');

    const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
    const bullets = lines.map(line => {
        let cleaned = line.replace(/^[-*•]\s*/, '').trim();
        if (!/[.!?]$/.test(cleaned)) cleaned += '.';
        return `- ${cleaned}`;
    });

    return bullets.join('\n\n');
}

/**
 * Safely parses a JSON string that may have markdown code fences (```json ... ```) or conversational commentary.
 */
function safeParseJSON(rawText) {
    if (!rawText) return null;

    let text = rawText.trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    try {
        return JSON.parse(text);
    } catch {
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            try {
                const subJson = text.substring(firstBrace, lastBrace + 1);
                return JSON.parse(subJson);
            } catch (subErr) {
                console.warn('[aiService] JSON extract parse failed:', subErr?.message);
            }
        }
        return null;
    }
}

/**
 * Extracts plain text from a Word DOCX file buffer.
 * Primary method: mammoth.
 * Fallback: built-in zlib uncompressed word/document.xml extraction.
 */
async function extractTextFromDocxBuffer(buf) {
    if (!buf || buf.length === 0) return null;

    if (mammoth) {
        try {
            const res = await mammoth.extractRawText({ buffer: buf });
            if (res?.value && res.value.trim()) {
                console.log(`[aiService] Mammoth extracted ${res.value.trim().length} characters from DOCX`);
                return res.value.trim();
            }
        } catch (mErr) {
            console.warn('[aiService] mammoth docx extraction failed:', mErr?.message);
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
                        console.log(`[aiService] zlib extracted ${text.length} characters from word/document.xml`);
                        return text;
                    }
                }
                offset = dataOffset + compSize;
            } else {
                offset++;
            }
        }
    } catch (zipErr) {
        console.warn('[aiService] raw docx zip extraction failed:', zipErr?.message);
    }

    return null;
}

/**
 * Generates an intelligent, content-focused executive summary without any file properties or storage metadata.
 * Interprets the actual subject matter and narrative of long or complex documents.
 */
function generateContentAwareSummary(fileName = '', textContent = '') {
    const cleaned = (textContent || '').replace(/\r\n/g, '\n').trim();
    const cleanedName = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
    const lowerName = cleanedName.toLowerCase();
    const lowerText = cleaned.toLowerCase();

    // When extracted text / OCR transcript is available, synthesize the substantive narrative
    if (cleaned.length > 20) {
        const lines = cleaned.split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 2 && !/^(page \d+|confidential|official|date|printed)/i.test(l));

        // 1. Memoranda, Directives, Circulars, Governance Guidelines
        if (
            /\b(memorandum|memo|circular|directive|governance|guidelines|guideline)\b/i.test(lowerText) ||
            /office of (the )?[a-z]+/i.test(lowerText)
        ) {
            const subjectMatch = lines.find(l => /^subject[:\s]/i.test(l)) || lines.find(l => /^re[:\s]/i.test(l));
            const fromMatch = lines.find(l => /^from[:\s]/i.test(l));
            const purposeMatch = lines.find(l => /^(purpose|objective)[:\s]/i.test(l)) ||
                lines.find(l => /establishes guidelines|guidelines for|this memorandum/i.test(l));

            const issuingOffice = fromMatch
                ? fromMatch.replace(/^from[:\s]+/i, '').trim()
                : 'Executive Administration';
            const subject = subjectMatch
                ? subjectMatch.replace(/^subject[:\s]+/i, '').replace(/^re[:\s]+/i, '').trim()
                : 'official administrative procedures and operational standards';
            const purpose = purposeMatch
                ? purposeMatch.replace(/^(purpose|objective)[:\s]+/i, '').trim()
                : 'timely preparation, supervisory review, and submission of official department reports';

            const line1 = `Governance memorandum issued by the ${issuingOffice} regarding ${subject}.`;
            const line2 = `Establishes formal guidelines for ${purpose.replace(/[.]+$/, '')}, mandating accurate data submission and secure records management.`;
            const line3 = `Takes effect immediately upon issuance with strict operational compliance required across all concerned offices and personnel.`;

            return `${line1}\n\n${line2}\n\n${line3}`;
        }

        // 2. Academic Records, Grades, and Transcripts
        if (
            /\b(grade|grades|scholastic|evaluation|cwa|gwa|units|transcript)\b/i.test(lowerText) ||
            /\b(tor|transcript of records)\b/i.test(lowerText)
        ) {
            const subjectLine = `Official academic report presenting student scholastic evaluation and course performance metrics.`;
            const gradeDetails = lines.find(l => /cwa|gwa|average|grade|units/i.test(l)) || lines[1] || 'Details student scholastic performance, subject marks, and credit unit completion';
            const detailsLine = `Covers ${gradeDetails.replace(/[:—]/g, ' ').trim()}.`;
            const conclusionLine = `Serves as authoritative academic record for prerequisite validation, standing review, and registrar archiving.`;
            return `${subjectLine}\n\n${detailsLine}\n\n${conclusionLine}`;
        }

        // 3. Course Syllabi & Curriculum
        if (/\b(syllabus|course outline|curriculum)\b/i.test(lowerText)) {
            const subjectLine = `Academic course syllabus outlining curricular competencies, grading breakdown, and learning outcomes.`;
            const detailsLine = lines.slice(0, 2).join(' — ').substring(0, 130) + '.';
            const conclusionLine = `Establishes instructional objectives and student academic performance expectations for the academic term.`;
            return `${subjectLine}\n\n${detailsLine}\n\n${conclusionLine}`;
        }

        // 4. Institutional Profiles & Personnel Records
        if (/\b(profile|curriculum vitae|pds|resume)\b/i.test(lowerText)) {
            const subjectLine = `Institutional profile summary outlining verified user credentials, account status, and role privileges.`;
            const detailsLine = lines.slice(0, 2).join(' — ').substring(0, 130) + '.';
            const conclusionLine = `Maintained as verified reference documentation for user authorization and institutional identity oversight.`;
            return `${subjectLine}\n\n${detailsLine}\n\n${conclusionLine}`;
        }

        // 5. General Document with Content
        const firstSentence = lines[0] ? lines[0].substring(0, 110) : 'official university affairs';
        const secondSentence = lines[1] ? lines[1].substring(0, 120) : 'Details administrative transactions, operational policies, and formal notifications';
        return `Official documentation addressing ${firstSentence}.\n\n${secondSentence}.\n\nMaintained for institutional reference, operational continuity, and administrative governance.`;
    }

    // When only title / file label is available, infer topic (never repeat random scrambled letters)
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

    // If the filename appears to be random/placeholder characters (like asdasdasdkmwo), do not parrot it
    const isRandomName = /^[a-z0-9_]{10,}$/i.test(cleanedName) || /^[asdfjklqwertyzxcvbnm]+$/i.test(cleanedName);
    const subjectLabel = isRandomName ? 'institutional administrative records' : `university matters concerning ${cleanedName}`;

    return `Institutional documentation detailing official ${subjectLabel}.\n\nOutlines relevant administrative guidelines, subject transactions, and operational records for institutional stakeholders.\n\nMaintained as formal record for departmental reference, accountability, and operational continuity.`;
}

/**
 * Initializes and returns a Vertex AI generative model instance for a specified model candidate.
 */
function getGenerativeModel(candidate = 'gemini-2.0-flash-001') {
    const { model: modelName, location } = normalizeCandidate(candidate);
    const cacheKey = `${location}:${modelName}`;

    if (generativeModelCache.has(cacheKey)) {
        return generativeModelCache.get(cacheKey);
    }

    try {
        const client = getVertexAIClient(location);

        const model = client.getGenerativeModel({
            model: modelName,
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.15,
            },
            systemInstruction: SYSTEM_INSTRUCTION,
        });

        generativeModelCache.set(cacheKey, model);
        return model;
    } catch (err) {
        console.error(`[aiService] Vertex AI model ${modelName} (${location}) could not be initialized:`, err?.message);
        return null;
    }
}

/**
 * Checks if a file is a non-text machine binary.
 */
function isNonTextBinary(fileName = '', mimeType = '') {
    const lowerName = fileName.toLowerCase();
    const lowerMime = (mimeType || '').toLowerCase();

    const binaryExtensions = [
        '.exe', '.msi', '.dll', '.sys', '.bin', '.dat', '.iso', '.dmg',
        '.pkg', '.deb', '.rpm', '.apk', '.bak', '.img', '.vmdk', '.raw'
    ];

    if (binaryExtensions.some(ext => lowerName.endsWith(ext))) {
        return true;
    }

    if (
        lowerMime === 'application/x-msdownload' ||
        lowerMime === 'application/x-dosexec' ||
        lowerMime === 'application/x-iso9660-image'
    ) {
        return true;
    }

    return false;
}

/**
 * Checks if a file is a compressed archive.
 */
function isCompressedArchive(fileName = '', mimeType = '') {
    const lowerName = fileName.toLowerCase();
    const lowerMime = (mimeType || '').toLowerCase();

    const archiveExtensions = ['.zip', '.rar', '.7z', '.tar', '.gz', '.tgz', '.bz2', '.7zip'];
    if (archiveExtensions.some(ext => lowerName.endsWith(ext))) {
        return true;
    }

    if (
        lowerMime.includes('zip') ||
        lowerMime.includes('compressed') ||
        lowerMime.includes('tar') ||
        lowerMime.includes('gzip')
    ) {
        return true;
    }

    return false;
}

/**
 * Resolves standard MIME type for Gemini ingestion.
 */
function resolveGeminiMimeType(fileName = '', originalMime = '') {
    const lowerName = fileName.toLowerCase();
    const lowerMime = (originalMime || '').toLowerCase();

    if (lowerMime && lowerMime !== 'application/octet-stream') {
        return lowerMime;
    }

    if (lowerName.endsWith('.pdf')) return 'application/pdf';
    if (lowerName.endsWith('.png')) return 'image/png';
    if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
    if (lowerName.endsWith('.webp')) return 'image/webp';
    if (lowerName.endsWith('.svg')) return 'image/svg+xml';
    if (lowerName.endsWith('.txt')) return 'text/plain';
    if (lowerName.endsWith('.md')) return 'text/markdown';
    if (lowerName.endsWith('.json')) return 'application/json';
    if (lowerName.endsWith('.csv')) return 'text/csv';
    if (lowerName.endsWith('.mp3')) return 'audio/mpeg';
    if (lowerName.endsWith('.wav')) return 'audio/wav';
    if (lowerName.endsWith('.m4a')) return 'audio/mp4';
    if (lowerName.endsWith('.mp4')) return 'video/mp4';
    if (lowerName.endsWith('.webm')) return 'video/webm';

    return 'application/pdf'; // Default fallback
}

/**
 * Generates a 768-dimensional vector embedding for semantic search using text-embedding-004.
 */
async function generateVectorEmbedding(inputText) {
    if (!inputText || !inputText.trim()) {
        return null;
    }

    const cleanText = inputText.substring(0, 2048);

    // text-embedding-004 is deployed on Vertex AI in us-central1 (primary) and asia-southeast1
    const candidateLocations = ['us-central1', 'asia-southeast1'];

    // 1. Try modern @google/genai SDK with retry backoff for rate limits
    for (const loc of candidateLocations) {
        const ai = getGenAIClient(loc);
        if (ai) {
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    const result = await ai.models.embedContent({
                        model: 'text-embedding-004',
                        contents: cleanText,
                    });
                    const embeddingValues = result?.embeddings?.[0]?.values || result?.embedding?.values;
                    if (Array.isArray(embeddingValues) && embeddingValues.length > 0) {
                        console.log(`[aiService] Successfully generated ${embeddingValues.length}-dim vector embedding via @google/genai (${loc})`);
                        return embeddingValues;
                    }
                } catch (err) {
                    const isRateLimit = err?.message?.includes('429') || err?.message?.includes('Quota') || err?.message?.includes('RESOURCE_EXHAUSTED');
                    console.warn(`[aiService] @google/genai embedContent attempt ${attempt + 1} failed in ${loc}:`, err?.message);
                    if (isRateLimit && attempt < 2) {
                        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
                        continue;
                    }
                    break;
                }
            }
        }
    }

    // 2. Fallback: legacy Vertex AI SDK
    for (const loc of candidateLocations) {
        try {
            const client = getVertexAIClient(loc);
            const model = client.getGenerativeModel
                ? client.getGenerativeModel({ model: 'text-embedding-004' })
                : null;
            if (model && typeof model.embedContent === 'function') {
                const result = await model.embedContent({
                    content: {
                        role: 'user',
                        parts: [{ text: cleanText }],
                    },
                });
                const embeddingValues = result?.embedding?.values || result?.embeddings?.[0]?.values;
                if (Array.isArray(embeddingValues) && embeddingValues.length > 0) {
                    console.log(`[aiService] Successfully generated ${embeddingValues.length}-dim vector embedding via legacy VertexAI (${loc})`);
                    return embeddingValues;
                }
            }
        } catch (err) {
            console.warn(`[aiService] legacy VertexAI embedding failed in ${loc}:`, err?.message);
        }
    }

    return null;
}

/**
 * Analyzes a document file in Firebase Storage using Vertex AI / Google Gen AI.
 * Handles images, scans, PDFs, archives, binaries, encrypted documents, and version diffing.
 * Strictly uses Flash models with regional cascade (asia-southeast1 -> us-central1).
 */
async function analyzeDocumentFile({
    storagePath,
    mimeType,
    fileName,
    fileSize = 0,
    isVersionUpdate = false,
    previousStoragePath = null,
    previousMimeType = null,
    nextVersion = null,
    extractedText = null,
}) {
    console.log(`[aiService] analyzeDocumentFile called: fileName="${fileName}", mimeType="${mimeType}", storagePath="${storagePath}", isVersionUpdate=${isVersionUpdate}`);

    const cleanedName = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();

    // SCENARIO 6: 0-Byte Empty File Guard (Preflight check)
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

    // SCENARIO 2: Non-Text Binary File Fallback (.exe, .bin, .iso, etc.)
    if (isNonTextBinary(fileName, mimeType)) {
        const safeSummary = `Compiled binary executable package associated with ${cleanedName}.\n\nContains machine-executable operational code and platform configuration parameters.\n\nMaintained for system infrastructure deployment and administrative verification.`;
        const safeClassification = (fileName.toLowerCase().endsWith('.exe') || fileName.toLowerCase().endsWith('.msi') || fileName.toLowerCase().endsWith('.dll'))
            ? DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED
            : DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE;
        const safeChangeSummary = isVersionUpdate
            ? `Binary software package updated to version ${nextVersion || 'revision'}.`
            : 'Initial binary asset upload';

        const embedding = await generateVectorEmbedding(`${fileName} ${mimeType} binary asset`);

        return {
            success: true,
            summary: safeSummary,
            classification: safeClassification,
            changeSummary: safeChangeSummary,
            embedding,
            isBinaryFallback: true,
        };
    }

    // SCENARIO 3: Compressed Archive Fallback (.zip, .rar, .7z, etc.)
    if (isCompressedArchive(fileName, mimeType)) {
        const safeSummary = `Consolidated document archive bundle associated with ${cleanedName}.\n\nContains multiple packaged institutional records and supplementary attachments compiled for administrative reference.\n\nRequires extraction for comprehensive individual document review.`;
        const safeClassification = DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE;
        const safeChangeSummary = isVersionUpdate
            ? 'Archive package updated with new contents.'
            : 'Initial file upload';

        const embedding = await generateVectorEmbedding(`${fileName} compressed archive package`);

        return {
            success: true,
            summary: safeSummary,
            classification: safeClassification,
            changeSummary: safeChangeSummary,
            embedding,
            isArchive: true,
        };
    }

    // MULTIMODAL INGESTION (PDFs, Images, Visual Scans, Audio, Text)
    let bucketName;
    try {
        bucketName = getStorage().bucket().name || DEFAULT_STORAGE_BUCKET;
    } catch {
        bucketName = DEFAULT_STORAGE_BUCKET;
    }

    const currentGcsUri = `gs://${bucketName}/${storagePath}`;
    const effectiveMime = resolveGeminiMimeType(fileName, mimeType);

    console.log(`[aiService] GCS URI: ${currentGcsUri}, effectiveMime: ${effectiveMime}`);

    // Download file buffer for direct inline data inspection (bypasses GCS bucket IAM constraints)
    let fileBuffer = null;
    try {
        const bucket = getStorage().bucket(bucketName);
        const [downloaded] = await bucket.file(storagePath).download();
        fileBuffer = downloaded;
        console.log(`[aiService] Successfully downloaded buffer: ${fileBuffer.length} bytes for "${fileName}"`);
    } catch (dlErr) {
        console.warn(`[aiService] Could not download file buffer from GCS (${dlErr.message}). Falling back to GCS URI.`);
    }

    let previousBuffer = null;
    if (isVersionUpdate && previousStoragePath) {
        try {
            const bucket = getStorage().bucket(bucketName);
            const [prevDownloaded] = await bucket.file(previousStoragePath).download();
            previousBuffer = prevDownloaded;
            console.log(`[aiService] Successfully downloaded previous buffer: ${previousBuffer.length} bytes`);
        } catch (prevDlErr) {
            console.warn(`[aiService] Could not download previous buffer (${prevDlErr.message})`);
        }
    }

    const isDocxFile = (mime = '', name = '') => {
        const m = (mime || '').toLowerCase();
        const n = (name || '').toLowerCase();
        return n.endsWith('.docx') ||
            m.includes('wordprocessingml') ||
            m.includes('officedocument.word');
    };

    const isTextFile = (mime = '', name = '') => {
        const m = (mime || '').toLowerCase();
        const n = (name || '').toLowerCase();
        return m.startsWith('text/') ||
            m === 'application/json' ||
            m === 'application/xml' ||
            m === 'application/javascript' ||
            m === 'application/x-httpd-php' ||
            n.endsWith('.txt') || n.endsWith('.md') || n.endsWith('.csv') ||
            n.endsWith('.json') || n.endsWith('.js') || n.endsWith('.ts') ||
            n.endsWith('.py') || n.endsWith('.html') || n.endsWith('.sql') ||
            n.endsWith('.php');
    };

    const isGeminiSupportedMultimodalMime = (mime = '') => {
        const m = (mime || '').toLowerCase();
        return m === 'application/pdf' ||
            m.startsWith('image/') ||
            m.startsWith('audio/') ||
            m.startsWith('video/');
    };

    const attachContentToParts = async (targetParts, buffer, gcsUri, mime, name, label = '') => {
        // 1. DOCX files: Extract raw text directly so Gemini can read the entire text cleanly
        if (buffer && isDocxFile(mime, name)) {
            const extracted = await extractTextFromDocxBuffer(buffer);
            if (extracted) {
                targetParts.push({
                    text: `${label ? `[${label}] ` : ''}DOCUMENT TEXT CONTENT OF "${name}":\n"""\n${extracted.slice(0, 50000)}\n"""`,
                });
                return;
            }
        }

        // 2. Plain Text / Code / Script files
        const isText = isTextFile(mime, name);
        if (buffer && isText) {
            targetParts.push({
                text: `${label ? `[${label}] ` : ''}DOCUMENT TEXT CONTENT OF "${name}":\n"""\n${buffer.toString('utf-8').slice(0, 50000)}\n"""`,
            });
            return;
        }

        // 3. Supported Multimodal Formats (PDF, Image, Audio, Video)
        if (isGeminiSupportedMultimodalMime(mime)) {
            if (buffer && buffer.length <= 15 * 1024 * 1024) {
                targetParts.push({
                    inlineData: {
                        data: buffer.toString('base64'),
                        mimeType: mime,
                    },
                });
                if (label) {
                    targetParts.push({ text: `[Attached file above is: ${label} ("${name}")]` });
                }
            } else {
                targetParts.push({
                    fileData: {
                        fileUri: gcsUri,
                        mimeType: mime,
                    },
                });
                if (label) {
                    targetParts.push({ text: `[Attached file above is: ${label} ("${name}")]` });
                }
            }
            return;
        }

        // 4. Fallback for binary formats: Never send unsupported MIME type as inlineData
        if (buffer) {
            targetParts.push({
                text: `${label ? `[${label}] ` : ''}ATTACHED DOCUMENT METADATA: Name: "${name}", Format: ${mime}. (Binary stream).`,
            });
        }
    };

    // Build prompt parts
    const parts = [];

    // Attach extracted OCR or pre-parsed text transcript if provided
    if (extractedText && typeof extractedText === 'string' && extractedText.trim()) {
        parts.push({
            text: `EXTRACTED DOCUMENT CONTENT / OCR TRANSCRIPT:\n"""\n${extractedText.trim().slice(0, 40000)}\n"""`,
        });
    }

    if (isVersionUpdate && previousStoragePath) {
        // SCENARIO 10: Version Diffing (v2.0+)
        const previousGcsUri = `gs://${bucketName}/${previousStoragePath}`;
        const previousEffectiveMime = resolveGeminiMimeType(fileName, previousMimeType || mimeType);

        await attachContentToParts(parts, previousBuffer, previousGcsUri, previousEffectiveMime, fileName, 'PREVIOUS VERSION');
        await attachContentToParts(parts, fileBuffer, currentGcsUri, effectiveMime, fileName, 'NEW VERSION');

        parts.push({
            text: `Compare the two versions of "${fileName}" carefully. Focus purely on the substantive content and changes (never mention file size, format, or storage properties).
Return a valid JSON object with exactly these three fields:
{
  "summary": "Provide exactly 2 to 3 substantive, content-driven sentences separated by newlines (\\n\\n) explaining what the document covers, key details, and administrative outcome.",
  "classification": "Exactly one of: ${DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC}, ${DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE}, ${DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED}, ${DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL}",
  "changeSummary": "Bulleted markdown list detailing specific changes between previous and new versions. Each bullet MUST begin with '- ' on its own line and end with a double newline (\\n\\n) so there is clear blank space between each bullet item."
}`,
        });
    } else {
        // Initial Version (v1.0)
        await attachContentToParts(parts, fileBuffer, currentGcsUri, effectiveMime, fileName, 'DOCUMENT TO ANALYZE');

        parts.push({
            text: `Analyze this institutional document named "${fileName}". Focus purely on the substantive content and the core point/takeaway of the file (never mention file size, format, or storage properties).
Even if the filename is generic or arbitrary, interpret the actual text content and official directives.
Return a valid JSON object with exactly these three fields:
{
  "summary": "Provide exactly 2 to 3 substantive, content-driven sentences separated by newlines (\\n\\n) explaining what the document covers, key directives or findings, and administrative outcome.",
  "classification": "Exactly one of: ${DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC}, ${DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE}, ${DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED}, ${DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL}",
  "changeSummary": "Initial file upload"
}`,
        });
    }

    // Flash-only multi-model cascade with automatic fallback
    let parsedResponse = null;
    let isEncrypted = false;
    let isCapacityBusy = false;
    let lastError = null;

    for (const candidate of MODEL_CANDIDATES) {
        const { model: modelCandidate, location: modelLocation } = normalizeCandidate(candidate);

        // --- STEP 1: Attempt with modern @google/genai SDK ---
        const genAI = getGenAIClient(modelLocation);
        if (genAI) {
            try {
                console.log(`[aiService] Calling @google/genai generateContent with model: ${modelCandidate} in ${modelLocation}`);
                const response = await genAI.models.generateContent({
                    model: modelCandidate,
                    contents: parts,
                    config: {
                        responseMimeType: 'application/json',
                        temperature: 0.15,
                        systemInstruction: SYSTEM_INSTRUCTION,
                    },
                });

                const rawText = response?.text;
                if (rawText) {
                    parsedResponse = safeParseJSON(rawText);
                    if (parsedResponse) {
                        console.log(`[aiService] Successfully parsed JSON from @google/genai (${modelCandidate} in ${modelLocation}):`, JSON.stringify(parsedResponse));
                        break;
                    }
                }
            } catch (genAiErr) {
                lastError = genAiErr;
                const errLower = (genAiErr?.message || '').toLowerCase();
                console.warn(`[aiService] @google/genai failed with ${modelCandidate} (${modelLocation}):`, genAiErr?.message);

                if (
                    errLower.includes('password') ||
                    errLower.includes('encrypted') ||
                    errLower.includes('decrypt')
                ) {
                    isEncrypted = true;
                    break;
                }
            }
        }

        // --- STEP 2: Attempt with legacy @google-cloud/vertexai SDK ---
        const legacyModel = getGenerativeModel(candidate);
        if (legacyModel) {
            try {
                console.log(`[aiService] Calling legacy VertexAI generateContent with model: ${modelCandidate} in ${modelLocation}`);
                const response = await legacyModel.generateContent({
                    contents: [{ role: 'user', parts }],
                });

                const rawText = extractResponseText(response);
                if (rawText) {
                    parsedResponse = safeParseJSON(rawText);
                    if (parsedResponse) {
                        console.log(`[aiService] Successfully parsed JSON from legacy VertexAI (${modelCandidate} in ${modelLocation}):`, JSON.stringify(parsedResponse));
                        break;
                    }
                }
            } catch (error) {
                lastError = error;
                const errorMsg = (error?.message || '').toLowerCase();
                console.error(`[aiService] Error with legacy model ${modelCandidate} (${modelLocation}):`, error?.message);

                if (
                    errorMsg.includes('password') ||
                    errorMsg.includes('encrypted') ||
                    errorMsg.includes('decrypt') ||
                    errorMsg.includes('unsupported encryption')
                ) {
                    isEncrypted = true;
                    break;
                }

                if (
                    errorMsg.includes('unavailable') ||
                    errorMsg.includes('503') ||
                    errorMsg.includes('no capacity available') ||
                    errorMsg.includes('resource_exhausted') ||
                    errorMsg.includes('429')
                ) {
                    isCapacityBusy = true;
                    continue;
                }
            }
        }
    }

    // SCENARIO 5: Encrypted PDF Fallback
    if (isEncrypted) {
        const encryptedSummary = `Security-protected institutional document containing restricted administrative records for ${cleanedName}.\n\nDirect textual content is password-protected and requires authorized administrative decryption.\n\nProtected under university confidential document handling protocols.`;
        const embedding = await generateVectorEmbedding(`${fileName} encrypted document password protected`);

        return {
            success: true,
            summary: encryptedSummary,
            classification: DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL,
            changeSummary: isVersionUpdate
                ? 'Updated password-protected document'
                : 'Initial file upload (password-protected)',
            embedding,
            isEncryptedFallback: true,
        };
    }

    // SCENARIO 12: Capacity Unavailable / 503 Fallback (Never crash upload)
    if (!parsedResponse && isCapacityBusy) {
        console.warn(`[aiService] All AI models capacity busy. Returning graceful content fallback for ${fileName}.`);
        const busySummary = generateContentAwareSummary(fileName, extractedText);
        return {
            success: true,
            summary: formatExecutiveSummary(busySummary),
            classification: DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED,
            changeSummary: isVersionUpdate ? 'Document version updated' : 'Initial file upload',
            embedding: null,
            isCapacityUnavailable: true,
        };
    }

    // General fallback if all models failed: Pure content-driven interpretation (NO file properties!)
    if (!parsedResponse) {
        console.error(`[aiService] All model candidates failed for "${fileName}". Last error:`, lastError?.message);

        const textForFallback = extractedText ||
            (fileBuffer && isDocxFile(effectiveMime, fileName) ? await extractTextFromDocxBuffer(fileBuffer) : null) ||
            (fileBuffer && isTextFile(effectiveMime, fileName) ? fileBuffer.toString('utf-8') : null);
        const contentSummary = generateContentAwareSummary(fileName, textForFallback);

        let fallbackClassification = DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED;
        const lower = (fileName + ' ' + (textForFallback || '')).toLowerCase();
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

    // Validate classification against allowed values
    const validClassifications = Object.values(DOCUMENT_VERSIONS_CLASSIFICATION);
    const finalClassification = (parsedResponse?.classification && validClassifications.includes(parsedResponse.classification))
        ? parsedResponse.classification
        : DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED;

    const rawSummary = parsedResponse?.summary || generateContentAwareSummary(fileName, extractedText);
    const finalSummary = formatExecutiveSummary(rawSummary);

    const finalChangeSummary = isVersionUpdate
        ? formatChangeSummary(parsedResponse?.changeSummary || 'Document updated to new version.')
        : (parsedResponse?.changeSummary || 'Initial file upload');

    console.log(`[aiService] Final result for "${fileName}": classification="${finalClassification}", summary="${finalSummary.substring(0, 80)}..."`);

    // Generate 768-dim Vector Embedding for semantic search
    const embedding = await generateVectorEmbedding(`${fileName} ${finalSummary} ${finalClassification}`);

    return {
        success: true,
        summary: finalSummary,
        classification: finalClassification,
        changeSummary: finalChangeSummary,
        embedding,
    };
}

/**
 * Synthesizes an executive overview for a folder based on its child documents.
 */
async function synthesizeFolderSummary({ folderName, childDocuments = [] }) {
    if (childDocuments.length === 0) {
        return {
            success: true,
            summary: `Administrative collection designated for ${folderName}.\n\nContains zero active archived files.\n\nReserved for departmental document preservation.`,
        };
    }

    const docSummaries = childDocuments.slice(0, 20).map((d) => {
        return `- ${d.name} (${d.classification || DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED}): ${d.summary || 'Official record'}`;
    }).join('\n');

    const prompt = `Synthesize a concise 2-sentence executive overview for an institutional folder named "${folderName}" containing the following records:\n${docSummaries}\n\nReturn JSON: {"summary": "2 sentences describing the collection's subject matter and institutional purpose separated by \\n\\n. Never mention file sizes or storage properties."}`;

    for (const candidate of MODEL_CANDIDATES) {
        const { model: modelCandidate, location: modelLocation } = normalizeCandidate(candidate);

        // Try @google/genai
        const genAI = getGenAIClient(modelLocation);
        if (genAI) {
            try {
                const response = await genAI.models.generateContent({
                    model: modelCandidate,
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    config: {
                        responseMimeType: 'application/json',
                        temperature: 0.2,
                    },
                });

                const text = response?.text;
                if (text) {
                    const parsed = safeParseJSON(text);
                    if (parsed?.summary) {
                        return {
                            success: true,
                            summary: formatExecutiveSummary(parsed.summary),
                        };
                    }
                }
            } catch (genAiErr) {
                console.warn(`[aiService.synthesizeFolderSummary] @google/genai failed with ${modelCandidate}:`, genAiErr?.message);
            }
        }

        // Try legacy VertexAI
        const model = getGenerativeModel(candidate);
        if (model) {
            try {
                const response = await model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                });

                const text = extractResponseText(response);
                if (text) {
                    const parsed = safeParseJSON(text);
                    if (parsed?.summary) {
                        return {
                            success: true,
                            summary: formatExecutiveSummary(parsed.summary),
                        };
                    }
                }
            } catch (err) {
                console.warn(`[aiService.synthesizeFolderSummary] legacy VertexAI failed with ${modelCandidate}:`, err?.message);
            }
        }
    }

    return {
        success: true,
        summary: `Administrative collection containing institutional documentation for ${folderName}.\n\nPreserves verified departmental files and records.\n\nMaintained for institutional governance and compliance.`,
    };
}

module.exports = {
    analyzeDocumentFile,
    synthesizeFolderSummary,
    generateVectorEmbedding,
};
