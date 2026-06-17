// Compresses all BGM MP3s to 64 kbps, reducing ~3.9 MB tracks to ~960 KB.
// Run once with: npm run compress-audio
// Requires ffmpeg-static: npm install --save-dev ffmpeg-static

const ffmpegStatic = require('ffmpeg-static');
const { execFileSync } = require('child_process');
const { readdirSync, statSync, renameSync } = require('fs');
const { join } = require('path');

const dir = 'public/assets';

// Skip files that are already tiny — no benefit from re-encoding
const SKIP = new Set(['buttonSFX.mp3']);

let totalBefore = 0;
let totalAfter  = 0;

for (const file of readdirSync(dir)) {
  if (!file.endsWith('.mp3') || SKIP.has(file)) continue;

  const input  = join(dir, file);
  const tmp    = input + '.tmp.mp3';
  const before = statSync(input).size;

  try {
    execFileSync(ffmpegStatic, [
      '-i', input,
      '-codec:a', 'libmp3lame',
      '-b:a', '64k',
      '-y', tmp,
    ], { stdio: 'pipe' });

    renameSync(tmp, input);
    const after = statSync(input).size;
    totalBefore += before;
    totalAfter  += after;
    console.log(`${file}: ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB`);
  } catch (err) {
    console.error(`Failed to compress ${file}:`, err.message);
    try { require('fs').unlinkSync(tmp); } catch {}
  }
}

console.log(`\nTotal: ${(totalBefore / 1024 / 1024).toFixed(1)} MB → ${(totalAfter / 1024 / 1024).toFixed(1)} MB`);
