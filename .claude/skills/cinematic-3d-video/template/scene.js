// Example scene: a vintage radio on a desk at golden hour. 14 s, vertical 9:16.
// Copy this file's structure for a new video: def = { size, look, init, update, captions, labels }.
import { THREE, mat, tex, box, cyl, sphere, plane, torus, lathe, tube, group, blinds, lightShafts, dust, shots, prog, ease, lerp, rng } from './lib/kit.js';

const S = {}; // handles to things that animate

export default {
  width: 1080, height: 1920, fps: 30, duration: 14,
  look: 'goldenHour',

  captions: [
    { from: 0.7, to: 4.3, at: 'bottom', text: 'Before playlists, there was *this.*' },
    { from: 5.0, to: 9.3, at: 'bottom', text: 'One needle finds every *station.*' },
    { from: 10.0, to: 13.7, at: 'top', text: 'Every station is a *signal.*' },
  ],
  labels: [
    { from: 5.6, to: 9.2, text: 'Dial', point: () => S.dial.getWorldPosition(new THREE.Vector3()), dx: 90, dy: -210 },
    { from: 6.2, to: 9.2, text: 'Speaker', point: () => S.grille.getWorldPosition(new THREE.Vector3()), dx: -60, dy: -250 },
  ],
  notes: [{ from: 5.0, to: 9.3, text: 'Illustration · simplified' }],

  init(stage) {
    const { scene } = stage;
    const r = rng(42);

    // --- room: back wall, left wall with a window opening, floor ---
    const plaster = mat.textured(tex.speckle(0x9a7450, 4, 0.1, [4, 4]), { roughness: 0.95 });
    box(9, 7, 0.2, plaster, { pos: [1, 1.5, -0.95], r: 0 });
    const wallL = (h, d, y, z) => box(0.2, h, d, plaster, { pos: [-2.3, y, z], r: 0 });
    wallL(2.0, 9, -0.5, 2.5); wallL(2.6, 9, 4.0, 2.5); wallL(2.2, 1.6, 1.6, -1.2); wallL(2.2, 4.4, 1.6, 4.4);
    box(9, 0.2, 9, mat.wood(0x4a2a16, { seed: 2, repeat: [3, 6] }), { pos: [1, -1.6, 2.5], r: 0 });
    // window: frame, blinds, bright sky card behind (bloom source; doesn't block the sun)
    const frameM = mat.wood(0x3a2012, { seed: 9 });
    box(0.26, 0.08, 2.5, frameM, { pos: [-2.28, 0.5, 0.9] }); box(0.26, 0.08, 2.5, frameM, { pos: [-2.28, 2.7, 0.9] });
    blinds({ width: 2.4, height: 2.2, slats: 12, tilt: 0.25, pos: [-2.16, 1.6, 0.9], rot: [0, Math.PI / 2, 0] });
    plane(3, 2.6, mat.glow(0xffb468, 2.6), { pos: [-2.6, 1.6, 0.9], rot: [0, Math.PI / 2, 0] });

    // --- desk ---
    const deskM = mat.wood(0x5a3018, { seed: 5, repeat: [2, 1] });
    box(2.7, 0.08, 1.3, deskM, { pos: [0.1, -0.04, 0], r: 0.015 });
    box(2.5, 0.22, 0.04, deskM, { pos: [0.1, -0.19, 0.55] });
    for (const x of [-1.15, 1.35]) for (const z of [-0.55, 0.55]) box(0.07, 1.5, 0.07, deskM, { pos: [x, -0.83, z] });
    box(1.9, 0.02, 2.4, mat.matte(0x5c1f14), { pos: [0.1, -1.49, 1.0], r: 0.005 }); // rug

    // --- shelf with books above the desk ---
    box(1.9, 0.05, 0.3, deskM, { pos: [0.5, 1.75, -0.7] });
    const bookCols = [0x7a2a1c, 0x24403a, 0xc9a45a, 0x2b2f4a, 0x8a5a2a, 0xd9cdb4, 0x4a1f2a];
    let bx = -0.3;
    for (let i = 0; i < 11; i++) {
      const w = 0.045 + r() * 0.05, h = 0.3 + r() * 0.14;
      box(w, h, 0.2, mat.matte(bookCols[i % bookCols.length], { roughness: 0.7 }), { pos: [bx + w / 2, 1.775 + h / 2, -0.7], rot: [0, 0, i === 10 ? -0.22 : 0], r: 0.006 });
      bx += w + 0.006;
    }

    // --- the radio (hero) ---
    const radio = group({ pos: [0.0, 0.0, -0.05], rot: [0, 0.16, 0] }); S.radio = radio;
    const body = mat.wood(0x7a4420, { seed: 21, dark: 0x2e1608, repeat: [1, 1], props: { roughness: 0.42 } });
    box(1.15, 0.64, 0.4, body, { pos: [0, 0.36, 0], r: 0.07, parent: radio });
    for (const x of [-0.45, 0.45]) cyl(0.035, 0.03, 0.04, mat.matte(0x15100c), { pos: [x, 0.02, 0.1], parent: radio });
    box(1.03, 0.52, 0.03, mat.plastic(0xe6d7b4, { roughness: 0.38 }), { pos: [0, 0.36, 0.195], r: 0.012, parent: radio });
    // speaker: cloth + slats
    plane(0.5, 0.4, mat.matte(0x2a1c12), { pos: [-0.22, 0.37, 0.2115], parent: radio });
    for (let i = 0; i < 11; i++) box(0.5, 0.014, 0.022, mat.brass({ roughness: 0.42 }), { pos: [-0.22, 0.19 + i * 0.036, 0.218], r: 0.006, parent: radio });
    S.grille = group({ pos: [-0.22, 0.42, 0.23], parent: radio });
    // dial: printed scale that lights up from behind
    const dialTex = tex.draw(512, 512, (g, w, h) => {
      g.fillStyle = '#f3e3b8'; g.fillRect(0, 0, w, h); g.translate(w / 2, h / 2);
      g.strokeStyle = '#3a2412'; g.fillStyle = '#3a2412'; g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, 215, Math.PI * 0.8, Math.PI * 2.2); g.stroke();
      for (let i = 0; i <= 28; i++) { const a = Math.PI * 0.8 + (i / 28) * Math.PI * 1.4, big = i % 4 === 0;
        g.lineWidth = big ? 5 : 2; g.beginPath(); g.moveTo(Math.cos(a) * 215, Math.sin(a) * 215); g.lineTo(Math.cos(a) * (big ? 178 : 195), Math.sin(a) * (big ? 178 : 195)); g.stroke();
        if (big) { g.font = '600 30px Manrope Variable, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(54 + i * 4), Math.cos(a) * 142, Math.sin(a) * 142); } }
      g.font = '700 26px Manrope Variable, sans-serif'; g.textAlign = 'center'; g.fillText('MW  ·  kHz ×10', 0, 150);
    });
    S.dialMat = new THREE.MeshStandardMaterial({ map: dialTex, emissiveMap: dialTex, emissive: 0xffb45a, emissiveIntensity: 0, roughness: 0.5 });
    S.dial = cyl(0.19, 0.19, 0.012, S.dialMat, { pos: [0.27, 0.42, 0.214], rot: [Math.PI / 2, Math.PI / 2, 0], parent: radio });
    torus(0.195, 0.014, mat.brass(), { pos: [0.27, 0.42, 0.222], parent: radio });
    S.needle = group({ pos: [0.27, 0.42, 0.228], parent: radio });
    box(0.008, 0.17, 0.004, mat.glow(0xff3b20, 1.4), { pos: [0, 0.07, 0], r: 0.001, parent: S.needle, cast: false });
    cyl(0.022, 0.022, 0.012, mat.brass(), { pos: [0, 0, 0.002], rot: [Math.PI / 2, 0, 0], parent: S.needle });
    cyl(0.2, 0.2, 0.004, mat.glass(0xfff4e0, { transmission: 0.96, roughness: 0.02 }), { pos: [0.27, 0.42, 0.236], rot: [Math.PI / 2, 0, 0], parent: radio, cast: false });
    // knobs
    S.knobs = [0.13, 0.41].map((x) => { const k = group({ pos: [x, 0.155, 0.21], rot: [Math.PI / 2, 0, 0], parent: radio });
      cyl(0.04, 0.046, 0.05, mat.brass({ roughness: 0.3 }), { pos: [0, 0.025, 0], parent: k });
      box(0.006, 0.004, 0.03, mat.matte(0x1a120c), { pos: [0, 0.052, -0.022], r: 0.001, parent: k }); return k; });
    // handle + antenna
    torus(0.2, 0.014, mat.metal(0xb9a37a, { roughness: 0.35 }), { pos: [0, 0.66, 0], arc: Math.PI, parent: radio });
    cyl(0.006, 0.008, 1.0, mat.metal(), { pos: [0.5, 1.1, -0.1], rot: [0, 0, -0.28], parent: radio });
    sphere(0.014, mat.metal(), { pos: [0.64, 1.58, -0.1], parent: radio });

    // --- supporting props ---
    lathe([[0, 0], [0.085, 0], [0.09, 0.01], [0.09, 0.2], [0.082, 0.2], [0.078, 0.02], [0, 0.02]], mat.plastic(0xe9e2d2, { roughness: 0.3 }), { pos: [0.95, 0, 0.3] });
    torus(0.055, 0.012, mat.plastic(0xe9e2d2, { roughness: 0.3 }), { pos: [1.05, 0.1, 0.3], arc: Math.PI, rot: [0, 0, -Math.PI / 2] });
    cyl(0.076, 0.076, 0.004, mat.matte(0x24130a, { roughness: 0.25 }), { pos: [0.95, 0.17, 0.3], cast: false });
    box(0.5, 0.03, 0.36, mat.matte(0x1f2d2a, { roughness: 0.6 }), { pos: [-0.72, 0.015, 0.32], rot: [0, 0.3, 0], r: 0.008 });
    box(0.46, 0.012, 0.33, mat.matte(0xe8dfc8), { pos: [-0.715, 0.034, 0.32], rot: [0, 0.3, 0], r: 0.003 });
    cyl(0.009, 0.009, 0.3, mat.matte(0xd9a020, { roughness: 0.5 }), { pos: [-0.5, 0.05, 0.42], rot: [Math.PI / 2, 0, 0.9], seg: 6 });
    // plant
    lathe([[0, 0], [0.09, 0], [0.12, 0.2], [0.13, 0.2], [0.13, 0.22], [0, 0.22]], mat.matte(0xa4532c, { roughness: 0.8 }), { pos: [-0.95, 0, -0.3] });
    const leafM = mat.matte(0x3f5a2a, { roughness: 0.55, side: THREE.DoubleSide });
    for (let i = 0; i < 9; i++) { const a = r() * 6.28, lean = 0.15 + r() * 0.45, len = 0.45 + r() * 0.35;
      const leaf = group({ pos: [-0.95, 0.2, -0.3], rot: [0, a, 0] });
      sphere(1, leafM, { parent: leaf, pos: [Math.sin(lean) * len / 2, Math.cos(lean) * len / 2, 0], rot: [0, 0, -lean], scale: [0.035, len / 2, 0.008] }); }
    // desk lamp
    cyl(0.11, 0.12, 0.03, mat.metal(0x1c1c1c, { roughness: 0.4 }), { pos: [1.05, 0.015, -0.35] });
    tube([[1.05, 0.03, -0.35], [1.08, 0.5, -0.35], [0.95, 0.85, -0.33], [0.75, 0.95, -0.3]], 0.012, mat.metal(0x1c1c1c, { roughness: 0.4 }));
    lathe([[0.03, 0], [0.05, 0.02], [0.15, 0.2], [0.145, 0.2], [0.045, 0.025], [0.03, 0.01]], mat.metal(0x20231f, { roughness: 0.45, side: THREE.DoubleSide }), { pos: [0.72, 0.97, -0.3], rot: [0, 0, 2.2] });

    // --- atmosphere ---
    stage.key.position.set(-6, 4.2, 2.5); stage.key.target.position.set(0, 0.2, 0);
    const sc = stage.key.shadow.camera; sc.left = sc.bottom = -4; sc.right = sc.top = 4; sc.updateProjectionMatrix(); // tighter frustum = crisper stripes
    lightShafts(stage, { from: [-2.1, 1.6, 0.9], dir: [6, -4.0, -2.5], count: 9, spread: [0, 1.9, 0], length: 5.2, width: 0.5, opacity: 0.075 });
    dust(stage, { count: 260, center: [-0.3, 0.9, 0.6], size: [4, 2.6, 3], pointSize: 0.016, opacity: 0.4 });
    S.glowLight = new THREE.PointLight(0xffb060, 0, 1.2, 2); S.glowLight.position.set(0.27, 0.42, 0.4); radio.add(S.glowLight);
  },

  update(t, stage) {
    shots(stage, t, [
      // 1. establish: slow push-in on the whole desk
      { from: 0, to: 4.5, pos: [[1.9, 1.55, 5.6], [1.5, 1.3, 4.7]], look: [[0.05, 0.55, 0], [0.05, 0.5, 0]], fov: 40, ease: ease.out },
      // 2. hero: lateral slide across the radio's face
      { from: 4.5, to: 9.5, pos: [[-1.0, 0.78, 4.9], [0.8, 0.64, 4.7]], look: [[0, 0.36, 0], [0.05, 0.36, 0]], fov: 31, ease: ease.inOut },
      // 3. macro: creep toward the dial
      { from: 9.5, to: 14, pos: [[0.85, 0.58, 1.75], [0.68, 0.52, 1.5]], look: [0.27, 0.42, 0.15], fov: 36, ease: ease.out, drift: 0.004 },
    ]);
    // the radio switches on at 3.2 s: dial warms up, needle hunts for a station
    const on = prog(t, 3.2, 4.4, ease.out);
    S.dialMat.emissiveIntensity = on * (0.42 + 0.02 * Math.sin(t * 9));
    S.glowLight.intensity = on * 0.07;
    const sweep = lerp(1.9, -1.6, prog(t, 4.6, 9.2, ease.inOut)) + prog(t, 9.5, 12.5, ease.outBack) * 1.35;
    S.needle.rotation.z = sweep + Math.sin(t * 23) * 0.004;
    S.knobs[1].rotation.y = -sweep * 2.2;
    stage.fade(t, 0.6, 0.5);
  },
};
