(() => {
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const rules={critMultiplier:1.5,baseCrit:5,moraleDamageFactor:30,minMoraleLoss:2,critMoraleLoss:10,critRecovery:3,breakBase:.1,breakMoraleWeight:.5,breakWoundWeight:.25,breakMin:.05,breakMax:.8,breakLoss:15,treatmentCost:250};
const states={
 panic:{name:'Panicky',description:'−10 accuracy, −2 speed',accuracy:-10,speed:-2,building:'bar'},
 paranoia:{name:'Paranoid',description:'−8 accuracy, −5% critical chance',accuracy:-8,crit:-5,building:'temple'},
 despair:{name:'Despondent',description:'−20% damage',damage:.8,building:'temple'},
 tremor:{name:'Shaken',description:'−15 accuracy',accuracy:-15,building:'ship'},
 exhaustion:{name:'Exhausted',description:'−3 speed, −10% damage',speed:-3,damage:.9,building:'ship'},
 bloodthirsty:{name:'Bloodthirsty',description:'+15% damage, −10 accuracy',damage:1.15,accuracy:-10,building:'bar'},
 rage:{name:'Uncontrolled anger',description:'−12 accuracy, +15% incoming damage',accuracy:-12,incoming:1.15,building:'bar'}
};
const positiveStates={
 resolute:{name:'Resolute',description:'+10 accuracy',accuracy:10},
 courageous:{name:'Courageous',description:'+2 speed',speed:2},
 focused:{name:'Focused',description:'+5% critical chance',crit:5},
 inspired:{name:'Inspired',description:'+15% damage',damage:1.15},
 steadfast:{name:'Steadfast',description:'−10% incoming damage',incoming:.9}
};
function normalize(unit){unit.afflictions??=unit.affliction?[unit.affliction]:[];unit.positiveTraits??=[];unit.afflictions=[...new Set(unit.afflictions)];unit.positiveTraits=[...new Map(unit.positiveTraits.map(v=>[typeof v==='string'?v:v.id||v.name,v])).values()];unit.affliction=unit.afflictions[0]||null;return unit;}
function entries(unit,positive=false){normalize(unit);const defs=positive?positiveStates:states,counts={};for(const value of positive?unit.positiveTraits:unit.afflictions){const id=typeof value==='string'?value:value.id;if(defs[id])counts[id]=(counts[id]||0)+1;}return Object.entries(counts).map(([id,count])=>({id,count,...defs[id]}));}
function modifiers(unit){normalize(unit);const result={damage:1,incoming:1};for(const e of [...entries(unit),...entries(unit,true)]){for(const k of ['accuracy','speed','crit'])result[k]=(result[k]||0)+(e[k]||0)*e.count;for(const k of ['damage','incoming'])result[k]*=(e[k]??1)**e.count;}return result;}
function complete(unit){if(!unit.moraleOutcomePending)return;unit.morale=unit.maxMorale||100;delete unit.moraleOutcomePending;delete unit.moraleOutcomeTrait;}
function hurt(unit,damage,critical,random,directLoss=null){
 normalize(unit);if(unit.moraleOutcomePending)return false;
 const previousMorale=unit.morale??100;unit.morale=clamp((unit.morale??100)-(directLoss??Math.max(rules.minMoraleLoss,Math.ceil(damage/unit.maxHp*rules.moraleDamageFactor)))-(critical?rules.critMoraleLoss:0),0,unit.maxMorale||100);
 if(unit.hp<=0)return false;
 const depleted=unit.morale===0&&(previousMorale>0||!unit.affliction);
 if(!critical&&!depleted)return false;
 const chance=clamp(rules.breakBase+rules.breakMoraleWeight*(1-unit.morale/(unit.maxMorale||100))+rules.breakWoundWeight*(1-unit.hp/unit.maxHp)-(unit.stressResistance||0),rules.breakMin,rules.breakMax);
 if(!depleted&&random()>=chance)return false;
 unit.morale=clamp(unit.morale-rules.breakLoss,0,unit.maxMorale||100);
 const positive=random()>=.8,defs=positive?positiveStates:states,owned=positive?unit.positiveTraits:unit.afflictions,ids=Object.keys(defs).filter(id=>!owned.includes(id));const id=ids[Math.min(ids.length-1,Math.floor(random()*ids.length))];
 if(id)owned.push(id);unit.moraleOutcomeTrait=id||null;unit.affliction=unit.afflictions[0]||null;unit.moraleOutcomePending=positive?'confidence':'stress';
 return true;
}
window.Morale={rules,states,positiveStates,normalize,entries,complete,modifiers,hurt,clamp};
})();
