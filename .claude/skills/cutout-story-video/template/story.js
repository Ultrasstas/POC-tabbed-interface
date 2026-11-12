// Example story: 16 s, 16:9. The art in img/ is PLACEHOLDER (simple shapes) - replace with real illustrations.
// Times: scene from/to are seconds on the audio track; `at` inside a layer/fx is seconds from the scene start.
export default {
  width: 1920, height: 1080, fps: 30,
  audio: 'audio/voice.mp3',
  scenes: [
    // 1. establishing: character in a room, label, slow push-in
    { from: 0, to: 4.0, bg: '#eec478', camera: { zoom: [1.0, 1.12], pan: [[0, 0], [-30, -10]] },
      layers: [
        { img: 'img/01_bg_room.png', fit: 'cover', depth: 0.35 },
        { img: 'img/cat_calm.png', x: 0.36, y: 0.97, h: 0.74, anchor: 'bottom', idle: 'breathe', shadow: true, enter: { type: 'slide-right', at: 0.1 } },
        { text: 'понедельник, 9:00', style: 'tag', x: 0.12, y: 0.09, enter: { type: 'wipe', at: 0.5 } },
        { text: 'Всё под *контролем.*', style: 'caption', x: 0.5, y: 0.9, enter: { type: 'words', at: 0.9, dur: 0.7 } },
      ] },
    // 2. punchline card: flat colour + one dirty word, slammed in with a shake
    { from: 4.0, to: 6.2, bg: '#ffe500', in: 'punch', camera: { zoom: [1, 1.04] },
      fx: [{ type: 'shake', at: 0.12, dur: 0.45, amp: 22 }, { type: 'flash', at: 0.1 }],
      layers: [
        { text: 'режим №2', style: 'tag', x: 0.5, y: 0.3, enter: { type: 'pop', at: 0.35 } },
        { text: 'ТРЕВОЖНО', style: 'brush', x: 0.5, y: 0.52, rotate: -3, enter: { type: 'slam', at: 0.1 }, idle: 'shiver', idleAmp: 0.6 },
      ] },
    // 3. dialogue: two characters, speech bubbles timed to the lines
    { from: 6.2, to: 11.4, bg: '#78beeb', in: 'whip-left', camera: { zoom: [1.04, 1.0], pan: [[20, 0], [-20, 0]] },
      layers: [
        { img: 'img/03_bg_city.png', fit: 'cover', depth: 0.3 },
        { img: 'img/dog.png', x: 0.73, y: 0.98, h: 0.66, anchor: 'bottom', idle: 'talk', shadow: true, flip: true, enter: { type: 'pop', at: 0.2 } },
        { img: 'img/cat_shock.png', x: 0.27, y: 0.98, h: 0.72, anchor: 'bottom', idle: 'breathe', shadow: true },
        { text: 'А деньги где?', style: 'bubble', tail: 'right', x: 0.6, y: 0.2, enter: { type: 'pop', at: 0.7 }, exit: { type: 'fade', at: 2.8 } },
        { text: 'Какие деньги?..', style: 'bubble', tail: 'left', x: 0.3, y: 0.16, enter: { type: 'pop', at: 3.1 } },
      ] },
    // 4. collage: props raining onto a loud title with speed lines
    { from: 11.4, to: 16.04, bg: '#e10600', in: 'punch',
      fx: [{ type: 'speedlines', at: 0, color: 'rgba(0,0,0,.35)' }, { type: 'shake', at: 0.1, dur: 0.35 }],
      layers: [
        { text: 'НЕДОСТАТОЧНО\nСРЕДСТВ', style: 'title', x: 0.5, y: 0.33, size: 200, color: '#ffe500', enter: { type: 'slam', at: 0.05 } },
        { img: 'img/cat_shock.png', x: 0.5, y: 1.06, h: 0.6, anchor: 'bottom', idle: 'shiver', enter: { type: 'slide-up', at: 0.3 } },
        { img: 'img/money.png', x: 0.14, y: 0.7, w: 0.17, rotate: -14, idle: 'float', outline: 6, enter: { type: 'drop', at: 0.5 } },
        { img: 'img/money.png', x: 0.86, y: 0.66, w: 0.15, rotate: 18, idle: 'float', outline: 6, enter: { type: 'drop', at: 0.75 } },
        { img: 'img/money.png', x: 0.93, y: 0.12, w: 0.09, rotate: -30, idle: 'spin', idleAmp: 0.4, outline: 6, enter: { type: 'pop', at: 1.0 } },
        { text: 'хватит\nтерпеть!', style: 'sticker', x: 0.83, y: 0.9, rotate: -8, enter: { type: 'spin', at: 1.4 }, idle: 'pulse' },
      ] },
  ],
};
