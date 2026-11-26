# One reference picture of every Stream Dock page: each key's icon with what to set it to underneath.
from PIL import Image, ImageDraw, ImageFont
F = '/System/Library/Fonts/Supplemental/Arial.ttf'; FB = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
RW = '/System/Library/Fonts/Supplemental/Rockwell.ttc'
def f(sz, bold=False): return ImageFont.truetype(FB if bold else F, sz)
HK = lambda k: ('Hotkey', 'Ctrl+Shift+' + k)
HKA = lambda k: ('Hotkey', 'Ctrl+Option+Shift+' + k)
FOLD = lambda t: ('Folder', 'opens ' + t)
NAV = lambda t: ('Page', t)
GO, RIGHT, WRONG, UNDO = ('go', 'GO', HK('G')), ('right', 'RIGHT', HK('C')), ('wrong', 'WRONG', HK('X')), ('undo', 'UNDO', HK('U'))
BACK = ('back', 'BACK', NAV('back to main page'))
PAGES = [
  ('MAIN PAGE', [GO, ('solve', 'SOLVE', HK('V')), RIGHT, WRONG, UNDO,
    ('pick-2-more', 'PICK 2 MORE', HK('A')), ('pass-turn', 'PASS TURN', HK('P')), ('cards-folder', 'CARDS', FOLD('Cards 1–10')), ('join-screen', 'JOIN SCREEN', HK('J')), ('next-puzzle', 'NEXT PUZZLE', HK('N')),
    ('final-wager', 'FINAL WAGER', HK('F')), ('buzzed-folder', 'BUZZED', FOLD('Buzzed page')), ('theme', 'THEME', HK('T')), ('reveal', 'REVEAL', HK('R')), ('final-scores', 'FINAL SCORES', HK('E'))]),
  ('CARDS 1–10 (inside the CARDS folder)', [(f'card-{n:02d}', f'CARD {n}', HK(str(n % 10))) for n in range(1, 11)] +
    [BACK, GO, RIGHT, WRONG, ('to-11-20', 'CARDS 11–20', NAV('go to Cards 11–20'))]),
  ('CARDS 11–20 (second page of the CARDS folder)', [(f'card-{n:02d}', f'CARD {n}', HKA(str(n % 10))) for n in range(11, 21)] +
    [('to-1-10', 'CARDS 1–10', NAV('go to Cards 1–10')), GO, RIGHT, WRONG, BACK]),
  ('BUZZED (inside the BUZZED folder) — teams in team-list order, left to right', [(f'team-{i}', f'TEAM {i} BUZZED', HK(f'F{i}')) for i in range(1, 5)] +
    [BACK, GO, RIGHT, WRONG, UNDO, None, None, None, None, None, None]),
]
K, GX, LAB, PAD, HEAD = 200, 26, 92, 40, 70
colw = K + GX; pw = 5 * colw - GX; ph = HEAD + 3 * (K + LAB + 16)
W = PAD * 2 + 2 * pw + 60; H = PAD * 2 + 110 + 2 * ph + 40
im = Image.new('RGB', (W, H), '#f6f2e8'); d = ImageDraw.Draw(im)
d.text((PAD, PAD), 'FLIP SIDE · Stream Dock keys', font=ImageFont.truetype(RW, 54, index=2), fill='#1d1a16')
d.text((PAD, PAD + 66), 'Hotkeys use the Control key, not Command. Icons are the PNG files named under each key, in flip-side/streamdock.', font=f(24), fill='#5a554b')
for p, (title, keys) in enumerate(PAGES):
    ox = PAD + (p % 2) * (pw + 60); oy = PAD + 110 + (p // 2) * (ph + 40)
    d.text((ox, oy + 18), title, font=f(28, True), fill='#7d1820')
    for i, k in enumerate(keys):
        x = ox + (i % 5) * colw; y = oy + HEAD + (i // 5) * (K + LAB + 16)
        if not k:
            d.rounded_rectangle([x, y, x + K, y + K], 16, outline='#c9c1ad', width=3); d.text((x + K / 2, y + K / 2), 'leave blank', font=f(20), fill='#9c9482', anchor='mm'); continue
        name, label, (kind, what) = k
        icon = Image.open(name + '.png').resize((K, K), Image.LANCZOS)
        m = Image.new('L', (K, K), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, K - 1, K - 1], 16, fill=255); im.paste(icon, (x, y), m)
        d.text((x + K / 2, y + K + 18), label, font=f(22, True), fill='#1d1a16', anchor='mm')
        d.text((x + K / 2, y + K + 46), what if kind != 'Hotkey' else what, font=f(19, kind == 'Hotkey'), fill='#1f7a46' if kind == 'Hotkey' else '#5a3519', anchor='mm')
        d.text((x + K / 2, y + K + 72), name + '.png', font=f(17), fill='#8a8273', anchor='mm')
im.save('stream-dock-setup.png', optimize=True)
print(im.size)
