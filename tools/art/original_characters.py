from pathlib import Path
import math, random

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public'/'assets'/'characters'
OUT.mkdir(parents=True,exist_ok=True)

def defs(hair='#112439',hairlight='#3d7f91',cloth='#394369',accent='#7bbfc6',irisdeep='#285777',irisrim='#102c4b'):
    return f'''<defs>
    <linearGradient id="hair" x1=".12" y1="0" x2=".88" y2=".9"><stop stop-color="{hairlight}"/><stop offset=".24" stop-color="{hair}"/><stop offset=".6" stop-color="{hairlight}"/><stop offset="1" stop-color="{hair}"/></linearGradient>
    <linearGradient id="hairDark" x2="1" y2="1"><stop stop-color="{hair}"/><stop offset="1" stop-color="#101b2f"/></linearGradient>
    <linearGradient id="skin" x1=".2" y1=".15" x2=".92" y2=".86"><stop stop-color="#fff0dc"/><stop offset=".42" stop-color="#f1d0bc"/><stop offset="1" stop-color="#c79486"/></linearGradient>
    <linearGradient id="skinShade" x2="1" y2=".4"><stop stop-color="#dbad9c"/><stop offset="1" stop-color="#f1d0bc"/></linearGradient>
    <radialGradient id="cheek"><stop stop-color="#d7898f" stop-opacity=".46"/><stop offset="1" stop-color="#d7898f" stop-opacity="0"/></radialGradient>
    <linearGradient id="ivory" x1=".2" y1="0" x2="1" y2=".9"><stop stop-color="#fff6de"/><stop offset=".35" stop-color="#dedad1"/><stop offset=".7" stop-color="#b0b5c1"/><stop offset="1" stop-color="#707a93"/></linearGradient>
    <linearGradient id="cloth" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#7a86b0"/><stop offset=".28" stop-color="{cloth}"/><stop offset=".7" stop-color="#182942"/><stop offset="1" stop-color="#48577c"/></linearGradient>
    <linearGradient id="lilac" x2=".95" y2="1"><stop stop-color="#b7a8d7"/><stop offset=".3" stop-color="#8c7eab"/><stop offset=".75" stop-color="#47466d"/><stop offset="1" stop-color="#6f6795"/></linearGradient>
    <linearGradient id="gold" x1=".15" y1="0" x2=".9" y2="1"><stop stop-color="#fae8ad"/><stop offset=".22" stop-color="#cead67"/><stop offset=".5" stop-color="#8c6b3d"/><stop offset=".73" stop-color="#e6ce8a"/><stop offset="1" stop-color="#9f7642"/></linearGradient>
    <linearGradient id="steel" x2="1" y2=".7"><stop stop-color="#e3edf3"/><stop offset=".45" stop-color="#839cae"/><stop offset=".5" stop-color="#dce8ec"/><stop offset="1" stop-color="#4e6478"/></linearGradient>
    <radialGradient id="iris"><stop stop-color="#e5eee3"/><stop offset=".46" stop-color="{accent}"/><stop offset=".85" stop-color="{irisdeep}"/><stop offset="1" stop-color="{irisrim}"/></radialGradient>
    <radialGradient id="magic"><stop stop-color="#cdf9ef" stop-opacity=".5"/><stop offset=".5" stop-color="{accent}" stop-opacity=".15"/><stop offset="1" stop-color="{accent}" stop-opacity="0"/></radialGradient>
    <filter id="paint" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".4" numOctaves="2" seed="27" result="n"/><feColorMatrix in="n" type="saturate" values="0" result="gray"/><feColorMatrix in="gray" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 .025 0" result="faint"/><feComposite in="faint" in2="SourceGraphic" operator="in" result="tex"/><feBlend in="SourceGraphic" in2="tex" mode="soft-light"/></filter>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="7" stdDeviation="8" flood-color="#0a182b" flood-opacity=".25"/></filter>
    <path id="star" d="M0 -10 2 -2 10 0 2 2 0 10 -2 2 -10 0 -2 -2Z"/>
    <path id="tinyLeaf" d="M0 0Q-16 -25 -1 -39Q16 -20 0 0Z"/>
    </defs>'''

def path(d,fill='none',stroke='#263247',sw=2,extra=''):
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" {extra}/>'

def star(x,y,s=.5,color='#e7cf91'):
    return f'<use href="#star" transform="translate({x} {y}) scale({s})" fill="{color}"/>'

def orbit(x,y,r=30):
    return f'<g transform="translate({x} {y})" fill="none" stroke="url(#gold)"><circle r="{r}" stroke-width="3"/><circle r="{r-7}" stroke-width="1"/><ellipse rx="{r+8}" ry="{r*.33}" transform="rotate(-30)" stroke-width="2"/><path d="M{-r-5} 0H{r+5}M0 {-r-5}V{r+5}" stroke-width="1"/>{star(0,0,.8)}</g>'

def constellation(points,opacity=.6):
    line=' '.join(f'{x},{y}' for x,y in points)
    out=f'<polyline points="{line}" fill="none" stroke="#d7bf87" stroke-width="1.8" opacity="{opacity}"/>'
    for i,(x,y) in enumerate(points):out+=star(x,y,.24 if i%2 else .4)
    return out

def eye(x,y,width=66,height=33,kind='neutral',right=False,lashes=True):
    # A tapered almond, rich iris, upper lid, reflected skylight and fine lashes.
    h=height*(.73 if kind=='happy' else .84 if kind=='determined' else 1)
    tilt=-3 if right else 2
    outline=f'M{x-width/2} {y+4}Q{x-8} {y-h*1.25+tilt} {x+width/2} {y+3}Q{x+11} {y+h*1.05} {x-width/2} {y+4}Z'
    cid=f'e{x}_{y}_{kind}'
    out=f'<defs><clipPath id="{cid}"><path d="{outline}"/></clipPath></defs>'
    out+=path(outline,'#f8f1e7','#5b4850',1.3)
    out+=f'<g clip-path="url(#{cid})"><ellipse cx="{x+1}" cy="{y+8}" rx="{h*.38}" ry="{h*.77}" fill="url(#iris)"/><ellipse cx="{x+1}" cy="{y+3}" rx="{h*.16}" ry="{h*.42}" fill="#10243c"/><path d="M{x-h*.29} {y+17}Q{x} {y+28} {x+h*.27} {y+17}" fill="none" stroke="#b9e9e9" stroke-width="2"/><ellipse cx="{x-4}" cy="{y-3}" rx="6" ry="8" fill="#fff8ed"/><circle cx="{x+9}" cy="{y+13}" r="3" fill="#d8fbf6"/><path d="M{x-width/2} {y+3}Q{x} {y-h*1.25} {x+width/2} {y+3}" fill="none" stroke="#6d5560" stroke-width="9" opacity=".25"/></g>'
    out+=path(f'M{x-width/2-2} {y+3}Q{x-9} {y-h*1.25-1+tilt} {x+width/2+2} {y+2}','none','#1c293d',4)
    if right and lashes:
        out+=path(f'M{x+width/2-2} {y+2}l9 -5m-14 1 8 -8m-16 2 5 -7','none','#1c293d',2)
    elif lashes:out+=path(f'M{x-width/2+2} {y+2}l-8 -5m13 1 -6 -7m14 2 -4 -6','none','#1c293d',2)
    out+=path(f'M{x-width*.3} {y+h*.69+6}Q{x} {y+h*.77+8} {x+width*.23} {y+h*.65+5}','none','#b28e89',1.2)
    return out

