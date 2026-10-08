const { analyzeDocumentFile } = require('./functions/services/aiService');

async function testDirect() {
    const textContent = "MEMORANDUM\nTO: All Department Heads\nFROM: Office of the University President\nDATE: September 29, 2026\nSUBJECT: Annual Academic Program Review and Submission of Curricular Proposals\n\nAll academic deans and department heads are hereby directed to submit comprehensive evaluation reports of their existing degree programs on or before October 31, 2026. Proposed curriculum revisions for the upcoming academic year must align with CHED Memorandum Orders and incorporate industry advisory council recommendations.\n\nStrict compliance is expected.";
    
    console.log('Testing analyzeDocumentFile directly...');
    const result = await analyzeDocumentFile({
        fileName: 'sample-memorandum.txt',
        fileBase64: Buffer.from(textContent).toString('base64'),
        mimeType: 'text/plain',
        fileSize: textContent.length,
        extractedText: textContent,
        isVersionUpdate: false,
    });
    console.log('Direct Result:', JSON.stringify(result, null, 2));
}

testDirect().catch(console.error);
