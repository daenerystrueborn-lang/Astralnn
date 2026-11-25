from pathlib import Path
import random, math, json, subprocess, sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public' / 'assets'
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'world').mkdir(exist_ok=True)
(OUT / 'icons').mkdir(exist_ok=True)
random.seed(241125)

def save(name, body, width=1920, height=1080, defs=''):
    common = '''<defs>
    <linearGradient id="night" x2=".8" y2="1"><stop stop-color="#252439"/><stop offset=".5" stop-color="#161f31"/><stop offset="1" stop-color="#080f1b"/></linearGradient>
    <linearGradient id="wood" x2=".7" y2="1"><stop stop-color="#514442"/><stop offset=".3" stop-color="#302a31"/><stop offset=".65" stop-color="#211e29"/><stop offset="1" stop-color="#100f18"/></linearGradient>
    <linearGradient id="gold" x2=".8" y2="1"><stop stop-color="#f3df9d"/><stop offset=".25" stop-color="#bda46d"/><stop offset=".55" stop-color="#796045"/><stop offset=".8" stop-color="#dbc58c"/><stop offset="1" stop-color="#957347"/></linearGradient>
    <linearGradient id="stone" x2="1" y2="1"><stop stop-color="#9aa49b"/><stop offset=".45" stop-color="#5e716d"/><stop offset="1" stop-color="#303f45"/></linearGradient>
    <linearGradient id="leaf" x2=".7" y2="1"><stop stop-color="#9fab60"/><stop offset=".4" stop-color="#4c8152"/><stop offset="1" stop-color="#183f3c"/></linearGradient>
    <linearGradient id="cloth" x2="1" y2="1"><stop stop-color="#eee5d6"/><stop offset=".35" stop-color="#c6bfc0"/><stop offset="1" stop-color="#757481"/></linearGradient>
    <linearGradient id="crystal" x2=".8" y2="1"><stop stop-color="#f6e5ff"/><stop offset=".3" stop-color="#bdb6ff"/><stop offset=".65" stop-color="#7964d3"/><stop offset="1" stop-color="#334574"/></linearGradient>
    <radialGradient id="aura"><stop stop-color="#aaa0dd" stop-opacity=".55"/><stop offset="1" stop-color="#9992e0" stop-opacity="0"/></radialGradient>
    <radialGradient id="warm"><stop stop-color="#ffe7ad" stop-opacity=".8"/><stop offset="1" stop-color="#ffe7ad" stop-opacity="0"/></radialGradient>
    <filter id="grain"><feTurbulence baseFrequency=".55" numOctaves="3" seed="41" type="fractalNoise" stitchTiles="stitch" result="noise"/><feColorMatrix in="noise" type="saturate" values="0"/><feBlend in="SourceGraphic" mode="soft-light"/></filter>
    <filter id="glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="5"/></filter>
    <filter id="shadow" x="-35%" y="-35%" width="170%" height="180%"><feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#07131b" flood-opacity=".7"/></filter>
    <path id="star" d="M0 -14 3 -3 14 0 3 3 0 14 -3 3 -14 0 -3 -3Z"/>
    </defs>'''
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">{common}{defs}{body}</svg>'
    (OUT / name).write_text(svg,encoding='utf-8')

