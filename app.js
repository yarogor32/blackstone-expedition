(() => {
  'use strict';

  const app = document.querySelector('#app');
  const audio = document.querySelector('#music');
  const supplies = window.Supplies;
  const inventory = supplies.inventory;
  const expeditionCrew = [{id:'ranger',name:'Aeldari Ranger',rank:3,...window.EXPEDITION_METABOLISM.ranger}];
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
    {name:'Aeldari Ranger', file:'aeldari-ranger', role:'Mobile ranged fighter', positions:'2–4', moves:['Shuriken Catapult — targets 2–4','Swift Step — reposition and gain defense','Foresight — helps an ally evade the next hit'], trait:'Needs food at camp. Severe injuries require treatment at base.', rest:'Rogue Trader Yacht', available:true},
    {name:'Space Marine', file:'space-marine', role:'Frontline / Guard'},
    {name:'Rogue Trader', file:'rogue-trader', role:'Support / Versatile'},
    {name:'Drukhari Wych', file:'drukhari-wych', role:'Arena gladiator / Evasion'}
  ];
  const buildingOrder = ['temple','workshop','bar','market','ship','docks'];
  const buildingLevel = Object.fromEntries(buildingOrder.map(name => [name,Math.max(1,Math.min(3,inventory.state.buildingLevels[name]||1))]));
  const effectFiles = {
    breachExplode:'BreachExplode.wav', chestOpen:'Chest_open.wav', purchase:'Purchase.wav',
    buildingUpgrade:"BuildingUpgrade.mp3",
    rangerHit:"Ranger_GotHit.wav", rangerDeath:'Ranger_Death2.wav', rangerShoot:'Ranger_Shoot.wav',
    tyranidDeath:'Tyranyd_Death.wav', tyranidHit1:'Tyranyd_GotHit.wav', tyranidHit2:'Tyranyd_GotHit2.wav',
    termagantShoot:'Termogant_shoot.wav', hormagauntAttack:'Hormagaunt_Attacks.wav',
    hover:'Mouse-hover.mp3', teleportOut:'Teleport - out.mp3', teleportIn:'Teleport-in.mp3',
    barEnter:'Bar - enter.mp3', barExit:'Bar - exit.mp3', docksEnter:'Docks - Enter.mp3',
    templeEnter:'Shrine - Enter.mp3', shipEnter:'Yacht - enter.mp3',
    marketEnter:'Market - enter.mp3', workshopEnter:'Workshop-Enter.mp3'
  };
  const combatEffectNames=['rangerHit','rangerDeath','rangerShoot','tyranidDeath','tyranidHit1','tyranidHit2','termagantShoot','hormagauntAttack'];
  let tyranidHitVariant=0;
  const effectVolume = {hover:.65};
  const effects = Object.fromEntries(Object.entries(effectFiles).map(([name,file]) => {
    const sound = new Audio(`sfx/${encodeURIComponent(file)}`);
    sound.preload = 'auto';
    sound.dataset.effect = name;
    document.body.append(sound);
    return [name,sound];
  }));
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
    page = 'mission';
    render();
    await missionReady;
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
    if(destination==='mission'&&!inventory.run&&!expeditionCrew.some(hero=>!inventory.resting(hero.id))){
      const panel=app.querySelector('.portal-panel, .building-panel');if(panel&&!panel.querySelector('.rest-warning'))panel.insertAdjacentHTML('afterbegin','<p class="rest-warning" role="alert">All crew members are resting. Cancel a rest assignment or recruit another companion before departure.</p>');return;
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
      expeditionReport = inventory.finish(!!mission?.defeated,{fled:!!mission?.fleeing});
    }
    if (page === 'mission' && destination !== 'mission') {
      mission?.stopCombat?.();
      combatEffectNames.forEach(name=>fadeEffect(name));
      mission = null;
      keys.clear();
    }
    if (destination === 'hub' && page !== 'hub') {
      enterHub(fromMission);
      return;
    }
    if (destination === 'mission' && page !== 'mission') {
      inventory.begin(expeditionCrew);
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

  function openOptions() {
    if (optionsOpen) return;
    optionsOpen = true;
    optionsReturnFocus = document.activeElement;
    keys.clear();
    const dialog = document.createElement('dialog');
    dialog.className = 'options-dialog';
    dialog.setAttribute('aria-labelledby', 'options-title');
    dialog.innerHTML = `<div class="tag">Blackstone Expedition</div><h2 id="options-title">Options</h2><p>Audio levels</p>${volumeControls()}<div class="options-actions">${button(soundEnabled ? 'Music On' : 'Music Off', 'options-music', {small:true})}${button('Back to Game', 'options-close', {small:true})}</div>`;
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

  function renderMenu() {
    const controls = volumeControls();
    const content = settingsOpen
      ? `<div class="settings-panel"><h2>Settings</h2><p>Sound levels</p>${controls}<nav class="menu-nav settings-nav">${button(musicLabel(),'sound')}${button('Back to Menu','settings-back')}</nav></div>`
      : `<p>Enter the fortress from Precipice. The first passage is ready to explore.</p><nav class="menu-nav">${inventory.run?button('Resume Expedition','mission'):button('Enter Precipice','hub')}${button('Settings','settings')}</nav>`;
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
      if (place && level) return `<button class="landmark hub-sprite" type="button" data-action="${place}" aria-label="${names[place]}, level ${level}" title="${names[place]}" style="${style}"><img src="${src}" alt="" style="${imageStyle}"><span>${names[place]} · Level ${level}</span></button>`;
      return `<div class="hub-sprite" style="${style}"><img src="${src}" alt="" style="${imageStyle}"></div>`;
    }).join('');
    const debris = `<div class="hub-debris-field" aria-hidden="true"><img src="hub/debris-1.png" alt=""><img src="hub/debris-2.png" alt=""><img src="hub/debris-3.png" alt=""><img src="hub/debris-1.png" alt=""><img src="hub/debris-2.png" alt=""></div>`;
    app.innerHTML = `<section class="stage hub-layout"><div class="map">${debris}${layers}<div class="map-tip">Select the Docks to enter the fortress</div></div><div class="map-label">Precipice</div>${window.GameHUD.hub(inventory,{...expeditionCrew[0],...inventory.state.heroProfiles.ranger})}${renderBaseControls()}${renderBaseStock()}</section>`;
  }

  function renderHire() {
    const hero = heroes[selectedHero];
    const roster = heroes.map((item,index) => `<button type="button" class="recruit${selectedHero === index ? ' active' : ''}${item.available ? '' : ' locked'}" data-action="hero-${index}" ${item.available ? '' : 'disabled'}><img src="portraits/${item.file}.png" alt=""><span><strong>${item.name}</strong><small>${item.role} · ${item.available ? 'Selected' : 'Coming Soon'}</small></span></button>`).join('');
    app.innerHTML = `${renderTop()}<section class="scene" style="background-image:url('backgrounds/recruitment.png')"><div class="hire-wrap"><h2>Recruit Companions</h2><p class="caption">The Aeldari Ranger is available for this mission test. Other classes are coming soon.</p><div class="party"><div class="slot">Aeldari Ranger</div><div class="slot">Coming Soon</div><div class="slot">Coming Soon</div><div class="slot">Coming Soon</div></div><div class="hire-layout"><div class="roster">${roster}</div><div class="detail"><img src="portraits/${hero.file}.png" alt="Aeldari Ranger"><div><h3>${hero.name}</h3><dl class="facts"><dt>Role</dt><dd>${hero.role}</dd><dt>Ranks</dt><dd>${hero.positions}</dd><dt>Trait</dt><dd>${hero.trait}</dd><dt>Recovery</dt><dd>${hero.rest}</dd></dl><p class="tag">Starting abilities</p><ul class="moves">${hero.moves.map(move => `<li>${move}</li>`).join('')}</ul>${button('Selected for Expedition','',{disabled:true})}</div></div></div><div class="hire-back">${button('Back to Tavern','bar',{small:true})}</div></div></section>`;
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

  function portalChoices(){return `<label class="portal-difficulty">Difficulty <select data-expedition-difficulty>${Object.keys(window.EXPEDITION_DIFFICULTIES).map(id=>`<option value="${id}" ${inventory.state.difficulty===id?'selected':''}>${supplies.t(id)}</option>`).join('')}</select><small>Fleeing loss: ${window.EXPEDITION_DIFFICULTIES[inventory.state.difficulty].retreatLoss*100}%</small></label><div class="portal-grid"><button type="button" class="portal-card available" data-action="mission"><span class="portal-mark">◇</span><strong>The First Passage</strong><small>Corridor · Enter and reach the far portal</small><em>ENTER PORTAL</em></button><div class="portal-card unavailable"><span class="portal-mark">◇</span><strong>Unknown Portal</strong><small>Coming Soon</small></div><div class="portal-card unavailable"><span class="portal-mark">◇</span><strong>Unknown Portal</strong><small>Coming Soon</small></div></div>`;}
  function renderPortals(){page='docks';renderBuilding('docks');}

  function renderMission() {
    app.innerHTML = `<section class="mission" id="mission"><div id="deep"></div><div id="structures" class="world"><img class="module span" src="corridor/modules/bg20/blackstone_bg20_span_b.png" alt=""><img class="module ribs" src="corridor/modules/bg20/blackstone_bg20_ribs_d.png" alt=""><img class="module pylon" src="corridor/modules/bg20/blackstone_bg20_pylon_a.png" alt=""><img class="module aperture" src="corridor/modules/bg20/blackstone_bg20_aperture_c.png" alt=""></div><div id="fog"></div><div id="midground" class="world"><img class="module buttress" src="corridor/modules/bg40/blackstone_bg40_buttress_a.png" alt=""><img class="module overhang" src="corridor/modules/bg40/blackstone_bg40_overhang_b.png" alt=""><img class="module wallnode" src="corridor/modules/bg40/blackstone_bg40_wallnode_c.png" alt=""></div><div id="playfield" class="world"></div><div id="endcaps" class="world"><img class="cap cap-left" src="corridor/corridor_caps/blackstone_corridor_cap_left_a_1024.png" alt=""><img class="cap cap-right" src="corridor/corridor_caps/blackstone_corridor_cap_right_b_1024.png" alt=""></div><canvas id="hero" aria-label="Aeldari Ranger in the corridor"></canvas><div id="foreground" class="world"><img class="frame frame-left" src="corridor/endpoint_obstacles/blackstone_foreground_edge_left_approved.png" alt=""><img class="frame frame-right" src="corridor/endpoint_obstacles/blackstone_foreground_edge_right_approved.png" alt=""></div><div class="mission-location">THE FIRST PASSAGE</div><div class="touch-controls"><button type="button" data-direction="left" aria-label="Move left">←</button><button type="button" data-direction="right" aria-label="Move right">→</button></div><div class="mission-fade" id="missionFade"></div></section>`;
    mountResourceHUD();
    missionReady = startMission();
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
    if(action.startsWith('rest-select-')){selectedRestSlot=Number(action.slice(12));refreshRest();return;}
    if(action.startsWith('rest-cancel-')){inventory.cancelRest(page,Number(action.slice(12)));selectedRestSlot=null;refreshRest();return;}
    if(action.startsWith('rest-assign-')){const hero=expeditionCrew.find(h=>h.id===action.slice(12));if(hero&&selectedRestSlot!==null)inventory.assignRest(page,selectedRestSlot,hero);selectedRestSlot=null;refreshRest();return;}
    if (action === 'flee') {if(mission?.combat)document.querySelector('.combat-controls-proxy [data-cmd="flee"]')?.click();else fleeExpedition();}
    else if (action === 'location-map') openLocationMap();
    else if (action === 'map-close') closeLocationMap();
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
  });

  addEventListener('keydown', event => {
    if (page !== 'mission' || optionsOpen || mapOpen || hubLoading) return;
    if (event.key.toLowerCase() === 'i' && !supplies.isOpen && !mission?.combat && !mission?.entering) {event.preventDefault();openInventory();return;}
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
  const walkAtlas = loadImage('sprites/ranger-walk.png');
  const idleAtlas = loadImage('sprites/ranger-idle.png');
  const encounterImages = [window.combatImages.raider,window.combatImages.gunner];


  function fleeExpedition() {
    if(page!=='mission'||hubLoading||mission?.entering||mission?.defeated)return;
    mission.fleeing=true;
    go('hub');
  }
  function mountResourceHUD() {
    const hud=document.createElement('div');hud.className='expedition-resources';hud.id='expeditionResources';
    document.querySelector('#mission').append(hud);updateResourceHUD();
  }
  function updateResourceHUD() {
    const hud=document.querySelector('#expeditionResources'),run=inventory.run;if(!hud||!run)return;
    hud.classList.toggle('energy-low',run.energy<25);
    const nav=(action,id,label,disabled=false)=>`<button class="expedition-icon" data-action="${action}" aria-label="${label}" title="${label}" ${disabled?'disabled':''}>${window.CombatUI.icon(id)}</button>`;
    hud.innerHTML=`<nav class="expedition-tabs" aria-label="Expedition panels">${nav('flee','exit',`Flee — lose ${window.EXPEDITION_DIFFICULTIES[run.difficulty].retreatLoss*100}% of loot`,!!mission?.combat)}${nav('inventory','bag','Inventory [I]',!!mission?.combat)}${nav('options','gear','Options')}${nav('location-map','map','Location map')}</nav>${window.GameHUD.party(run.party)}<div class="expedition-stock"><span title="Equipment energy">${window.CombatUI.icon('energy')}<b class="energy-value">${Math.ceil(run.energy)}/100</b></span><span title="Provisions">${window.CombatUI.icon('food')}<b>${inventory.count('ration')}</b></span><span title="Power cells">${window.CombatUI.icon('cell')}<b>${inventory.count('cell')}</b></span><span title="Thrones">${window.CombatUI.icon('coins')}<b>${inventory.state.credits}</b></span><span title="Backpack slots">${window.CombatUI.icon('cargo')}<b>${inventory.state.slots.filter(Boolean).length}/16</b></span></div>`;
  }

  function openLocationMap() {
    if(hubLoading||mission?.entering||mapOpen)return;
    mapOpen=true;keys.clear();
    const dialog=document.createElement('dialog');dialog.className='location-map-dialog';
    dialog.setAttribute('aria-label','Location Map');
    dialog.innerHTML=`<header><h2>Location Map</h2>${button('Close','map-close',{small:true})}</header><div class="map-placeholder"><strong>The First Passage</strong><p>No survey data available yet. Explored rooms, passages and portals will appear here.</p></div>`;
    dialog.addEventListener('cancel',event=>{event.preventDefault();closeLocationMap();});
    app.append(dialog);dialog.showModal();
  }
  function closeLocationMap() {
    const dialog=app.querySelector('.location-map-dialog');dialog?.close();dialog?.remove();mapOpen=false;keys.clear();
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

  async function startMission() {
    const viewport = document.querySelector('#mission');
    const canvas = document.querySelector('#hero');
    const ctx = canvas.getContext('2d');
    mission = {viewport, canvas, ctx, encounterDone:!!inventory.run?.encounterDone, x:innerHeight * (inventory.run?.progress??.48), facing:1, camera:0, animation:'idle', animationTime:0, lastTime:0, entering:false};
    keys.clear();
    mountPassageProps(viewport);
    const loadingState=mission;
    const backdropSources = ['corridor/repeat/blackstone_bg10_deepplanes_c_1024.png',
      'corridor/atmosphere/blackstone_bg30_fog_a_1024.png',
      'corridor/playfield/blackstone_playfield_floor_a_1024.png'];
    await Promise.all([
      ...[walkAtlas,idleAtlas,...encounterImages,...Object.values(window.combatImages),...viewport.querySelectorAll('img')].map(image=>image.decode().catch(()=>{})),
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
      const worldWidth = unit * 6;
      const maxCamera = Math.max(0, worldWidth-width);
      const direction = (hubLoading || optionsOpen || mapOpen || supplies.isOpen || state.combat) ? 0 : Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
      if (!state.entering && direction) {
        state.x = clamp(state.x + direction * unit * .27 * dt, unit*.29, unit*5.75);
        if(!inventory.run?.events.obstacle)state.x=Math.min(state.x,unit*2.98);
        state.facing = direction;
      }
      if (!hubLoading && !state.combat && !optionsOpen && !mapOpen && !supplies.isOpen && !state.entering) updateExpedition(state,unit);
      const animation = !state.entering && direction ? 'walk' : 'idle';
      if (state.animation !== animation) { state.animation = animation; state.animationTime = 0; }
      else state.animationTime += dt;
      const targetCamera = clamp(state.combat ? unit*2.05-width*.5 : state.x-width*.38, 0, maxCamera);
      state.camera += (targetCamera-state.camera) * Math.min(1,dt*8);
      const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
      const cameraGoal=state.combat&&!reduced?1.065:1;
      state.battleZoom=(state.battleZoom??1)+(cameraGoal-(state.battleZoom??1))*(1-Math.exp(-dt*4));
      const viewGoal=state.combat&&state.viewSide&&!reduced?(state.viewSide==='party'?1:-1):0;
      state.viewBias=(state.viewBias||0)+(viewGoal-(state.viewBias||0))*(1-Math.exp(-dt*6));
      positionPassageProps(state,unit);
      document.querySelector('#deep').style.backgroundPosition = `${-state.camera*.10}px center`;
      document.querySelector('#structures').style.transform = `translateX(${-state.camera*.20}px)`;
      document.querySelector('#fog').style.backgroundPosition = `${-state.camera*.32}px center`;
      document.querySelector('#midground').style.transform = `translateX(${-state.camera*.55}px)`;
      for (const id of ['playfield','endcaps','foreground']) document.getElementById(id).style.transform = `translateX(${-state.camera}px)`;
      // Screen-space transforms preserve the floor anchor; depth layers travel at different rates.
      for(const [id,depth] of [['deep',.12],['structures',.3],['fog',.4],['midground',.6],['playfield',1],['endcaps',1],['foreground',1.4]]){
        const layer=document.getElementById(id);
        layer.style.transformOrigin=`${width*.5}px ${unit*846/1024}px`;
        layer.style.scale=String(1+(state.battleZoom-1)*Math.min(depth,1));
        layer.style.translate=`${state.viewBias*unit*.028*depth}px 0`;
      }
      const dpr = Math.min(devicePixelRatio || 1,2);
      if (canvas.width !== Math.round(width*dpr) || canvas.height !== Math.round(unit*dpr)) {
        canvas.width = Math.round(width*dpr);
        canvas.height = Math.round(unit*dpr);
        canvas.style.width = width+'px';
        canvas.style.height = unit+'px';
      }
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.clearRect(0,0,width,unit);
      const isWalk = state.animation === 'walk';
      const image = isWalk ? walkAtlas : idleAtlas;
      const count = isWalk ? 24 : 129;
      const fps = isWalk ? 15.2145 : 17.28;
      const columns = 8;
      const border = 2;
      const gap = 4;
      const frame = Math.floor(state.animationTime*fps)%count;
      const sourceX = border+(frame%columns)*(512+gap);
      const sourceY = border+Math.floor(frame/columns)*(512+gap);
      const size = Math.min(unit*.48,410);
      const footY = unit*(846/1024);
      const screenX = state.x-state.camera;
      if(!state.combat)window.ExpeditionSpeech?.position('ranger',width*.5+(screenX-width*.5)*state.battleZoom,footY-size*.69*state.battleZoom);
      if (!state.combat && image.complete && image.naturalWidth) {
        ctx.save();
        ctx.translate(width*.5+(screenX-width*.5)*state.battleZoom,footY);
        ctx.scale(state.battleZoom,state.battleZoom);
        ctx.scale(state.facing,1);
        if(isWalk)ctx.drawImage(image,sourceX,sourceY,512,512,-size/2,-size*(468/512),size,size);
        else window.drawRanger(ctx,image,'idle',state.animationTime,-size/2,-size*(468/512),size);
        ctx.restore();
      }
      if (!hubLoading && !mapOpen && !supplies.isOpen && !inventory.run?.defeated && !state.combat && !state.encounterDone && state.x >= unit*1.65) {
        state.combat = true;
        keys.clear();
        setMusic();
        state.stopCombat = window.startBlackstoneBattle({
          party:inventory.run.party,
          getLayout:()=>({unit:viewport.clientHeight,camera:state.camera,heroX:state.x,size:Math.min(viewport.clientHeight*.48,410),zoom:state.battleZoom,bias:state.viewBias,center:viewport.clientWidth*.5}),
          onCameraSide:side=>{state.viewSide=side;},
          onOptions:openOptions,
          onFlee:fleeExpedition,
          onInventory:refresh=>openInventory(true,refresh),
          onPartyChange:party=>{if(inventory.run){inventory.run.party=party;if(party.every(u=>u.hp<=0))inventory.run.defeated=true;inventory.save();updateResourceHUD();}},
          onDefeat:()=>{state.defeated=true;inventory.run.defeated=true;inventory.save();setMusic();},
          onVictory:()=>{state.victoryCue=true;inventory.run.encounterDone=true;inventory.queueLoot([{id:'credits',qty:650},{id:'salvage',qty:4}]);setMusic();},
          onAttack:(unit,skill)=>{
            if(unit.id==='ranger' && ['shot','aim'].includes(skill))playEffect('rangerShoot');
            else if(unit.id==='raider')playEffect('hormagauntAttack');
            else if(unit.id==='gunner')playEffect('termagantShoot');
          },
          onHit:(unit,lethal)=>{
            if(unit.id==='ranger')playEffect(lethal?'rangerDeath':'rangerHit');
            else if(unit.side==='enemy')playEffect(lethal?'tyranidDeath':(++tyranidHitVariant%2?'tyranidHit1':'tyranidHit2'));
          },
          onFinish:result => {
            state.combat = false; state.animationTime = 0; state.encounterDone = true; keys.clear(); setMusic();
            if (result === 'defeat') go('hub');
            else { inventory.run.encounterDone=true;inventory.save();updateResourceHUD();showLoot(); }
          }
        });
      }
      if (!hubLoading && !mapOpen && !supplies.isOpen && !state.combat && !state.entering && (state.x >= unit*5.72 || state.x <= unit*.32)) {
        if (!payPortalEnergy()) { state.x=clamp(state.x,unit*.34,unit*5.70); requestAnimationFrame(tick); return; }
        state.entering = true;
        playEffect('teleportOut');
        document.querySelector('#missionFade').classList.add('active');
        setTimeout(() => { if (mission === state) go('hub'); },650);
      }
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



