#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
ASSETS.mkdir(exist_ok=True)


def lerp(a, b, t):
    return int(a + (b - a) * t)


def rounded_rect(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def paint_gradient(size, c1, c2):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    px = img.load()
    for y in range(size):
        t = y / max(size - 1, 1)
        color = (
            lerp(c1[0], c2[0], t),
            lerp(c1[1], c2[1], t),
            lerp(c1[2], c2[2], t),
            255
        )
        for x in range(size):
            px[x, y] = color
    return img


def draw_icon(size=512):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    s = size / 512.0

    def u(v):
        return int(round(v * s))

    bg = paint_gradient(size, (11, 28, 36), (13, 148, 136))
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=u(96), fill=255)
    plate = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    plate.paste(bg, mask=mask)
    img = Image.alpha_composite(img, plate)

    draw = ImageDraw.Draw(img)
    highlight = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    hd = ImageDraw.Draw(highlight)
    hd.rounded_rectangle((u(10), u(10), size - u(10), u(170)), radius=u(80), fill=(255, 255, 255, 28))
    img = Image.alpha_composite(img, highlight)
    draw = ImageDraw.Draw(img)

    cal = (u(86), u(78), u(426), u(430))
    shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((cal[0] + u(8), cal[1] + u(14), cal[2] + u(8), cal[3] + u(14)), radius=u(46), fill=(0, 20, 24, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(u(10)))
    img = Image.alpha_composite(img, shadow)
    draw = ImageDraw.Draw(img)

    rounded_rect(draw, cal, u(46), (248, 251, 252), (226, 232, 240), u(4))
    header = (cal[0], cal[1], cal[2], cal[1] + u(88))
    draw.rounded_rectangle(header, radius=u(46), fill=(13, 148, 136))
    draw.rectangle((cal[0], cal[1] + u(44), cal[2], header[3]), fill=(13, 148, 136))

    for cx in (u(176), u(256), u(336)):
        draw.rounded_rectangle((cx - u(10), u(58), cx + u(10), u(98)), radius=u(8), fill=(248, 251, 252))
        draw.ellipse((cx - u(14), u(46), cx + u(14), u(74)), fill=(204, 251, 241), outline=(15, 118, 110), width=u(4))

    cols, rows = 4, 3
    grid_l, grid_t = u(118), u(192)
    cell, gap = u(58), u(16)
    paid = {(0, 0), (1, 0), (2, 0), (0, 1)}
    partial = (1, 1)
    for r in range(rows):
        for c in range(cols):
            x = grid_l + c * (cell + gap)
            y = grid_t + r * (cell + gap)
            box = (x, y, x + cell, y + cell)
            if (c, r) in paid:
                rounded_rect(draw, box, u(12), (13, 148, 136))
                draw.line((x + u(12), y + u(32), x + u(24), y + u(44), x + u(46), y + u(16)), fill=(255, 255, 255), width=u(6), joint='curve')
            elif (c, r) == partial:
                rounded_rect(draw, box, u(12), (204, 251, 241), (13, 148, 136), u(4))
                draw.rectangle((x, y + cell // 2, x + cell, y + cell), fill=(13, 148, 136))
                draw.pieslice((x - u(2), y + cell // 2 - u(14), x + cell + u(2), y + cell + u(2)), 0, 180, fill=(13, 148, 136))
            else:
                rounded_rect(draw, box, u(12), (241, 245, 249), (148, 163, 184), u(3))

    badge_c = (u(400), u(400))
    br = u(58)
    draw.ellipse((badge_c[0] - br, badge_c[1] - br, badge_c[0] + br, badge_c[1] + br), fill=(245, 158, 11), outline=(255, 237, 213), width=u(6))
    draw.ellipse((badge_c[0] - u(38), badge_c[1] - u(38), badge_c[0] + u(38), badge_c[1] + u(38)), outline=(255, 251, 235), width=u(5))
    draw.rectangle((badge_c[0] - u(6), badge_c[1] - u(22), badge_c[0] + u(6), badge_c[1] + u(22)), fill=(255, 251, 235))
    draw.arc((badge_c[0] - u(16), badge_c[1] - u(18), badge_c[0] + u(18), badge_c[1] + u(4)), 200, 20, fill=(255, 251, 235), width=u(6))
    draw.arc((badge_c[0] - u(18), badge_c[1] - u(2), badge_c[0] + u(16), badge_c[1] + u(20)), 20, 200, fill=(255, 251, 235), width=u(6))
    return img


def main():
    master = draw_icon(512)
    png_path = ASSETS / 'icon.png'
    master.resize((256, 256), Image.Resampling.LANCZOS).save(png_path, 'PNG')

    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    ico_path = ASSETS / 'icon.ico'
    master.save(ico_path, format='ICO', sizes=ico_sizes)

    print(f'wrote {png_path} ({png_path.stat().st_size} bytes)')
    print(f'wrote {ico_path} ({ico_path.stat().st_size} bytes)')


if __name__ == '__main__':
    main()