def face(kind='neutral',shape='lyra'):
    # Different age, proportions and jaw contours across the original cast.
    if shape=='lyra':
        contour='M278 213C282 173 319 140 367 142C429 143 478 177 488 221L481 307C474 353 438 397 398 416C372 415 329 387 304 350C283 319 278 269 278 213Z'
        left=(326,281,61,31);right=(430,281,70,34)
    elif shape=='orion':
        contour='M267 200C283 158 329 140 383 146C433 151 484 178 495 226L488 326C478 367 441 409 396 427C351 411 302 380 284 342C274 303 265 246 267 200Z'
        left=(322,286,62,24);right=(430,287,66,24)
    elif shape=='ember':
        contour='M282 219C289 171 334 147 382 151C437 147 480 183 490 225L478 314C464 351 428 388 395 409C363 402 325 375 306 340C287 308 277 262 282 219Z'
        left=(327,282,64,31);right=(431,279,65,31)
    elif shape=='sylvie':
        contour='M283 213C282 169 329 137 376 141C433 134 478 170 488 214L482 304C470 348 433 390 396 415C361 409 322 379 304 344C285 303 280 251 283 213Z'
        left=(327,281,67,34);right=(432,280,69,35)
    elif shape=='kael':
        contour='M264 214C275 171 319 148 378 151C438 145 484 176 498 224L489 319L461 368L418 403L374 409L325 380L287 340C273 303 265 257 264 214Z'
        left=(318,285,68,26);right=(431,283,72,27)
    else:
        contour='M282 224C283 174 326 141 378 145C435 143 481 176 491 226L481 311C468 351 431 389 399 410C363 405 328 378 307 344C288 309 280 259 282 224Z'
        left=(330,283,67,34);right=(430,281,68,35)
    out=path(contour,'url(#skin)','#745969',2.7)
    out+=path('M287 243Q286 322 326 359Q358 398 398 416Q355 383 341 352Q307 288 307 219Z','#c79c91','none',0,extra='opacity=".16"')
    out+=path('M434 192Q469 220 468 285Q462 260 448 246Z','#fff1dc','none',0,extra='opacity=".22"')
    out+=f'<ellipse cx="314" cy="327" rx="40" ry="27" fill="url(#cheek)"/><ellipse cx="453" cy="326" rx="38" ry="25" fill="url(#cheek)"/>'
    out+=eye(*left,kind=kind,lashes=shape not in ['orion','kael'])+eye(*right,kind=kind,right=True,lashes=shape not in ['orion','kael'])
    if shape=='orion':
        out+=path('M291 253Q324 239 356 253M401 253Q436 236 470 252','none','#90949b',5)
        out+=path('M375 363Q392 367 412 361','none','#9f766f',2)
        out+=path('M388 298Q383 325 394 340L405 342','none','#b1877b',2.3)
    elif shape=='kael':
        out+=path('M287 251Q320 240 353 259M402 258Q441 239 473 248','none','#253343',5)
        out+=path('M374 363Q396 361 417 363','none','#9f746d',2.3)
        out+=path('M391 298Q397 321 405 336L399 343','none','#b08375',2.3)
    elif kind=='concerned':
        out+=path('M297 258Q319 259 350 242M401 246Q435 247 465 260','none','#3b394d',3)
        out+=path('M375 363Q392 351 410 362','none','#986777',2.3)
    elif kind=='determined':
        out+=path('M296 248Q327 250 352 266M401 266Q438 248 467 249','none','#333348',3.5)
        out+=path('M375 363Q392 367 416 357','none','#986777',2.2)
    elif kind=='happy':
        out+=path('M296 250Q325 233 351 251M402 249Q435 230 466 249','none','#3b394d',3)
        out+=path('M371 353Q394 364 418 350Q413 379 394 382Q377 380 371 353Z','#ac6773','#965b6b',1.5)
        out+=path('M375 356Q394 365 413 354L409 364Q392 369 380 361Z','#fff4df','none',0)
        out+=path('M385 374Q398 367 408 374','#d99196','none',0)
    else:
        out+=path('M298 250Q326 240 352 253M402 252Q435 238 466 250','none','#3d3b50',3)
        out+=path('M376 362Q393 369 414 357','none','#9b6876',2)
        out+=path('M381 370Q394 374 406 368','none','#d8a096',1.2)
    out+=path('M393 306Q390 324 397 335L406 337','none','#b38a81',1.7)
    out+=path('M381 340Q391 345 401 340','none','#d7aaa1',1.1)
    out+=path('M384 315Q388 319 385 325','none','#fff2df',2.5)
    if shape=='orion':
        out+=path('M297 311Q322 317 348 308M409 309Q436 315 464 305M298 324Q317 330 336 325M418 325Q441 330 460 319M373 264L379 277M393 261L390 273','none','#aa807a',1.4)
    if shape=='ember':
        for x,y in [(313,324),(324,332),(333,326),(444,327),(453,334),(462,324)]:out+=f'<circle cx="{x}" cy="{y}" r="1.8" fill="#b77a68"/>'
    if shape=='kael':out+=path('M354 351Q378 365 400 356M305 323L331 344','none','#b98a79',1.3)
    return out

