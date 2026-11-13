// cutout-story-video engine: turns story.js (scenes of image/text layers) into frames.
// Pure function of time: frame(t) fully re-poses the DOM, so frames can render in any order.

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const EASE = {
  linear: (x) => x,
  in: (x) => x * x * x,
  out: (x) => 1 - Math.pow(1 - x, 3),
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outBack: (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2),
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  bounce: (x) => { const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; },
};
const prog = (t, a, b, e = 'inOut') => EASE[e](clamp((t - a) / Math.max(1e-6, b - a)));
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }; // deterministic noise
const pair = (v, k) => (Array.isArray(v) ? lerp(v[0], v[1], k) : v);

const ENTER_DUR = { pop: 0.35, slam: 0.22, fade: 0.4, drop: 0.55, type: 0.9, words: 0.6, wipe: 0.45, 'slide-left': 0.4, 'slide-right': 0.4, 'slide-up': 0.4, 'slide-down': 0.4, spin: 0.5 };

/** transform contribution of an enter/exit animation at progress k (0 = fully out, 1 = fully in) */
function inOut(type, k, W, H) {
  const o = { x: 0, y: 0, s: 1, r: 0, a: 1 };
  switch (type) {
    case 'pop': o.s = Math.max(0, EASE.outBack(k)); o.a = clamp(k * 4); break;
    case 'slam': o.s = lerp(2.8, 1, EASE.outExpo(k)); o.a = clamp(k * 3); break;
    case 'fade': o.a = k; break;
    case 'drop': o.y = -H * 1.1 * (1 - EASE.bounce(k)); break;
    case 'spin': o.s = EASE.outBack(k); o.r = (1 - EASE.out(k)) * -200; o.a = clamp(k * 4); break;
    case 'slide-left': o.x = W * 1.1 * (1 - EASE.outExpo(k)); break;   // comes from the right, moving left
    case 'slide-right': o.x = -W * 1.1 * (1 - EASE.outExpo(k)); break;
    case 'slide-up': o.y = H * 1.1 * (1 - EASE.outExpo(k)); break;
    case 'slide-down': o.y = -H * 1.1 * (1 - EASE.outExpo(k)); break;
    default: break; // 'type' | 'words' | 'wipe' | 'none' handled on the element itself
  }
  return o;
}
function idle(type, t, i, amp = 1) {
  const o = { x: 0, y: 0, sx: 1, sy: 1, r: 0 };
  const ph = i * 1.7;
  switch (type) {
    case 'breathe': o.sy = 1 + 0.014 * amp * Math.sin(t * 2.2 + ph); o.sx = 1 - 0.006 * amp * Math.sin(t * 2.2 + ph); break;
    case 'bob': o.y = 10 * amp * Math.sin(t * 2.6 + ph); break;
    case 'float': o.y = 14 * amp * Math.sin(t * 1.1 + ph); o.r = 1.5 * amp * Math.sin(t * 0.8 + ph); break;
    case 'sway': o.r = 3 * amp * Math.sin(t * 1.8 + ph); break;
    case 'talk': o.sy = 1 + 0.02 * amp * Math.abs(Math.sin(t * 9 + ph)); o.r = 1.2 * amp * Math.sin(t * 4.5 + ph); break; // head-nod while speaking
    case 'shiver': o.x = 5 * amp * (hash(Math.floor(t * 24) + i) - 0.5); o.y = 5 * amp * (hash(Math.floor(t * 24) + i + 9) - 0.5); break;
    case 'pulse': o.sx = o.sy = 1 + 0.04 * amp * Math.sin(t * 5 + ph); break;
    case 'spin': o.r = t * 60 * amp; break;
    default: break;
  }
  return o;
}

