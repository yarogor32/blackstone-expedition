(() => {
  'use strict';
  // Temporary preview pacing. Mission counts will be balanced separately.
  const DATA_PER_MISSION = 35;
  const sectors = [
    {name:'Outer structures',c:[820,450],r:310,p:[600,540],a:60},
    {name:'Inner passages',c:[860,415],r:245,p:[735,445],a:50},
    {name:'Command network',c:[820,450],r:170,p:[850,420],a:40},
    {name:'Suspected control sector',c:[830,440],r:105,p:[812,445],a:34}
  ];
  const discoveryLine = "Oh! Would you look at that. You found it! Let me know when you're ready to head out. Prepare properly, though — this may be a one-way trip.";
  const explanation = "The red circle is where we think the signal is coming from. We search the blue area for clues to where we should look next. Bring back enough data, and we can narrow the search. The fortress keeps shifting, so this is an estimate, not a floor plan.";
  function ensure(state) {
    const p = state.fortressProgress ||= {version:1,sector:0,data:0,completedMissions:0,centerFound:false,centerNoticePending:false,briefed:false};
    p.sector = Math.max(0,Math.min(3,Math.floor(Number(p.sector)||0)));
    p.data = Math.max(0,Math.min(100,Number(p.data)||0));
    return p;
  }
  function complete(state,run,{defeated=false,fled=false}={}) {
    const p=ensure(state);
    if(!run?.completed||defeated||fled)return {advanced:false,centerDiscovered:false};
    if(run.campaignTarget?.kind==='control-center') {p.centerReached=true;return {advanced:false,centerDiscovered:false,centerReached:true};}
    if(p.centerFound)return {advanced:false,centerDiscovered:false};
    p.completedMissions=(p.completedMissions||0)+1;
    p.data=Math.min(100,p.data+DATA_PER_MISSION);
    let centerDiscovered=false;
    if(p.data===100) {
      if(p.sector===3){p.centerFound=true;p.centerNoticePending=true;p.controlRouteSeed=(run.raidLayout?.seed||'fortress')+':command';centerDiscovered=true;}
      else {p.sector++;p.data=0;}
    }
    return {advanced:true,centerDiscovered,sector:p.sector,data:p.data};
  }
  function target(state) {const p=ensure(state);return p.centerFound?{kind:'control-center',position:[830,440]}:{kind:'search-sector',sector:p.sector};}
  function ring(center,radius,asset,cls='') {const size=radius*2/.88;return `<g transform="translate(${center[0]} ${center[1]}) matrix(1 -.014 -.035 .93 0 0)"><image class="${cls}" href="backgrounds/${asset}" x="${-size/2}" y="${-size/2}" width="${size}" height="${size}"/></g>`;}
  function marks(p,layer,difficulty=false) {
    const s=sectors[p.sector];let html='';
    for(let i=0;i<p.sector;i++)html+=ring(sectors[i].p,sectors[i].a,'sector-blue-pencil-v2.png','surveyed');
    if(!p.centerFound)html+=ring(s.c,s.r,'search-red-chalk-v2.png')+ring(s.p,s.a,'sector-blue-pencil-v2.png');
    else html+='<g fill="none" stroke="#ae2928" stroke-linecap="round" transform="translate(830 440) matrix(1 -.014 -.035 .93 0 0)"><path d="M-19 -23 Q-8 -10 2 1 T23 21 M-22 22 Q-10 10 1 -2 T20 -24" stroke-width="8"/></g>';
    if(layer==='ink')return html;
    html='';
    const x=s.p[0]+s.a+(p.centerFound?45:-24),y=s.p[1]-62;
    html+=`<g transform="translate(${x} ${y}) rotate(-4) skewX(-2) scale(1 .93)"><image href="backgrounds/sector-progress-note-v2.png" width="260" height="173"/><text x="${difficulty?95:78}" y="${difficulty?66:88}" fill="#354d69" font-family="Segoe Print,cursive" font-size="${difficulty?18:20}">Cleared <tspan fill="#294869" font-weight="bold">${p.centerFound?100:p.data}%</tspan></text></g>`;
    return html;
  }
  function difficultyNote(state,p){
    const s=sectors[p.sector],x=s.p[0]+s.a+(p.centerFound?45:-24),y=s.p[1]-62;
    return `<section class="chart-difficulty-note" aria-label="Expedition difficulty" style="left:${x/16}%;top:${y/9}%;width:16.25%;aspect-ratio:260/173"><div class="chart-difficulty-choices">${['easy','normal','hard'].map(id=>`<button type="button" data-action="chart-difficulty-${id}" class="difficulty-choice ${id}" aria-pressed="${state.difficulty===id}" aria-label="${id[0].toUpperCase()+id.slice(1)} difficulty"><img class="difficulty-seal" src="ui/purity-seal-${id}-v1.png" alt=""><span>${id[0].toUpperCase()+id.slice(1)}</span></button>`).join('')}</div></section>`;
  }
  function renderMap(state,{difficulty=false}={}) {
    const p=ensure(state);
    return `<div class="fortress-chart"><img src="backgrounds/blackstone-progression-map-tools-v3.png" alt="The foreman's pencil chart of the Blackstone Fortress"><svg class="chart-ink" viewBox="0 0 1600 900" role="img" aria-label="${p.centerFound?'Control centre located':sectors[p.sector].name+', '+p.data+' percent cleared'}">${marks(p,'ink')}</svg><svg class="chart-notes" viewBox="0 0 1600 900" aria-hidden="true">${marks(p,'notes',difficulty)}</svg>${difficulty?difficultyNote(state,p):''}</div>`;
  }
  window.FortressCampaign={ensure,complete,target,renderMap,sectors,discoveryLine,explanation,DATA_PER_MISSION};
})();
