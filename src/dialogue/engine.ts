import nodes from '../../content/dialogue/first-light.json';
import type { DialogueNode, SaveState } from '../types';
const graph = new Map((nodes as DialogueNode[]).map(node=>[node.id,node]));
export function dialogueAt(id:string):DialogueNode { return graph.get(id) ?? graph.get('arrival')!; }
export function selectDialogueChoice(save:SaveState,id:string):SaveState {
  const node=dialogueAt(save.storyNode);const choice=node.choices?.find(c=>c.id===id);if(!choice) return save;
  const alreadyChosen=save.choices[node.id]!==undefined;
  return {...save,storyNode:choice.next,choices:{...save.choices,[node.id]:choice.id},affinity:Math.min(100,save.affinity+(alreadyChosen?0:choice.affinity??0))};
}
export function validateDialogue():string[] {
  return [...graph.values()].flatMap(node=>[node.next,...(node.choices?.map(c=>c.next)??[])].filter((next):next is string=>!!next).filter(next=>!graph.has(next)).map(next=>`${node.id} → ${next}`));
}
