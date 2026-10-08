// Test PDF text extractor logic
const zlib = require('zlib');

function extractTextFromPdfBuffer(buffer) {
    if (!buffer || buffer.length === 0) return '';
    const textPieces = [];
    const latin1 = buffer.toString('latin1');

    // 1. Look for stream ... endstream blocks
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match;

    while ((match = streamRegex.exec(latin1)) !== null) {
        const streamData = match[1];
        let content = '';

        // Try decompressing with zlib (FlateDecode)
        try {
            const decompressed = zlib.inflateSync(Buffer.from(streamData, 'latin1'));
            content = decompressed.toString('utf-8');
        } catch {
            try {
                const decompressedRaw = zlib.inflateRawSync(Buffer.from(streamData, 'latin1'));
                content = decompressedRaw.toString('utf-8');
            } catch {
                content = streamData;
            }
        }

        // Extract text from text blocks: BT ... ET
        const btRegex = /BT([\s\S]*?)ET/g;
        let btMatch;
        while ((btMatch = btRegex.exec(content)) !== null) {
            const btContent = btMatch[1];
            // Extract from Tj: (text) Tj
            const tjRegex = /\((.*?)\)\s*Tj/g;
            let tjMatch;
            while ((tjMatch = tjRegex.exec(btContent)) !== null) {
                const clean = tjMatch[1].replace(/\\([\\()])/g, '$1');
                if (clean.trim()) textPieces.push(clean.trim());
            }

            // Extract from TJ: [(t1) 120 (t2)] TJ
            const arrayRegex = /\[(.*?)\]\s*TJ/g;
            let arrMatch;
            while ((arrMatch = arrayRegex.exec(btContent)) !== null) {
                const inner = arrMatch[1];
                const strParts = inner.match(/\((.*?)\)/g) || [];
                const joined = strParts.map(s => s.slice(1, -1).replace(/\\([\\()])/g, '$1')).join('');
                if (joined.trim()) textPieces.push(joined.trim());
            }
        }
    }

    return textPieces.join(' ');
}

console.log('PDF text extractor function created');