def lyra(expression='neutral'):
    p=[]
    # Sweeping, independent back locks establish an asymmetric fluid silhouette.
    p.append(path('M286 150C215 109 192 202 209 327C216 440 159 443 151 564C144 654 103 701 124 793C143 873 233 866 222 958C216 1017 137 1028 111 998C148 1101 290 1100 321 996C355 873 259 785 273 684C296 567 342 413 346 239Z','url(#hairDark)','#0b1c33',3))
    p.append(path('M445 128C529 118 564 234 540 343C515 448 579 481 589 590C599 692 534 747 604 803C646 837 714 855 735 904C669 848 629 936 584 913C551 897 553 879 555 854C531 937 624 1004 690 995C582 1070 486 1003 483 913C476 802 512 757 480 665C434 533 414 369 409 240Z','url(#hair)','#152a40',3))
    p.append(path('M523 372C521 480 612 504 586 642C569 724 557 754 608 795C588 774 614 724 627 673C663 531 572 477 559 412Z','#254a60','#152e45',2))
    for d in ['M225 229C215 393 235 426 183 537C144 622 154 696 194 752','M269 227C290 448 207 552 221 680C235 800 299 871 280 959','M250 388C235 517 183 606 200 683','M493 234C538 372 483 420 537 529C589 644 497 723 553 814','M529 344C498 451 558 479 566 570','M520 799C509 877 543 954 612 976']:
        p.append(path(d,'none','#71c3c8',2,extra='opacity=".26"'))
    # Long leggings have anatomical knees and shaped boot contours.
    p.append(path('M284 904C310 898 363 902 376 937C381 1002 363 1071 370 1128L389 1189C365 1207 326 1206 316 1189C303 1136 302 1082 298 1029L278 960Z','url(#cloth)','#27354d',3))
    p.append(path('M419 917C446 891 489 908 507 944C506 1003 496 1046 510 1089L545 1174C532 1198 495 1204 477 1184L451 1125C431 1076 437 1034 425 1000Z','url(#cloth)','#26364f',3))
    p.append(path('M316 1045Q340 1034 365 1048L362 1091Q337 1079 318 1093Z','url(#gold)','#84653f',1.2))
    p.append(path('M440 1043Q469 1028 496 1040L504 1081Q475 1068 448 1081Z','url(#gold)','#84653f',1.2))
    p.append(path('M323 1103C325 1138 325 1159 335 1184M461 1093Q463 1146 494 1171','none','#8996b2',2,extra='opacity=".5"'))
    # Floating skirt, layered pleats and embroidered astronomical diagrams.
    p.append(path('M280 724C342 713 421 697 488 722C530 788 560 828 550 861C559 918 609 934 632 965C582 1001 544 1005 495 983C460 1026 399 1016 371 994C305 1017 281 979 226 984C219 956 201 938 187 929C245 864 224 796 280 724Z','url(#lilac)','#31334f',3))
    p.append(path('M314 735C300 829 300 912 268 979C303 995 329 1000 365 993C393 889 375 815 388 719Z','url(#cloth)','#49506a',1.5))
    p.append(path('M431 718C438 828 478 891 491 984C526 1001 553 990 582 986C508 906 531 820 484 733Z','#66678e','#505172',1.5))
    for d in ['M292 756Q257 846 259 927','M405 746Q385 890 378 966','M454 763Q460 855 475 930','M493 771Q515 839 523 887','M223 929Q261 951 290 946']:
        p.append(path(d,'none','#d2c6df',3,extra='opacity=".3"'))
    p.append(path('M198 928C237 963 277 990 326 993C349 998 363 988 371 994C405 1011 444 1015 491 983C534 1003 582 997 621 967','none','url(#gold)',5))
    p.append(constellation([(269,883),(302,860),(323,900),(355,880),(346,939)]))
    p.append(constellation([(486,864),(512,878),(503,915),(539,942),(572,937)]))
    # Fitted midnight bodice and curved cropped coat, not a geometric tunic.
    p.append(path('M308 467C339 439 419 449 450 475C475 536 473 588 459 631C453 666 474 698 486 724C426 745 353 743 284 735C305 682 323 625 308 576C293 534 293 496 308 467Z','url(#cloth)','#25344d',3))
    p.append(path('M334 478C335 548 348 579 338 624Q327 683 313 719M427 477C449 551 433 590 440 634L459 716','none','#c4b788',2.3))
    p.append(path('M359 512Q383 529 411 509M359 543Q386 560 411 541M350 634Q392 653 448 631','none','#8690ad',2,extra='opacity=".45"'))
    p.append(path('M269 465C244 475 226 506 219 553C205 600 171 617 140 653L170 698C202 678 238 658 253 625C256 663 236 709 246 741C278 754 301 743 322 729C306 661 333 600 323 554L356 486L332 462Z','url(#ivory)','#647387',2.7))
    p.append(path('M440 467C482 446 514 480 525 520C539 556 572 568 610 587L596 628C558 626 540 609 505 590C509 631 501 666 520 712L494 742L461 729C469 674 444 618 447 570L413 490Z','url(#ivory)','#647387',2.7))
    p.append(path('M333 461L362 485L334 529L302 573L319 488Z','#ede9d9','#798493',2))
    p.append(path('M437 463L410 488L443 531L464 562L453 494Z','#f7edda','#798493',2))
    p.append(path('M333 464L350 486L326 533L301 575M438 466L422 488L447 532L464 562','none','url(#gold)',4))
    for d in ['M239 521Q246 553 231 587','M214 604L240 610','M245 645Q269 639 284 619','M251 713Q287 700 310 708','M491 507Q500 535 514 545','M548 578L557 602','M489 638Q471 669 491 700']:
        p.append(path(d,'none','#7c8a9d',2.4,extra='opacity=".55"'))
    p.append(path('M140 649L158 638L181 683L165 702Z','url(#cloth)','#667487',2))
    p.append(path('M604 580L624 589L608 633L590 626Z','url(#cloth)','#667487',2))
    p.append(path('M146 651L168 693M614 590L599 626','none','url(#gold)',3))
    p.append(constellation([(246,524),(262,505),(277,532),(293,509)],.45))
    p.append(constellation([(491,550),(504,567),(489,588)],.45))
    for x,y in [(326,575),(324,618),(315,662)]:p.append(f'<circle cx="{x}" cy="{y}" r="5" fill="url(#gold)" stroke="#85704e" stroke-width="1"/>')
    # Open magical palm, separately drawn fingers, small joints and fingernails.
    p.append(path('M160 692C147 694 136 689 126 676L108 662C96 651 93 641 99 638C106 634 112 645 122 648L117 615C115 602 120 593 125 600L132 630L133 598C134 584 141 584 143 597L146 630L151 602C154 590 161 593 160 606L157 641L166 622C173 612 180 617 174 629L163 654C174 666 176 679 168 690Z','url(#skin)','#9c7780',2.3))
    for d in ['M127 652Q137 653 146 665','M145 638L146 648','M134 626L136 642','M161 665Q153 675 157 681','M120 607L126 607','M135 594L141 595','M153 601L159 602']:
        p.append(path(d,'none','#c79c91',1.4))
    # Atlas arm with true hand anatomy and a curled celestial chart.
    p.append(path('M614 592C634 580 646 575 656 580L676 575C683 574 687 580 681 585L663 593L687 595C699 596 700 604 689 606L664 608L684 615C694 620 690 626 682 624L659 618L671 634C676 641 670 647 663 641L646 626C629 632 617 627 609 619Z','url(#skin)','#9c7780',2.2))
    p.append(path('M635 600Q640 611 654 615M650 588L651 598','none','#c3968e',1.3))
    p.append(path('M642 568Q677 538 729 557L741 633Q699 619 661 644L650 612Z','url(#ivory)','#927b61',2))
    p.append(path('M731 557Q753 547 754 568Q748 581 737 578M661 644Q651 654 646 641Q643 631 652 626','none','url(#gold)',5))
    p.append(constellation([(662,580),(685,575),(704,594),(721,578),(725,618)],.8))
    p.append(orbit(698,600,20))
    # Neck, collar, astral brooch, and one asymmetrical crescent ear ornament.
    p.append(path('M349 397L349 452Q373 487 407 470L426 445L425 391Z','url(#skinShade)','#997887',2))
    p.append(path('M349 431Q379 459 423 424','none','#bb9187',2))
    p.append(path('M348 448L382 481L363 496L329 462M425 439L382 481L410 497L449 459','url(#ivory)','#79828f',2))
    p.append(orbit(383,489,24))
    p.append(path('M291 296C268 274 260 298 268 325Q278 347 293 329','url(#skin)','#b38a88',2))
    p.append(path('M479 290Q499 272 501 299Q500 323 481 328','url(#skin)','#b38a88',2))
    p.append(face(expression))
    # Face-framing locks: distinct layered shapes, pointed natural ends.
    p.append(path('M275 231C263 185 277 145 305 122C357 84 435 93 473 137C505 173 505 220 482 269C471 244 456 220 449 195C425 221 396 232 374 238C390 211 390 196 387 183C364 218 336 228 322 250C332 217 333 201 335 183C312 199 294 211 275 231Z','url(#hair)','#142a42',3))
    p.append(path('M278 221C265 270 263 328 242 361C226 387 198 388 180 380C211 393 205 422 189 435C222 428 252 419 275 382C296 343 300 296 293 254Z','url(#hair)','#182d45',2.8))
    p.append(path('M466 216C473 267 455 294 482 338C513 388 558 371 581 398C557 397 558 417 577 436C540 425 491 424 469 391C445 355 449 296 451 252Z','url(#hair)','#162b42',2.8))
    p.append(path('M270 146C280 99 321 72 374 80C409 56 463 78 488 115Q515 150 500 193C480 126 414 108 387 123C338 105 299 135 270 146Z','url(#hair)','#152b42',2.5))
    for d in ['M286 176Q310 136 353 125','M323 153Q341 134 367 133','M399 111Q450 106 482 151','M398 154Q429 164 452 183','M316 153Q314 188 298 208','M366 157Q363 191 337 215','M411 161Q417 184 400 211','M463 156Q478 187 482 217','M285 258C281 310 275 366 239 391','M272 316Q261 376 220 393','M463 269Q455 336 490 373','M477 315Q494 364 536 389']:
        p.append(path(d,'none','#77c4cc',2,extra='opacity=".55"'))
    for i in range(13):
        x=298+i*10
        p.append(path(f'M{x} {128+(i%3)*7}Q{x+9} {149+i*2} {x+5} {182+(i%4)*11}','none','#a1d3d4',.8,extra='opacity=".28"'))
    # A single crescent clip, not a horn or copied costume ornament.
    p.append(path('M496 163Q462 163 457 189Q454 212 477 222Q446 226 438 198Q430 166 460 150Q481 139 496 163Z','url(#gold)','#806641',1.6))
    p.append(path('M489 223Q502 260 490 301L492 339','none','url(#gold)',2))
    p.append(orbit(491,349,13))
    p.append(orbit(475,744,37))
    p.append(path('M462 737Q401 718 329 730','none','url(#gold)',7))
    p.append(path('M475 781Q501 813 480 847','none','url(#gold)',2))
    # Starlight grows from the open palm; no backdrop is baked into the portrait.
    p.append('<ellipse cx="135" cy="561" rx="80" ry="91" fill="url(#magic)"/>')
    p.append('<g transform="translate(138 551)" fill="none" stroke="#b5e4df" opacity=".8"><ellipse rx="55" ry="15" transform="rotate(-23)"/><ellipse rx="31" ry="56" transform="rotate(28)"/><circle r="39"/></g>')
    p.append(star(135,546,1.8,'#dbfff1')+star(105,483,.5,'#cdf3ea')+star(179,577,.65,'#d7f6ed')+star(182,509,.4,'#e9ddaf'))
    return defs()+f'<g filter="url(#paint)">'+''.join(p)+'</g>'

