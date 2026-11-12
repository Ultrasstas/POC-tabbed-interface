---
name: cinematic-3d-video
description: Make short cinematic 3D explainer videos entirely from code — procedural Three.js scenes with film-style lighting (warm sun through blinds, striped shadows, haze, bloom, grain), kinetic word-by-word captions and callout labels, rendered frame-by-frame in headless Chromium to MP4. Use when the user asks for a 3D video, 3D animation, 3D motion graphics, a "cinematic 3D scene", a 3D explainer / reel / short, a cutaway or "how it works" mechanism animation, or says things like "сделай 3D видео", "3D графика", "3D сцена", "ролик в 3D".
---

# Cinematic 3D video

You build the whole film as code: one `scene.js` that models the set from primitives, lights it like a
cinematographer, moves the camera in a few deliberate shots, and puts short captions on top. A bundled
renderer turns it into an MP4. No Blender, no 3D assets, no GPU needed.

What separates this from the flat, grey "default Three.js" look is not the modelling. It is **light,
camera and finish**. A scene of boxes and cylinders looks expensive when one warm key light rakes across
it through blinds, the camera moves slowly on a long lens, and the frame has bloom, vignette and grain.
Spend your effort there.

## Workflow

1. **Set up a project** (once per video):
   ```bash
   cp -r <skill>/template <project> && cd <project> && npm install
   ```
   `<skill>` is the directory this SKILL.md is in. The project then has `index.html`, `lib/kit.js`
   (the toolkit — read its exports before writing a scene) and `scene.js` (a complete worked example:
   vintage radio on a desk at golden hour; rewrite it for the new subject).

2. **Write the plan as a shot list before any code.** 10–20 s total, 3–5 shots, one idea per shot,
   one caption per shot. Example: *establish (whole set) → hero (the object) → macro/cutaway (the
   mechanism) → payoff line.* Decide the single subject, the look preset, and what moves in each shot.

3. **Write `scene.js`**: `init(stage)` builds the set once; `update(t, stage)` poses everything for
   time `t`. See "Scene contract" below.

4. **Look at it before rendering it.** This loop is the skill; don't skip it:
   ```bash
   node <skill>/scripts/render.cjs <project> --scale 0.5 --sheet 8     # contact sheet of 8 frames → out/sheet.png
   node <skill>/scripts/render.cjs <project> --still 2.5,7,12          # full-res stills at chosen times
   ```
   Open the PNGs with the Read tool and critique them against the checklist below. Fix, re-render the
   sheet, repeat. Expect 2–4 rounds. Typical first-pass problems: props not visible, frame too dark or
   blown out, subject cropped (vertical frames are narrow), caption sitting on top of a busy area.

5. **Render the video**, then send the MP4 to the user:
   ```bash
   node <skill>/scripts/render.cjs <project> --workers 4 --out <project>/out/video.mp4 [--audio music.mp3]
   ```
   On CPU-only (software WebGL) machines expect about 1–2 s per frame at 1080×1920 with 4 workers, so a
   14 s clip takes roughly 10 minutes: run it in the background. `--scale 0.667` gives 720×1280 in about
   half the time; `--from/--to` (seconds) re-renders just one shot.

## Scene contract

```js
import { THREE, mat, tex, box, cyl, sphere, plane, torus, lathe, tube, group,
         blinds, lightShafts, dust, cyclorama, shots, prog, ease, lerp, rng } from './lib/kit.js';

export default {
  width: 1080, height: 1920, fps: 30, duration: 14,   // 9:16 by default; 1920×1080 for landscape
  look: 'goldenHour',                                  // 'goldenHour' | 'studioDark' | 'popColor'
  lookOverrides: { /* any LOOKS field, e.g. exposure: 1.2 */ },
  dof: { aperture: 0.002, maxblur: 0.008 },            // optional depth of field (slower)
  captions: [{ from: 0.7, to: 4.3, at: 'bottom', text: 'Before playlists, there was *this.*' }],
  labels:   [{ from: 5.6, to: 9.2, text: 'Dial', point: () => worldVec3, dx: 90, dy: -210 }],
  notes:    [{ from: 5, to: 9, text: 'Illustration · simplified' }],
  init(stage) { /* build meshes; keep handles to things that animate */ },
  update(t, stage) { shots(stage, t, [...]); /* animate from t */ stage.fade(t); },
};
```

