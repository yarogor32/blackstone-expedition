/* Presentation only: never changes ranks, damage or the initiative queue. */
(()=>{
 'use strict';
 const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 class CombatCamera{
  constructor(){this.action=null;this.serial=0;}
  start(actorId,targetIds,now,end){this.action={id:++this.serial,actorId,targetIds:[...new Set(targetIds.filter(Boolean))],start:now,end};}
  holdUntil(end){if(this.action)this.action.end=Math.max(this.action.end,end);}
  sample(now,{reduced=false,suspended=false}={}){
   const a=this.action;if(!a)return {amount:0,action:null};
   const amount=ease((now-a.start)/240)*(1-ease((now-a.end)/450));
   if(now>=a.end+450){this.action=null;return {amount:0,action:null};}
   return {amount:reduced||suspended?0:amount,action:a};
  }
  pose(unit,units,layout,sample,baseX,baseSize){
   const {action:a,amount}=sample;if(!a)return {x:baseX,scale:1,blur:0,brightness:1,participant:false};
   const ids=[a.actorId,...a.targetIds],participant=ids.includes(unit.id);
   const width=layout.width||layout.center*2||innerWidth;
   const side=units.filter(u=>ids.includes(u.id)&&u.side===unit.side).sort((a,b)=>unit.side==='party'?b.rank-a.rank:a.rank-b.rank);
   const index=side.findIndex(u=>u.id===unit.id),count=side.length;
   const direction=layout.travelDirection<0?-1:1;
   const center=width*(unit.side==='party'?(direction>0?.34:.67):(direction>0?.67:.34));
   const spacing=Math.min(width*.12,baseSize*.40);
   const visualRank=unit.visualRank??unit.rank;const meanRank=count?side.reduce((n,u)=>n+(u.visualRank??u.rank),0)/count:visualRank;
   const goal=participant?center+(visualRank-meanRank)*(unit.side==='party'?-direction:direction)*spacing:baseX+(unit.side==='party'?-direction:direction)*width*.035;
   // Cap emphasis by available height/width; no accumulating scale multiplications.
   const desired=participant?(count>1?1.17:1.28):1;
   const fit=Math.max(1,Math.min(desired,layout.unit*.78/baseSize,width*.38/baseSize));
   return {x:baseX+(Math.max(baseSize*.38,Math.min(width-baseSize*.38,goal))-baseX)*amount,scale:1+(fit-1)*amount,blur:participant?0:2.4*amount,brightness:participant?1:1-.23*amount,participant};
  }
  clear(){this.action=null;}
 }
 window.CombatCamera=CombatCamera;
})();
