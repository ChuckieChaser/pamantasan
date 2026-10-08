// Test content-driven summarization engine

function generateContentDrivenSummary(textContent = '', fileName = '') {
    const raw = (textContent || '').replace(/\r\n/g, '\n').trim();
    const cleanName = (fileName || '').replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();

    if (!raw) {
        return `Official institutional record concerning ${cleanName}.`;
    }

    const lines = raw.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

    // 1. Extract structural metadata if present
    const extractField = (patterns) => {
        for (const p of patterns) {
            const m = raw.match(p);
            if (m && m[1]?.trim()) return m[1].trim().replace(/\s+/g, ' ');
        }
        return null;
    };

    const subject = extractField([
        /^(?:subject|re|title)\s*[:—\-]\s*([^\n\r]+)/im,
        /\b(?:subject|re)\s*[:—\-]\s*([^\n\r]+)/im,
    ]);

    const issuingOffice = extractField([
        /^(?:from|issued\s+by|office\s+of\s+the|office)\s*[:—\-]\s*([^\n\r]+)/im,
        /\b(?:office\s+of\s+the\s+[A-Za-z\s]+)/i,
    ]);

    const recipient = extractField([
        /^(?:to|attention|for|memorandum\s+for)\s*[:—\-]\s*([^\n\r]+)/im,
    ]);

    const deadline = extractField([
        /(?:on\s+or\s+before|deadline|due\s+date|effective\s+date|not\s+later\s+than)\s*[:—\-]?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
    ]);

    // 2. Identify substantive sentences from body text
    const isHeaderOrMeta = (str) => {
        return /^(to|from|date|subject|re|classification|document\s*no|ref\s*no|page\s*\d+|memorandum|confidential|restricted|private|public)\s*[:—\-]/i.test(str) ||
               /^(memorandum|circular|notice|office\s+order|special\s+order)$/i.test(str) ||
               /^(office\s+of\s+the\s+[a-z\s]+)$/i.test(str) ||
               /^(strictly\s+confidential|for\s+authorized\s+personnel\s+only)$/i.test(str);
    };

    const substantiveSentences = [];
    for (const line of lines) {
        if (isHeaderOrMeta(line)) continue;
        if (line.length < 25) continue;
        // Split line into sentences if multiple sentences exist
        const parts = line.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [line];
        for (let p of parts) {
            let s = p.trim().replace(/\s+/g, ' ');
            if (s.length >= 25 && !isHeaderOrMeta(s)) {
                if (!/[.!?]$/.test(s)) s += '.';
                substantiveSentences.push(s);
            }
        }
    }

    // 3. Synthesize dynamic, content-judged executive summary
    const summarySentences = [];

    // Sentence 1: Authority & Subject context
    if (subject && issuingOffice) {
        const toClause = recipient ? ` to ${recipient}` : '';
        summarySentences.push(`Official memorandum issued by ${issuingOffice}${toClause} regarding ${subject}.`);
    } else if (subject) {
        summarySentences.push(`Official institutional documentation addressing ${subject}.`);
    } else if (substantiveSentences.length > 0) {
        // Clean first substantive sentence to serve as subject sentence
        summarySentences.push(substantiveSentences[0]);
    } else {
        summarySentences.push(`Official institutional record concerning ${cleanName}.`);
    }

    // Sentence 2: Key substantive directive / finding / body point
    const remainingSentences = substantiveSentences.filter(s => !summarySentences.some(existing => existing.includes(s.slice(0, 30))));
    if (remainingSentences.length > 0) {
        // Pick the most informative sentence containing action words or data
        const directiveSentence = remainingSentences.find(s => 
            /\b(directed|required|mandated|submitted|approved|resolved|evaluated|conducted|established|prohibited|instructed|completed|reviewed)\b/i.test(s)
        ) || remainingSentences[0];

        if (directiveSentence) {
            summarySentences.push(directiveSentence);
        }
    }

    // Sentence 3: Outcome, deadline, or compliance requirement (only if document is multi-sentence / substantive)
    if (raw.length > 300 && summarySentences.length === 2) {
        if (deadline) {
            summarySentences.push(`Establishes an official compliance deadline on or before ${deadline} for all concerned personnel.`);
        } else {
            const outcomeSentence = remainingSentences.find(s => 
                s !== summarySentences[1] &&
                /\b(compliance|strict|effective|timeline|schedule|implementation|penalty|enforce|maintain|archived|authoritative|records)\b/i.test(s)
            );
            if (outcomeSentence) {
                summarySentences.push(outcomeSentence);
            }
        }
    }

    // Never exceed 3 sentences
    const finalSentences = summarySentences.slice(0, 3).map(s => {
        let clean = s.trim();
        if (!/[.!?]$/.test(clean)) clean += '.';
        return clean;
    });

    return finalSentences.join('\n\n');
}

// Test case: Memorandum
const sampleMemo = `MEMORANDUM
TO: All Department Heads and Academic Deans
FROM: Office of the University President
DATE: September 29, 2026
SUBJECT: Annual Academic Program Review and Submission of Curricular Proposals

All academic deans and department heads are hereby directed to submit comprehensive evaluation reports of their existing degree programs. Proposed curriculum revisions for the upcoming academic year must align with CHED Memorandum Orders and incorporate industry advisory council recommendations.

Submissions must be finalized on or before October 31, 2026 for Board of Regents deliberation. Strict administrative compliance is expected.`;

console.log('=== MEMO SUMMARY ===');
console.log(generateContentDrivenSummary(sampleMemo, 'memo.docx'));
