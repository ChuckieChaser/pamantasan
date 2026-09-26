// --- DATA CONNECT ADMIN CONNECTOR ---
const admin = require('firebase-admin');

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.PROJECT_ID || 'pamantasan-records-210fe';
const LOCATION = 'asia-southeast1';
const SERVICE_ID = 'pamantasan-records-210fe-service';
const CONNECTOR = 'default';

/**
 * Executes an administrative GraphQL query or mutation against Firebase Data Connect.
 * Uses Google Application Default Credentials or the local emulator.
 * @param {string} query - GraphQL query/mutation document.
 * @param {object} variables - Variables dictionary.
 * @returns {Promise<object>} Result data.
 */
const executeAdminGraphql = async (query, variables = {}) => {
    // 1. Check for local emulator
    const emulatorHost = process.env.FIREBASE_DATACONNECT_EMULATOR_HOST;
    if (emulatorHost) {
        const url = `http://${emulatorHost}/v1beta/projects/${PROJECT_ID}/locations/${LOCATION}/services/${SERVICE_ID}/connectors/${CONNECTOR}:executeGraphql`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables }),
        });
        const json = await res.json();
        if (json.errors && json.errors.length > 0) {
            throw new Error(`Data Connect error: ${json.errors[0].message}`);
        }
        return json.data;
    }

    // 2. Production: Use Google Cloud service account access token
    let accessToken;
    try {
        if (admin.app()?.options?.credential?.getAccessToken) {
            const tokenObj = await admin.app().options.credential.getAccessToken();
            accessToken = tokenObj?.access_token;
        }
    } catch {
        // Fallback for cloud function environment
    }

    if (!accessToken) {
        try {
            const { GoogleAuth } = require('google-auth-library');
            const auth = new GoogleAuth({
                scopes: ['https://www.googleapis.com/auth/cloud-platform'],
            });
            const client = await auth.getClient();
            const tokenRes = await client.getAccessToken();
            accessToken = tokenRes?.token;
        } catch (err) {
            console.error('[executeAdminGraphql] Failed to acquire Google access token:', err);
        }
    }

    const url = `https://firebasedataconnect.googleapis.com/v1beta/projects/${PROJECT_ID}/locations/${LOCATION}/services/${SERVICE_ID}/connectors/${CONNECTOR}:executeGraphql`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Data Connect request failed (${response.status}): ${errText}`);
    }

    const result = await response.json();
    if (result.errors && result.errors.length > 0) {
        throw new Error(`Data Connect error: ${result.errors[0].message}`);
    }

    return result.data;
};

module.exports = { executeAdminGraphql };
