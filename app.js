(() => {
  'use strict';

  const app = document.querySelector('#app');
  const audio = document.querySelector('#music');
  const supplies = window.Supplies;
  const inventory = supplies.inventory;
  const ROSTER_LIMIT = 50;
  const expeditionCrew = [];
  function syncCrew(){
    inventory.state.roster ||= [{id:'ranger',name:'Aeldari Ranger',classId:'ranger',species:'aeldari',xenos:true,rank:3,...window.EXPEDITION_METABOLISM.ranger}];
    inventory.state.roster.forEach(hero=>{if((hero.classId||'ranger')==='ranger'){hero.species||='aeldari';hero.xenos=true;}else if(hero.classId==='sororitas'){hero.species||='human';hero.xenos=false;}});
    expeditionCrew.splice(0,expeditionCrew.length,...inventory.state.roster);
    const rosterIds=new Set(expeditionCrew.map(hero=>hero.id));
    if(!Array.isArray(inventory.state.expeditionPartyIds))inventory.state.expeditionPartyIds=expeditionCrew.filter(hero=>!inventory.resting(hero.id)).slice(0,4).map(hero=>hero.id);
    else inventory.state.expeditionPartyIds=inventory.state.expeditionPartyIds.filter((id,index,ids)=>rosterIds.has(id)&&ids.indexOf(id)===index).slice(0,4);
  }
  syncCrew();
  function selectedExpeditionCrew(){
    const ids=(inventory.state.expeditionPartyIds||[]).filter(id=>expeditionCrew.some(hero=>hero.id===id&&!inventory.resting(id))).slice(0,4);
    if(ids.length!==(inventory.state.expeditionPartyIds||[]).length){inventory.state.expeditionPartyIds=ids;inventory.save();}
    return ids.map(id=>expeditionCrew.find(hero=>hero.id===id)).filter(hero=>hero&&!inventory.resting(hero.id)).slice(0,4).map((hero,index)=>({...hero,rank:4-index}));
  }
  function toggleExpeditionHero(id,remove=false){
    const hero=expeditionCrew.find(entry=>entry.id===id);if(!hero||inventory.resting(id))return;
    const ids=inventory.state.expeditionPartyIds||[];const index=ids.indexOf(id);
    if(index>=0)ids.splice(index,1);else if(!remove&&ids.length<4)ids.push(id);
    inventory.state.expeditionPartyIds=ids;inventory.save();refreshDockParty();
  }
  function recruitHero(){
    if(inventory.run||expeditionCrew.length>=ROSTER_LIMIT||(inventory.state.recruitStock??3)<=0)return;
    const candidate=availableRecruits()[selectedHero]||availableRecruits()[0];if(!candidate)return;
    inventory.state.recruitStock=(inventory.state.recruitStock??3)-1;
    const classId=candidate.classId;let number=1;const occupied=[...expeditionCrew,...(inventory.state.fallen||[])];while(occupied.some(h=>h.id===(number===1?classId:classId+'-'+number)))number++;const id=number===1?classId:classId+'-'+number;
    inventory.state.roster.push({id,classId,name:number===1?candidate.name:candidate.name+' '+number,species:candidate.species,xenos:!!candidate.xenos,...window.EXPEDITION_METABOLISM[classId]});
    selectedHero=0;
    syncCrew();inventory.save();renderHire('hired');
  }
  let expeditionReport = null;
  let mapOpen = false;
  const names = {ship:'Rogue Trader Yacht', docks:'Docks', bar:'Tavern', market:'Market', temple:'Shrine', workshop:'Workshops'};
  const places = {
    ship:['The crew refuge and expedition planning room.', 'Plan Expedition', 'Crew Rest'],
    docks:['Prepare the ship and choose a way into the Blackstone Fortress.', 'Portal Map'],
    bar:['Meet potential companions and give the Drukhari time to recover.', 'Recruit Companions', 'Rest'],
    market:['Equipment, provisions and traders of Precipice.', 'Buy Equipment', 'Buy Supplies'],
    temple:['Prayer and Confidence recovery for Space Marines.', 'Restore Confidence'],
    workshop:['Train heroes and repair damaged power armor.', 'Train Hero', 'Repair Armor']
  };
  const npcTopics = {bar:['work','rumours'],temple:['faith','shrine'],market:['goods','salvage'],workshop:['repairs','forge'],docks:['portals','crews'],ship:['rest','expedition']};
  const lastGreetings = {};
  const dialogueKeys = {};
  const locale = document.documentElement.lang || 'en';
  function npcText(key) {
    return window.NPC_LOCALES?.[locale]?.[key] ?? window.NPC_LOCALES?.en?.[key] ?? key;
  }
  function escapeText(value) {
    return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
  function greet(place) {
    const choices = Object.keys(window.NPC_LOCALES.en).filter(key => key.startsWith(`${place}.greeting.`) && key !== lastGreetings[place]);
    const next = choices[Math.floor(Math.random() * choices.length)];
    lastGreetings[place] = next;
    dialogueKeys[place] = next;
  }
  let greetedBuildings = {};
  try { greetedBuildings = JSON.parse(localStorage.getItem('blackstone-npc-greeted') || '{}') || {}; } catch (_) {}
  let greetingTimer;
  function saveGreetings() {
    try { localStorage.setItem('blackstone-npc-greeted', JSON.stringify(greetedBuildings)); } catch (_) {}
  }
  function dismissGreeting() {
    clearTimeout(greetingTimer);
    app.querySelector('.npc-portrait')?.classList.remove('speaking');
    const bubble = app.querySelector('.npc-greeting');
    if (bubble) {
      bubble.classList.remove('visible');
      setTimeout(() => bubble.remove(), 450);
    }
  }
  function showGreeting(place) {
    greet(place);
    const portrait = app.querySelector('.npc-portrait');
    const bubble = document.createElement('section');
    bubble.className = 'npc-greeting';
    bubble.setAttribute('role', 'status');
    bubble.innerHTML = `<h3>${escapeText(npcText(place+'.name'))}</h3><p>${escapeText(npcText(dialogueKeys[place]))}</p><button class="btn small" data-action="greeting-close">${escapeText(npcText('ui.continue'))}</button>`;
    portrait.append(bubble);
    requestAnimationFrame(() => {
      if (!bubble.isConnected) return;
      portrait.classList.add('speaking');
      bubble.classList.add('visible');
    });
    clearTimeout(greetingTimer);
    greetingTimer = setTimeout(dismissGreeting, place === 'market' ? 5000 : 6500);
  }
  const heroes = [
    {classId:'sororitas',species:'human',xenos:false,name:'Sister of Battle', file:'sororitas', role:'Flame / Control / Morale', positions:'1–3', moves:['Flamer Sweep — burns two adjacent enemy ranks','Shock Maul — usable from ranks 1–3 and may Stun a front target','Prayer — restores morale to non-xenos allies'], trait:'Power armour grants 35% Stun resistance. Her prayers do not affect xenos.', rest:'Shrine or Rogue Trader Yacht', available:true},
    {classId:'ranger',species:'aeldari',xenos:true,name:'Aeldari Ranger', file:'aeldari-ranger', role:'Mobile ranged fighter', positions:'2–4', moves:['Rifle Shot — targets all ranks','Aimed Shot — rear targets','Blade Strike — may cause Bleeding','Evasive Step — reposition and evade'], trait:'Aeldari xenos. Needs food at camp. Severe injuries require treatment at base.', rest:'Rogue Trader Yacht', available:true},
    {name:'Space Marine', file:'space-marine', role:'Frontline / Guard'},
    {name:'Rogue Trader', file:'rogue-trader', role:'Support / Versatile'},
    {name:'Drukhari Wych', file:'drukhari-wych', role:'Arena gladiator / Evasion'}
  ];
  function availableRecruits(){const stock=inventory.state.recruitStock??3;return Array.from({length:stock},(_,i)=>heroes[i%2]);}
  const buildingOrder = ['temple','workshop','bar','market','ship','docks'];
  const buildingLevel = Object.fromEntries(buildingOrder.map(name => [name,Math.max(1,Math.min(3,inventory.state.buildingLevels[name]||1))]));
  const effectFiles = {
    breachExplode:'BreachExplode.wav', chestOpen:'Chest_open.wav', purchase:'Purchase.wav',
    buildingUpgrade:"BuildingUpgrade.mp3",
    raidAmbient:'Raid_ambient.mp3',
    psychicAttack:'psychological_attack.wav', psychologicalBreakdown:'psychological_breakdown.wav',
    rangerHit:"Ranger_GotHit.wav", rangerDeath:'Ranger_Death2.wav', rangerShoot:'Ranger_Shoot.wav',
    sororitasFlamer:'Flamethrower.wav', sororitasPray:'Sororitas_pray.mp3', sororitasStress:'Sororitas_Stress.mp3',
    sororitasPain1:'Sororitas_pain1.wav', sororitasPain2:'Sororitas_pain2.mp3', sororitasDeath:'Sororitas_death.wav',
    tyranidDeath:'Tyranyd_Death.wav', tyranidHit1:'Tyranyd_GotHit.wav', tyranidHit2:'Tyranyd_GotHit2.wav',
    termagantShoot:'Termogant_shoot.wav', hormagauntAttack:'Hormagaunt_Attacks.wav',
    hover:'Mouse-hover.mp3', teleportOut:'Teleport - out.mp3', teleportIn:'Teleport-in.mp3',
    barEnter:'Bar - enter.mp3', barExit:'Bar - exit.mp3', docksEnter:'Docks - Enter.mp3',
    templeEnter:'Shrine - Enter.mp3', shipEnter:'Yacht - enter.mp3',
    marketEnter:'Market - enter.mp3', workshopEnter:'Workshop-Enter.mp3'
  };
  const combatEffectNames=['psychicAttack','psychologicalBreakdown','rangerHit','rangerDeath','rangerShoot','sororitasFlamer','sororitasPray','sororitasStress','sororitasPain1','sororitasPain2','sororitasDeath','tyranidDeath','tyranidHit1','tyranidHit2','termagantShoot','hormagauntAttack'];
  let tyranidHitVariant=0,sororitasPainVariant=0;
  const effectVolume = {hover:.65, workshopEnter:.5, raidAmbient:.5};
  const effectVersions={sororitasPain1:'133',sororitasPain2:'135'};
  const effects = Object.fromEntries(Object.entries(effectFiles).map(([name,file]) => {
    const sound = new Audio(`sfx/${encodeURIComponent(file)}${effectVersions[name]?`?v=${effectVersions[name]}`:''}`);
    sound.preload = 'auto';
    sound.dataset.effect = name;
    document.body.append(sound);
    return [name,sound];
  }));
  const raidAmbient=effects.raidAmbient;raidAmbient.loop=true;
  const buildingEffects = {temple:'templeEnter',workshop:'workshopEnter',bar:'barEnter',market:'marketEnter',ship:'shipEnter',docks:'docksEnter'};
  const effectFades = new Map();
  function playEffect(name) {
    const sound = effects[name];
    if (!sound) return;
    effectFades.delete(name);
    sound.pause();
    sound.currentTime = 0;
    sound.volume = effectLevel(name);
    sound.play().catch(() => {});
  }
  function fadeEffect(name, duration = 220) {
    const sound = effects[name];
    if (!sound || sound.paused) return;
    const fade = {started:performance.now()};
    effectFades.set(name, fade);
    function step(now) {
      if (effectFades.get(name) !== fade) return;
      const remaining = Math.max(0, 1 - (now - fade.started) / duration);
      sound.volume = effectLevel(name) * remaining;
      if (remaining > 0) requestAnimationFrame(step);
      else {
        sound.pause();
        sound.currentTime = 0;
        sound.volume = effectLevel(name);
        effectFades.delete(name);
      }
    }
    requestAnimationFrame(step);
  }
  let hubScene = null;
  let hubError = false;
  const hubImageCache = new Map();
  let hubLoading = false;
  let missionReady = Promise.resolve();
  const tracks = {menu:'Black Fortress - main menu.mp3', hub:'Black Fortress - Hub Location.mp3', mission:'Black Fortress - Raid.mp3'};
  let page = 'menu';
  let missionArea = 'corridor';
  let selectedHero = 0;
  let soundEnabled = true;
  let settingsOpen = false;
  let optionsOpen = false;
  let optionsReturnFocus = null;
  let mission = null;
  const keys = new Set();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const volumeDefaults = {overall:40, music:45, sfx:45};
  let savedVolumes = {};
  try { savedVolumes = JSON.parse(localStorage.getItem('blackstone-volumes') || '{}') || {}; } catch (_) { /* Use defaults. */ }
  const volumes = Object.fromEntries(Object.entries(volumeDefaults).map(([name, defaultValue]) => {
    const value = Number(savedVolumes[name]);
    return [name, Number.isFinite(value) && value >= 0 && value <= 100 ? value : defaultValue];
  }));

  function effectLevel(name) {
    return volumes.overall * volumes.sfx / 10000 * (effectVolume[name] ?? 1);
  }
  function applyVolumes() {
    audio.volume = volumes.overall * volumes.music / 10000;
    for (const [name, sound] of Object.entries(effects)) {
      if (!effectFades.has(name)) sound.volume = effectLevel(name);
    }
  }
  applyVolumes();

  function button(label, action, options = {}) {
    const classes = `btn${options.small ? ' small' : ''}`;
    const disabled = options.disabled ? ' disabled' : '';
    return `<button class="${classes}" type="button" data-action="${action}"${disabled}>${label}</button>`;
  }

  function musicLabel() {
    return soundEnabled ? (audio.paused ? 'Start Music' : 'Music On') : 'Music Off';
  }

  function updateMusicControl() {
    const control = document.querySelector('[data-action="sound"]');
    if (control) {
      if(control.classList.contains('hub-music')){control.title=musicLabel();control.setAttribute('aria-label',musicLabel());control.setAttribute('aria-pressed',String(soundEnabled));control.classList.toggle('muted',!soundEnabled);}
      else control.textContent = musicLabel();
    }
    const hint = document.querySelector('.menu-hint');
    if (hint) hint.textContent = !soundEnabled ? 'Menu music is off.' : audio.paused ? 'Click anywhere to start the menu music.' : 'Menu music is playing.';
  }

  audio.addEventListener('playing', updateMusicControl);
  audio.addEventListener('pause', updateMusicControl);
  audio.addEventListener('ended', () => {
    if (page === 'mission' && mission?.victoryCue && audio.getAttribute('src') === 'music/Victory.wav') {
      mission.victoryCue = false;
      setMusic();
    }
  });

  function setMusic() {
    const track = page === 'mission' ? (mission?.defeated ? 'Party lost.mp3' : mission?.victoryCue ? 'Victory.wav' : mission?.combat ? 'Black Fortress - combat 1.mp3' : tracks.mission) : page === 'menu' ? tracks.menu : tracks.hub;
    audio.loop = !['Party lost.mp3', 'Victory.wav'].includes(track);
    const path = `music/${encodeURIComponent(track)}`;
    if (audio.getAttribute('src') !== path) {
      audio.setAttribute('src', path);
      audio.load();
    }
    if (soundEnabled && !(mission?.defeated && audio.ended)) audio.play().catch(updateMusicControl);
    else audio.pause();
    if(page==='mission')raidAmbient.play().catch(()=>{});
    else {raidAmbient.pause();raidAmbient.currentTime=0;}
  }

  function startMenuMusicOnGesture(event) {
    if (page !== 'menu' || !soundEnabled || !audio.paused) return;
    // The sound button handles its own first click so that it does not immediately mute again.
    if (event.target.closest?.('[data-action="sound"]')) return;
    audio.play().then(updateMusicControl).catch(updateMusicControl);
  }
  document.addEventListener('pointerdown', startMenuMusicOnGesture, {capture:true});
  document.addEventListener('keydown', startMenuMusicOnGesture, {capture:true});

  function toggleSound() {
    if (soundEnabled && audio.paused) {
      audio.play().catch(updateMusicControl);
      return;
    }
    soundEnabled = !soundEnabled;
    setMusic();
    if (page === 'mission') {
      const control = document.querySelector('.mission-top [data-action="sound"]');
      if (control) control.textContent = musicLabel();
    } else render();
  }

  function hubImages() {
    if (!hubScene) return [];
    const sources = ['hub/background.png', 'hub/debris-1.png', 'hub/debris-2.png', 'hub/debris-3.png'];
    for (const layer of hubScene.layers) {
      if (layer.visible === false) continue;
      const place = typeof layer.building === 'string' ? layer.building : layer.building ? layer.name.split(' · ')[0] : null;
      sources.push(place ? `layers/${place}-level-${buildingLevel[place]}.png?set=building-order-2` : `hub/${layer.src.split('/').pop()}`);
    }
    return [...new Set(sources)];
  }

  function loadHubImage(src) {
    if (!hubImageCache.has(src)) {
      hubImageCache.set(src, new Promise(resolve => {
        const image = new Image();
        image.onload = () => {
          if (image.decode) image.decode().catch(() => {}).finally(resolve);
          else resolve();
        };
        image.onerror = resolve;
        image.src = src;
        if (image.complete && image.naturalWidth) resolve();
      }));
    }
    return hubImageCache.get(src);
  }

  async function enterHub(fromMission) {
    hubLoading = true;
    const overlay = document.createElement('div');
    overlay.className = 'hub-loading';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = '<div class="hub-loading-content"><span class="hub-loading-spinner" aria-hidden="true"></span><strong>Entering Precipice</strong><span>Loading the outpost…</span></div>';
    document.body.append(overlay);
    const started = performance.now();
    await Promise.race([Promise.all(hubImages().map(loadHubImage)), new Promise(resolve => setTimeout(resolve, 12000))]);
    await new Promise(resolve => setTimeout(resolve, Math.max(0, 350 - (performance.now() - started))));
    page = 'hub';
    render();
    if (fromMission) playEffect('teleportIn');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      overlay.classList.add('leaving');
      setTimeout(() => {
        overlay.remove();
        hubLoading = false;
        if (expeditionReport) { supplies.open({mode:'summary',summary:expeditionReport}); expeditionReport=null; }
      }, 2300);
    }));
  }

  async function enterMission() {
    hubLoading = true;
    keys.clear();
    clearTimeout(greetingTimer);
    const overlay = document.createElement('div');
    overlay.className = 'hub-loading mission-loading';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = '<div class="hub-loading-content"><span class="hub-loading-spinner" aria-hidden="true"></span><strong>Into the Blackstone Fortress</strong><span>Preparing the expedition…</span></div>';
    document.body.append(overlay);
    await loadHubImage('backgrounds/mission-loading.png');
    // Paint the parchment before creating and decoding the corridor.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const layout=window.BlackstoneRooms?.ensureRun(inventory.run);
    missionArea=layout?.current?.startsWith('room-')?'room':'corridor';
    page = 'mission';
    render();
    await missionReady;
    // All battle poses are decoded while the loading parchment is still up.
    // This prevents the first use of an attack or hit animation from pausing combat.
    await window.warmCombatImages?.();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    playEffect('teleportIn');
    overlay.classList.add('leaving');
    setTimeout(() => {
      overlay.remove();
      keys.clear();
      hubLoading = false;
      if (inventory.run?.defeated) { mission.defeated=true;go('hub'); }
      else showLoot();
    }, 2300);
  }

  function go(destination) {
    if (hubLoading) return;
    if(destination==='mission'&&!inventory.run&&!selectedExpeditionCrew().length){
      const panel=app.querySelector('.portal-panel, .building-panel');if(panel&&!panel.querySelector('.rest-warning'))panel.insertAdjacentHTML('afterbegin','<p class="rest-warning" role="alert">No crew available. Recruit at the Tavern or cancel a rest assignment before departure.</p>');return;
    }
    if (buildingEffects[page] && destination !== page) fadeEffect(buildingEffects[page]);
    if (page === 'hub' && buildingEffects[destination]) playEffect(buildingEffects[destination]);
    if (page === 'bar' && destination === 'hub') playEffect('barExit');
    if (['docks','portals'].includes(page) && destination === 'mission') {
      greetedBuildings = {};
      saveGreetings();
      playEffect('teleportOut');

    }
    if (page === 'mission' && destination === 'hub') {
      const walkingIntoPortal = !!mission?.entering;
      if (!walkingIntoPortal && !mission?.fleeing && !mission?.defeated && !payPortalEnergy()) return;
      if (!walkingIntoPortal) playEffect('teleportOut');
    }
    const fromMission = page === 'mission';
    if (fromMission && destination !== 'mission') {
      expeditionReport = inventory.finish(!!mission?.defeated,{fled:!!mission?.fleeing});syncCrew();
    }
    if (page === 'mission' && destination !== 'mission') {
      mission?.stopCombat?.();
      combatEffectNames.forEach(name=>fadeEffect(name));
      raidAmbient.pause();raidAmbient.currentTime=0;
      mission = null;
      keys.clear();
    }
    if (destination === 'hub' && page !== 'hub') {
      enterHub(fromMission);
      return;
    }
    if (destination === 'mission' && page !== 'mission') {
      inventory.begin(selectedExpeditionCrew());
      raidAmbient.play().catch(()=>{});
      enterMission();
      return;
    }
    clearTimeout(greetingTimer);
    page = destination;
    render();
  }

  function upgrade(place) {
    if (buildingLevel[place] < 3) {
      buildingLevel[place]++;
      inventory.state.buildingLevels[place]=buildingLevel[place];inventory.save();
      playEffect("buildingUpgrade");
    }
    render();
  }

  function renderBaseControls(){return `<nav class="hub-controls" aria-label="Hub settings"><button class="expedition-icon" data-action="options" aria-label="Options" title="Options">${window.CombatUI.icon('gear')}</button><button class="expedition-icon hub-music ${soundEnabled?'':'muted'}" data-action="sound" aria-label="${musicLabel()}" title="${musicLabel()}" aria-pressed="${soundEnabled}"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M16 28V10l16-4v18M16 15l16-4"/><ellipse cx="11" cy="29" rx="5" ry="4"/><ellipse cx="27" cy="25" rx="5" ry="4"/><path class="music-slash" d="M6 5L35 35"/></svg></button></nav>`;}
  function renderBaseStock(){return `<div class="base-stock" aria-label="Supplies"><span title="Thrones">${window.CombatUI.icon('coins')}<span>Thrones</span><b>${inventory.state.credits.toLocaleString('en')}</b></span>${[['ration','food'],['cell','cell'],['cutter','cargo'],['key','gear']].map(([id,icon])=>`<span title="${escapeText(supplies.t(id)[0])}">${window.CombatUI.icon(icon)}<span>${escapeText(supplies.t(id)[0])}</span><b>${inventory.count(id)}</b></span>`).join('')}</div>`;}

  function renderTop() {
    return `${renderBaseControls()}${renderBaseStock()}`;
  }

  function volumeControls() {
    return Object.entries({overall:'Overall',music:'Music',sfx:'SFX'}).map(([name,label]) => `<label class="volume-control" for="volume-${name}"><span>${label}</span><output for="volume-${name}">${volumes[name]}%</output><input id="volume-${name}" type="range" min="0" max="100" step="1" value="${volumes[name]}" data-volume="${name}"></label>`).join('');
  }

  function openCharacter(id){
    const member=expeditionCrew.find(h=>h.id===id),deployed=inventory.run?.party.find(h=>h.id===id);const hero=deployed||(member?{hp:28,maxHp:28,morale:100,maxMorale:100,...member,...inventory.state.heroProfiles[id]}:null);if(!hero||document.querySelector('.character-dialog'))return;
    keys.clear();const mod=window.Morale.modifiers(hero),conditions=window.Morale.entries(hero),positive=window.Morale.entries(hero,true);
    const row=(label,value,note='')=>`<dt>${label}</dt><dd>${value}${note?` <small>${note}</small>`:''}</dd>`;
    const sororitas=(hero.classId||'ranger')==='sororitas',portrait=sororitas?'sororitas':'aeldari-ranger',className=sororitas?'Sister of Battle':'Aeldari Ranger';
    const abilities=sororitas?'Flamer Sweep · 88% hit · 3–5 damage to two adjacent ranks<br>Shock Maul · ranks 1–3 · 92% hit · 4–7 damage · 55% base Stun<br>Prayer · +12 Morale to every non-xenos ally<br>Guarded Advance · Move back and evade':'Rifle Shot · 90% hit · 5–8 damage · 8% CRIT<br>Aimed Shot · 80% hit · 8–12 damage · 12% CRIT<br>Blade Strike · 95% hit · 4–7 damage · 5% CRIT · 45% base Bleed<br>Evasive Step · Move back and evade';
    const selected=selectedExpeditionCrew().find(entry=>entry.id===id),rank=deployed?.rank??selected?.rank;
    const dismissBlocked=deployed?'This character is currently on an expedition.':inventory.resting(id)?'Cancel this character’s rest assignment before dismissing them.':'';
    const dialog=document.createElement('dialog');dialog.className='options-dialog character-dialog';
    dialog.innerHTML=`<header><h2>${escapeText(hero.name)}</h2>${button('Close','character-close',{small:true})}</header><div class="character-layout"><div class="character-portrait-wrap"><img class="character-portrait" src="portraits/${portrait}.png" alt="${escapeText(hero.name)}">${window.GameHUD.traits(hero)}</div><div><p>Level ${hero.level||1} · ${rank?`Expedition rank ${rank}`:'Reserve'} · ${hero.hp<=0?'Fallen':className}</p><dl class="character-stats">${row('Health',`${hero.hp} / ${hero.maxHp}`)}${row('Morale',`${hero.morale??100} / ${hero.maxMorale||100}`)}${row('Speed',(hero.speed??6)+(mod.speed||0),mod.speed?`base ${hero.speed??6}, ${mod.speed}`:'')}${row('Accuracy modifier',`${mod.accuracy||0}%`,'applies to each skill')}${row('Damage',`${Math.round((mod.damage||1)*100)}%`,'of skill damage')}${row('Critical modifier',`${(hero.critBonus||0)+(mod.crit||0)}%`,'added to skill chance')}${row('Incoming damage',`${Math.round((mod.incoming||1)*100)}%`)}${row('Stress resistance',`${Math.round((hero.stressResistance||0)*100)}%`)}${row('Stun resistance',`${hero.stunResist??(sororitas?35:20)}%`)}</dl><h3>Conditions & afflictions</h3><p class="character-affliction">${conditions.length?conditions.map(c=>escapeText(c.name)+' — '+escapeText(c.description)).join('<br>'):'No psychological afflictions'}</p><p>${hero.bleed?`Bleeding · ${hero.bleed.damage} HP × ${hero.bleed.turns} turns<br>`:''}${hero.stunned?.turns?`Stunned · ${hero.stunned.turns} turn<br>`:''}${hero.poison?'Poisoned · '+hero.poison+'<br>':''}${hero.evade?'Evasion ready':''}</p><h3>Positive traits</h3><p>${positive.length?positive.map(c=>escapeText(c.name)+' — '+escapeText(c.description)).join('<br>'):'None'}</p><h3>Abilities</h3><p>${abilities}</p><small>${sororitas?'Stun chance = base chance +15% on CRIT − target resistance. Maximum 85%. Prayer ignores Aeldari and other xenos.':'Bleed chance = base chance +20% on CRIT − target resistance. Other modifiers above apply in combat.'}</small></div></div><footer class="character-dialog-actions"><button class="btn small dismiss-hero" data-action="character-dismiss-${escapeText(id)}" ${dismissBlocked?'disabled':''} title="${escapeText(dismissBlocked||'Permanently remove this character from your roster')}">Dismiss character</button>${dismissBlocked?`<small>${escapeText(dismissBlocked)}</small>`:''}</footer>`;
    const opener=document.activeElement;
    app.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();opener?.focus();});
    let outsideDown=false;const outside=e=>{const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
    dialog.addEventListener('pointerdown',e=>{outsideDown=e.target===dialog&&outside(e);});
    dialog.addEventListener('click',e=>{if(outsideDown&&e.target===dialog&&outside(e))dialog.close();outsideDown=false;});dialog.showModal();
  }

  function requestDismissHero(id){
    const hero=expeditionCrew.find(entry=>entry.id===id);if(!hero)return;
    if(inventory.run?.party.some(entry=>entry.id===id)||inventory.resting(id))return;
    document.querySelector('.character-dialog')?.close();
    const dialog=document.createElement('dialog');dialog.className='options-dialog dismiss-dialog';
    dialog.innerHTML=`<h2>Dismiss ${escapeText(hero.name)}?</h2><p>This permanently removes the character and their accumulated traits from your roster.</p><div class="options-actions">${button('Keep character','dismiss-cancel',{small:true})}<button class="btn small dismiss-hero" data-action="dismiss-confirm-${escapeText(id)}">Dismiss permanently</button></div>`;
    app.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
  }

  function dismissHero(id){
    const result=inventory.dismissHero(id);if(result!==true)return;
    document.querySelector('.dismiss-dialog')?.close();syncCrew();render();
  }

  function openOptions() {
    if (optionsOpen) return;
    optionsOpen = true;
    optionsReturnFocus = document.activeElement;
    keys.clear();
    const dialog = document.createElement('dialog');
    dialog.className = 'options-dialog';
    dialog.setAttribute('aria-labelledby', 'options-title');
    dialog.innerHTML = `<div class="tag">Blackstone Expedition</div><h2 id="options-title">Options</h2><p>Audio levels</p>${volumeControls()}<div class="options-actions">${button(soundEnabled ? 'Music On' : 'Music Off', 'options-music', {small:true})}${button('Export Save','campaign-export-current',{small:true})}${button('Main Menu','campaign-menu',{small:true})}${button('Back to Game', 'options-close', {small:true})}</div>`;
    app.append(dialog);
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeOptions(); });
    dialog.showModal();
    dialog.querySelector('[data-action="options-close"]').focus();
  }

  function closeOptions() {
    const dialog = app.querySelector('.options-dialog');
    if (dialog) {
      dialog.close();
      dialog.remove();
    }
    optionsOpen = false;
    optionsReturnFocus?.focus();
    optionsReturnFocus = null;
  }

  function loadCampaign(index){
    const state=window.CampaignSaves.select(index);
    inventory.state=state;
    inventory.state.heroProfiles||={};inventory.state.restSlots||={bar:[],temple:[],ship:[]};inventory.state.buildingLevels||={};
    for(const name of buildingOrder)buildingLevel[name]=Math.max(1,Math.min(3,state.buildingLevels[name]||1));
    syncCrew();expeditionReport=null;mapOpen=false;go(inventory.run?'mission':'hub');
  }
  function campaignDialog(mode){
    const saves=window.CampaignSaves;
    const dialog=document.createElement('dialog');dialog.className='options-dialog campaign-dialog';
    dialog.innerHTML=`<h2>${mode==='new'?'New Game':'Load Game'}</h2><p>${escapeText(saves.notice)}</p><div class="campaign-slots">${saves.data.slots.map((slot,i)=>`<section class="campaign-slot"><h3>Campaign ${i+1}</h3><p>${slot?`${slot.state.run?'The First Passage':'Precipice'} · ${escapeText(slot.state.difficulty)}<br>${Number(slot.state.credits).toLocaleString('en')} Thrones · ${new Date(slot.updated).toLocaleString()}<br>${escapeText(slot.state.run?.party.map(h=>h.name||h.id).join(', ')||'Aeldari Ranger')}`:'Empty slot'}</p>${mode==='new'?`<select aria-label="Difficulty" data-save-difficulty="${i}">${Object.keys(window.EXPEDITION_DIFFICULTIES).map(d=>`<option ${d==='normal'?'selected':''}>${d}</option>`).join('')}</select><button class="btn small" data-save-create="${i}">${slot?'Replace campaign':'Start campaign'}</button>`:`<button class="btn small" data-save-load="${i}" ${slot?'':'disabled'}>Continue</button><button class="btn small" data-save-export="${i}" ${slot?'':'disabled'}>Export</button><button class="btn small" data-save-import="${i}">Import</button>`}</section>`).join('')}</div><p class="save-message" role="status"></p><button class="btn small" data-save-close>Back</button>`;
    app.append(dialog);dialog.showModal();dialog.addEventListener('close',()=>dialog.remove());
    dialog.addEventListener('click',async event=>{
      const b=event.target.closest('button');if(!b)return;
      const message=dialog.querySelector('.save-message');
      try{
        if(b.hasAttribute('data-save-close')){dialog.close();return;}
        if(b.dataset.saveExport!==undefined){saves.export(Number(b.dataset.saveExport));return;}
        if(b.dataset.saveLoad!==undefined){dialog.close();loadCampaign(Number(b.dataset.saveLoad));return;}
        if(b.dataset.saveCreate!==undefined){const i=Number(b.dataset.saveCreate);if(saves.data.slots[i]&&!confirm('Replace this campaign? Export it first if you want to keep it.'))return;saves.create(i,dialog.querySelector(`[data-save-difficulty="${i}"]`).value);dialog.close();loadCampaign(i);return;}
        if(b.dataset.saveImport!==undefined){const i=Number(b.dataset.saveImport);const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{try{if(!input.files[0])return;if(input.files[0].size>2000000)throw Error('Save file is too large');if(saves.data.slots[i]&&!confirm('Replace this campaign with the imported save?'))return;saves.import(i,await input.files[0].text());dialog.close();loadCampaign(i);}catch(e){message.textContent=e.message;}};input.click();}
      }catch(e){message.textContent=e.message;}
    });
  }
  window.addEventListener('save-error',()=>{let warning=document.querySelector('#save-warning');if(!warning){warning=document.createElement('div');warning.id='save-warning';warning.setAttribute('role','alert');document.body.append(warning);}warning.textContent=window.CampaignSaves.notice;});
  function renderMenu() {
    const controls = volumeControls();
    const content = settingsOpen
      ? `<div class="settings-panel"><h2>Settings</h2><p>Sound levels</p>${controls}<nav class="menu-nav settings-nav">${button(musicLabel(),'sound')}${button('Back to Menu','settings-back')}</nav></div>`
      : `<p>Enter the fortress from Precipice. The first passage is ready to explore.</p><nav class="menu-nav">${button('Continue','campaign-continue',{disabled:window.CampaignSaves.data.active===null})}${button('New Game','campaign-new')}${button('Load Game','campaign-load')}${button('Settings','settings')}</nav>`;
    app.innerHTML = `<section class="scene" style="background-image:url('backgrounds/main-menu.png')"><div class="menu-shell"><h1 class="game-logo"><img src="branding/blackstone-expedition-logo.png" alt="Blackstone Expedition"></h1>${content}<p class="menu-hint">Click anywhere to start the menu music.</p></div><aside class="parchment"><h2>Captain's Log</h2><p>Precipice is the port near the fortress. Visit the docks, select a portal, and guide the Ranger through the passage.</p></aside></section>`;
    updateMusicControl();
  }

  function renderHub() {
    if (!hubScene) {
      app.innerHTML = `${renderTop()}<section class="stage"><p>${hubError ? 'The hub scene could not be loaded.' : 'Loading Precipice…'}</p></section>`;
      return;
    }
    const layers = hubScene.layers.map((layer,index) => {
      if (layer.visible === false) return '';
      const place = typeof layer.building === 'string' ? layer.building : layer.building ? layer.name.split(' · ')[0] : null;
      const level = place && buildingLevel[place];
      const layout = layer.variants?.[level] || layer;
      const src = place ? `layers/${place}-level-${level}.png?set=building-order-2` : `hub/${layer.src.split('/').pop()}`;
      const style = `left:${layout.x/16.72}%;top:${layout.y/9.41}%;width:${layout.w/16.72}%;${layout.h == null ? '' : `height:${layout.h/9.41}%;`}z-index:${index+1};opacity:${(layer.opacity ?? 100)/100};${layer.crop ? `clip-path:inset(${layer.crop}% 0 0 0)` : 'clip-path:none'};--label-left:${Math.max(0,-layout.x)/layout.w*100}%`;
      const imageStyle = `transform:rotate(${layout.rotation ?? layer.rotation ?? 0}deg)`;
      // The level-three dock artwork extends behind the tavern; only its lower platform is interactive.
      if(place==='docks'&&level===3)return `<div class="hub-sprite" style="${style}"><img src="${src}" alt="" style="${imageStyle};height:100%;object-fit:contain;object-position:center bottom"><button class="landmark hub-sprite" type="button" data-action="docks" aria-label="Docks, level 3" title="Docks" style="left:4%;top:48%;width:88%;height:48%;--label-left:0%"><span>Docks · Level 3</span></button></div>`;
      if (place && level) return `<button class="landmark hub-sprite" type="button" data-action="${place}" aria-label="${names[place]}, level ${level}" title="${names[place]}" style="${style}"><img src="${src}" alt="" style="${imageStyle}"><span>${names[place]} · Level ${level}</span></button>`;
      return `<div class="hub-sprite" style="${style}"><img src="${src}" alt="" style="${imageStyle}"></div>`;
    }).join('');
    const debris = `<div class="hub-debris-field" aria-hidden="true"><img src="hub/debris-1.png" alt=""><img src="hub/debris-2.png" alt=""><img src="hub/debris-3.png" alt=""><img src="hub/debris-1.png" alt=""><img src="hub/debris-2.png" alt=""></div>`;
    app.innerHTML = `<section class="stage hub-layout"><div class="map">${debris}${layers}<div class="map-tip">Select the Docks to enter the fortress</div></div><div class="map-label">Precipice</div>${expeditionCrew.length?window.GameHUD.hub(inventory,expeditionCrew.map(hero=>({...hero,...inventory.state.heroProfiles[hero.id]}))):'<aside class="hub-commander">No crew · Recruit at the Tavern</aside>'}${renderBaseControls()}${renderBaseStock()}</section>`;
  }

  function renderHire(topic){
    inventory.state.recruitStock??=3;inventory.save();
    const stock=inventory.state.recruitStock,candidates=availableRecruits();if(selectedHero>=candidates.length)selectedHero=0;const hero=candidates[selectedHero]||heroes[0];
    const lines=(window.RECRUIT_LINES[document.documentElement.lang]||window.RECRUIT_LINES.en)[stock===0?'empty':topic||'available'];
    const line=lines[Math.floor(Math.random()*lines.length)];
    app.innerHTML=`<section class="recruit-screen" style="background-image:url('interiors/bar.png')"><div class="recruit-top">${button('Back to Tavern','bar',{small:true})}</div><div class="recruit-panels"><section class="recruit-panel"><h3>Your crew <small>${expeditionCrew.length} / ${ROSTER_LIMIT}</small></h3><div class="recruit-crew">${expeditionCrew.map(h=>`<button class="recruit-mini" data-action="inspect-hero-${h.id}">${window.GameHUD.face(h)}<span><strong>${escapeText(h.name)}</strong><small>Level ${inventory.state.heroProfiles[h.id]?.level||1}${inventory.resting(h.id)?' · Resting':''}</small></span></button>`).join('')||'<p>No companions recruited.</p>'}</div></section><section class="recruit-panel"><h3>Available <small>${stock}</small></h3>${stock?`<div class="recruit-candidates">${candidates.map((candidate,i)=>`<button class="recruit-mini candidate ${selectedHero===i?'selected':''}" data-action="hero-${i}">${window.GameHUD.face({id:'candidate-'+i,classId:candidate.classId,name:candidate.name})}<span><strong>${escapeText(candidate.name)}</strong><small>Level 1 · ${escapeText(candidate.role)}</small></span></button>`).join('')}</div><div class="recruit-facts"><strong>${escapeText(hero.name)}</strong><p>Ranks ${escapeText(hero.positions)} · ${escapeText(hero.rest)}</p><p>${hero.moves.map(escapeText).join(' · ')}</p><p>${escapeText(hero.trait)}</p></div>${button(expeditionCrew.length>=ROSTER_LIMIT?'Roster full':'Recruit · Free','recruit-selected',{disabled:expeditionCrew.length>=ROSTER_LIMIT||!!inventory.run})}`:'<div class="recruit-empty"><span>◇</span><p>No candidates available</p><small>Check again after your next expedition.</small></div>'}</section></div><aside class="recruit-host speaking"><img src="npcs/bar.png" alt="Bartender"><div class="recruit-speech">${escapeText(line)}</div></aside>${renderBaseControls()}${renderBaseStock()}</section>`;
    const host=app.querySelector('.recruit-host');setTimeout(()=>host?.classList.remove('speaking'),5000);
  }

  let selectedRestSlot=null;
  function renderTreatment(place){
    if(!['bar','temple','ship'].includes(place))return '';
    const slots=inventory.state.restSlots[place],level=buildingLevel[place];
    return `<div class="treatment-panel"><h3>Crew Rest <small>${slots.filter(Boolean).length} / ${level}</small></h3><p class="caption">Returns after the next expedition · ${window.Morale.rules.treatmentCost} Thrones per hero · Restores morale and clears afflictions.</p><div class="rest-slots">${Array.from({length:3},(_,i)=>{
      const occupant=expeditionCrew.find(h=>h.id===slots[i]?.id);
      return i>=level?`<div class="rest-slot locked" title="Upgrade to unlock"><span>◇</span><small>Level ${i+1}</small></div>`:occupant?`<button class="rest-slot occupied" data-action="rest-cancel-${i}" title="Cancel rest and refund payment">${window.GameHUD.face(occupant)}<small>Resting · Cancel</small></button>`:`<button class="rest-slot" data-action="rest-select-${i}" aria-label="Choose hero for rest slot ${i+1}"><span>＋</span><small>Choose hero</small></button>`;
    }).join('')}</div>${selectedRestSlot!==null?`<div class="rest-roster"><h4>Choose a companion</h4>${expeditionCrew.map(hero=>{
      const allowed=inventory.restPlaces(hero).includes(place),resting=inventory.resting(hero.id),poor=inventory.state.credits<window.Morale.rules.treatmentCost;
      return `<button class="rest-candidate" data-action="rest-assign-${hero.id}" ${!allowed||resting||poor?'disabled':''}>${window.GameHUD.face(hero)}<span>${escapeText(hero.name)}<small>${!allowed?'Rest available at '+inventory.restPlaces(hero).map(p=>names[p]).join(', '):resting?'Already resting':poor?'Not enough Thrones':'Morale '+(inventory.state.heroProfiles[hero.id]?.morale??100)+'/100'}</small></span></button>`;
    }).join('')}</div>`:''}</div>`;
  }
  function refreshRest(){
    app.querySelector('.treatment-panel').outerHTML=renderTreatment(page);
    app.querySelector('.base-stock').outerHTML=renderBaseStock();
  }

  function renderBuilding(place) {
    selectedRestSlot=null;
    const details = places[place];
    const actions = details.slice(1).filter(label=>!['Crew Rest','Rest','Restore Confidence','Portal Map'].includes(label)).map(label => {
      const action = label === 'Recruit Companions' ? 'hire' : label === 'Portal Map' ? 'portals' : label === 'Buy Supplies' ? 'market-supplies' : '';
      return button(action ? label : `${label} · Coming Soon`, action, {disabled:!action});
    }).join('');
    const level = buildingLevel[place];
    app.innerHTML = `${renderTop()}<section class="scene building-scene" data-building="${place}" style="background-image:url('interiors/${place}.png')"><div class="npc-portrait"><img src="npcs/${place === 'docks' ? 'docks-complete' : place}.png" alt="${escapeText(npcText(place+'.name'))}"></div><div class="building-panel"><div class="building-panel-top"><div class="tag">Precipice Location · Level ${level}</div>${button('Back to Precipice','hub',{small:true})}</div><h2>${names[place]}</h2><p class="building-description">${details[0]}</p>${actions}${place==='docks'?portalChoices():''}${renderTreatment(place)}<div class="upgrade-box"><strong>Building Level ${level} / 3</strong><p class="caption">${['bar','temple','ship'].includes(place)?`Rest capacity: ${level} / 3 slots. Upgrading adds one slot.`:'Visual upgrade preview.'}</p>${button(level === 3 ? 'Maximum Level' : 'Upgrade Building',`upgrade-${place}`,{disabled:level === 3})}</div></div></section>`;
    showGreeting(place);
  }

  function dockParty(){
    const crew=selectedExpeditionCrew().map(hero=>({...hero,...inventory.state.heroProfiles[hero.id]})),selectedIds=new Set(crew.map(hero=>hero.id));
    const slots=Array.from({length:4},(_,i)=>{const hero=crew[i],rank=4-i;return hero?`<button type="button" class="dock-party-member" data-action="dock-remove-${escapeText(hero.id)}" title="Remove ${escapeText(hero.name)} from the expedition" aria-label="Remove ${escapeText(hero.name)} from expedition rank ${rank}">${window.GameHUD.face(hero)}<b>${rank}</b><span aria-hidden="true">×</span></button>`:`<div class="dock-party-member empty" aria-label="Empty expedition rank ${rank}"><b>${rank}</b><span>＋</span></div>`;}).join('');
    const roster=expeditionCrew.map(hero=>{const resting=inventory.resting(hero.id),selected=selectedIds.has(hero.id),profile={...hero,...inventory.state.heroProfiles[hero.id]};return `<div class="dock-roster-entry ${selected?'selected':''} ${resting?'resting':''}"><button type="button" class="dock-roster-toggle" data-action="dock-toggle-${escapeText(hero.id)}" ${resting?'disabled':''} aria-pressed="${selected}" aria-label="${selected?'Remove':'Add'} ${escapeText(hero.name)} ${selected?'from':'to'} the expedition">${window.GameHUD.face(profile)}<span><strong>${escapeText(hero.name)}</strong><small>${resting?'Resting':selected?`Rank ${crew.find(entry=>entry.id===hero.id)?.rank}`:'Available'}</small></span></button><button type="button" class="dock-roster-info" data-action="inspect-hero-${escapeText(hero.id)}" aria-label="Inspect ${escapeText(hero.name)}" title="Character details">i</button></div>`;}).join('');
    return `<section class="dock-party" aria-label="Expedition crew selection"><header><strong>Expedition Crew</strong><small>${crew.length} / 4 selected</small></header><div class="dock-party-caption">Formation · rear to front</div><div class="dock-party-slots">${slots}</div><div class="dock-roster-title">Available characters</div><div class="dock-roster">${roster||'<p>No recruited characters.</p>'}</div></section>`;
  }
  function refreshDockParty(){const panel=app.querySelector('.dock-party');if(panel)panel.outerHTML=dockParty();if(selectedExpeditionCrew().length)app.querySelector('.rest-warning')?.remove();}
  function portalChoices(){return `${dockParty()}<label class="portal-difficulty">Difficulty <select data-expedition-difficulty>${Object.keys(window.EXPEDITION_DIFFICULTIES).map(id=>`<option value="${id}" ${inventory.state.difficulty===id?'selected':''}>${supplies.t(id)}</option>`).join('')}</select><small>Fleeing loss: ${window.EXPEDITION_DIFFICULTIES[inventory.state.difficulty].retreatLoss*100}%</small></label><div class="portal-grid"><button type="button" class="portal-card available" data-action="mission"><span class="portal-mark">◇</span><strong>The First Passage</strong><small>Corridor · Enter and reach the far portal</small><em>ENTER PORTAL</em></button><div class="portal-card unavailable"><span class="portal-mark">◇</span><strong>Unknown Portal</strong><small>Coming Soon</small></div><div class="portal-card unavailable"><span class="portal-mark">◇</span><strong>Unknown Portal</strong><small>Coming Soon</small></div></div>`;}
  function renderPortals(){page='docks';renderBuilding('docks');}

  function renderMission() {
    if(missionArea==='room'){renderRaidRoom();return;}
    const layout=window.BlackstoneRooms.ensureRun(inventory.run),corridor=window.BlackstoneRooms.getCorridor(layout,layout.currentCorridor||layout.current),passageNumber=corridor?.entry?'ENTRY':String((layout.corridors.indexOf(corridor)+1)||1).padStart(2,'0');
    app.innerHTML = `<section class="mission" id="mission"><div id="deep"></div><div id="distantLightning" aria-hidden="true"><svg viewBox="0 0 1600 1000" preserveAspectRatio="none"><g class="far-bolt bolt-a"><path d="M420 -20 L390 110 452 165 366 260 402 320 325 440 355 520 290 720 M366 260 L290 280 245 370 M402 320 L485 390 470 480"/></g><g class="far-bolt bolt-b"><path d="M1230 -20 L1170 100 1215 180 1120 290 1170 345 1060 490 1095 600 1020 820 M1120 290 L1030 320 990 430 M1170 345 L1270 420 1300 530"/></g></svg></div><div id="structures" class="world" aria-hidden="true"><img class="mega-range" src="corridor/modules/bg20/blackstone-megastructure-range-v4.png" alt="" style="left:0vh;"><img class="mega-range" src="corridor/modules/bg20/blackstone-megastructure-range-v4.png" alt="" style="left:180vh;transform:scaleX(-1);"><img class="mega-range" src="corridor/modules/bg20/blackstone-megastructure-range-v4.png" alt="" style="left:360vh;"></div><div id="fog"></div><div id="midground" class="world"><img class="module buttress" src="corridor/modules/bg40/blackstone_bg40_buttress_a.png" alt=""><img class="module overhang" src="corridor/modules/bg40/blackstone_bg40_overhang_b.png" alt=""><img class="module wallnode" src="corridor/modules/bg40/blackstone_bg40_wallnode_c.png" alt=""></div><div id="corridorColumns" class="world" aria-hidden="true"><img class="stone-column stone-pier" src="corridor/modules/bg40/blackstone-wide-pier-v1.png" alt="" style="left:-25vh;"><img class="stone-column stone-arch" src="corridor/modules/bg40/blackstone-wide-arch-v1.png" alt="" style="left:80vh;transform:scaleX(-1);"><img class="stone-column stone-pier" src="corridor/modules/bg40/blackstone-wide-pier-v1.png" alt="" style="left:270vh;"><img class="stone-column stone-arch" src="corridor/modules/bg40/blackstone-wide-arch-v1.png" alt="" style="left:355vh;transform:scaleX(-1);"><img class="stone-column stone-pier" src="corridor/modules/bg40/blackstone-wide-pier-v1.png" alt="" style="left:550vh;"></div><div id="playfield" class="world"></div><div id="endcaps" class="world"><img class="cap cap-left" src="corridor/corridor_caps/blackstone_corridor_cap_left_a_1024.png" alt=""><img class="cap cap-right" src="corridor/corridor_caps/blackstone_corridor_cap_right_b_1024.png" alt=""></div><canvas id="hero" aria-label="Expedition party in the corridor"></canvas><div id="foreground" class="world"><img class="frame frame-left" src="corridor/endpoint_obstacles/blackstone_foreground_edge_left_approved.png" alt=""><img class="frame frame-right" src="corridor/endpoint_obstacles/blackstone_foreground_edge_right_approved.png" alt=""></div><div class="mission-location">PASSAGE · ${passageNumber}</div><div class="touch-controls"><button type="button" data-direction="left" aria-label="Move left">←</button><button type="button" data-direction="right" aria-label="Move right">→</button></div><div class="mission-fade" id="missionFade"></div></section>`;
    mountResourceHUD();
    missionReady = startMission();
  }

  function renderRaidRoom(){
    const layout=window.BlackstoneRooms.ensureRun(inventory.run);
    const room=window.BlackstoneRooms.getRoom(layout,layout.current)||window.BlackstoneRooms.getRoom(layout);
    layout.current=room.id;window.BlackstoneRooms.revealRoom(layout,room.id);inventory.save();
    app.innerHTML=`<section class="raid-room" id="mission" data-room-id="${escapeText(room.id)}">${window.BlackstoneRooms.renderLayers(room.variants)}<canvas id="hero" aria-label="Expedition party in a Blackstone chamber"></canvas><div class="mission-location">BLACKSTONE CHAMBER · ${room.index+1}</div><div class="touch-controls"><button type="button" data-direction="left" aria-label="Move left">←</button><button type="button" data-direction="right" aria-label="Move right">→</button></div><div class="mission-fade" id="missionFade"></div></section>`;
    mountResourceHUD();
    missionReady=startRaidRoom(room);
  }

  function render() {
    setMusic();
    if (page === 'menu') renderMenu();
    else if (page === 'hub') renderHub();
    else if (page === 'hire') renderHire();
    else if (page === 'portals') renderPortals();
    else if (page === 'mission') renderMission();
    else if (page === 'market-supplies') supplies.shop(app,null,()=>go('market'),expeditionCrew,()=>playEffect('purchase'));
    else renderBuilding(page);
  }

  app.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target || target.disabled || hubLoading) return;
    const action = target.dataset.action;
    if(action.startsWith('inspect-hero-')){openCharacter(action.slice(13));return;}
    if(action==='character-close'){document.querySelector('.character-dialog')?.close();return;}
    if(action.startsWith('character-dismiss-')){requestDismissHero(action.slice(18));return;}
    if(action==='dismiss-cancel'){document.querySelector('.dismiss-dialog')?.close();return;}
    if(action.startsWith('dismiss-confirm-')){dismissHero(action.slice(16));return;}
    if(action==='recruit-selected'){recruitHero();return;}
    if(action==='campaign-new'||action==='campaign-load'){campaignDialog(action==='campaign-new'?'new':'load');return;}
    if(action==='campaign-continue'){if(window.CampaignSaves.data.active!==null)loadCampaign(window.CampaignSaves.data.active);return;}
    if(action==='campaign-export-current'){window.CampaignSaves.export(window.CampaignSaves.data.active);return;}
    if(action==='campaign-menu'){closeOptions();inventory.save();mission?.stopCombat?.();mission=null;keys.clear();page='menu';settingsOpen=false;render();return;}

    if(action.startsWith('rest-select-')){selectedRestSlot=Number(action.slice(12));refreshRest();return;}
    if(action.startsWith('rest-cancel-')){inventory.cancelRest(page,Number(action.slice(12)));selectedRestSlot=null;refreshRest();return;}
    if(action.startsWith('rest-assign-')){const hero=expeditionCrew.find(h=>h.id===action.slice(12));if(hero&&selectedRestSlot!==null&&inventory.assignRest(page,selectedRestSlot,hero)){inventory.state.expeditionPartyIds=(inventory.state.expeditionPartyIds||[]).filter(id=>id!==hero.id);inventory.save();}selectedRestSlot=null;refreshRest();return;}
    if(action.startsWith('dock-toggle-')){toggleExpeditionHero(action.slice(12));return;}
    if(action.startsWith('dock-remove-')){toggleExpeditionHero(action.slice(12),true);return;}
    if (action === 'flee') {if(mission?.combat)document.querySelector('.combat-controls-proxy [data-cmd="flee"]')?.click();else requestFleeExpedition();}
    else if(action==='flee-cancel'){document.querySelector('.flee-dialog')?.close();}
    else if(action==='flee-confirm'){performFleeExpedition();}
    else if(action==='camp-open')openCampMenu();
    else if(action==='camp-close'){document.querySelector('.camp-dialog')?.close();}
    else if(action==='camp-rest')restInRoom();
    else if(action==='enter-room-platform')enterRoomFromPlatform(target);
    else if (action === 'location-map') openLocationMap(false);
    else if (action === 'leave-room') openLocationMap(true);
    else if (action === 'map-close') closeLocationMap();
    else if (action.startsWith('map-route-')) chooseRaidRoute(action.slice(10));
    else if (action === 'inventory') {if(mission?.combat)document.querySelector('.combat-controls-proxy [data-cmd="inventory"]')?.click();else openInventory();}
    else if (action === 'sound') toggleSound();
    else if (action === 'options') openOptions();
    else if (action === 'options-close') closeOptions();
    else if (action === 'options-music') {
      soundEnabled = !soundEnabled;
      setMusic();
      target.textContent = soundEnabled ? 'Music On' : 'Music Off';
      updateMusicControl();
    }
    else if (action === 'settings') { settingsOpen = true; renderMenu(); }
    else if (action === 'settings-back') { settingsOpen = false; renderMenu(); }
    else if (action === 'greeting-close') dismissGreeting();
    else if (action.startsWith('upgrade-')) upgrade(action.slice(8));
    else if (action.startsWith('hero-')) { selectedHero = Number(action.slice(5)); render(); }
    else go(action);
  });
  app.addEventListener('keydown',event=>{if(event.target.matches('[data-crew-hud]')&&['Enter',' '].includes(event.key)){event.preventDefault();event.target.click();}});
  addEventListener('keydown',event=>{
    if(event.key!=='Escape'||event.repeat||hubLoading)return;
    // Native dialog cancellation owns the first Escape press for options, inventory,
    // maps, campaign slots and character details.
    if(document.querySelector('dialog[open]'))return;
    const greeting=app.querySelector('.npc-greeting.visible');
    if(greeting){event.preventDefault();dismissGreeting();return;}
    if(selectedRestSlot!==null&&['bar','temple','ship'].includes(page)){event.preventDefault();selectedRestSlot=null;refreshRest();return;}
    if(settingsOpen&&page==='menu'){event.preventDefault();settingsOpen=false;renderMenu();return;}
    if(page==='hub'||page==='mission'){event.preventDefault();openOptions();return;}
    const back={hire:'bar','market-supplies':'market',bar:'hub',market:'hub',temple:'hub',workshop:'hub',ship:'hub',docks:'hub'}[page];
    if(back){event.preventDefault();go(back);}
  });
  app.addEventListener('input', event => {
    const input = event.target.closest('[data-volume]');
    if (!input) return;
    const name = input.dataset.volume;
    if (!(name in volumes)) return;
    volumes[name] = clamp(Number(input.value) || 0, 0, 100);
    input.closest('label').querySelector('output').textContent = `${volumes[name]}%`;
    applyVolumes();
    try { localStorage.setItem('blackstone-volumes', JSON.stringify(volumes)); } catch (_) { /* Keep this session's settings. */ }
  });
  app.addEventListener('change',event=>{
    if(event.target.matches('[data-expedition-difficulty]')&&!inventory.run&&window.EXPEDITION_DIFFICULTIES[event.target.value]){
      inventory.state.difficulty=event.target.value;inventory.save();event.target.closest('.portal-difficulty').querySelector('small').textContent=`Fleeing loss: ${window.EXPEDITION_DIFFICULTIES[inventory.state.difficulty].retreatLoss*100}%`;
    }
  });
  let lastHoverSound = 0;
  app.addEventListener('pointerover', event => {
    const building = event.target.closest?.('.map .landmark');
    if (!building || building.contains(event.relatedTarget)) return;
    const now = performance.now();
    if (now - lastHoverSound < 90) return;
    lastHoverSound = now;
    playEffect('hover');
  });
  app.addEventListener('focusin', event => {
    if (event.target.matches?.('.map .landmark')) playEffect('hover');
  });
  app.addEventListener('pointerdown', event => {
    if (page !== 'menu' && !(mission?.defeated && audio.ended) && soundEnabled && !event.target.closest('[data-action="sound"]')) audio.play().catch(() => {});
    if(page==='mission'&&raidAmbient.paused)raidAmbient.play().catch(()=>{});
  });

  addEventListener('keydown', event => {
    if (page !== 'mission' || optionsOpen || mapOpen || hubLoading || document.querySelector('dialog[open]')) return;
    if (event.key.toLowerCase() === 'i' && !supplies.isOpen && !mission?.entering) {
      event.preventDefault();
      if(mission?.combat)document.querySelector('.combat-controls-proxy [data-cmd="inventory"]')?.click();
      else openInventory();
      return;
    }
    if (supplies.isOpen) return;
    const key = event.key.toLowerCase();
    if (['a','d','arrowleft','arrowright'].includes(key)) {
      keys.add(key);
      event.preventDefault();
    }
  });
  addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());
  app.addEventListener('pointerdown', event => {
    const button = event.target.closest('[data-direction]');
    if (button && page === 'mission' && !optionsOpen && !mapOpen && !supplies.isOpen && !hubLoading) {
      keys.add(button.dataset.direction === 'left' ? 'arrowleft' : 'arrowright');
      button.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
  });
  for (const eventName of ['pointerup','pointercancel']) app.addEventListener(eventName, event => {
    const button = event.target.closest('[data-direction]');
    if (button) keys.delete(button.dataset.direction === 'left' ? 'arrowleft' : 'arrowright');
  });

  function loadImage(path) {
    const image = new Image();
    image.src = path;
    return image;
  }
  const walkAtlas = loadImage('sprites/ranger-walk-game.webp');
  const idleAtlas = loadImage('sprites/ranger-idle-game.webp');
  const sororitasWalkAtlas = loadImage('sprites/sororitas-walk-game.webp');
  const sororitasIdleAtlas = loadImage('sprites/sororitas-idle-game.webp');
  const GAME_ATLAS_CELL=384;
  const encounterImages = [window.combatImages.raider,window.combatImages.gunner];


  function performFleeExpedition() {
    if(page!=='mission'||hubLoading||mission?.entering||mission?.defeated)return;
    document.querySelector('.flee-dialog')?.close();
    mission.fleeing=true;
    go('hub');
  }
  function requestFleeExpedition() {
    if(page!=='mission'||hubLoading||mission?.entering||mission?.defeated||document.querySelector('.flee-dialog'))return;
    keys.clear();const loss=window.EXPEDITION_DIFFICULTIES[inventory.run.difficulty].retreatLoss*100;
    const dialog=document.createElement('dialog');dialog.className='options-dialog flee-dialog';
    dialog.innerHTML=`<div class="tag">ABANDON EXPEDITION</div><h2>Flee the raid?</h2><p>The crew returns to Precipice and loses ${loss}% of collected loot. Every survivor also suffers 10 Morale damage.</p><div class="dialog-actions">${button('Continue the raid','flee-cancel',{small:true})}${button('Flee to Precipice','flee-confirm',{small:true})}</div>`;
    dialog.addEventListener('close',()=>dialog.remove());dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close();});app.append(dialog);dialog.showModal();
  }
  function mountResourceHUD() {
    const hud=document.createElement('div');hud.className='expedition-resources';hud.id='expeditionResources';
    document.querySelector('#mission').append(hud);updateResourceHUD();
  }
  function updateResourceHUD() {
    const hud=document.querySelector('#expeditionResources'),run=inventory.run;if(!hud||!run)return;
    hud.classList.toggle('energy-low',run.energy<25);
    const nav=(action,id,label,disabled=false)=>`<button class="expedition-icon" data-action="${action}" aria-label="${label}" title="${label}" ${disabled?'disabled':''}>${window.CombatUI.icon(id)}</button>`;
    const roomControls=missionArea==='room'?`${nav('leave-room','room-exit','Leave chamber and choose a passage',!!mission?.combat)}${nav('camp-open','camp','Make camp in this chamber',!!mission?.combat||!!run.events[`camp:${run.raidLayout?.current}`])}`:'';
    hud.innerHTML=`<nav class="expedition-tabs" aria-label="Expedition panels">${nav('flee','exit',`Flee — lose ${window.EXPEDITION_DIFFICULTIES[run.difficulty].retreatLoss*100}% of loot`,!!mission?.combat)}${nav('inventory','bag','Inventory [I]')}${roomControls}${nav('options','gear','Options')}${nav('location-map','map','Location map')}</nav><div class="raid-minimap" aria-label="Live expedition position">${renderRaidMap({compact:true})}</div>${window.GameHUD.party(run.party)}<div class="expedition-stock"><span title="Equipment energy">${window.CombatUI.icon('energy')}<b class="energy-value">${Math.ceil(run.energy)}/100</b></span><span title="Provisions">${window.CombatUI.icon('food')}<b>${inventory.count('ration')}</b></span><span title="Power cells">${window.CombatUI.icon('cell')}<b>${inventory.count('cell')}</b></span><span title="Thrones">${window.CombatUI.icon('coins')}<b>${inventory.state.credits}</b></span><span title="Backpack slots">${window.CombatUI.icon('cargo')}<b>${inventory.state.slots.filter(Boolean).length}/16</b></span></div>`;
  }

  function raidMapGeometry(layout) {
    const rooms=layout.rooms||[],entry=window.BlackstoneRooms.getRoom(layout,layout.entry);
    const points=rooms.map(room=>({x:room.x*180,y:room.y*126}));
    if(entry)points.push({x:entry.x*180-150,y:entry.y*126});
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y),pad=72;
    return {minX:Math.min(...xs)-pad,minY:Math.min(...ys)-pad,width:Math.max(...xs)-Math.min(...xs)+pad*2,height:Math.max(...ys)-Math.min(...ys)+pad*2,point:room=>({x:room.x*180,y:room.y*126})};
  }
  function raidMarker(layout,geometry) {
    const currentRoom=window.BlackstoneRooms.getRoom(layout,layout.current);
    if(layout.current?.startsWith('room-')&&currentRoom){const point=geometry.point(currentRoom);return {x:point.x,y:point.y-38};}
    const corridor=window.BlackstoneRooms.getCorridor(layout,layout.currentCorridor||layout.current);
    if(!corridor)return geometry.point(window.BlackstoneRooms.getRoom(layout,layout.entry));
    const fromId=layout.corridorFrom||corridor.from,toId=layout.corridorTo||corridor.to;
    const mapTo=window.BlackstoneRooms.getRoom(layout,toId),to=geometry.point(mapTo);
    const mapFrom=window.BlackstoneRooms.getRoom(layout,fromId),from=mapFrom?geometry.point(mapFrom):{x:to.x-150,y:to.y};
    const raw=missionArea==='corridor'&&mission?.viewport?mission.x/mission.viewport.clientHeight:(inventory.run?.progress??.48);
    const fromPosition=fromId?window.BlackstoneRooms.roomAccess(layout,corridor,fromId):(corridor.fromAccess??.34);
    const toPosition=toId?window.BlackstoneRooms.roomAccess(layout,corridor,toId):(corridor.toAccess??5.68);
    const span=(toPosition??5.68)-(fromPosition??.34);
    const t=Math.abs(span)<.001?0:clamp((raw-(fromPosition??.34))/span,0,1);
    return {x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t};
  }
  function renderRaidMap({selectRoute=false,compact=false}={}) {
    const layout=window.BlackstoneRooms?.ensureRun(inventory.run);if(!layout)return '';
    const geo=raidMapGeometry(layout),currentRoom=layout.current?.startsWith('room-')?layout.current:null;
    const available=new Map((currentRoom?layout.connections[currentRoom]:[]).map(edge=>[edge.corridor,edge.room]));
    const lines=layout.corridors.filter(c=>c.discovered).map(c=>{const a=geo.point(window.BlackstoneRooms.getRoom(layout,c.from)),b=geo.point(window.BlackstoneRooms.getRoom(layout,c.to));return `<line class="raid-map-corridor ${c.visited?'visited':''} ${layout.currentCorridor===c.id?'current':''}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;}).join('');
    const entry=window.BlackstoneRooms.getRoom(layout,layout.entry),entryPoint=geo.point(entry),outside={x:entryPoint.x-150,y:entryPoint.y};
    const entryLine=entry.discovered?`<line class="raid-map-corridor entry visited" x1="${outside.x}" y1="${outside.y}" x2="${entryPoint.x}" y2="${entryPoint.y}"/>`:'';
    const rooms=layout.rooms.filter(room=>room.discovered).map(room=>{const p=geo.point(room),edge=[...available.entries()].find(([,id])=>id===room.id),clickable=selectRoute&&!!edge;return `<g class="raid-map-room ${room.visited?'visited':'scouted'} ${currentRoom===room.id?'current':''} ${clickable?'destination':''}" transform="translate(${p.x} ${p.y})" ${clickable?`data-action="map-route-${edge[0]}" role="button" tabindex="0" aria-label="Travel to chamber ${room.index+1}"`:''}><path d="M-26-20H26V20H-26Z M-18-12H18V12H-18Z" fill-rule="evenodd"/><text y="5">${room.index+1}</text>${clickable?'<path class="route-arrow" d="M-7 31H7L0 41Z"/>':''}</g>`;}).join('');
    const marker=raidMarker(layout,geo);
    const exit=`<g class="raid-map-exit" transform="translate(${outside.x} ${outside.y})"><path d="M0-24 18 0 0 24-18 0Z"/><circle r="7"/></g>`;
    const finalCorridor=window.BlackstoneRooms.getCorridor(layout,layout.exitPortal?.corridor);let finalPortal='';
    if(finalCorridor?.discovered){const a=geo.point(window.BlackstoneRooms.getRoom(layout,finalCorridor.from)),b=geo.point(window.BlackstoneRooms.getRoom(layout,finalCorridor.to)),t=clamp(((layout.exitPortal?.position??.5)-.34)/(5.68-.34),0,1),x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;finalPortal=`<g class="raid-map-final" transform="translate(${x} ${y})"><path d="M0-14 11 0 0 14-11 0Z"/><circle r="4"/></g>`;}
    const fogCount=layout.rooms.filter(room=>!room.discovered).length;
    return `<svg class="raid-map-svg" viewBox="${geo.minX} ${geo.minY} ${geo.width} ${geo.height}" role="img" aria-label="Explored chambers and corridors"><g class="raid-map-grid"><path d="M${geo.minX} 0H${geo.minX+geo.width}M0 ${geo.minY}V${geo.minY+geo.height}"/></g><g>${entryLine}${lines}${exit}${finalPortal}${rooms}</g><g class="raid-map-party" data-map-party transform="translate(${marker.x} ${marker.y})"><circle class="party-pulse" r="22"/><circle class="party-ring" r="15"/><path d="M0-13 10 7 0 13-10 7Z"/><circle class="party-core" cy="4" r="3"/></g>${fogCount?`<text class="raid-map-unknown" x="${geo.minX+18}" y="${geo.minY+28}">${fogCount} UNSURVEYED</text>`:''}</svg>`;
  }
  function updateRaidMapMarkers() {
    const layout=inventory.run?.raidLayout;if(!layout)return;const geo=raidMapGeometry(layout),marker=raidMarker(layout,geo);
    document.querySelectorAll('[data-map-party]').forEach(node=>node.setAttribute('transform',`translate(${marker.x} ${marker.y})`));
  }
  function openLocationMap(selectRoute=false) {
    if(hubLoading||mission?.entering||mapOpen)return;
    mapOpen=true;keys.clear();
    const dialog=document.createElement('dialog');dialog.className='location-map-dialog';
    dialog.setAttribute('aria-label','Location Map');
    dialog.innerHTML=`<header><div><div class="tag">BLACKSTONE SURVEY</div><h2>${selectRoute?'Choose a passage':'Location Map'}</h2></div>${button('Close','map-close',{small:true})}</header><div class="raid-map-board ${selectRoute?'route-selection':''}">${renderRaidMap({selectRoute})}</div><footer><span><i class="legend-party"></i>Expedition</span><span><i class="legend-room"></i>Explored</span><span><i class="legend-scouted"></i>Revealed</span>${selectRoute?'<strong>Select an adjacent chamber</strong>':'<strong>Fog conceals the remaining fortress</strong>'}</footer>`;
    dialog.addEventListener('cancel',event=>{event.preventDefault();closeLocationMap();});
    app.append(dialog);
    dialog.querySelectorAll('[data-action^="map-route-"]').forEach(route=>{
      const choose=event=>{event.preventDefault();event.stopPropagation();chooseRaidRoute(route.dataset.action.slice(10));};
      route.addEventListener('click',choose);
      route.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){choose(event);}});
    });
    dialog.showModal();
  }
  function closeLocationMap() {
    const dialog=app.querySelector('.location-map-dialog');dialog?.close();dialog?.remove();mapOpen=false;keys.clear();
  }
  function chooseRaidRoute(corridorId) {
    const layout=window.BlackstoneRooms.ensureRun(inventory.run),roomId=layout.current;
    if(!roomId?.startsWith('room-'))return;
    const corridor=window.BlackstoneRooms.getCorridor(layout,corridorId),destination=window.BlackstoneRooms.otherRoom(corridor,roomId);
    if(!corridor||!destination||(layout.connections[roomId]||[]).every(edge=>edge.corridor!==corridorId))return;
    corridor.discovered=true;layout.current=corridor.id;layout.currentCorridor=corridor.id;layout.corridorFrom=roomId;layout.corridorTo=destination;
    inventory.run.progress=window.BlackstoneRooms.roomAccess(layout,corridor,roomId)??.44;
    inventory.save();closeLocationMap();
    const state=mission;if(state)state.entering=true;playEffect('teleportOut');document.querySelector('#missionFade')?.classList.add('active');
    setTimeout(()=>{if(page!=='mission')return;missionArea='corridor';mission=null;renderMission();playEffect('teleportIn');},650);
  }
  function openCampMenu(){
    const run=inventory.run,roomId=run?.raidLayout?.current;if(missionArea!=='room'||!run||run.events[`camp:${roomId}`]||document.querySelector('.camp-dialog'))return;
    keys.clear();const cost=run.party.filter(hero=>hero.hp>0).reduce((sum,hero)=>sum+(hero.food>0?1:0),0),canRest=inventory.count('ration')>=cost;
    const dialog=document.createElement('dialog');dialog.className='options-dialog camp-dialog';
    dialog.innerHTML=`<div class="tag">CHAMBER REST</div><h2>Make Camp</h2><p>Secure this chamber and spend ${cost} ration${cost===1?'':'s'}. Survivors recover 20% Health and 10 Morale. Each chamber can be used once.</p><div class="camp-party">${run.party.filter(hero=>hero.hp>0).map(hero=>`<span>${window.GameHUD.face(hero)}<b>${escapeText(hero.name)}</b><small>${hero.hp}/${hero.maxHp} HP · ${hero.morale??100}/${hero.maxMorale||100} Morale</small></span>`).join('')}</div>${!canRest?'<p class="camp-warning">Not enough rations.</p>':''}<div class="dialog-actions">${button('Cancel','camp-close',{small:true})}${button(`Rest · ${cost} ration${cost===1?'':'s'}`,'camp-rest',{small:true,disabled:!canRest})}</div>`;
    dialog.addEventListener('close',()=>dialog.remove());dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close();});app.append(dialog);dialog.showModal();
  }
  function restInRoom(){
    const run=inventory.run,roomId=run?.raidLayout?.current,cost=run?.party.filter(hero=>hero.hp>0).reduce((sum,hero)=>sum+(hero.food>0?1:0),0)??0;
    if(missionArea!=='room'||!run||run.events[`camp:${roomId}`]||inventory.count('ration')<cost)return;
    if(cost)inventory.remove('ration',cost);for(const hero of run.party.filter(hero=>hero.hp>0)){hero.hp=Math.min(hero.maxHp,hero.hp+Math.ceil(hero.maxHp*.2));hero.morale=Math.min(hero.maxMorale||100,(hero.morale??100)+10);hero.stunned=null;}
    run.events[`camp:${roomId}`]=true;inventory.save();document.querySelector('.camp-dialog')?.close();updateResourceHUD();
  }
  function openInventory(combat=false,refresh) {
    if(hubLoading||mission?.entering)return;
    keys.clear();supplies.open({combat,onClose:()=>{keys.clear();inventory.save();updateResourceHUD();refresh?.();}});
  }
  function showLoot() {
    if(!inventory.run?.pendingLoot.length)return;
    keys.clear();supplies.open({mode:'loot',onClose:()=>{keys.clear();updateResourceHUD();}});
  }
  function expeditionEvent(title,text,actions) {
    keys.clear();supplies.open({mode:'event',event:{title,text,actions},onClose:()=>{keys.clear();updateResourceHUD();}});
  }
  function exhaustParty(fraction) {
    for(const hero of inventory.run.party)if(hero.hp>0)hero.hp=Math.max(1,hero.hp-Math.ceil(hero.maxHp*fraction));
    inventory.save();updateResourceHUD();
  }
  function payPortalEnergy() {
    const run=inventory.run;
    if(run.energy>=10){run.energy-=10;inventory.save();return true;}
    expeditionEvent('Portal Power Depleted','The return portal needs 10 energy. Use a power cell, or hand-charge the emergency converter (10% maximum HP per crew member, minimum 1 HP remains).',[
      {label:'Use Power Cell',get disabled(){return !inventory.count('cell');},run:()=>{inventory.use('cell');updateResourceHUD();}},
      {label:'Hand-charge Converter',run:()=>{run.energy=Math.min(100,run.energy+10);exhaustParty(.1);}},
      {label:'Back',run:()=>{}}
    ]);return false;
  }
  function updateExpedition(state,unit) {
    const run=inventory.run;if(!run||run.defeated)return;
    window.ExpeditionSpeech.traitBark(run.party,(ally,loss,breaks)=>{
      window.ExpeditionSpeech.moraleEffect(ally,loss,breaks,()=>{inventory.save();updateResourceHUD();});
      inventory.save();updateResourceHUD();
    });
    if(!state.nextBark){state.nextBark=performance.now()+60000;}else if(performance.now()>state.nextBark){window.ExpeditionSpeech.say(run.party.find(u=>u.hp>0),'neutral');state.nextBark=performance.now()+60000;}
    const progress=state.x/unit,segment=Math.floor(Math.max(0,progress-.48)/.4);
    if(segment>run.visited){
      const armour=run.party.filter(u=>u.hp>0).reduce((n,u)=>n+(u.energy||0),0);
      run.energy=Math.max(0,run.energy-(segment-run.visited)*(6+armour));
      run.visited=segment;run.progress=progress;inventory.save();updateResourceHUD();
    }
    // Save position periodically; walking back never generates additional cargo.
    if(!state.lastCheckpoint||performance.now()-state.lastCheckpoint>1000){run.progress=progress;inventory.save();state.lastCheckpoint=performance.now();}
    for(const [id,position] of [['meal1',2.85],['meal2',5.15]]){
      if(progress<position||run.events[id])continue;
      const finish=()=>{run.events[id]=true;inventory.save();updateResourceHUD();};
      if(id.startsWith('meal')){
        const need=inventory.foodDemand();
        if(!need){inventory.feed(true);finish();return;}
        expeditionEvent(supplies.t('foodEvent'),`${need} ration(s) required for this crew. Space Marines eat at one quarter of the standard rate. ${supplies.t('hungerCost')}`,[
          {label:`Distribute ${need} ration(s)`,get disabled(){return inventory.count('ration')<need;},run:()=>{if(inventory.feed(true))finish();}},
          {label:supplies.t('hungry'),run:()=>{inventory.feed(false);finish();}}
        ]);
      }
      return;
    }
  }

  function mountPassageProps(viewport) {
    const layer=document.createElement('div');layer.id='passageProps';layer.className='passage-props';
    layer.innerHTML=['obstacle','cache'].map(id=>`<div class="passage-prop ${id}" data-prop="${id}"><img src="corridor/props/${id === 'obstacle' ? 'obstacle-blackstone' : id}.png" alt="${supplies.t(id)}"><button class="prop-interact" aria-label="${supplies.t(id==='obstacle'?'breakIcon':'openIcon')}" title="${supplies.t(id==='obstacle'?'breakIcon':'openIcon')}"><svg viewBox="0 0 40 40" aria-hidden="true">${id==='obstacle'?'<path d="M8 31L24 12l5 4L13 36z M17 9l6-6 13 10-6 7z"/>':'<path d="M24 5a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M19 19L5 33l3 3 5-5 4 2 3-3-3-3 6-6 M25 10h1"/>'}</svg></button></div>`).join('');
    viewport.append(layer);
    layer.querySelectorAll('[data-prop]').forEach(prop=>{
      const button=prop.querySelector('button');
      button.addEventListener('click',()=>interactPassageProp(prop));
    });
  }
  function interactPassageProp(prop) {
    const run=inventory.run,id=prop.dataset.prop;
    if(!run||run.events[id]||!prop.classList.contains('near')||supplies.isOpen||optionsOpen||mapOpen||mission?.combat||hubLoading)return;
    const finish=()=>{run.events[id]=true;inventory.save();updateResourceHUD();};
    if(id==='obstacle')expeditionEvent(supplies.t('obstacle'),supplies.t('obstacleHint'),[
      {label:supplies.t('breach'),get disabled(){return !inventory.count('cutter');},run:()=>{if(inventory.remove('cutter',1)){playEffect('breachExplode');finish();}}},
      {label:supplies.t('force'),run:()=>{exhaustParty(.15);finish();}},
      {label:supplies.t('skip'),run:()=>{}}
    ]);
    else {
      const loot=()=>{playEffect('chestOpen');inventory.queueLoot([{id:'credits',qty:450},{id:'relic',qty:1}]);finish();showLoot();};
      expeditionEvent(supplies.t('cache'),supplies.t('cacheHint'),[
        {label:supplies.t('unlock'),get disabled(){return !inventory.count('key');},run:()=>{if(inventory.remove('key',1))loot();}},
        {label:supplies.t('forceCache'),get disabled(){return run.energy<10;},run:()=>{if(run.energy>=10){run.energy-=10;loot();}}},
        {label:supplies.t('skip'),run:()=>{}}
      ]);
    }
  }
  function positionPassageProps(state,unit) {
    for(const [id,pos] of [['obstacle',3.55],['cache',4.3]]){
      const prop=state.viewport.querySelector(`[data-prop="${id}"]`);if(!prop)continue;
      const done=!!inventory.run?.events[id];prop.hidden=done;
      prop.style.left=(unit*pos-state.camera)+'px';
      const near=!done&&!state.combat&&Math.abs(state.x/unit-pos)<.7;
      prop.classList.toggle('near',near);prop.querySelector('button').disabled=!near;
    }
  }

  function enterRoomFromPlatform(control){
    const state=mission,layout=inventory.run?.raidLayout,roomId=control?.dataset.roomId,position=Number(control?.dataset.worldPosition);
    if(!state||!layout||!roomId||state.entering||state.combat||hubLoading||optionsOpen||mapOpen||supplies.isOpen)return;
    const activeCorridor=window.BlackstoneRooms.getCorridor(layout,layout.currentCorridor||layout.current);
    if(!activeCorridor||window.BlackstoneRooms.roomAccess(layout,activeCorridor,roomId)===null)return;
    keys.clear();state.entering=true;document.querySelector('#missionFade')?.classList.add('active');
    setTimeout(()=>{if(mission!==state)return;activeCorridor.visited=true;layout.current=roomId;window.BlackstoneRooms.revealRoom(layout,roomId);inventory.run.progress=position;inventory.save();missionArea='room';mission=null;renderMission();},500);
  }

  async function startRaidRoom(room){
    const viewport=document.querySelector('#mission'),canvas=document.querySelector('#hero'),ctx=canvas.getContext('2d');
    mission={viewport,canvas,ctx,room,roomX:inventory.run?.roomPosition??.34,facing:1,animation:'idle',animationTime:0,lastTime:0,entering:false};
    keys.clear();
    await Promise.all([sororitasIdleAtlas,idleAtlas,...viewport.querySelectorAll('img')].map(image=>image.decode?.().catch(()=>{})));
    if(!mission||mission.canvas!==canvas)return;
    function tick(now){
      const state=mission;if(!state||state.canvas!==canvas||page!=='mission'||missionArea!=='room')return;
      const dt=state.lastTime?Math.min(.05,(now-state.lastTime)/1000):0;state.lastTime=now;
      const width=viewport.clientWidth,unit=viewport.clientHeight;
      const blocked=hubLoading||optionsOpen||mapOpen||supplies.isOpen||document.querySelector('dialog[open]');
      const direction=blocked?0:Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
      if(!state.entering&&direction){state.roomX=clamp(state.roomX+direction*.24*dt,.035,.965);state.facing=direction;inventory.run.roomPosition=state.roomX;}
      const animation=direction?'walk':'idle';if(state.animation!==animation){state.animation=animation;state.animationTime=animation==='walk'?.18:0;}else state.animationTime+=dt;
      const dpr=Math.min(devicePixelRatio||1,1.5);if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(unit*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(unit*dpr);canvas.style.width=width+'px';canvas.style.height=unit+'px';}
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,unit);
      const isWalk=state.animation==='walk',size=Math.min(unit*.48,410),footY=unit*(846/1024),screenX=width*state.roomX;
      for(const [crewIndex,hero] of inventory.run.party.filter(h=>h.hp>0).sort((a,b)=>a.rank-b.rank).entries()){
        const sister=hero.classId==='sororitas',image=sister?(isWalk?sororitasWalkAtlas:sororitasIdleAtlas):(isWalk?walkAtlas:idleAtlas);if(!image.complete||!image.naturalWidth)continue;
        const count=sister?(isWalk?27:121):(isWalk?24:129),fps=sister?18:(isWalk?15.2145:17.28),frame=Math.floor(state.animationTime*fps)%count,sourceX=(frame%12)*GAME_ATLAS_CELL,sourceY=Math.floor(frame/12)*GAME_ATLAS_CELL;
        const heroX=screenX-crewIndex*unit*.16*state.facing;window.ExpeditionSpeech?.position(hero.id,heroX,footY-size*.69);
        ctx.save();ctx.translate(heroX,footY);ctx.scale(state.facing,1);
        if(sister){const scale=isWalk?331/502:331/507,side=size*scale,anchor=isWalk?268.5:285.5,foot=isWalk?505:511;ctx.drawImage(image,sourceX,sourceY,GAME_ATLAS_CELL,GAME_ATLAS_CELL,-anchor*side/512,-foot*side/512,side,side);}
        else if(isWalk)ctx.drawImage(image,sourceX,sourceY,GAME_ATLAS_CELL,GAME_ATLAS_CELL,-size/2,-size*(468/512),size,size);
        else window.drawRanger(ctx,image,'idle',state.animationTime,-size/2,-size*(468/512),size);
        ctx.restore();
      }
      if(!state.lastMapPaint||now-state.lastMapPaint>90){updateRaidMapMarkers();state.lastMapPaint=now;}
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  async function startMission() {
    const viewport = document.querySelector('#mission');
    const canvas = document.querySelector('#hero');
    const ctx = canvas.getContext('2d');
    const layout=window.BlackstoneRooms.ensureRun(inventory.run);
    const activeCorridor=window.BlackstoneRooms.getCorridor(layout,layout.currentCorridor||layout.current)||window.BlackstoneRooms.getCorridor(layout,'corridor-entry');
    layout.current=activeCorridor.id;layout.currentCorridor=activeCorridor.id;
    viewport.classList.toggle('entry-corridor',activeCorridor.id===layout.startPortal?.corridor);
    viewport.classList.toggle('final-corridor',activeCorridor.id===layout.exitPortal?.corridor);
    if(activeCorridor.entry){layout.corridorFrom=null;layout.corridorTo=layout.entry;}
    const sceneFrom=layout.corridorFrom,theSceneTo=layout.corridorTo||activeCorridor.to;
    const encounterKey=`encounter:${activeCorridor.id}`,hasEncounter=activeCorridor.entry?!!layout.entryEncounter:!!activeCorridor.hasEncounter;
    const encounterPosition=activeCorridor.entry?(layout.entryEncounterPosition??2.8):(activeCorridor.encounterPosition??2.8);
    const startAccess=sceneFrom?window.BlackstoneRooms.roomAccess(layout,activeCorridor,sceneFrom):(activeCorridor.entry ? .34 : activeCorridor.fromAccess);
    const destinationAccess=theSceneTo?window.BlackstoneRooms.roomAccess(layout,activeCorridor,theSceneTo):activeCorridor.toAccess;
    const corridorDirection=(destinationAccess??5.2)>=(startAccess??.7)?1:-1;
    const initialX=viewport.clientHeight*(inventory.run?.progress??.48);
    const initialCamera=clamp(initialX-viewport.clientWidth*.38,0,Math.max(0,viewport.clientHeight*6-viewport.clientWidth));
    mission = {viewport, canvas, ctx, encounterKey,hasEncounter,encounterPosition,encounterDirection:corridorDirection,encounterDone:!!inventory.run?.events?.[encounterKey],finalPortal:activeCorridor.id===layout.exitPortal?.corridor, x:initialX, facing:corridorDirection, camera:initialCamera, animation:'idle', animationTime:0, lastTime:0, entering:false};
    const objective=document.createElement('div');objective.className='mission-objective';viewport.append(objective);
    const updateObjective=()=>{objective.innerHTML=`<small>MISSION OBJECTIVE</small><strong>${inventory.run?.exitFound?'EXIT PORTAL LOCATED':'FIND THE EXIT PORTAL'}</strong>`;};updateObjective();
    keys.clear();
    mountPassageProps(viewport);
    const corridorControls=[];
    const addRoomPlatform=(roomId,position)=>{
      if(!roomId||position===null)return;
      const room=window.BlackstoneRooms.getRoom(layout,roomId),control=document.createElement('button');
      control.className='corridor-access';control.dataset.action='enter-room-platform';control.dataset.roomId=roomId;control.dataset.worldPosition=position;
      control.innerHTML='<img src="corridor/props/blackstone-ferrofluid-lift.png" alt="">';
      control.title=`Take the ferrofluid-controlled levitating platform to chamber ${room.index+1}`;control.setAttribute('aria-label',control.title);
      viewport.append(control);corridorControls.push(control);
    };
    addRoomPlatform(sceneFrom,window.BlackstoneRooms.roomAccess(layout,activeCorridor,sceneFrom));
    addRoomPlatform(theSceneTo,window.BlackstoneRooms.roomAccess(layout,activeCorridor,theSceneTo));
    addRoomPlatform(activeCorridor.branchRoom,activeCorridor.branchAccess??null);
    const addPortal=(kind,position)=>{
      const portal=document.createElement('button');portal.className=`portal-exit true-portal ${kind}-portal`;portal.dataset.worldPosition=position;
      const final=kind==='final';portal.innerHTML=window.CombatUI.icon(final?'portal':'exit');portal.title=final?'Enter the onward portal and complete the raid':'Return through the starting portal · 10 energy';portal.setAttribute('aria-label',portal.title);portal.hidden=true;
      portal.addEventListener('click',()=>{const state=mission;if(!state||portal.disabled||state.entering||state.combat||hubLoading||optionsOpen||mapOpen||supplies.isOpen)return;keys.clear();if(!final&&!payPortalEnergy())return;state.entering=true;if(final){inventory.run.exitFound=true;inventory.run.completed=true;}playEffect('teleportOut');document.querySelector('#missionFade').classList.add('active');setTimeout(()=>{if(mission===state)go('hub');},650);});
      viewport.append(portal);corridorControls.push(portal);
    };
    if(activeCorridor.id===layout.startPortal?.corridor)addPortal('start',layout.startPortal.position);
    if(activeCorridor.id===layout.exitPortal?.corridor)addPortal('final',layout.exitPortal.position);
    const loadingState=mission;
    const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const backdropSources = ['corridor/repeat/blackstone_bg10_deepplanes_c_1024.png',
      'corridor/atmosphere/blackstone_bg30_fog_a_1024.png',
      'corridor/playfield/blackstone_playfield_floor_a_1024.png'];
    await Promise.all([
      ...[walkAtlas,idleAtlas,sororitasWalkAtlas,sororitasIdleAtlas,...viewport.querySelectorAll('img')].map(image=>image.decode().catch(()=>{})),
      ...backdropSources.map(loadHubImage)
    ]);
    if(mission!==loadingState)return;
    function tick(now) {
      const state = mission;
      if (!state || state.canvas !== canvas || page !== 'mission') return;
      const dt = state.lastTime ? Math.min(.05, (now-state.lastTime)/1000) : 0;
      state.lastTime = now;
      const unit = viewport.clientHeight;
      const width = viewport.clientWidth;
      if(state.finalPortal&&!inventory.run.exitFound){const portalX=unit*(layout.exitPortal?.position??5.58)-state.camera;if(portalX>-unit*.2&&portalX<width+unit*.05){inventory.run.exitFound=true;inventory.save();updateObjective();}}
      const worldWidth = unit * 6;
      const maxCamera = Math.max(0, worldWidth-width);
      const direction = (hubLoading || optionsOpen || mapOpen || supplies.isOpen || document.querySelector('dialog[open]') || state.combat) ? 0 : Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
      if (!state.entering && direction) {
        state.x = clamp(state.x + direction * unit * .27 * dt, unit*.29, unit*5.75);
        if(!inventory.run?.events.obstacle)state.x=Math.min(state.x,unit*2.98);
        state.facing = direction;
      }
      if (!hubLoading && !state.combat && !optionsOpen && !mapOpen && !supplies.isOpen && !state.entering) updateExpedition(state,unit);
      if(!state.lastMapPaint||now-state.lastMapPaint>90){updateRaidMapMarkers();state.lastMapPaint=now;}
      const animation = !state.entering && direction ? 'walk' : 'idle';
      if (state.animation !== animation) { state.animation = animation; state.animationTime = animation === 'walk' ? .18 : 0; }
      else state.animationTime += dt;
      const battleCenter=state.x+state.encounterDirection*unit*.47;
      const targetCamera = clamp(state.combat ? battleCenter-width*.5 : state.x-width*.38, 0, maxCamera);
      state.camera += (targetCamera-state.camera) * Math.min(1,dt*8);
      if(Math.abs(targetCamera-state.camera)<.05)state.camera=targetCamera;
      const reduced=reducedMotion;
      const cameraGoal=state.combat&&!state.stressFocus&&!reduced?1.065:1;
      state.battleZoom=(state.battleZoom??1)+(cameraGoal-(state.battleZoom??1))*(1-Math.exp(-dt*4));
      const viewGoal=state.combat&&!state.stressFocus&&state.viewSide&&!reduced?(state.viewSide==='party'?1:-1):0;
      state.viewBias=(state.viewBias||0)+(viewGoal-(state.viewBias||0))*(1-Math.exp(-dt*6));
      positionPassageProps(state,unit);
      const worldKey=Math.round(state.camera*10)/10;
      if(state.worldKey!==worldKey){state.worldKey=worldKey;
        document.querySelector('#deep').style.backgroundPosition = `${-state.camera*.10}px center`;
        document.querySelector('#structures').style.transform = `translateX(${-state.camera*.14}px)`;
        document.querySelector('#fog').style.backgroundPosition = `${-state.camera*.32}px center`;
        document.querySelector('#corridorColumns').style.transform = `translateX(${-state.camera*.92}px)`;
        document.querySelector('#midground').style.transform = `translateX(${-state.camera*.55}px)`;
        for (const id of ['playfield','endcaps','foreground']) document.getElementById(id).style.transform = `translateX(${-state.camera}px)`;
      }
      const consolePanel=viewport.querySelector('.combat-console');
      const consoleTop=consolePanel?consolePanel.getBoundingClientRect().top-viewport.getBoundingClientRect().top:unit;
      state.floorLift=state.combat?Math.min(0,consoleTop-30-unit*846/1024):0;
      const environmentBlur=(!reduced&&!state.stressFocus?(state.actionFocus||0):0)*3;
      const environmentKey=[width,unit,state.battleZoom,state.actionFocus||0,state.viewBias,state.floorLift||0,environmentBlur].map(value=>Math.round(value*100)/100).join(':');
      if(state.environmentKey!==environmentKey){state.environmentKey=environmentKey;
        const props=document.getElementById('passageProps');if(props){props.style.filter=environmentBlur>.01?`blur(${environmentBlur}px)`:'none';props.style.transformOrigin=`${width*.5}px ${unit*846/1024}px`;props.style.scale=String(state.battleZoom+(state.actionFocus||0)*.07);props.style.translate=`${state.viewBias*unit*.028}px ${state.floorLift||0}px`;}
        // Screen-space transforms preserve the floor anchor; depth layers travel at different rates.
        for(const [id,depth] of [['deep',.12],['distantLightning',.16],['structures',.3],['fog',.4],['midground',.6],['corridorColumns',.92],['playfield',1],['endcaps',1],['foreground',1.4]]){
          const layer=document.getElementById(id);
          layer.style.transformOrigin=`${width*.5}px ${unit*846/1024}px`;
          layer.style.filter=environmentBlur>.01?`blur(${environmentBlur}px)`:'none';
          layer.style.scale=String(1+(state.battleZoom-1)*Math.min(depth,1)+(state.actionFocus||0)*.07*Math.min(depth,1));
          layer.style.translate=`${state.viewBias*unit*.028*depth}px ${state.floorLift||0}px`;
        }
      }
      const dpr = Math.min(devicePixelRatio || 1,1.5);
      if (canvas.width !== Math.round(width*dpr) || canvas.height !== Math.round(unit*dpr)) {
        canvas.width = Math.round(width*dpr);
        canvas.height = Math.round(unit*dpr);
        canvas.style.width = width+'px';
        canvas.style.height = unit+'px';
      }
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.clearRect(0,0,width,unit);
      const isWalk = state.animation === 'walk';
      const size = Math.min(unit*.48,410);
      const footY = unit*(846/1024);
      const screenX = state.x-state.camera;
      if(!state.combat)window.ExpeditionSpeech?.position('ranger',width*.5+(screenX-width*.5)*state.battleZoom,footY-size*.69*state.battleZoom);
      if (!state.combat) {
        for(const [crewIndex,hero] of inventory.run.party.filter(h=>h.hp>0).sort((a,b)=>a.rank-b.rank).entries()){
        const sister=hero.classId==='sororitas',image=sister?(isWalk?sororitasWalkAtlas:sororitasIdleAtlas):(isWalk?walkAtlas:idleAtlas);if(!image.complete||!image.naturalWidth)continue;
        const count=sister?(isWalk?27:121):(isWalk?24:129),fps=sister?18:(isWalk?15.2145:17.28),frame=Math.floor(state.animationTime*fps)%count,sourceX=(frame%12)*GAME_ATLAS_CELL,sourceY=Math.floor(frame/12)*GAME_ATLAS_CELL;
        const heroScreenX=screenX-crewIndex*unit*.16*state.facing;
        window.ExpeditionSpeech?.position(hero.id,width*.5+(heroScreenX-width*.5)*state.battleZoom,footY-size*.69*state.battleZoom);
        ctx.save();
        ctx.translate(width*.5+(heroScreenX-width*.5)*state.battleZoom,footY);
        ctx.scale(state.battleZoom,state.battleZoom);
        ctx.scale(state.facing,1);
        if(sister){const scale=isWalk?331/502:331/507,side=size*scale,anchor=isWalk?268.5:285.5,foot=isWalk?505:511;ctx.drawImage(image,sourceX,sourceY,GAME_ATLAS_CELL,GAME_ATLAS_CELL,-anchor*side/512,-foot*side/512,side,side);}
        else if(isWalk)ctx.drawImage(image,sourceX,sourceY,GAME_ATLAS_CELL,GAME_ATLAS_CELL,-size/2,-size*(468/512),size,size);
        else window.drawRanger(ctx,image,'idle',state.animationTime,-size/2,-size*(468/512),size);
        ctx.restore();
        }
      }
      const encounterReached=state.encounterDirection>0?state.x/unit>=state.encounterPosition:state.x/unit<=state.encounterPosition;
      if (!hubLoading && !mapOpen && !supplies.isOpen && !inventory.run?.defeated && !state.combat && state.hasEncounter && !state.encounterDone && encounterReached) {
        state.combat = true;
        keys.clear();
        setMusic();
        state.stopCombat = window.startBlackstoneBattle({
          party:inventory.run.party,
          snapshot:inventory.run.battles?.[state.encounterKey],
          onCheckpoint:snapshot=>{if(inventory.run){inventory.run.battles||={};inventory.run.battles[state.encounterKey]=snapshot;inventory.save();}},
          getLayout:()=>({unit:viewport.clientHeight,camera:state.camera,heroX:state.x,encounterX:state.x,travelDirection:state.encounterDirection,size:Math.min(viewport.clientHeight*.48,410),zoom:state.battleZoom,bias:state.viewBias,center:viewport.clientWidth*.5,width:viewport.clientWidth,footY:viewport.clientHeight*846/1024+(state.floorLift||0)}),
          onCameraSide:side=>{state.viewSide=side;},
          onStressFocus:id=>{state.stressFocus=id;},
          onBreakdown:unit=>playEffect(unit?.classId==='sororitas'?'sororitasStress':'psychologicalBreakdown'),
          onActionFocus:amount=>{state.actionFocus=amount;},
          onOptions:openOptions,
          onFlee:requestFleeExpedition,
          onInventory:refresh=>openInventory(true,()=>refresh(inventory.run?.party||[])),
          onPartyChange:party=>{if(inventory.run){inventory.run.party=party;inventory.recordDeaths(party);syncCrew();if(party.every(u=>u.hp<=0))inventory.run.defeated=true;inventory.save();updateResourceHUD();}},
          onDefeat:()=>{state.defeated=true;inventory.run.defeated=true;inventory.save();setMusic();},
          onVictory:()=>{state.victoryCue=true;inventory.run.events[state.encounterKey]=true;if(inventory.run.battles)delete inventory.run.battles[state.encounterKey];inventory.queueLoot([{id:'credits',qty:650},{id:'salvage',qty:4}]);setMusic();},
          onAttack:(unit,skill)=>{
            if(unit.classId==='sororitas'&&skill==='flamer')playEffect('sororitasFlamer');
            else if(unit.classId==='sororitas'&&skill==='pray')playEffect('sororitasPray');
            else if(unit.side==='party' && ['shot','aim'].includes(skill))playEffect('rangerShoot');
            else if(unit.id==='raider')playEffect('hormagauntAttack');
            else if(unit.id==='gunner')playEffect('termagantShoot');
            else if(unit.id==='psyker')playEffect('psychicAttack');
          },
          onHit:(unit,lethal)=>{
            if(unit.classId==='sororitas')playEffect(lethal?'sororitasDeath':(++sororitasPainVariant%2?'sororitasPain1':'sororitasPain2'));
            else if(unit.side==='party')playEffect(lethal?'rangerDeath':'rangerHit');
            else if(unit.side==='enemy')playEffect(lethal?'tyranidDeath':(++tyranidHitVariant%2?'tyranidHit1':'tyranidHit2'));
          },
          onFinish:result => {
            state.combat = false; state.animationTime = 0; state.encounterDone = true; keys.clear(); setMusic();
            if (result === 'defeat') go('hub');
            else { inventory.run.events[state.encounterKey]=true;inventory.save();updateResourceHUD();showLoot(); }
          }
        });
      }
      corridorControls.forEach(control=>{
        const position=Number(control.dataset.worldPosition),worldX=unit*position-state.camera,isPlatform=control.classList.contains('corridor-access');
        control.hidden=state.combat||state.entering||hubLoading;
        control.disabled=optionsOpen||mapOpen||supplies.isOpen;
        control.style.left=(isPlatform?worldX:clamp(worldX,44,width-44))+'px';
        control.style.top=(unit*(isPlatform ? .826 : .59))+'px';
      });
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  render();
  const data = window.BLACKSTONE_HUB_SCENE;
  if (data && [1, 2].includes(data.version) && data.width === 1672 && data.height === 941 && Array.isArray(data.layers)) {
    hubScene = data;
    if (page === 'hub') renderHub();
  } else {
    hubError = true;
    if (page === 'hub') renderHub();
  }
})();



