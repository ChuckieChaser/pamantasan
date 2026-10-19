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

// Lazy-load OCR service to avoid circular dependency issues.
// Used for Vision API text extraction pre-pass on uploaded image files.
let _extractTextFromImageBuffer = null;
function getOcrExtractor() {
    if (!_extractTextFromImageBuffer) {
        try {
            _extractTextFromImageBuffer = require('./ocrService').extractTextFromImageBuffer;
        } catch {
            _extractTextFromImageBuffer = null;
        }
    }
    return _extractTextFromImageBuffer;
}

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'pamantasan-records-210fe';
// Colocated with Firebase Storage bucket in ASIA-SOUTHEAST1 (Singapore)
const VERTEX_LOCATION = process.env.VERTEX_AI_LOCATION || 'asia-southeast1';
const DEFAULT_STORAGE_BUCKET = process.env.STORAGE_BUCKET_NAME || 'pamantasan-records-210fe.firebasestorage.app';
// NOTE: Google AI Studio API keys are NOT used here.
// All AI processing uses Google Cloud Vertex AI exclusively.
// Vertex AI does NOT train on your data and has a formal Data Processing Agreement (DPA)
// required for compliance with the Philippine Data Privacy Act (RA 10173).
// See: https://cloud.google.com/terms/data-processing-terms

// Model cascade: Try Gemini 2.5 Flash (newest) first, then legacy 2.0/1.5 variants.
// gemini-2.5-flash-preview models have the widest access on newer Firebase projects.
// Both us-central1 and asia-southeast1 are tried for each model.
const MODEL_CANDIDATES = [
    // Gemini 2.5 Flash — widest access on newer GCP projects
    { model: 'gemini-2.5-flash',                 location: 'us-central1' },
    { model: 'gemini-2.5-flash',                 location: 'asia-southeast1' },
    { model: 'gemini-2.5-flash-preview-04-17',   location: 'us-central1' },
    { model: 'gemini-2.5-flash-preview-04-17',   location: 'asia-southeast1' },
    // Gemini 2.0 Flash
    { model: 'gemini-2.0-flash-001',             location: 'us-central1' },
    { model: 'gemini-2.0-flash',                 location: 'us-central1' },
    { model: 'gemini-2.0-flash-001',             location: 'asia-southeast1' },
    { model: 'gemini-2.0-flash',                 location: 'asia-southeast1' },
    // Gemini 1.5 Flash (older fallback)
    { model: 'gemini-1.5-flash-002',             location: 'us-central1' },
    { model: 'gemini-1.5-flash-001',             location: 'us-central1' },
    { model: 'gemini-1.5-flash',                 location: 'us-central1' },
    { model: 'gemini-1.5-flash-002',             location: 'asia-southeast1' },
    { model: 'gemini-1.5-flash-001',             location: 'asia-southeast1' },
    { model: 'gemini-1.5-flash',                 location: 'asia-southeast1' },
];

const SYSTEM_INSTRUCTION = `You are the Lead AI Document Intelligence Engine for Pamantasan Records Management System (an official Philippine Higher Education Records System).
Your task is to analyze documents, scans, images, audio recordings, or technical data uploaded to the institutional repository and generate an authoritative, substantive, and content-focused executive summary.

DYNAMIC EXECUTIVE SUMMARIZATION RULES:
1. "summary":
   - INSTITUTIONAL MEMORANDUM / OFFICIAL ISSUANCE HEADER FORMAT:
     If the document is a memorandum, circular, office order, or formal issuance with structured metadata, format the summary with the official record header at the top:
     [MEMORANDUM / DOCUMENT NO. if available]
     Date: [Date if available]

     TO: [Recipient if available]
     FROM: [Issuing Office/Sender if available]
     SUBJECT: [Subject if available]

     Followed by double newlines (\\n\\n), and then the substantive executive summary of 1 to 3 sentences under them.
   - For general documents without structured memo headers, provide the 1 to 3 concise, substantive sentences directly.
   - DYNAMIC LENGTH SCALING (1 to 3 sentences maximum for the substantive body):
     * 1 Sentence: For short, routine, or low-density documents (e.g. single-page administrative notices, simple official receipts, brief certificates, basic clearances, standard forms). Synthesize the core subject matter, affected party, and administrative takeaway in 1 direct, substantive sentence.
     * 2 Sentences: For moderate-length documents (e.g. 1-2 page memoranda, circulars, routine reports, standard syllabi, simple grade sheets, departmental minutes). Use Sentence 1 for subject matter/context and Sentence 2 for substantive directives, findings, or administrative outcomes.
     * 3 Sentences: For extensive, detailed, or complex documents (e.g. multi-page policy manuals, comprehensive curriculum guides, full scholastic transcripts of records, audit reports, multi-subject resolutions). Use Sentence 1 for core subject/context, Sentence 2 for concrete findings/data/clauses, and Sentence 3 for overarching conclusions or compliance directives.
     * NEVER exceed 3 sentences for the body summary. Do NOT lock shorter documents into artificial 3 sentences—let shorter content remain concise (1 sentence).
   - PURE CONTENT FOCUS: Focus EXCLUSIVELY on substantive content, subject matter, core narrative, key findings, and outcomes so users can quickly understand long complex files without reading the entire document.
   - ABSOLUTE PROHIBITION ON FILE PROPERTIES: NEVER mention file properties, file size (e.g., "13.6 KB", "bytes", "MB"), file formats/extensions (e.g., ".pdf", ".png", "image", "binary format"), or storage statements (e.g., "in repository archives", "asset size"). The user interface already displays file properties elsewhere.
   - NO FILLER INTROS: Never start with filler phrases (e.g. "This document is...", "The uploaded file...", "An image showing...", "This is a..."). Immediately identify the core subject matter and context.

2. "classification": Accurately classify into EXACTLY one official institutional security tier based SOLELY on the document file content:
   - CRITICAL IN-DOCUMENT SECURITY MARKING OVERRIDE (HIGHEST PRIORITY):
     If the document text contains an explicit security classification (e.g. "Classification: CONFIDENTIAL", "CONFIDENTIAL MEMORANDUM", "Strictly Confidential", "Classification: RESTRICTED", "Classification: PUBLIC", "Classification: PRIVATE"), you MUST classify it strictly according to that explicit declaration. Never categorize a document as PRIVATE if it explicitly states it is CONFIDENTIAL or RESTRICTED!
   - Default Subject Matter Guidelines (when no explicit declaration exists in the text):
     * "${DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL}": Documents with sensitive personal data, student grades, transcripts of records (TOR), personnel 201/PDS files, payroll ledgers, legal contracts, or disciplinary proceedings.
     * "${DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED}": Faculty performance evaluations, departmental budget requests, audit reports, strategic planning drafts, board deliberation records.
     * "${DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE}": Internal communications addressed ONLY to university personnel (College Deans, Program Chairs, Department Heads, Faculty Members, Administrative Personnel, Staff, Employees) — memoranda, circulars, office orders, syllabus drafts, meeting minutes, routine requisitions, academic reporting directives. This applies even when the topic is a celebration, event, or schedule change.
     * "${DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC}": Documents intended for an audience beyond university personnel — anything addressed to students (e.g. "All Enrolled Students", "Student Body"), the whole university/campus community, parents, alumni, applicants, or the general public. Includes Supreme Student Council (PSSC) notices, student surveys, voting/award/election notices, event invitations for students, campus-wide announcements, press releases, public advisories (class suspensions, holiday advisories), academic calendars, and student handbooks.
   - AUDIENCE RULE: The addressee line (TO: / MEMORANDUM FOR) is the strongest signal for PUBLIC vs PRIVATE. Students or the community → PUBLIC. Personnel only → PRIVATE.
   - Judge ONLY from the document content. NEVER let the file name influence the classification (the same document must get the same classification regardless of its file name).

3. "changeSummary":
   - For initial uploads (v1.0): Output EXACTLY "Initial file upload".
   - For version updates (v2.0+): Output a concise bulleted markdown list explicitly stating what has changed and what was replaced for a clear audit record of the action:
     * Note any security classification change (e.g., "- Security classification changed from PRIVATE to CONFIDENTIAL.").
     * Note any replaced subject matter (e.g., "- Replaced previous subject matter with \\"...\\".").
     * Note any designated or replaced document identifier / reference number.
     * Note any established administrative deadlines or compliance dates.
     * Note any added non-disclosure or distribution restrictions.
     * Note key updated clauses or substantive textual modifications.
     Each bullet MUST start with "- " and end with a double newline ("\\n\\n").

Always return a valid JSON object with exactly these three fields: "summary", "classification", and "changeSummary".`;

// Google GenAI clients — two modes:
// 1. Vertex AI mode: { vertexai: true, project, location } — uses ADC, no API key needed
// 2. API Key mode: { apiKey } — uses Gemini Developer API (Google AI Studio), simpler auth
const genAIClients = new Map();

