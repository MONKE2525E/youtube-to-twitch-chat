const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extension/manifest.json')));
for (const file of ['popup.html', 'popup.js', 'popup.css', 'connect.html', 'connect.js', 'connect.css', manifest.background.service_worker, ...manifest.content_scripts.flatMap(s => [...s.js, ...s.css])]) {
  if (!fs.existsSync(path.join(root, 'extension', file))) throw new Error(`Missing ${file}`);
}
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const zip = path.join(root, 'dist/youtube-to-twitch-chat.zip');
fs.rmSync(zip, { force: true });
execFileSync('zip', ['-qr', zip, '.'], { cwd: path.join(root, 'extension') });
console.log(`Built ${zip}`);
