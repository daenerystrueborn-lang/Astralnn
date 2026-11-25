// Rebuild the standalone UI skin assets from the production TypeScript source.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const sharp=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'../..');
const destination=path.join(root,'public/assets/uikit');
const source=fs.readFileSync(path.join(root,'src/ui/kit/materials.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
const moduleRecord={exports:{}};
vm.runInNewContext(compiled.outputText,{exports:moduleRecord.exports,module:moduleRecord,Math,Object,Array},{filename:'materials.js'});
const {skin,SKIN_TOKENS,SKIN_GEOMETRY}=moduleRecord.exports;
const names=['ticket','card','panel','banner','button','tab','medallion','ribbon'];
const tones=['pearl','jade','night'];
fs.mkdirSync(destination,{recursive:true});

for(const name of names)for(const tone of tones){
  const {width,height}=SKIN_GEOMETRY[name];
  const illustration=skin(name,tone).replace('<svg ',`<svg width="${width}" height="${height}" `).replace(/afskin-[a-z0-9]+-\d+/g,`pack_${name}_${tone}`);
  const filename=tone==='pearl'?`${name}.svg`:`${name}-${tone}.svg`;
  fs.writeFileSync(path.join(destination,filename),illustration+'\n');
}
fs.writeFileSync(path.join(destination,'tokens.json'),JSON.stringify({version:1,name:'Astral Silks',palette:SKIN_TOKENS,tones,geometry:SKIN_GEOMETRY},null,2)+'\n');

const title=(x,y,label,subtitle)=>`<text x="${x}" y="${y}" fill="#eee5cb" font-family="Georgia,serif" font-size="20">${label}</text><text x="${x}" y="${y+24}" fill="#9dbdaf" font-family="Arial,sans-serif" font-size="12" letter-spacing="1.5">${subtitle}</text>`;
let preview=`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1430" viewBox="0 0 1400 1430"><defs><radialGradient id="back"><stop stop-color="#254943"/><stop offset="1" stop-color="#10252b"/></radialGradient></defs><path d="M0 0H1400V1430H0Z" fill="url(#back)"/><text x="55" y="49" fill="#eee5cb" font-family="Georgia,serif" font-size="30">ASTRAL SILKS / Illustrated interface skins</text><text x="56" y="77" fill="#ccb77c" font-family="Arial,sans-serif" font-size="12" letter-spacing="2">PEARL · WET JADE · MIDNIGHT SATIN / RESPONSIVE VECTOR ART / LIVE HTML LABELS</text>`;
for(let index=0;index<names.length;index++){
  const name=names[index], {width,height}=SKIN_GEOMETRY[name];
  const column=index%2,row=Math.floor(index/2), areaX=40+column*700,areaY=106+row*325;
  const factor=Math.min(610/width,230/height), displayWidth=width*factor,displayHeight=height*factor;
  const x=areaX+24+(610-displayWidth)/2,y=areaY+68+(230-displayHeight)/2;
  const tone=index===2||index===4?'jade':index===5?'night':'pearl';
  const image=skin(name,tone).replace('<svg ',`<svg x="${x}" y="${y}" width="${displayWidth}" height="${displayHeight}" `);
  preview+=title(areaX+23,areaY+29,name.toUpperCase(),`${tone.toUpperCase()} / ${width} × ${height}`)+image;
}
preview+='</svg>';
fs.writeFileSync(path.join(destination,'preview.svg'),preview);

(async()=>{
  await sharp(Buffer.from(preview)).png().toFile(path.join(__dirname,'ui_pack_review.png'));
  const layers=[];
  let backdrop=`<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="980"><defs><radialGradient id="back"><stop stop-color="#35554c"/><stop offset="1" stop-color="#10252b"/></radialGradient></defs><path d="M0 0H1440V980H0Z" fill="url(#back)"/>`;
  for(let column=0;column<3;column++)backdrop+=title(column*480+26,35,tones[column].toUpperCase(),'THE SAME MATERIAL CRAFT, DIFFERENT SILHOUETTES');
  backdrop+='</svg>';
  for(let column=0;column<3;column++)for(let row=0;row<3;row++){
    const name=['ticket','button','panel'][row],tone=tones[column];
    const filename=tone==='pearl'?`${name}.svg`:`${name}-${tone}.svg`;
    const image=await sharp(path.join(destination,filename)).resize(430,255,{fit:'inside'}).png().toBuffer();
    const metadata=await sharp(image).metadata();
    layers.push({input:image,left:column*480+25+Math.floor((430-metadata.width)/2),top:110+row*285+Math.floor((255-metadata.height)/2)});
  }
  await sharp(Buffer.from(backdrop)).composite(layers).png().toFile(path.join(__dirname,'ui_pack_materials.png'));
  console.log(`Wrote ${names.length*tones.length} reusable vector skins, tokens, preview.svg and two rendered review sheets.`);
})().catch(error=>{console.error(error);process.exit(1)});
