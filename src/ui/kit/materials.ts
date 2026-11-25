/** Astral Fantasy's illustrated pearl, wet jade, and midnight satin skin system. */
export type SkinShape = 'ticket' | 'card' | 'panel' | 'banner' | 'button' | 'tab' | 'medallion' | 'ribbon';
export type SkinTone = 'pearl' | 'jade' | 'night';

export const SKIN_TOKENS = {
  midnight: '#10252b', emerald: '#3b8578', cream: '#eee5cb', gold: '#ccb77c', lilac: '#afa5d4',
  ink: '#213c3b', highlight: '#fff7df', seam: '#587766',
} as const;

export const SKIN_GEOMETRY: Record<SkinShape, {width:number; height:number; path:string}> = {
  ticket: {width:640,height:220,path:'M40 18C126 7 180 30 273 18S431 7 545 17C581 8 612 17 624 34L622 77C604 84 600 103 617 116L623 145Q629 184 602 194C499 186 456 206 338 193S182 206 70 194Q32 198 30 166L32 139C50 131 50 97 32 90L30 58Q18 32 40 18Z'},
  card: {width:420,height:560,path:'M67 22C149 5 231 32 323 19Q387 2 395 67C409 157 385 212 398 283C410 373 382 415 392 478Q397 512 355 524C291 515 245 551 180 537C132 546 110 519 80 514C52 518 24 490 28 452C42 376 18 327 29 252C16 181 39 130 27 74Q24 36 67 22Z'},
  panel: {width:960,height:400,path:'M68 26C172 2 260 41 371 25C490 12 593 30 693 18C756 16 801 38 860 18Q925 8 936 60C922 120 945 159 935 205C947 256 917 279 931 322Q944 365 902 377C800 353 777 392 653 369C511 389 442 354 309 372C226 381 147 357 87 376Q36 391 31 338C48 277 20 250 30 193C17 140 40 110 29 68Q28 36 68 26Z'},
  banner: {width:620,height:150,path:'M55 26L103 18C217 6 335 34 456 18Q532 6 567 27L607 14L590 61L609 119L566 112C467 127 351 112 255 131C181 138 143 117 101 128L37 144L47 104L17 88L41 63L24 20Z'},
  button: {width:340,height:112,path:'M33 20C87 6 147 21 185 14C226 7 286 10 311 29Q337 50 299 65C314 73 315 88 297 97C241 103 189 91 145 102C89 114 54 89 30 95Q8 88 21 62Q4 32 33 20Z'},
  tab: {width:240,height:112,path:'M38 37C50 7 77 27 91 19C127 26 168 4 193 18Q215 19 219 50C213 73 239 80 214 95L47 100Q26 111 24 69Q33 39 38 37Z'},
  medallion: {width:240,height:240,path:'M119 13C144 2 158 27 181 27C207 24 204 54 219 69C239 82 219 103 230 124C241 150 215 155 214 178C215 204 188 198 171 217C155 236 136 218 115 228C92 239 84 213 62 211C35 211 43 180 24 169C4 154 24 136 14 116C2 92 26 81 27 61C26 37 56 40 71 24C89 7 101 24 119 13Z'},
  ribbon: {width:900,height:200,path:'M50 26C168 1 256 49 358 24C455 6 547 42 635 21C709 7 789 32 850 17L884 5Q869 40 891 60L874 98Q898 141 871 154L841 149C751 166 682 147 583 171C442 196 366 160 256 181C157 197 104 164 58 178L35 196Q42 148 15 141L29 97Q55 54 41 29Z'},
};

const material: Record<SkinTone, {top:string; middle:string; bottom:string; rim:string; sheen:string; ink:string; opacity:string}> = {
  pearl: {top:'#fff7e7',middle:'#eee5cb',bottom:'#b6c8bc',rim:'#e6d8a4',sheen:'#ffffff',ink:'#385b51',opacity:'.89'},
  jade: {top:'#427e71',middle:'#245952',bottom:'#102f36',rim:'#adc3a0',sheen:'#dcfff2',ink:'#c7e3cf',opacity:'.93'},
  night: {top:'#26434c',middle:'#10252b',bottom:'#071922',rim:'#688d82',sheen:'#b5e4db',ink:'#8db9aa',opacity:'.95'},
};

const bootId = Math.random().toString(36).slice(2, 9);
let serial = 0;
const escapeAttribute = (value:string) => value.replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]!));

