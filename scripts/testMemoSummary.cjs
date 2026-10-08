'use strict';

const lines_raw = [
    'MEMORANDUM',
    'DEPARTMENT HEADS',
    'GIP AND SPES SUPERVISORS',
    'ALL GOVERNMENT INTERNSHIP PROGRAM (GIP) AND SPECIAL PROGRAM FOR EMPLOYMENT OF STUDENTS (SPES) BENEFICIARIES',
    'SUBJECT IMPLEMENTATION OF PRESCRIBED TEMPORARY WORK ARRANGEMENTS FOR SPES AND GIP BENEFICIARIES',
    'DATE 10 APRIL 2026',
    'Pursuant to DOLE Memorandum Circular No. 114 series of 2026 all beneficiaries under the Special Program for Employment of Students (SPES) and Government Internship Program (GIP) are required to comply with the work arrangements implemented by their respective offices of assignment.',
    'In relation thereto Executive Order No. PCG 22 series of 2026 issued and signed by the City Mayor serves as the basis for the implementation of work arrangements within the City Government of Pasig.',
    'Under this Executive Order a temporary compressed four-day workweek is adopted as the standard work arrangement for City Government offices.',
    'Accordingly all SPES and GIP beneficiaries assigned in the City Government of Pasig are directed to observe the same work arrangement as follows:',
    'Workdays shall be from Monday to Thursday from 7:00 AM to 6:00 PM. The rendering of overtime work is strictly prohibited under this arrangement.',
    'SPES and GIP beneficiaries assigned to national government agencies shall comply with the respective work arrangements prescribed by their host agencies.',
    'All such offices are required to formally notify the Public Employment Service Office (PESO) by submitting a written communication indicating their adopted work schedule for proper coordination and monitoring.',
];

const raw = lines_raw.join('\n');

const extractField = (patterns) => {
    for (const p of patterns) {
        const m = raw.match(p);
        if (m && m[1] && m[1].trim()) return m[1].trim().replace(/\s+/g, ' ');
    }
    return null;
};

const subject = extractField([
    /^(?:subject|re|title)\s*[:\u2014\-]\s*([^\n\r]+)/im,
    /\b(?:subject|re)\s*[:\u2014\-]\s*([^\n\r]+)/im,
    /^SUBJECT\s+([^\n\r]{10,})/im,
]);
const issuingOffice = extractField([
    /^(?:from|issued\s+by|office\s+of\s+the)\s*[:\u2014\-]\s*([^\n\r]+)/im,
]);
const recipient = extractField([
    /^(?:to|attention|for|memorandum\s+for)\s*[:\u2014\-]\s*([^\n\r]+)/im,
]);
const deadline = extractField([
    /(?:on\s+or\s+before|deadline|due\s+date|effective\s+date|not\s+later\s+than)\s*[:\u2014\-]?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
]);

console.log('--- EXTRACTED HEADER FIELDS ---');
console.log('subject      :', subject);
console.log('issuingOffice:', issuingOffice);
console.log('recipient    :', recipient);
console.log('deadline     :', deadline);

const lower = raw.toLowerCase();
let classification = 'UNCLASSIFIED';
if (/\bclassification\s*:\s*confidential\b/i.test(raw) || /\bfor\s+authorized\s+personnel\s+only\b/i.test(raw)) {
    classification = 'CONFIDENTIAL';
} else if (/\bclassification\s*:\s*restricted\b/i.test(raw)) {
    classification = 'RESTRICTED';
} else if (/\b(memorandum|circular|office\s+order|special\s+order)\b/i.test(lower)) {
    classification = 'PRIVATE';
}
console.log('classification:', classification);

const isHeaderOrMeta = (str) =>
    /^(to|from|date|subject|re|classification|document\s*no|ref\s*no|page\s*\d+|memorandum|circular|notice|office\s+order|special\s+order)\s*[:\u2014\-]/i.test(str) ||
    /^(memorandum|circular|notice|confidential|restricted|private|public)$/i.test(str);

const substantiveSentences = [];
for (const line of lines_raw) {
    const l = line.trim();
    if (isHeaderOrMeta(l)) continue;
    if (l.length < 20) continue;
    const parts = l.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [l];
    for (let p of parts) {
        let s = p.trim().replace(/\s+/g, ' ');
        if (s.length >= 20 && !isHeaderOrMeta(s)) {
            if (!/[.!?]$/.test(s)) s += '.';
            substantiveSentences.push(s);
        }
    }
}

const summarySentences = [];

if (subject && issuingOffice) {
    const toClause = recipient ? ` to ${recipient}` : '';
    summarySentences.push(`Official memorandum issued by ${issuingOffice}${toClause} regarding ${subject}.`);
} else if (subject) {
    summarySentences.push(`Official institutional documentation addressing ${subject}.`);
} else if (substantiveSentences.length > 0) {
    summarySentences.push(substantiveSentences[0]);
} else {
    summarySentences.push('Official institutional record.');
}

const remaining = substantiveSentences.filter(
    s => !summarySentences.some(e => e.includes(s.slice(0, 30)))
);
const directiveSentence = remaining.find(s =>
    /\b(directed|required|mandated|submitted|approved|resolved|evaluated|conducted|established|prohibited|instructed|completed|reviewed|authorized)\b/i.test(s)
) || remaining[0];
if (directiveSentence) summarySentences.push(directiveSentence);

if (raw.length > 300 && summarySentences.length === 2) {
    if (deadline) {
        summarySentences.push(`Establishes an official compliance deadline on or before ${deadline} for all concerned personnel.`);
    } else {
        const outcomeSentence = remaining.find(s =>
            s !== directiveSentence &&
            /\b(compliance|strict|effective|schedule|implementation|penalty|enforce|maintain|archived|authoritative|records|submitted|submission)\b/i.test(s)
        );
        if (outcomeSentence) summarySentences.push(outcomeSentence);
    }
}

const finalSummary = summarySentences.slice(0, 3).map(s => {
    let c = s.trim();
    if (!/[.!?]$/.test(c)) c += '.';
    return c;
}).join('\n\n');

console.log('\n--- GENERATED SUMMARY ---');
console.log(finalSummary);
console.log('\n--- ALL SUBSTANTIVE SENTENCES FOUND ---');
substantiveSentences.forEach((s, i) => console.log(`  [${i}] ${s}`));
