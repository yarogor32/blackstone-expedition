from pathlib import Path
from PIL import Image

root=Path(__file__).resolve().parents[1]
generated=Path(r'C:/Users/yarog/.codex/generated_images/01a0bd9f-9ccb-7993-97a4-4e6f0d855c87')
def load(name):
    image=Image.open(generated/name).convert('RGBA')
    bounds=image.getchannel('A').point(lambda a:255 if a>16 else 0).getbbox()
    return image.crop(bounds)
image=load('exec-cd137faf-f1a1-4953-8050-c6c4cd2e3f36.png')
image.save(root/'ui/button-wide-backing-v2.png')
w,h=image.size
cap=round(w*.18)
image.crop((0,0,cap,h)).save(root/'ui/button-left-v2.png')
image.crop((w-cap,0,w,h)).save(root/'ui/button-right-v2.png')
strip=image.crop((cap,0,w-cap,h))
tile=Image.new('RGBA',(strip.width*2,h))
tile.paste(strip,(0,0))
tile.paste(strip.transpose(Image.Transpose.FLIP_LEFT_RIGHT),(strip.width,0))
tile.save(root/'ui/button-middle-v2.png')
load('exec-c08a4235-5a5b-4a8d-863b-b5957a3d14b1.png').save(root/'ui/button-main-menu-v1.png')
print({'cap':(cap,h),'middle':tile.size,'middle_display_width_at_80px':round(tile.width/h*80)})
