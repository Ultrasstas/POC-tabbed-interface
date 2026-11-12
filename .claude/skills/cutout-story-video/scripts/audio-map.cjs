#!/usr/bin/env node
/* Finds the spoken phrases in a voice track from its pauses, so scenes can be cut to the voice.
 *   node audio-map.cjs <audio> [--noise -32] [--gap 0.3]
 * Prints and writes <audio>.phrases.json: { duration, phrases: [{ i, from, to, len }] }
 * Lower --gap (e.g. 0.18) splits into shorter phrases; raise --noise (e.g. -26) for noisy recordings.
 */
const { spawnSync } = require('child_process'), fs = require('fs');
const argv = process.argv.slice(2), file = argv.find((a) => !a.startsWith('--'));
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
if (!file) { console.error('usage: audio-map.cjs <audio> [--noise -32] [--gap 0.3]'); process.exit(1); }
const dur = parseFloat(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).stdout.toString());
const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', `silencedetect=noise=${opt('noise', '-32')}dB:d=${opt('gap', '0.3')}`, '-f', 'null', '-']);
const log = r.stderr.toString(); const sil = [];
for (const m of log.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)) sil.push([parseFloat(m[1]), parseFloat(m[2])]);
const tail = log.match(/silence_start: ([\d.]+)(?![\s\S]*silence_end)/); if (tail) sil.push([parseFloat(tail[1]), dur]);
const phrases = []; let cur = 0;
for (const [a, b] of sil) { if (a - cur > 0.05) phrases.push([cur, a]); cur = b; }
if (dur - cur > 0.05) phrases.push([cur, dur]);
const out = { duration: +dur.toFixed(3), phrases: phrases.map(([a, b], i) => ({ i: i + 1, from: +a.toFixed(2), to: +b.toFixed(2), len: +(b - a).toFixed(2) })) };
fs.writeFileSync(file + '.phrases.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