def write(name,body,h=1200):
    (OUT/(name+'.svg')).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="{h}" viewBox="0 0 800 {h}">{body}</svg>',encoding='utf-8')

def orion():
    p=[]
    p.append(path('M279 160C235 157 223 224 239 292C241 343 218 385 186 408C227 411 251 395 270 369L510 367C530 387 548 397 571 394C539 359 531 324 529 278C544 196 495 147 452 145Z','url(#hair)','#596a7b',3))
    p.append(path('M300 445C217 427 173 489 151 600C108 670 128 783 93 929C127 1008 188 1050 252 1092H610C659 993 703 892 653 751C629 626 610 502 489 449Z','url(#cloth)','#1b2b42',3))
    p.append(path('M248 488C244 625 250 705 227 825L171 1062Q215 1090 266 1100L324 481Z','#536477','#24364e',2))
    p.append(path('M505 480C518 584 545 658 542 782L587 1099L640 1076C657 970 615 869 615 771L588 527Z','#25354c','#18263d',2))
    p.append(path('M315 481L487 473C506 648 503 787 539 1100H270C300 879 283 751 302 660Z','url(#cloth)','#26364e',2.5))
    p.append(path('M334 507C340 692 326 895 319 1088M470 513C466 702 477 915 486 1087','none','url(#gold)',5))
    p.append(path('M360 586C384 570 416 571 441 587L445 993Q390 1021 345 988Z','#31435a','#95825d',2))
    p.append(orbit(397,679,48)+orbit(399,889,65))
    p.append(constellation([(368,771),(410,750),(442,791),(409,811),(370,839)],.8))
    p.append(path('M301 433L246 468L303 621L354 521M464 439L523 472L477 628L421 522','url(#ivory)','#74828c',2))
    p.append(path('M247 470L303 613M521 473L475 619','none','url(#gold)',6))
    p.append(path('M256 478C207 478 184 525 196 573L252 688L209 729L165 691C134 655 127 591 155 533C176 480 217 461 248 461Z','url(#cloth)','#263a4e',3))
    p.append(path('M505 485C550 472 590 507 595 558L608 645L644 666L630 708L572 707C547 676 521 628 513 585Z','url(#cloth)','#263a4e',3))
    p.append(path('M182 550Q191 605 223 653M153 617L191 661M555 533Q578 569 577 611M546 650Q567 646 591 655','none','#8192a3',2.5,extra='opacity=".4"'))
    p.append(path('M208 676L264 714L248 752L193 719Z','url(#gold)','#705b41',2))
    p.append(path('M605 646L642 659L635 710L599 699Z','url(#gold)','#705b41',2))
    p.append(path('M244 711C260 702 277 700 289 708L306 716L310 731L290 749L250 746Z','url(#skin)','#94737c',2))
    p.append(path('M269 713L293 722M266 724L294 733M263 735L284 741','none','#bb9488',1.5))
    # A book is drawn as curled individual leaves with a substantial spine.
    p.append(path('M171 702Q231 667 293 702Q331 679 366 685L362 829Q320 823 288 846Q220 812 166 822Z','url(#ivory)','#8f8065',2.5))
    p.append(path('M293 705L288 844M180 809Q230 793 285 826M296 827Q328 811 358 817','none','url(#gold)',4))
    for y in [730,750,770]:p.append(path(f'M188 {y}Q230 {y-13} 272 {y+4}M309 {y}Q330 {y-8} 349 {y-6}','none','#a69575',1.4))
    p.append(constellation([(209,752),(232,739),(250,769),(271,754)],.5))
    p.append(path('M636 296C643 464 626 590 640 755L628 1100','none','#725c48',18))
    p.append(path('M634 314Q645 642 636 839','none','url(#gold)',4))
    p.append(path('M626 665C638 655 651 661 657 668L663 682L650 690L659 698L650 710L631 709L617 695Z','url(#skin)','#97737a',2))
    p.append(path('M635 675L654 681M632 686L650 691M630 697L649 702','none','#b78e86',1.4))
    p.append('<ellipse cx="640" cy="226" rx="88" ry="96" fill="url(#magic)"/>')
    p.append(orbit(639,237,63))
    p.append(path('M638 154L631 117L647 101L656 123L649 156','url(#gold)','#765d42',2))
    p.append(star(638,237,2,'#d7ece4'))
    # Neck and uniquely mature face, silver sideburns, moustache and beard.
    p.append(path('M339 392L336 473Q380 511 434 474L436 391Z','url(#skinShade)','#9b7b81',2))
    p.append(face('neutral','orion'))
    p.append(path('M265 242C248 184 273 136 320 117C362 83 419 96 465 119C501 141 521 178 507 230L485 216Q470 180 443 167L452 198L417 180L385 195L379 163Q335 208 308 202L299 239L286 271Z','url(#hair)','#6b7a88',2.8))
    p.append(path('M278 293L290 351L326 371L318 336L305 294Z','url(#hair)','#6e7b88',2))
    p.append(path('M479 289L468 340L440 366L450 328L460 291Z','url(#hair)','#6e7b88',2))
    p.append(path('M303 345C326 366 352 364 372 350Q390 343 408 350Q444 366 473 342C471 409 446 449 407 479L393 504L375 482C339 461 318 419 303 345Z','url(#hair)','#72818d',2.5))
    p.append(path('M373 351Q352 349 331 366Q353 378 380 365M408 351Q437 346 459 364Q438 378 403 365','url(#ivory)','#83909c',1.5))
    p.append(path('M380 375Q391 381 408 374','none','#9c7c79',2))
    for d in ['M289 174Q318 131 358 128','M341 145Q360 119 393 128','M403 124Q460 128 488 173','M314 391Q334 433 369 459','M338 387Q353 435 381 473','M372 389Q372 439 394 488','M413 388Q419 430 405 464','M451 379Q449 422 423 451']:
        p.append(path(d,'none','#fff0dd',2,extra='opacity=".5"'))
    p.append(path('M330 448Q384 508 438 450','none','url(#gold)',5))
    p.append(orbit(389,523,27))
    return defs('#e9e6df','#9daaba','#324359','#90adb4','#607c8b','#354b5f')+'<g filter="url(#paint)">'+''.join(p)+'</g>'

