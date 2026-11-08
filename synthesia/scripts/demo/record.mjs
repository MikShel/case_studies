// Records the narrated demo video: title cards + the prototype driven by its Guided demo + a synthetic voice-over.
//
//   DEMO_TOOLS=/path/with/node_modules(playwright-core, ffmpeg-static) \
//   node scripts/demo/record.mjs [appUrl] [outDir]
//
// Needs macOS (`say`, `afinfo`) and a local Chrome. The app must be running (npm run dev / npx vite preview).
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { CARDS } from './cards.mjs';
import { SEGMENTS } from './segments.mjs';

const require = createRequire(resolve(process.env.DEMO_TOOLS ?? '.', 'node_modules') + '/');
const { chromium } = require('playwright-core');
const FFMPEG = require('ffmpeg-static');

const APP = process.argv[2] ?? 'http://localhost:5179/';
const OUT = resolve(process.argv[3] ?? 'demo');
const VOICE = process.env.DEMO_VOICE ?? 'Samantha';
const RATE = process.env.DEMO_RATE ?? '172';
const W = 1440;
const H = 900;
const GAP_MS = 700;

const work = join(OUT, '.work');
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

// 1) voice-over clips
console.log(`voice: ${VOICE} @ ${RATE} wpm`);
const clips = SEGMENTS.map((seg, i) => {
  const file = join(work, `vo-${String(i).padStart(2, '0')}.aiff`);
  execFileSync('say', ['-v', VOICE, '-r', RATE, '-o', file, seg.text]);
  const info = execFileSync('afinfo', [file]).toString();
  const sec = Number(/estimated duration: ([\d.]+)/.exec(info)?.[1] ?? '0');
  return { file, ms: Math.round(sec * 1000) };
});
console.log(`voice-over: ${(clips.reduce((a, c) => a + c.ms, 0) / 1000).toFixed(0)} s in ${clips.length} segments`);

// 2) screen recording, paced by the clips
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: work, size: { width: W, height: H } } });
await ctx.addInitScript(() => {
  globalThis.__avaMsPerChar = 20; // Ava's (muted) lines pace a bit faster under the narration
});
const page = await ctx.newPage();
page.setDefaultTimeout(120_000);
const t0 = Date.now();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

const idle = async () => {
  await page.waitForTimeout(250);
  await page.waitForFunction(() => !document.querySelector('.ava[data-busy]'));
  await page.waitForTimeout(250);
};
const clickNext = async () => {
  await page.click('[data-guide-next]');
  await idle();
};

let appLoaded = false;
const starts = [];
for (const [i, seg] of SEGMENTS.entries()) {
  const start = Date.now() - t0;
  starts.push(start);
  if (seg.card) {
    // a real navigation (not setContent) so the very first frame already fills the viewport
    await page.goto(`data:text/html;charset=utf-8,${encodeURIComponent(CARDS[seg.card])}`);
  } else {
    if (!appLoaded) {
      await page.goto(APP);
      await page.click('text=▶ Guided demo');
      await page.evaluate(() => document.querySelector('button[title=Mute]')?.click());
      await page.click('.guide button[title=Collapse]');
      appLoaded = true;
    }
    if (seg.beat) await clickNext();
    for (let n = 0; n < (seg.next ?? 0); n++) await clickNext();
    if (seg.scroll === 'gap') await page.evaluate(() => document.querySelector('.gap')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    if (seg.scroll === 'boundary') {
      await page.evaluate(() => document.querySelector('.content')?.scrollBy({ top: 700, behavior: 'smooth' }));
      await page.waitForTimeout(3500);
      await page.evaluate(() => document.querySelector('.content')?.scrollTo({ top: 0, behavior: 'smooth' }));
    }
  }
  const until = start + clips[i].ms + GAP_MS;
  const wait = until - (Date.now() - t0);
  if (wait > 0) await page.waitForTimeout(wait);
  console.log(`segment ${i + 1}/${SEGMENTS.length} done at ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
await page.waitForTimeout(1500);
const videoPath = await page.video().path();
await ctx.close();
await browser.close();
if (errors.length) console.warn('page errors:', errors);

// 3) subtitles (the narration, timed)
const ts = (ms) => {
  const h = String(Math.floor(ms / 3_600_000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0');
  return `${h}:${m}:${s},${String(ms % 1000).padStart(3, '0')}`;
};
const srt = SEGMENTS.map((seg, i) => `${i + 1}\n${ts(starts[i])} --> ${ts(starts[i] + clips[i].ms)}\n${seg.text}\n`).join('\n');
const srtPath = join(OUT, 'troubleshooting-sessions-demo.srt');
writeFileSync(srtPath, srt);

// 4) mix: every clip placed at the moment its segment started
const inputs = clips.flatMap((c) => ['-i', c.file]);
const delays = clips.map((_, i) => `[${i + 1}:a]adelay=${starts[i]}:all=1[a${i}]`).join(';');
const mix = `${delays};${clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${clips.length}:normalize=0[aout]`;
const mp4 = join(OUT, 'troubleshooting-sessions-demo.mp4');
execFileSync(
  FFMPEG,
  ['-y', '-loglevel', 'error', '-i', videoPath, ...inputs, '-i', srtPath, '-filter_complex', mix, '-map', '0:v', '-map', '[aout]', '-map', `${clips.length + 1}:s`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-pix_fmt', 'yuv420p', '-r', '25', '-c:a', 'aac', '-b:a', '160k', '-c:s', 'mov_text',
    '-metadata:s:s:0', 'language=eng', '-movflags', '+faststart', mp4],
  { stdio: 'inherit' },
);
for (const f of readdirSync(work)) if (f.endsWith('.webm')) rmSync(join(work, f));
console.log(`\n✓ ${mp4}\n✓ ${srtPath}`);
