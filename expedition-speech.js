(() => {
 const last=new Map(),timers=new Map(),spoken=new Map(),anchors=new Map();let lastAny=-Infinity;
 const rules={ordinaryChance:.22,neutralChance:.2,ordinaryCooldown:20000,criticalCooldown:7000,partyCooldown:6000,duration:3500};
 function position(id,x,y){
  anchors.set(id,{x,y});const bubble=document.querySelector(`[data-speaker="${id}"]`);if(!bubble)return;
  const mission=bubble.parentElement,w=mission.clientWidth,h=mission.clientHeight;
  const bw=bubble.offsetWidth,bh=bubble.offsetHeight;const right=x+24+bw<w-12;
  bubble.classList.toggle('tail-right',!right);
  bubble.style.left=Math.max(12,Math.min(w-bw-12,right?x+24:x-bw-24))+'px';
  bubble.style.top=Math.max(80,Math.min(h-bh-115,y-bh-12))+'px';bubble.style.visibility='visible';
 }
 function say(hero,kind,{force=false,duration=rules.duration}={}){
  if(!hero||hero.hp<=0)return;const mission=document.querySelector('#mission');if(!mission)return;
  const now=performance.now(),critical=kind.startsWith('extremely');
  if(!force&&(now-lastAny<rules.partyCooldown||now-(spoken.get(hero.id)??-Infinity)<(critical?rules.criticalCooldown:rules.ordinaryCooldown)))return;
  if(!force&&!critical&&Math.random()> (kind==='neutral'?rules.neutralChance:rules.ordinaryChance))return;
  const locale=window.EXPEDITION_LINES[document.documentElement.lang]||window.EXPEDITION_LINES.en;
  const lines=(locale[hero.classId||hero.id]||locale.default)[kind];if(!lines?.length)return;
  const key=hero.id+':'+kind;let n=Math.floor(Math.random()*lines.length);if(n===last.get(key))n=(n+1)%lines.length;last.set(key,n);spoken.set(hero.id,now);lastAny=now;
  mission.querySelector(`[data-speaker="${hero.id}"]`)?.remove();clearTimeout(timers.get(hero.id));
  const bubble=document.createElement('div');bubble.className='expedition-bark '+kind;bubble.dataset.speaker=hero.id;bubble.setAttribute('role','status');bubble.setAttribute('aria-label',hero.name);bubble.style.visibility='hidden';bubble.textContent=lines[n];mission.append(bubble);
  const anchor=anchors.get(hero.id);if(anchor)position(hero.id,anchor.x,anchor.y);
  timers.set(hero.id,setTimeout(()=>bubble.remove(),duration));
 }
 function impact(battle,hit){if(!hit)return;const a=battle.units.find(u=>u.id===hit.attacker),t=battle.units.find(u=>u.id===hit.target);
  if(a?.side==='party')say(a,hit.missed?'negative':hit.critical?'extremelyPositive':'positive');
  if(t?.side==='party'&&!hit.breakdown)say(t,hit.missed?'positive':hit.critical?'extremelyNegative':'negative');
 }
 window.ExpeditionSpeech={say,impact,position,rules};
})();
