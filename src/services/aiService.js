// --- IMPORTS ---
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { constants } from '../constants';

// --- HELPERS: DYNAMIC CONTENT-DRIVEN EVALUATION ---

/**
 * Extracts plain text from an uploaded file (DOCX, text, markdown, etc.) in the browser.
 * Uses mammoth with automatic JSZip fallback for DOCX archives.
 */
export async function extractDocumentText(file, fileName = '') {
    if (!file) return null;
    const name = (fileName || file.name || '').toLowerCase();

    // 1. DOCX Handling: try mammoth first, fallback to JSZip parsing word/document.xml
    if (name.endsWith('.docx') || (file.type && file.type.includes('wordprocessingml'))) {
        try {
            const mammothModule = await import('mammoth');
            const mammoth = mammothModule.default || mammothModule;
            if (typeof mammoth?.extractRawText === 'function') {
                const arrayBuffer = await file.arrayBuffer();
                const res = await mammoth.extractRawText({ arrayBuffer });
                if (res?.value && res.value.trim().length > 10) {
                    let val = res.value.trim();
                    // Separate table cells by newline so adjacent fields (TO: / FROM:) don't squish together
                    val = val.replace(/\t+/g, '\n');
                    return val;
                }
            }
        } catch (mErr) {
            console.warn('[aiService] Mammoth extraction warning:', mErr?.message);
        }

        // JSZip fallback for docx word/document.xml
        try {
            const JSZipModule = await import('jszip');
            const JSZip = JSZipModule.default || JSZipModule;
            const arrayBuffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);
            const docXmlFile = zip.file('word/document.xml');
            if (docXmlFile) {
                const xmlText = await docXmlFile.async('text');
                const text = xmlText
                    .replace(/<\/w:p>/gi, '\n')
                    .replace(/<\/w:tr>/gi, '\n')
                    .replace(/<\/w:tc>/gi, '\n')
                    .replace(/<w:br[^>]*\/?>/gi, '\n')
                    .replace(/<[^>]+>/g, '')
                    .replace(/[ \t]+/g, ' ')
                    .replace(/\n\s+/g, '\n')
                    .replace(/\n{3,}/g, '\n\n')
                    .trim();
                if (text && text.length > 0) {
                    return text;
                }
            }
        } catch (zipErr) {
            console.warn('[aiService] JSZip docx fallback warning:', zipErr?.message);
        }
    }

    // 2. Plain Text / Code / JSON / Markdown Handling
    if (typeof file.text === 'function') {
        const isTextual = (file.type || '').startsWith('text/') ||
            file.type === 'application/json' ||
            file.type === 'application/javascript' ||
            name.endsWith('.txt') || name.endsWith('.csv') ||
            name.endsWith('.md') || name.endsWith('.json') ||
            name.endsWith('.js') || name.endsWith('.html') ||
            name.endsWith('.sql');
        if (isTextual) {
            try {
                const raw = await file.text();
                return raw ? raw.trim() : null;
            } catch {
                // Ignore text read failure
            }
        }
    }

    // 3. Image OCR Extraction via Google Cloud Vision API
    const isImage = (file.type || '').startsWith('image/') ||
        name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') ||
        name.endsWith('.webp') || name.endsWith('.bmp') || name.endsWith('.tiff') ||
        name.endsWith('.tif') || name.endsWith('.jfif');
    if (isImage) {
        try {
            const { ocrService } = await import('./ocrService');
            if (ocrService && typeof ocrService.extractText === 'function') {
                const ocrRes = await ocrService.extractText(file);
                if (ocrRes?.extractedText && ocrRes.extractedText.trim().length > 5) {
                    return ocrRes.extractedText.trim();
                }
            }
        } catch (ocrErr) {
            console.warn('[aiService] Image OCR extraction error:', ocrErr?.message);
        }
    }

    return null;
}