def observatory():
    p=['<rect width="1920" height="1080" fill="url(#night)"/>', '<ellipse cx="960" cy="425" rx="720" ry="610" fill="url(#aura)"/>']
    p+=['''<defs><linearGradient id="glass" y2="1" x2=".2"><stop stop-color="#9486b1"/><stop offset=".5" stop-color="#858db9"/><stop offset="1" stop-color="#394664"/></linearGradient><linearGradient id="floor" y2="1"><stop stop-color="#292d3b"/><stop offset="1" stop-color="#111824"/></linearGradient><pattern id="books" width="98" height="94" patternUnits="userSpaceOnUse"><path d="M0 91H98" stroke="#8b704f" stroke-width="5"/><path d="M8 20V86M25 10V87M47 17V88M67 27V86M84 11V88" stroke="#514255" stroke-width="13"/><path d="M8 26V76M25 18V78M47 26V78M67 33V77M84 18V78" stroke="#987b63" stroke-width="2"/><path d="M2 36h12M19 30h12M41 39h12M61 44h12M78 29h12" stroke="#c0a572" stroke-opacity=".5"/></pattern></defs>''']
    # Vast painted arched windows and mullions.
    for x,w,top in [(260,265,236),(635,650,120),(1400,260,236)]:
        y=top;bot=755
        arch=f'M{x} {bot}V{y+w/2}A{w/2} {w/2} 0 0 1 {x+w} {y+w/2}V{bot}Z'
        p.append(f'<path d="{arch}" fill="url(#glass)" stroke="#655965" stroke-width="22"/>')
        p.append(f'<path d="{arch}" fill="none" stroke="#d6b982" stroke-opacity=".35" stroke-width="3"/>')
        for xx in range(int(x+w/5),int(x+w),max(1,int(w/5))):
            p.append(f'<path d="M{xx} {y+w/2}V{bot}" stroke="#3b3648" stroke-width="12"/><path d="M{xx-3} {y+w/2}V{bot}" stroke="#c6ac91" stroke-opacity=".25" stroke-width="2"/>')
        for yy in [y+w*.53,y+w*.95,bot-130]:
            p.append(f'<path d="M{x} {yy}H{x+w}" stroke="#393443" stroke-width="13"/>')
        p.append(f'<path d="M{x+15} {bot-40}L{x+w-15} {y+w/2+30}L{x+w-15} {bot-100}Z" fill="#efe2ed" opacity=".065"/>')
    # The window opens onto an illustrated academy skyline and celestial sky.
    p.append('<defs><clipPath id="skywindow"><path d="M649 747V452A311 311 0 0 1 1271 452V747Z"/></clipPath><radialGradient id="moonlight"><stop stop-color="#dbc7ea" stop-opacity=".65"/><stop offset="1" stop-color="#dbc7ea" stop-opacity="0"/></radialGradient></defs>')
    p.append('<g clip-path="url(#skywindow)"><ellipse cx="1170" cy="262" rx="190" ry="170" fill="url(#moonlight)"/><circle cx="1170" cy="262" r="53" fill="#d3c5d9" opacity=".36"/><path d="M1141 229Q1183 204 1210 246Q1185 226 1156 249Q1139 266 1141 229Z" fill="#eef0e7" opacity=".16"/><path d="M630 710V678L700 658L726 684V622L745 607V558L755 516L765 558V610L782 624V686L845 676V650L869 637V601L882 577L895 601V641L919 655V679L965 689V665L1010 650L1044 675V604L1059 586V533L1071 475L1084 533V590L1101 608V681L1168 693V664L1197 638V606L1208 575L1220 606V641L1243 665V689L1282 675V758H630Z" fill="#3a4562" opacity=".37"/><path d="M657 691Q887 670 1271 713" fill="none" stroke="#b8bbc9" stroke-width="3" opacity=".15"/></g>')
    for _ in range(48):
        x=random.randrange(706,1230);y=random.randrange(227,560)
        p.append(f'<circle cx="{x}" cy="{y}" r="{random.uniform(.6,1.8):.1f}" fill="#eee7ec" opacity="{random.uniform(.18,.45):.2f}"/>')
    # Celestial instrument beyond the heroine.
    p.append('<g transform="translate(960 425)" fill="none" stroke="url(#gold)" opacity=".58"><circle r="202" stroke-width="7"/><circle r="178" stroke-width="2"/><ellipse rx="231" ry="73" transform="rotate(-23)" stroke-width="5"/><ellipse rx="221" ry="63" transform="rotate(58)" stroke-width="4"/><circle r="46" fill="#37374a" stroke-width="8"/><circle r="20" stroke-width="3"/><path d="M-250 0H250M0 -240V240" stroke-width="3"/></g>')
    for a in range(0,360,15):
        r=190;x=960+math.cos(math.radians(a))*r;y=425+math.sin(math.radians(a))*r
        p.append(f'<use href="#star" transform="translate({x:.1f} {y:.1f}) scale(.32)" fill="#ecdcaa" opacity=".65"/>')
    # Carved walls, shelves and soaring arches.
    for x in [-30,1700]:
        p.append(f'<rect x="{x}" y="170" width="250" height="700" rx="7" fill="url(#wood)" stroke="#7e6957" stroke-width="9"/><rect x="{x+20}" y="200" width="210" height="620" fill="url(#books)"/>')
    for x in [70,565,1320,1810]:
        p.append(f'<path d="M{x-35} 960V240Q{x-30} 150 {x} 85Q{x+32} 150 {x+35} 240V960Z" fill="url(#wood)" stroke="#6b5b5c" stroke-width="4"/><path d="M{x-18} 905V242M{x+18} 905V242" stroke="#b49a73" stroke-opacity=".24" stroke-width="4"/>')
        p.append(f'<path d="M{x-58} 872H{x+58}L{x+48} 893H{x-48}Z" fill="url(#gold)" opacity=".5"/>')
        for yy in [320,500,680]:
            p.append(f'<path d="M{x} {yy-47}Q{x-17} {yy-18} {x} {yy}Q{x+17} {yy+18} {x} {yy+47}M{x} {yy-24}Q{x+17} {yy-7} {x} {yy+12}M{x} {yy-12}Q{x-16} {yy+5} {x} {yy+24}" fill="none" stroke="#ae976e" stroke-width="2" opacity=".25"/>')
    p.append('<path d="M-100 0H2020V100Q1580 55 1430 235Q1320 -5 960 50Q600 -5 490 235Q340 55 -100 100Z" fill="url(#wood)" stroke="#7f6c60" stroke-width="7"/>')
    p.append('<path d="M150 80Q375 0 565 262M1770 80Q1545 0 1320 262M565 90Q960 -110 1320 90" fill="none" stroke="#b49972" stroke-opacity=".35" stroke-width="5"/>')
    # Perspective stone floor with gold navigational inlays.
    p.append('<path d="M0 790H1920V1080H0Z" fill="url(#floor)"/>')
    for xx in range(-1000,3000,175):p.append(f'<path d="M960 740L{xx} 1080" stroke="#717079" stroke-opacity=".18" stroke-width="3"/>')
    for yy in [812,844,887,947,1030]:p.append(f'<path d="M0 {yy}H1920" stroke="#6f727d" stroke-opacity=".22" stroke-width="3"/>')
    p.append('<ellipse cx="970" cy="977" rx="480" ry="108" fill="none" stroke="#af9462" stroke-opacity=".27" stroke-width="3"/><ellipse cx="970" cy="977" rx="460" ry="99" fill="none" stroke="#af9462" stroke-opacity=".2"/>')
    # Observatory equipment: layered brass telescope, lectern, telescope tripod.
    p.append('''<g transform="translate(310 755)"><ellipse cy="240" rx="225" ry="35" fill="#081019" opacity=".6"/><path d="M0 -10L-120 215M0 -10L135 215M0 -10V210" stroke="#191921" stroke-width="18"/><path d="M-7 0L-118 208M9 0L132 208" stroke="#967949" stroke-width="4"/><g transform="rotate(-24)"><rect x="-142" y="-105" width="315" height="62" rx="12" fill="url(#gold)" stroke="#554634" stroke-width="4"/><ellipse cx="174" cy="-75" rx="13" ry="35" fill="#131f2b" stroke="#ceb87d" stroke-width="7"/><ellipse cx="181" cy="-75" rx="7" ry="27" fill="#728dae" opacity=".8"/><path d="M-100 -111V-39M55 -110V-40" stroke="#dfcb95" stroke-width="13"/></g><circle cy="-30" r="25" fill="url(#gold)" stroke="#7c6548" stroke-width="6"/></g>''')
    p.append('<g transform="translate(1490 864)"><path d="M-115 -50H120L80 160H-78Z" fill="url(#wood)" stroke="#957b5b" stroke-width="4"/><path d="M-145 -86L70 -133L145 -65L-70 -18Z" fill="#b7a993" stroke="#57464b" stroke-width="5"/><path d="M-130 -76L65 -118L117 -70L-69 -33Z" fill="#d4c9ab"/><path d="M-9 -104L-1 -48" stroke="#80765d"/><path d="M-102 -72L-24 -86M-91 -59L-18 -75M15 -93L63 -103M20 -80L75 -91" stroke="#9b906f" stroke-width="2" opacity=".45"/></g>')
    # Hanging oil lamps provide warm visual anchors.
    for x,y in [(173,355),(1750,355)]:
        p.append(f'<ellipse cx="{x}" cy="{y+40}" rx="190" ry="190" fill="url(#warm)" opacity=".3"/><path d="M{x} 60V{y-38}" stroke="#9d865f" stroke-width="4"/><path d="M{x-24} {y-35}L{x+24} {y-35}L{x+35} {y+33}L{x-35} {y+33}Z" fill="#e1c283" opacity=".76" stroke="#b4965d" stroke-width="5"/><path d="M{x-39} {y+38}H{x+39}M{x-32} {y-40}H{x+32}" stroke="#b4965d" stroke-width="7"/>')
    # Scatter natural celestial dust, not UI stars.
    for _ in range(82):
        x=random.randint(190,1730);y=random.randint(100,935);r=random.choice([1,1,1.5,2])
        p.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#e8d3b1" opacity="{random.uniform(.15,.5):.2f}"/>')
    p.append('<rect width="1920" height="1080" fill="#55526d" filter="url(#grain)" opacity=".06"/><path d="M0 0H1920V1080H0Z" fill="none" stroke="#060a13" stroke-width="80" opacity=".35"/>')
    save('observatory.svg',''.join(p))

