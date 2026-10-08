
function generateVersionChangeSummary({
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
        changes.push(`Secured under **CONFIDENTIAL** handling protocols (access restricted to authorized personnel).`);
    } else if (newClassification && newClassification !== 'UNCLASSIFIED') {
        changes.push(`Maintained **${newClassification}** institutional security status.`);
    }

    // 2. Subject Matter & Title Changes
    const extractSubject = (text = '') => {
        if (!text) return null;
        const match = text.match(/(?:subject|re|title)\s*[:—\-]\s*([^\n\r.]+)/i);
        if (match) return match[1].trim();
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

    // 3. Document Identifier / Reference Number
    const extractDocNo = (text = '') => {
        const m = text.match(/(?:document\s*no\.?|doc\s*no\.?|ref\s*no\.?|memo\s*no\.?)\s*[:—\-]\s*([A-Za-z0-9-_/]+)/i);
        return m ? m[1].trim() : null;
    };
    const prevDocNo = extractDocNo(previousText || previousSummary);
    const newDocNo = extractDocNo(newText);
    if (newDocNo && prevDocNo && newDocNo !== prevDocNo) {
        changes.push(`Replaced reference identifier: updated from **${prevDocNo}** to **${newDocNo}**.`);
    } else if (newDocNo) {
        changes.push(`Designated reference identifier: **${newDocNo}**.`);
    }

    // 4. Deadlines, Effective Dates & Timelines
    const extractDates = (text = '') => {
        const matches = text.match(/(?:on\s+or\s+before|deadline|due\s+date|effective\s+date|not\s+later\s+than)\s*[:—\-]?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/gi) || [];
        return matches.map(m => m.trim());
    };
    const prevDates = extractDates(previousText || previousSummary);
    const newDates = extractDates(newText);
    if (newDates.length > 0 && prevDates.length > 0 && newDates[0] !== prevDates[0]) {
        changes.push(`Updated administrative deadline: changed from "${prevDates[0]}" to "**${newDates[0]}**".`);
    } else if (newDates.length > 0) {
        changes.push(`Established administrative timeline: **${newDates[0]}**.`);
    }

    // 5. Line-by-Line Substantive Content Diffing (Clauses Replaced, Added, or Removed)
    const cleanLines = (t) => t
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map(l => l.trim().replace(/\s+/g, ' '))
        .filter(l => l.length > 25 && !/^(to|from|date|subject|re|classification|document\s*no|ref\s*no|page\s*\d+|memorandum|notice)\s*[:—\-]/i.test(l));

    const oldLines = cleanLines(previousText || previousSummary);
    const newLines = cleanLines(newText);

    if (newLines.length > 0 && oldLines.length > 0) {
        const replacedList = [];
        const addedList = [];

        for (const nLine of newLines) {
            const nKey = nLine.toLowerCase().slice(0, 35);
            // Check if exact match
            const exact = oldLines.some(o => o.toLowerCase() === nLine.toLowerCase());
            if (exact) continue;

            // Check if it replaces an old line (similar starting topic or prefix)
            const nPrefix = nLine.toLowerCase().split(/\s+/).slice(0, 4).join(' ');
            const oldMatch = oldLines.find(o => {
                const oPrefix = o.toLowerCase().split(/\s+/).slice(0, 4).join(' ');
                return nPrefix.length > 15 && oPrefix === nPrefix && o !== nLine;
            });

            if (oldMatch) {
                replacedList.push({ old: oldMatch, new: nLine });
            } else if (!oldLines.some(o => o.toLowerCase().includes(nKey) || nLine.toLowerCase().includes(o.toLowerCase().slice(0, 35)))) {
                addedList.push(nLine);
            }
        }

        // Add replaced clauses
        for (const r of replacedList.slice(0, 2)) {
            const oldSnip = r.old.length > 90 ? `${r.old.slice(0, 90)}...` : r.old;
            const newSnip = r.new.length > 90 ? `${r.new.slice(0, 90)}...` : r.new;
            changes.push(`Replaced previous clause: "${oldSnip}" with updated directive: "**${newSnip}**".`);
        }

        // Add newly added substantive clauses
        for (const a of addedList.slice(0, 2)) {
            const snip = a.length > 100 ? `${a.slice(0, 100)}...` : a;
            changes.push(`Added new provision: "${snip}".`);
        }
    } else if (newLines.length > 0 && oldLines.length === 0) {
        // If prior text was empty, describe key newly introduced provisions
        for (const a of newLines.slice(0, 2)) {
            const snip = a.length > 100 ? `${a.slice(0, 100)}...` : a;
            changes.push(`Incorporated substantive directive: "${snip}".`);
        }
    }

    if (changes.length === 0) {
        changes.push(`Updated ${fileName || 'document'} content and published revision v${nextVersion}.0.`);
    }

    return changes.map(c => `- ${c}`).join('\n\n');
}

const v1 = `MEMORANDUM
TO: All Faculty
FROM: Dean of Computer Studies
DATE: September 1, 2026
SUBJECT: Submission of Midterm Exam Questions

All faculty members are required to submit midterm examination drafts on or before September 15, 2026.
Examinations must follow the standard departmental template and include answer keys.
Submissions must be emailed to the department coordinator.`;

const v2 = `MEMORANDUM
TO: All Faculty
FROM: Dean of Computer Studies
DATE: September 20, 2026
SUBJECT: Submission of Final Exam Questions and Rubrics

All faculty members are required to submit final examination drafts and project rubrics on or before October 25, 2026.
Examinations must follow the standard departmental template and include answer keys.
Submissions must be uploaded to the Records Management portal for institutional archiving.
Strict compliance is required. Reproduction of exam questions is prohibited.`;

console.log('=== VERSION CHANGE SUMMARY ===');
console.log(generateVersionChangeSummary({
    newText: v2,
    newClassification: 'PRIVATE',
    previousText: v1,
    previousClassification: 'PRIVATE',
    fileName: 'memo.docx',
    nextVersion: 2,
}));
