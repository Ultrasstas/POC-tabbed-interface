---
name: cutout-story-video
description: Assemble an animated 2D cutout story video from still illustrations and a voice track — layered parallax scenes, characters that slide/pop in and breathe, punchline cards with big type, speech bubbles, collage props, shakes, speed lines and whip transitions, all cut to the narration and rendered to MP4 with the audio. Use when the user sends images plus audio (or a script) and wants them animated, asks to "собрать ролик из картинок", "анимировать картинки под озвучку", "сделать анимацию по сюжету", make an illustrated explainer / satirical story video, or continue from the story-art-prompts skill.
---

# Cutout story video

The film is one data file, `story.js`: a list of scenes on the audio timeline, each a stack of image
and text layers with entrances, idle motion and effects. A bundled engine poses it in the browser and
a renderer writes the MP4 with the soundtrack. You direct; you do not hand-animate.

The style is fast illustrated satire: every 2–5 seconds the picture changes, and something moves on
every phrase. Stills that just sit there read as a slideshow — the craft is in **timing to the voice**
and **giving each layer a reason to move**.

## Workflow

1. **Set up** (once per video):
   ```bash
   cp -r <skill>/template <project> && cd <project> && npm install
   ```
   `<skill>` is this file's directory. The template is a working example (placeholder art); replace
   `img/`, `audio/` and `story.js`.

2. **Collect the assets.** Put the user's images in `<project>/img/`, the voice track in
   `<project>/audio/`. Look at every image with the Read tool before using it — you need to know what
   is in it, where the empty space is, and which way characters face.

3. **Cut out characters and props** that came on a flat background:
   ```bash
   python3 <skill>/scripts/cutout.py img/raw_cat.png img/cat_shock.png        # --tol 38 default
   ```
   It removes only background connected to the border (white eyes survive), trims, and warns if the
   result looks wrong. Read the PNG afterwards to check edges. Images that already have transparency
   are just trimmed. If a character is baked into a full scene, use that image as a `fit: 'cover'`
   background and animate around it (camera move, text, props) — or ask for a separate cutout.

4. **Map the audio.**
   ```bash
   node <skill>/scripts/audio-map.cjs audio/voice.mp3        # → phrases with from/to seconds
   ```
   Phrases are split at pauses (`--gap 0.18` for finer splits). Match them in order to the script's
   sentences: that gives each line its start time. If a transcription tool with word timestamps is
   available in the session, use it for precise word-level hits; otherwise place a hit inside a
   phrase proportionally to the word's position. No audio yet? Time at ~2.5 words per second and
   leave `audio` out.

5. **Write `story.js`** — one scene per idea, boundaries on phrase starts. Reference below.

6. **Review frames before rendering.** This is where the quality comes from:
   ```bash
   node <skill>/scripts/render.cjs <project> --scale 0.5 --sheet 12      # out/sheet.png
   node <skill>/scripts/render.cjs <project> --still 4.3,7.9            # exact moments, full size
   ```
   Read the PNGs. Check: text overlapping faces or other text, characters cut off or floating above
   the floor, layers at the wrong scale relative to each other, a scene that is identical to its
   neighbour, unreadable text over busy art. Fix and repeat (expect 2–3 rounds). Stills taken ~0.1 s
   after a scene start show mid-transition frames; sample later to judge layout.

7. **Render** and send the MP4:
   ```bash
   node <skill>/scripts/render.cjs <project> --workers 4 --out <project>/out/video.mp4
   ```
   About 0.5 s per 1080p frame on CPU (a 60 s video ≈ 15 min): run it in the background. The audio
   named in `story.js` is muxed automatically. `--from/--to` re-renders a section, `--crf 23` makes a
   smaller file.

## story.js reference

```js
export default {
  width: 1920, height: 1080, fps: 30,        // 1080×1920 for vertical
  audio: 'audio/voice.mp3',
  grain: 0.07,                                // paper grain overlay, 0 to disable
  boil: 1,                                    // hand-drawn jitter on cutouts, 0 to disable
  scenes: [{
    from: 0, to: 4.0,                         // seconds on the audio timeline; scenes must be contiguous
    bg: '#ffe500',                            // flat colour behind the layers
    in: 'cut',                                // 'cut' | 'punch' | 'whip-left' | 'whip-right' | 'whip-up' | 'fade'
    camera: { zoom: [1, 1.12], pan: [[0, 0], [-30, -10]], rotate: [0, 0], ease: 'linear' },
    fx: [{ type: 'shake', at: 0.1, dur: 0.4, amp: 18 }, { type: 'flash', at: 0.1 },
         { type: 'speedlines', at: 0, to: 2, color: 'rgba(0,0,0,.4)' }],
    layers: [ /* back to front */ ],
  }],
};
```