def foliage(x,y,s=1,color='url(#leaf)'):
    foliage.uid+=1
    cid='canopy'+str(foliage.uid)
    shape='M-84 19Q-114 -26 -61 -39Q-60 -79 -15 -68Q6 -112 43 -77Q91 -74 83 -28Q129 -1 93 30Q56 49 17 30Q-35 57 -84 19Z'
    rng=random.Random(int(x*13+y*7+s*101))
    detail=[]
    for _ in range(48):
        xx=rng.randrange(-103,112);yy=rng.randrange(-98,43);sz=rng.uniform(4,10);rot=rng.randrange(-75,75)
        tint=rng.choice(['#c0c893','#a7b786','#90a775','#60885a','#234d3c'])
        detail.append(f'<path transform="translate({xx} {yy}) rotate({rot})" d="M{-sz} 0Q0 {-sz*.85} {sz} 0Q0 {sz*.48} {-sz} 0Z" fill="{tint}" opacity="{rng.uniform(.08,.28):.2f}"/>')
    return f'<g transform="translate({x} {y}) scale({s})"><defs><clipPath id="{cid}"><path d="{shape}"/></clipPath></defs><path d="{shape}" fill="{color}"/><path d="M-63 -26Q-18 -64 36 -56Q66 -42 74 -15Q31 -36 -6 -10Q-33 -23 -63 -26Z" fill="#a4bc78" opacity=".15"/><g clip-path="url(#{cid})">'+''.join(detail)+f'</g><path d="M-47 17Q-10 -4 34 11" fill="none" stroke="#b2c385" stroke-width="2" opacity=".12"/></g>'
foliage.uid=0

