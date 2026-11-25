const path = require('node:path');
const sharp = require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve(__dirname, '../..');
(async () => {
  for (const name of ['observatory','village','forest']) {
    await sharp(path.join(root,'public/assets',name+'.svg')).resize(960,540).png().toFile(path.join(__dirname,name+'-review.png'));
  }
  const labels = ['hero','wisp','sentinel','boss','tree','ruin','crystal'];
  const pieces = [];
  for (let i=0;i<labels.length;i++) {
    const input=await sharp(path.join(root,'public/assets/world',labels[i]+'.svg')).resize(220,250,{fit:'contain',background:{r:35,g:46,b:40,alpha:1}}).png().toBuffer();
    pieces.push({input,left:(i%4)*240,top:Math.floor(i/4)*270});
  }
  await sharp({create:{width:960,height:540,channels:4,background:'#233028'}}).composite(pieces).png().toFile(path.join(__dirname,'world-review.png'));
})();
