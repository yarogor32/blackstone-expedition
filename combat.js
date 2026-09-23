(() => {
'use strict';
const skills = [
 {id:'shot',name:'Rifle Shot',from:[2,3,4],to:[1,2,3,4],min:5,max:8,accuracy:90,description:'90% hit · 5–8 damage'},
 {id:'aim',name:'Aimed Shot',from:[3,4],to:[2,3,4],min:8,max:12,accuracy:80,description:'80% hit · 8–12 damage · rear targets'},
 {id:'blade',name:'Blade Strike',from:[1,2],to:[1,2],min:4,max:7,accuracy:95,description:'95% hit · 4–7 damage · front targets'},
 {id:'step',name:'Evasive Step',from:[1,2,3,4],to:[],description:'Move one rank back · evade next attack'}
];
class Battle {
 constructor(party,random=Math.random) {
  this.random=random;this.round=0;this.queue=[];this.log=[];this.result=null;
  this.units=party.slice(0,4).map((u,i)=>({hp:28,maxHp:28,speed:6,rank:i+1,side:'party',...u}));
  this.units.push({id:'raider',name:'Hormagaunt',hp:16,maxHp:16,speed:3,rank:1,side:'enemy'}, {id:'gunner',name:'Termagant',hp:14,maxHp:14,speed:4,rank:3,side:'enemy'});
  this.next();
 }
 roll(min,max){return min+Math.floor(this.random()*(max-min+1));}
 living(side){return this.units.filter(u=>u.side===side&&u.hp>0);}
 next(){
  if(!this.living('party').length)this.result='defeat';
  if(!this.living('enemy').length)this.result='victory';
  if(this.result)return;
  if(!this.queue.length){this.round++;this.queue=this.units.filter(u=>u.hp>0).map(u=>({u,initiative:u.speed+this.roll(1,8)})).sort((a,b)=>b.initiative-a.initiative).map(x=>x.u.id);}
  const nextId=this.queue.shift();
  this.active=this.units.find(u=>u.id===nextId);
  if(!this.active||this.active.hp<=0)this.next();
 }
 targets(skill){return this.units.filter(u=>u.hp>0&&u.side!==this.active.side&&skill.to.includes(u.rank));}
 move(rank){const a=this.active;if(a.side!=='party'||Math.abs(rank-a.rank)!==1||rank<1||rank>4)return false;const other=this.units.find(u=>u.hp>0&&u.side===a.side&&u.rank===rank);if(other)other.rank=a.rank;a.rank=rank;return true;}
 act(id,targetId){
  if(this.result||this.active.side!=='party')return false;
  const a=this.active;
  if(id==='wait'){this.log.push(`${a.name} holds position.`);this.next();return true;}
  if(id.startsWith('move:')){if(!this.move(Number(id.split(':')[1])))return false;this.log.push(`${a.name} changes position.`);this.next();return true;}
  const skill=skills.find(s=>s.id===id);if(!skill||!skill.from.includes(a.rank))return false;
  if(id==='step'){if(a.rank<4)this.move(a.rank+1);a.evade=true;this.log.push(`${a.name} prepares to evade.`);}
  else {const target=this.targets(skill).find(u=>u.id===targetId);if(!target)return false;this.hit(a,target,skill);}
  this.next();return true;
 }
 hit(a,t,s){
  this.lastImpact={target:t.id,missed:false};
  if(t.hp<=0){this.units=this.units.filter(u=>u!==t);this.log.push(`${a.name} clears a corpse.`);return;}
  if(t.evade){this.lastImpact.missed=true;t.evade=false;this.log.push(`${t.name} evades the attack.`);return;}
  if(this.roll(1,100)>s.accuracy){this.lastImpact.missed=true;this.log.push(`${a.name} misses ${t.name}.`);return;}
  const damage=this.roll(s.min,s.max);t.hp=Math.max(0,t.hp-damage);this.log.push(`${a.name} hits ${t.name} for ${damage}.${t.hp===0?' Fallen.':''}`);
 }
 enemy(){if(this.result||this.active.side!=='enemy')return;const a=this.active;const targets=this.living('party').sort((a,b)=>a.rank-b.rank);const target=a.id==='gunner'?targets[targets.length-1]:targets[0];this.log.push(`${a.name} uses ${a.id==='gunner'?'Fleshborer':'Scything Talons'}.`);this.hit(a,target,{min:2,max:4,accuracy:85});this.next();}
}
window.drawTyranid = (ctx,image,attack,x,y,w,h) => {
 if(attack==='hit'){ctx.drawImage(image,1565,0,607,724,x+w*.12,y,w*.77,h);return;}
 const left=attack?610:0, width=attack?960:790;
 const polygon=attack?[[610,0],[1565,0],[1565,724],[800,724],[795,520],[610,400]]:[[0,0],[570,0],[570,390],[790,535],[790,724],[0,724]];
 ctx.save();ctx.translate(x,y);ctx.scale(w/790,h/724);ctx.translate(-left,0);ctx.beginPath();polygon.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();ctx.clip();ctx.drawImage(image,0,0);ctx.restore();
};
// Timing segments refer to source-frame progress, preserving every pose in order.
const rangerHitTiming = {
 frames:125, fps:27.6, edge:0.35, middle:0.30, boost:1.5,
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
 if(kind==='attack'){const frame=Math.min(76,Math.floor(time*24));const scale=(348/350)*.98*.95*1.02*1.02*.99,side=512*scale;ctx.drawImage(image,2+frame%8*516,2+Math.floor(frame/8)*516,512,512,(512-side)/2,470-431*scale,side,side);}
 else {const hit=kind==='hit';const frame=hit?rangerHitTiming.frameAt(time):Math.floor(time*17.28)%129;
 const scale=hit?.99:348/388,side=512*scale;
 const dx=(512-side)/2,dy=hit?3+467*(1-scale):470-450*scale;
 ctx.drawImage(image,2+frame%8*516,2+Math.floor(frame/8)*516,512,512,dx,dy,side,side);}
 ctx.restore();
};
window.combatImages={};
for(const [id,path] of Object.entries({ranger:'ranger-idle',attack:'ranger-shoot',hit:'ranger-hit',raider:'hormagaunt-melee',gunner:'termagant-ranged'})){const image=new Image();image.src='sprites/'+path+'.png';window.combatImages[id]=image;}
window.BlackstoneBattle=Battle;
window.startBlackstoneBattle=({party,onFinish,onOptions,getLayout,onHit,onAttack,onDefeat,onVictory})=>{
 const battle=new Battle(party);let selected='shot',timer,closed=false,attackId=null,attackUntil=0,attackStarted=0,busyUntil=performance.now()+1200,victoryShown=false,defeatAnnounced=false;const appearedAt=performance.now();const deaths=new Map();const reactions=new Map();const floatingText=new Map();const idleStarts=new Map();const previousPoses=new Map();
 const images=window.combatImages;
 function resolve(action,skill){
  if(closed||performance.now()<busyUntil)return;
  const attacker=battle.active;
  const shooting=attacker.id==='ranger'&&['shot','aim'].includes(skill);
  const started=performance.now();
  attackId=attacker.id;attackStarted=started;
  attackUntil=started+(attacker.side==='party'?77/24*1000:700);
  busyUntil=attackUntil+100;
  if(!shooting)onAttack?.(attacker,skill);
  render();
  // Apply the actual combat action at the visible impact, not at button press.
  setTimeout(()=>{
   if(closed)return;
   const now=performance.now();
   const before=new Map(battle.units.map(u=>[u.id,u.hp]));
   battle.lastImpact=null;action();
   if(shooting&&battle.lastImpact)onAttack?.(attacker,skill);
   if(battle.lastImpact?.missed)floatingText.set(battle.lastImpact.target,{start:now,text:'Missed',missed:true});
   battle.units.forEach(u=>{
    if(u.hp>=before.get(u.id))return;
    const lethal=u.hp===0;onHit?.(u,lethal);
    const damage=before.get(u.id)-u.hp;
    floatingText.set(u.id,{start:now,text:'−'+damage,missed:false});
    const duration=u.side==='party'?rangerHitTiming.duration*1000:650;
    reactions.set(u.id,{start:now,end:now+duration,damage});
    if(lethal){deaths.set(u.id,now+150);busyUntil=Math.max(busyUntil,now+1350);}
    busyUntil=Math.max(busyUntil,now+duration);
   });
   render();
  },shooting?1300:200);
 }
 const root=document.createElement('section');root.className='battle-overlay';root.setAttribute('aria-label','Combat');document.querySelector('#mission').append(root);
 function render(){
  if(closed)return;
  if(battle.result==='victory' && performance.now()>=busyUntil){
   if(victoryShown)return;
   victoryShown=true;clearTimeout(timer);onVictory?.();
   root.querySelector('.combat-console')?.remove();
   root.querySelector('.combat-turn')?.remove();
   const banner=document.createElement('div');banner.className='victory-banner';banner.setAttribute('role','status');
   banner.innerHTML='<img src="branding/victory.png" alt="Victory">';root.append(banner);
   timer=setTimeout(()=>{closed=true;root.remove();onFinish('victory');},1450);
   return;
  }
  const active=battle.active;const busy=performance.now()<busyUntil;const player=!busy&&!battle.result&&active.side==='party';const skill=skills.find(s=>s.id===selected);
  const ranks=side=>(side==='party'?[4,3,2,1]:[1,2,3,4]).map(rank=>{const u=battle.units.find(u=>u.side===side&&u.rank===rank);const valid=player&&skill.from.includes(active.rank)&&battle.targets(skill).includes(u);return `<button class="combat-unit ${u?.id===active.id?'active':''} ${valid?'targetable':''} ${u?.hp===0?'corpse':''}" data-target="${u?.id||''}" ${valid?'':'disabled'}><small>RANK ${rank}</small>${u?`<canvas class="combat-sprite" width="512" height="512" data-unit="${u.id}" aria-label="${u.name}"></canvas><strong>${u.name}</strong><span>${u.hp===0?'Fallen':`${u.hp} / ${u.maxHp} HP`}</span><meter min="0" max="${u.maxHp}" value="${u.hp}"></meter>${u.evade?'<small>EVASION</small>':''}`:'<span class="empty-rank">Empty</span>'}</button>`}).join('');
  root.innerHTML=`<header><strong>THE FIRST PASSAGE · ROUND ${battle.round}</strong><button class="btn small" data-cmd="options">Options</button></header><p class="combat-turn">${busy?'':battle.result?(battle.result==='victory'?'Victory':'Party Lost'):`${active.name}'s turn`}</p><div class="combat-ranks"><div>${ranks('party')}</div><span class="combat-versus">⚔</span><div>${ranks('enemy')}</div></div><div class="combat-console">${battle.result&&!busy?`<h2>${battle.result==='victory'?'Victory':'Party Lost'}</h2><p>${battle.result==='victory'?'The way to the far portal is clear.':'Your expedition ends here. Return to Precipice to try again.'}</p><button class="btn" data-cmd="finish">${battle.result==='victory'?'Continue through the corridor':'Return to Precipice'}</button>`:`<p>${player?'Choose a skill, then a highlighted target.':'The enemy is acting…'}</p><div class="combat-skills">${skills.map(s=>`<button class="btn ${s.id===selected?'selected':''}" data-skill="${s.id}" ${player&&s.from.includes(active.rank)?'':'disabled'}>${s.name}<small>Use: ${s.from.join(', ')} · Targets: ${s.to.join(', ')||'Self'}<br>${s.description}</small></button>`).join('')}</div><div class="combat-moves"><button class="btn small" data-cmd="forward" ${player&&active.rank>1?'':'disabled'}>Move forward</button><button class="btn small" data-cmd="back" ${player&&active.rank<4?'':'disabled'}>Move back</button><button class="btn small skip-turn" data-cmd="wait" ${player?'':'disabled'} title="End the current character�s turn" aria-label="Skip current character turn">Skip Turn</button></div><p class="combat-queue">Next: ${battle.queue.map(id=>battle.units.find(u=>u.id===id)).filter(u=>u?.hp>0).map(u=>u.name).join(' → ')||'New round'}</p>`}<ol class="combat-log" aria-live="polite">${battle.log.slice(-4).map(l=>`<li>${l}</li>`).join('')}</ol></div>`;
  if(battle.result==='defeat'&&!busy){if(!defeatAnnounced){defeatAnnounced=true;onDefeat?.();}const banner=document.createElement('div');banner.className='defeat-banner';banner.setAttribute('role','status');banner.innerHTML='<img src="branding/party-lost.png" alt="Party Lost">';root.append(banner);root.querySelector('.combat-turn').textContent='';root.querySelector('.combat-console h2')?.remove();}
  clearTimeout(timer);
  if(busy)timer=setTimeout(render,Math.max(20,busyUntil-performance.now()+20));
  else if(!battle.result&&!player)timer=setTimeout(()=>{if(document.querySelector('.options-dialog[open]')){render();return;}resolve(()=>battle.enemy());},1000);

 }
 root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.skill){selected=b.dataset.skill;if(selected==='step')battle.act(selected);render();}else if(b.dataset.target){resolve(()=>battle.act(selected,b.dataset.target),selected);}else if(b.dataset.cmd==='options')onOptions();else if(b.dataset.cmd==='finish'){closed=true;clearTimeout(timer);root.remove();onFinish(battle.result);}else {const c=b.dataset.cmd;const action=c==='forward'?`move:${battle.active.rank-1}`:c==='back'?`move:${battle.active.rank+1}`:'wait';battle.act(action);render();}});
 function draw(now){
  if(closed)return;
  root.querySelectorAll('.combat-sprite').forEach(canvas=>{
   const u=battle.units.find(u=>u.id===canvas.dataset.unit);if(getLayout){const l=getLayout(),button=canvas.parentElement;const x=(u.side==='party'?l.heroX+(3-u.rank)*l.unit*.16:l.unit*(2.28+(u.rank-1)*.18))-l.camera;const foot=l.unit*846/1024;const size=u.side==='party'?l.size:l.size*.94;
   Object.assign(button.style,{position:'absolute',left:(x-65)+'px',top:(foot-60)+'px',width:'130px',height:'84px'});
   Object.assign(canvas.style,{width:size+'px',height:size+'px',left:((130-size)/2)+'px',top:(60-size*468/512)+'px',bottom:'auto'});}
const death=deaths.get(u.id);if(death!==undefined&&now-death>=1200){canvas.parentElement.style.visibility='hidden';return;}
const reaction=reactions.get(u.id);const hurt=reaction&&now>=reaction.start&&now<reaction.end;
   const attacking=u.id===attackId&&now<attackUntil;
   const kind=death!==undefined?'hit':attacking?'attack':hurt?'hit':'idle';
   if(kind==='idle'&&previousPoses.get(u.id)!=='idle')idleStarts.set(u.id,now);
   previousPoses.set(u.id,kind);const image=images[u.side==='party'?(kind==='idle'?'ranger':kind):u.id];if(!image?.complete||!image.naturalWidth)return;
   const ctx=canvas.getContext('2d');ctx.clearRect(0,0,512,512);ctx.save();
   const birth=u.side==='enemy'?Math.min(1,Math.max(0,(now-appearedAt-200)/1000)):1;
   const dying=death!==undefined?Math.max(0,now-death):0;
   ctx.filter=`brightness(${death!==undefined?Math.max(0,1-dying/600):birth})`;
   canvas.parentElement.classList.toggle('dying',death!==undefined);
   ctx.globalAlpha=hurt&&now-reaction.start<450&&Math.floor((now-reaction.start)/100)%2===0?.5:u.hp>0||hurt?1:.35;
   if(death!==undefined)ctx.globalAlpha=Math.max(0,1-Math.max(0,dying-600)/600);
   canvas.dataset.pose=kind;
   if(attacking){ctx.translate(256,470);ctx.scale(1.04,1.04);ctx.translate(-256,-470);}
   if(u.side==='party')window.drawRanger(ctx,image,kind,attacking?(now-attackStarted)/1000:death!==undefined?Math.max(0,(death-reaction.start)/1000):hurt?(now-reaction.start)/1000:(now-(idleStarts.get(u.id)??now))/1000,0,0,512);
   else window.drawTyranid(ctx,image,death!==undefined||hurt?'hit':attacking,0,0,512,483);
   ctx.restore();

  });
  for(const [id,reaction] of floatingText){
   let label=root.querySelector(`[data-damage="${id}"]`);const age=now-reaction.start;
   if(age<0||age>1100){label?.remove();continue;}
   const canvas=root.querySelector(`[data-unit="${id}"]`);if(!canvas)continue;
   if(!label){label=document.createElement('span');label.className='damage-number'+(reaction.missed?' missed-number':'');label.dataset.damage=id;label.textContent=reaction.text;label.setAttribute('aria-label',reaction.missed?'Missed':reaction.text+' damage');root.append(label);}
   const box=canvas.getBoundingClientRect(),base=root.getBoundingClientRect();
   label.style.left=(box.left-base.left+box.width*.5)+'px';label.style.top=(box.top-base.top+box.height*.08-24-age*.045)+'px';label.style.opacity=String(Math.min(1,(1100-age)/350));
  }
  requestAnimationFrame(draw);
 }
 requestAnimationFrame(draw);
 render();return ()=>{closed=true;clearTimeout(timer);root.remove();};
};
})();
