import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

const firebaseConfig = {
    apiKey: 'AIzaSyB9sGybhkzstxlzb07HojVcb26lroIQ1sU',
    authDomain: 'pamantasan-records-210fe.firebaseapp.com',
    projectId: 'pamantasan-records-210fe',
    storageBucket: 'pamantasan-records-210fe.firebasestorage.app',
    messagingSenderId: '673717882853',
    appId: '1:673717882853:web:eac72c2d8a60e1cc1c690c',
};

async function test() {
    const app = initializeApp(firebaseConfig, 'test-app');
    const functions = getFunctions(app, 'asia-southeast1');
    console.log('Calling analyzeDocumentFile with base64...');
    try {
        const fn = httpsCallable(functions, 'analyzeDocumentFile');
        const textContent = "MEMORANDUM\nTO: All Department Heads\nFROM: Office of the University President\nDATE: September 29, 2026\nSUBJECT: Annual Academic Program Review and Submission of Curricular Proposals\n\nAll academic deans and department heads are hereby directed to submit comprehensive evaluation reports of their existing degree programs on or before October 31, 2026. Proposed curriculum revisions for the upcoming academic year must align with CHED Memorandum Orders and incorporate industry advisory council recommendations.\n\nStrict compliance is expected.";
        const res = await fn({
            fileName: 'sample-memorandum.txt',
            fileBase64: Buffer.from(textContent).toString('base64'),
            mimeType: 'text/plain',
            fileSize: textContent.length,
            extractedText: textContent,
            isVersionUpdate: false,
        });
        console.log('Result:', JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.error('Call failed with code:', err.code, 'message:', err.message, 'details:', err.details);
    }
}

test();
