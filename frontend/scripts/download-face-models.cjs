/**
 * Downloads face-api.js model weights into public/models/
 * Run once: node scripts/download-face-models.cjs
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'https://github.com/justadudewhohacks/face-api.js/raw/master/weights/';
const OUT  = path.join(__dirname, '..', 'public', 'models');

const FILES = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_tiny_model-weights_manifest.json',
  'face_landmark_68_tiny_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
];

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = (u) =>
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return get(res.headers.location); // follow redirect
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${u}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', reject);
    get(url);
  });
}

(async () => {
  for (const f of FILES) {
    const dest = path.join(OUT, f);
    if (fs.existsSync(dest)) {
      console.log(`✓ already exists: ${f}`);
      continue;
    }
    process.stdout.write(`  downloading ${f}…`);
    try {
      await download(BASE + f, dest);
      console.log(' done');
    } catch (e) {
      console.log(` FAILED: ${e.message}`);
    }
  }
  console.log('\nAll models ready in public/models/');
})();
