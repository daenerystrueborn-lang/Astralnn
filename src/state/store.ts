import type { CombatResult, SaveState } from '../types';
import roster from '../../content/characters/party.json';
export const SAVE_KEY = 'astral-fantasy:save:v1';
export const freshSave = (): SaveState => ({version:1,name:'Wayfarer',gold:360,shards:100,stamina:80,xp:0,level:1,affinity:0,storyNode:'arrival',storyCompleted:false,dungeonCleared:false,runs:0,party:['lyra'],equipped:'apprentice-focus',inventory:['apprentice-focus'],claimed:[],choices:{},sound:false,reducedMotion:false,lastRestAt:Date.now()});
const finite = (value:unknown, fallback:number, max=999999) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0,Math.min(max,Math.floor(value))) : fallback;
const strings = (value:unknown, fallback:string[]):string[] => Array.isArray(value) && value.every(v=>typeof v==='string') ? [...new Set(value)] : fallback;
export function normalizeSave(input:unknown):SaveState {
  const base=freshSave(); if (!input || typeof input!=='object') return base;
  const s=input as Partial<SaveState>; if(s.version!==1) return base;
  return {...base,name:typeof s.name==='string'?s.name.slice(0,30):base.name,gold:finite(s.gold,base.gold),shards:finite(s.shards,base.shards),stamina:finite(s.stamina,base.stamina,80),xp:finite(s.xp,0),level:finite(s.level,1,99)||1,affinity:finite(s.affinity,0,100),storyNode:typeof s.storyNode==='string'?s.storyNode:'arrival',storyCompleted:s.storyCompleted===true,dungeonCleared:s.dungeonCleared===true,runs:finite(s.runs,0),party:[...new Set(['lyra',...strings(s.party,['lyra']).filter(v=>roster.some(c=>c.id===v))])],equipped:typeof s.equipped==='string'?s.equipped:'apprentice-focus',inventory:strings(s.inventory,base.inventory),claimed:strings(s.claimed,[]),choices:s.choices&&typeof s.choices==='object'&&!Array.isArray(s.choices)?Object.fromEntries(Object.entries(s.choices).filter(([k,v])=>typeof v==='string'&&k.length<60)): {},sound:s.sound===true,reducedMotion:s.reducedMotion===true,lastRestAt:finite(s.lastRestAt,Date.now(),Number.MAX_SAFE_INTEGER)};
}
export function recoverStamina(save:SaveState,now=Date.now()):SaveState {
  const ticks=Math.floor(Math.max(0,now-save.lastRestAt)/60000);
  return ticks>0?{...save,stamina:Math.min(80,save.stamina+ticks),lastRestAt:now-(now-save.lastRestAt)%60000}:save;
}
export function awardResult(save:SaveState,result:CombatResult):SaveState {
  if(!result.victory&&!result.gold&&!result.shards&&!result.xp) return save;
  const xp=save.xp+Math.max(0,result.xp);
  return {...save,gold:save.gold+Math.max(0,result.gold),shards:save.shards+Math.max(0,result.shards),xp,level:Math.min(99,1+Math.floor(xp/150)),dungeonCleared:save.dungeonCleared||result.victory,runs:save.runs+(result.victory?1:0),storyNode:result.victory&&!save.storyCompleted?'return':save.storyNode};
}
export interface StorageAdapter { getItem(key:string):string|null; setItem(key:string,value:string):void; }
export class SaveStore {
  private value:SaveState; private storage?:StorageAdapter;
  constructor(storage?:StorageAdapter){this.storage=storage;try{this.value=normalizeSave(JSON.parse(storage?.getItem(SAVE_KEY)||'null'));}catch{this.value=freshSave();}}
  get snapshot():SaveState { return this.value; }
  update(updater:(save:SaveState)=>SaveState):SaveState { this.value=normalizeSave(updater(this.value));try{this.storage?.setItem(SAVE_KEY,JSON.stringify(this.value));}catch{/* Progress remains available in memory when storage is restricted. */}return this.value; }
  reset():void { this.update(()=>freshSave()); }
}
