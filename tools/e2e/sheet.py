import sys
from PIL import Image, ImageDraw
out=sys.argv[1]; files=sys.argv[2:]; H=720
ims=[]
for f in files:
    im=Image.open(f).convert('RGB'); s=H/im.height; im=im.resize((max(1,int(im.width*s)),H)); ims.append((f,im))
W=sum(i.width for _,i in ims)+16*(len(ims)-1)
c=Image.new('RGB',(W,H+22),'white'); x=0; d=ImageDraw.Draw(c)
for f,i in ims:
    c.paste(i,(x,22)); d.text((x+4,4),f.split('/')[-1][:60],fill='black'); x+=i.width+16
c.save(out)