Times inside a scene (`at`) are seconds **from that scene's start**.

**Image layers**
- Background: `{ img, fit: 'cover', depth: 0.35 }` — fills the frame; `depth` < 1 makes it move less
  than the foreground under the scene camera (parallax). `position: 'center top'` to choose the crop.
- Cutout: `{ img, x, y, h (or w), anchor, flip, rotate, shadow, outline }` — `x`,`y` are fractions of
  the frame (0–1) for the anchor point, `h`/`w` fractions of frame height/width. Standing characters:
  `anchor: 'bottom', y: 0.97`. `flip: true` mirrors (make characters face each other). `shadow: true`
  grounds a figure on a background; `outline: 6` adds a white sticker edge for collage props.
- Per-layer drift: `move: { zoom: [1, 1.1], pan: [[0,0],[40,0]], rotate: [0, 3] }`.

**Text layers** `{ text, style, x, y, size, color, bg, rotate, maxWidth, accent }` — `\n` breaks lines,
`*word*` is drawn in the accent colour. Styles:

| style | Use |
|---|---|
| `title` | Tall condensed poster caps with a hard shadow. The main statement on a card. |
| `heavy` | Very wide, loud; one or two words on white or black. |
| `brush` | Dirty hand-painted word, black on a flat colour card. |
| `card` | White boxed note with a statement ("third principle: …"). |
| `tag` | Small black label: chapter number, date, place. |
| `bubble` | Speech balloon; `tail: 'left' | 'right'` points at the speaker below. |
| `caption` | Subtitle-like line at the bottom, outlined. |
| `sticker` | Yellow stamp; give it a `rotate`. |
| `hand` | Handwritten annotation. |

**Motion** (any layer)
- `enter: { type, at, dur }`: `pop`, `slam`, `drop`, `spin`, `fade`, `wipe`, `slide-left/right/up/down`
  (direction of travel), and for text `type` (typewriter) and `words` (word by word).
- `exit: { type, at }`: same types, played in reverse.
- `idle`: `breathe` (standing characters), `talk` (while this character's line plays), `bob`, `float`
  (props), `sway`, `shiver` (panic, anger), `pulse`, `spin`. `idleAmp` scales it.

## Directing rules

**Timing**
- Cut on the first word of a phrase. Land the key layer (`slam`/`pop`) on the stressed word, not at
  the scene start — entrances 0.1–0.3 s after the cut read as intentional.
- One accent per beat: a slam + shake + flash together is a punchline; use it once or twice a minute,
  not every scene.
- Keep any scene under ~6 s; if a line runs longer, add a second beat inside it (a prop drops in, a
  bubble appears, the pose swaps via two layers with `exit`/`enter` at the same time).

**Scene patterns** (rotate them; never the same pattern twice in a row)
1. *Scene*: background + 1–2 standing characters with `breathe`, slow camera push, a `tag` for place/time.
2. *Dialogue*: two characters facing each other, bubbles popping in turn; the speaker gets `talk`.
3. *Card*: flat colour + one huge word (`brush`/`title`/`heavy`), slammed, optional `tag` above it.
4. *Collage*: flat colour or blurred bg, title, 3–6 props dropping in with `outline` and `float`,
   speed lines.
5. *List*: `card`/`tag` texts entering one by one on their words, a character reacting at the side.
6. *Close-up reaction*: a single character pose scaled large (`h: 1.1`), `shiver` or `pulse`, cut in
   with `punch`.

**Layout**
- Keep text off faces and inside a 6 % safe margin. Titles sit in the emptiest third of the frame.
- Characters share a ground line; the one further back is smaller and higher. Sizes should be
  believable relative to the background's furniture and doors.
- Limit a frame to one large text element plus at most one small one.
- Text colour must contrast with what is behind it: yellow/white on red or dark, black on yellow or
  white. Over busy illustration use `caption`, `card` or `bubble` (they carry their own backing).

**Transitions**: `cut` by default. `punch` into cards and close-ups, `whip-*` for a change of place or
time, `fade` almost never.

## Troubleshooting

- `[problem] cannot load …` printed by the renderer: wrong path or file name in `story.js`.
- A cutout has a coloured halo: re-run `cutout.py` with a higher `--tol` (45–60); holes inside the
  figure: lower it, or pass the real backdrop colour with `--bg '#00d03c'`.
- Audio and picture drift: the last scene's `to` must equal the audio duration that `audio-map.cjs`
  printed.
- Live preview on a machine with a browser: serve the project folder (`npx serve <project>`), open
  `index.html`, click to play with sound; `?t=12.5` freezes a moment.
