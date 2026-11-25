import {readFile,access} from 'node:fs/promises';
const read=async path=>JSON.parse(await readFile(new URL(`../${path}`,import.meta.url),'utf8'));
const [season,dialogue,skills,dungeon,assets]=await Promise.all(['content/seasons/celestial-departure.json','content/dialogue/first-light.json','content/skills/skills.json','content/dungeons/verdant-sanctum.json','content/manifests/assets.json'].map(read));
const errors=[];
const [items,roster]=await Promise.all(['content/items/gear-and-provisions.json','content/characters/party.json'].map(read));
for(const item of items){if(!item.id||item.price<0||!assets.some(asset=>asset.id===`icons.${item.icon}`))errors.push(`Invalid item: ${item.id}`);}
for(const character of roster){if(!character.id||character.recruitCost<0||!assets.some(asset=>asset.id===character.portrait))errors.push(`Invalid character: ${character.id}`);}
const nodeIds=new Set(dialogue.map(n=>n.id));
if(nodeIds.size!==dialogue.length)errors.push('Duplicate dialogue IDs');
for(const node of dialogue){if(!node.id||!node.speaker||!node.text)errors.push('Incomplete dialogue node');for(const next of [node.next,...(node.choices??[]).map(c=>c.next)].filter(Boolean))if(!nodeIds.has(next))errors.push(`Missing branch: ${node.id} → ${next}`);}
for(const episode of season.episodes){if(!nodeIds.has(episode.start))errors.push(`Missing episode start: ${episode.id}`);if(episode.dungeon!==dungeon.id)errors.push(`Missing dungeon: ${episode.dungeon}`);}
if(skills.length!==9)errors.push('Expected 8 skills and Ultimate');
for(const skill of skills){if(skill.cooldown<0||skill.mana<0||skill.power<=0)errors.push(`Invalid skill: ${skill.id}`);if(!assets.some(a=>a.id===`icons.${skill.icon}`))errors.push(`Missing icon: ${skill.icon}`);}
for(const asset of assets){if(asset.width<=0||asset.height<=0)errors.push(`Invalid asset dimensions: ${asset.id}`);try{await access(new URL(`../public${asset.url}`,import.meta.url));}catch{errors.push(`Missing asset file: ${asset.url}`);}}
if(errors.length){console.error(errors.join('\n'));process.exit(1);}console.log(`Content verified: ${dialogue.length} dialogue nodes, ${skills.length} skills, ${assets.length} local assets.`);
