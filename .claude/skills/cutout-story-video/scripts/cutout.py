#!/usr/bin/env python3
"""Cut a character/prop off a flat-colour background -> transparent PNG, trimmed to its bounding box.

  python3 cutout.py in.png out.png [--tol 38] [--bg auto|#00ff00] [--pad 12]

Only background connected to the image border is removed, so white eyes / highlights inside the
drawing survive even on a white background. Works best when the art was generated on a plain,
evenly lit colour that does not appear in the subject (see story-art-prompts).
"""
import sys, argparse
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

p = argparse.ArgumentParser(); p.add_argument('src'); p.add_argument('dst')
p.add_argument('--tol', type=float, default=38); p.add_argument('--bg', default='auto'); p.add_argument('--pad', type=int, default=12)
a = p.parse_args()
im = Image.open(a.src).convert('RGBA'); rgb = np.asarray(im)[..., :3].astype(np.int32); h, w = rgb.shape[:2]
if np.asarray(im)[..., 3].min() < 250:  # already transparent: just trim
    alpha = im.getchannel('A')
else:
    if a.bg == 'auto':
        border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]); bg = np.median(border, axis=0)
    else:
        v = a.bg.lstrip('#'); bg = np.array([int(v[i:i + 2], 16) for i in (0, 2, 4)])
    cand = (np.sqrt(((rgb - bg) ** 2).sum(-1)) < a.tol)
    mask = Image.fromarray((cand * 255).astype(np.uint8)).copy()         # 255 = looks like background
    step = max(1, min(w, h) // 200)
    seeds = [(x, y) for x in range(0, w, step) for y in (0, h - 1)] + [(x, y) for y in range(0, h, step) for x in (0, w - 1)]
    for s in seeds:                                                   # flood from the border only
        if mask.getpixel(s) == 255: ImageDraw.floodfill(mask, s, 128)
    outside = np.asarray(mask) == 128
    alpha = Image.fromarray(((~outside) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
im.putalpha(alpha)
box = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()
if box:
    box = (max(0, box[0] - a.pad), max(0, box[1] - a.pad), min(w, box[2] + a.pad), min(h, box[3] + a.pad)); im = im.crop(box)
im.save(a.dst)
kept = (np.asarray(im.getchannel('A')) > 8).mean()
print(f'{a.dst}: {im.size[0]}x{im.size[1]}, subject covers {kept:.0%} of the crop')
if kept > 0.97: print('WARNING: almost nothing was removed - background is not flat enough; raise --tol or regenerate on a plain colour', file=sys.stderr)
if kept < 0.03: print('WARNING: almost everything was removed - lower --tol or pass the real --bg colour', file=sys.stderr)
