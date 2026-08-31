import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AVATAR_SPECS = [
    { name: 'manny', color1: '#059669', color2: '#065f46', initial: 'A' },
    { name: 'bugs', color1: '#0284c7', color2: '#0369a1', initial: 'C' },
    { name: 'jerry', color1: '#7c3aed', color2: '#5b21b6', initial: 'D' },
    { name: 'johnny', color1: '#d97706', color2: '#b45309', initial: 'O' },
    { name: 'mort', color1: '#475569', color2: '#334155', initial: 'M' },
    { name: 'sid', color1: '#e11d48', color2: '#be123c', initial: 'H' },
    { name: 'kowalski', color1: '#0d9488', color2: '#115e59', initial: 'H' },
];

const targetDir = path.join(__dirname, '..', 'public', 'avatars');

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

for (const spec of AVATAR_SPECS) {
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <linearGradient id="grad-${spec.name}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${spec.color1}" />
      <stop offset="100%" stop-color="${spec.color2}" />
    </linearGradient>
  </defs>
  <rect width="120" height="120" rx="60" fill="url(#grad-${spec.name})" />
  <circle cx="60" cy="45" r="20" fill="#ffffff" opacity="0.92" />
  <path d="M26 100 C26 76 42 66 60 66 C78 66 94 76 94 100 Z" fill="#ffffff" opacity="0.92" />
  <text x="60" y="52" font-family="sans-serif" font-size="16" font-weight="bold" fill="${spec.color1}" text-anchor="middle">${spec.initial}</text>
</svg>`;

    fs.writeFileSync(path.join(targetDir, `${spec.name}.svg`), svgContent);
    fs.writeFileSync(path.join(targetDir, `${spec.name}.jpg`), svgContent);
}

console.log(`Generated ${AVATAR_SPECS.length} avatar assets in ${targetDir}`);
