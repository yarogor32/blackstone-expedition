(() => {
'use strict';
const morale=window.Morale;
const rangerSkills = [
 {id:'shot',name:'Rifle Shot',from:[2,3,4],to:[1,2,3,4],min:5,max:8,accuracy:90,crit:8,description:'90% hit · 5–8 damage · 8% CRIT'},
 {id:'aim',name:'Aimed Shot',from:[3,4],to:[2,3,4],min:8,max:12,accuracy:80,crit:12,description:'80% hit · 8–12 damage · 12% CRIT · rear targets'},
 {id:'blade',name:'Blade Strike',from:[1,2],to:[1,2],min:4,max:7,accuracy:95,crit:5,bleed:45,bleedDamage:2,bleedTurns:3,description:'95% hit · 4–7 damage · 5% CRIT · 45% base Bleed · front targets'},
 {id:'step',name:'Evasive Step',from:[1,2,3,4],to:[],description:'Move one rank back · evade next attack'}
];
const sororitasSkills = [
 {id:'flamer',name:'Flamer Sweep',from:[2,3,4],to:[1,2,3,4],min:3,max:5,accuracy:88,crit:6,area:2,description:'88% hit · 3–5 damage · burns the selected rank and one adjacent occupied rank'},
 {id:'maul',name:'Shock Maul',from:[1,2,3],to:[1,2],min:4,max:7,accuracy:92,crit:6,stun:55,description:'92% hit · 4–7 damage · 55% base Stun · usable from ranks 1–3 · front targets'},
 {id:'pray',name:'Prayer',from:[1,2,3,4],to:[],morale:12,support:true,description:'+12 Morale to every living non-xenos ally'},
 {id:'step',name:'Guarded Advance',from:[1,2,3,4],to:[],description:'Move one rank back · evade next attack'}
];
const skillSets={ranger:rangerSkills,sororitas:sororitasSkills};
const skillsFor=unit=>skillSets[unit?.classId]||rangerSkills;
class Battle {
 constructor(party,random=Math.random,snapshot=null) {
  this.random=random;this.round=0;this.queue=[];this.log=[];this.result=null;this.turnEffects=[];this.enemyLastSkill={};
  if(snapshot){this.units=JSON.parse(JSON.stringify(snapshot.units));this.units.forEach(u=>morale.complete(u));this.round=snapshot.round;this.queue=[...snapshot.queue];this.log=[...snapshot.log];this.result=snapshot.result;this.enemyLastSkill={...(snapshot.enemyLastSkill||{})};this.active=this.units.find(u=>u.id===snapshot.activeId);return;}
  this.units=party.slice(0,4).map((u,i)=>({hp:28,maxHp:28,morale:100,maxMorale:100,speed:6,bleedResist:10,stunResist:u.classId==='sororitas'?35:20,rank:i+1,side:'party',...u}));
  this.units.push({id:'raider',name:'Hormagaunt',hp:16,maxHp:16,speed:3,bleedResist:15,stunResist:20,rank:1,side:'enemy'}, {id:'psyker',name:'Zoanthrope',hp:20,maxHp:20,speed:2,bleedResist:25,stunResist:40,rank:4,side:'enemy'}, {id:'gunner',name:'Termagant',hp:14,maxHp:14,speed:4,bleedResist:10,stunResist:15,rank:3,side:'enemy'});
  this.next();
 }
 snapshot(){return JSON.parse(JSON.stringify({units:this.units,round:this.round,queue:this.queue,log:this.log,result:this.result,activeId:this.active?.id,enemyLastSkill:this.enemyLastSkill}));}
 roll(min,max){return min+Math.floor(this.random()*(max-min+1));}
 living(side){return this.units.filter(u=>u.side===side&&u.hp>0);}
 next(){
  if(!this.living('party').length)this.result='defeat';
  if(!this.living('enemy').length)this.result='victory';
  if(this.result)return;
  if(!this.queue.length){this.round++;this.queue=this.units.filter(u=>u.hp>0).map(u=>({u,initiative:u.speed+(morale.modifiers(u).speed||0)+this.roll(1,8)})).sort((a,b)=>b.initiative-a.initiative).map(x=>x.u.id);}
  const nextId=this.queue.shift();
  this.active=this.units.find(u=>u.id===nextId);
  if(!this.active||this.active.hp<=0){this.next();return;}
  if(this.active.bleed?.turns>0){
   const effect=this.active.bleed,damage=Math.min(this.active.hp,effect.damage);this.active.hp-=damage;effect.turns--;
   this.turnEffects.push({type:'bleed',target:this.active.id,damage,lethal:this.active.hp<=0});
   this.log.push(`${this.active.name} bleeds for ${damage}.${this.active.hp<=0?' Fallen.':''}`);
   if(effect.turns<=0)this.active.bleed=null;
   if(this.active.hp<=0){this.next();return;}
  }
  if(this.active.stunned?.turns>0){
   this.active.stunned.turns--;this.turnEffects.push({type:'stun',target:this.active.id});this.log.push(`${this.active.name} is Stunned and loses the turn.`);
   if(this.active.stunned.turns<=0)this.active.stunned=null;this.next();return;
  }
 }
 targets(skill){return this.units.filter(u=>u.hp>0&&u.side!==this.active.side&&skill.to.includes(u.rank));}
 move(rank){const a=this.active;if(a.side!=='party'||Math.abs(rank-a.rank)!==1||rank<1||rank>4)return false;const other=this.units.find(u=>u.hp>0&&u.side===a.side&&u.rank===rank);if(other)other.rank=a.rank;a.rank=rank;return true;}
 act(id,targetId){
  if(this.result||this.active.side!=='party')return false;
  const a=this.active;
  if(id==='wait'){this.log.push(`${a.name} holds position.`);this.next();return true;}
  if(id.startsWith('move:')){if(!this.move(Number(id.split(':')[1])))return false;this.log.push(`${a.name} changes position.`);this.next();return true;}
  const skill=skillsFor(a).find(s=>s.id===id);if(!skill||!skill.from.includes(a.rank))return false;
  if(id==='step'){if(a.rank<4)this.move(a.rank+1);a.evade=true;this.log.push(`${a.name} prepares to evade.`);}
  else if(id==='pray'){
   const allies=this.living('party').filter(u=>u.id!==a.id&&!u.xenos&&u.classId!=='ranger'&&u.species!=='aeldari');this.lastImpacts=[];
   for(const ally of allies){const before=ally.morale??100;ally.morale=Math.min(ally.maxMorale||100,before+(skill.morale||0));this.lastImpacts.push({attacker:a.id,target:ally.id,missed:false,critical:false,damage:0,moraleGain:ally.morale-before});}
   this.log.push(allies.some(u=>this.lastImpacts.find(i=>i.target===u.id)?.moraleGain)?`${a.name}'s prayer steadies her human allies.`:`${a.name}'s prayer finds no receptive human soul.`);
  }
  else {const target=this.targets(skill).find(u=>u.id===targetId);if(!target)return false;const targets=skill.area?this.previewTargets(skill,target.id):[target];this.lastImpacts=[];for(const victim of targets){this.hit(a,victim,skill);this.lastImpacts.push({...this.lastImpact});}}
  this.next();return true;
 }
 previewTargets(skill,targetId){const valid=this.targets(skill),target=valid.find(u=>u.id===targetId);if(!target)return[];if(!skill.area)return[target];const adjacent=valid.filter(u=>u.id!==target.id&&Math.abs(u.rank-target.rank)===1).sort((a,b)=>a.rank-b.rank);return[target,...adjacent].slice(0,skill.area);}
 hit(a,t,s){
  this.lastImpact={attacker:a.id,target:t.id,missed:false,critical:false,breakdown:false};
  if(t.hp<=0){this.units=this.units.filter(u=>u!==t);this.log.push(`${a.name} clears a corpse.`);return;}
  if(t.evade){this.lastImpact.missed=true;t.evade=false;this.log.push(`${t.name} evades the attack.`);return;}
  if(this.roll(1,100)>morale.clamp(s.accuracy+(morale.modifiers(a).accuracy||0),5,100)){this.lastImpact.missed=true;this.log.push(`${a.name} misses ${t.name}.`);return;}
  const critical=this.roll(1,100)<=morale.clamp((s.crit??morale.rules.baseCrit)+(a.critBonus||0)+(morale.modifiers(a).crit||0),0,100);
  const base=critical?Math.ceil(s.max*morale.rules.critMultiplier):this.roll(s.min,s.max);
  if(s.psychic){const before=t.morale??100;this.lastImpact.breakdown=morale.hurt(t,0,critical,this.random,base);Object.assign(this.lastImpact,{critical,damage:0,moraleDamage:before-t.morale});this.log.push(`${a.name} tears away ${before-t.morale} morale from ${t.name}.`);return;}
  const damage=Math.max(1,Math.round(base*(morale.modifiers(a).damage||1)*(morale.modifiers(t).incoming||1)));
  const lost=Math.min(t.hp,damage);t.hp=Math.max(0,t.hp-damage);
  Object.assign(this.lastImpact,{critical,damage:lost});
  if(t.hp>0&&s.bleed){
   const chance=morale.clamp(s.bleed+(critical?20:0)-(t.bleedResist||0),5,80);
   this.lastImpact.bleedChance=chance;
   if(this.roll(1,100)<=chance){
    const current=t.bleed||{damage:0,turns:0};
    t.bleed={damage:Math.max(current.damage,s.bleedDamage||2),turns:Math.max(current.turns,s.bleedTurns||3)};
    this.lastImpact.bleedApplied=true;this.log.push(`${t.name} starts bleeding (${t.bleed.damage} × ${t.bleed.turns} turns).`);
   }
  }
  if(t.hp>0&&s.stun){
   const chance=morale.clamp(s.stun+(critical?15:0)-(t.stunResist||0),5,85);this.lastImpact.stunChance=chance;
   if(this.roll(1,100)<=chance){t.stunned={turns:1};this.lastImpact.stunApplied=true;this.log.push(`${t.name} is Stunned (${chance}% chance).`);}
  }
  if(t.side==='party'){const before=t.morale??100;this.lastImpact.breakdown=morale.hurt(t,lost,critical,this.random);this.lastImpact.moraleDamage=Math.max(0,before-t.morale);}
  if(a.side==='party'&&critical)a.morale=Math.min(a.maxMorale||100,(a.morale??100)+morale.rules.critRecovery);
  this.log.push(`${a.name} ${critical?'critically hits':'hits'} ${t.name} for ${lost}.${t.hp===0?' Fallen.':''}`);
 }
 enemyTarget(){const a=this.active;const targets=this.living('party').sort((a,b)=>a.rank-b.rank);return a.id==='psyker'?targets.reduce((weak,h)=>(h.morale??100)<(weak.morale??100)?h:weak,targets[0]):a.id==='gunner'?targets[targets.length-1]:targets[0];}
 planEnemy(){
  const a=this.active,front=this.living('party').sort((a,b)=>a.rank-b.rank);
  let primary,special;
  if(a.id==='psyker'){
   primary={id:'warp',name:'Warp Blast',targets:[this.enemyTarget().id],min:4,max:7,accuracy:80,crit:8};
   special={id:'psychic',name:'Psychic Assault',targets:[this.enemyTarget().id],min:14,max:20,accuracy:85,crit:8,psychic:true};
  }else if(a.id==='gunner'){
   primary={id:'fleshborer',name:'Fleshborer Shot',targets:[this.enemyTarget().id],min:3,max:5,accuracy:85,crit:5};
   special={id:'volley',name:'Fleshborer Volley',targets:front.slice(-2).map(u=>u.id),min:2,max:3,accuracy:80,crit:5};
  }else{
   primary={id:'claws',name:'Scything Talons',targets:[front[0].id],min:2,max:4,accuracy:85,crit:5,bleed:35,bleedDamage:2,bleedTurns:3};
   special={id:'shove',name:'Rending Shove',targets:[front[0].id],min:2,max:4,accuracy:85,crit:5,bleed:25,bleedDamage:2,bleedTurns:3,stun:20,shove:true};
  }
  const last=this.enemyLastSkill[a.id];
  // Open with the signature basic attack. Specials remain threatening, but are
  // occasional and can never fire on two consecutive turns.
  const plan=!last?primary:(last!==special.id&&this.random()<.35?special:primary);
  this.enemyLastSkill[a.id]=plan.id;return plan;
 }
 enemy(plan=this.planEnemy()){
  if(this.result||this.active.side!=='enemy')return;
  const a=this.active;this.lastImpacts=[];this.log.push(`${a.name} uses ${plan.name}.`);
  for(const id of plan.targets){const target=this.units.find(u=>u.id===id&&u.hp>0);if(!target)continue;
   this.hit(a,target,plan);const impact=this.lastImpact;
   if(plan.shove&&!impact.missed&&target.hp>0&&target.rank<4){const rank=target.rank,other=this.units.find(u=>u.side==='party'&&u.hp>0&&u.rank===rank+1);target.rank++;if(other)other.rank=rank;impact.pushed=true;this.log.push(`${target.name} is knocked back one rank.`);}
   this.lastImpacts.push({...impact});
  }
  this.next();
 }

}
window.drawTyranid = (ctx,image,attack,x,y,w,h) => {
 if(attack==='hit'){ctx.drawImage(image,1565,0,607,724,x+w*.12,y,w*.77,h);return;}
 const left=attack?610:0, width=attack?960:790;
 const polygon=attack?[[610,0],[1565,0],[1565,724],[800,724],[795,520],[610,400]]:[[0,0],[570,0],[570,390],[790,535],[790,724],[0,724]];
 ctx.save();ctx.translate(x,y);ctx.scale(w/790,h/724);ctx.translate(-left,0);ctx.beginPath();polygon.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();ctx.clip();ctx.drawImage(image,0,0);ctx.restore();
};
// Timing segments refer to source-frame progress, preserving every pose in order.
const rangerHitTiming = {
 frames:125, fps:41.4, edge:0.35, middle:0.30, boost:1.5,
 get duration(){return this.frames/this.fps*(2*this.edge/this.boost+this.middle);},
 frameAt(seconds){
  const progress=Math.max(0,seconds)*this.fps/this.frames;
  const firstEnd=this.edge/this.boost;
  const middleEnd=firstEnd+this.middle;
  const source=progress<firstEnd?progress*this.boost:
   progress<middleEnd?this.edge+progress-firstEnd:
   this.edge+this.middle+(progress-middleEnd)*this.boost;
  return Math.min(this.frames-1,Math.floor(source*this.frames));
 }
};
window.drawRanger = (ctx,image,kind,time,x,y,size) => {
 ctx.save();ctx.translate(x,y);const unit=size/512;ctx.scale(unit,unit);
 if(kind==='confidence'){const frame=Math.min(40,Math.floor(time*12));ctx.drawImage(image,2+frame%8*516,2+Math.floor(frame/8)*516,512,512,0,0,512,512);}
 else if(kind==='stress'){const frame=Math.min(40,Math.floor(time*12)),scale=348/381,side=512*scale;ctx.drawImage(image,2+frame%8*516,2+Math.floor(frame/8)*516,512,512,(512-side)/2-3/unit,470-445*scale,side,side);}
 else if(kind==='blade'){const frame=Math.min(39,Math.floor(time*24)),scale=348/354,side=512*scale;ctx.drawImage(image,2+frame%8*516,2+Math.floor(frame/8)*516,512,512,(512-side)/2,470-440*scale,side,side);}
 else if(kind==='attack'){const frame=Math.min(76,Math.floor(time*24));const scale=(387*(348/388))/350,side=512*scale;ctx.drawImage(image,2+frame%8*516,2+Math.floor(frame/8)*516,512,512,(512-side)/2,470-431*scale,side,side);}
 else {const hit=kind==='hit';const frame=hit?rangerHitTiming.frameAt(time):Math.floor(time*17.28)%129;
 const scale=hit?.99:348/388,side=512*scale;
 const dx=(512-side)/2,dy=hit?3+467*(1-scale):470-450*scale;
 ctx.drawImage(image,2+frame%8*516,2+Math.floor(frame/8)*516,512,512,dx,dy,side,side);}
 ctx.restore();
};
const sororitasClips={
 idle:{frames:121,fps:18,scale:331/507,foot:511,anchor:285.5},
 attack:{frames:37,fps:12,scale:331/472,foot:511,anchor:192},
 melee:{frames:73,fps:24,scale:331/512,foot:511,anchor:201.5},
 pray:{frames:73,fps:24,scale:.7035,foot:511,anchor:252.5},
 hit:{frames:73,fps:24,scale:331/512,foot:511,anchor:222.5},
 stress:{frames:50,fps:12,scale:331/512,foot:511,anchor:262.5},
 confidence:{frames:73,fps:12,scale:331/512,foot:511,anchor:252.5}
};
window.drawSororitas=(ctx,image,kind,time,x,y,size)=>{
 const clip=sororitasClips[kind]||sororitasClips.idle,loop=kind==='idle',frame=loop?Math.floor(time*clip.fps)%clip.frames:Math.min(clip.frames-1,Math.floor(time*clip.fps));
 const scale=clip.scale,side=512*scale,dx=256-clip.anchor*scale,dy=470-clip.foot*scale;
 ctx.save();ctx.translate(x,y);ctx.scale(size/512,size/512);ctx.drawImage(image,2+frame%8*516,2+Math.floor(frame/8)*516,512,512,dx,dy,side,side);ctx.restore();
};
window.combatImages={};
for(const [id,path] of Object.entries({ranger:'ranger-idle',attack:'ranger-shoot',blade:'ranger-dagger',hit:'ranger-hit',stress:'ranger-low-morale2',confidence:'ranger-confidence',sororitas:'sororitas-idle','sororitas-attack':'sororitas-shoot','sororitas-melee':'sororitas-melee','sororitas-pray':'sororitas-pray','sororitas-hit':'sororitas-hit','sororitas-stress':'sororitas-stress','sororitas-confidence':'sororitas-confidence',raider:'hormagaunt-melee',psyker:'zoanthrope-psyker',gunner:'termagant-ranged'})){const image=new Image();image.src='sprites/'+path+'.webp';window.combatImages[id]=image;}
window.BlackstoneBattle=Battle;
window.startBlackstoneBattle=({party,snapshot,onCheckpoint,onFinish,onOptions,getLayout,onHit,onAttack,onDefeat,onVictory,onInventory,onPartyChange,onFlee,onCameraSide,onStressFocus,onActionFocus,onBreakdown})=>{
 const battle=new Battle(party,Math.random,snapshot);let skills=skillsFor(battle.living('party')[0]),selected=skills[0].id,timer,closed=false,attackId=null,attackTargetId=null,attackTargetIds=[],attackSkill=null,pairUntil=0,attackUntil=0,attackStarted=0,busyUntil=performance.now()+1200,victoryShown=false,defeatAnnounced=false;const camera=new window.CombatCamera();const appearedAt=performance.now();const deaths=new Map();const reactions=new Map();const stressReactions=new Map();const characterEffects=new window.CharacterEffects();const floatingText=new Map();const idleStarts=new Map();const previousPoses=new Map();let focusedId=null;const focusScales=new Map();const rankMotion=new Map();let previousDrawTime=performance.now();
 onPartyChange?.(battle.units.filter(u=>u.side==='party'));onCheckpoint?.(battle.snapshot());
 let inspected='shot',lastTurnNotice='',turnNotice=null,turnNoticeTimer;
 const images=window.combatImages;
 function hideTurnNotice(){clearTimeout(turnNoticeTimer);turnNotice?.remove();turnNotice=null;}
 function announceTurn(active){
  const token=active.side;
  if(token===lastTurnNotice)return;
  lastTurnNotice=token;
  onCameraSide?.(active.side);hideTurnNotice();
  turnNotice=document.createElement('div');turnNotice.className='turn-notice';turnNotice.setAttribute('role','status');
  const player=active.side==='party';
  turnNotice.innerHTML=`<img src="branding/${player?'your':'enemy'}-turn.svg" alt="${player?'Your Turn':'Enemy Turn'}">`;
  document.querySelector('#mission').append(turnNotice);
  turnNoticeTimer=setTimeout(hideTurnNotice,1150);
 }
 function updateInfo(){
  skills=skillsFor(battle.active?.side==='party'?battle.active:battle.living('party')[0]);if(!skills.some(s=>s.id===selected))selected=skills[0].id;
  const panel=root.querySelector('[data-info-content]');if(!panel)return;
  const player=!battle.result&&performance.now()>=busyUntil&&battle.active?.side==='party';
  panel.innerHTML=window.CombatUI.info(inspected,skills,battle.active,player);
 }
 function resolve(action,skill,targetId){
  if(closed||performance.now()<busyUntil)return;
  const attacker=battle.active;
  const shooting=attacker.side==='party'&&['shot','aim','flamer'].includes(skill);
  const enemyPlan=attacker.side==='enemy'?battle.planEnemy():null;if(enemyPlan){action=()=>battle.enemy(enemyPlan);skill=enemyPlan.id;}
  const started=performance.now();
  const selectedSkill=skillsFor(attacker).find(s=>s.id===skill),targetIds=enemyPlan?enemyPlan.targets:(selectedSkill?.area?battle.previewTargets(selectedSkill,targetId).map(u=>u.id):targetId?[targetId]:[]);
  attackId=attacker.id;attackTargetId=targetIds[0]||null;attackTargetIds=[...targetIds];attackSkill=skill;attackStarted=started;
  const partyDuration=skill==='blade'?40/24*1000:skill==='flamer'?37/12*1000:['maul','pray'].includes(skill)?73/24*1000:77/24*1000;
  attackUntil=started+(attacker.side==='party'?partyDuration:700);
  busyUntil=attackUntil+450;pairUntil=attackUntil;camera.start(attackId,targetIds,started,pairUntil);

  if(!shooting||skill==='flamer')onAttack?.(attacker,skill);
  render();
  // Apply the actual combat action at the visible impact, not at button press.
  setTimeout(()=>{
   if(closed)return;
   const now=performance.now();
   const before=new Map(battle.units.map(u=>[u.id,u.hp]));
   battle.lastImpact=null;battle.lastImpacts=[];battle.turnEffects=[];action();onPartyChange?.(battle.units.filter(u=>u.side==='party'));onCheckpoint?.(battle.snapshot());
   const impacts=battle.lastImpacts.length?battle.lastImpacts:[battle.lastImpact].filter(Boolean);
   const turnEffects=battle.turnEffects.splice(0);
   impacts.forEach(hit=>window.ExpeditionSpeech?.impact(battle,hit));
   if(shooting&&skill!=='flamer'&&battle.lastImpact)onAttack?.(attacker,skill);
   for(const hit of impacts)if(hit.missed)floatingText.set(hit.target,{start:now,text:'Missed',missed:true});
   battle.units.forEach(u=>{
    const impact=impacts.find(hit=>hit.target===u.id);
    if(u.hp>=before.get(u.id)&&!impact?.moraleDamage&&!impact?.moraleGain&&!impact?.stunApplied)return;
    const lethal=u.hp===0;if(u.hp<before.get(u.id))onHit?.(u,lethal);
    const damage=before.get(u.id)-u.hp;
    if(impact?.damage>0)floatingText.set(u.id,{start:now,text:'−'+impact.damage,missed:false,critical:!!impact?.critical});
    if(impact?.moraleDamage>0){floatingText.set(u.id+'-morale',{target:u.id,start:now,text:'−'+impact.moraleDamage+' MORALE',morale:true});if(!lethal)characterEffects.play(u.id,'moraleHit',now,850);}
    if(impact?.moraleGain>0){floatingText.set(u.id+'-morale-gain',{target:u.id,start:now,text:'+'+impact.moraleGain+' MORALE',morale:true,positive:true});characterEffects.play(u.id,'confidence',now,850);window.ExpeditionSpeech?.say(u,'positive',{checked:true});}
    if(impact?.stunApplied)floatingText.set(u.id+'-stun-applied',{target:u.id,start:now,text:'STUNNED',status:true});
    const duration=u.side==='party'?rangerHitTiming.duration*1000:650;
    if(damage>0||impact?.moraleDamage>0)reactions.set(u.id,{start:now,end:now+duration,damage});
    if(!lethal&&impact?.breakdown&&u.side==='party'){
      const start=now+duration,end=start+41/12*1000;const kind=u.moraleOutcomePending||'stress';stressReactions.set(u.id,{start,end,kind,trait:u.moraleOutcomeTrait});characterEffects.play(u.id,kind,start,end-start);busyUntil=Math.max(busyUntil,end+350);
    }
    if(lethal){deaths.set(u.id,now+150);busyUntil=Math.max(busyUntil,now+1350);}
    if(damage>0||impact?.moraleDamage>0)busyUntil=Math.max(busyUntil,now+duration);
   });
   for(const effect of turnEffects){if(effect.type==='bleed')floatingText.set(effect.target+'-bleed',{target:effect.target,start:now,text:'−'+effect.damage+' BLEED',bleed:true});if(effect.type==='stun')floatingText.set(effect.target+'-stun',{target:effect.target,start:now,text:'STUNNED',status:true});}
   pairUntil=Math.max(attackUntil,...[...reactions.values()].map(r=>r.end));
   camera.holdUntil(pairUntil);busyUntil=Math.max(busyUntil,pairUntil+450);
   render();
  },shooting?(skill==='flamer'?900:1300):skill==='blade'||skill==='maul'?420:skill==='pray'?650:200);
 }
 const root=document.createElement('section');root.className='battle-overlay';root.setAttribute('aria-label','Combat');document.querySelector('#mission').append(root);
 function chooseSkill(id){
  skills=skillsFor(battle.active);
  const active=battle.active,skill=skills.find(s=>s.id===id);
  if(!skill||performance.now()<busyUntil||battle.result||active?.side!=='party'||!skill.from.includes(active.rank))return false;
  selected=id;inspected=id;
  if(id==='step'){battle.act(id);busyUntil=performance.now()+450;onPartyChange?.(battle.units.filter(u=>u.side==='party'));onCheckpoint?.(battle.snapshot());}
  else if(id==='pray'){resolve(()=>battle.act(id),id);return true;}
  render();return true;
 }
 function onHotkey(event){
  if(closed||event.repeat||event.altKey||event.ctrlKey||event.metaKey||document.querySelector('dialog[open]'))return;
  const index=Number(event.key)-1;
  if(index<0||index>=skills.length||!Number.isInteger(index))return;
  if(chooseSkill(skills[index].id)){event.preventDefault();event.stopPropagation();}
 }
 addEventListener('keydown',onHotkey);
 function render(){
  if(closed)return;
  if(battle.result==='victory' && performance.now()>=busyUntil){
   if(victoryShown)return;
   victoryShown=true;clearTimeout(timer);hideTurnNotice();onVictory?.();
   root.querySelector('.combat-console')?.remove();
   
   const banner=document.createElement('div');banner.className='victory-banner';banner.setAttribute('role','status');
   banner.innerHTML='<img src="branding/victory.png" alt="Victory">';root.append(banner);
   timer=setTimeout(()=>{closed=true;removeEventListener('keydown',onHotkey);camera.clear();onActionFocus?.(0);root.remove();onFinish('victory');},1450);
   return;
  }
  const active=battle.active;skills=skillsFor(active?.side==='party'?active:battle.living('party')[0]);if(!skills.some(s=>s.id===selected))selected=skills[0].id;const busy=performance.now()<busyUntil;const player=!busy&&!battle.result&&active.side==='party';const skill=skills.find(s=>s.id===selected);
  const ranks=side=>(side==='party'?[4,3,2,1]:[1,2,3,4]).map(rank=>{
   const u=battle.units.find(u=>u.side===side&&u.rank===rank);
   const valid=player&&skill.from.includes(active.rank)&&battle.targets(skill).includes(u);
   return `<button class="combat-unit ${u?.id===active.id?'active':''} ${valid?'targetable':''} ${u?.hp===0?'corpse':''}" data-side="${side}" data-target="${u?.id||''}" aria-label="${u?.name||'Empty rank'}" ${valid?'':'disabled'}>${u?`<canvas class="combat-sprite" width="512" height="512" data-unit="${u.id}" aria-label="${u.name}"></canvas>${u.bleed?.turns?`<div class="bleed-status" title="Bleeding: ${u.bleed.damage} damage for ${u.bleed.turns} turns" aria-label="Bleeding"><svg viewBox="0 0 24 30" aria-hidden="true"><path d="M12 1C9 7 3 13 3 19a9 9 0 0 0 18 0C21 13 15 7 12 1Z"/></svg><b>${u.bleed.turns}</b></div>`:''}${u.stunned?.turns?`<div class="stun-status" title="Stunned: loses the next turn" aria-label="Stunned"><span>✦</span><b>${u.stunned.turns}</b></div>`:''}${side==='enemy'?`<meter class="enemy-health" aria-label="${u.name} health" min="0" max="${u.maxHp}" value="${u.hp}"></meter>`:''}`:''}</button>`;
  }).join('');
  root.innerHTML=`<header hidden class="combat-controls-proxy"><strong>THE FIRST PASSAGE · ROUND ${battle.round}</strong><div>${onFlee?`<button class="btn small" data-cmd="flee" ${busy||battle.result?'disabled':''}>Flee · −${window.EXPEDITION_DIFFICULTIES[window.Supplies.inventory.run.difficulty].retreatLoss*100}% Loot</button> `:''}<button class="btn small" data-cmd="inventory" ${player?'':'disabled'}>Inventory</button> <button class="btn small" data-cmd="options">Options</button></div></header><div class="combat-ranks"><div>${ranks('party')}</div><span class="combat-versus">⚔</span><div>${ranks('enemy')}</div></div><div class="combat-console">${battle.result&&!busy?`<p>Your expedition ends here. Return to Precipice to try again.</p><button class="btn" data-cmd="finish">Return to Precipice</button>`:window.CombatUI.dashboard(skills,selected,player,active)}<ol class="combat-log" aria-live="polite">${battle.log.slice(-4).map(l=>`<li>${l}</li>`).join('')}</ol></div>`;
  updateInfo();
  for(const action of ['flee','inventory']){const nav=document.querySelector(`.expedition-tabs [data-action="${action}"]`);if(nav)nav.disabled=action==='inventory'?!player:busy||!!battle.result;}
  if(!busy&&!battle.result)announceTurn(active);
  if(battle.result==='defeat'&&!busy){if(!defeatAnnounced){defeatAnnounced=true;hideTurnNotice();onDefeat?.();}const banner=document.createElement('div');banner.className='defeat-banner';banner.setAttribute('role','status');banner.innerHTML='<img src="branding/party-lost.png" alt="Party Lost">';root.append(banner);root.querySelector('.combat-console h2')?.remove();}
  clearTimeout(timer);
  if(busy)timer=setTimeout(render,Math.max(20,busyUntil-performance.now()+20));
  else if(!battle.result&&!player)timer=setTimeout(()=>{if(document.querySelector('.options-dialog[open],.inventory-dialog[open],.location-map-dialog[open],.character-dialog[open]')){render();return;}resolve(()=>battle.enemy());},1000);

 }
 root.addEventListener('pointerover',e=>{const slot=e.target.closest('[data-info]');if(slot){inspected=slot.dataset.info;updateInfo();}});
 root.addEventListener('focusin',e=>{const slot=e.target.closest('[data-info]');if(slot){inspected=slot.dataset.info;updateInfo();}});
 root.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  if(b.dataset.skill)chooseSkill(b.dataset.skill);
  else if(b.dataset.target){resolve(()=>battle.act(selected,b.dataset.target),selected,b.dataset.target);}
  else if(b.dataset.cmd==='flee')onFlee?.();
  else if(b.dataset.cmd==='options')onOptions();
  else if(b.dataset.cmd==='inventory')onInventory?.(()=>{onCheckpoint?.(battle.snapshot());render();});
  else if(b.dataset.cmd==='finish'){closed=true;removeEventListener('keydown',onHotkey);clearTimeout(timer);hideTurnNotice();camera.clear();onActionFocus?.(0);root.remove();onFinish(battle.result);}
  else if(['forward','back','wait'].includes(b.dataset.cmd)){
   const c=b.dataset.cmd;inspected=c;
   const action=c==='forward'?`move:${battle.active.rank-1}`:c==='back'?`move:${battle.active.rank+1}`:'wait';
   battle.act(action);if(c!=='wait')busyUntil=performance.now()+450;onPartyChange?.(battle.units.filter(u=>u.side==='party'));onCheckpoint?.(battle.snapshot());render();
  }
 });
 function drawFlamerEffect(now){
  let canvas=root.querySelector('.combat-flamer-fx');
  if(!canvas){canvas=document.createElement('canvas');canvas.className='combat-flamer-fx';canvas.setAttribute('aria-hidden','true');root.append(canvas);}
  const bounds=root.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1),width=Math.max(1,Math.round(bounds.width*dpr)),height=Math.max(1,Math.round(bounds.height*dpr));
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  const fx=canvas.getContext('2d');fx.setTransform(dpr,0,0,dpr,0,0);fx.clearRect(0,0,bounds.width,bounds.height);
  if(attackSkill!=='flamer'||!attackId||now>=attackUntil)return;
  const age=(now-attackStarted)/1000;if(age<.667||age>2.167)return;
  const sprites=[...root.querySelectorAll('.combat-sprite')],attacker=sprites.find(entry=>entry.dataset.unit===attackId),targets=attackTargetIds.map(id=>sprites.find(entry=>entry.dataset.unit===id)).filter(Boolean);if(!attacker||!targets.length)return;
  const from=attacker.getBoundingClientRect(),targetBoxes=targets.map(entry=>entry.getBoundingClientRect()),direction=targetBoxes[0].left>from.left?1:-1;
  const startX=(direction>0?from.left+from.width*.70:from.right-from.width*.70)-bounds.left,startY=from.top-bounds.top+from.height*.405;
  const farEdge=direction>0?Math.max(...targetBoxes.map(box=>box.right-bounds.left)):Math.min(...targetBoxes.map(box=>box.left-bounds.left));
  const distance=Math.abs(farEdge-startX)+Math.max(...targetBoxes.map(box=>box.width))*.18,length=Math.max(210,Math.min(bounds.width*.9,distance)),angle=direction>0?0:Math.PI;
  const rise=Math.min(1,(age-.667)/.12),fall=Math.min(1,(2.167-age)/.18),alpha=Math.max(0,Math.min(rise,fall)),pulse=.93+.07*Math.sin(age*39),seed=Math.floor(age*24);
  fx.save();fx.translate(startX,startY);fx.rotate(angle);
  const tip=length*(.97+.022*Math.sin(age*31)),half=(82+12*Math.sin(age*27))*pulse,arc=36+Math.min(26,length*.045);
  const centre=t=>-arc*Math.sin(Math.PI*t)+18*t*t;
  const widthAt=(t,scale=1)=>scale*(8+half*Math.pow(Math.sin(Math.PI*Math.min(1,t*1.04)),.72)*(1-.18*t));
  const flamePath=(scale,phase,end=1)=>{const steps=30;fx.beginPath();for(let i=0;i<=steps;i++){const t=end*i/steps,x=tip*t,w=widthAt(t,scale),rough=(Math.sin(t*47+phase)+Math.sin(t*91-phase*.7))*(2+8*t);const y=centre(t)-w+rough;if(i)fx.lineTo(x,y);else fx.moveTo(x,y);}for(let i=steps;i>=0;i--){const t=end*i/steps,x=tip*t,w=widthAt(t,scale),rough=(Math.sin(t*53-phase*.8)+Math.sin(t*103+phase))*(2+7*t);fx.lineTo(x,centre(t)+w+rough);}fx.closePath();};

  // Brown-red smoke and hot vapour keep the jet heavy and fuel-like instead of laser-clean.
  fx.globalCompositeOperation='source-over';fx.filter='blur(10px)';
  const smoke=fx.createLinearGradient(tip*.18,0,tip*1.08,0);smoke.addColorStop(0,'rgba(92,35,13,0)');smoke.addColorStop(.48,`rgba(78,35,21,${.24*alpha})`);smoke.addColorStop(1,'rgba(18,14,14,0)');fx.fillStyle=smoke;flamePath(1.22,age*18,1.06);fx.fill();
  fx.filter='blur(4px)';const outer=fx.createLinearGradient(0,0,tip,0);outer.addColorStop(0,`rgba(190,255,55,${.84*alpha})`);outer.addColorStop(.055,`rgba(255,225,78,${.94*alpha})`);outer.addColorStop(.16,`rgba(236,91,12,${.92*alpha})`);outer.addColorStop(.58,`rgba(166,35,5,${.78*alpha})`);outer.addColorStop(1,'rgba(70,13,5,0)');fx.fillStyle=outer;flamePath(1.08,age*25);fx.fill();

  fx.globalCompositeOperation='lighter';fx.filter='blur(1.5px)';const middle=fx.createLinearGradient(0,0,tip*.86,0);middle.addColorStop(0,`rgba(225,255,151,${.98*alpha})`);middle.addColorStop(.07,`rgba(255,250,178,${.98*alpha})`);middle.addColorStop(.22,`rgba(255,187,42,${.94*alpha})`);middle.addColorStop(.72,`rgba(255,77,7,${.62*alpha})`);middle.addColorStop(1,'rgba(208,28,2,0)');fx.fillStyle=middle;flamePath(.61,age*31,.88);fx.fill();
  const core=fx.createLinearGradient(-10,0,tip*.48,0);core.addColorStop(0,`rgba(239,250,255,${alpha})`);core.addColorStop(.38,`rgba(255,255,220,${alpha})`);core.addColorStop(1,'rgba(255,172,33,0)');fx.fillStyle=core;flamePath(.25,age*37,.5);fx.fill();

  fx.filter='blur(2px)';for(let i=0;i<18;i++){const t=(i*.137+age*.74)%1,x=tip*(.12+t*.92),base=centre(Math.min(1,t)),side=i%2?-1:1,y=base+side*widthAt(Math.min(1,t),.65+((i*17)%9)/18),r=3+((i*11+seed)%10);fx.fillStyle=`rgba(${190+(i%3)*25},${47+(i%4)*24},${3+(i%2)*8},${alpha*(1-t)*.58})`;fx.beginPath();fx.ellipse(x,y,r*1.9,r,.25*side,0,Math.PI*2);fx.fill();}
  fx.filter='none';for(let i=0;i<14;i++){const t=(i*.173+age*.88)%1,x=tip*(.22+t*.88),y=centre(Math.min(1,t))+Math.sin(i*7.3+age*21)*widthAt(Math.min(1,t),.9),r=1+((i*7+seed)%4);fx.fillStyle=`rgba(255,${105+(i%4)*26},18,${alpha*(1-t)*.72})`;fx.beginPath();fx.arc(x,y,r,0,Math.PI*2);fx.fill();}
  const glow=fx.createRadialGradient(0,0,3,0,0,58);glow.addColorStop(0,`rgba(245,255,215,${.82*alpha})`);glow.addColorStop(.22,`rgba(184,255,54,${.45*alpha})`);glow.addColorStop(.48,`rgba(255,143,24,${.26*alpha})`);glow.addColorStop(1,'rgba(255,46,0,0)');fx.fillStyle=glow;fx.beginPath();fx.arc(0,0,58,0,Math.PI*2);fx.fill();
  fx.restore();
 }
 function draw(now){
  if(closed)return;
  if(!battle.result&&now>=busyUntil&&!document.querySelector('dialog[open]')){
   if(window.ExpeditionSpeech.traitBark(battle.living('party'),(ally,loss,breaks,time)=>{
    characterEffects.play(ally.id,loss<0?'confidence':'moraleHit',time,850);
    floatingText.set(ally.id+'-morale',{target:ally.id,start:time,text:(loss<0?'+':'−')+Math.abs(loss)+' MORALE',morale:true});
    if(breaks){const start=Math.max(time+900,busyUntil),end=start+41/12*1000,kind=ally.moraleOutcomePending;stressReactions.set(ally.id,{start,end,kind,trait:ally.moraleOutcomeTrait,secondary:true});characterEffects.play(ally.id,kind,start,end-start);busyUntil=end+350;}
   },now)){onPartyChange?.(battle.units.filter(u=>u.side==='party'));onCheckpoint?.(battle.snapshot());render();}
  }
  const focusDt=Math.min(.05,Math.max(0,(now-previousDrawTime)/1000));previousDrawTime=now;
  const focusEntry=[...stressReactions].find(([id,s])=>now>=s.start-180&&now<s.end);
  const focusId=focusEntry?.[0]||null;
  if(focusId!==focusedId){focusedId=focusId;onStressFocus?.(focusId);}
  for(const [id,s] of stressReactions)if(now>=s.start&&now<s.end&&!s.spoken){
   s.spoken=true;const speaker=battle.units.find(u=>u.id===id);
   if(s.kind!=='confidence')onBreakdown?.(speaker);
   window.ExpeditionSpeech?.say(speaker,s.kind==='confidence'?'extremelyPositive':'extremelyNegative',{force:true,duration:s.end-now,trait:s.trait});
   if(s.trait==='panic'&&!s.secondary){
    for(const ally of battle.living('party').filter(u=>u.id!==id&&!u.moraleOutcomePending)){
     const before=ally.morale??100,breaks=morale.hurt(ally,0,false,battle.random,5),loss=before-ally.morale;
     if(loss>0){characterEffects.play(ally.id,'moraleHit',now,850);floatingText.set(ally.id+'-morale',{target:ally.id,start:now,text:(loss<0?'+':'−')+Math.abs(loss)+' MORALE',morale:true});}
     if(breaks){const start=s.end+350,end=start+41/12*1000,kind=ally.moraleOutcomePending;stressReactions.set(ally.id,{start,end,kind,trait:ally.moraleOutcomeTrait,secondary:true});characterEffects.play(ally.id,kind,start,end-start);busyUntil=Math.max(busyUntil,end+350);}
    }
    onPartyChange?.(battle.units.filter(u=>u.side==='party'));onCheckpoint?.(battle.snapshot());render();
   }
  }
  for(const [id,s] of stressReactions)if(now>=s.end&&!s.completed){s.completed=true;morale.complete(battle.units.find(u=>u.id===id));onPartyChange?.(battle.units.filter(u=>u.side==='party'));onCheckpoint?.(battle.snapshot());}
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shot=camera.sample(now,{reduced,suspended:!!focusId});onActionFocus?.(shot.amount);
  const displayUnits=battle.units.map(u=>{
   let motion=rankMotion.get(u.id);
   if(!motion){motion={rank:u.rank,from:u.rank,value:u.rank,start:now};rankMotion.set(u.id,motion);}
   if(motion.rank!==u.rank){motion.from=motion.value;motion.rank=u.rank;motion.start=now;}
   const t=reduced?1:Math.min(1,(now-motion.start)/420),ease=t*t*(3-2*t);
   motion.value=motion.from+(motion.rank-motion.from)*ease;
   return {...u,visualRank:motion.value};
  });
  root.querySelectorAll('.combat-sprite').forEach(canvas=>{
   const u=displayUnits.find(u=>u.id===canvas.dataset.unit);if(getLayout){const l=getLayout(),button=canvas.parentElement;const rawX=(u.side==='party'?l.heroX+(3-u.visualRank)*l.unit*.16:l.unit*(2.28+(u.visualRank-1)*.18))-l.camera;const zoom=l.zoom||1,bias=l.bias||0,near=(u.side==='party'?1:-1)*bias;const center=l.center??innerWidth/2;const baseX=center+(rawX-center)*zoom+bias*l.unit*.018;const baseSize=(u.side==='party'?l.size:l.size*.94)*zoom*(1+near*.045);const pose=camera.pose(u,displayUnits,l,shot,baseX,baseSize);const x=pose.x;const panelTop=root.querySelector('.combat-console')?.getBoundingClientRect().top-root.getBoundingClientRect().top;const foot=Math.min(l.footY??l.unit*846/1024,Number.isFinite(panelTop)?panelTop-30:Infinity)+near*l.unit*.009;const paired=!!shot.action&&pose.participant;const focusGoal=focusId&&!reduced?(focusId===u.id?1.22:1):1;const previousScale=focusScales.get(u.id)||1;const focusScale=Math.abs(focusGoal-previousScale)<.0001?focusGoal:previousScale+(focusGoal-previousScale)*(1-Math.exp(-focusDt*18));focusScales.set(u.id,focusScale);const size=focusScale*baseSize*pose.scale;canvas.style.filter=`blur(${pose.blur}px) brightness(${pose.brightness})`;
   button.style.zIndex=focusId===u.id?'30':paired?(u.id===attackId?'22':'21'):'';button.classList.toggle('turn-owner',!battle.result&&u.id===(now<busyUntil&&attackId?attackId:battle.active?.id));button.classList.toggle('attack-target',paired&&shot.action.targetIds.includes(u.id));button.dataset.emphasis=paired?'attack':'none';canvas.style.transition='none';Object.assign(button.style,{position:'absolute',left:(x-65)+'px',top:(foot-60)+'px',width:'130px',height:'84px','--sprite-size':size+'px'});
   Object.assign(canvas.style,{width:size+'px',height:size+'px',left:((130-size)/2)+'px',top:(60-size*468/512)+'px',bottom:'auto'});const meter=button.querySelector('meter');if(meter)meter.style.top=(48-size*468/512+size*(u.id!=='gunner'?.14:.07))+'px';}
const death=deaths.get(u.id);if(death!==undefined&&now-death>=1200){canvas.parentElement.style.visibility='hidden';return;}
const reaction=reactions.get(u.id);const hurt=reaction&&now>=reaction.start&&now<reaction.end;
   const attacking=u.id===attackId&&now<attackUntil;
   const stress=stressReactions.get(u.id),stressed=stress&&now>=stress.start&&now<stress.end;
   const sororitas=u.side==='party'&&u.classId==='sororitas';
   const kind=death!==undefined?'hit':stressed?(stress.kind||'stress'):attacking?(sororitas?(attackSkill==='maul'?'melee':attackSkill==='pray'?'pray':'attack'):u.side==='party'&&attackSkill==='blade'?'blade':'attack'):hurt?'hit':'idle';
   if(kind==='idle'&&previousPoses.get(u.id)!=='idle')idleStarts.set(u.id,now);
   previousPoses.set(u.id,kind);const image=images[u.side==='party'?(sororitas?'sororitas'+(kind==='idle'?'':'-'+kind):(kind==='idle'?'ranger':kind)):u.id];if(!image?.complete||!image.naturalWidth)return;
   const ctx=canvas.getContext('2d');ctx.clearRect(0,0,512,512);ctx.save();
   const birth=u.side==='enemy'?Math.min(1,Math.max(0,(now-appearedAt-200)/1000)):1;
   const dying=death!==undefined?Math.max(0,now-death):0;
   ctx.filter=`brightness(${death!==undefined?Math.max(0,1-dying/600):birth})`;
   canvas.parentElement.classList.toggle('dying',death!==undefined);
   ctx.globalAlpha=hurt&&now-reaction.start<450&&Math.floor((now-reaction.start)/100)%2===0?.5:u.hp>0||hurt?1:.35;
   if(death!==undefined)ctx.globalAlpha=Math.max(0,1-Math.max(0,dying-600)/600);
   canvas.dataset.pose=kind;

   if(u.side==='party'&&death===undefined)characterEffects.draw(ctx,u.id,now);
   if(u.side==='party'){const poseTime=stressed?(now-stress.start)/1000:attacking?(now-attackStarted)/1000:death!==undefined?Math.max(0,(death-(reaction?.start??death))/1000):hurt?(now-reaction.start)/1000:(now-(idleStarts.get(u.id)??now))/1000;(sororitas?window.drawSororitas:window.drawRanger)(ctx,image,kind,poseTime,0,0,512);}
   else if(u.id==='psyker'){
     const hit=death!==undefined||hurt;
     if(hit)ctx.drawImage(image,1260,0,514,887,114,8,280,475);
     else if(attacking)ctx.drawImage(image,480,0,730,887,-5,8,398,475);
     else ctx.drawImage(image,0,0,490,887,108,8,268,475);
   }
   else window.drawTyranid(ctx,image,death!==undefined||hurt?'hit':attacking,0,0,512,483);
   ctx.restore();
   if(u.side==='party'){const box=canvas.getBoundingClientRect(),base=root.getBoundingClientRect();window.ExpeditionSpeech?.position(u.id,box.left-base.left+box.width*.5,box.top-base.top+box.height*.23);}

  });
  drawFlamerEffect(now);
  for(const [id,reaction] of floatingText){
   let label=root.querySelector(`[data-damage="${id}"]`);const age=now-reaction.start;
   if(age<0||age>1100){label?.remove();continue;}
   const canvas=root.querySelector(`[data-unit="${reaction.target||id}"]`);if(!canvas)continue;
   if(!label){label=document.createElement('span');label.className='damage-number'+(reaction.missed?' missed-number':'')+(reaction.morale?' morale-number':'')+(reaction.positive?' positive-number':'')+(reaction.bleed?' bleed-number':'')+(reaction.status?' status-number':'');label.dataset.damage=id;if(reaction.missed||reaction.critical){const img=document.createElement('img');img.src='branding/'+(reaction.missed?'miss':'crit')+'.png';img.alt=reaction.missed?'MISS':'CRIT';label.append(img);}if(!reaction.missed)label.append(document.createTextNode(reaction.text));label.setAttribute('aria-label',reaction.missed?'Missed':reaction.text);root.append(label);}
   const box=canvas.getBoundingClientRect(),base=root.getBoundingClientRect();
   label.style.left=(box.left-base.left+box.width*.5)+'px';label.style.top=(box.top-base.top+box.height*.08-24-age*.045-(reaction.morale?34:0))+'px';label.style.opacity=String(Math.min(1,(1100-age)/350));
  }
  requestAnimationFrame(draw);
 }
 requestAnimationFrame(draw);
 window.ExpeditionSpeech?.say(battle.living('party')[0],'neutral');
 render();return ()=>{closed=true;removeEventListener('keydown',onHotkey);camera.clear();onActionFocus?.(0);onStressFocus?.(null);characterEffects.clear();clearTimeout(timer);hideTurnNotice();root.remove();};
};
})();