def ember():
    p=[]
    p.append('''<defs><linearGradient id="firecape" x2="1" y2="1"><stop stop-color="#d48162"/><stop offset=".25" stop-color="#8f3c45"/><stop offset=".75" stop-color="#43263b"/><stop offset="1" stop-color="#713b50"/></linearGradient><linearGradient id="leather" x2="1" y2="1"><stop stop-color="#7e5a53"/><stop offset=".3" stop-color="#3a303b"/><stop offset="1" stop-color="#201f31"/></linearGradient></defs>''')
    p.append(path('M255 430C186 460 163 567 167 675C128 837 96 930 156 1046L184 1015L226 1058L256 1028L323 1087L678 1100C603 974 662 844 574 720C534 594 549 501 464 435Z','url(#firecape)','#532a3d',3))
    p.append(path('M199 562C198 737 118 875 190 1009M229 576C209 806 182 886 232 1014M515 502Q590 699 557 812Q539 933 615 1038','none','#e8a184',3,extra='opacity=".25"'))
    p.append(path('M279 509C294 472 327 450 379 455C430 451 481 480 499 538C498 633 457 686 478 762L525 1089L271 1100C287 983 252 896 275 765C304 661 271 620 279 509Z','url(#leather)','#241e2d',3))
    p.append(path('M300 515Q375 549 471 512L474 562Q392 605 292 566Z','#765452','#a38369',2))
    p.append(path('M329 508Q330 640 317 724M434 509Q425 614 445 724','none','url(#gold)',3))
    p.append(path('M288 737Q369 770 477 734L489 775Q402 809 276 778Z','url(#leather)','#8d6953',2))
    p.append(path('M350 749L412 750L411 790L349 787Z','url(#gold)','#735a40',2))
    p.append(path('M359 756L403 758L402 780L357 779Z','#453b40','#cfb481',1.5))
    p.append(path('M449 786Q421 930 453 1100M302 810Q279 942 302 1069','none','#a57967',2,extra='opacity=".4"'))
    p.append(path('M273 463C234 462 214 492 205 548L187 661L232 721L266 695C244 657 247 604 281 566L304 504Z','url(#leather)','#392c39',2.7))
    p.append(path('M474 465C515 469 554 513 557 549L559 619L597 650L581 696L529 675C501 646 474 615 467 568Z','url(#leather)','#392c39',2.7))
    p.append(path('M243 479Q278 462 307 487L291 538Q249 533 214 529Z','url(#gold)','#80613e',2))
    p.append(path('M478 479Q516 477 542 511L551 541Q511 549 473 526Z','url(#gold)','#80613e',2))
    p.append(path('M253 490Q275 484 292 494M492 493Q515 496 532 518','none','#f9dda4',2))
    p.append(path('M197 631L234 656L229 689L187 667Z','url(#gold)','#80613e',2))
    p.append(path('M553 625L597 646L587 687L549 669Z','url(#gold)','#80613e',2))
    p.append(path('M230 683C250 678 261 690 271 713L291 729C303 736 303 743 294 747L277 739L285 759C288 769 281 773 276 764L265 745L269 766C270 777 263 780 259 770L253 746L251 765C249 775 240 774 240 763L240 742C229 724 221 709 230 683Z','url(#skin)','#9c767c',2))
    p.append(path('M583 649C599 641 610 648 620 660L627 681L614 692L594 692L578 674Z','url(#skin)','#9c767c',2))
    p.append(path('M593 660L614 667M593 671L618 678M591 682L609 688','none','#b68b81',1.6))
    # A long engraved sword, sloping behind her shoulder, with curved guard.
    p.append(path('M602 649L680 90L699 46L712 94L627 653Z','url(#steel)','#526476',2.5))
    p.append(path('M697 69L611 638','none','#f7f5e5',3))
    p.append(path('M559 638Q589 616 625 624Q660 635 676 620L668 643Q646 658 621 645Q591 639 570 655Z','url(#gold)','#80613e',2))
    p.append(path('M610 647L594 744','none','#382c38',18))
    p.append(path('M607 660L595 733','none','url(#gold)',4))
    p.append(orbit(595,748,14))
    for y in [220,290,360,430,500]:p.append(star(681-(y-90)*.145,y,.33,'#b3d2da'))
    p.append(path('M343 388L342 450Q379 477 433 450L430 389Z','url(#skinShade)','#a37d83',2))
    p.append(path('M267 448L347 433Q391 460 436 433L512 464L466 511Q377 499 296 511Z','url(#firecape)','#65343f',2.4))
    p.append(path('M296 478Q371 499 466 474','none','url(#gold)',5))
    p.append(orbit(349,482,18))
    p.append(face('determined','ember'))
    p.append(path('M288 234C265 187 276 142 317 120Q364 90 404 110Q461 92 501 132C541 169 518 233 502 279L493 349L521 377Q487 385 471 350L459 330L468 373L441 351L444 230Q418 212 399 176Q377 215 345 227Q359 206 357 193Q319 243 287 255Z','url(#hair)','#743d3d',2.7))
    p.append(path('M280 219Q262 260 276 310L261 339L241 351L272 357L262 390Q305 379 321 335L310 273Z','url(#hair)','#743d3d',2.5))
    p.append(path('M298 137Q265 134 253 160Q258 121 297 118Q313 90 348 92Q332 110 342 120Q380 82 417 99L402 116Q463 112 492 146Q515 174 505 214Q482 163 448 151L464 186Q426 173 406 149L385 179L378 143Q345 177 311 197L319 171L287 204Z','url(#hair)','#743d3d',2.5))
    for d in ['M290 160Q301 133 336 124','M347 143L377 127','M407 129Q451 134 480 164','M420 158Q437 183 464 197','M291 254Q286 303 301 333','M486 255Q478 305 493 340','M282 316L276 350']:
        p.append(path(d,'none','#ffd29a',2,extra='opacity=".52"'))
    p.append(path('M474 236L487 230L486 273L474 270Z','url(#gold)','#8a613f',1))
    p.append(star(480,280,.65,'#dfbd80'))
    p.append(constellation([(325,596),(355,580),(389,608),(425,589),(448,614)],.38))
    return defs('#923c3a','#f3a166','#643345','#d99e61','#994f35','#5f302d')+'<g filter="url(#paint)">'+''.join(p)+'</g>'

def flower(x,y,s=1):
    return f'<g transform="translate({x} {y}) scale({s})">'+path('M0 0Q-27 -17 -20 -32Q-10 -44 2 -21Q10 -48 26 -36Q36 -25 12 -7Q44 -12 44 6Q42 26 15 13Q28 41 7 43Q-11 45 -8 17Q-38 37 -42 18Q-45 -3 -16 2Z','#dbc2dc','#a884b1',1.5)+'<circle r="7" fill="url(#gold)"/></g>'

