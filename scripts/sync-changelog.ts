import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'CHANGELOG.md');
const targets = [
  path.join(root, 'client', 'public', 'CHANGELOG.md'),
  path.join(root, 'server', 'CHANGELOG.md'),
];

if (!fs.existsSync(src)) {
  console.error('CHANGELOG.md not found at', src);
  process.exit(1);
}

const text = fs.readFileSync(src, 'utf8');
for (const t of targets) {
  fs.mkdirSync(path.dirname(t), { recursive: true });
  fs.writeFileSync(t, text, 'utf8');
}
console.log('Synced CHANGELOG.md →', targets.map((p) => path.relative(root, p)).join(', '));
