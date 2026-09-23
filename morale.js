(() => {
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const rules={critMultiplier:1.5,baseCrit:5,moraleDamageFactor:30,minMoraleLoss:2,critMoraleLoss:10,critRecovery:3,breakBase:.1,breakMoraleWeight:.5,breakWoundWeight:.25,breakMin:.05,breakMax:.8,breakLoss:15,treatmentCost:250};
const states={
 panic:{name:'Panicky',description:'−10 accuracy, −2 speed',accuracy:-10,speed:-2,building:'bar'},
 paranoia:{name:'Paranoid',description:'−8 accuracy, −5% critical chance',accuracy:-8,crit:-5,building:'temple'},
 despair:{name:'Despondent',description:'−20% damage',damage:.8,building:'temple'},
 tremor:{name:'Shaken',description:'−15 accuracy',accuracy:-15,building:'ship'},
 exhaustion:{name:'Exhausted',description:'−3 speed, −10% damage',speed:-3,damage:.9,building:'ship'},
 rage:{name:'Uncontrolled anger',description:'−12 accuracy, +15% incoming damage',accuracy:-12,incoming:1.15,building:'bar'}
};
function modifiers(unit){return states[unit.affliction]||{};}
function hurt(unit,damage,critical,random){
 const previousMorale=unit.morale??100;unit.morale=clamp((unit.morale??100)-Math.max(rules.minMoraleLoss,Math.ceil(damage/unit.maxHp*rules.moraleDamageFactor))-(critical?rules.critMoraleLoss:0),0,unit.maxMorale||100);
 if(unit.hp<=0)return false;
 const depleted=unit.morale===0&&(previousMorale>0||!unit.affliction);
 if(!critical&&!depleted)return false;
 const chance=clamp(rules.breakBase+rules.breakMoraleWeight*(1-unit.morale/(unit.maxMorale||100))+rules.breakWoundWeight*(1-unit.hp/unit.maxHp)-(unit.stressResistance||0),rules.breakMin,rules.breakMax);
 if(!depleted&&random()>=chance)return false;
 unit.morale=clamp(unit.morale-rules.breakLoss,0,unit.maxMorale||100);
 if(!unit.affliction){const ids=Object.keys(states);unit.affliction=ids[Math.min(ids.length-1,Math.floor(random()*ids.length))];}
 return true;
}
window.Morale={rules,states,modifiers,hurt,clamp};
})();
