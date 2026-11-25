import season from '../../content/seasons/celestial-departure.json';
import items from '../../content/items/gear-and-provisions.json';
import roster from '../../content/characters/party.json';
import type { SaveState } from '../types';
export { season };
export function missionProgress(save:SaveState,condition:string):number {
  if(condition==='story')return save.storyCompleted||save.storyNode!=='arrival'?1:0;
  if(condition==='dungeon')return save.dungeonCleared?1:0;
  if(condition==='episode')return save.storyCompleted?1:0;
  if(condition==='party')return save.party.length;
  if(condition==='gear')return save.equipped!=='apprentice-focus'?1:0;
  if(condition==='runs')return save.runs;
  return 0;
}
export function claimMission(save:SaveState,id:string):SaveState {
  const mission=season.missions.find(m=>m.id===id);
  if(!mission||save.claimed.includes(id)) return save;
  const ready=missionProgress(save,mission.condition)>=mission.target;
  return ready?{...save,gold:save.gold+mission.gold,shards:save.shards+mission.shards,claimed:[...save.claimed,id]}:save;
}
export function recruitMentor(save:SaveState):SaveState {
  return recruitCharacter(save,'orion');
}
export function characterUnlocked(save:SaveState,id:string):boolean {
  const character=roster.find(c=>c.id===id);
  return !!character&&(character.unlock==='start'||character.unlock==='dungeon'&&save.dungeonCleared||character.unlock==='level2'&&save.level>=2);
}
export function recruitCharacter(save:SaveState,id:string):SaveState {
  const character=roster.find(c=>c.id===id);
  return !character||save.party.includes(id)||save.shards<character.recruitCost||!characterUnlocked(save,id)?save:{...save,shards:save.shards-character.recruitCost,party:[...save.party,id]};
}
export function partyBonuses(save:SaveState){return roster.filter(c=>c.id!=='lyra'&&save.party.includes(c.id)).reduce((sum,c)=>({hp:sum.hp+c.bonus.hp,mp:sum.mp+c.bonus.mp,attack:sum.attack+c.bonus.attack,regen:sum.regen+c.bonus.regen}),{hp:0,mp:0,attack:0,regen:0});}
export const equippedItem=(id:string)=>items.find(item=>item.id===id);
export function buyItem(save:SaveState,id:string):SaveState {
  const item=items.find(item=>item.shopId===id);
  if(!item||save.gold<item.price) return save;
  if(item.kind==='consumable'&&save.stamina<80) return {...save,gold:save.gold-item.price,stamina:Math.min(80,save.stamina+(item.stamina??0))};
  if(item.kind==='gear'&&!save.inventory.includes(item.id)) return {...save,gold:save.gold-item.price,inventory:[...save.inventory,item.id]};
  return save;
}
export const equipmentBonus=(id:string):number=>items.find(item=>item.id===id)?.attackBonus??0;
