#!/usr/bin/env node
/* Deterministic frame-by-frame renderer: headless Chromium -> PNG frames -> ffmpeg (H.264 mp4).
 *
 *   node render.cjs <projectDir> [--out out.mp4] [--scale 1] [--workers 3] [--crf 16]
 *                   [--from sec --to sec]          render only part of the timeline
 *                   [--still 1.5,4,9]              PNG stills at these times instead of video
 *                   [--sheet 8]                    one contact-sheet PNG of N evenly spaced frames
 *                   [--audio track.mp3]            mux an audio file
 *
 * --scale 0.5 is the draft mode (4x fewer pixels). Review stills / a sheet BEFORE a full render.
 */
const http = require('http'), fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
let chromium;
try { ({ chromium } = require('playwright')); } catch { console.error('playwright not found: npm i -D playwright && npx playwright install chromium'); process.exit(1); }

const argv = process.argv.slice(2);
const dir = path.resolve(argv.find((a) => !a.startsWith('--')) || '.');
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const scale = parseFloat(opt('scale', '1')), workers = parseInt(opt('workers', '3'), 10), crf = opt('crf', '21');
const out = path.resolve(opt('out', path.join(dir, 'out', 'video.mp4')));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream', '.mp3': 'audio/mpeg' };

const server = http.createServer((req, res) => {
  const p = path.normalize(path.join(dir, decodeURIComponent(req.url.split('?')[0])));
  if (!p.startsWith(dir)) { res.writeHead(403); return res.end(); }
  fs.readFile(p.endsWith(path.sep) || p === dir ? path.join(p, 'index.html') : p, (e, buf) => {
    if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(buf);
  });
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/index.html?render=1`;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-vsync'] });
  const open = async () => {
    const probe = await browser.newPage(); // viewport must equal the frame size, which only the scene knows
    probe.on('pageerror', (e) => console.error('[page error]', e.message));
    probe.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()); });
    await probe.goto(url);
    await probe.waitForFunction('window.__ready || window.__error', null, { timeout: 120000 });
    const err = await probe.evaluate('window.__error'); if (err) throw new Error(err);
    const meta = await probe.evaluate('window.__meta'); await probe.close();
    return meta;
  };
  const meta = await open();
  const newPage = async () => {
    const ctx = await browser.newContext({ viewport: { width: meta.width, height: meta.height }, deviceScaleFactor: scale });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.error('[page error]', e.message));
    await page.goto(url);
    await page.waitForFunction('window.__ready || window.__error', null, { timeout: 120000 });
    return page;
  };
  const shoot = (page, file) => page.locator('#frame').screenshot({ path: file, type: 'png' });
  fs.mkdirSync(path.dirname(out), { recursive: true });

  let stills = opt('still');
  const sheet = opt('sheet');
  if (sheet) { const n = parseInt(sheet, 10); stills = Array.from({ length: n }, (_, i) => (((i + 0.5) / n) * meta.duration).toFixed(2)).join(','); }
  if (stills) {
    const page = await newPage(); const files = [];
    for (const s of stills.split(',')) {
      const t = parseFloat(s); await page.evaluate((t) => window.__renderTime(t), t);
      const f = path.join(path.dirname(out), `still_${t.toFixed(2).padStart(6, '0')}.png`); await shoot(page, f); files.push(f); console.log('still', f);
    }
    if (sheet) {
      const cols = Math.min(files.length, meta.width > meta.height ? 3 : 4), rows = Math.ceil(files.length / cols);
      const sheetFile = path.join(path.dirname(out), 'sheet.png');
      const tw = Math.round(1600 / cols / 2) * 2;
      const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...files.flatMap((f) => ['-i', f]), '-filter_complex',
        files.map((_, i) => `[${i}:v]`).join('') + `concat=n=${files.length}:v=1:a=0,scale=${tw}:-2,tile=${cols}x${rows}:padding=6:color=black`,
        '-frames:v', '1', sheetFile], { stdio: 'inherit' });
      if (r.status === 0) console.log('sheet', sheetFile, `(${cols}x${rows})`);
    }
    await browser.close(); server.close(); return;
  }

  const f0 = Math.round(parseFloat(opt('from', '0')) * meta.fps), f1 = Math.min(meta.total, Math.round(parseFloat(opt('to', String(meta.duration))) * meta.fps));
  const framesDir = path.join(path.dirname(out), '.frames'); fs.rmSync(framesDir, { recursive: true, force: true }); fs.mkdirSync(framesDir, { recursive: true });
  const t0 = Date.now(); let done = 0; const n = f1 - f0;
  console.log(`rendering ${n} frames ${meta.width * scale}x${meta.height * scale} @${meta.fps}fps with ${workers} workers`);
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const page = await newPage();
    for (let i = f0 + w; i < f1; i += workers) {
      await page.evaluate((i) => window.__renderFrame(i), i);
      await shoot(page, path.join(framesDir, `f_${String(i - f0).padStart(6, '0')}.png`));
      if (++done % 30 === 0 || done === n) console.log(`  ${done}/${n}  ${((Date.now() - t0) / done / 1000 * (n - done)).toFixed(0)}s left`);
    }
  }));
  await browser.close(); server.close();
  const audio = opt('audio');
  const args = ['-y', '-loglevel', 'error', '-framerate', String(meta.fps), '-i', path.join(framesDir, 'f_%06d.png'), ...(audio ? ['-i', path.resolve(audio), '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-movflags', '+faststart', out];
  const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
  fs.rmSync(framesDir, { recursive: true, force: true });
  console.log(`done ${out} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
})().catch((e) => { console.error(e); process.exit(1); });