export function buildInstitutionalHeaderBlock(rawText) {
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
 * if present at the top with distinct newlines for each header item,
 * and formats the executive summary sentences under them.
 */
export function formatExecutiveSummary(rawSummary) {
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

export function determineDocumentClassification(textContent = '', fileName = '') {
    const raw = (textContent || '').trim();
    const lower = (raw + ' ' + (fileName || '')).toLowerCase();

    if (!raw && !fileName) {
        return constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED;
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
        return constants.DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL;
    }

    if (
        /\bclassification\s*:\s*restricted\b/i.test(raw) ||
        /\bstrictly\s+restricted\b/i.test(raw) ||
        /\brestricted\s+memorandum\b/i.test(raw) ||
        /\bfor\s+board\s+eyes\s+only\b/i.test(raw) ||
        /\bexecutive\s+session\s+only\b/i.test(raw)
    ) {
        return constants.DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED;
    }

    if (
        /\bclassification\s*:\s*public\b/i.test(raw) ||
        /\bfor\s+immediate\s+release\b/i.test(raw) ||
        /\bpress\s+release\b/i.test(raw) ||
        /\bpublic\s+advisory\b/i.test(raw)
    ) {
        return constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC;
    }

    if (
        /\bclassification\s*:\s*private\b/i.test(raw) ||
        /\bprivate\s+memorandum\b/i.test(raw) ||
        /\bfor\s+department\s+eyes\s+only\b/i.test(raw) ||
        /\binternal\s+use\s+only\b/i.test(raw) ||
        /\binternal\s+administrative\s+use\s+only\b/i.test(raw)
    ) {
        return constants.DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE;
    }

    // --- TIER 2: Sensitive personal & legal records (CONFIDENTIAL) ---
    if (
        /\b(transcript of records|tor|scholastic record|gwa|cwa|student grade records?|grades evaluation)\b/i.test(lower) ||
        /\b(personal data sheet|pds|form 201|payroll ledger|salary scale|compensation record)\b/i.test(lower) ||
        /\b(disciplinary case|administrative charge|legal settlement|affidavit of)\b/i.test(lower)
    ) {
        return constants.DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL;
    }

    // --- TIER 3: Managerial & Strategic oversight (RESTRICTED) ---
    if (
        /\b(annual audit report|coa audit|audit finding|financial audit)\b/i.test(lower) ||
        /\b(budget proposal|budget request|appropriation request|fiscal allocation)\b/i.test(lower) ||
        /\b(faculty evaluation|performance appraisal|board resolution|board minutes|deliberation)\b/i.test(lower)
    ) {
        return constants.DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED;
    }

    // --- TIER 4: General Public Advisories & Announcements (PUBLIC) ---
    // Strictly documents intended for the general public, external stakeholders, or public advisories.
    const isPublicAnnouncement = (
        /\bto\s*:\s*[^\n\r]*(?:general\s+public|all\s+citizens|external\s+stakeholders)/i.test(raw) ||
        /\b(?:press\s+release|for\s+immediate\s+release|public\s+advisory|general\s+public\s+notice)\b/i.test(raw) ||
        /\b(?:suspension\s+of\s+classes|class\s+suspension|work\s+suspension|holiday\s+advisory)\b/i.test(lower) ||
        /\b(?:academic\s+calendar|student\s+handbook|commencement\s+program|university\s+manual)\b/i.test(lower) ||
        /\b(?:newsletter|bulletin\s+board|sports\s+festival|job\s+fair|open\s+house|graduation\s+rites)\b/i.test(lower)
    );
    if (isPublicAnnouncement) {
        return constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC;
    }

    // --- TIER 5: Internal Institutional Communications (PRIVATE) ---
    // Memoranda, circulars, and notices addressed to university personnel (College Deans, Department Heads,
    // Faculty Members, Administrative Personnel, Staff, Employees) are internal institutional records.
    const isInternalPersonnelMemo = (
        /\bto\s*:\s*[^\n\r]*(?:all\s+)?(?:college\s+deans|deans|directors|department\s+heads|faculty(?:\s+members?)?|professors|administrative\s+personnel|personnel|staff|employees)/i.test(raw) ||
        /\b(memorandum|circular|office\s+order|special\s+order)\b/i.test(lower) ||
        /\b(meeting\s+minutes|departmental\s+meeting|committee\s+meeting)\b/i.test(lower) ||
        /\b(course\s+syllabus|course\s+outline|curriculum\s+guide|learning\s+plan)\b/i.test(lower) ||
        /\b(purchase\s+requisition|inspection\s+report|inventory\s+list)\b/i.test(lower)
    );
    if (isInternalPersonnelMemo) {
        return constants.DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE;
    }

    return constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED;
}

export function generateContentDrivenSummary(textContent = '', fileName = '') {
    const raw = (textContent || '').replace(/\r\n/g, '\n').trim();
    const cleanName = (fileName || '').replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();

    if (!raw) {
        return `Official institutional record concerning ${cleanName}.`;
    }

    const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Extract structural metadata fields if present
    const extractField = (patterns) => {
        for (const p of patterns) {
            const m = raw.match(p);
            if (m && m[1]?.trim()) return m[1].trim().replace(/\s+/g, ' ');
        }
        return null;
    };

    const subject = extractField([
        // Standard colon/dash delimited: "Subject: ..." or "Subject — ..."
        /^(?:subject|re|title)\s*[:\u2014-]\s*([^\n\r]+)/im,
        /\b(?:subject|re)\s*[:\u2014-]\s*([^\n\r]+)/im,
        // OCR-style: "SUBJECT [space] text" — no colon (line starts with SUBJECT then space)
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

    // A line is a header/meta label ONLY if the keyword is the entire line,
    // or if it's followed immediately by a colon or em-dash (not just any space).
    const isHeaderOrMeta = (str) => {
        const s = str.trim();
        // Exact single-keyword lines (e.g. "MEMORANDUM", "CONFIDENTIAL")
        if (/^(memorandum|circular|notice|confidential|restricted|private|public|department\s+heads|gip\s+and\s+spes\s+supervisors)$/i.test(s)) return true;
        // Keyword followed by colon or em-dash: "Subject:", "From —", "Date:"
        if (/^(to|from|date|subject|re|title|classification|document\s*no|ref\s*no|page\s*\d+|memorandum|circular|notice|office\s+order|special\s+order)\s*[:\u2014-]/i.test(s)) return true;
        // OCR subject/date header without colon: line is ONLY the keyword + value, no verb/body content
        if (/^(SUBJECT|DATE|RE|TITLE)\s+[A-Z0-9]/i.test(s) && s.split(' ').length <= 15) return true;
        return false;
    };

    // Collect all substantive sentences from body text
    // Smart splitter: avoid breaking on common abbreviations (No., Sec., Dept., Gov., etc.)
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
        summarySentences.push(`Official institutional record concerning ${cleanName}.`);
    }

    // Sentence 2: Key substantive directive or finding from body
    const remaining = substantiveSentences.filter(
        s => !summarySentences.some(e => e.includes(s.slice(0, 30))) &&
             !(subject && s.toLowerCase().includes(subject.toLowerCase().slice(0, 30)))
    );
    const directiveSentence = remaining.find(s =>
        /\b(directed|required|mandated|submitted|approved|resolved|evaluated|conducted|established|prohibited|instructed|completed|reviewed|directed|authorized)\b/i.test(s)
    ) || remaining[0];
    if (directiveSentence) {
        summarySentences.push(directiveSentence);
    }

    // Sentence 3: Outcome, deadline, or compliance requirement (only for substantive docs)
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
    const combined = headerBlock ? `${headerBlock}\n\n${bodySummary}` : bodySummary;
    return formatExecutiveSummary(combined);
}

export function generateVersionChangeSummary({
    newText = '',
    newClassification = '',
    previousText = '',
    previousSummary = '',
    previousClassification = '',
    fileName = '',
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
        const m = text.match(/(?:document\s*no\.?|doc\s*no\.?|ref\s*no\.?|memo\s*no\.?)\s*[:—-]\s*([A-Za-z0-9_/]+)/i);
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
        const matches = text.match(/(?:on\s+or\s+before|deadline|due\s+date|effective\s+date|not\s+later\s+than)\s*[:—-]?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/gi) || [];
        return matches.map(m => m.trim());
    };
    const prevDates = extractDates(previousText || previousSummary);
    const newDates = extractDates(newText);
    if (newDates.length > 0 && prevDates.length > 0 && newDates[0] !== prevDates[0]) {
        changes.push(`Updated administrative deadline: changed from "${prevDates[0]}" to "**${newDates[0]}**".`);
    } else if (newDates.length > 0) {
        changes.push(`Established administrative timeline: **${newDates[0]}**.`);
    }

    // 5. Clause-Level Content Diffing (Replaced, Added, Removed)
    const cleanLines = (t) => (t || '')
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map(l => l.trim().replace(/\s+/g, ' '))
        .filter(l => l.length > 25 &&
            !/^(to|from|date|subject|re|classification|document\s*no|ref\s*no|page\s*\d+|memorandum|notice)\s*[:—-]/i.test(l)
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
        changes.push(`Updated ${fileName || 'document'} content and published revision v${nextVersion}.0.`);
    }

    return changes.map(c => `- ${c}`).join('\n\n');
}

// --- AI SERVICE BRIDGE ---
export const aiService = {
    extractDocumentText,

    /**
     * Calls the backend Vertex AI function to analyze an uploaded document or revision.
     * Generates executive summary, security classification, 768-dim vector embedding, and version diffing notes.
     */
    analyzeDocumentFile: async ({
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
        previousText = null,
        nextVersion = null,
        extractedText = null,
    }) => {
        const generateClientFallback = () => {
            const resolvedClassification = determineDocumentClassification(extractedText, fileName);
            const resolvedSummary = generateContentDrivenSummary(extractedText, fileName);
            const resolvedChangeSummary = isVersionUpdate
                ? generateVersionChangeSummary({
                    newText: extractedText || '',
                    newClassification: resolvedClassification,
                    previousText: previousText || '',
                    previousSummary: previousSummary || '',
                    previousClassification: previousClassification || '',
                    fileName: fileName || '',
                    nextVersion: nextVersion || 2,
                })
                : 'Initial file upload';

            return {
                success: false,
                summary: resolvedSummary,
                classification: resolvedClassification,
                changeSummary: resolvedChangeSummary,
                embedding: null,
            };
        };

        if (!functions) {
            console.warn('[aiService] Firebase functions instance not available.');
            return generateClientFallback();
        }

        try {
            const analyzeCallable = httpsCallable(functions, 'analyzeDocumentFile');
            const response = await analyzeCallable({
                storagePath,
                downloadUrl,
                fileBase64,
                mimeType,
                fileName,
                fileSize,
                isVersionUpdate,
                previousStoragePath,
                previousMimeType,
                previousSummary,
                previousClassification,
                nextVersion,
                extractedText,
            });

            let resData = response?.data;
            const explicitClass = determineDocumentClassification(extractedText, fileName);
            const contentSummary = generateContentDrivenSummary(extractedText, fileName);

            // If backend failed or returned canned generic boilerplate, synthesize dynamic content-driven results
            if (!resData || resData.isAIFailed || !resData.summary || resData.summary.includes('Governance memorandum') || resData.summary.includes('Institutional document:')) {
                resData = generateClientFallback();
            } else {
                // Ensure classification strictly honors explicit in-document markings
                if (explicitClass && explicitClass !== constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED) {
                    resData.classification = explicitClass;
                }
                // If backend returned generic summary or boilerplate, use authentic content summary
                if (contentSummary && (resData.summary.includes('Governance memorandum') || resData.summary.includes('Institutional document:') || resData.summary.length < 30)) {
                    resData.summary = contentSummary;
                } else if (extractedText) {
                    const extractedHeader = buildInstitutionalHeaderBlock(extractedText);
                    if (extractedHeader && !resData.summary.includes('SUBJECT:')) {
                        resData.summary = `${extractedHeader}\n\n${resData.summary}`;
                    }
                }
                // For version updates, guarantee explicit changes and replacements are stated
                const badChangeSummary = !resData.changeSummary ||
                    resData.changeSummary.startsWith('Document version updated') ||
                    resData.changeSummary.startsWith('Initial file') ||
                    resData.changeSummary.startsWith('Version') ||
                    resData.changeSummary.length < 20 ||
                    !resData.changeSummary.includes('- ');
                if (isVersionUpdate && badChangeSummary) {
                    resData.changeSummary = generateVersionChangeSummary({
                        newText: extractedText || '',
                        newClassification: resData.classification,
                        previousText: previousText || '',
                        previousSummary: previousSummary || '',
                        previousClassification: previousClassification || '',
                        fileName: fileName || '',
                        nextVersion: nextVersion || 2,
                    });
                }
            }

            if (resData?.summary) {
                resData.summary = formatExecutiveSummary(resData.summary);
            }

            if ((!resData.embedding || !Array.isArray(resData.embedding) || resData.embedding.length === 0) && resData.summary) {
                try {
                    const fallbackEmbedding = await aiService.generateTextEmbedding(`${fileName} ${resData.summary}`);
                    if (fallbackEmbedding && Array.isArray(fallbackEmbedding) && fallbackEmbedding.length > 0) {
                        resData.embedding = fallbackEmbedding;
                    }
                } catch {
                    // Non-fatal
                }
            }
            return resData;
        } catch (error) {
            console.warn('[aiService.analyzeDocumentFile] AI processing error:', error?.message);
            const fallback = generateClientFallback();
            if (fallback?.summary) {
                fallback.summary = formatExecutiveSummary(fallback.summary);
            }
            try {
                const fallbackEmbedding = await aiService.generateTextEmbedding(`${fileName} ${fallback.summary}`);
                if (fallbackEmbedding && Array.isArray(fallbackEmbedding) && fallbackEmbedding.length > 0) {
                    fallback.embedding = fallbackEmbedding;
                }
            } catch {
                // Non-fatal
            }
            return {
                ...fallback,
                error: error?.message,
            };
        }
    },

    /**
     * Synthesizes an executive overview for a folder based on child document records.
     */
    synthesizeFolderSummary: async ({ folderName, childDocuments = [] }) => {
        if (!functions) {
            return {
                success: false,
                summary: `Folder containing ${childDocuments.length} repository items for ${folderName}.`,
            };
        }

        try {
            const synthesizeCallable = httpsCallable(functions, 'synthesizeFolderSummary');
            const response = await synthesizeCallable({
                folderName,
                childDocuments,
            });

            return response?.data || {
                success: false,
                summary: `Folder containing ${childDocuments.length} repository items for ${folderName}.`,
            };
        } catch (error) {
            console.warn('[aiService.synthesizeFolderSummary] Folder synthesis error:', error?.message);
            return {
                success: false,
                error: error?.message,
                summary: `Folder containing ${childDocuments.length} repository items for ${folderName}.`,
            };
        }
    },

    /**
     * Generates a 768-dimensional text embedding for a search query or document string.
     */
    generateTextEmbedding: async (text) => {
        if (!text || typeof text !== 'string' || !text.trim()) {
            return null;
        }

        if (!functions) {
            console.warn('[aiService] Firebase functions instance not available.');
            return null;
        }

        try {
            const embeddingCallable = httpsCallable(functions, 'generateTextEmbedding');
            const response = await embeddingCallable({ text: text.trim() });
            const embedding = response?.data?.embedding;
            if (Array.isArray(embedding) && embedding.length > 0) {
                return embedding;
            }
            return null;
        } catch (error) {
            console.warn('[aiService.generateTextEmbedding] Failed to generate embedding:', error?.message);
            return null;
        }
    },

    /**
     * Computes cosine similarity between two numeric embedding vectors.
     */
    computeCosineSimilarity: (vecA, vecB) => {
        if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecB.length === 0) {
            return 0;
        }
        const len = Math.min(vecA.length, vecB.length);
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < len; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    },

    /**
     * Scans all document versions in Data Connect and populates embeddings for any records where embedding is null/missing.
     */
    backfillMissingEmbeddings: async ({ onProgress } = {}) => {
        const { default: documentService } = await import('./documentService');
        try {
            const allVersions = await documentService.fetchAllDocumentVersions();
            const missingVersions = (allVersions || []).filter(
                (v) => !v.embedding || !Array.isArray(v.embedding) || v.embedding.length === 0
            );

            console.log(`[aiService.backfillMissingEmbeddings] Found ${missingVersions.length} versions with missing embeddings out of ${allVersions.length} total.`);

            let updatedCount = 0;
            const errors = [];

            for (let i = 0; i < missingVersions.length; i++) {
                const version = missingVersions[i];
                const docName = version.document?.name || version.path || 'document';
                onProgress?.({
                    current: i + 1,
                    total: missingVersions.length,
                    fileName: docName,
                });

                const contextParts = [
                    docName,
                    version.summary,
                    version.changeSummary,
                    version.classification,
                ].filter(Boolean);

                const textToEmbed = contextParts.join('. ').trim();
                if (!textToEmbed) continue;

                try {
                    const embedding = await aiService.generateTextEmbedding(textToEmbed);
                    if (embedding && Array.isArray(embedding) && embedding.length > 0) {
                        await documentService.updateDocumentVersion(version.id, {
                            approverId: version.approver?.id ?? null,
                            publisherId: version.publisher?.id ?? null,
                            rejecterId: version.rejecter?.id ?? null,
                            checksum: version.checksum ?? null,
                            path: version.path,
                            sizeBytes: version.sizeBytes,
                            mimeType: version.mimeType,
                            classification: version.classification,
                            changeSummary: version.changeSummary,
                            rejectionReason: version.rejectionReason,
                            summary: version.summary,
                            embedding: embedding,
                            textHash: version.textHash,
                        });
                        updatedCount++;
                        console.log(`[aiService.backfillMissingEmbeddings] Populated ${embedding.length}-dim vector for version ${version.id} (${docName})`);
                    } else {
                        errors.push({ versionId: version.id, error: 'Empty embedding returned from AI' });
                    }
                } catch (verErr) {
                    console.error(`[aiService.backfillMissingEmbeddings] Error on version ${version.id}:`, verErr);
                    errors.push({ versionId: version.id, error: verErr?.message });
                }
            }

            return {
                totalChecked: allVersions.length,
                missingCount: missingVersions.length,
                updatedCount,
                errors,
            };
        } catch (error) {
            console.error('[aiService.backfillMissingEmbeddings] Backfill failed:', error);
            throw error;
        }
    },
    buildInstitutionalHeaderBlock,
    determineDocumentClassification,
    formatExecutiveSummary,
    generateContentDrivenSummary,
    generateVersionChangeSummary,
};

export default aiService;
