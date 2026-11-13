// cinematic-3d-video kit: stage, look presets, procedural props, camera shots, overlay text.
// Everything is a pure function of time `t` (seconds) so frames render deterministically.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export { THREE, RoundedBoxGeometry };

// ---------- math / timing ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const ease = {
  linear: (x) => x,
  in: (x) => x * x * x,
  out: (x) => 1 - Math.pow(1 - x, 3),
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outBack: (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2),
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
};
/** 0..1 progress of t inside [a,b], eased. */
export const prog = (t, a, b, e = ease.inOut) => e(clamp((t - a) / (b - a)));
/** Seeded PRNG. Never use Math.random(): frames must be reproducible. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
let ROOT = null; // default parent for every primitive: the current stage's scene
const v3 = (a) => (a.isVector3 ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]));

// ---------- look presets ----------
export const LOOKS = {
  // Low warm sun through a window, deep brown shadows, haze. The "golden hour desk" look.
  goldenHour: {
    background: 0x140b06, fog: [0x3a1d0c, 0.035], exposure: 1.05, env: 0.18,
    key: { color: 0xffa858, intensity: 7.5, pos: [-6, 4.2, 2.5] },
    fill: { sky: 0x6b4a3a, ground: 0x1a0d06, intensity: 0.55 },
    rim: { color: 0xffd9a8, intensity: 1.2, pos: [4, 3, -4] },
    bloom: [0.38, 0.6, 0.9], vignette: 0.95, grain: 0.055, ca: 0.0012,
    tint: [1.04, 1.0, 0.93],
  },
  // Near-black studio, one hard key and a cool rim. For product / mechanism close-ups.
  studioDark: {
    background: 0x07080a, fog: [0x07080a, 0.02], exposure: 1.0, env: 0.35,
    key: { color: 0xfff1df, intensity: 5.5, pos: [3.5, 5, 4] },
    fill: { sky: 0x30384a, ground: 0x050505, intensity: 0.35 },
    rim: { color: 0x8fb4ff, intensity: 3.0, pos: [-4, 2.5, -4] },
    bloom: [0.4, 0.6, 0.85], vignette: 1.05, grain: 0.045, ca: 0.001,
    tint: [1.0, 1.0, 1.02],
  },
  // Bright saturated backdrop, soft toy-like shading. For playful explainer shots.
  popColor: {
    background: 0x8a2be2, fog: [0x8a2be2, 0.012], exposure: 1.1, env: 0.75,
    key: { color: 0xffffff, intensity: 3.6, pos: [3, 6, 5] },
    fill: { sky: 0xffd6ff, ground: 0x5a1a9a, intensity: 1.1 },
    rim: { color: 0xff8ad8, intensity: 2.0, pos: [-5, 3, -3] },
    bloom: [0.25, 0.5, 0.9], vignette: 0.55, grain: 0.03, ca: 0.0006,
    tint: [1.0, 1.0, 1.0],
  },
};

const FinishShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 0.9 },
    uGrain: { value: 0.05 }, uCA: { value: 0.001 }, uTint: { value: new THREE.Vector3(1, 1, 1) },
    uFade: { value: 1 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uCA, uFade; uniform vec3 uTint;
    varying vec2 vUv;
    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    void main(){
      vec2 c = vUv - 0.5; float r2 = dot(c, c);
      vec2 off = c * r2 * uCA * 8.0;                       // chromatic aberration grows to the edges
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      col *= uTint;
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.18);  // gentle filmic contrast
      col *= 1.0 - smoothstep(0.12, 0.95, r2 * 2.2) * uVignette * 0.75;
      float g = hash(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 91.7) - 0.5;
      col += g * uGrain * (1.0 - 0.5 * dot(col, vec3(0.333)));
      gl_FragColor = vec4(col * uFade, 1.0);
    }`,
};

// ---------- stage ----------
export function createStage(def) {
  const { width: W, height: H } = def;
  const look = { ...LOOKS[def.look || 'goldenHour'], ...(def.lookOverrides || {}) };
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  const pr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(pr);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = look.exposure;

  const scene = new THREE.Scene();
  ROOT = scene;
  scene.background = new THREE.Color(look.background);
  scene.fog = new THREE.FogExp2(look.fog[0], look.fog[1]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = look.env;

  const camera = new THREE.PerspectiveCamera(35, W / H, 0.05, 200);

  // Three-point light rig. The key is the only shadow caster: one clear shadow direction reads as "lit on purpose".
  const key = new THREE.DirectionalLight(look.key.color, look.key.intensity);
  key.position.set(...look.key.pos);
  key.castShadow = true;
  key.shadow.mapSize.set(def.shadowMapSize || 2048, def.shadowMapSize || 2048);
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 5;
  const sc = key.shadow.camera; sc.left = -6; sc.right = 6; sc.top = 6; sc.bottom = -6; sc.near = 0.5; sc.far = 30;
  const fill = new THREE.HemisphereLight(look.fill.sky, look.fill.ground, look.fill.intensity);
  const rim = new THREE.DirectionalLight(look.rim.color, look.rim.intensity);
  rim.position.set(...look.rim.pos);
  scene.add(key, key.target, fill, rim);

  const rt = new THREE.WebGLRenderTarget(W * pr, H * pr, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pr); composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  let bokeh = null;
  if (def.dof) {
    bokeh = new BokehPass(scene, camera, { focus: def.dof.focus ?? 5, aperture: def.dof.aperture ?? 0.002, maxblur: def.dof.maxblur ?? 0.008 });
    composer.addPass(bokeh);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), ...look.bloom);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const finish = new ShaderPass(FinishShader);
  finish.uniforms.uVignette.value = look.vignette; finish.uniforms.uGrain.value = look.grain;
  finish.uniforms.uCA.value = look.ca; finish.uniforms.uTint.value.set(...look.tint);
  composer.addPass(finish);

  const tickers = [];
  const stage = {
    W, H, def, look, renderer, scene, camera, composer, key, fill, rim, bloom, bokeh, finish,
    /** register fn(t) run every frame after def.update */
    onTick: (fn) => tickers.push(fn),
    add: (...o) => { scene.add(...o); return o[0]; },
    /** fade-from-black at start / fade-to-black at end, seconds */
    fade(t, inDur = 0.5, outDur = 0.5) {
      finish.uniforms.uFade.value = Math.min(prog(t, 0, inDur, ease.out), 1 - prog(t, def.duration - outDur, def.duration, ease.in));
    },
    _tick(t) { tickers.forEach((f) => f(t)); finish.uniforms.uTime.value = t; },
  };
  return stage;
}

