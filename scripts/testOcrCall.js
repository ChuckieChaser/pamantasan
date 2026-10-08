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

async function testOcr() {
    const app = initializeApp(firebaseConfig, 'ocr-test-app');
    const functions = getFunctions(app, 'asia-southeast1');
    try {
        const fn = httpsCallable(functions, 'extractTextFromImage');
        // 1x1 png base64
        const dummyBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        const res = await fn({ imageBase64: dummyBase64 });
        console.log('OCR Result:', res.data);
    } catch (e) {
        console.error('OCR Error:', e.code, e.message);
    }
}
testOcr();
