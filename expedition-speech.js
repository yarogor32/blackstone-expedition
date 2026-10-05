(() => {

 const last=new Map(),timers=new Map(),spoken=new Map(),anchors=new Map();let lastAny=-Infinity;

 const rules={ordinaryChance:.22,neutralChance:.2,ordinaryCooldown:20000,criticalCooldown:7000,partyCooldown:6000,duration:3500};

 function position(id,x,y){

  anchors.set(id,{x,y});for(const fx of document.querySelectorAll('[data-morale-fx]'))if(fx.dataset.moraleFx===id){fx.style.left=x+'px';fx.style.top=y+'px';}const bubble=document.querySelector(`[data-speaker="${id}"]`);if(!bubble)return;

  const mission=bubble.parentElement,w=mission.clientWidth,h=mission.clientHeight;

  const bw=bubble.offsetWidth,bh=bubble.offsetHeight;const right=x+24+bw<w-12;

  bubble.classList.toggle('tail-right',!right);

  bubble.style.left=Math.max(12,Math.min(w-bw-12,right?x+24:x-bw-24))+'px';

  bubble.style.top=Math.max(80,Math.min(h-bh-115,y-bh-12))+'px';bubble.style.visibility='visible';

 }

 function say(hero,kind,{force=false,duration=rules.duration,trait=null,checked=false}={}){

  if(!hero||hero.hp<=0)return;const mission=document.querySelector('#mission');if(!mission)return;

  const now=performance.now(),critical=kind.startsWith('extremely');

  if(!force&&(now-lastAny<rules.partyCooldown||now-(spoken.get(hero.id)??-Infinity)<(critical?rules.criticalCooldown:rules.ordinaryCooldown)))return;

  if(!force&&!checked&&!critical&&Math.random()> (kind==='neutral'?rules.neutralChance:rules.ordinaryChance))return;

  const locale=window.EXPEDITION_LINES[document.documentElement.lang]||window.EXPEDITION_LINES.en;

  const traitLocale=window.TRAIT_LINES?.[document.documentElement.lang]||window.TRAIT_LINES?.en;

  const lines=(trait&&traitLocale?.[trait])||(locale[hero.classId||hero.id]||locale.default)[kind];if(!lines?.length)return;

  const key=hero.id+':'+(trait||kind);let n=Math.floor(Math.random()*lines.length);if(n===last.get(key))n=(n+1)%lines.length;last.set(key,n);spoken.set(hero.id,now);lastAny=now;

  mission.querySelector(`[data-speaker="${hero.id}"]`)?.remove();clearTimeout(timers.get(hero.id));

  const bubble=document.createElement('div');bubble.className='expedition-bark '+kind+' speech-'+(kind.toLowerCase().includes('negative')?'negative':kind.toLowerCase().includes('positive')?'positive':'normal');bubble.dataset.speaker=hero.id;bubble.setAttribute('role','status');bubble.setAttribute('aria-label',hero.name);bubble.style.visibility='hidden';bubble.textContent=lines[n];mission.append(bubble);

  const anchor=anchors.get(hero.id);if(anchor)position(hero.id,anchor.x,anchor.y);

  timers.set(hero.id,setTimeout(()=>bubble.remove(),duration));return true;

 }

 function impact(battle,hit){if(!hit)return;const a=battle.units.find(u=>u.id===hit.attacker),t=battle.units.find(u=>u.id===hit.target);

  if(a?.side==='party')say(a,hit.missed?'negative':hit.critical?'extremelyPositive':'positive');

  if(t?.side==='party'&&!hit.breakdown)say(t,hit.missed?'positive':hit.critical?'extremelyNegative':'negative');

 }

 let nextTraitBark=performance.now()+30000;

 function traitBark(party,onLoss,now=performance.now(),random=Math.random){

  if(now<nextTraitBark)return false;

  nextTraitBark=now+30000+random()*15000;

  const candidates=party.filter(h=>h.hp>0&&!h.moraleOutcomePending&&(window.Morale.entries(h).length||window.Morale.entries(h,true).length));

  if(!candidates.length)return false;

  const hero=candidates[Math.floor(random()*candidates.length)],negative=window.Morale.entries(hero),positiveTraits=window.Morale.entries(hero,true);
  const positive=positiveTraits.length>0&&(!negative.length||random()<.35),traits=positive?positiveTraits:negative;

  if(random()>(positive?.25:traits.length>=3?.65:traits.length===2?.35:.2))return false;

  const trait=traits[Math.floor(random()*traits.length)].id;

  if(!say(hero,positive?'positive':'negative',{trait,checked:true}))return false;

  for(const ally of party.filter(h=>h.hp>0&&h.id!==hero.id&&!h.moraleOutcomePending)){

   const before=ally.morale??100;let breaks=false;
   if(positive)ally.morale=Math.min(ally.maxMorale||100,before+3);
   else breaks=window.Morale.hurt(ally,0,false,random,traits.length>=3?5:3);
   if(ally.morale===before)continue;

   onLoss(ally,before-ally.morale,breaks,now);

  }

  return true;

 }

 function moraleEffect(hero,loss,breaks,onComplete){
  const mission=document.querySelector('#mission');if(!mission)return;
  const fx=document.createElement('div');fx.dataset.moraleFx=hero.id;
  Object.assign(fx.style,{position:'absolute',zIndex:95,pointerEvents:'none',width:'180px',height:'150px',transform:'translate(-50%,-35%)',color:'#cf91df',textAlign:'center'});
  const positive=loss<0||hero.moraleOutcomePending==='confidence';
  const img=document.createElement('img');img.src='effects/'+(positive?'confidence':'stress')+'-halo-v1.png';img.style.width='100%';fx.append(img,document.createTextNode((loss<0?'+':'−')+Math.abs(loss)+' MORALE'));mission.append(fx);
  const anchor=anchors.get(hero.id);if(anchor)position(hero.id,anchor.x,anchor.y);
  const duration=breaks?3400:850;
  fx.animate([{opacity:0,scale:.2},{opacity:1,scale:1,offset:.15},{opacity:1,scale:1.1,offset:.65},{opacity:0,scale:1}],duration);
  if(breaks)say(hero,positive?'extremelyPositive':'extremelyNegative',{force:true,trait:hero.moraleOutcomeTrait,duration});
  setTimeout(()=>{fx.remove();if(breaks)window.Morale.complete(hero);onComplete?.();},duration);
 }
 window.ExpeditionSpeech={say,impact,position,rules,traitBark,moraleEffect};

})();