// ---------- materials ----------
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const hex = (c) => '#' + new THREE.Color(c).getHexString();
export const tex = {
  /** streaky wood grain */
  wood(base = 0x6b3f22, dark = 0x3a1f10, seed = 7, repeat = [1, 1]) {
    return canvasTex(512, 512, (g, w, h) => {
      const r = rng(seed); g.fillStyle = hex(base); g.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) {
        g.strokeStyle = hex(dark); g.globalAlpha = 0.05 + r() * 0.22; g.lineWidth = 0.5 + r() * 2.5;
        const y = r() * h, a = (r() - 0.5) * 10; g.beginPath(); g.moveTo(0, y);
        g.bezierCurveTo(w * 0.3, y + a, w * 0.7, y - a, w, y + (r() - 0.5) * 6); g.stroke();
      }
    }, repeat);
  },
  /** fine speckle for plastic / plaster / paper roughness variation */
  speckle(base = 0xd9d2c0, seed = 3, amount = 0.08, repeat = [2, 2]) {
    return canvasTex(256, 256, (g, w, h) => {
      const r = rng(seed); g.fillStyle = hex(base); g.fillRect(0, 0, w, h);
      for (let i = 0; i < 5000; i++) { g.fillStyle = r() > 0.5 ? '#000' : '#fff'; g.globalAlpha = r() * amount; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
    }, repeat);
  },
  /** any 2D drawing (screens, dials, labels, paper). draw(ctx, w, h) */
  draw: (w, h, draw) => canvasTex(w, h, draw),
};
export const mat = {
  wood: (c = 0x6b3f22, o = {}) => new THREE.MeshStandardMaterial({ map: tex.wood(c, o.dark, o.seed, o.repeat), roughness: 0.62, metalness: 0, ...o.props }),
  plastic: (c = 0xd9d2c0, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.45, clearcoat: 0.25, clearcoatRoughness: 0.5, ...o }),
  matte: (c = 0x888888, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92, ...o }),
  metal: (c = 0xc9c9c9, o = {}) => new THREE.MeshStandardMaterial({ color: c, metalness: 1, roughness: 0.28, ...o }),
  brass: (o = {}) => new THREE.MeshStandardMaterial({ color: 0xc89b4a, metalness: 1, roughness: 0.32, ...o }),
  // Cheap glass: a faint reflective sheet. Real `transmission` re-renders the whole scene per frame; opt in only for a hero close-up.
  glass: (c = 0xffffff, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.14, clearcoat: 1, depthWrite: false, ...o }),
  glow: (c = 0xffc070, intensity = 4, o = {}) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: c, emissiveIntensity: intensity, ...o }),
  textured: (map, o = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.6, ...o }),
};

