(() => {
'use strict';
const KEY='blackstone-campaigns-v1',OLD='blackstone-expedition-inventory-v1';
let store;try{store=localStorage;}catch(_){}
const clone=x=>JSON.parse(JSON.stringify(x));
function validate(s){
 if(!s||s.version!==1||!Number.isSafeInteger(s.credits)||s.credits<0||!Array.isArray(s.slots)||s.slots.length!==16)throw Error('Invalid save data');
 if(!s.slots.every(x=>x===null||(window.EXPEDITION_ITEMS[x.id]&&Number.isInteger(x.qty)&&x.qty>0&&x.qty<=window.EXPEDITION_ITEMS[x.id].stack)))throw Error('Invalid inventory');
 if(!window.EXPEDITION_DIFFICULTIES[s.difficulty])throw Error('Unknown difficulty');
 if(s.roster&&(!Array.isArray(s.roster)||s.roster.length>4||new Set(s.roster.map(h=>h.id)).size!==s.roster.length||!s.roster.every(h=>/^ranger(?:-[0-9]+)?$/.test(h.id)&&typeof h.name==='string')))throw Error('Invalid test roster');
 if(s.run&&(!Array.isArray(s.run.party)||!s.run.party.length||s.run.party.length>4||!s.run.party.every(h=>typeof h.id==='string'&&Number.isFinite(h.hp)&&Number.isFinite(h.maxHp)&&h.maxHp>0)))throw Error('Invalid expedition');
 for(const [place,slots] of Object.entries(s.restSlots||{}))if(!['bar','temple','ship'].includes(place)||!Array.isArray(slots)||slots.length>3||!slots.every(x=>x===null||(typeof x.id==='string'&&Number.isSafeInteger(x.cost)&&x.cost>=0)))throw Error('Invalid rest assignments');
 if(s.heroProfiles&&(typeof s.heroProfiles!=='object'||Array.isArray(s.heroProfiles)))throw Error('Invalid crew profiles');
 if(s.run?.battle){const b=s.run.battle;if(!Array.isArray(b.units)||b.units.length>12||!b.units.every(u=>typeof u.id==='string'&&Number.isFinite(u.hp)&&Number.isFinite(u.maxHp)&&['party','enemy'].includes(u.side))||!Array.isArray(b.queue)||!Array.isArray(b.log)||!b.log.every(x=>typeof x==='string')||!Number.isInteger(b.round)||!b.units.some(u=>u.id===b.activeId))throw Error('Invalid battle');}
 return s;
}
const empty=()=>({version:1,active:null,slots:[null,null,null]});
function parse(raw){const d=JSON.parse(raw);if(d.version!==1||!Array.isArray(d.slots)||d.slots.length!==3||!(d.active===null||Number.isInteger(d.active)&&d.active>=0&&d.active<3))throw Error('Invalid campaign file');for(const s of d.slots)if(s)validate(s.state);return d;}
let data=empty(),notice='';
try{const raw=store?.getItem(KEY);if(raw)data=parse(raw);else{const old=store?.getItem(OLD);if(old){const s=JSON.parse(old);s.difficulty||='normal';validate(s);data.active=0;data.slots[0]={name:'Campaign 1',updated:Date.now(),state:s};notice='Existing progress imported into Campaign 1.';}}}catch(_){try{data=parse(store.getItem(KEY+'-backup'));notice='Recovered the previous save after a damaged save was detected.';}catch(_){notice='Save could not be read. Import a backup to recover it.';}}
function persist(){try{if(!store)throw Error();const old=store.getItem(KEY);if(old){try{parse(old);store.setItem(KEY+'-backup',old);}catch(_){}}store.setItem(KEY,JSON.stringify(data));return true;}catch(_){notice='Saving failed. Export your campaign before closing the game.';window.dispatchEvent(new Event('save-error'));return false;}}
if(data.active!==null&&!store?.getItem(KEY))persist();
window.CampaignSaves={
 get data(){return data;},get notice(){return notice;},validate,
 storage:{getItem(){return data.active===null?null:JSON.stringify(data.slots[data.active]?.state||null);},setItem(key,value){if(data.active===null)return;const state=validate(JSON.parse(value));data.slots[data.active].state=state;data.slots[data.active].updated=Date.now();if(!persist())throw Error('Save failed');}},
 create(index,difficulty){if(index<0||index>2||!window.EXPEDITION_DIFFICULTIES[difficulty])throw Error('Invalid campaign');const inv=new window.ExpeditionInventory(null);inv.state.difficulty=difficulty;data.slots[index]={name:'Campaign '+(index+1),updated:Date.now(),state:clone(inv.state)};data.active=index;persist();},
 select(index){if(!data.slots[index])throw Error('Empty slot');data.active=index;persist();return clone(data.slots[index].state);},
 export(index){const slot=data.slots[index];if(!slot)return;const blob=new Blob([JSON.stringify({format:'blackstone-save',version:1,campaign:slot},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='blackstone-campaign-'+(index+1)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},
 import(index,text){if(text.length>2000000)throw Error('Save file is too large');const d=JSON.parse(text);if(d.format!=='blackstone-save'||d.version!==1)throw Error('Unsupported save version');validate(d.campaign?.state);data.slots[index]={name:'Campaign '+(index+1),updated:Date.now(),state:clone(d.campaign.state)};data.active=index;persist();}
};
})();
