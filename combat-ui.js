(() => {
  const icons=['shot','aim','blade','step','forward','back','wait','exit','bag','gear','map','energy','food','cell','coins','cargo'];
  const moves={
    forward:{name:'Move Forward',description:'Move one rank toward the enemy. Swap places with an ally if the destination is occupied. Ends this character’s turn.'},
    back:{name:'Move Back',description:'Move one rank away from the enemy. Swap places with an ally if the destination is occupied. Ends this character’s turn.'},
    wait:{name:'Skip Turn',description:'Hold position and end this character’s turn without attacking.'}
  };
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sororitasIcons={flamer:[0,0],maul:[1,0],pray:[0,1],step:[1,1]};
  function icon(id,label=''){
    if(id==='room-exit')return `<svg class="hud-line-icon" viewBox="0 0 40 40" aria-hidden="true"><path d="M8 34V7h18v27M13 34V12h9v22M25 20h10m-5-5 5 5-5 5"/></svg>`;
    if(id==='camp')return `<svg class="hud-line-icon" viewBox="0 0 40 40" aria-hidden="true"><path d="M7 31 20 8l13 23M12 31h16M10 26h20M20 8v23M29 8c4 2 5 5 3 9-4-1-6-4-3-9Z"/></svg>`;
    if(id==='portal')return `<svg class="hud-line-icon portal-glyph" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 34 20 20 37 6 20 20 3Zm0 8-7 9 7 9 7-9-7-9Z"/><circle cx="20" cy="20" r="4"/></svg>`;
    const sister=id==='step'&&label!=='Guarded Advance'?null:sororitasIcons[id];
    if(sister)return `<span class="sororitas-skill-icon" aria-hidden="true" style="background-position:${sister[0]*100}% ${sister[1]*100}%"></span>`;
    const i=Math.max(0,icons.indexOf(id));return `<span class="drawn-icon" aria-hidden="true" style="background-position:${(i%4)*100/3}% ${Math.floor(i/4)*100/3}%"></span>`;
  }
  function action(id,label,enabled,selected,skill=false,hotkey=''){const accessibleLabel=hotkey?`${label} — key ${hotkey}`:label;return `<span class="combat-action-slot" data-info="${id}" ${enabled?'':`tabindex="0" aria-label="${escape(accessibleLabel)} — unavailable"`}><button class="combat-action ${selected?'selected':''}" ${skill?'data-skill':'data-cmd'}="${id}" aria-label="${escape(accessibleLabel)}" aria-describedby="combatInfo" ${enabled?'':'disabled'} ${skill?`aria-pressed="${selected}"`:''}>${icon(id,label)}${hotkey?`<kbd class="combat-hotkey" aria-hidden="true">${hotkey}</kbd>`:''}</button></span>`;}
  function dashboard(skills,selected,player,active){return `<div class="combat-dashboard"><div class="combat-abilities" role="group" aria-label="Combat abilities">${skills.map((s,i)=>action(s.id,s.name,player&&s.from.includes(active.rank),s.id===selected,true,String(i+1))).join('')}</div><span class="combat-dashboard-divider" aria-hidden="true"></span><div class="combat-utilities" role="group" aria-label="Movement and turn actions">${action('forward','Move Forward',player&&active.rank>1,false)}${action('back','Move Back',player&&active.rank<4,false)}${action('wait','Skip Turn',player,false)}</div></div><aside class="combat-info" id="combatInfo" aria-label="Ability information"><div class="combat-info-label">INFO</div><div data-info-content></div></aside>`;}
  function ranks(values){return [1,2,3,4].map(rank=>`<span class="info-rank ${values.includes(rank)?'allowed':''}">${rank}</span>`).join('');}
  function info(id,skills,active,player){const s=skills.find(s=>s.id===id)||moves[id]||skills[0];let reason='';
    if(!player)reason='Actions are temporarily unavailable.';
    else if(s.from&&!s.from.includes(active.rank))reason=`Unavailable from rank ${active.rank}.`;
    else if(id==='forward'&&active.rank===1)reason='Already in the front rank.';
    else if(id==='back'&&active.rank===4)reason='Already in the rear rank.';
    const mod=window.Morale?.modifiers(active)||{};const stats=s.accuracy?`<small>Current: ${Math.max(5,Math.min(100,s.accuracy+(mod.accuracy||0)))}% hit · ${Math.max(0,Math.min(100,(s.crit||5)+(active.critBonus||0)+(mod.crit||0)))}% CRIT${active.affliction?' · '+escape(window.Morale.states[active.affliction].name):''}</small>`:'';
    return `<h3>${escape(s.name)}</h3>${stats}<p>${escape(s.description)}</p>${s.from?`<div class="info-ranks"><span>USE FROM ${ranks(s.from)}</span><span>TARGET ${s.to.length?ranks(s.to):s.support?'<b>ALLIES</b>':'<b>SELF</b>'}</span></div>`:''}<small class="${reason?'info-unavailable':''}">${escape(reason||(s.to?.length?'Select this ability, then choose an enemy.':s.support?'Activates immediately. Xenos allies are unaffected.':'Activate this icon to use the action.'))}</small>`;
  }
  window.CombatUI={dashboard,info,icon};
})();