def village():
    p=['''<defs><linearGradient id="sky" y2="1"><stop stop-color="#75aebc"/><stop offset=".62" stop-color="#d6d6bd"/><stop offset="1" stop-color="#eee1be"/></linearGradient><linearGradient id="meadow" y2="1"><stop stop-color="#8ea469"/><stop offset="1" stop-color="#536b4b"/></linearGradient><linearGradient id="plaster" x2="1" y2="1"><stop stop-color="#ece1bf"/><stop offset="1" stop-color="#a49d7e"/></linearGradient><linearGradient id="roof" x2=".5" y2="1"><stop stop-color="#71868c"/><stop offset="1" stop-color="#3b5159"/></linearGradient><linearGradient id="road" x2=".3" y2="1"><stop stop-color="#c5b898"/><stop offset="1" stop-color="#8b8574"/></linearGradient></defs><rect width="1920" height="1080" fill="url(#sky)"/><ellipse cx="1480" cy="160" rx="600" ry="480" fill="url(#warm)" opacity=".6"/>''']
    for x,y,s in [(150,100,1),(770,145,1.5),(1450,90,1.2)]:
        p.append(f'<g transform="translate({x} {y}) scale({s})" opacity=".36" fill="#fff9df"><path d="M-170 42Q-171 7 -99 9Q-58 -45 1 -13Q55 -60 96 -19Q162 -18 187 28Q261 18 265 51Z"/><path d="M-222 59Q-122 37 92 57Q206 44 289 64" fill="none" stroke="#fff9df" stroke-width="9"/></g>')
    p.append('<path d="M0 465L145 317L259 401L425 286L610 407L790 342L970 446L1180 312L1390 423L1600 281L1920 430V700H0Z" fill="#789595" opacity=".55"/><path d="M0 529Q300 448 510 507Q775 411 980 500Q1230 461 1490 502Q1730 416 1920 494V800H0Z" fill="#789471"/><path d="M0 660Q360 511 740 594Q1150 518 1490 650Q1770 590 1920 656V1080H0Z" fill="url(#meadow)"/><path d="M1120 612Q994 726 924 790Q775 845 689 1080H1580Q1340 911 1200 797Q1120 707 1120 612Z" fill="url(#road)"/>')
    # Fine scenic houses, shutters, timber frames, stone foundations and tiled roofs.
    for x,y,s in [(330,576,.85),(650,516,.58),(1340,550,.77),(1610,583,1.05),(960,516,.4)]:
        p.append(f'<g transform="translate({x} {y}) scale({s})"><path d="M-150 -190H148V134H-150Z" fill="url(#plaster)" stroke="#847d65" stroke-width="5"/><path d="M148 -190L222 -146V125L148 134Z" fill="#aaa185"/><path d="M-188 -175L-20 -327L186 -177Z" fill="url(#roof)" stroke="#3f5057" stroke-width="8"/><path d="M-20 -327L59 -322L251 -134L186 -177Z" fill="#526c77"/><path d="M-146 -167H143M-146 -27H143M-146 107H143M-104 -180V111M85 -180V111" stroke="#645b4f" stroke-width="10"/><path d="M-95 -153L76 -42M-95 -45L77 -155" stroke="#645b4f" stroke-width="7"/><path d="M-29 126V28Q-29 -14 22 -14Q72 -14 72 28V126Z" fill="url(#wood)" stroke="#857857" stroke-width="7"/><circle cx="52" cy="72" r="4" fill="#d4be7d"/><path d="M-139 106H145V137H-139Z" fill="url(#stone)"/>')
        for xx,yy in [(-74,-92),(78,-92),(-80,50)]:
            p.append(f'<rect x="{xx-23}" y="{yy-30}" width="46" height="60" rx="4" fill="#233d43" stroke="#9b8c69" stroke-width="6"/><path d="M{xx} {yy-27}V{yy+27}M{xx-20} {yy}H{xx+20}" stroke="#a69670" stroke-width="3"/><path d="M{xx-34} {yy-27}V{yy+27}M{xx+34} {yy-27}V{yy+27}" stroke="#687e72" stroke-width="12"/>')
        for yy in [-220,-246,-272]:p.append(f'<path d="M{-140+(abs(yy)-220)*.8} {yy}H{144-(abs(yy)-220)*.8}" stroke="#a1afb0" opacity=".25" stroke-width="3"/>')
        p.append('<path d="M91 -252V-329H127V-223" fill="#aba38b" stroke="#756d60" stroke-width="4"/><path d="M84 -329H133" stroke="#7c7567" stroke-width="10"/><path d="M-147 96Q-75 83 -34 104" fill="none" stroke="#6b8355" stroke-width="14"/></g>')
    # Foreground trees create canopy depth.
    for x,y,s in [(110,750,2.35),(1820,755,2.45),(1510,616,1.2),(480,622,1.15),(850,576,.75)]:
        p.append(f'<path d="M{x-17*s} {y+90*s}Q{x+5*s} {y-40*s} {x-20*s} {y-125*s}L{x+14*s} {y-125*s}Q{x-1*s} {y} {x+32*s} {y+90*s}Z" fill="url(#wood)"/><path d="M{x} {y-5*s}L{x-63*s} {y-110*s}M{x} {y-30*s}L{x+65*s} {y-140*s}" stroke="#67644c" stroke-width="{9*s}"/>')
        for ox,oy,ss in [(-54,-141,.8),(44,-181,.85),(-5,-239,.93),(-90,-207,.75),(85,-247,.7)]:p.append(foliage(x+ox*s,y+oy*s,s*ss))
    # Fences, blossoms, cobblestone highlights and painted grass.
    for x in range(0,690,68):
        y=777-x*.08;p.append(f'<path d="M{x} {y}V{y+74}" stroke="#afa081" stroke-width="11"/>')
    p.append('<path d="M0 800L681 747M0 829L680 777" stroke="#afa081" stroke-width="9"/>')
    for _ in range(130):
        x=random.randrange(0,1920);y=random.randrange(740,1080)
        if 850<x<1420 and y>830:continue
        p.append(f'<path d="M{x} {y}q-4 -15 -10 -19m10 19q5 -20 12 -23" fill="none" stroke="#a6b87c" opacity=".45" stroke-width="2"/>')
    for _ in range(48):
        x=random.randrange(870,1290);y=random.randrange(800,1045);p.append(f'<path d="M{x} {y}q15 -7 28 1q-3 12 -27 7Z" fill="#dfd2b1" opacity=".18"/>')
    p.append('<rect width="1920" height="1080" fill="#8e9372" filter="url(#grain)" opacity=".055"/>')
    save('village.svg',''.join(p))

