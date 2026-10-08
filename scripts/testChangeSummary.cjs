// Test version change summary algorithm
function diffSentences(oldText = '', newText = '') {
    const cleanLines = (t) => t
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 20 && !/^(to:|from:|date:|subject:|classification:|document no)/i.test(l));

    const oldLines = cleanLines(oldText);
    const newLines = cleanLines(newText);

    const added = [];
    const replaced = [];
    const removed = [];

    // Check for replacements and additions
    for (const nLine of newLines) {
        // Look for similar old line (e.g., same starting words or high overlap)
        const nWords = nLine.toLowerCase().split(/\s+/).slice(0, 4).join(' ');
        const matchingOld = oldLines.find(oLine => {
            const oWords = oLine.toLowerCase().split(/\s+/).slice(0, 4).join(' ');
            return nWords === oWords && oLine !== nLine;
        });

        if (matchingOld) {
            replaced.push({ old: matchingOld, new: nLine });
        } else if (!oldLines.some(o => o.toLowerCase() === nLine.toLowerCase() || o.includes(nLine) || nLine.includes(o))) {
            added.push(nLine);
        }
    }

    // Check for removed lines
    for (const oLine of oldLines) {
        const oWords = oLine.toLowerCase().split(/\s+/).slice(0, 4).join(' ');
        const matched = newLines.some(nLine => {
            const nWords = nLine.toLowerCase().split(/\s+/).slice(0, 4).join(' ');
            return nWords === oWords || nLine.toLowerCase() === oLine.toLowerCase();
        });
        if (!matched && !replaced.some(r => r.old === oLine)) {
            removed.push(oLine);
        }
    }

    return { added, replaced, removed };
}

const v1 = `MEMORANDUM
TO: All Faculty
FROM: Dean of Computer Studies
DATE: September 1, 2026
SUBJECT: Submission of Midterm Exam Questions

All faculty members are required to submit midterm examination drafts on or before September 15, 2026.
Examinations must follow the standard departmental template and include answer keys.
Submission must be made via email to the department secretary.`;

const v2 = `MEMORANDUM
TO: All Faculty
FROM: Dean of Computer Studies
DATE: September 20, 2026
SUBJECT: Submission of Final Exam Questions and Project Rubrics

All faculty members are required to submit final examination drafts and project rubrics on or before October 25, 2026.
Examinations must follow the standard departmental template and include answer keys.
Submission must be uploaded directly to the Pamantasan Records Portal for institutional archiving.
Strict compliance is required. Unauthorized distribution of exam questionnaires is strictly prohibited.`;

const diff = diffSentences(v1, v2);
console.log('Diff result:', JSON.stringify(diff, null, 2));
