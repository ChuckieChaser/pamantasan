import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Check possible Python virtualenv executables
const winVenvPy = path.join(rootDir, '.venv', 'Scripts', 'python.exe');
const unixVenvPy = path.join(rootDir, '.venv', 'bin', 'python');
const scriptPath = path.join(rootDir, 'scripts', 'ocr_service.py');

let pythonBin = 'python';
if (fs.existsSync(winVenvPy)) {
    pythonBin = winVenvPy;
} else if (fs.existsSync(unixVenvPy)) {
    pythonBin = unixVenvPy;
}

console.log(`[Pamantasan OCR] Launching PaddleOCR service with: ${pythonBin}`);
const child = spawn(pythonBin, [scriptPath], {
    cwd: rootDir,
    stdio: 'inherit',
});

child.on('error', (err) => {
    console.error('[Pamantasan OCR] Failed to start OCR microservice:', err);
});

child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
        console.error(`[Pamantasan OCR] Process exited with code ${code}`);
    }
});