Rules that keep renders correct:

- **Everything is a function of `t`.** No `Math.random()`, `Date.now()`, or accumulating state between
  frames — frames are rendered out of order by parallel workers. Use `rng(seed)` and `prog(t, a, b, ease)`.
- Primitives are added to the scene automatically; pass `{ parent: someGroup }` to nest them.
- Units are metres-ish. A desk object is 0.2–1.2 wide. Keep the whole set inside ~±4 so the key
  light's shadow frustum covers it.
- Text inside the 3D world (dial faces, screens, paper) is drawn with `tex.draw(w, h, (ctx) => …)`.

## Making it look good

**Light**
- One key light does the work, low and from the side (stage.key). It is the only shadow caster.
  Put something between it and the subject — `blinds()`, a window frame, a plant — so shadows have
  shape. Striped light across a surface is the signature of this style.
- Shadows should be dark: keep fill and environment low (goldenHour already does). If the frame looks
  flat and evenly lit, lower `fill.intensity`/`env`, don't add lights.
- Add air: `lightShafts()` from the window along the key direction, and `dust()` in the lit volume.
  Both must stay subtle — if you notice them before the subject, halve the opacity.
- Emissive things (screens, bulbs, dials) want `emissiveIntensity` around 0.3–1.0. Bloom multiplies
  them; a value of 1.5+ becomes a white blob.

**Materials and shape**
- Bevel every edge (`box(..., { r })`) — highlights live on bevels. Razor-sharp boxes read as "default 3D".
- Mix finishes in one object: rough wood + glossy plastic + brass/metal trim + one glowing element.
  Use `mat.wood/plastic/matte/metal/brass/glass/glow`; vary roughness, not just colour.
- Build the hero from 15–40 parts with real small details (feet, screws, knobs, grille slats, a seam).
  Supporting props can be 1–5 parts each. Restrict the palette to 3–4 hues that sit together.

**Camera** (`shots(stage, t, [...])`)
- Each shot is one simple move: push-in, lateral slide, slow arc, or creep. 3–5 s each. Cut between
  shots; never fly the camera across the room.
- Long lens: fov 28–40. Vertical frames are narrow — horizontal fov is about half the vertical, so to
  fit an object of width `w` you need distance ≈ `w / (2·tan(hfov/2))`. Check the sheet for cropping.
- Go wide → medium → macro. The macro is where a detail animates (needle sweeps, lever strikes, key
  presses). Ease everything (`ease.out` for arrivals, `ease.outBack` for mechanical snaps).

**Text**
- Captions: ≤ 7 words, sentence case, one per shot, ends with a period. Wrap the payoff word in
  `*asterisks*` — it renders dimmed with the accent-coloured period. Place the card (`at: 'top' |
  'bottom' | 'center'`) over the calmest part of the frame, never on the subject.
- Labels: 1–2 words, they render as small caps with a hairline leader from a 3D point. Use 1–3 per
  shot, only in a shot where the camera is nearly still.

**Self-review checklist** (answer from the rendered PNGs, not from the code)
1. Can I tell what the subject is in under a second? Is it fully in frame in the hero shot?
2. Is there a clear light direction with real shadow shape, and true darks somewhere in the frame?
3. Is anything blown out to white or lost in black that matters?
4. Is every caption fully readable, and clear of the subject and of busy texture?
5. Does each shot show something new (scale, angle or action), or are two shots the same picture?
6. Would a still from this pass as a deliberate illustration? If it looks like a tech demo, fix light first.

## Renderer notes

- Needs Node, `playwright` with Chromium, and `ffmpeg` on PATH. WebGL runs on SwiftShader (CPU), so it
  works in containers and CI. On a machine with a GPU, live-preview by serving the project folder
  (`npx serve <project>`) and opening `index.html`; `?t=3.2` freezes a time.
- `--scale 0.5` for drafts, `--crf 14–20` for quality/size, `--workers N` ≈ CPU cores.
- If stills show a black frame, check the console lines the renderer prints (`[page error]`), then that
  every mesh actually has a parent and the camera `look` target is where the subject is.
- For more look presets or new atmosphere helpers, extend `LOOKS` and the helpers in `lib/kit.js` rather
  than hand-rolling lights per scene, so the finish stays consistent across videos.
