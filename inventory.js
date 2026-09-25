(() => {
  'use strict';
  const ITEMS=window.EXPEDITION_ITEMS, KEY='blackstone-expedition-inventory-v1';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const validQty=value=>Number.isInteger(value)&&value>0;
  class Inventory {
    constructor(storage) {
      this.storage=storage;this.saveFailed=false;
      this.state={version:1,credits:6000,slots:Array(16).fill(null),run:null,foodDebt:{},difficulty:'normal'};
      try {
        const data=JSON.parse(storage?.getItem(KEY)||'null');
        if(data?.version===1&&Number.isSafeInteger(data.credits)&&data.credits>=0&&Array.isArray(data.slots)&&data.slots.length===16&&data.slots.every(s=>s===null||(ITEMS[s.id]&&validQty(s.qty)&&s.qty<=ITEMS[s.id].stack)))this.state=data;
      } catch (_) { /* A damaged or unavailable save does not block a new session. */ }
      if(!window.EXPEDITION_DIFFICULTIES[this.state.difficulty])this.state.difficulty='normal';
      if(this.run&&!window.EXPEDITION_DIFFICULTIES[this.run.difficulty])this.run.difficulty=this.state.difficulty;
      this.state.heroProfiles=this.state.heroProfiles||{};
      this.state.restSlots ||= {bar:[],temple:[],ship:[]};
      this.state.buildingLevels ||= {};
      for(const hero of this.run?.party||[]){hero.level??=1;hero.morale??=100;hero.maxMorale??=100;}
    }
    save(){try{this.storage?.setItem(KEY,JSON.stringify(this.state));}catch(_){this.saveFailed=true;}}
    get slots(){return this.state.slots;}
    get run(){return this.state.run;}
    count(id){return this.slots.reduce((n,s)=>n+(s?.id===id?s.qty:0),0);}
    capacity(id){return this.slots.reduce((n,s)=>n+(!s?ITEMS[id].stack:s.id===id?ITEMS[id].stack-s.qty:0),0);}
    add(id,qty){
      if(!ITEMS[id]||!validQty(qty))return 0;
      let left=qty;
      for(const s of this.slots)if(s?.id===id){const n=Math.min(left,ITEMS[id].stack-s.qty);s.qty+=n;left-=n;}
      for(let i=0;i<16&&left;i++)if(!this.slots[i]){const n=Math.min(left,ITEMS[id].stack);this.slots[i]={id,qty:n};left-=n;}
      this.save();return qty-left;
    }
    remove(id,qty){
      if(!validQty(qty)||this.count(id)<qty)return false;
      for(let i=15;i>=0&&qty;i--){const s=this.slots[i];if(s?.id!==id)continue;const n=Math.min(qty,s.qty);s.qty-=n;qty-=n;if(!s.qty)this.slots[i]=null;}
      this.save();return true;
    }
    buy(id,qty=1){
      const item=ITEMS[id];if(this.run||!item?.price||!validQty(qty))return 'noEffect';
      if(this.state.credits<item.price*qty)return 'poor';
      if(this.capacity(id)<qty)return 'full';
      this.state.credits-=item.price*qty;this.add(id,qty);return null;
    }
    trade(buy={},sell={}){
      if(this.run)return 'noEffect';
      const draft=new Inventory(null);draft.state=clone(this.state);
      let cost=0,earned=0;
      for(const [id,qty] of Object.entries(sell)){
        if(!ITEMS[id]||!validQty(qty)||draft.count(id)<qty)return 'noEffect';
        earned+=ITEMS[id].sell*qty;draft.remove(id,qty);
      }
      for(const [id,qty] of Object.entries(buy)){
        if(!ITEMS[id]?.price||!validQty(qty))return 'noEffect';
        cost+=ITEMS[id].price*qty;
        if(draft.capacity(id)<qty)return 'full';draft.add(id,qty);
      }
      if(cost>this.state.credits+earned)return 'poor';
      draft.state.credits=this.state.credits+earned-cost;
      this.state=draft.state;this.save();return null;
    }
    drop(index){if(!Number.isInteger(index)||!this.slots[index])return false;this.slots[index]=null;this.save();return true;}
    refund(index){const s=this.slots[index];if(this.run||!s||!ITEMS[s.id].price)return false;this.state.credits+=s.qty*ITEMS[s.id].price;return this.drop(index);}
    move(from,to){
      if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=16||to>=16||from===to)return;
      const a=this.slots[from],b=this.slots[to];if(!a)return;
      if(b?.id===a.id){const n=Math.min(a.qty,ITEMS[a.id].stack-b.qty);b.qty+=n;a.qty-=n;if(!a.qty)this.slots[from]=null;}
      else [this.slots[from],this.slots[to]]=[b,a];this.save();
    }
    split(index){const s=this.slots[index],empty=this.slots.indexOf(null);if(!s||s.qty<2||empty<0)return false;const n=Math.floor(s.qty/2);s.qty-=n;this.slots[empty]={id:s.id,qty:n};this.save();return true;}
    restPlaces(hero){return hero.restPlaces || ({ranger:['ship'],'space-marine':['temple','ship'],drukhari:['bar','ship'],human:['bar','temple','ship'],'rogue-trader':['bar','temple','ship'],kroot:['bar','ship'],mechanicus:['temple','ship']}[hero.classId||hero.id] || ['ship']);}
    resting(id){return Object.values(this.state.restSlots).some(slots=>slots.some(s=>s?.id===id));}
    assignRest(place,index,hero){
      const level=this.state.buildingLevels[place]||1;
      if(this.run||!this.state.restSlots[place]||!Number.isInteger(index)||index<0||index>=level||!this.restPlaces(hero).includes(place)||this.resting(hero.id)||this.state.restSlots[place][index])return false;
      const cost=window.Morale.rules.treatmentCost;
      if(this.state.credits<cost)return false;
      this.state.credits-=cost;this.state.restSlots[place][index]={id:hero.id,cost};this.save();return true;
    }
    cancelRest(place,index){
      const slot=this.state.restSlots[place]?.[index];if(this.run||!slot)return false;
      this.state.credits+=slot.cost;this.state.restSlots[place][index]=null;this.save();return true;
    }
    completeRest(){
      for(const slots of Object.values(this.state.restSlots))for(let i=0;i<slots.length;i++)if(slots[i]){
        const profile=this.state.heroProfiles[slots[i].id] ||= {level:1,maxMorale:100};
        profile.morale=profile.maxMorale||100;profile.affliction=null;slots[i]=null;
      }
    }
    begin(party){
      if(this.run)return this.run;
      party=party.filter(hero=>!this.resting(hero.id));if(!party.length)return null;
      this.state.run={party:party.slice(0,4).map(u=>({maxHp:28,hp:28,food:1,energy:0,level:1,morale:100,maxMorale:100,foodDebt:this.state.foodDebt?.[u.id]||0,...this.state.heroProfiles[u.id],...clone(u)})),energy:100,progress:.48,visited:0,encounterDone:false,events:{},pendingLoot:[],defeated:false};
      this.run.difficulty=this.state.difficulty;
      this.save();return this.run;
    }
    recordDeaths(party){
      this.state.fallen ||= [];this.state.foodDebt ||= {};
      const dead=party.filter(h=>h.hp<=0),ids=new Set(dead.map(h=>h.id));
      for(const hero of dead){
        if(!this.state.fallen.some(h=>h.id===hero.id))this.state.fallen.push({id:hero.id,name:hero.name||hero.id,level:hero.level||1,diedAt:Date.now()});
        delete this.state.heroProfiles[hero.id];delete this.state.foodDebt[hero.id];
      }
      if(this.state.roster)this.state.roster=this.state.roster.filter(h=>!ids.has(h.id));
      for(const slots of Object.values(this.state.restSlots))for(let i=0;i<slots.length;i++)if(ids.has(slots[i]?.id))slots[i]=null;
      return dead.map(h=>({id:h.id,name:h.name||h.id}));
    }
    finish(defeated=false,{fled=false}={}){
      if(!this.run)return null;
      const cargo=this.slots.filter(Boolean).map(s=>({...s,value:s.qty*ITEMS[s.id].sell}));
      const difficulty=this.run.difficulty;
      const lossRate=fled&&!defeated?window.EXPEDITION_DIFFICULTIES[difficulty].retreatLoss:0;
      const gross=cargo.reduce((n,s)=>n+s.value,0);
      const lootValue=cargo.filter(s=>ITEMS[s.id].kind==='loot').reduce((n,s)=>n+s.value,0);
      const penalty=Math.ceil(lootValue*lossRate);
      const earned=defeated?0:gross-penalty;
      const fallen=this.recordDeaths(this.run.party);
      this.state.foodDebt=Object.fromEntries(this.run.party.filter(h=>h.hp>0).map(u=>[u.id,u.foodDebt||0]));
      for(const hero of this.run.party.filter(h=>h.hp>0))this.state.heroProfiles[hero.id]={level:hero.level,morale:hero.morale,maxMorale:hero.maxMorale,affliction:hero.affliction||null};
      this.completeRest();this.state.credits+=earned;this.state.run=null;this.state.slots=Array(16).fill(null);this.save();
      return {fallen,defeated,fled:fled&&!defeated,difficulty,lossRate,penalty,gross,lootValue,cargo,earned,balance:this.state.credits};
    }
    use(id,heroId,{combat=false}={}){
      if(!this.run||!this.count(id))return 'noEffect';
      const hero=this.run.party.find(u=>u.id===heroId&&u.hp>0);
      if(id==='cell'){if(this.run.energy>=100)return 'noEffect';this.run.energy=Math.min(100,this.run.energy+25);}
      else if(id==='ration'){
        if(combat)return 'combatFood';
        if(!hero||!(hero.food>0)||hero.hp>=hero.maxHp)return 'noEffect';
        hero.hp=Math.min(hero.maxHp,hero.hp+Math.max(1,Math.ceil(hero.maxHp*.1)));
      }else if(id==='bandage'&&hero?.bleed){hero.bleed=0;}
      else if(id==='antidote'&&hero?.poison){hero.poison=0;}
      else return 'noEffect';
      this.remove(id,1);return null;
    }
    queueLoot(items){this.run.pendingLoot.push(...clone(items));this.save();}
    take(index){const s=this.run?.pendingLoot[index];if(!s)return;const n=this.add(s.id,s.qty);s.qty-=n;this.run.pendingLoot=this.run.pendingLoot.filter(s=>s.qty>0);this.save();return n;}
    foodDemand(){return this.run.party.filter(u=>u.hp>0&&u.food>0).reduce((n,u)=>n+Math.floor((u.foodDebt||0)+u.food),0);}
    feed(eat){
      const required=this.foodDemand();if(eat&&this.count('ration')<required)return false;
      if(eat&&required)this.remove('ration',required);
      for(const u of this.run.party.filter(u=>u.hp>0&&u.food>0)){
        u.foodDebt=(u.foodDebt||0)+u.food;const portions=Math.floor(u.foodDebt);u.foodDebt-=portions;
        if(portions)u.hp=eat?Math.min(u.maxHp,u.hp+Math.ceil(u.maxHp*.05)):Math.max(1,u.hp-Math.ceil(u.maxHp*.2));
      }
      this.save();return true;
    }
  }
  window.ExpeditionInventory=Inventory;
})();