// ---------- primitives (all cast + receive shadows) ----------
function place(m, o = {}) {
  if (o.pos) m.position.set(...o.pos);
  if (o.rot) m.rotation.set(...o.rot);
  if (o.scale) typeof o.scale === 'number' ? m.scale.setScalar(o.scale) : m.scale.set(...o.scale);
  m.castShadow = o.cast ?? true; m.receiveShadow = o.receive ?? true;
  const parent = o.parent === undefined ? ROOT : o.parent; // parent:null = don't add anywhere
  if (parent) parent.add(m);
  return m;
}
/** Rounded box. Always prefer a small bevel (r) over a razor edge: edges are where the light lives. */
export const box = (w, h, d, material, o = {}) =>
  place(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(o.r ?? 0.02, w / 2, h / 2, d / 2)), material), o);
export const cyl = (rTop, rBot, h, material, o = {}) =>
  place(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, o.seg ?? 48, 1, o.open ?? false), material), o);
export const sphere = (r, material, o = {}) => place(new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), material), o);
export const plane = (w, h, material, o = {}) => place(new THREE.Mesh(new THREE.PlaneGeometry(w, h), material), { cast: false, ...o });
export const torus = (r, tube, material, o = {}) => place(new THREE.Mesh(new THREE.TorusGeometry(r, tube, 24, 72, o.arc ?? Math.PI * 2), material), o);
/** Profile revolved around Y: vases, mugs, lamp shades, knobs. pts = [[radius, y], ...] */
export const lathe = (pts, material, o = {}) =>
  place(new THREE.Mesh(new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), o.seg ?? 64), material), o);
/** Tube along 3D points: cables, pipes, levers, handles. */
export const tube = (pts, radius, material, o = {}) =>
  place(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(v3)), o.seg ?? 64, radius, 12, false), material), o);
export const group = (o = {}, ...children) => { const g = new THREE.Group(); children.forEach((c) => g.add(c)); return place(g, { cast: false, receive: false, ...o }); };

