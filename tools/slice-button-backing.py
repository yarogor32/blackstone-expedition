from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = Image.open(r'C:/Users/yarog/.codex/generated_images/01a0bd9f-9ccb-7993-97a4-4e6f0d855c87/exec-e96ac653-c172-4467-baed-23ef3ec9084c.png').convert('RGBA')
box = source.getchannel('A').getbbox()
source = source.crop(box)
source.save(root / 'ui/button-backing-v1.png')
w, h = source.size
cap = round(w * .27)
source.crop((0, 0, cap, h)).save(root / 'ui/button-left-v1.png')
source.crop((w-cap, 0, w, h)).save(root / 'ui/button-right-v1.png')
# A narrow central strip mirrored horizontally repeats without a tile seam.
strip = source.crop((w//2-64, 0, w//2+64, h))
tile = Image.new('RGBA', (256, h))
tile.paste(strip, (0, 0))
tile.paste(strip.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (128, 0))
tile.save(root / 'ui/button-middle-v1.png')
print({'backing': source.size, 'caps': (cap, h), 'tile': tile.size})