function star(x:number,y:number,size:number,fill:string,opacity=1):string {
  return `<path d="M${x} ${y-size}Q${x+size*.15} ${y-size*.15} ${x+size} ${y}Q${x+size*.15} ${y+size*.15} ${x} ${y+size}Q${x-size*.15} ${y+size*.15} ${x-size} ${y}Q${x-size*.15} ${y-size*.15} ${x} ${y-size}Z" fill="${fill}" opacity="${opacity}"/>`;
}

function flourish(x:number,y:number,scale:number,angle:number,mirror:boolean,id:string):string {
  return `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${mirror?-scale:scale} ${scale})" opacity=".86">
    <path d="M0 34C1 5 29 3 30 19C31 34 13 36 12 23C12 15 21 13 23 20M0 34C17 22 38 30 33 44C29 57 14 50 20 42M0 34C-7 19 4 5 12 8M0 34C4 53-9 67-17 58" fill="none" stroke="url(#${id}-metal)" stroke-width="1.4" vector-effect="non-scaling-stroke"/>
    <path d="M6 10Q-8 1-12 13Q1 24 6 10M36 34Q53 32 46 48Q31 49 36 34M-8 51Q-23 45-24 61Q-11 67-8 51" fill="url(#${id}-edge)" stroke="url(#${id}-metal)" stroke-width=".65" vector-effect="non-scaling-stroke"/>
    <path d="M2 35Q44 13 62 7M2 35Q41 56 72 51" fill="none" stroke="url(#${id}-metal)" stroke-width=".65" vector-effect="non-scaling-stroke"/>
    <path d="M53 11l4 5m1-8 5 4M56 53l2-5m7 5 2-4" stroke="#fff2c6" stroke-width=".75" opacity=".58" vector-effect="non-scaling-stroke"/>
    ${star(65,6,6,`url(#${id}-metal)`)}${star(74,52,3,'#ede9c5',.65)}
    <circle cx="0" cy="34" r="3.6" fill="url(#${id}-pearl)" stroke="#ecdba3" stroke-width=".65" vector-effect="non-scaling-stroke"/>
  </g>`;
}

function ornament(shape:SkinShape,width:number,height:number,id:string):string {
  if (shape==='medallion') {
    const pearls=Array.from({length:12},(_,index)=>{
      const angle=index*Math.PI/6;
      return `<circle cx="${120+Math.cos(angle)*88}" cy="${120+Math.sin(angle)*88}" r="${index%3===0?3.6:1.8}" fill="url(#${id}-pearl)" stroke="#e2d39b" stroke-width=".6" vector-effect="non-scaling-stroke"/>`;
    }).join('');
    return `<circle cx="120" cy="120" r="79" fill="none" stroke="url(#${id}-metal)" stroke-width="1.1" vector-effect="non-scaling-stroke"/><circle cx="120" cy="120" r="73" fill="none" stroke="#e1e9c7" stroke-width=".7" stroke-dasharray="2 9" opacity=".4" vector-effect="non-scaling-stroke"/>${pearls}${star(120,23,8,`url(#${id}-metal)`)}${flourish(41,90,.39,-24,false,id)}${flourish(200,149,.36,158,false,id)}<path d="M78 198Q124 216 169 192M82 202Q124 219 159 201" fill="none" stroke="url(#${id}-metal)" stroke-width=".8" vector-effect="non-scaling-stroke"/>`;
  }
  const compact=shape==='button'||shape==='tab';
  const scale=compact?.34:shape==='ticket'?.52:shape==='card'?.66:shape==='banner'?.42:shape==='ribbon'?.65:.75;
  const top=compact?height*.23:height*.13;
  const left=compact?width*.095:width*.065;
  let decoration=flourish(left,top,scale,0,false,id)+flourish(width-left,height-top,scale,180,false,id);
  if(shape==='panel'||shape==='card') {
    decoration+=flourish(width-left,top,scale,0,true,id)+flourish(left,height-top,scale,180,true,id);
    decoration+=star(width*.5,height*.07,shape==='card'?12:9,`url(#${id}-metal)`);
    decoration+=`<path d="M${width*.5-43} ${height*.07}q17 8 32 0m22 0q15 8 32 0" stroke="url(#${id}-metal)" stroke-width=".8" fill="none" vector-effect="non-scaling-stroke"/>`;
  }
  if(shape==='banner'||shape==='ribbon') {
    decoration+=`<path d="M${width*.086} ${height*.21}Q${width*.12} ${height*.58} ${width*.072} ${height*.83}M${width*.94} ${height*.22}Q${width*.903} ${height*.52} ${width*.948} ${height*.77}" fill="none" stroke="url(#${id}-fold)" stroke-width="5" opacity=".48" vector-effect="non-scaling-stroke"/>`;
  }
  return decoration;
}

/** Decorative background only. Put semantic HTML text and controls in the parent. */
export function skin(shape:SkinShape,tone:SkinTone='pearl',extraClass=''):string {
  const geometry=SKIN_GEOMETRY[shape];
  const finish=material[tone];
  const {width:w,height:h,path}=geometry;
  const id=`afskin-${bootId}-${++serial}`;
  const surfaceTransform=`translate(${w*.012} ${h*.019}) scale(.976 .96)`;
  const fineTransform=`translate(${w*.022} ${h*.036}) scale(.956 .928)`;
  const fibers=Array.from({length:15},(_,index)=>{
    const x=(index*31+9)%96,y=(index*47+7)%96;
    return `<path d="M${x} ${y}q${2+index%3} -.45 ${3.5+index%4} ${index%2?.5:-.5}" stroke="${index%3?'#fffbed':'#506e61'}" stroke-width="${index%2?.35:.5}" opacity="${index%3?.22:.09}"/>`;
  }).join('');
  const grain=Array.from({length:42},(_,index)=>`<circle cx="${(index*47+13)%96}" cy="${(index*29+23)%96}" r="${.25+(index%3)*.13}" fill="${index%2?'#f8f5da':'#24483e'}" opacity="${index%2?.25:.14}"/>`).join('');
  const gloss=`M${-w*.06} ${h*.05}C${w*.21} ${-h*.11} ${w*.53} ${h*.12} ${w*1.06} ${-h*.06}L${w*1.05} ${h*.19}C${w*.65} ${h*.13} ${w*.38} ${h*.38} ${-w*.07} ${h*.20}Z`;
  const edgeGlint=`M${w*.09} ${h*.115}C${w*.29} ${h*.048} ${w*.55} ${h*.17} ${w*.84} ${h*.10}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="skin-art skin-art--${shape} skin-art--${tone}${extraClass?' '+escapeAttribute(extraClass):''}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true" focusable="false" pointer-events="none">
    <defs>
      <linearGradient id="${id}-metal" x1="0" y1="0" x2=".68" y2="1"><stop stop-color="#fff4cb"/><stop offset=".21" stop-color="#ccb77c"/><stop offset=".43" stop-color="#edf1c9"/><stop offset=".67" stop-color="#8a8f62"/><stop offset=".85" stop-color="#e6cf8e"/><stop offset="1" stop-color="#657a65"/></linearGradient>
      <linearGradient id="${id}-base" x1=".16" y1="0" x2=".74" y2="1"><stop stop-color="${finish.top}" stop-opacity="${finish.opacity}"/><stop offset=".44" stop-color="${finish.middle}" stop-opacity="${finish.opacity}"/><stop offset="1" stop-color="${finish.bottom}" stop-opacity="${finish.opacity}"/></linearGradient>
      <linearGradient id="${id}-edge" x1="0" y1="0" x2=".15" y2="1"><stop stop-color="#eff4d7" stop-opacity=".76"/><stop offset=".32" stop-color="${finish.rim}" stop-opacity=".46"/><stop offset=".72" stop-color="#365a51" stop-opacity=".16"/><stop offset="1" stop-color="#071f27" stop-opacity=".64"/></linearGradient>
      <linearGradient id="${id}-gloss" x1=".22" y1="0" x2=".26" y2="1"><stop stop-color="${finish.sheen}" stop-opacity="${tone==='pearl'?'.64':'.37'}"/><stop offset=".59" stop-color="${finish.sheen}" stop-opacity=".09"/><stop offset="1" stop-color="${finish.sheen}" stop-opacity="0"/></linearGradient>
      <radialGradient id="${id}-iridescence" cx=".93" cy=".8" r=".66"><stop stop-color="#afa5d4" stop-opacity="${tone==='pearl'?'.24':'.12'}"/><stop offset=".36" stop-color="#91cac2" stop-opacity=".08"/><stop offset="1" stop-color="#b6e2cc" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}-jelly-depth" cx=".44" cy=".26" r=".73"><stop stop-color="#0e3036" stop-opacity="0"/><stop offset=".57" stop-color="#0e3036" stop-opacity="0"/><stop offset="1" stop-color="#0e3036" stop-opacity=".24"/></radialGradient>
      <radialGradient id="${id}-lens" cx=".24" cy=".12" r=".69"><stop stop-color="${finish.sheen}" stop-opacity="${tone==='pearl'?'.28':'.16'}"/><stop offset=".42" stop-color="${finish.sheen}" stop-opacity=".07"/><stop offset="1" stop-color="${finish.sheen}" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}-refraction" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${finish.sheen}" stop-opacity=".5"/><stop offset=".43" stop-color="${finish.sheen}" stop-opacity=".22"/><stop offset=".44" stop-color="${finish.sheen}" stop-opacity="0"/><stop offset="1" stop-color="${finish.sheen}" stop-opacity="0"/></linearGradient>
      <radialGradient id="${id}-pearl" cx=".3" cy=".2" r=".8"><stop stop-color="#fffcee"/><stop offset=".3" stop-color="#ece9ce"/><stop offset=".58" stop-color="#bfcfc1"/><stop offset=".8" stop-color="#afa5d4"/><stop offset="1" stop-color="#678c82"/></radialGradient>
      <linearGradient id="${id}-fold" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#173b37" stop-opacity=".52"/><stop offset=".5" stop-color="#ebecd0" stop-opacity=".72"/><stop offset="1" stop-color="#173b37" stop-opacity=".1"/></linearGradient>
      <pattern id="${id}-grain" width="96" height="96" patternUnits="userSpaceOnUse">${fibers}${grain}<path d="M0 45Q24 39 48 45T96 45M0 77Q29 80 60 74T96 77" fill="none" stroke="#f6f4dd" stroke-width=".5" opacity=".085"/></pattern>
      <clipPath id="${id}-clip" clipPathUnits="userSpaceOnUse"><path d="${path}"/></clipPath>
    </defs>
    <path d="${path}" transform="translate(0 4)" fill="#071e25" opacity=".38"/>
    <path d="${path}" fill="url(#${id}-edge)" stroke="#153b39" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
    <path d="${path}" transform="${surfaceTransform}" fill="url(#${id}-base)" stroke="url(#${id}-metal)" stroke-width="1.55" vector-effect="non-scaling-stroke"/>
    <g clip-path="url(#${id}-clip)">
      <path d="${path}" transform="${surfaceTransform}" fill="url(#${id}-iridescence)"/>
      <path d="${path}" transform="${surfaceTransform}" fill="url(#${id}-jelly-depth)"/>
      <path d="${path}" transform="${surfaceTransform}" fill="url(#${id}-lens)"/>
      <path d="${path}" fill="url(#${id}-grain)" opacity="${tone==='pearl'?'.7':'.5'}"/>
      <path d="${gloss}" fill="url(#${id}-gloss)"/>
      <path d="M${-w*.05} ${h*.08}C${w*.2} ${-h*.06} ${w*.45} ${h*.08} ${w*1.04} ${h*.02}L${w*1.02} ${h*.29}C${w*.65} ${h*.11} ${w*.35} ${h*.27} ${-w*.05} ${h*.19}Z" fill="url(#${id}-refraction)" opacity=".4"/>
      <path d="M${-w*.03} ${h*.85}Q${w*.29} ${h*.71} ${w*.55} ${h*.90}T${w*1.04} ${h*.76}L${w*1.04} ${h*1.06}H${-w*.03}Z" fill="url(#${id}-edge)" opacity=".24"/>
      <path d="${edgeGlint}" fill="none" stroke="${finish.sheen}" stroke-width="1.4" opacity=".4" vector-effect="non-scaling-stroke"/>
      <path d="M${w*.14} ${h*.875}Q${w*.31} ${h*.73} ${w*.53} ${h*.89}T${w*.87} ${h*.82}" fill="none" stroke="${finish.sheen}" stroke-width="1.1" opacity=".28" vector-effect="non-scaling-stroke"/>
      <path d="M${w*.13} ${h*.83}Q${w*.34} ${h*.73} ${w*.51} ${h*.86}T${w*.86} ${h*.81}" fill="none" stroke="${finish.ink}" stroke-width=".75" opacity=".13" vector-effect="non-scaling-stroke"/>
      <path d="${path}" transform="${fineTransform}" fill="none" stroke="url(#${id}-metal)" stroke-width=".65" opacity=".72" vector-effect="non-scaling-stroke"/>
      ${ornament(shape,w,h,id)}
      <g opacity=".55">${star(w*.13,h*.13,shape==='card'?6:4,'#f7f3d6')}${star(w*.86,h*.81,shape==='card'?5:3,'#d5e8d4')}</g>
      <path class="skin-hover-gloss" d="${gloss}" fill="url(#${id}-gloss)" opacity="0"/>
    </g>
    <path class="skin-active-edge" d="${path}" transform="${surfaceTransform}" fill="none" stroke="#f1e4ad" stroke-width="2" vector-effect="non-scaling-stroke" opacity="0"/>
    <path class="skin-focus-path" d="${path}" fill="none" stroke="#f4ffe4" stroke-width="2.6" vector-effect="non-scaling-stroke" opacity="0"/>
  </svg>`;
}
