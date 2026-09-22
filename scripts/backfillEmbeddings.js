// --- IMPORTS ---
import { initializeApp } from 'firebase/app';
import { getDataConnect, queryRef, mutationRef, executeQuery, executeMutation } from 'firebase/data-connect';

// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: 'AIzaSyB9sGybhkzstxlzb07HojVcb26lroIQ1sU',
    authDomain: 'pamantasan-records-210fe.firebaseapp.com',
    projectId: 'pamantasan-records-210fe',
    storageBucket: 'pamantasan-records-210fe.firebasestorage.app',
    messagingSenderId: '673717882853',
    appId: '1:673717882853:web:eac72c2d8a60e1cc1c690c',
};

async function fetchEmbeddingFromCloudFunction(text) {
    const response = await fetch('https://asia-southeast1-pamantasan-records-210fe.cloudfunctions.net/generateTextEmbedding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { text } }),
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data?.result?.embedding || null;
}

async function main() {
    console.log('\n========================================================');
    console.log('   PAMANTASAN RECORDS — BACKFILL VECTOR EMBEDDINGS      ');
    console.log('========================================================\n');

    const app = initializeApp(firebaseConfig, `backfill-${Date.now()}`);
    const dataConnect = getDataConnect(app, {
        service: 'pamantasan-records-210fe-service',
        location: 'asia-southeast1',
        connector: 'default',
    });

    console.log('[1/3] Fetching all DocumentVersion records from Data Connect...');
    const fetchVersionsRef = queryRef(dataConnect, 'FetchAllDocumentVersions');
    const fetchRes = await executeQuery(fetchVersionsRef);
    const versions = fetchRes?.data?.documentVersions || [];

    console.log(`Found ${versions.length} total DocumentVersion records.`);

    const missing = versions.filter(v => !v.embedding || !Array.isArray(v.embedding) || v.embedding.length === 0);
    console.log(`Found ${missing.length} records with NULL or empty embeddings:\n`);

    if (missing.length === 0) {
        console.log('\nAll DocumentVersion records already have embeddings populated! Nothing to do.');
        return;
    }

    console.log('\n[2/3] Generating embeddings via Cloud Function & updating Data Connect...');
    let successCount = 0;

    for (let i = 0; i < missing.length; i++) {
        const v = missing[i];
        const docName = v.document?.name || v.path.split('/').pop();
        const textParts = [
            docName,
            v.summary,
            v.changeSummary,
            v.classification,
        ].filter(Boolean);

        const textToEmbed = textParts.join('. ').trim();
        console.log(`\n[${i + 1}/${missing.length}] Processing: "${docName}" (ID: ${v.id})`);

        let embeddingValues = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                embeddingValues = await fetchEmbeddingFromCloudFunction(textToEmbed);
                if (embeddingValues && Array.isArray(embeddingValues) && embeddingValues.length > 0) {
                    break;
                }
                console.warn(`       [RETRY] Attempt ${attempt} returned empty embedding. Waiting 3s...`);
                await new Promise(r => setTimeout(r, 3000));
            } catch (err) {
                console.warn(`       [RETRY] Attempt ${attempt} error: ${err.message}. Waiting 3s...`);
                await new Promise(r => setTimeout(r, 3000));
            }
        }

        if (!embeddingValues || !Array.isArray(embeddingValues) || embeddingValues.length === 0) {
            console.error(`       [FAILED] Could not get embedding after 3 attempts.`);
            continue;
        }

        try {
            const updateRef = mutationRef(dataConnect, 'UpdateDocumentVersion', {
                id: v.id,
                approverId: v.approver?.id ?? null,
                publisherId: v.publisher?.id ?? null,
                rejecterId: v.rejecter?.id ?? null,
                checksum: v.checksum ?? null,
                path: v.path,
                sizeBytes: v.sizeBytes,
                mimeType: v.mimeType,
                classification: v.classification,
                changeSummary: v.changeSummary,
                rejectionReason: v.rejectionReason,
                summary: v.summary,
                embedding: embeddingValues,
                textHash: v.textHash,
            });

            await executeMutation(updateRef);
            console.log(`       [SUCCESS] Updated with ${embeddingValues.length}-dim vector embedding.`);
            successCount++;
        } catch (err) {
            console.error(`       [ERROR] Failed to update Data Connect for ${v.id}:`, err.message || err);
        }

        // Polite delay between items to avoid bursting rate limits
        await new Promise(r => setTimeout(r, 1200));
    }

    console.log('\n========================================================');
    console.log(`[3/3] Backfill Summary: ${successCount} of ${missing.length} records updated!`);
    console.log('========================================================\n');
}

main().catch(err => {
    console.error('Fatal error in backfill script:', err);
    process.exit(1);
});