// ---------- atmosphere ----------
/** Venetian blinds: real geometry in front of the key light, so striped shadows are physically cast. */
export function blinds({ width = 3, height = 3, slats = 16, tilt = 0.6, material, pos, rot } = {}) {
  const g = new THREE.Group(); const m = material || mat.matte(0x2a1a10);
  const step = height / slats;
  for (let i = 0; i < slats; i++) box(width, 0.012, step * 0.82, m, { r: 0.004, pos: [0, -height / 2 + step * (i + 0.5), 0], rot: [tilt, 0, 0], parent: g });
  if (pos) g.position.set(...pos); if (rot) g.rotation.set(...rot);
  ROOT.add(g); return g;
}
const ShaftMat = (color, opacity) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uTime: { value: 0 }, uSeed: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform vec3 uColor; uniform float uOpacity, uTime, uSeed; varying vec2 vUv;
    void main(){
      float across = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x);
      float along = smoothstep(0.0, 0.08, vUv.y) * pow(1.0 - vUv.y, 1.6);
      float flick = 0.82 + 0.18 * sin(uTime * 0.7 + uSeed * 6.283 + vUv.y * 5.0);
      gl_FragColor = vec4(uColor, across * along * flick * uOpacity);
    }`,
});
/**
 * Fake volumetric light shafts: additive gradient sheets running from `from` along `dir`.
 * Put `from` at the window / lamp and aim `dir` the same way the key light travels.
 */
export function lightShafts(stage, { from = [-3, 3, 0], dir = [1, -0.6, -0.3], count = 7, spread = [0, 2.2, 0], length = 7, width = 0.34, color = 0xffb060, opacity = 0.11 } = {}) {
  const g = new THREE.Group(); const d = v3(dir).normalize(); const r = rng(11); const mats = [];
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), d);
  for (let i = 0; i < count; i++) {
    const k = count === 1 ? 0.5 : i / (count - 1);
    const m = ShaftMat(color, opacity * (0.6 + r() * 0.8)); m.uniforms.uSeed.value = r(); mats.push(m);
    for (const a of [0, Math.PI / 2]) {
      const geo = new THREE.PlaneGeometry(width * (0.7 + r() * 0.6), length); geo.translate(0, -length / 2, 0);
      // flip v so vUv.y = 0 at the source
      const uv = geo.attributes.uv; for (let j = 0; j < uv.count; j++) uv.setY(j, 1 - uv.getY(j));
      const s = new THREE.Mesh(geo, m); s.rotation.y = a;
      const holder = new THREE.Group(); holder.add(s); holder.quaternion.copy(q);
      holder.position.set(from[0] + spread[0] * (k - 0.5), from[1] + spread[1] * (k - 0.5), from[2] + spread[2] * (k - 0.5));
      g.add(holder);
    }
  }
  stage.scene.add(g); stage.onTick((t) => mats.forEach((m) => (m.uniforms.uTime.value = t)));
  return g;
}
/** Floating dust motes that catch the light. Drifts slowly; deterministic. */
export function dust(stage, { count = 500, center = [0, 1.5, 0], size = [6, 3, 5], color = 0xffd9a0, pointSize = 0.022, opacity = 0.7 } = {}) {
  const r = rng(5); const base = new Float32Array(count * 3); const ph = new Float32Array(count);
  for (let i = 0; i < count; i++) { base[i * 3] = (r() - 0.5) * size[0]; base[i * 3 + 1] = (r() - 0.5) * size[1]; base[i * 3 + 2] = (r() - 0.5) * size[2]; ph[i] = r() * 100; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3));
  const sprite = tex.draw(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const m = new THREE.PointsMaterial({ map: sprite, color, size: pointSize, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false });
  const pts = new THREE.Points(geo, m); pts.position.set(...center); stage.scene.add(pts);
  stage.onTick((t) => {
    const p = geo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      p[i * 3] = base[i * 3] + Math.sin(t * 0.13 + ph[i]) * 0.18;
      p[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.09 + ph[i] * 1.7) * 0.12 + t * 0.012;
      p[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.11 + ph[i] * 0.6) * 0.18;
    }
    geo.attributes.position.needsUpdate = true;
  });
  return pts;
}
/** Seamless studio backdrop: floor that curves up into a wall, no visible horizon line. */
export function cyclorama(stage, { color = 0x111214, size = 30, roughness = 0.9 } = {}) {
  const pts = []; const R = 3;
  pts.push([size / 2, 0]);
  for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI / 2; pts.push([-size / 4 + R - R * Math.sin(a) - R, R - R * Math.cos(a)]); }
  pts.push([-size / 4 - R, size / 2]);
  const shape = new THREE.BufferGeometry(); const verts = []; const idx = [];
  pts.forEach(([z, y], i) => { verts.push(-size / 2, y, -z, size / 2, y, -z); if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
  shape.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); shape.setIndex(idx); shape.computeVertexNormals();
  const m = new THREE.Mesh(shape, new THREE.MeshStandardMaterial({ color, roughness, side: THREE.DoubleSide }));
  m.receiveShadow = true; stage.scene.add(m); return m;
}

// ---------- camera ----------
/**
 * Camera as a list of shots. Each shot: { from, to, pos:[a,b], look:[a,b], fov:[a,b]|n, ease, drift }.
 * A shot is ONE simple move (push-in, slide, orbit arc, crane). Cut between shots; don't fly between them.
 * pos/look may also be functions (k)=>[x,y,z] for arcs.
 */
export function shots(stage, t, list) {
  const s = list.find((x) => t >= x.from && t < x.to) || list[list.length - 1];
  const k = prog(t, s.from, s.to, s.ease || ease.inOut);
  const pick = (p) => (typeof p === 'function' ? v3(p(k)) : Array.isArray(p[0]) ? v3(p[0]).lerp(v3(p[1]), k) : v3(p));
  const pos = pick(s.pos), look = pick(s.look);
  const d = s.drift ?? 0.012; // handheld micro-drift keeps a locked-off frame alive
  pos.x += Math.sin(t * 0.9) * d + Math.sin(t * 2.3 + 1) * d * 0.4;
  pos.y += Math.cos(t * 0.7 + 2) * d * 0.8;
  const cam = stage.camera;
  cam.position.copy(pos); cam.lookAt(look);
  cam.fov = Array.isArray(s.fov) ? lerp(s.fov[0], s.fov[1], k) : s.fov ?? 35;
  cam.updateProjectionMatrix();
  if (stage.bokeh) stage.bokeh.uniforms.focus.value = s.focus ?? pos.distanceTo(look);
  return { shot: s, k, index: list.indexOf(s) };
}

// ---------- overlay: captions + callout labels ----------
/**
 * captions: [{ from, to, text, at:'top'|'bottom'|'center', size }]  (text: "*word*" marks the dim accent word)
 * labels:   [{ from, to, text, point:[x,y,z] | ()=>Vector3, dx, dy }]  thin leader line from a 3D point to small-caps text
 */
export function createOverlay(stage, { captions = [], labels = [], notes = [] } = {}) {
  const root = document.getElementById('overlay');
  const U = stage.W / 1080; // design unit: layouts are authored for a 1080-wide frame
  root.style.setProperty('--u', U + 'px');
  const caps = captions.map((c) => {
    const el = document.createElement('div'); el.className = 'cap cap-' + (c.at || 'bottom');
    if (c.size) el.style.fontSize = `calc(${c.size} * var(--u))`;
    const words = c.text.split(/\s+/).map((w) => {
      const sp = document.createElement('span'); const accent = /^\*.*\*[.,!?]?$/.test(w);
      const clean = w.replace(/\*/g, ''); const m = clean.match(/^(.*?)([.!?])$/);
      sp.className = 'w' + (accent ? ' dim' : '');
      if (m) { sp.append(m[1]); const dot = document.createElement('i'); dot.textContent = m[2]; sp.append(dot); } else sp.textContent = clean;
      el.append(sp, ' '); return sp;
    });
    root.append(el); return { c, el, words };
  });
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('class', 'leaders');
  svg.setAttribute('viewBox', `0 0 ${stage.W} ${stage.H}`); root.append(svg);
  const labs = labels.map((l) => {
    const line = document.createElementNS(svgNS, 'path'); const dot = document.createElementNS(svgNS, 'circle'); dot.setAttribute('r', 4 * U);
    svg.append(line, dot);
    const el = document.createElement('div'); el.className = 'label'; el.textContent = l.text; root.append(el);
    return { l, line, dot, el };
  });
  const noteEls = notes.map((n) => { const el = document.createElement('div'); el.className = 'note'; el.textContent = n.text; root.append(el); return { n, el }; });
  const p = new THREE.Vector3();
  return {
    update(t) {
      for (const { c, el, words } of caps) {
        const on = t >= c.from && t < c.to; el.style.display = on ? '' : 'none'; if (!on) continue;
        const stagger = c.stagger ?? 0.11; const out = 1 - prog(t, c.to - 0.25, c.to, ease.in);
        words.forEach((w, i) => {
          const k = prog(t, c.from + i * stagger, c.from + i * stagger + 0.32, ease.out);
          w.style.opacity = k * out; w.style.transform = `translateY(${(1 - k) * 0.35}em)`; w.style.filter = `blur(${(1 - k) * 6 * U}px)`;
        });
      }
      for (const { l, line, dot, el } of labs) {
        const on = t >= l.from && t < l.to; const disp = on ? '' : 'none';
        el.style.display = disp; line.style.display = disp; dot.style.display = disp; if (!on) continue;
        p.copy(typeof l.point === 'function' ? l.point() : v3(l.point)).project(stage.camera);
        const x = (p.x * 0.5 + 0.5) * stage.W, y = (-p.y * 0.5 + 0.5) * stage.H;
        const k = prog(t, l.from, l.from + 0.45, ease.out) * (1 - prog(t, l.to - 0.25, l.to, ease.in));
        let dx = l.dx ?? 120; const dy = l.dy ?? -140;
        if (x + dx * U > stage.W - 260 * U) dx = -Math.abs(dx); else if (x + dx * U < 260 * U) dx = Math.abs(dx); // keep text inside the frame
        const ex = x + dx * U * k, ey = y + dy * U * k;
        line.setAttribute('d', `M${x},${y} L${ex},${ey}`); line.style.opacity = k; line.style.strokeWidth = 2 * U;
        dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.style.opacity = k;
        el.style.left = ex + 'px'; el.style.top = ey + 'px'; el.style.opacity = prog(t, l.from + 0.25, l.from + 0.6, ease.out) * (1 - prog(t, l.to - 0.25, l.to, ease.in));
        el.style.transform = `translate(${dx >= 0 ? '0' : '-100%'}, ${dy < 0 ? '-130%' : '30%'})`;
      }
      for (const { n, el } of noteEls) el.style.opacity = t >= n.from && t < n.to ? 0.55 : 0;
    },
  };
}

// ---------- boot ----------
export async function boot(def) {
  document.documentElement.style.setProperty('--w', def.width + 'px');
  document.documentElement.style.setProperty('--h', def.height + 'px');
  const stage = createStage(def);
  await def.init(stage);
  const overlay = createOverlay(stage, { captions: def.captions, labels: def.labels, notes: def.notes });
  await document.fonts.ready;
  const total = Math.round(def.duration * def.fps);
  const draw = (t) => { def.update(t, stage); stage._tick(t); stage.composer.render(); overlay.update(t); };
  window.__meta = { width: def.width, height: def.height, fps: def.fps, duration: def.duration, total };
  window.__renderFrame = (i) => draw(i / def.fps);
  window.__renderTime = (t) => draw(t);
  const q = new URLSearchParams(location.search);
  if (q.has('render')) { draw(0); window.__ready = true; return; }
  // live preview: fit to window, loop; ?t=3.2 freezes on a time
  const fit = () => { const s = Math.min(innerWidth / def.width, innerHeight / def.height); document.getElementById('frame').style.transform = `scale(${s})`; };
  fit(); addEventListener('resize', fit);
  if (q.has('t')) { draw(parseFloat(q.get('t'))); window.__ready = true; return; }
  const t0 = performance.now(); window.__ready = true;
  const loop = () => { draw(((performance.now() - t0) / 1000) % def.duration); requestAnimationFrame(loop); };
  loop();
}
