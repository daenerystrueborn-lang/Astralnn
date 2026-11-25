import manifest from '../../content/manifests/assets.json';
export interface AssetEntry { id:string; url:string; category:'scene'|'portrait'|'icon'|'material'|'world'; width:number; height:number; }
const entries=manifest as AssetEntry[];
const cache=new Map<string,Promise<string>>();
export function illustratedFallback(entry:AssetEntry):string {
  if(entry.category==='material'){
    const dark=entry.id.includes('slate');
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><defs><linearGradient id="base" x2="1" y2="1"><stop stop-color="${dark?'#36333b':'#f3e8d0'}"/><stop offset="1" stop-color="${dark?'#171d2b':'#c7b38b'}"/></linearGradient><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".65" numOctaves="4" seed="23"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".17"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter><pattern id="fibers" width="45" height="53" patternUnits="userSpaceOnUse"><path d="M3 5q8 2 15-1M8 25l16 2M32 41q7-1 11 2" stroke="${dark?'#a9956a':'#6d512c'}" opacity=".1" fill="none"/></pattern></defs><path d="M0 0H512V512H0Z" fill="url(#base)" filter="url(#grain)"/><path d="M0 0H512V512H0Z" fill="url(#fibers)"/></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
  const emblem = entry.category==='icon' || entry.category==='portrait' || entry.category==='world';
  const drawing = emblem ? `<circle cx="256" cy="256" r="170" fill="url(#sky)" stroke="#c8a96b" stroke-width="8"/><circle cx="256" cy="256" r="152" fill="none" stroke="#e8d3a1" stroke-width="2" stroke-dasharray="3 12"/><path d="M256 85 288 220 427 256 288 288 256 427 224 288 85 256 224 220Z" fill="url(#gold)"/><circle cx="256" cy="256" r="47" fill="#212333" stroke="#f5e4bb" stroke-width="4"/><path d="M236 246q20-29 41 0l-21 30z" fill="#cfb177"/>` : `<path d="M0 430Q150 190 330 390T650 280T1024 350V576H0Z" fill="#222a39"/><path d="M80 576V180q55-90 110 0v396M750 576V180q65-100 130 0v396" fill="#202331" stroke="#927750" stroke-width="6"/><path d="M103 320V188q32-58 64 0v132zM777 320V188q35-62 71 0v132z" fill="url(#sky)"/><path d="M-30 500Q250 450 550 510T1080 470V576H0Z" fill="#121a24"/><path d="M105 0 167 0 360 576 215 576zM778 0 830 0 650 576 570 576z" fill="#deceb0" opacity=".10"/>`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${entry.width}" height="${entry.height}" viewBox="0 0 ${emblem?'512 512':'1024 576'}"><defs><linearGradient id="gold"><stop stop-color="#f3deb2"/><stop offset=".4" stop-color="#b98e48"/><stop offset="1" stop-color="#e5c993"/></linearGradient><radialGradient id="sky"><stop stop-color="#a494be"/><stop offset=".4" stop-color="#484261"/><stop offset="1" stop-color="#171c2a"/></radialGradient><filter id="grain"><feTurbulence baseFrequency=".48" numOctaves="3" seed="8"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".14"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter></defs>${emblem?'':`<path d="M0 0H1024V576H0Z" fill="url(#sky)"/>`}${drawing}<g opacity=".7" fill="#f2deaa">${Array.from({length:36},(_,i)=>`<circle cx="${(i*157+67)%(emblem?512:1024)}" cy="${(i*73+29)%(emblem?512:410)}" r="${i%3+0.8}"/>`).join('')}</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
export function resolveAsset(entry:AssetEntry):Promise<string> {
  if(cache.has(entry.id)) return cache.get(entry.id)!;
  const request=new Promise<string>(resolve=>{const image=new Image();image.onload=()=>resolve(entry.url);image.onerror=()=>{console.info(`[Astral assets] Illustrated fallback: ${entry.id}`);resolve(illustratedFallback(entry));};image.src=entry.url;});cache.set(entry.id,request);return request;
}
export function installImageFallbacks(root:HTMLElement):()=>void {
  const handler=(event:Event)=>{const image=event.target;if(!(image instanceof HTMLImageElement)||image.dataset.fallback==='true')return;image.dataset.fallback='true';const path=new URL(image.src,location.href).pathname;const known=entries.find(entry=>entry.url===path);const portrait=/heroine|characters\//.test(path);image.src=illustratedFallback(known??{id:path,url:path,category:portrait?'portrait':'icon',width:portrait?800:256,height:portrait?1200:256});};
  root.addEventListener('error',handler,true);return()=>root.removeEventListener('error',handler,true);
}
export async function resolveWorldAssets():Promise<Record<string,string>> {
  const keys=['ground','tree','ruin','crystal','hero','wisp','sentinel','boss'];
  return Object.fromEntries(await Promise.all(keys.map(async id=>{
    const resolved=await resolveAsset(entries.find(e=>e.id===`world.${id}`)??{id:`world.${id}`,url:`/assets/world/${id}.svg`,category:'world',width:512,height:512});
    // Empty explicitly delegates missing world art to the scene's semantic illustration recipes.
    return [id,resolved.startsWith('data:')?'':resolved];
  })));
}
export async function prepareBackdropAssets(root:HTMLElement):Promise<void>{
  await Promise.all(['observatory','village','forest','parchment','slate'].map(async id=>{
    const entry=entries.find(e=>e.id===id)!;const url=await resolveAsset(entry);
    root.style.setProperty(`--${id}${entry.category==='material'?'-texture':'-art'}`,`url("${url}")`);
  }));
}
export async function preloadInterface(onProgress:(percent:number,label:string)=>void):Promise<void>{
  const critical:AssetEntry[]=[
    ...entries.filter(entry=>['observatory','logo','parchment','slate'].includes(entry.id)),
    {id:'characters.lyra',url:'/assets/characters/lyra.svg',category:'portrait',width:800,height:1200},
    {id:'characters.orion',url:'/assets/characters/orion.svg',category:'portrait',width:800,height:1100},
  ];
  let loaded=0;onProgress(0,'Opening the star atlas');
  await Promise.all(critical.map(async entry=>{await resolveAsset(entry);onProgress(Math.round(++loaded/(critical.length+1)*100),'Gathering illustrations and celestial materials');}));
  await document.fonts.ready;onProgress(100,'Your constellation is ready');
}
