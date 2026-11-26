import os, sys
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
S = 144          # layout units; everything below is drawn in a 144-unit square
OUT_PX = 512     # size of the saved PNGs
K = 16           # drawn at 144*16 = 2304 px, then shrunk to OUT_PX so every edge is smooth

class SD:   # an ImageDraw that takes 144-unit coordinates and draws K times bigger
    def __init__(self, d): self.d = d
    def _p(self, pts): return [(x * K, y * K) for x, y in pts]
    def _b(self, b): return [v * K for v in b]
    def _kw(self, kw):
        if 'width' in kw: kw['width'] = max(1, round(kw['width'] * K))
        return kw
    def rounded_rectangle(self, b, r, **kw): self.d.rounded_rectangle(self._b(b), r * K, **self._kw(kw))
    def ellipse(self, b, **kw): self.d.ellipse(self._b(b), **self._kw(kw))
    def line(self, pts, **kw): self.d.line(self._p(pts), **self._kw(kw))
    def polygon(self, pts, **kw): self.d.polygon(self._p(pts), **self._kw(kw))
    def text(self, xy, t, **kw): self.d.text((xy[0] * K, xy[1] * K), t, **kw)
    def textlength(self, t, font): return self.d.textlength(t, font=font) / K
    def textbbox(self, xy, t, **kw): return [v / K for v in self.d.textbbox((xy[0] * K, xy[1] * K), t, **kw)]
RW = '/System/Library/Fonts/Supplemental/Rockwell.ttc'
FELT, FELT_D, RAIL, CREAM, RED, RED_D, GOLD, INK, GOOD, BAD = '#1d5a3c', '#123d28', '#5a3519', '#f7f1e1', '#a8222c', '#7d1820', '#e9b52f', '#1d1a16', '#1f7a46', '#b3202a'

def font(sz): return ImageFont.truetype(RW, round(sz * K), index=2)

def fit(d, lines, maxw, start):
    sz = start
    while sz > 10:
        f = font(sz)
        if all(d.textlength(l, font=f) <= maxw for l in lines) and len(lines) * sz * 1.05 <= maxw: return f, sz
        sz -= 1
    return font(sz), sz

def base(bg, border=None):
    im = Image.new('RGB', (S * K, S * K), bg)
    d = SD(ImageDraw.Draw(im))
    if border: d.rounded_rectangle([5, 5, S - 6, S - 6], 14, outline=border, width=4)
    return im, d

def text(d, lines, color, top=None, maxw=104, start=40, cy=S / 2):
    f, sz = fit(d, lines, maxw, start)
    lh = sz * 1.08
    y0 = (cy if top is None else top) - lh * len(lines) / 2 if top is None else top
    for i, l in enumerate(lines):
        d.text((S / 2, y0 + lh * i + lh / 2), l, font=f, fill=color, anchor='mm')

def small(d, t, color, y):
    f = font(17)
    d.text((S / 2, y), t, font=f, fill=color, anchor='mm')

def save(im, name): im.resize((OUT_PX, OUT_PX), Image.LANCZOS).save(os.path.join(OUT, name + '.png'), optimize=True)

def control(name, lines, bg, fg, border=None, sub=None):
    im, d = base(bg, border)
    if sub:
        small(d, sub, fg, 26)
        text(d, lines, fg, cy=S / 2 + 10, maxw=104)
    else:
        text(d, lines, fg)
    save(im, name)

def mark(name, ok):
    im, d = base(GOOD if ok else BAD, CREAM)
    if ok: d.line([(40, 66), (62, 88), (104, 42)], fill=CREAM, width=15, joint='curve')
    else:
        d.line([(46, 36), (98, 80)], fill=CREAM, width=15); d.line([(98, 36), (46, 80)], fill=CREAM, width=15)
    f = font(25); d.text((S / 2, 114), 'RIGHT' if ok else 'WRONG', font=f, fill=CREAM, anchor='mm')
    save(im, name)

def card(n):   # the red lattice card back with a cream number, like the projector
    im, d = base(RED)
    for k in range(-S, 2 * S, 16):
        d.line([(k, 0), (k + S, S)], fill=RED_D, width=2); d.line([(k, S), (k + S, 0)], fill=RED_D, width=2)
    d.rounded_rectangle([7, 7, S - 8, S - 8], 12, outline=CREAM, width=5)
    d.ellipse([30, 30, S - 30, S - 30], fill=CREAM, outline=RED_D, width=3)
    f = font(50 if n < 10 else 44)
    l, t, r, b = d.textbbox((0, 0), str(n), font=f, anchor='lt')   # centre the ink itself, not the font's line box
    d.text((S / 2 - (l + r) / 2, S / 2 - (t + b) / 2), str(n), font=f, fill=RED_D, anchor='lt')
    save(im, f'card-{n:02d}')

# main page
control('go', ['GO'], GOLD, INK, INK)
control('solve', ['SOLVE'], FELT, GOLD, GOLD)
mark('right', True)
mark('wrong', False)
control('undo', ['↶', 'UNDO'] if False else ['UNDO'], '#3a3a3a', CREAM, CREAM)
control('pick-2-more', ['PICK 2', 'MORE'], FELT, CREAM, CREAM)
control('pass-turn', ['PASS', 'TURN'], FELT, CREAM, CREAM)
control('join-screen', ['JOIN', 'SCREEN'], FELT_D, GOLD)
control('next-puzzle', ['NEXT', 'PUZZLE'], FELT, CREAM, GOLD)
control('open-control', ['CONTROL'], CREAM, INK, INK, sub='OPEN')
control('open-projector', ['PROJECTOR'], CREAM, INK, INK, sub='OPEN')
control('open-script', ['SCRIPT'], CREAM, INK, INK, sub='OPEN')
control('reveal', ['REVEAL'], FELT_D, GOLD, BAD, sub='NO POINTS')
control('final-scores', ['FINAL', 'SCORES'], FELT_D, GOLD, GOLD)

# folders and navigation (walnut, like the table rail)
def cards_folder():
    im, d = base(RAIL, GOLD)
    for i, (x, y) in enumerate([(34, 30), (52, 38), (70, 46)]):
        d.rounded_rectangle([x, y, x + 40, y + 54], 6, fill=RED if i < 2 else CREAM, outline=CREAM if i < 2 else RED_D, width=3)
    d.text((S / 2, 117), 'CARDS', font=font(26), fill=GOLD, anchor='mm')
    save(im, 'cards-folder')
cards_folder()
def nav(name, label, left, fg, border):
    im, d = base(RAIL, border)
    cx, cy = S / 2, 50
    pts = [(cx - 24, cy), (cx + 18, cy - 24), (cx + 18, cy + 24)] if left else [(cx + 24, cy), (cx - 18, cy - 24), (cx - 18, cy + 24)]
    d.polygon(pts, fill=fg)
    f, sz = fit(d, [label], 112, 38)
    d.text((S / 2, 106), label, font=f, fill=fg, anchor='mm')
    save(im, name)
nav('back', 'BACK', True, CREAM, None)
nav('to-11-20', '11–20', False, GOLD, GOLD)
nav('to-1-10', '1–10', True, GOLD, GOLD)
for n in range(1, 21): card(n)