def sylvie():
    p=[]
    p.append('''<defs><linearGradient id="botanic" x2="1" y2="1"><stop stop-color="#95b6a1"/><stop offset=".4" stop-color="#456d65"/><stop offset="1" stop-color="#243d49"/></linearGradient><linearGradient id="hat" x2=".8" y2="1"><stop stop-color="#a893bf"/><stop offset=".4" stop-color="#574d76"/><stop offset="1" stop-color="#32354d"/></linearGradient></defs>''')
    p.append(path('M270 219C227 265 223 342 200 431C166 523 177 610 159 718C117 840 151 939 105 988Q172 978 182 951Q159 1027 228 1088Q206 985 262 924C303 849 296 727 331 619L362 258Z','url(#hair)','#745e87',2.5))
    p.append(path('M469 219C523 282 550 389 517 472C564 618 578 763 632 826C671 874 624 937 660 973Q602 968 584 927Q604 1023 553 1074C558 1006 503 944 509 869C466 761 443 693 445 591L413 264Z','url(#hair)','#745e87',2.5))
    p.append(path('M282 475Q370 439 463 472C501 569 472 650 505 742Q581 905 596 1100H217C232 955 274 859 280 751C264 641 255 558 282 475Z','url(#botanic)','#374d56',3))
    p.append(path('M320 497Q370 470 425 495L449 767Q411 825 361 815L302 761Z','url(#ivory)','#87958c',2))
    p.append(path('M346 513Q367 579 353 692M414 519Q393 604 414 699','none','#9caa96',2))
    p.append(path('M294 738Q369 772 493 733L507 769Q394 812 286 775Z','url(#lilac)','#8a7893',2))
    p.append(path('M306 787Q262 946 263 1100M373 823Q347 949 352 1100M456 808Q505 988 487 1100','none','#bdd0b0',3,extra='opacity=".28"'))
    p.append(path('M279 468C237 466 209 501 194 555L158 665Q141 701 164 735L216 752Q251 733 246 694L248 588L306 507Z','url(#ivory)','#879592',2.5))
    p.append(path('M472 471C528 488 545 557 538 602L576 694L559 741L505 738Q482 716 489 670L471 595L440 516Z','url(#ivory)','#879592',2.5))
    p.append(path('M174 670Q191 699 228 689L235 740Q199 777 155 731Z','url(#botanic)','#54756b',2))
    p.append(path('M498 683Q526 708 562 696L579 728Q548 770 503 743Z','url(#botanic)','#54756b',2))
    for d in ['M246 535Q217 608 229 654','M207 557L215 603','M491 541Q521 590 515 630','M499 650L524 665']:
        p.append(path(d,'none','#a8b4ad',2.5))
    p.append(path('M198 740C183 733 173 719 174 704L168 683C164 671 170 667 176 676L185 690L184 665C185 654 193 655 194 666L198 689L203 666C206 656 214 659 212 670L209 694L218 682C225 673 232 679 225 688L214 708Q225 726 213 739Z','url(#skin)','#a17d86',2))
    p.append(path('M197 708Q204 718 201 728M186 691L192 704','none','#c39b93',1.3))
    p.append(path('M560 705C575 697 587 706 594 723L606 738L599 751L583 750L562 738L550 718Z','url(#skin)','#a17d86',2))
    p.append(path('M571 713L590 724M567 724L590 736M567 735L579 743','none','#c39b93',1.3))
    p.append(path('M597 494Q587 711 612 1087','none','#5f7055',12))
    p.append(path('M595 508Q579 717 609 947','none','url(#gold)',2))
    p.append(path('M598 544Q548 499 561 467Q589 472 598 512M598 564Q643 511 657 527Q652 556 598 564','url(#botanic)','#7c9876',2))
    p.append(path('M592 508Q571 462 602 429Q624 440 610 476','none','#547259',7))
    p.append(flower(604,430,.8)+flower(568,471,.45)+flower(644,527,.4))
    p.append('<ellipse cx="191" cy="640" rx="57" ry="57" fill="url(#magic)"/>')
    p.append(flower(188,641,.45)+star(145,601,.35,'#d0ebce')+star(223,621,.3,'#e9d0ed'))
    # Hand-drawn climbing botanical embroidery across skirt and sleeves.
    for x,y,sgn in [(286,968,1),(487,980,-1),(380,1060,1),(206,591,1)]:
        p.append(path(f'M{x} {y}q{22*sgn} -42 {6*sgn} -75q{-18*sgn} -45 {13*sgn} -82','none','#bec6a0',2))
        for ox,oy,rot in [(6,-26,-45),(12,-75,30),(4,-120,-35)]:
            p.append(f'<use href="#tinyLeaf" transform="translate({x+ox*sgn} {y+oy}) rotate({rot*sgn}) scale(.4)" fill="#a8bba0"/>')
    p.append(path('M347 393L346 447Q381 486 429 450L432 395Z','url(#skinShade)','#a27d86',2))
    p.append(path('M315 461L347 440L385 484L427 440L468 467L438 514L385 494L339 516Z','url(#lilac)','#817291',2))
    p.append(flower(385,493,.6))
    p.append(face('neutral','sylvie'))
    p.append(path('M278 238C270 190 282 151 326 124Q383 96 445 128C494 156 504 209 486 252L463 231L447 188Q421 221 382 236L392 193Q363 223 334 226L344 198Q305 235 278 238Z','url(#hair)','#806891',2.5))
    p.append(path('M287 231C271 300 282 353 265 397Q253 424 230 433Q284 437 301 396C318 355 308 298 309 257Z','url(#hair)','#806891',2))
    p.append(path('M471 235Q486 321 463 373L486 430L513 411Q489 357 497 318L492 259Z','url(#hair)','#806891',2))
    for d in ['M298 186Q326 154 365 146','M383 149Q428 153 459 195','M293 269Q290 358 279 391','M482 275Q479 322 475 352']:
        p.append(path(d,'none','#f0dded',2,extra='opacity=".5"'))
    # A woven braid with alternating curved strands.
    for i in range(11):
        x=498+math.sin(i*.45)*22;y=371+i*42
        p.append(path(f'M{x} {y}q-30 3 -22 26q10 14 32 23q25 -12 19 -31q-10 -17 -29 -18Z','url(#hair)','#806891',1.6))
        p.append(path(f'M{x-15} {y+9}q6 14 27 23','none','#d8c1de',1.4,extra='opacity=".6"'))
    p.append(path('M512 834Q540 848 556 878L531 867L522 890L506 846Z','url(#lilac)','#806891',2))
    # Elegant bent witch hat with cloth folds, herb garland and floral ribbons.
    p.append(path('M235 193Q273 149 289 112Q314 57 345 40Q392 3 444 30Q406 52 403 80Q477 83 511 171L543 201Z','url(#hat)','#554763',3))
    p.append(path('M234 185Q367 160 553 176Q592 176 615 201Q585 233 538 228Q388 218 239 235Q204 235 185 214Q193 191 234 185Z','url(#hat)','#554763',3))
    p.append(path('M248 172Q373 148 524 170L538 191Q381 174 238 197Z','url(#lilac)','#a991b5',2))
    p.append(path('M310 102Q340 59 378 49M408 99Q457 111 479 153M217 214Q372 195 581 210','none','#dbc5da',2,extra='opacity=".3"'))
    p.append(flower(492,177,.6)+flower(455,174,.35)+flower(528,191,.35))
    p.append(path('M517 210Q552 249 520 286L503 256L476 285Q462 245 493 217Z','url(#lilac)','#9d81ac',2))
    p.append(star(352,137,.4,'#d6c6a7'))
    return defs('#9b78b6','#dac9e5','#576f71','#b08bd0','#76528e','#413358')+'<g filter="url(#paint)">'+''.join(p)+'</g>'