def forest():
    p=['''<defs><linearGradient id="forestsky" y2="1"><stop stop-color="#4d7776"/><stop offset=".45" stop-color="#9fafa0"/><stop offset="1" stop-color="#253f3b"/></linearGradient><linearGradient id="earth" y2="1"><stop stop-color="#647b50"/><stop offset="1" stop-color="#142d28"/></linearGradient></defs><rect width="1920" height="1080" fill="url(#forestsky)"/><ellipse cx="1340" cy="140" rx="900" ry="650" fill="url(#warm)" opacity=".48"/>''']
    for layer in range(3):
        for x in range(-80+layer*90,2050,150+layer*38):
            width=random.randint(23,56)*(1+layer*.45);top=random.randint(-260,-30);bottom=730+layer*70
            p.append(f'<path d="M{x-width} {bottom}Q{x+width*.25} 460 {x-width*.5} {top}H{x+width*.7}Q{x+width*.3} 480 {x+width} {bottom}Z" fill="{["#728c81","#486b60","#264c42"][layer]}" opacity="{[.35,.6,.88][layer]}"/>')
            p.append(f'<path d="M{x} 320Q{x-85} 230 {x-170} 156M{x+10} 470Q{x+95} 335 {x+210} 300" fill="none" stroke="{["#728c81","#486b60","#264c42"][layer]}" stroke-width="{width*.37}" opacity=".65"/>')
    p.append('<path d="M0 820Q320 749 710 831Q960 738 1370 812Q1690 736 1920 785V1080H0Z" fill="url(#earth)"/>')
    for x,w in [(1190,125),(1370,70),(1520,190)]:
        p.append(f'<path d="M{x} -30L{x+w} -30L{x-420+w*1.4} 1020L{x-780} 1080Z" fill="#fff4ce" opacity=".075"/>')
    for x,y,s in [(50,470,4.6),(1890,430,4.5),(200,860,1.2),(1640,850,1.3),(690,790,.62)]:
        if s>4:p.append(f'<path d="M{x-45} 1080Q{x+50} 630 {x-20} -150H{x+60}Q{x+15} 640 {x+180} 1080Z" fill="url(#wood)"/><path d="M{x+19} 1030Q{x+45} 600 {x+10} 120" fill="none" stroke="#918779" stroke-width="12" opacity=".2"/>')
        for ox,oy,ss in [(-30,-130,.75),(72,-150,.8),(-95,-175,.7),(12,-225,.75)]:p.append(foliage(x+ox*s,y+oy*s,s*ss,'#173c31' if s>4 else 'url(#leaf)'))
    for _ in range(88):
        x=random.randrange(70,1860);y=random.randrange(110,940);r=random.choice([1,1.5,2.4,3]);p.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#eeddad" opacity="{random.uniform(.15,.7):.2f}"/>')
    for x,y,s in [(0,1070,2.7),(300,1090,2.4),(1740,1100,2.8),(1940,1000,2.4)]:p.append(foliage(x,y,s,'#0b241f'))
    p.append('<rect width="1920" height="1080" fill="#6e826a" filter="url(#grain)" opacity=".065"/>')
    save('forest.svg',''.join(p))

def materials():
    save('parchment.svg','''<defs><radialGradient id="paper"><stop stop-color="#eee5ce"/><stop offset=".72" stop-color="#ded1b1"/><stop offset="1" stop-color="#b4a182"/></radialGradient></defs><rect width="512" height="512" fill="url(#paper)"/><rect width="512" height="512" fill="#9c896c" filter="url(#grain)" opacity=".12"/><path d="M18 7Q101 18 118 5M490 80Q468 191 496 219M81 495Q177 477 213 501" fill="none" stroke="#9a8060" opacity=".14"/><circle cx="94" cy="366" r="60" fill="none" stroke="#857151" opacity=".045"/><path d="M60 366H128M94 329V401" stroke="#857151" opacity=".05"/>''',512,512)
    save('slate.svg','''<rect width="512" height="512" fill="url(#night)"/><rect width="512" height="512" fill="#827b80" filter="url(#grain)" opacity=".14"/><path d="M-20 80Q120 170 532 87M-20 330Q190 271 532 363M41 -20Q106 172 27 533" fill="none" stroke="#af9e89" opacity=".025" stroke-width="8"/>''',512,512)
    save('logo.svg','''<g transform="translate(128 120)" filter="url(#shadow)"><circle r="76" fill="none" stroke="url(#gold)" stroke-width="3"/><circle r="66" fill="none" stroke="#d6c28c" stroke-width="1"/><path d="M-12 -4Q-75 -68 -111 -52Q-93 -8 -39 27Q-84 6 -105 21Q-79 45 -27 44L0 72L27 44Q79 45 105 21Q84 6 39 27Q93 -8 111 -52Q75 -68 12 -4Z" fill="url(#gold)" stroke="#725639" stroke-width="2"/><path d="M0 -100L19 -25L64 0L19 22L0 80L-19 22L-64 0L-19 -25Z" fill="url(#gold)" stroke="#eedba5" stroke-width="2"/><path d="M0 -62L8 -13L30 0L8 11L0 50L-8 11L-30 0L-8 -13Z" fill="#303449"/><circle r="9" fill="#dccdaa"/></g>''',256,256)