function markup(text, accent) {
  // *word* -> accent colour; \n -> line break
  return text.split('\n').map((line) => line.split(/(\*[^*]+\*)/).map((p) =>
    p.startsWith('*') && p.endsWith('*') && p.length > 2 ? `<b style="color:${accent}">${esc(p.slice(1, -1))}</b>` : esc(p)).join('')).join('<br>');
}
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export async function boot(story) {
  const W = story.width || 1920, H = story.height || 1080, fps = story.fps || 30;
  const U = W / 1920;
  const root = document.documentElement.style;
  root.setProperty('--w', W + 'px'); root.setProperty('--h', H + 'px'); root.setProperty('--u', U + 'px');
  const frameEl = document.getElementById('frame'), stageEl = document.getElementById('stage');
  const duration = story.duration || Math.max(...story.scenes.map((s) => s.to));
  const boil = story.boil ?? 1, problems = [];

  // ---------- build DOM ----------
  const loads = [];
  const scenes = story.scenes.map((s, si) => {
    const el = document.createElement('div'); el.className = 'scene'; el.style.background = s.bg || '#111'; el.style.zIndex = si + 1;
    const layers = (s.layers || []).map((L, li) => {
      const wrap = document.createElement('div'); wrap.className = 'layer';
      let node;
      if (L.img) {
        node = new Image(); node.src = L.img; node.draggable = false;
        loads.push(node.decode().catch(() => problems.push(`scene ${si + 1}: cannot load ${L.img}`)));
        if (L.fit) { wrap.classList.add('full'); node.style.objectFit = L.fit; node.style.objectPosition = L.position || 'center'; }
        if (L.shadow) node.style.filter = `drop-shadow(0 ${14 * U}px ${18 * U}px rgba(0,0,0,.45))`;
        if (L.outline) node.style.filter = (node.style.filter || '') + ` drop-shadow(${L.outline * U}px 0 0 #fff) drop-shadow(-${L.outline * U}px 0 0 #fff) drop-shadow(0 ${L.outline * U}px 0 #fff) drop-shadow(0 -${L.outline * U}px 0 #fff)`;
      } else if (L.text != null) {
        node = document.createElement('div'); node.className = 'txt txt-' + (L.style || 'title') + (L.tail ? ' tail-' + L.tail : '');
        if (L.size) node.style.fontSize = L.size * U + 'px';
        if (L.color) node.style.color = L.color;
        if (L.bg) node.style.background = L.bg;
        if (L.maxWidth) node.style.maxWidth = L.maxWidth * W + 'px';
        const enterType = L.enter?.type;
        if (enterType === 'type') { // typewriter: every glyph is a span
          node.innerHTML = [...L.text].map((ch) => (ch === '\n' ? '<br>' : `<span class="g">${esc(ch)}</span>`)).join('');
        } else if (enterType === 'words') {
          node.innerHTML = L.text.split('\n').map((ln) => ln.split(/\s+/).map((w) => `<span class="g">${markup(w, L.accent || '#ffe500')}</span>`).join(' ')).join('<br>');
        } else node.innerHTML = markup(L.text, L.accent || '#ffe500');
      } else if (L.color) {
        node = document.createElement('div'); node.style.background = L.color; node.style.width = '100%'; node.style.height = '100%';
        if (L.radius) node.style.borderRadius = L.radius * U + 'px';
      } else { problems.push(`scene ${si + 1} layer ${li + 1}: needs img, text or color`); node = document.createElement('div'); }
      wrap.append(node); el.append(wrap);
      return { L, wrap, node, glyphs: [...node.querySelectorAll?.('.g') || []] };
    });
    // per-scene fx overlays
    const lines = document.createElement('div'); lines.className = 'speedlines'; el.append(lines);
    const flash = document.createElement('div'); flash.className = 'flash'; el.append(flash);
    stageEl.append(el);
    return { s, el, layers, lines, flash };
  });
  const grainEl = document.getElementById('grain');
  if (story.grain !== 0) { // tiled noise, re-offset every frame
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const d = g.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) { const v = hash(i * 0.37) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0); grainEl.style.backgroundImage = `url(${c.toDataURL()})`; grainEl.style.opacity = story.grain ?? 0.07;
  }
  await Promise.all(loads); await document.fonts.ready;
  // warm every font actually used so the first frames don't fall back
  await Promise.all([...document.querySelectorAll('.txt')].map((n) => document.fonts.load(getComputedStyle(n).font, n.textContent || 'А')));

  // ---------- pose one scene at local time lt ----------
  function pose(sc, lt, t) {
    const { s } = sc; const len = s.to - s.from; const cam = s.camera || {};
    const ck = prog(lt, 0, len, cam.ease || 'linear');
    const zoom = pair(cam.zoom ?? [1, 1.06], ck), rot = pair(cam.rotate ?? 0, ck);
    const pan = cam.pan ? [lerp(cam.pan[0][0], cam.pan[1][0], ck), lerp(cam.pan[0][1], cam.pan[1][1], ck)] : [0, 0];
    // shake fx
    let shx = 0, shy = 0, flashA = 0, linesA = 0;
    for (const f of s.fx || []) {
      const at = f.at ?? 0;
      if (f.type === 'shake') { const d = f.dur ?? 0.4; if (lt >= at && lt < at + d) { const k = 1 - (lt - at) / d, a = (f.amp ?? 16) * U * k, fr = Math.floor(t * fps); shx += (hash(fr) - 0.5) * 2 * a; shy += (hash(fr + 77) - 0.5) * 2 * a; } }
      if (f.type === 'flash') { const d = f.dur ?? 0.25; if (lt >= at && lt < at + d) flashA = Math.max(flashA, (1 - (lt - at) / d) * (f.amount ?? 0.85)); sc.flash.style.background = f.color || '#fff'; }
      if (f.type === 'speedlines') { const to = f.to ?? len; if (lt >= at && lt < to) { linesA = f.amount ?? 0.5; sc.lines.style.setProperty('--rot', Math.floor(t * 12) * 37 + 'deg'); sc.lines.style.setProperty('--line', f.color || 'rgba(0,0,0,.55)'); } }
    }
    sc.flash.style.opacity = flashA; sc.lines.style.opacity = linesA;
    sc.layers.forEach(({ L, wrap, node, glyphs }, i) => {
      const depth = L.depth ?? (L.fit ? 0.4 : L.text != null ? 0 : 1);     // 0 = glued to the screen (titles), 1 = full camera move
      const en = L.enter || {}, ex = L.exit || null;
      const enAt = en.at ?? 0, enDur = en.dur ?? ENTER_DUR[en.type] ?? 0;
      const visible = lt >= enAt && (!ex || lt < (ex.at ?? len) + (ex.dur ?? ENTER_DUR[ex.type] ?? 0.3));
      wrap.style.display = visible ? '' : 'none'; if (!visible) return;
      let a = inOut(en.type, enDur ? clamp((lt - enAt) / enDur) : 1, W, H);
      if (ex && lt >= (ex.at ?? len)) { const b = inOut(ex.type, 1 - clamp((lt - ex.at) / (ex.dur ?? ENTER_DUR[ex.type] ?? 0.3)), W, H); a = { x: a.x + b.x, y: a.y + b.y, s: a.s * b.s, r: a.r + b.r, a: a.a * b.a }; }
      const id = idle(L.idle, t, i, L.idleAmp ?? 1);
      // own slow move (Ken Burns on a single layer)
      const mk = prog(lt, 0, len, L.move?.ease || 'linear');
      const mz = pair(L.move?.zoom ?? 1, mk), mr = pair(L.move?.rotate ?? 0, mk);
      const mp = L.move?.pan ? [lerp(L.move.pan[0][0], L.move.pan[1][0], mk), lerp(L.move.pan[0][1], L.move.pan[1][1], mk)] : [0, 0];
      // hand-drawn "boil": tiny pose change 8x per second
      let bx = 0, by = 0, br = 0;
      if (boil && L.boil !== false && !L.fit && L.img) { const q = Math.floor(t * 8) + i * 13; bx = (hash(q) - 0.5) * 3 * U * boil; by = (hash(q + 5) - 0.5) * 3 * U * boil; br = (hash(q + 11) - 0.5) * 0.5 * boil; }
      const camS = 1 + (zoom - 1) * depth;
      const tx = (pan[0] * depth + mp[0]) * U + a.x + id.x * U + bx + shx * Math.min(1, depth + 0.3);
      const ty = (pan[1] * depth + mp[1]) * U + a.y + id.y * U + by + shy * Math.min(1, depth + 0.3);
      const anchor = L.anchor || (L.idle === 'breathe' || L.idle === 'talk' ? 'bottom' : 'center');
      if (!L.fit) {
        const ax = anchor.includes('left') ? 0 : anchor.includes('right') ? 100 : 50, ay = anchor.includes('top') ? 0 : anchor.includes('bottom') ? 100 : 50;
        wrap.style.left = (L.x ?? 0.5) * W + 'px'; wrap.style.top = (L.y ?? 0.5) * H + 'px';
        if (L.w) wrap.style.width = L.w * W + 'px'; if (L.h) wrap.style.height = L.h * H + 'px';
        if (L.img) { node.style.width = L.w ? '100%' : 'auto'; node.style.height = L.h ? '100%' : 'auto'; }
        wrap.style.transformOrigin = `${ax}% ${ay}%`;
        // scene camera zoom is about the frame centre: push the layer away from centre as we zoom
        const cx = ((L.x ?? 0.5) - 0.5) * W * (camS - 1), cy = ((L.y ?? 0.5) - 0.5) * H * (camS - 1);
        wrap.style.transform = `translate(${-ax}%, ${-ay}%) translate(${tx + cx}px, ${ty + cy}px) rotate(${(L.rotate || 0) + rot * depth + mr + a.r + id.r + br}deg) scale(${camS * mz * a.s * id.sx * (L.flip ? -1 : 1)}, ${camS * mz * a.s * id.sy})`;
      } else {
        wrap.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot * depth + mr}deg) scale(${camS * mz * (L.overscan ?? 1.06)})`;
      }
      wrap.style.opacity = a.a * (L.opacity ?? 1);
      if (L.blur) wrap.style.filter = `blur(${L.blur * U}px)`;
      if (en.type === 'type' || en.type === 'words') { const n = glyphs.length, k = enDur ? clamp((lt - enAt) / enDur) : 1; glyphs.forEach((g, gi) => { const on = gi < Math.ceil(k * n - 1e-6) || k >= 1; g.style.opacity = on ? 1 : 0; if (en.type === 'words') g.style.transform = on ? '' : 'translateY(.3em)'; }); }
      if (en.type === 'wipe') { const k = enDur ? EASE.out(clamp((lt - enAt) / enDur)) : 1; wrap.style.clipPath = `inset(0 ${(1 - k) * 100}% 0 0)`; }
    });
  }

  function draw(t) {
    t = clamp(t, 0, duration - 1e-4);
    let idx = scenes.findIndex((sc) => t >= sc.s.from && t < sc.s.to); if (idx < 0) idx = scenes.length - 1;
    const cur = scenes[idx], lt = t - cur.s.from; const trans = cur.s.in || 'cut'; const td = cur.s.inDur ?? 0.28;
    const withPrev = trans !== 'cut' && idx > 0 && lt < td;
    scenes.forEach((sc, i) => { sc.el.style.display = i === idx || (withPrev && i === idx - 1) ? '' : 'none'; });
    if (withPrev) { const p = scenes[idx - 1]; pose(p, p.s.to - p.s.from - 1e-3, t); p.el.style.transform = ''; p.el.style.opacity = 1; p.el.style.filter = ''; }
    pose(cur, lt, t);
    let tr = '', op = 1, fl = '';
    if (trans !== 'cut' && lt < td) {
      const k = EASE.outExpo(lt / td);
      if (trans === 'whip-left') { tr = `translateX(${(1 - k) * 100}%)`; fl = `blur(${(1 - k) * 14 * U}px)`; }
      else if (trans === 'whip-right') { tr = `translateX(${-(1 - k) * 100}%)`; fl = `blur(${(1 - k) * 14 * U}px)`; }
      else if (trans === 'whip-up') { tr = `translateY(${(1 - k) * 100}%)`; fl = `blur(${(1 - k) * 14 * U}px)`; }
      else if (trans === 'punch') { tr = `scale(${lerp(1.35, 1, k)})`; op = clamp(lt / td * 3); }
      else if (trans === 'fade') { op = lt / td; }
    }
    cur.el.style.transform = tr; cur.el.style.opacity = op; cur.el.style.filter = fl;
    const fr = Math.floor(t * fps); grainEl.style.backgroundPosition = `${Math.floor(hash(fr) * 256)}px ${Math.floor(hash(fr + 3) * 256)}px`;
  }

  window.__meta = { width: W, height: H, fps, duration, total: Math.round(duration * fps), audio: story.audio || null, problems };
  window.__renderFrame = (i) => draw(i / fps);
  window.__renderTime = (t) => draw(t);
  const q = new URLSearchParams(location.search);
  if (q.has('render')) { draw(0); window.__ready = true; return; }
  const fit = () => { frameEl.style.transform = `scale(${Math.min(innerWidth / W, innerHeight / H)})`; }; fit(); addEventListener('resize', fit);
  if (q.has('t')) { draw(parseFloat(q.get('t'))); window.__ready = true; return; }
  // live preview with sound: click to play
  window.__ready = true; draw(0);
  const audio = story.audio ? new Audio(story.audio) : null; let t0 = null;
  addEventListener('click', () => { t0 = performance.now(); if (audio) { audio.currentTime = 0; audio.play(); } });
  const loop = () => { if (t0 != null) draw(audio && !audio.paused ? audio.currentTime : ((performance.now() - t0) / 1000) % duration); requestAnimationFrame(loop); }; loop();
}