def kael():
    p=[]
    p.append(path('M294 441C221 424 151 499 143 632C112 789 149 938 85 1074Q164 1038 211 1100H659Q719 941 682 791C660 615 627 496 483 439Z','url(#cloth)','#18283e',3))
    p.append(path('M590 526Q611 740 642 851Q670 968 620 1073M185 608Q163 876 196 1022','none','#7c8eab',3,extra='opacity=".27"'))
    p.append(path('M279 455C307 433 350 424 390 430C443 426 483 442 513 479L548 597L512 765L536 1028L461 1100H299L248 1037L269 759L234 593Z','url(#gold)','#745a38',3))
    p.append(path('M310 484Q359 457 395 472Q444 456 481 495L494 601Q444 641 394 620Q342 643 292 604Z','url(#gold)','#7c603a',2))
    p.append(path('M307 497Q347 480 385 489M410 489Q449 480 477 505','none','#fff0bf',3))
    p.append(path('M393 486V618M300 612Q393 662 491 611','none','#735833',3))
    p.append(path('M278 654Q393 695 518 649L505 750Q387 786 270 746Z','url(#steel)','#4e6173',2.5))
    p.append(path('M280 674Q387 710 513 673M276 708Q389 741 509 706','none','url(#gold)',5))
    p.append(path('M291 784L341 776L326 1048L277 1081L247 1015Z','url(#gold)','#7c603a',2))
    p.append(path('M438 774L496 782L535 1016L499 1091L457 1046Z','url(#gold)','#7c603a',2))
    p.append(path('M343 787L427 785L448 1100H321Z','url(#cloth)','#354964',2))
    # Curved animal crest and chasing, carved into chest armour.
    p.append(path('M395 558Q361 530 334 543Q353 581 382 577Q357 594 346 590Q369 614 394 598Q419 614 444 590Q429 594 410 576Q440 579 457 544Q429 531 395 558Z','#6f593c','#e6ca86',1.6))
    p.append(star(394,567,1.2,'#e8d2a1'))
    for x,sgn in [(302,1),(481,-1)]:
        p.append(path(f'M{x} 552q{20*sgn} 12 {11*sgn} 29q{-13*sgn} 18 {8*sgn} 29','none','#ead29b',1.5))
    p.append(path('M257 454C223 431 180 461 162 502L175 579Q234 600 285 555L312 494Z','url(#gold)','#785d37',3))
    p.append(path('M483 465C535 438 589 465 605 509L587 580Q531 605 484 550L463 505Z','url(#gold)','#785d37',3))
    p.append(path('M176 506Q224 470 283 502M492 505Q548 475 592 521','none','#fce5a7',3))
    p.append(path('M187 548Q219 573 273 536M491 532Q540 575 581 549','none','#826742',2))
    # Folded arms with overlapping anatomical forearm plates and visible hands.
    p.append(path('M182 566Q166 619 195 670L288 736L337 710L274 647L258 572Z','url(#gold)','#745a38',2.8))
    p.append(path('M576 573Q614 620 586 663L492 718L449 678L511 631L506 584Z','url(#gold)','#745a38',2.8))
    p.append(path('M251 647Q275 634 297 648L430 719L414 763L347 766L285 728Z','url(#steel)','#4f657a',2.7))
    p.append(path('M520 650Q497 639 474 650L349 715L359 759L416 753L487 717Z','url(#gold)','#765b38',2.7))
    p.append(path('M291 671L380 723M502 670L411 723','none','#f4dfac',3))
    p.append(path('M333 711Q352 701 374 708L394 718L397 731L383 733L400 742L394 752L378 749L393 760L383 769L361 758L345 753Z','url(#skin)','#a07c7d',2))
    p.append(path('M377 739L350 726M374 750L352 738','none','#c09285',1.4))
    p.append(path('M418 715Q435 709 450 714L463 725L453 736L433 739L422 732Z','url(#skin)','#a07c7d',2))
    p.append(path('M436 721L451 726M435 731L448 734','none','#c09285',1.4))
    for x,y in [(208,615),(287,694),(546,617),(483,695)]:p.append(orbit(x,y,13))
    p.append(path('M332 389L331 448Q376 493 440 452L442 390Z','url(#skinShade)','#a58281',2.5))
    p.append(path('M315 438L338 425L379 468L439 424L466 447L439 498L378 485L339 499Z','url(#steel)','#526b7c',2))
    p.append(path('M339 448L379 482L438 448','none','url(#gold)',4))
    p.append(face('determined','kael'))
    p.append(path('M272 256C244 216 253 160 293 130Q327 102 368 112Q412 92 455 120Q511 137 516 191L508 254L482 282L470 233L451 191L422 211L431 178Q391 225 349 225L361 196L321 219L330 185Q299 220 291 261L291 308L272 288Z','url(#hair)','#192c42',2.8))
    p.append(path('M286 143Q262 144 251 163Q250 128 292 118L313 91L333 111L373 88L381 108L422 95L416 115Q486 111 511 155L491 175Q461 146 438 141L445 165L402 138L376 175L369 142L331 171L340 144L302 184Z','url(#hair)','#192c42',2.5))
    for d in ['M286 177Q301 147 324 141','M345 143L376 128','M393 128Q435 127 476 157','M449 170Q470 191 480 220','M277 266L280 287']:
        p.append(path(d,'none','#9da7b3',1.8,extra='opacity=".45"'))
    p.append(path('M471 293L474 342','none','#be8f7c',1.5))
    p.append(path('M479 312L482 330','none','#f0cfb6',1))
    p.append(orbit(312,453,14)+orbit(462,455,14))
    return defs('#172231','#536373','#334b65','#c89d51','#856631','#4b3e27')+'<g filter="url(#paint)">'+''.join(p)+'</g>'