def worlds():
    # Seamless repeat: wrap each painted fleck on opposite boundaries.
    p=['<rect width="512" height="512" fill="#344e3d"/><rect width="512" height="512" fill="#91a678" filter="url(#grain)" opacity=".24"/>']
    for i in range(140):
        x=random.randrange(512);y=random.randrange(512);s=random.randint(5,20);color=random.choice(['#59724c','#658155','#284738','#7b865b','#3e6043'])
        for ox in [-512,0,512]:
            for oy in [-512,0,512]:
                p.append(f'<path d="M{x+ox} {y+oy}q{-s} {-s} {-s*1.5} {-s*.3}q{-s*.3} {s} {s*1.8} {s*.65}q{s} {-s*.6} {-.3*s} {-1.3*s}Z" fill="{color}" opacity=".5"/>')
    for _ in range(50):
        x=random.randrange(512);y=random.randrange(512)
        p.append(f'<path d="M{x} {y}q-5 -10 -8 -11m8 11q1 -9 7 -16" fill="none" stroke="#93a575" opacity=".55" stroke-width="1.4"/>')
    save('world/ground.svg',''.join(p),512,512)
    tree='<ellipse cx="163" cy="394" rx="115" ry="21" fill="#0a2420" opacity=".4"/><path d="M127 385Q157 306 125 180L169 164Q159 290 206 384Q177 374 165 391Q151 374 127 385Z" fill="url(#wood)" stroke="#283c2f" stroke-width="3"/><path d="M151 334Q169 268 156 195M160 269L93 205M165 235L218 164" fill="none" stroke="#8d8260" stroke-width="6" opacity=".55"/>'
    for x,y,s in [(98,205,.78),(220,183,.85),(118,143,.85),(185,110,.94),(70,155,.7),(257,122,.62),(142,69,.73)]:tree+=foliage(x,y,s)
    save('world/tree.svg',tree,320,420)
    ruin='''<ellipse cx="159" cy="268" rx="134" ry="20" fill="#142a27" opacity=".5"/><path d="M28 257V101Q25 71 60 55L113 29L153 39L165 74Q124 56 91 98V257Z" fill="url(#stone)" stroke="#344b47" stroke-width="4"/><path d="M222 259V91L190 63L171 35L209 31Q272 40 278 107V260Z" fill="url(#stone)" stroke="#344b47" stroke-width="4"/><path d="M44 117H78M43 170H76M236 138H267M236 194H269M61 70L71 111L57 135M257 75L248 107L262 120" fill="none" stroke="#cad0ac" opacity=".35" stroke-width="3"/><path d="M20 260H96V275H20ZM212 260H285V275H212Z" fill="url(#stone)" stroke="#3d534a" stroke-width="3"/><path d="M31 94Q75 76 99 88M218 55Q252 69 264 91M42 207Q53 218 72 204" fill="none" stroke="#71855a" stroke-width="14"/><path d="M121 244L175 224L203 248L197 271H126Z" fill="url(#stone)" stroke="#3c5048" stroke-width="3"/><path d="M176 231L169 251L195 263" fill="none" stroke="#c2c5a0" opacity=".25"/>'''
    save('world/ruin.svg',ruin,320,290)
    crystal='''<ellipse cx="90" cy="181" rx="78" ry="18" fill="#111d33" opacity=".4"/><ellipse cx="90" cy="110" rx="85" ry="100" fill="url(#aura)"/><path d="M29 157L43 106L71 83L86 149L73 181L42 178Z" fill="url(#crystal)" stroke="#c5b9ff" stroke-width="1.5"/><path d="M64 151L76 45L108 12L132 61L125 151L105 183Z" fill="url(#crystal)" stroke="#e5d9ff" stroke-width="2"/><path d="M108 12L104 133L125 151L132 61Z" fill="#7065b9" opacity=".6"/><path d="M76 45L104 133L108 12Z" fill="#f5e9ff" opacity=".55"/><path d="M115 160L140 83L160 115L148 170L128 184Z" fill="url(#crystal)" stroke="#bbb5f5" stroke-width="2"/><path d="M31 178Q84 156 151 180L161 196H18Z" fill="url(#stone)"/><path d="M37 178Q58 167 76 179M100 183Q124 173 144 184" fill="none" stroke="#607b58" stroke-width="8"/><use href="#star" transform="translate(39 67) scale(.5)" fill="#f6e9ff"/><use href="#star" transform="translate(154 43) scale(.35)" fill="#f6e9ff"/>'''
    save('world/crystal.svg',crystal,180,210)
    # Character artwork is authored by original_characters.py.
    wisp='''<ellipse cx="96" cy="158" rx="63" ry="13" fill="#081d2a" opacity=".3"/><ellipse cx="96" cy="85" rx="85" ry="85" fill="url(#aura)"/><path d="M47 93Q38 50 77 35Q129 10 153 63Q173 89 145 122Q127 146 99 148L105 116Q59 129 47 93Z" fill="url(#crystal)" stroke="#d0c9ff" stroke-width="3"/><path d="M74 53Q99 40 130 56" fill="none" stroke="#f2eaff" stroke-width="8" opacity=".5"/><path d="M60 74L79 84M136 72L116 84" stroke="#493c77" stroke-width="8" stroke-linecap="round"/><ellipse cx="81" cy="89" rx="5" ry="8" fill="#f4e7ff"/><ellipse cx="115" cy="87" rx="5" ry="8" fill="#f4e7ff"/><path d="M92 106Q99 111 104 105" fill="none" stroke="#68508b" stroke-width="3"/><path d="M39 81Q9 108 24 127Q18 111 44 104M151 71Q182 100 168 121Q178 102 150 98" fill="none" stroke="#b5b1ec" stroke-width="6" opacity=".6"/><use href="#star" transform="translate(35 41) scale(.4)" fill="#eae0ff"/>'''
    save('world/wisp.svg',wisp,192,180)
    sentinel='''<ellipse cx="127" cy="240" rx="91" ry="13" fill="#0a2420" opacity=".4"/><path d="M83 177L66 230H107L126 182M140 177L150 231H191L173 172" fill="url(#stone)" stroke="#334b42" stroke-width="4"/><path d="M76 113L40 143L24 186L62 197L91 151M174 113L216 138L229 181L196 200L163 157" fill="url(#stone)" stroke="#334b42" stroke-width="4"/><path d="M89 96L171 96L195 158L169 194L90 194L64 156Z" fill="url(#stone)" stroke="#334b42" stroke-width="4"/><path d="M80 94L78 42L106 18L157 21L180 53L174 103L147 115L102 109Z" fill="url(#stone)" stroke="#334b42" stroke-width="4"/><path d="M98 66L119 69M146 69L165 62" stroke="#d1ddb4" stroke-width="6"/><path d="M97 81L116 82M147 82L164 78" stroke="#be99ee" stroke-width="7"/><path d="M124 148L130 123L144 146L137 170Z" fill="url(#crystal)" stroke="#d3b9ff" stroke-width="2"/><path d="M68 134Q95 142 82 178M165 109Q155 150 185 167M91 35Q122 19 146 38" fill="none" stroke="#547548" stroke-width="12"/><path d="M68 145Q47 107 66 100Q96 117 68 145M178 166Q181 124 203 128Q219 147 178 166" fill="url(#leaf)"/><path d="M91 150L109 170M153 48L140 56L146 67M48 163L57 177M161 204L171 221" fill="none" stroke="#c0c6a5" opacity=".25" stroke-width="3"/>'''
    save('world/sentinel.svg',sentinel,256,256)
    boss='''<ellipse cx="192" cy="343" rx="147" ry="24" fill="#061719" opacity=".5"/><ellipse cx="191" cy="176" rx="180" ry="173" fill="url(#aura)" opacity=".45"/><path d="M143 220L112 323L148 335L182 247M211 243L226 327L266 331L248 216" fill="url(#stone)" stroke="#253d3c" stroke-width="5"/><path d="M142 109Q90 112 77 178L54 263L99 280L141 193M244 108Q294 129 304 182L333 245L300 272L243 183" fill="url(#stone)" stroke="#253d3c" stroke-width="5"/><path d="M143 117L245 114L271 206L240 260L147 258L112 198Z" fill="url(#stone)" stroke="#253d3c" stroke-width="5"/><path d="M145 128L159 49L187 21L237 46L243 123L210 146L169 141Z" fill="url(#stone)" stroke="#253d3c" stroke-width="5"/><path d="M166 77L185 82M207 81L230 75" stroke="#c7b7fc" stroke-width="8"/><path d="M172 105L216 105" stroke="#34483f" stroke-width="5"/><path d="M165 184L190 142L220 183L198 233Z" fill="url(#crystal)" stroke="#e0c7ff" stroke-width="3"/><path d="M192 149L188 216L216 182Z" fill="#ebdcff" opacity=".55"/><path d="M163 51Q112 36 108 6Q85 69 153 77M233 51Q280 23 278 0Q306 55 242 84" fill="url(#wood)" stroke="#b8a16a" stroke-width="5"/><path d="M127 108Q148 127 129 159M244 124Q227 169 252 199M114 245Q153 213 162 257" fill="none" stroke="#5a7b51" stroke-width="14"/><path d="M131 159Q90 138 92 117Q126 122 131 159M248 197Q284 165 293 182Q289 212 248 197" fill="url(#leaf)"/><path d="M174 253L201 263M80 206L95 218M230 317L254 309M145 59L162 65M241 88L231 102" fill="none" stroke="#d3d0ac" stroke-width="4" opacity=".28"/>'''
    save('world/boss.svg',boss,384,368)

