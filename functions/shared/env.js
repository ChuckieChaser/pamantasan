// --- ENV LOADER ---
// Fallback env reader for local development.
// In production Cloud Functions, env vars are injected by Firebase secrets.

const fs = require('fs');
const path = require('path');

let loaded = false;

const loadEnv = () => {
    if (loaded) return;
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        loaded = true;
        return;
    }

    const candidates = [
        path.resolve(__dirname, '../.env'),
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), 'functions/.env'),
    ];

    for (const envPath of candidates) {
        if (!fs.existsSync(envPath)) continue;

        try {
            const content = fs.readFileSync(envPath, 'utf8');
            for (const line of content.split(/\r?\n/)) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;

                const eqIdx = trimmed.indexOf('=');
                if (eqIdx === -1) continue;

                const key = trimmed.substring(0, eqIdx).trim();
                let val = trimmed.substring(eqIdx + 1).trim();

                if (
                    (val.startsWith('"') && val.endsWith('"')) ||
                    (val.startsWith("'") && val.endsWith("'"))
                ) {
                    val = val.substring(1, val.length - 1);
                }

                if (!process.env[key]) {
                    process.env[key] = val;
                }
            }

            if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) break;
        } catch {
            // Ignore filesystem read errors in restricted environments
        }
    }

    loaded = true;
};

module.exports = { loadEnv };