def miri():
    p=[]
    p.append('''<defs><linearGradient id="mint" x2="1" y2="1"><stop stop-color="#bad4c8"/><stop offset=".4" stop-color="#658d8e"/><stop offset="1" stop-color="#365767"/></linearGradient></defs>''')
    p.append(path('M281 431Q197 459 183 585C160 697 202 771 189 905L239 1100H578Q583 1009 612 940C588 832 588 638 539 518L461 434Z','url(#mint)','#38586b',3))
    p.append(path('M315 463Q383 441 464 473L472 794Q432 859 324 824L282 560Z','url(#ivory)','#81969b',2.5))
    p.append(path('M330 509Q373 533 450 505M330 550Q374 574 451 546','none','#9fb4ad',2))
    p.append(path('M324 826Q395 855 481 816L506 1100H263C283 1009 318 939 324 826Z','url(#cloth)','#354959',2.5))
    p.append(path('M309 823L482 812L490 860L298 867Z','url(#gold)','#7a6340',2))
    p.append(path('M297 465C254 449 225 479 210 536L205 613L165 665L189 710L235 690Q273 660 277 615L324 527Z','url(#mint)','#446573',2.5))
    p.append(path('M469 469C510 458 552 491 568 555L578 622L614 659L597 703L554 685Q526 653 511 614L450 527Z','url(#mint)','#446573',2.5))
    p.append(path('M214 536Q238 568 271 550M528 538Q551 552 564 584','none','#d1e1d6',2.5,extra='opacity=".4"'))
    p.append(path('M204 637L170 664L191 705L230 681Z','url(#ivory)','#96a8a8',2))
    p.append(path('M573 637L618 658L602 703L561 681Z','url(#ivory)','#96a8a8',2))
    p.append(path('M305 454L328 450L364 515L349 531L295 499M457 452L481 467L463 527L434 507Z','url(#ivory)','#8fa2a4',2))
    p.append(path('M351 532Q363 677 329 799M446 537Q461 678 462 804','none','url(#gold)',3))
    for x,y in [(350,574),(348,621),(344,668)]:p.append(f'<circle cx="{x}" cy="{y}" r="5.5" fill="url(#gold)" stroke="#806b4b" stroke-width="1"/>')
    p.append(path('M189 696C183 683 186 669 196 658L211 648C219 641 224 646 220 654L210 666L230 661C239 659 242 666 234 670L218 677L238 676C248 676 248 684 238 686L220 688L234 694C245 699 240 705 231 702L213 698Q202 710 189 696Z','url(#skin)','#a58083',2))
    p.append(path('M600 662Q617 656 629 668L639 687L625 703L605 695L591 680Z','url(#skin)','#a58083',2))
    p.append(path('M607 672L627 680M605 682L624 689','none','#bd9389',1.4))
    # Chronometer is etched glass and brass, with true clock ticks and hands.
    p.append('<circle cx="235" cy="731" r="82" fill="url(#gold)" stroke="#776245" stroke-width="3"/><circle cx="235" cy="731" r="69" fill="#e5e0c7" stroke="#c1ad7f" stroke-width="3"/><circle cx="235" cy="731" r="58" fill="none" stroke="#9f916d" stroke-width="1"/>')
    for a in range(0,360,30):
        th=math.radians(a);x1=235+math.sin(th)*54;y1=731-math.cos(th)*54;x2=235+math.sin(th)*63;y2=731-math.cos(th)*63
        p.append(path(f'M{x1:.2f} {y1:.2f}L{x2:.2f} {y2:.2f}','none','#8d7b59',2.5))
    p.append(path('M235 731L235 687M235 731L268 748','none','#4f6675',4))
    p.append('<circle cx="235" cy="731" r="7" fill="url(#gold)"/>')
    p.append(path('M205 645Q229 617 253 645M230 646V632','none','url(#gold)',8))
    p.append(path('M286 770Q381 799 433 849Q485 891 515 852','none','url(#gold)',3))
    p.append(orbit(439,863,31))
    p.append(path('M612 522Q617 742 628 1064','none','url(#gold)',11))
    p.append(path('M590 423Q620 404 649 423L644 440Q636 465 617 481Q597 463 593 441Z','url(#steel)','#768896',2))
    p.append(path('M593 491Q614 475 643 489L651 521Q620 538 589 521Z','url(#gold)','#8c7049',2))
    p.append(path('M607 439Q627 458 625 479L632 501L612 501L617 479Q617 459 607 439Z','#9cd1ce','#7ab1b7',1))
    p.append(path('M344 393L346 450Q381 486 429 449L430 392Z','url(#skinShade)','#a58083',2))
    p.append(orbit(387,492,23))
    p.append(face('happy','miri'))
    p.append(path('M279 257C262 215 277 158 321 133Q376 109 442 138Q496 166 503 213L493 263L479 292L466 237L450 207L421 231L426 202L383 229L389 200L350 239L350 208L309 242L295 304L279 320L262 307L277 284Z','url(#hair)','#a09a9a',2.4))
    p.append(path('M283 154Q261 164 253 189Q258 138 295 130Q314 104 346 113Q370 82 397 109Q438 100 457 124Q507 130 518 176L497 189Q476 163 453 162L460 188L418 157L399 183L376 149L343 181L346 151L298 194Z','url(#hair)','#a09a9a',2.4))
    for d in ['M288 195Q306 168 333 156','M350 138Q374 123 391 135','M406 143Q451 142 482 174','M288 265L286 298','M477 251L487 278']:
        p.append(path(d,'none','#fff5d9',2.5,extra='opacity=".7"'))
    # Distinct brass goggles pushed above the forehead.
    p.append(path('M283 178Q375 145 486 176','none','#7e674a',19))
    p.append('<g stroke="#8a724f" stroke-width="4"><ellipse cx="333" cy="172" rx="34" ry="31" fill="url(#gold)"/><ellipse cx="434" cy="173" rx="34" ry="31" fill="url(#gold)"/><ellipse cx="333" cy="171" rx="25" ry="23" fill="#5f8d9d"/><ellipse cx="434" cy="172" rx="25" ry="23" fill="#5f8d9d"/></g>')
    p.append(path('M365 174Q383 166 401 174','none','url(#gold)',8))
    p.append(path('M317 170Q321 154 340 155M418 171Q423 154 441 155','none','#e5eee1',4,extra='opacity=".75"'))
    p.append(path('M283 459Q251 678 247 880Q277 928 293 960L276 960L268 992Q225 937 220 892L241 461Z','url(#ivory)','#93a49e',2))
    p.append(constellation([(473,932),(492,963),(478,1000),(513,1023)],.65))
    p.append(star(349,475,.6,'#e6d498'))
    return defs('#e5d8b3','#fff3d7','#557083','#8ccbc8')+'<g filter="url(#paint)">'+''.join(p)+'</g>'

def world_lyra():
    # A new character sprite, not the old reference-colour chibi.
    p=[]
    p.append('<ellipse cx="128" cy="239" rx="61" ry="11" fill="#071827" opacity=".23"/>')
    p.append(path('M87 151Q63 116 65 82Q61 26 109 20Q157 4 183 49Q208 105 171 176L155 191L81 182Z','url(#hair)','#163149',2))
    p.append(path('M100 192L97 220Q96 231 113 231L124 197M139 195L143 223Q155 232 169 226L162 195','url(#cloth)','#26384c',2))
    p.append(path('M91 117Q69 132 73 172L88 181L106 131M157 116Q182 133 179 171L164 181L144 132','url(#ivory)','#6e7d8a',2))
    p.append(path('M99 117Q128 108 155 119L165 171Q183 188 188 203Q132 221 77 203Q88 181 96 170Z','url(#lilac)','#4b4e6b',2))
    p.append(path('M114 133L105 177M142 133L151 177','none','#dcd4c4',1.5))
    p.append(path('M98 116L115 118L115 158L101 173L88 168M151 116L139 119L141 155L158 173L174 167','url(#ivory)','#83909a',1.8))
    p.append(path('M99 176Q132 187 164 174','none','url(#gold)',3))
    p.append(path('M115 102L115 119Q129 131 141 118L142 99Z','url(#skinShade)','#a28080',1))
    p.append(path('M88 66Q86 39 113 34Q148 28 168 56L170 91Q163 117 133 130Q109 128 91 107Z','url(#skin)','#856d78',1.8))
    p.append(path('M84 74Q76 43 101 27Q136 13 165 34Q186 52 179 91L163 81L159 58L145 75L145 57L125 75L128 55L105 77L108 58L91 88Z','url(#hair)','#163149',2))
    p.append(path('M86 75Q81 116 72 133Q97 134 102 105L100 80M165 75Q166 114 182 131Q157 136 151 108L153 82','url(#hair)','#163149',1.7))
    p.append(eye(110,88,25,14)+eye(147,87,27,15,right=True))
    p.append(path('M105 77Q113 73 122 77M138 75Q149 71 157 76','none','#22374b',1.3))
    p.append(path('M123 109Q131 115 140 108','none','#a77380',1.3))
    p.append(path('M99 45Q112 33 129 34M146 39Q159 44 165 60M91 91Q90 118 81 127M159 93Q160 121 173 128','none','#93cdd0',1.3,extra='opacity=".6"'))
    p.append(path('M177 44Q161 46 157 56Q156 67 166 71Q152 72 148 60Q146 46 161 40Q171 37 177 44Z','url(#gold)','#8a704b',1))
    p.append(orbit(130,131,8)+orbit(164,181,9))
    p.append(star(97,196,.25)+star(157,201,.25))
    body=defs()+''.join(p)
    dest=ROOT/'public'/'assets'/'world'/'hero.svg'
    dest.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">{body}</svg>',encoding='utf-8')

if __name__=='__main__':
    for kind in ['neutral','happy','concerned','determined']:
        write('lyra' if kind=='neutral' else 'lyra-'+kind,lyra(kind))
    for name,draw in [('orion',orion),('ember',ember),('sylvie',sylvie),('kael',kael),('miri',miri)]:write(name,draw(),1100)
    world_lyra()
    print('Original Lyra, five roster portraits, and matching world sprite written.')
