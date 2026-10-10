from PIL import Image
PAL = dict(k=0x0e0c0d,m=0x2c2629,g=0x9a9184,h=0xc9bfae,d=0x5d5348,w=0xf2ece0,W=0xffffff,N=0x1a1416,p=0xe0868a,
 r=0xd02b2b,R=0x8f1d1d,o=0xff9d1c,y=0xffe27a,O=0xb85c00,t=0x6d727c,T=0x3a3d45,q=0xa3a9b4,u=0x8f4f2c,j=0x6b2c2a)
NO_OUT=set('oyW')
W_,H_=44,20
class G:
    def __init__(s): s.px=[['.']*W_ for _ in range(H_)]
    def set(s,x,y,c):
        x,y=round(x),round(y)
        if 0<=x<W_ and 0<=y<H_: s.px[y][x]=c
    def get(s,x,y): return s.px[y][x] if 0<=x<W_ and 0<=y<H_ else '.'
    def stamp(s,x0,y0,art):
        for y,row in enumerate(art):
            for x,c in enumerate(row):
                if c!='.': s.set(x0+x,y0+y,c)
    def ell(s,cx,cy,rx,ry,c):
        for y in range(int(cy-ry)-1,int(cy+ry)+2):
            for x in range(int(cx-rx)-1,int(cx+rx)+2):
                if ((x-cx)/rx)**2+((y-cy)/ry)**2<=1: s.set(x,y,c)
    def outline(s):
        add=[]
        for y in range(H_):
            for x in range(W_):
                if s.px[y][x]!='.': continue
                if any(s.get(x+a,y+b) not in '.' and s.get(x+a,y+b) not in NO_OUT for a,b in((1,0),(-1,0),(0,1),(0,-1))): add.append((x,y))
        for x,y in add: s.px[y][x]='k'

HEAD=[
'.kk..........kk.',
'kgdk........kdgk',
'kgdgkkkkkkkkgdgk',
'kggggggggggggggk',
'kgwwwggggggwwwgk',
'kmmmmmmggmmmmmmk',
'kmmWkmmhhmmWkmmk',
'kmmkkmmhhmmkkmmk',
'.kmmmhwwwwhmmmk.',
'.khhwwwNNwwwhhk.',
'..khhwwkwwwkhk..',
'...kkhhwkkkhk...',
]
TAIL=[
'....kkk',
'...kmmmk',
'...kgggk',
'..kmmmk.',
'..kgggk.',
'.kmmmk..',
'.kgggk..',
'kmmmk...',
]
CAN=['.ttttttq...','tutTttTqq..','ttuTttTqOq.','TttTtuTqOOq','TttTttTqOyq','TttTttTqOOq','TtuTttTqOOq','TttTuuTqOq.','TTTTTTTqq..','.TTTTTTq...']
def pellet(g,x,y,core='y'):
    for a,b in((1,0),(0,1),(2,1),(1,2)): g.set(x+a,y+b,'o')
    g.set(x+1,y+1,core)
BODY_RX={'skinny':4,'snacking':5.5,'round':7,'huge':8.5,'bloated':10.5}
def frame(state):
    g=G(); hx=17
    cx=hx+7.5
    rx=BODY_RX[state]
    # tail behind, right side
    g.stamp(int(cx+rx-2),9,TAIL)
    # body
    ry=4.2+rx*0.08
    g.ell(cx,19.4-ry,rx,ry,'g')
    g.ell(cx,19.6-ry*0.7,rx*0.62,ry*0.75,'h')
    # cheek tufts
    g.set(hx-1,8,'h');g.set(hx-1,9,'h');g.set(hx+16,8,'h');g.set(hx+16,9,'h')
    # arms
    for sx in(-1,1):
        ax=cx+sx*(rx-0.5)
        g.set(ax,14,'d');g.set(ax,15,'d');g.set(ax-sx*0.6,16,'d')
    # feet
    for sx in(-1,1):
        fx=cx+sx*(rx*0.55)
        for dx in(-1,0,1): g.set(fx+dx,19,'d')
    g.outline()
    g.stamp(hx,0,HEAD)
    # bandana
    c0=hx+3
    for x in range(10): g.set(c0+x,12,'r')
    for i,w in enumerate((6,4,2)):
        x0=hx+8-w//2
        for x in range(w): g.set(x0+x,13+i,'R' if x==w-1 else 'r')
    g.set(c0+10,12,'r'); g.set(c0+11,11,'R')
    g.stamp(0,10,CAN)
    for x,y in [(10,17),(13,17),(11,15)]: pellet(g,x,y)
    return g
def render(frames,out,scale=12):
    img=Image.new('RGB',(W_*scale*len(frames)+scale*2*(len(frames)-1),H_*scale),(30,30,30))
    for i,g in enumerate(frames):
        ox=i*(W_*scale+scale*2)
        for y in range(H_):
            for x in range(W_):
                c=g.px[y][x]
                if c=='.': continue
                v=PAL[c]; img.paste(((v>>16)&255,(v>>8)&255,v&255),(ox+x*scale,y*scale,ox+(x+1)*scale,(y+1)*scale))
    img.save(out)
render([frame(s) for s in BODY_RX],'proto.png',8)
render([frame('skinny')],'proto1.png',14)
