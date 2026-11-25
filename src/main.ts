import { createOverlay } from './ui/overlay';
import './ui/safe-area.css';
import { SaveStore, awardResult, recoverStamina } from './state/store';
import { dialogueAt, selectDialogueChoice, validateDialogue } from './dialogue/engine';
import { buyItem, claimMission, recruitCharacter, characterUnlocked, partyBonuses, equippedItem } from './seasons/progression';
import { installImageFallbacks, resolveWorldAssets, prepareBackdropAssets, preloadInterface } from './assets/resolver';
import { Soundscape } from './audio/soundscape';
import { EventBus } from './core/events';
import skillData from '../content/skills/skills.json';
import dungeonData from '../content/dungeons/verdant-sanctum.json';
import roster from '../content/characters/party.json';
import items from '../content/items/gear-and-provisions.json';
import type { CombatResult, DungeonAPI, Menu, Screen, Skill, UIAction } from './types';

const app = document.querySelector<HTMLElement>('#app')!;
const world = document.querySelector<HTMLElement>('#world-root')!;
const overlayRoot = document.querySelector<HTMLElement>('#overlay-root')!;
const pages: Screen[] = ['party','recruit','season','missions','shop','settings','help'];
const routes: Screen[] = ['title','hub','story','dungeon','cutscene',...pages];
const readRoute = (): Screen | undefined => {
  const value = location.hash.replace(/^#\/?/, '');
  return routes.includes(value as Screen) ? value as Screen : undefined;
};
let storage: Storage | undefined;
try { storage = window.localStorage; } catch {}
const store = new SaveStore(storage);
store.update(save => recoverStamina(save));
const events = new EventBus<{ reward: CombatResult; screen: Screen }>();
const sound = new Soundscape();
const initialRoute = readRoute();
let screen: Screen = initialRoute === 'dungeon' ? 'cutscene' : initialRoute ?? 'title';
let returnTo: Screen = 'hub';
let menu: Menu = null;
let result: CombatResult | null = null;
let dungeon: DungeonAPI | undefined;
let starting = false, booting = true, loadProgress = 0;
let loadLabel = 'Opening the star atlas';
let runId = 0, rewardedRun = -1;
const ui = createOverlay(overlayRoot, action => void dispatch(action));
installImageFallbacks(app);
const isPhonePortrait = () => window.matchMedia('(orientation: portrait) and (max-width: 900px) and (pointer: coarse)').matches;
const canEnterDungeon = () => store.snapshot.storyCompleted || store.snapshot.choices.choice !== undefined;

function syncPause() {
  dungeon?.setPaused(screen !== 'dungeon' || result !== null || isPhonePortrait() || document.hidden);
}
function render() {
  app.dataset.screen = screen;
  app.classList.toggle('reduce-motion', store.snapshot.reducedMotion);
  world.hidden = screen !== 'dungeon';
  ui.render({ screen, save: store.snapshot, menu, dialogue: dialogueAt(store.snapshot.storyNode), result,
    skills: skillData as Skill[], loading: booting || starting, loadProgress, loadLabel });
  syncPause();
}
function changeScreen(next: Screen) {
  screen = next;
  menu = null;
  if (location.hash !== '#/' + next) history.pushState({screen: next}, '', '#/' + next);
  events.emit('screen', next);
  render();
}
function disposeDungeon() {
  runId++;
  starting = false;
  dungeon?.destroy();
  dungeon = undefined;
  world.replaceChildren();
  returnTo = 'hub';
}
function openPage(page: Screen) {
  if (!pages.includes(screen)) returnTo = screen;
  changeScreen(page);
}
async function startDungeon() {
  if (dungeon) { changeScreen('dungeon'); return; }
  if (starting) return;
  if (store.snapshot.stamina < dungeonData.entryStamina) {
    changeScreen('shop');
    ui.toast('Rest restores 1 stamina each minute. An Astral Tonic can prepare your next expedition.');
    return;
  }
  starting = true;
  result = null;
  loadProgress = 10;
  loadLabel = 'Preparing the Verdant Sanctum';
  changeScreen('dungeon');
  const current = ++runId;
  let charged = false;
  try {
    const [assets, worldModule] = await Promise.all([
      resolveWorldAssets(), import('./world/DungeonGame')
    ]);
    if (current !== runId) return;
    loadProgress = 85;
    loadLabel = 'Tracing the guardian’s constellation';
    store.update(save => ({...save, stamina: save.stamina - dungeonData.entryStamina, lastRestAt: Date.now()}));
    charged = true;
    render();
    const equipment = equippedItem(store.snapshot.equipped);
    dungeon = worldModule.createDungeon(world, {
      assets, reducedMotion: store.snapshot.reducedMotion, playerLevel: store.snapshot.level,
      attackBonus: equipment?.attackBonus ?? 0, hpBonus: equipment?.hpBonus ?? 0, mpBonus: equipment?.mpBonus ?? 0,
      companions: store.snapshot.party.length - 1, partyBonuses: partyBonuses(store.snapshot),
      onStats: stats => {
        if (current !== runId) return;
        if (starting) { starting = false; loadProgress = 100; render(); }
        ui.updateCombat(stats);
      },
      onHint: message => ui.toast(message),
      onError: message => {
        if (current !== runId) return;
        if (charged) store.update(save => ({...save, stamina: Math.min(80, save.stamina + dungeonData.entryStamina)}));
        disposeDungeon();
        changeScreen('hub');
        ui.toast(message);
      },
      onResult: outcome => {
        if (current !== runId || rewardedRun === current) return;
        rewardedRun = current;
        result = outcome;
        store.update(save => awardResult(save, outcome));
        events.emit('reward', outcome);
        sound.cue();
        render();
      }
    });
    syncPause();
  } catch (error) {
    console.error('Dungeon could not start', error);
    if (charged) store.update(save => ({...save, stamina: Math.min(80, save.stamina + dungeonData.entryStamina)}));
    disposeDungeon();
    changeScreen('hub');
    ui.toast('The shrine could not open. Your progress is safe; try again.');
  }
}
async function navigate(next: Screen) {
  if (pages.includes(next)) { openPage(next); return; }
  if (next === 'dungeon') {
    if (!canEnterDungeon()) { changeScreen('story'); ui.toast('Accept Lyra’s invitation before entering the sanctum.'); }
    else await startDungeon();
    return;
  }
  if (next === 'cutscene') {
    if (!canEnterDungeon()) { changeScreen('story'); ui.toast('Lyra has a letter for you.'); return; }
  }
  if (dungeon) disposeDungeon();
  result = null;
  changeScreen(next);
}
async function dispatch(action: UIAction): Promise<void> {
  if (booting && action.type === 'enterGame') return;
  if (store.snapshot.sound) void sound.setEnabled(true).catch(() => {});
  if (action.type !== 'skill' && action.type !== 'auto') sound.cue();
  switch (action.type) {
    case 'enterGame': changeScreen('hub'); break;
    case 'back':
      if (dungeon && returnTo === 'dungeon') changeScreen('dungeon');
      else { const target = returnTo === 'dungeon' ? 'hub' : returnTo; if (dungeon) disposeDungeon(); result = null; changeScreen(target); }
      break;
    case 'journey': if (dungeon) disposeDungeon(); changeScreen('story'); break;
    case 'navigate': await navigate(action.screen); break;
    case 'menu': if (action.menu) openPage(action.menu); else await dispatch({type:'back'}); break;
    case 'choice': store.update(save => selectDialogueChoice(save, action.id)); render(); break;
    case 'advance': {
      if (screen === 'cutscene') { await startDungeon(); break; }
      const node = dialogueAt(store.snapshot.storyNode);
      if (node.action === 'dungeon') changeScreen('cutscene');
      else if (node.action === 'complete') {
        store.update(save => ({...save, storyCompleted:true, storyNode:'arrival'}));
        changeScreen('hub');
        ui.toast('Episode complete · A Letter from the Stars');
      } else if (node.next) { store.update(save => ({...save, storyNode:node.next!})); render(); }
      break;
    }
    case 'skill': dungeon?.castSkill(action.index); sound.cue(); break;
    case 'auto': dungeon?.toggleAuto(); break;
    case 'leaveDungeon':
      disposeDungeon(); result = null; changeScreen('hub'); ui.toast('Returned safely to the observatory.'); break;
    case 'resultClose': {
      const victory = result?.victory; disposeDungeon(); result = null;
      changeScreen(victory && !store.snapshot.storyCompleted ? 'story' : 'hub'); break;
    }
    case 'claim': {
      const before = store.snapshot.gold; store.update(save => claimMission(save, action.id)); render();
      ui.toast(before !== store.snapshot.gold ? 'Commission rewards claimed.' : 'This commission is not ready or has already been claimed.');
      break;
    }
    case 'recruit': {
      const id = action.id ?? 'orion';
      const character = roster.find(c => c.id === id);
      const before = store.snapshot.party.length;
      store.update(save => recruitCharacter(save, id)); render();
      ui.toast(store.snapshot.party.length > before ? (character?.name ?? 'A companion') + ' joined your constellation.'
        : store.snapshot.party.includes(id) ? 'This companion is already in your party.'
        : !characterUnlocked(store.snapshot, id) ? 'Follow the chapter milestones to meet this companion.'
        : 'Recruitment requires ' + (character?.recruitCost ?? 0) + ' earned Astral Shards.');
      break;
    }
    case 'buy': {
      const before = store.snapshot.gold;
      const item = items.find(item => item.shopId === action.id);
      store.update(save => buyItem(save, action.id)); render();
      ui.toast(before !== store.snapshot.gold ? item?.kind === 'consumable'
        ? (item.name + ' restored ' + item.stamina + ' stamina.') : (item?.name ?? 'A relic') + ' added to your equipment.'
        : 'You already own this relic, have full stamina, or need more Gold.');
      break;
    }
    case 'equip':
      if (store.snapshot.inventory.includes(action.id)) {
        store.update(save => ({...save, equipped:action.id})); render();
        ui.toast('Relic equipped. Its blessing applies on your next expedition.');
      }
      break;
    case 'sound':
      store.update(save => ({...save, sound:!save.sound}));
      void sound.setEnabled(store.snapshot.sound).catch(() => ui.toast('Audio is unavailable in this browser.'));
      render(); break;
    case 'motion':
      store.update(save => ({...save, reducedMotion:!save.reducedMotion}));
      dungeon?.setReducedMotion?.(store.snapshot.reducedMotion); render(); break;
    case 'reset':
      disposeDungeon(); store.reset(); void sound.setEnabled(false); result = null;
      changeScreen('title'); ui.toast('A new celestial journey begins.'); break;
  }
}
window.addEventListener('resize', syncPause);
document.addEventListener('visibilitychange', syncPause);
const followHistory = () => {
  const target = readRoute() ?? 'title';
  if (target !== screen) void navigate(target);
};
window.addEventListener('popstate', followHistory);
window.addEventListener('hashchange', followHistory);
window.setInterval(() => {
  const old = store.snapshot.stamina; store.update(save => recoverStamina(save));
  if (store.snapshot.stamina !== old && screen !== 'dungeon') render();
}, 30000);
const graphErrors = validateDialogue();
if (graphErrors.length) console.error('Dialogue validation', graphErrors);
render();
document.querySelector('#boot-splash')?.remove();
void (async () => {
  const start = performance.now();
  await Promise.all([
    preloadInterface((percent,label) => { loadProgress = percent; loadLabel = label; render(); }),
    prepareBackdropAssets(app)
  ]);
  const remaining = Math.max(0, 850 - (performance.now() - start));
  if (remaining) await new Promise(resolve => setTimeout(resolve, remaining));
  booting = false;
  if (initialRoute === 'dungeon') changeScreen(canEnterDungeon() ? 'cutscene' : 'story');
  else render();
})();
