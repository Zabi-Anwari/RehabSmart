/**
 * One-shot extractor: pulls a single mid-motion still frame from each knee
 * exercise's demo MP4 in dataML/133/Ex{1..6} and writes a JPG to
 * public/exercise-demos/knee-ex-{1..6}.jpg.
 *
 * The result is committed (or at least available locally) so the React app
 * doesn't have to ship the ~130 multi-GB videos. Rerun this script any time
 * you want fresher reference images.
 *
 *   node scripts/extract-knee-demos.mjs
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot  = resolve(__dirname, '..');
const dataRoot  = join(repoRoot, 'dataML', '133');
const outDir    = join(repoRoot, 'public', 'exercise-demos');

if (!ffmpegPath) {
  console.error('ffmpeg-static did not resolve to a binary. Reinstall: npm install --save-dev ffmpeg-static');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

// Pick the first Camera17 (non-transposed) MP4 in each Ex folder — that's
// the head-on view, easier to read as a reference image than the transposed
// side angle.
function pickDemoVideo(exDir) {
  const all = readdirSync(exDir);
  const front = all.filter(n => n.endsWith('-Camera17-30fps.mp4'));
  front.sort();
  if (front.length === 0) throw new Error(`No Camera17 mp4 in ${exDir}`);
  return join(exDir, front[0]);
}

// Probe duration with ffmpeg itself (no ffprobe in ffmpeg-static). We just
// run ffmpeg with -i and parse the "Duration:" line from stderr.
function probeDurationSec(mp4) {
  try {
    execFileSync(ffmpegPath, ['-i', mp4], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (err) {
    const stderr = err.stderr?.toString() ?? '';
    const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }
  return null;
}

for (let i = 1; i <= 6; i++) {
  const exDir = join(dataRoot, `Ex${i}`);
  if (!existsSync(exDir)) {
    console.warn(`skip Ex${i}: missing ${exDir}`);
    continue;
  }
  const mp4 = pickDemoVideo(exDir);
  const dur = probeDurationSec(mp4) ?? 4; // fall back to 4 s if probe failed
  const seekSec = Math.max(0.5, dur * 0.5); // mid-motion
  const outFile = join(outDir, `knee-ex-${i}.jpg`);

  console.log(`Ex${i}  ${dur.toFixed(1)}s @${seekSec.toFixed(1)}s  ←  ${mp4}`);

  // -ss before -i = fast seek (key-frame accurate enough for a still).
  // -vframes 1 = one frame. scale to 960px wide preserving aspect.
  // -q:v 4 ≈ 80% JPEG quality — small file, sharp enough.
  execFileSync(ffmpegPath, [
    '-y',
    '-ss', seekSec.toFixed(2),
    '-i', mp4,
    '-vframes', '1',
    '-vf', 'scale=960:-2',
    '-q:v', '4',
    outFile,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
}

console.log('\nDone. Images written to public/exercise-demos/');