def icons():
    motifs={
    'story':'<path d="M50 65Q88 49 126 68Q162 49 207 65V183Q166 169 128 188Q84 172 50 187Z" fill="url(#cloth)"/><path d="M128 69V187"/><path d="M72 86Q96 80 112 89M72 107Q96 101 112 110M147 89Q170 79 190 87M148 111Q171 102 190 111" opacity=".45"/><use href="#star" transform="translate(168 147) scale(1.2)" fill="url(#gold)"/>',
    'recruit':'<circle cx="128" cy="128" r="59"/><ellipse cx="128" cy="128" rx="83" ry="27" transform="rotate(-25 128 128)"/><use href="#star" transform="translate(128 128) scale(2.8)" fill="url(#gold)"/><use href="#star" transform="translate(69 64) scale(.65)" fill="#eee0b2"/>',
    'party':'<path d="M105 65Q127 51 151 65V122Q139 164 127 175Q102 151 105 122Z" fill="#31384c"/><path d="M60 182L182 64L193 48L209 52L210 71L193 78L75 198Z" fill="url(#gold)"/><path d="M153 98L180 126M63 191L50 205" stroke-width="10"/><path d="M55 62L73 54L91 72L186 187L175 202L63 77Z" fill="url(#cloth)"/>',
    'season':'<circle cx="128" cy="125" r="54" fill="url(#crystal)"/><ellipse cx="128" cy="129" rx="91" ry="28" transform="rotate(-25 128 129)"/><path d="M109 79Q159 90 155 166" opacity=".6"/><use href="#star" transform="translate(198 65) scale(.6)" fill="url(#gold)"/>',
    'missions':'<path d="M72 59H171L182 180L71 195Q45 192 51 171L55 90Q59 58 72 59Z" fill="url(#cloth)"/><path d="M168 61Q191 43 204 63Q213 89 179 90M71 173Q55 180 69 195M90 91H154M90 109H146M89 130H137"/><circle cx="154" cy="158" r="24" fill="#824347"/><use href="#star" transform="translate(154 158) scale(.85)" fill="url(#gold)"/>',
    'shop':'<path d="M75 90Q67 126 54 185Q124 215 202 185L183 92Z" fill="url(#wood)"/><path d="M75 95L57 57Q106 40 127 65Q152 40 204 59L182 97Z" fill="url(#cloth)"/><path d="M73 95Q126 112 187 95M126 103V186"/><circle cx="128" cy="146" r="26" fill="url(#gold)"/><path d="M119 131V161M137 131V161M114 142H143" stroke="#74573d"/>',
    'gold':'<ellipse cx="128" cy="132" rx="69" ry="70" fill="url(#gold)"/><ellipse cx="128" cy="128" rx="56" ry="56" fill="none" stroke="#f3dfad" stroke-width="4"/><use href="#star" transform="translate(128 128) scale(2.4)" fill="#84613d" stroke="#ebd098"/>',
    'shard':'<path d="M81 180L91 72L134 31L181 84L165 181L128 213Z" fill="url(#crystal)" stroke="#d9cdff"/><path d="M134 31L126 159L165 181L181 84Z" fill="#6e65b3"/><path d="M91 72L126 159L134 31Z" fill="#e8ddff"/><use href="#star" transform="translate(63 85) scale(.7)" fill="#e6d5ff"/>',
    'stamina':'<path d="M67 191Q66 117 104 65Q142 27 194 54Q203 105 171 142Q122 180 67 191Z" fill="url(#cloth)"/><path d="M62 207L174 70M91 172L83 130M114 143L109 102M114 141L153 143M139 112L175 112"/><path d="M121 162L142 114L117 119L137 81" fill="none" stroke="#d8c79a" stroke-width="8"/>',
    'heart':'<path d="M128 205Q40 149 44 94Q49 39 99 53Q119 57 128 77Q150 43 181 53Q227 65 211 111Q192 160 128 205Z" fill="#b75d70" stroke="#f1bdba"/><path d="M62 91Q73 67 91 69" stroke="#f6cebd" stroke-width="7"/>',
    'map':'<path d="M40 69L98 52L155 74L213 58V188L157 204L101 184L40 201Z" fill="url(#cloth)"/><path d="M98 55L101 184M155 74L157 204"/><path d="M65 161Q85 95 123 128T179 99" fill="none" stroke="#866c54" stroke-dasharray="7 7"/><use href="#star" transform="translate(180 95) scale(.9)" fill="#83607d"/>',
    'bag':'<path d="M71 93H185L203 199Q130 216 53 198Z" fill="url(#wood)"/><path d="M95 95V65Q129 41 164 66V95M64 118Q124 139 195 115" stroke-width="9"/><path d="M113 124H144V159H113Z" fill="url(#gold)"/><path d="M125 136V147" stroke="#725537"/>',
    'settings':'<path d="M107 47H148L153 70L174 81L196 73L216 107L199 125V148L214 166L194 195L172 187L151 196L146 218H106L101 196L79 184L58 192L40 160L56 144V121L40 105L59 73L81 81L102 69Z" fill="url(#gold)"/><circle cx="128" cy="130" r="35" fill="#333446"/><circle cx="128" cy="130" r="22" fill="none"/>',
    'auto':'<path d="M67 110Q82 56 144 59Q188 61 206 99M206 67V102H170M190 154Q171 209 113 205Q66 202 49 166M49 198V163H84" fill="none" stroke-width="13"/><path d="M109 94L160 130L109 166Z" fill="url(#gold)"/>',
    'crescent':'<path d="M183 43Q122 56 100 117Q76 176 183 203Q89 221 49 160Q10 84 99 45Q133 32 183 43Z" fill="url(#cloth)"/><path d="M76 168Q77 97 160 65" fill="none" stroke="#d8caaa" stroke-width="6"/><use href="#star" transform="translate(192 84) scale(.9)" fill="url(#gold)"/>',
    'bolt':'<path d="M147 31L76 132L118 132L95 221L195 105L145 109L175 31Z" fill="url(#crystal)" stroke="#e4d7ff"/><path d="M66 56L53 85M204 157L190 191" stroke="#c6b4e9"/>',
    'dash':'<path d="M83 73L147 55L164 85L147 112L206 155L202 182L167 203L112 171L84 128Z" fill="url(#cloth)"/><path d="M55 115H113M35 142H104M44 174H110" stroke-width="10"/><path d="M127 80L143 101M153 149L166 162M167 202L204 177" stroke="#ad8a66"/>',
    'heal':'<circle cx="128" cy="129" r="69" fill="none"/><path d="M113 75H144V113H183V146H144V184H113V146H76V113H113Z" fill="#b4d3a3" stroke="#e6e4bc"/><use href="#star" transform="translate(55 52) scale(.65)" fill="#e5e9bb"/><use href="#star" transform="translate(201 195) scale(.65)" fill="#e5e9bb"/>',
    'shield':'<path d="M128 40Q165 67 205 68V126Q194 187 128 220Q63 187 51 126V68Q91 68 128 40Z" fill="#445069"/><path d="M128 61Q165 85 185 84V124Q181 169 128 194Q76 168 71 125V84Q93 83 128 61Z" fill="none"/><use href="#star" transform="translate(128 124) scale(2.2)" fill="url(#gold)"/>',
    'gravity':'<circle cx="128" cy="128" r="37" fill="#28213d"/><ellipse cx="128" cy="128" rx="92" ry="31" transform="rotate(-28 128 128)"/><ellipse cx="128" cy="128" rx="77" ry="58" transform="rotate(35 128 128)" stroke="#ba9ddc"/><path d="M74 62L99 78M195 182L171 168" stroke-width="9"/><use href="#star" transform="translate(53 163) scale(.65)" fill="#d9c2e7"/>',
    'meteor':'<path d="M55 170Q49 129 87 114Q123 98 144 133Q166 169 133 196Q99 224 67 192Z" fill="#bb6d65"/><path d="M76 131L180 31M112 128L210 50M135 158L225 72" stroke="#e8ba80" stroke-width="10"/><path d="M67 159L84 147L101 160L118 149L128 174L104 191L80 186Z" fill="url(#gold)"/>',
    'bind':'<path d="M62 184Q39 109 82 71Q135 35 169 68Q216 104 188 149Q162 177 127 139Q98 93 144 77" fill="none" stroke="#b59acb" stroke-width="13"/><path d="M62 184L52 217M62 185L91 199M169 68L201 42" stroke="#d9c7e4" stroke-width="5"/><use href="#star" transform="translate(130 127) scale(1.7)" fill="#e3d3f0"/>',
    'eclipse':'<circle cx="128" cy="128" r="59" fill="#252038" stroke="#dac493" stroke-width="8"/><path d="M130 69Q167 83 169 120Q173 161 137 185Q186 180 188 128Q189 78 130 69Z" fill="#efdbb0" stroke="none"/><path d="M128 28V51M128 205V228M27 128H52M204 128H229M57 57L74 74M184 184L201 201M56 201L74 184M184 74L201 57" stroke-width="5"/><circle cx="128" cy="128" r="81" fill="none" stroke-width="1.5" opacity=".5"/>'}
    for name,m in motifs.items():
        body='<ellipse cx="128" cy="131" rx="105" ry="106" fill="url(#aura)" opacity=".3"/><g fill="none" stroke="url(#gold)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" filter="url(#shadow)">'+m+'</g>'
        save('icons/'+name+'.svg',body,256,256)

if __name__=='__main__':
    observatory();village();forest();materials();worlds();icons()
    subprocess.run([sys.executable, str(ROOT/'tools/art/original_characters.py')], check=True)
    print('Built original scenes, materials, icons, world art, and character illustrations.')