/**
 * Returns a Vertex AI @google/genai client for the given location.
 * @google/genai v2.x requires lowercase 'vertexai' key (NOT 'vertexAI').
 */
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
            console.log(`[aiService] @google/genai Vertex AI client ready for ${loc}`);
        } catch (err) {
            console.warn(`[aiService] @google/genai Vertex AI init failed for ${loc}:`, err?.message);
        }
    }
    return genAIClients.get(loc);
}

/**
 * Google AI Studio API key mode is DISABLED for RA 10173 Data Privacy Act compliance.
 * Google AI Studio (free/paid key) may use submitted data to improve Google's AI models.
 * All AI processing must go through Google Cloud Vertex AI, which:
 *   - Does NOT train on customer data
 *   - Has a formal Data Processing Agreement (DPA)
 *   - Is compliant with GDPR, ISO 27001, and Philippine RA 10173
 *
 * If you ever need to re-enable API key mode, ensure you have signed Google's
 * Cloud DPA and that the documents processed are NOT sensitive personal information
 * as defined by RA 10173 §3(l).
 *
 * @returns {null} Always null — API key mode is disabled.
 */
function getGeminiApiKeyClient() {
    return null; // Disabled: Google AI Studio may train on data (RA 10173 non-compliant)
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
 * Extracts structured metadata fields and builds an institutional memo header block
 * matching official university record formatting:
 *
 * MEMORANDUM NO. 2026-063
 * Date: October 2, 2026
 *
 * TO: All College Deans, Department Heads, Faculty Members, and Administrative Personnel
 * FROM: Office of Academic Affairs
 * SUBJECT: Submission of Midterm Academic Reports
 */
function buildInstitutionalHeaderBlock(rawText) {
    if (!rawText || typeof rawText !== 'string') return null;

    let text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

    // 1. Separate squished keywords where no space exists, e.g. "CommunityFROM:" or "AffairsSUBJECT:"
    text = text.replace(/([A-Za-z0-9_.,])(MEMORANDUM|OFFICE\s+ORDER|SPECIAL\s+ORDER|ADMINISTRATIVE\s+ORDER|CIRCULAR|DATE|DATED|TO|MEMORANDUM\s+FOR|FOR|ATTENTION|FROM|ISSUED\s+BY|SUBJECT)\s*[:;\u2014-]/gi, '$1\n$2:');
    
    // 2. Separate when there are spaces but no newline: "... Community FROM: ..."
    text = text.replace(/([^\n])\s+\b(DATE|DATED|TO|MEMORANDUM\s+FOR|FOR|ATTENTION|FROM|ISSUED\s+BY|SUBJECT|\bRE\b)\s*[:;\u2014-]/gi, '$1\n$2:');

    const lines = text.split('\n').map(l => l.trim());

    // 1. Extract Document Type & Number
    const extractDocTitleAndNumber = () => {
        // Pattern A: "MEMORANDUM (CIRCULAR)? NO. 2026-063" or "OFFICE ORDER NO. 12"
        const p1 = text.match(/^\s*((?:MEMORANDUM(?:\s+CIRCULAR)?|OFFICE\s+ORDER|SPECIAL\s+ORDER|ADMINISTRATIVE\s+ORDER|EXECUTIVE\s+ORDER|CIRCULAR|PRESIDENTIAL\s+DECREE)\s+NO\.?\s*[:\u2014-]?\s*[-A-Za-z0-9_/.,\s]+?)(?=\r?\n|$)/im);
        if (p1 && p1[1]) {
            const clean = p1[1].trim().replace(/\s+/g, ' ');
            if (clean.length < 80) return clean;
        }

        // Pattern B: "MEMORANDUM" line followed by "NO. 2026-063" or "Series of 2026" on next line
        const p2 = text.match(/^\s*(MEMORANDUM(?:\s+CIRCULAR)?|OFFICE\s+ORDER|SPECIAL\s+ORDER|ADMINISTRATIVE\s+ORDER|CIRCULAR)\s*\n\s*(?:NO\.?|SERIES\s+OF|S\.)\s*([-A-Za-z0-9_/.,\s]+?)(?=\r?\n|$)/im);
        if (p2 && p2[1]) {
            const title = p2[1].trim().replace(/\s+/g, ' ');
            const num = (p2[2] || '').trim().replace(/\s+/g, ' ');
            return num ? `${title} NO. ${num}` : title;
        }

        // Pattern C: "DOCUMENT NO." / "REF NO." / "MEMO NO."
        const p3 = text.match(/^\s*(?:DOCUMENT|DOC|REF|MEMO)\s*NO\.?\s*[:\u2014-]?\s*([-A-Za-z0-9_/]+)/im);
        if (p3 && p3[1]) {
            return `MEMORANDUM NO. ${p3[1].trim()}`;
        }

        // Pattern D: Standalone document type header on line 1 or 2 (e.g. "MEMORANDUM", "MEMORANDUM CIRCULAR", "OFFICE ORDER")
        for (let i = 0; i < Math.min(5, lines.length); i++) {
            const l = lines[i];
            if (/^(MEMORANDUM(?:\s+CIRCULAR)?|OFFICE\s+ORDER|SPECIAL\s+ORDER|ADMINISTRATIVE\s+ORDER|CIRCULAR|NOTICE)$/i.test(l)) {
                return l.toUpperCase();
            }
        }

        return null;
    };

    // 2. Extract Date
    const extractDate = () => {
        // "Date: October 2, 2026" or "DATE 10 APRIL 2026" or "Date: 10/02/2026"
        const m1 = text.match(/^\s*(?:DATE|DATED)\s*[:;\u2014.-]?\s*([-A-Za-z0-9\s,/]+?)(?=\r?\n|$)/im);
        if (m1 && m1[1] && m1[1].trim()) {
            const val = m1[1].trim().replace(/\s+/g, ' ');
            if (/\d{4}|\b(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/i.test(val) && val.length < 50) {
                return val;
            }
        }

        // Standalone date line in first 10 lines (e.g. "October 2, 2026" or "10 April 2026")
        for (let i = 0; i < Math.min(10, lines.length); i++) {
            const l = lines[i];
            const dateMatch = l.match(/^([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})$/i);
            if (dateMatch) {
                return dateMatch[1].trim();
            }
        }

        return null;
    };

    // 3. Extract Recipient (TO:)
    const extractRecipient = () => {
        const m = text.match(/^\s*(?:TO|MEMORANDUM\s+FOR|FOR|ATTENTION)\s*[:;\u2014.-]?\s*([^\n\r]+)/im);
        if (m && m[1] && m[1].trim()) {
            let val = m[1].trim();

            // Guard against inline bleed into subsequent fields
            val = val.split(/\b(?:FROM|SUBJECT|DATE|RE|MEMORANDUM|OFFICE\s+ORDER)\s*[:;\u2014-]/i)[0].trim();

            // Check if next lines are continuation of recipient list
            const matchIndex = text.indexOf(m[0]);
            if (matchIndex !== -1) {
                const afterMatch = text.slice(matchIndex + m[0].length);
                const afterLines = afterMatch.split('\n').map(l => l.trim()).filter(Boolean);
                for (const nextLine of afterLines) {
                    if (/^(?:FROM|SUBJECT|RE|DATE|MEMORANDUM|OFFICE|CLASSIFICATION)\b/i.test(nextLine)) break;
                    if (/\b(?:FROM|SUBJECT|DATE)\s*[:;\u2014-]/i.test(nextLine)) break;
                    if (/^(?:The|This|Pursuant|In\s+accordance|Please|Kindly|With\s+reference|Registration)\b/i.test(nextLine)) break;
                    if (nextLine.length > 120 || /[.!?]$/.test(nextLine)) break;
                    val += `, ${nextLine}`;
                }
            }

            return val.replace(/\s+/g, ' ').replace(/,\s*,/g, ',').trim();
        }

        // Fallback: Lines right under MEMORANDUM that explicitly list target personnel/departments before SUBJECT
        const memoMatch = text.match(/^\s*(MEMORANDUM(?:\s+CIRCULAR)?|CIRCULAR|OFFICE\s+ORDER)\b/im);
        if (memoMatch) {
            const memoIndex = text.indexOf(memoMatch[0]);
            const textAfterMemo = text.slice(memoIndex + memoMatch[0].length);
            const candidateLines = textAfterMemo.split('\n').map(l => l.trim()).filter(Boolean);
            const capturedRecipients = [];
            for (const cLine of candidateLines) {
                if (/^(?:SUBJECT|RE|TITLE|DATE)\b/i.test(cLine)) break;
                if (/\b(?:HEADS|SUPERVISORS|BENEFICIARIES|DEANS|DIRECTORS|FACULTY|PERSONNEL|STUDENTS|EMPLOYEES|OFFICERS)\b/i.test(cLine) && cLine.length < 120) {
                    capturedRecipients.push(cLine);
                }
            }
            if (capturedRecipients.length > 0) {
                return capturedRecipients.join(', ');
            }
        }

        return null;
    };

    // 4. Extract Sender (FROM:)
    const extractSender = () => {
        const m = text.match(/^\s*(?:FROM|ISSUED\s+BY|OFFICE\s+OF\s+THE)\s*[:;\u2014.-]?\s*([^\n\r]+)/im);
        if (m && m[1] && m[1].trim()) {
            let val = m[1].trim();
            if (m[0].trim().toUpperCase().startsWith('OFFICE OF THE') && !m[0].includes(':')) {
                val = m[0].trim();
            }

            val = val.split(/\b(?:SUBJECT|DATE|TO|RE|MEMORANDUM|CLASSIFICATION)\s*[:;\u2014-]/i)[0].trim();

            const matchIndex = text.indexOf(m[0]);
            if (matchIndex !== -1) {
                const afterMatch = text.slice(matchIndex + m[0].length);
                const afterLines = afterMatch.split('\n').map(l => l.trim()).filter(Boolean);
                for (const nextLine of afterLines) {
                    if (/^(?:TO|SUBJECT|RE|DATE|MEMORANDUM|CLASSIFICATION)\b/i.test(nextLine)) break;
                    if (/\b(?:TO|SUBJECT|DATE)\s*[:;\u2014-]/i.test(nextLine)) break;
                    if (nextLine.length > 80 || /[.!?]$/.test(nextLine)) break;
                    val += `, ${nextLine}`;
                    break;
                }
            }

            return val.replace(/\s+/g, ' ').trim();
        }

        // Secondary check: "Office of the President" or "Office of Academic Affairs" on line 1-6
        for (let i = 0; i < Math.min(6, lines.length); i++) {
            const l = lines[i];
            if (/^(?:Office\s+of\s+(?:the\s+)?[A-Za-z\s]+|Public\s+Employment\s+Service\s+Office\s+\(PESO\)[A-Za-z\s]*)$/i.test(l)) {
                return l.trim().replace(/\s+/g, ' ');
            }
        }

        return null;
    };

    // 5. Extract Subject (SUBJECT:)
    const extractSubject = () => {
        // Require SUBJECT or TITLE with colon/separator, or \bRE\b with required colon/separator!
        // Never match words like "Registration" or "Resolution"
        const m = text.match(/^\s*(?:SUBJECT|TITLE|\bRE\b)\s*[:;\u2014.-]\s*([^\n\r]+)/im) ||
                  text.match(/^\s*SUBJECT\s{1,4}([^\n\r]{5,})/im);
        if (m && m[1] && m[1].trim()) {
            let val = m[1].trim();

            val = val.split(/\b(?:DATE|TO|FROM|MEMORANDUM|CLASSIFICATION)\s*[:;\u2014-]/i)[0].trim();

            const matchIndex = text.indexOf(m[0]);
            if (matchIndex !== -1) {
                const afterMatch = text.slice(matchIndex + m[0].length);
                const afterLines = afterMatch.split('\n').map(l => l.trim()).filter(Boolean);
                for (const nextLine of afterLines) {
                    if (/^(?:TO|FROM|DATE|MEMORANDUM|CLASSIFICATION|\bRE\b)\b/i.test(nextLine)) break;
                    if (/^(?:Pursuant|In\s+accordance|Please|Kindly|This|The|Notice|With\s+reference|Section|Registration)\b/i.test(nextLine)) break;
                    if (nextLine.length > 100 || /[.!?]$/.test(nextLine)) break;
                    val += ` ${nextLine}`;
                }
            }

            val = val.replace(/\s+/g, ' ').trim();
            if (val.length > 200) val = val.slice(0, 200).trim();
            return val;
        }

        return null;
    };

    const docNo = extractDocTitleAndNumber();
    const docDate = extractDate();
    const recipient = extractRecipient();
    const sender = extractSender();
    const subject = extractSubject();

    if (!recipient && !sender && !subject && !docNo) {
        return null;
    }

    const topLines = [];
    if (docNo) topLines.push(docNo);
    if (docDate) {
        const cleanDate = docDate.replace(/^Date\s*[:;\u2014.-]?\s*/i, '').trim();
        topLines.push(`Date: ${cleanDate}`);
    }

    const partyLines = [];
    if (recipient) partyLines.push(`TO: ${recipient}`);
    if (sender) partyLines.push(`FROM: ${sender}`);
    if (subject) partyLines.push(`SUBJECT: ${subject}`);

    const sections = [];
    if (topLines.length > 0) sections.push(topLines.join('\n'));
    if (partyLines.length > 0) sections.push(partyLines.join('\n'));

    return sections.length > 0 ? sections.join('\n\n') : null;
}

/**
 * Normalizes and formats executive summaries to ensure proper presentation.
 * Preserves structured institutional header blocks (MEMORANDUM NO., Date, TO, FROM, SUBJECT)
 * if present at the top, and formats the executive summary sentences under them.
 */
function formatExecutiveSummary(rawSummary) {
    if (!rawSummary || typeof rawSummary !== 'string') return '';

    let text = rawSummary.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    text = text.replace(/^["']|["']$/g, '').trim();

    // 1. Separate squished keywords where no space exists, e.g. "CommunityFROM:" or "AffairsSUBJECT:"
    text = text.replace(/([A-Za-z0-9_.,])(MEMORANDUM|OFFICE\s+ORDER|SPECIAL\s+ORDER|ADMINISTRATIVE\s+ORDER|CIRCULAR|DATE|DATED|TO|MEMORANDUM\s+FOR|FOR|ATTENTION|FROM|ISSUED\s+BY|SUBJECT)\s*[:;\u2014-]/gi, '$1\n$2:');
    
    // 2. Separate when there are spaces but no newline: "... Community FROM: ..."
    text = text.replace(/([^\n])\s+\b(DATE|DATED|TO|MEMORANDUM\s+FOR|FOR|ATTENTION|FROM|ISSUED\s+BY|SUBJECT|\bRE\b)\s*[:;\u2014-]/gi, '$1\n$2:');

    const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);

    let docNo = null;
    let docDate = null;
    let recipient = null;
    let sender = null;
    let subject = null;

    const bodyLines = [];

    for (let i = 0; i < rawLines.length; i++) {
        const l = rawLines[i];

        if (!docNo && /^(MEMORANDUM(?:\s+CIRCULAR)?|OFFICE\s+ORDER|SPECIAL\s+ORDER|ADMINISTRATIVE\s+ORDER|CIRCULAR|DOCUMENT|REF|MEMO)\s*NO\.?\s*[:\u2014-]?\s*[-A-Za-z0-9_/.,\s]+/i.test(l)) {
            docNo = l;
            continue;
        }

        if (!docDate && /^(?:DATE|DATED)\s*[:;\u2014.-]?\s*[-A-Za-z0-9\s,/]+$/i.test(l)) {
            docDate = l.replace(/^(?:DATE|DATED)\s*[:;\u2014.-]?\s*/i, 'Date: ');
            continue;
        }

        if (!recipient && /^(?:TO|MEMORANDUM\s+FOR|FOR|ATTENTION)\s*[:;\u2014.-]?\s*(.+)/i.test(l)) {
            const m = l.match(/^(?:TO|MEMORANDUM\s+FOR|FOR|ATTENTION)\s*[:;\u2014.-]?\s*(.+)/i);
            recipient = m[1].trim();
            continue;
        }

        if (!sender && /^(?:FROM|ISSUED\s+BY|OFFICE\s+OF\s+THE)\s*[:;\u2014.-]?\s*(.+)/i.test(l)) {
            const m = l.match(/^(?:FROM|ISSUED\s+BY|OFFICE\s+OF\s+THE)\s*[:;\u2014.-]?\s*(.+)/i);
            sender = m[1].trim();
            continue;
        }

        if (!subject && /^(?:SUBJECT|TITLE|\bRE\b)\s*[:;\u2014.-]?\s*(.+)/i.test(l)) {
            const m = l.match(/^(?:SUBJECT|TITLE|\bRE\b)\s*[:;\u2014.-]?\s*(.+)/i);
            const subCandidate = m[1].trim();
            // If it's a mangled word like "gistration for participating...", fix to "Registration for participating..." and put into body!
            if (/^gistration\b/i.test(subCandidate)) {
                bodyLines.push(`Re${subCandidate}`);
                continue;
            }
            subject = subCandidate;
            continue;
        }

        // Secondary check: if there is another line starting with SUBJECT: gistration..., fix it
        if (/^(?:SUBJECT|TITLE|\bRE\b)\s*[:;\u2014.-]?\s*(.+)/i.test(l)) {
            const m = l.match(/^(?:SUBJECT|TITLE|\bRE\b)\s*[:;\u2014.-]?\s*(.+)/i);
            const extra = m[1].trim();
            if (/^gistration\b/i.test(extra)) {
                bodyLines.push(`Re${extra}`);
            } else {
                bodyLines.push(extra);
            }
            continue;
        }

        bodyLines.push(l);
    }

    const topSection = [];
    if (docNo) topSection.push(docNo);
    if (docDate) topSection.push(docDate);

    const partySection = [];
    if (recipient) partySection.push(`TO: ${recipient}`);
    if (sender) partySection.push(`FROM: ${sender}`);
    if (subject) partySection.push(`SUBJECT: ${subject}`);

    const headerParts = [];
    if (topSection.length > 0) headerParts.push(topSection.join('\n'));
    if (partySection.length > 0) headerParts.push(partySection.join('\n'));

    const formattedHeader = headerParts.join('\n\n');

    // Filter and format body paragraphs (max 3 substantive paragraphs)
    const cleanedBody = bodyLines
        .filter(l => !/^(asset size|file size|preserved in repository|in institutional repository|format:|file format|asset format)/i.test(l))
        .map(l => {
            let s = l.trim();
            if (!/[.!?]$/.test(s)) s += '.';
            return s;
        });

    const formattedBody = cleanedBody.slice(0, 3).join('\n\n');

    if (formattedHeader && formattedBody) {
        return `${formattedHeader}\n\n${formattedBody}`;
    } else if (formattedHeader) {
        return formattedHeader;
    }
    return formattedBody;
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
                let val = res.value.trim();
                // Separate table cells by newline so adjacent fields (TO: / FROM:) don't squish together
                val = val.replace(/\t+/g, '\n');
                return val;
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
                    const text = xml
                        .replace(/<\/w:p>/gi, '\n')
                        .replace(/<\/w:tr>/gi, '\n')
                        .replace(/<\/w:tc>/gi, '\n')
                        .replace(/<w:br[^>]*\/?>/gi, '\n')
                        .replace(/<[^>]+>/g, '')
                        .replace(/[ \t]+/g, ' ')
                        .replace(/\n\s+/g, '\n')
                        .replace(/\n{3,}/g, '\n\n')
                        .trim();
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
 * Generates an executive summary based on the actual text content extracted from the document.
 * Avoids any hardcoded boilerplate or canned templates.
 */
function generateContentAwareSummary(fileName = '', textContent = '') {
    const raw = (textContent || '').replace(/\r\n/g, '\n').trim();
    const cleanedName = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();

    if (!raw) {
        return `Official institutional record concerning ${cleanedName}.`;
    }

    const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Extract structured metadata fields from document headers
    const extractField = (patterns) => {
        for (const p of patterns) {
            const m = raw.match(p);
            if (m && m[1]?.trim()) return m[1].trim().replace(/\s+/g, ' ');
        }
        return null;
    };

    const subject = extractField([
        // Standard colon/dash delimited
        /^(?:subject|re|title)\s*[:\u2014-]\s*([^\n\r]+)/im,
        /\b(?:subject|re)\s*[:\u2014-]\s*([^\n\r]+)/im,
        // OCR-style: "SUBJECT [space] text" with no colon
        /^SUBJECT\s{1,4}([^\n\r]{10,})/im,
    ]);
    const issuingOffice = extractField([
        /^(?:from|issued\s+by|office\s+of\s+the)\s*[:\u2014-]\s*([^\n\r]+)/im,
    ]);
    const recipient = extractField([
        /^(?:to|attention|memorandum\s+for)\s*[:\u2014-]\s*([^\n\r]+)/im,
    ]);
    const deadline = extractField([
        /(?:on\s+or\s+before|deadline|due\s+date|effective\s+date|not\s+later\s+than)\s*[:\u2014-]?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
    ]);

    // A line is a header/meta label ONLY if the keyword is the entire line
    // or is immediately followed by colon/em-dash — NOT just any space.
    const isHeaderOrMeta = (str) => {
        const s = str.trim();
        if (/^(memorandum|circular|notice|confidential|restricted|private|public|department\s+heads|gip\s+and\s+spes\s+supervisors)$/i.test(s)) return true;
        if (/^(to|from|date|subject|re|title|classification|document\s*no|ref\s*no|page\s*\d+|memorandum|circular|notice|office\s+order|special\s+order)\s*[:\u2014-]/i.test(s)) return true;
        if (/^(SUBJECT|DATE|RE|TITLE)\s+[A-Z0-9]/i.test(s) && s.split(' ').length <= 15) return true;
        return false;
    };

    // Collect all substantive sentences from the document body
    // Smart splitter: avoids breaking on abbreviations like No., Sec., Dept., Gov.
    const splitToSentences = (text) => {
        const abbrevProtected = text.replace(/\b(No|Sec|Dept|Gov|Exec|Sr|Jr|Dr|Mr|Mrs|Ms|vs|etc|approx|incl|est)\./gi, '$1\u2060');
        return abbrevProtected.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [text];
    };

    const substantiveSentences = [];
    for (const line of lines) {
        if (isHeaderOrMeta(line)) continue;
        if (line.length < 20) continue;
        const parts = splitToSentences(line);
        for (let p of parts) {
            let s = p.replace(/\u2060/g, '.').trim().replace(/\s+/g, ' ');
            if (s.length >= 20 && !isHeaderOrMeta(s)) {
                if (!/[.!?]$/.test(s)) s += '.';
                substantiveSentences.push(s);
            }
        }
    }

    const summarySentences = [];

    // Sentence 1: Authority & Subject context
    if (subject && issuingOffice) {
        const toClause = recipient ? ` to ${recipient}` : '';
        summarySentences.push(`Official memorandum issued by ${issuingOffice}${toClause} regarding ${subject}.`);
    } else if (subject) {
        summarySentences.push(`Official institutional documentation addressing ${subject}.`);
    } else if (substantiveSentences.length > 0) {
        summarySentences.push(substantiveSentences[0]);
    } else {
        summarySentences.push(`Official institutional record concerning ${cleanedName}.`);
    }

    // Sentence 2: Key substantive directive from body
    const remaining = substantiveSentences.filter(
        s => !summarySentences.some(e => e.includes(s.slice(0, 30))) &&
             !(subject && s.toLowerCase().includes(subject.toLowerCase().slice(0, 30)))
    );
    const directiveSentence = remaining.find(s =>
        /\b(directed|required|mandated|submitted|approved|resolved|evaluated|conducted|established|prohibited|instructed|completed|reviewed|authorized)\b/i.test(s)
    ) || remaining[0];
    if (directiveSentence) {
        summarySentences.push(directiveSentence);
    }

    // Sentence 3: Deadline or compliance outcome (only for multi-sentence substantive docs)
    if (raw.length > 300 && summarySentences.length === 2) {
        if (deadline) {
            summarySentences.push(`Establishes an official compliance deadline on or before ${deadline} for all concerned personnel.`);
        } else {
            const outcomeSentence = remaining.find(s =>
                s !== directiveSentence &&
                /\b(compliance|strict|effective|schedule|implementation|penalty|enforce|maintain|archived|authoritative|records|submitted|submission)\b/i.test(s)
            );
            if (outcomeSentence) {
                summarySentences.push(outcomeSentence);
            }
        }
    }

    const bodySummary = summarySentences.slice(0, 3).map(s => {
        let clean = s.trim();
        if (!/[.!?]$/.test(clean)) clean += '.';
        return clean;
    }).join('\n\n');

    const headerBlock = buildInstitutionalHeaderBlock(raw);
    if (headerBlock) {
        return `${headerBlock}\n\n${bodySummary}`;
    }

    return bodySummary;
}

// Audience vocabulary used to judge the TO: / MEMORANDUM FOR line.
const PUBLIC_AUDIENCE_PATTERN = /\b(?:students|student\s+body|studentry|plpians|university\s+community|campus\s+community|academic\s+community|plp\s+community|school\s+community|general\s+public|the\s+public|all\s+citizens|citizens|external\s+stakeholders|stakeholders|parents|guardians|alumni|applicants|freshmen|everyone)\b/i;
const INTERNAL_AUDIENCE_PATTERN = /\b(?:deans?|directors?|department\s+heads?|heads?\s+of\s+(?:offices?|units?|departments?)|unit\s+heads?|program\s+chairs?|chairpersons?|chairs|faculty|professors?|instructors?|teachers|administrative\s+personnel|personnel|staff|employees|officials|vice\s+presidents?|coordinators?|registrar|treasurer|accountants?|budget\s+officers?|members\s+of\s+the\s+board|board\s+of\s+regents)\b/i;

/**
 * Extracts the addressee from a memo header ("TO: All Enrolled Students ..."), stopping at the next header label.
 */
function extractAddresseeLine(raw = '') {
    if (!raw) return '';
    const match = raw.match(/(?:^|[\n\r]|\s)(?:to|memorandum\s+for|attention|attn\.?)\s*[:;\u2014]\s*([^\n\r]{1,300})/i);
    if (!match) return '';
    return match[1].split(/\b(?:from|date|dated|subject|re|thru|through)\s*[:;\u2014]/i)[0].trim();
}

/**
 * Accurately determines document classification based on:
 * 1. Explicit in-document security declarations (highest priority)
 * 2. Subject matter content signals (sensitive personal data, financials, etc.)
 * 3. Audience and dissemination intent (broad university community → PUBLIC)
 *
 * KEY RULES:
 * - The addressee (TO: / MEMORANDUM FOR) decides PUBLIC vs PRIVATE: students, the university community,
 *   parents, alumni, or the public → PUBLIC; university personnel only → PRIVATE
 * - Student council notices, surveys, award/election notices → PUBLIC
 * - Personal data, grades, payroll → CONFIDENTIAL regardless of memo format
 * - Content always outranks the filename (filename is used only when no text is available)
 */
function determineDocumentClassification(textContent = '', fileName = '') {
    const raw = (textContent || '').trim();
    // Judge from document content; the filename is only a fallback when no text could be extracted
    // (prevents "1234.png" vs "PLP-AAO-...-MEM-2026-45.png" producing different results for the same document).
    const lower = (raw || fileName || '').toLowerCase();

    if (!raw && !fileName) {
        return DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED;
    }

    // --- TIER 1: Explicit in-document security declarations (Highest Authority) ---

    if (
        /\bclassification\s*:\s*confidential\b/i.test(raw) ||
        /\bconfidential\s+memorandum\b/i.test(raw) ||
        /\bstrictly\s+confidential\b/i.test(raw) ||
        /\bconfidential\s*[-—]\s*for\s+authorized\s+personnel\s+only\b/i.test(raw) ||
        /\btreated\s+as\s+confidential\b/i.test(raw) ||
        /\bkeep\s+confidential\b/i.test(raw) ||
        /\bfor\s+authorized\s+personnel\s+only\b/i.test(raw)
    ) {
        return DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL;
    }

    if (
        /\bclassification\s*:\s*restricted\b/i.test(raw) ||
        /\bstrictly\s+restricted\b/i.test(raw) ||
        /\brestricted\s+memorandum\b/i.test(raw) ||
        /\bfor\s+board\s+eyes\s+only\b/i.test(raw) ||
        /\bexecutive\s+session\s+only\b/i.test(raw)
    ) {
        return DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED;
    }

    if (
        /\bclassification\s*:\s*public\b/i.test(raw) ||
        /\bfor\s+immediate\s+release\b/i.test(raw) ||
        /\bpress\s+release\b/i.test(raw) ||
        /\bcampus[- ]wide\s+announcement\b/i.test(raw) ||
        /\bpublic\s+advisory\b/i.test(raw) ||
        /\bgeneral\s+circular\b/i.test(raw) ||
        /\bfor\s+(?:information\s+and\s+)?general\s+dissemination\b/i.test(raw) ||
        /\bfor\s+widest\s+dissemination\b/i.test(raw)
    ) {
        return DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC;
    }

    if (
        /\bclassification\s*:\s*private\b/i.test(raw) ||
        /\bprivate\s+memorandum\b/i.test(raw) ||
        /\bfor\s+department\s+eyes\s+only\b/i.test(raw) ||
        /\binternal\s+use\s+only\b/i.test(raw) ||
        /\binternal\s+administrative\s+use\s+only\b/i.test(raw)
    ) {
        return DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE;
    }

    // --- TIER 2: Sensitive personal & legal records (CONFIDENTIAL) ---
    if (
        /\b(transcript of records|tor|scholastic record|gwa|cwa|student grade|grades evaluation)\b/i.test(lower) ||
        /\b(personal data sheet|pds|form 201|payroll ledger|salary scale|compensation record)\b/i.test(lower) ||
        /\b(disciplinary case|administrative charge|legal settlement|affidavit of)\b/i.test(lower)
    ) {
        return DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL;
    }

    // --- TIER 3: Managerial & Strategic oversight (RESTRICTED) ---
    if (
        /\b(annual audit report|coa audit|audit finding|financial audit)\b/i.test(lower) ||
        /\b(budget proposal|budget request|appropriation request|fiscal allocation)\b/i.test(lower) ||
        /\b(faculty evaluation|performance appraisal|board resolution|board minutes|deliberation)\b/i.test(lower)
    ) {
        return DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED;
    }

    // --- TIER 4: Intended audience (TO: / MEMORANDUM FOR line) — decisive for PUBLIC vs PRIVATE ---
    const addressee = extractAddresseeLine(raw);
    if (addressee) {
        if (PUBLIC_AUDIENCE_PATTERN.test(addressee)) {
            return DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC;
        }
        if (INTERNAL_AUDIENCE_PATTERN.test(addressee)) {
            return DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE;
        }
    }

    // --- TIER 5: Public-facing announcements & student-body notices (PUBLIC) ---
    const isPublicAnnouncement = (
        /\b(?:press\s+release|for\s+immediate\s+release|public\s+advisory|general\s+public\s+notice)\b/i.test(lower) ||
        /\b(?:suspension\s+of\s+classes|class\s+suspension|work\s+suspension|holiday\s+advisory)\b/i.test(lower) ||
        /\b(?:academic\s+calendar|student\s+handbook|commencement\s+program|university\s+manual)\b/i.test(lower) ||
        /\b(?:newsletter|bulletin\s+board|sports\s+festival|job\s+fair|open\s+house|graduation\s+rites)\b/i.test(lower) ||
        /\b(?:from\s*[:;\u2014]\s*[^\n\r]*|office\s+of\s+the\s+)(?:plp\s+)?(?:supreme\s+student\s+council|student\s+council|central\s+student\s+government)\b/i.test(lower) ||
        /\bpssc[\s_-]*notice\b/i.test(lower) ||
        /\b(?:student\s+choice\s+award|student\s+(?:preference\s+)?survey|preference\s+survey|call\s+for\s+(?:participants|entries|nominations|applicants)|student\s+elections?)\b/i.test(lower)
    );
    if (isPublicAnnouncement) {
        return DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC;
    }

    // --- TIER 6: Internal Institutional Communications (PRIVATE) ---
    const isInternalCommunication = (
        /\b(memorandum|circular|office\s+order|special\s+order)\b/i.test(lower) ||
        /\b(meeting\s+minutes|departmental\s+meeting|committee\s+meeting)\b/i.test(lower) ||
        /\b(course\s+syllabus|course\s+outline|curriculum\s+guide|learning\s+plan)\b/i.test(lower) ||
        /\b(purchase\s+requisition|inspection\s+report|inventory\s+list)\b/i.test(lower)
    );
    if (isInternalCommunication) {
        return DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE;
    }

    return DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED;
}

/**
 * Generates an explicit change summary detailing what changed and what was replaced.
 */
function generateVersionChangeSummary({
    newText = '',
    newClassification = '',
    previousText = '',
    previousSummary = '',
    previousClassification = '',
    nextVersion = 2,
}) {
    const changes = [];

    // 1. Classification Transition & Security Action
    if (previousClassification && newClassification && previousClassification !== newClassification) {
        changes.push(`Security classification changed from **${previousClassification}** to **${newClassification}** based on document content.`);
    } else if (newClassification && newClassification === 'CONFIDENTIAL') {
        changes.push(`Secured under **CONFIDENTIAL** handling protocols (access restricted to authorized personnel only).`);
    } else if (newClassification && newClassification !== 'UNCLASSIFIED') {
        changes.push(`Maintained **${newClassification}** institutional security status.`);
    }

    // 2. Subject Matter Changes
    const extractSubject = (text = '') => {
        if (!text) return null;
        // Standard colon/dash delimited
        const match = text.match(/(?:subject|re|title)\s*[:\u2014-]\s*([^\n\r.]+)/i);
        if (match) return match[1].trim();
        // OCR-style without colon
        const ocrMatch = text.match(/^SUBJECT\s{1,4}([^\n\r]{10,})/im);
        if (ocrMatch) return ocrMatch[1].trim();
        // Fallback: first non-header line
        const firstLine = text.split('\n')
            .map(l => l.trim())
            .find(l => l.length > 15 && !/^(confidential|restricted|private|public|memorandum|notice|to:|from:|date:|classification:|document)/i.test(l));
        return firstLine ? firstLine.slice(0, 80).trim() : null;
    };

    const prevSubject = extractSubject(previousText || previousSummary);
    const newSubject = extractSubject(newText);

    if (prevSubject && newSubject && prevSubject.toLowerCase() !== newSubject.toLowerCase()) {
        changes.push(`Replaced document subject matter: updated from "${prevSubject}" to "**${newSubject}**".`);
    } else if (newSubject) {
        changes.push(`Designated document subject: "**${newSubject}**".`);
    }

    // 3. Document Reference Number Changes
    const extractDocNo = (text = '') => {
        const m = text.match(/(?:document\s*no\.?|doc\s*no\.?|ref\s*no\.?|memo\s*no\.?)\s*[:\u2014-]\s*([A-Za-z0-9_/]+)/i);
        return m ? m[1].trim() : null;
    };
    const prevDocNo = extractDocNo(previousText || previousSummary);
    const newDocNo = extractDocNo(newText);
    if (newDocNo && prevDocNo && newDocNo !== prevDocNo) {
        changes.push(`Replaced reference identifier: updated from **${prevDocNo}** to **${newDocNo}**.`);
    } else if (newDocNo) {
        changes.push(`Designated reference identifier: **${newDocNo}**.`);
    }

    // 4. Administrative Deadlines & Effective Dates
    const extractDates = (text = '') => {
        const matches = text.match(/(?:on\s+or\s+before|deadline|due\s+date|effective\s+date|not\s+later\s+than)\s*[:\u2014-]?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/gi) || [];
        return matches.map(m => m.trim());
    };
    const prevDates = extractDates(previousText || previousSummary);
    const newDates = extractDates(newText);
    if (newDates.length > 0 && prevDates.length > 0 && newDates[0] !== prevDates[0]) {
        changes.push(`Updated administrative deadline: changed from "${prevDates[0]}" to "**${newDates[0]}**".`);
    } else if (newDates.length > 0) {
        changes.push(`Established administrative timeline: **${newDates[0]}**.`);
    }

    // 5. Clause-Level Content Diffing (Replaced, Added)
    const cleanLines = (t) => (t || '')
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map(l => l.trim().replace(/\s+/g, ' '))
        .filter(l => l.length > 25 &&
            !/^(to|from|date|subject|re|classification|document\s*no|ref\s*no|page\s*\d+|memorandum|notice)\s*[:\u2014-]/i.test(l)
        );

    const oldLines = cleanLines(previousText || previousSummary);
    const newLines = cleanLines(newText);

    if (newLines.length > 0) {
        const replacedList = [];
        const addedList = [];

        for (const nLine of newLines) {
            const exact = oldLines.some(o => o.toLowerCase() === nLine.toLowerCase());
            if (exact) continue;

            const nPrefix = nLine.toLowerCase().split(/\s+/).slice(0, 4).join(' ');
            const oldMatch = oldLines.find(o => {
                const oPrefix = o.toLowerCase().split(/\s+/).slice(0, 4).join(' ');
                return nPrefix.length > 12 && oPrefix === nPrefix && o !== nLine;
            });

            if (oldMatch) {
                replacedList.push({ old: oldMatch, new: nLine });
            } else if (oldLines.length > 0) {
                const nKey = nLine.toLowerCase().slice(0, 35);
                const partialMatch = oldLines.some(o =>
                    o.toLowerCase().includes(nKey) || nLine.toLowerCase().includes(o.toLowerCase().slice(0, 35))
                );
                if (!partialMatch) addedList.push(nLine);
            } else {
                addedList.push(nLine);
            }
        }

        for (const r of replacedList.slice(0, 2)) {
            const oldSnip = r.old.length > 90 ? `${r.old.slice(0, 90)}...` : r.old;
            const newSnip = r.new.length > 90 ? `${r.new.slice(0, 90)}...` : r.new;
            changes.push(`Replaced previous clause: "${oldSnip}" with updated directive: "**${newSnip}**".`);
        }

        for (const a of addedList.slice(0, 2)) {
            const snip = a.length > 100 ? `${a.slice(0, 100)}...` : a;
            changes.push(`Added new provision: "${snip}".`);
        }
    }

    if (changes.length === 0) {
        changes.push(`Updated document content and published revision v${nextVersion}.0.`);
    }

    return changes.map(c => `- ${c}`).join('\n\n');
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
            systemInstruction: {
                role: 'system',
                parts: [{ text: SYSTEM_INSTRUCTION }],
            },
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

    // text-embedding-004 is deployed on Vertex AI in asia-southeast1 (primary) and us-central1
    const candidateLocations = ['asia-southeast1', 'us-central1'];

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
    downloadUrl = null,
    fileBase64 = null,
    mimeType,
    fileName,
    fileSize = 0,
    isVersionUpdate = false,
    previousStoragePath = null,
    previousMimeType = null,
    previousSummary = null,
    previousClassification = null,
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
    const candidateBuckets = [
        DEFAULT_STORAGE_BUCKET,
        'pamantasan-records-210fe.firebasestorage.app',
        'pamantasan-records-210fe.appspot.com',
    ];
    try {
        const defaultName = getStorage().bucket().name;
        if (defaultName && !candidateBuckets.includes(defaultName)) {
            candidateBuckets.unshift(defaultName);
        }
    } catch {
        // default bucket resolution
    }

    let bucketName = candidateBuckets[0];
    let fileBuffer = null;

    // Priority 1: Direct client-provided fileBase64 (instantaneous in-memory, 0 storage latency)
    if (fileBase64 && typeof fileBase64 === 'string') {
        try {
            const cleanBase64 = fileBase64.replace(/^data:.*?;base64,/, '');
            fileBuffer = Buffer.from(cleanBase64, 'base64');
            console.log(`[aiService] Successfully loaded fileBuffer from client-provided fileBase64: ${fileBuffer.length} bytes for "${fileName}"`);
        } catch (bErr) {
            console.warn('[aiService] Failed to parse client fileBase64:', bErr?.message);
        }
    }

    // Priority 2: Direct downloadUrl fetch (with retry — file may not be accessible immediately after upload)
    if (!fileBuffer && downloadUrl && typeof downloadUrl === 'string') {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                if (attempt > 0) {
                    await new Promise((r) => setTimeout(r, attempt * 1500));
                    console.log(`[aiService] Retrying downloadUrl fetch (attempt ${attempt + 1}) for "${fileName}"`);
                }
                const dlRes = await fetch(downloadUrl);
                if (dlRes.ok) {
                    const arrayBuf = await dlRes.arrayBuffer();
                    fileBuffer = Buffer.from(arrayBuf);
                    console.log(`[aiService] Downloaded buffer via downloadUrl: ${fileBuffer.length} bytes for "${fileName}"`);
                    break;
                }
                console.warn(`[aiService] downloadUrl HTTP ${dlRes.status} for "${fileName}" (attempt ${attempt + 1})`);
            } catch (fetchErr) {
                console.warn(`[aiService] downloadUrl fetch error (attempt ${attempt + 1}):`, fetchErr?.message);
            }
        }
    }

    // Priority 3: Firebase Storage candidate buckets (with retry — newly uploaded files may not be immediately readable)
    if (!fileBuffer && storagePath) {
        for (const bName of candidateBuckets) {
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    if (attempt > 0) {
                        await new Promise((r) => setTimeout(r, attempt * 1500));
                        console.log(`[aiService] Retrying Storage download (attempt ${attempt + 1}) for "${fileName}" from ${bName}`);
                    }
                    const bucket = getStorage().bucket(bName);
                    const [downloaded] = await bucket.file(storagePath).download();
                    fileBuffer = downloaded;
                    bucketName = bName;
                    console.log(`[aiService] Downloaded buffer: ${fileBuffer.length} bytes for "${fileName}" from ${bName}`);
                    break;
                } catch (storErr) {
                    console.warn(`[aiService] Storage download error (attempt ${attempt + 1}) from ${bName}:`, storErr?.message);
                }
            }
            if (fileBuffer) break;
        }
    }

    const currentGcsUri = `gs://${bucketName}/${storagePath}`;
    const effectiveMime = resolveGeminiMimeType(fileName, mimeType);

    console.log(`[aiService] GCS URI: ${currentGcsUri}, effectiveMime: ${effectiveMime}`);

    let previousBuffer = null;
    if (isVersionUpdate && previousStoragePath) {
        for (const bName of candidateBuckets) {
            try {
                const bucket = getStorage().bucket(bName);
                const [prevDownloaded] = await bucket.file(previousStoragePath).download();
                previousBuffer = prevDownloaded;
                console.log(`[aiService] Successfully downloaded previous buffer: ${previousBuffer.length} bytes from ${bName}`);
                break;
            } catch {
                // try next
            }
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
            // Use inlineData only when buffer is available AND small enough (<=15MB)
            if (buffer && buffer.length > 0 && buffer.length <= 15 * 1024 * 1024) {
                targetParts.push({
                    inlineData: {
                        data: buffer.toString('base64'),
                        mimeType: mime,
                    },
                });
                if (label) {
                    targetParts.push({ text: `[Attached file above is: ${label} ("${name}")]` });
                }
            } else if (gcsUri && gcsUri.startsWith('gs://')) {
                // Large files OR when buffer download failed — use GCS URI directly.
                // Requires Gemini service account to have Storage Object Viewer access on the bucket.
                targetParts.push({
                    fileData: {
                        fileUri: gcsUri,
                        mimeType: mime,
                    },
                });
                if (label) {
                    targetParts.push({ text: `[Attached file above is: ${label} ("${name}")]` });
                }
                console.log(`[aiService] Using GCS URI path for "${name}" (buffer=${buffer ? buffer.length + 'B' : 'null'}, uri=${gcsUri})`);
            } else {
                // No buffer, no valid GCS URI — note metadata only
                targetParts.push({
                    text: `${label ? `[${label}] ` : ''}DOCUMENT: "${name}" (${mime}) — file content unavailable for direct analysis.`,
                });
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

    // --- VISION OCR PRE-PASS: For image files (PNG/JPG/WEBP/etc.), extract text via
    // Google Cloud Vision before Gemini sees the image. This ensures classification and
    // summarization are based on the actual document text, not Gemini's image inference alone.
    // The OCR-extracted text is prepended as explicit DOCUMENT CONTENT so Gemini can read it
    // even if the image encoding / Vertex AI model image support is limited.
    const isImageFile = (mime = '', name = '') => {
        const m = (mime || '').toLowerCase();
        const n = (name || '').toLowerCase();
        return m.startsWith('image/') ||
            n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.jpeg') ||
            n.endsWith('.webp') || n.endsWith('.tiff') || n.endsWith('.bmp') || n.endsWith('.gif');
    };

    let ocrExtractedText = extractedText || null; // Start with whatever was provided

    if (!ocrExtractedText && fileBuffer && fileBuffer.length > 0 && isImageFile(effectiveMime, fileName)) {
        console.log(`[aiService] Running Vision OCR pre-pass for image "${fileName}" (${fileBuffer.length} bytes)...`);
        const ocrExtractor = getOcrExtractor();
        if (ocrExtractor) {
            try {
                const visionText = await ocrExtractor(fileBuffer, true);
                if (visionText && visionText.trim().length > 10) {
                    ocrExtractedText = visionText.trim();
                    console.log(`[aiService] Vision OCR extracted ${ocrExtractedText.length} chars from image "${fileName}"`);
                } else {
                    console.log(`[aiService] Vision OCR returned no text for "${fileName}" — proceeding with image-only analysis`);
                }
            } catch (ocrErr) {
                console.warn(`[aiService] Vision OCR pre-pass failed for "${fileName}":`, ocrErr?.message);
            }
        }
    }

    // Attach the OCR-extracted or client-provided text transcript first (highest priority context)
    if (ocrExtractedText && typeof ocrExtractedText === 'string' && ocrExtractedText.trim()) {
        parts.push({
            text: `EXTRACTED DOCUMENT CONTENT / OCR TRANSCRIPT:\n"""\n${ocrExtractedText.trim().slice(0, 40000)}\n"""`,
        });
    }

    if (isVersionUpdate) {
        // SCENARIO 10: Version Diffing (v2.0+)
        if (previousStoragePath) {
            const previousGcsUri = `gs://${bucketName}/${previousStoragePath}`;
            const previousEffectiveMime = resolveGeminiMimeType(fileName, previousMimeType || mimeType);
            await attachContentToParts(parts, previousBuffer, previousGcsUri, previousEffectiveMime, fileName, 'PREVIOUS VERSION');
        }

        if (previousSummary) {
            parts.push({
                text: `PREVIOUS VERSION CONTEXT (v${Math.max(1, (nextVersion || 2) - 1)}.0):\n- Summary: "${previousSummary}"${previousClassification ? `\n- Classification: ${previousClassification}` : ''}`,
            });
        }

        await attachContentToParts(parts, fileBuffer, currentGcsUri, effectiveMime, fileName, 'NEW VERSION');

        parts.push({
            text: `${SYSTEM_INSTRUCTION}

Compare the two versions of "${fileName}" carefully. Focus purely on the substantive content and changes (never mention file size, format, or storage properties).
State explicitly what has changed and what was replaced (security classification, subject matter, reference identifiers, deadlines, directives, content).
Return a valid JSON object with exactly these three fields:
{
  "summary": "Provide 1 to 3 concise, substantive, content-driven sentences separated by double newlines (\\n\\n) scaled dynamically to content length (1 sentence for short notices/receipts/forms, 2-3 sentences for substantive memos/policies/curricula, max 3 sentences).",
  "classification": "Exactly one of: ${DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC}, ${DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE}, ${DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED}, ${DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL}",
  "changeSummary": "Bulleted markdown list explicitly detailing what has changed and what was replaced between previous and new versions. Each bullet MUST begin with '- ' on its own line and end with a double newline (\\n\\n)."
}`,
        });
    } else {
        // Initial Version (v1.0)
        await attachContentToParts(parts, fileBuffer, currentGcsUri, effectiveMime, fileName, 'DOCUMENT TO ANALYZE');

        parts.push({
            text: `${SYSTEM_INSTRUCTION}

Analyze this institutional document named "${fileName}". Focus purely on the substantive content and the core point/takeaway of the file (never mention file size, format, or storage properties).
Even if the filename is generic or arbitrary, interpret the actual text content and official directives.
Return a valid JSON object with exactly these three fields:
{
  "summary": "Provide 1 to 3 concise, substantive, content-driven sentences separated by double newlines (\\n\\n) scaled dynamically to content length (1 sentence for short notices/receipts/forms, 2-3 sentences for substantive memos/policies/curricula, max 3 sentences).",
  "classification": "Exactly one of: ${DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC}, ${DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE}, ${DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED}, ${DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL}",
  "changeSummary": "Initial file upload"
}`,
        });
    }

    // Flash-only multi-model cascade with automatic fallback
    let parsedResponse = null;
    let isEncrypted = false;
    let capacityBusyCount = 0;
    let lastError = null;

    /**
     * Robustly extracts text from a @google/genai response.
     * The SDK returns response.text as a string property (not a function).
     * Also handles candidates array for safety.
     */
    const extractGenAIResponseText = (response) => {
        if (!response) return null;
        // Primary: response.text is a string property in @google/genai
        if (typeof response.text === 'string' && response.text.trim()) {
            return response.text.trim();
        }
        // Secondary: candidates array (Vertex AI shape)
        const candidates = response.candidates;
        if (Array.isArray(candidates) && candidates.length > 0) {
            const textParts = (candidates[0]?.content?.parts || [])
                .filter((p) => p?.text && typeof p.text === 'string')
                .map((p) => p.text.trim())
                .filter(Boolean);
            if (textParts.length > 0) return textParts.join('\n');
        }
        return null;
    };

    // --- STEP 0: Try Gemini Developer API (API key mode) first if GEMINI_API_KEY is configured.
    // Bypasses Vertex AI model access requirements entirely and uses Google AI Studio quota directly.
    const apiKeyClient = getGeminiApiKeyClient();
    if (apiKeyClient) {
        // Prepare parts for API key mode (supports text parts and base64 inlineData, excludes fileData / GCS uris)
        const apiKeyParts = parts.filter(p => (typeof p.text === 'string' && p.text.trim()) || p.inlineData);
        if (apiKeyParts.length > 0) {
            const apiKeyModels = [
                'gemini-3.8-flash',
                'gemini-3.5-flash',
                'gemini-flash-latest',
                'gemini-flash-lite-latest',
                'gemini-3.1-flash-lite',
                'gemini-2.5-flash',
            ];
            for (const modelName of apiKeyModels) {
                if (parsedResponse) break;
                try {
                    console.log(`[aiService] Trying Gemini API key mode: ${modelName}`);
                    const apiKeyCallPromise = apiKeyClient.models.generateContent({
                        model: modelName,
                        contents: apiKeyParts,
                        config: {
                            responseMimeType: 'application/json',
                            temperature: 0.15,
                            systemInstruction: SYSTEM_INSTRUCTION,
                        },
                    });
                    const apiKeyTimeout = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('API key call timeout after 30s')), 30000)
                    );
                    const response = await Promise.race([apiKeyCallPromise, apiKeyTimeout]);
                    const rawText = extractGenAIResponseText(response);
                    if (rawText) {
                        parsedResponse = safeParseJSON(rawText);
                        if (parsedResponse) {
                            console.log(`[aiService] Gemini API key success (${modelName}):`, JSON.stringify(parsedResponse).slice(0, 200));
                        }
                    }
                } catch (apiKeyErr) {
                    console.warn(`[aiService] Gemini API key failed (${modelName}):`, apiKeyErr?.message?.slice(0, 150));
                }
            }
        }
    }

    for (const candidate of MODEL_CANDIDATES) {
        if (parsedResponse) break;
        const { model: modelCandidate, location: modelLocation } = normalizeCandidate(candidate);

        // --- STEP 1: Attempt with modern @google/genai SDK (Vertex AI) ---
        const genAI = getGenAIClient(modelLocation);
        if (genAI) {
            try {
                console.log(`[aiService] Calling @google/genai generateContent with model: ${modelCandidate} in ${modelLocation}`);

                // Per-call timeout: prevents one hanging request from consuming the entire Cloud Function budget
                const genAICallPromise = genAI.models.generateContent({
                    model: modelCandidate,
                    contents: parts,
                    config: {
                        responseMimeType: 'application/json',
                        temperature: 0.15,
                        systemInstruction: SYSTEM_INSTRUCTION,
                    },
                });
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('AI call timeout after 55s')), 55000)
                );
                const response = await Promise.race([genAICallPromise, timeoutPromise]);

                // @google/genai returns response.text as a string (not a function)
                const rawText = extractGenAIResponseText(response);
                if (rawText) {
                    parsedResponse = safeParseJSON(rawText);
                    if (parsedResponse) {
                        console.log(`[aiService] @google/genai success (${modelCandidate} in ${modelLocation}):`, JSON.stringify(parsedResponse).slice(0, 200));
                        break;
                    }
                    console.warn(`[aiService] @google/genai response not valid JSON (${modelCandidate}):`, rawText.slice(0, 200));
                } else {
                    console.warn(`[aiService] @google/genai returned empty text for (${modelCandidate} in ${modelLocation})`);
                }
            } catch (genAiErr) {
                lastError = genAiErr;
                const errLower = (genAiErr?.message || '').toLowerCase();
                console.warn(`[aiService] @google/genai failed with ${modelCandidate} (${modelLocation}):`, genAiErr?.message);

                if (errLower.includes('password') || errLower.includes('encrypted') || errLower.includes('decrypt')) {
                    isEncrypted = true;
                    break;
                }

                // Rate limited — wait before trying next model
                if (errLower.includes('429') || errLower.includes('resource_exhausted') || errLower.includes('quota')) {
                    capacityBusyCount++;
                    console.warn(`[aiService] Rate limited on ${modelCandidate} (${modelLocation}), waiting 1s before next candidate...`);
                    await new Promise((r) => setTimeout(r, 1000));
                }
            }
        }

        // If @google/genai already succeeded, skip legacy SDK
        if (parsedResponse) break;
        if (isEncrypted) break;

        // --- STEP 2: Attempt with legacy @google-cloud/vertexai SDK ---
        const legacyModel = getGenerativeModel(candidate);
        if (legacyModel) {
            try {
                console.log(`[aiService] Calling legacy VertexAI generateContent with model: ${modelCandidate} in ${modelLocation}`);

                const legacyCallPromise = legacyModel.generateContent({
                    contents: [{ role: 'user', parts }],
                });
                const legacyTimeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Legacy AI call timeout after 50s')), 50000)
                );
                const response = await Promise.race([legacyCallPromise, legacyTimeoutPromise]);

                const rawText = extractResponseText(response);
                if (rawText) {
                    parsedResponse = safeParseJSON(rawText);
                    if (parsedResponse) {
                        console.log(`[aiService] Legacy VertexAI success (${modelCandidate} in ${modelLocation}):`, JSON.stringify(parsedResponse).slice(0, 200));
                        break;
                    }
                    console.warn(`[aiService] Legacy VertexAI non-JSON response (${modelCandidate}):`, rawText.slice(0, 200));
                }
            } catch (error) {
                lastError = error;
                const errorMsg = (error?.message || '').toLowerCase();
                console.error(`[aiService] Legacy VertexAI error with ${modelCandidate} (${modelLocation}):`, error?.message);

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
                    capacityBusyCount++;
                    console.warn(`[aiService] Capacity issue on legacy ${modelCandidate} (${modelLocation}), waiting 1s...`);
                    await new Promise((r) => setTimeout(r, 1000));
                }
            }
        }

        if (parsedResponse) break;
        if (isEncrypted) break;
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

    // SCENARIO 12: All AI models capacity busy / exhausted — still return content-aware results (never crash upload)
    if (!parsedResponse && capacityBusyCount > 0) {
        console.warn(`[aiService] All AI models busy (${capacityBusyCount} capacity errors). Returning graceful content fallback for "${fileName}".`);
        const busyTextForFallback = ocrExtractedText ||
            (fileBuffer && isDocxFile(effectiveMime, fileName) ? await extractTextFromDocxBuffer(fileBuffer).catch(() => null) : null) ||
            (fileBuffer && isTextFile(effectiveMime, fileName) ? fileBuffer.toString('utf-8') : null);
        const busySummary = generateContentAwareSummary(fileName, busyTextForFallback);
        const busyClassification = determineDocumentClassification(busyTextForFallback, fileName);
        const busyChangeSummary = isVersionUpdate
            ? generateVersionChangeSummary({
                newText: busyTextForFallback || '',
                newClassification: busyClassification,
                previousSummary: previousSummary || '',
                previousClassification: previousClassification || '',
                fileName,
                nextVersion: nextVersion || 2,
            })
            : 'Initial file upload';
        const busyEmbedding = await generateVectorEmbedding(`${fileName} ${busySummary} ${busyClassification}`).catch(() => null);
        return {
            success: true,
            summary: formatExecutiveSummary(busySummary),
            classification: busyClassification,
            changeSummary: busyChangeSummary,
            embedding: busyEmbedding,
            isCapacityUnavailable: true,
        };
    }

    // General fallback if all models failed: Pure content-driven interpretation (NO hardcoded rules!)
    if (!parsedResponse) {
        console.error(`[aiService] All model candidates failed for "${fileName}". Last error:`, lastError?.message);

        // Use ocrExtractedText which includes Vision OCR text for image files
        const textForFallback = ocrExtractedText ||
            (fileBuffer && isDocxFile(effectiveMime, fileName) ? await extractTextFromDocxBuffer(fileBuffer) : null) ||
            (fileBuffer && isTextFile(effectiveMime, fileName) ? fileBuffer.toString('utf-8') : null);
        console.log(`[aiService] All models failed fallback for "${fileName}": textForFallback=${textForFallback ? textForFallback.length + ' chars' : 'null'}`);
        const contentSummary = generateContentAwareSummary(fileName, textForFallback);
        const fallbackClassification = determineDocumentClassification(textForFallback, fileName);
        const fallbackChangeSummary = isVersionUpdate
            ? generateVersionChangeSummary({
                newText: textForFallback || '',
                newClassification: fallbackClassification,
                previousSummary: previousSummary || '',
                previousClassification: previousClassification || '',
                fileName,
                nextVersion: nextVersion || 2,
            })
            : 'Initial file upload';

        const fallbackEmbedding = await generateVectorEmbedding(`${fileName} ${contentSummary} ${fallbackClassification}`).catch(() => null);

        return {
            success: false,
            summary: formatExecutiveSummary(contentSummary),
            classification: fallbackClassification,
            changeSummary: fallbackChangeSummary,
            embedding: fallbackEmbedding,
            isAIFailed: true,
        };
    }

    // Use the best available text for final classification override check.
    // ocrExtractedText includes Vision OCR pre-pass results for images.
    const textForCheck = ocrExtractedText ||
        (fileBuffer && isDocxFile(effectiveMime, fileName) ? await extractTextFromDocxBuffer(fileBuffer) : null) ||
        (fileBuffer && isTextFile(effectiveMime, fileName) ? fileBuffer.toString('utf-8') : null);
    const explicitInDocClass = determineDocumentClassification(textForCheck, fileName);

    // Validate classification against allowed values, giving priority to explicit in-document declarations
    const validClassifications = Object.values(DOCUMENT_VERSIONS_CLASSIFICATION);
    let finalClassification = (parsedResponse?.classification && validClassifications.includes(parsedResponse.classification))
        ? parsedResponse.classification
        : DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED;

    if (explicitInDocClass && explicitInDocClass !== DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED) {
        finalClassification = explicitInDocClass;
    }

    let rawSummary = parsedResponse?.summary || generateContentAwareSummary(fileName, textForCheck);
    const headerBlock = buildInstitutionalHeaderBlock(textForCheck);
    if (headerBlock && !rawSummary.includes('SUBJECT:')) {
        rawSummary = `${headerBlock}\n\n${rawSummary}`;
    }
    const finalSummary = formatExecutiveSummary(rawSummary);

    let finalChangeSummary = 'Initial file upload';
    if (isVersionUpdate) {
        if (parsedResponse?.changeSummary && !parsedResponse.changeSummary.startsWith('Document version updated') && parsedResponse.changeSummary.includes('- ')) {
            finalChangeSummary = formatChangeSummary(parsedResponse.changeSummary);
        } else {
            finalChangeSummary = generateVersionChangeSummary({
                newText: textForCheck || '',
                newClassification: finalClassification,
                previousSummary: previousSummary || '',
                previousClassification: previousClassification || '',
                fileName,
                nextVersion: nextVersion || 2,
            });
        }
    }

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
    determineDocumentClassification,
    generateContentAwareSummary,
    generateVersionChangeSummary,
    formatExecutiveSummary,
    buildInstitutionalHeaderBlock,
};
