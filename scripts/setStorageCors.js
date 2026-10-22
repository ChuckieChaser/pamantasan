// --- IMPORTS ---
import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---
const BUCKET_NAME = 'pamantasan-records-210fe.firebasestorage.app';

async function setStorageCors() {
    console.log(`\nConfiguring CORS for Firebase Cloud Storage bucket: ${BUCKET_NAME}...`);

    const configPath = path.join(process.env.USERPROFILE || process.env.HOME || '', '.config', 'configstore', 'firebase-tools.json');
    if (!fs.existsSync(configPath)) {
        throw new Error(`Firebase CLI credentials not found at "${configPath}". Please run "npx firebase login" first.`);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    let accessToken = config.tokens?.access_token;
    const refreshToken = config.tokens?.refresh_token;

    // Refresh token if needed
    if (!accessToken && refreshToken) {
        console.log('Refreshing Google Cloud access token...');
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho859e1.apps.googleusercontent.com',
            }),
        });
        const tokenData = await tokenRes.json();
        accessToken = tokenData.access_token;
    }

    if (!accessToken) {
        throw new Error('Could not obtain an access token. Please run "npx firebase login" first.');
    }

    const corsPath = path.resolve('cors.json');
    let corsConfig;
    if (fs.existsSync(corsPath)) {
        corsConfig = JSON.parse(fs.readFileSync(corsPath, 'utf8'));
    } else {
        corsConfig = [
            {
                origin: [
                    'http://localhost:5173',
                    'http://localhost:4173',
                    'https://pamantasan-records-210fe.web.app',
                    'https://pamantasan-records-210fe.firebaseapp.com',
                    '*',
                ],
                method: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD', 'OPTIONS'],
                responseHeader: ['*'],
                maxAgeSeconds: 3600,
            },
        ];
    }

    const response = await fetch(`https://storage.googleapis.com/storage/v1/b/${BUCKET_NAME}?fields=cors,name`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cors: corsConfig }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Cloud Storage API returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log(`[PASS] Storage bucket CORS updated successfully for "${result.name}"!`);
    console.log('Active CORS rules:', JSON.stringify(result.cors, null, 2));
}

setStorageCors().catch((err) => {
    console.error('[FAIL] Error setting storage CORS:', err.message);
    process.exit(1);
});
