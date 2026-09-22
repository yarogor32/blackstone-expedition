(() => {
  'use strict';

  const app = document.querySelector('#app');
  const audio = document.querySelector('#music');
  const names = {ship:'Rogue Trader Yacht', docks:'Docks', bar:'Tavern', market:'Market', temple:'Shrine', workshop:'Workshops'};
  const places = {
    ship:['The crew refuge and expedition planning room.', 'Plan Expedition', 'Crew Rest'],
    docks:['Prepare the ship and choose a way into the Blackstone Fortress.', 'Portal Map'],
    bar:['Meet potential companions and give the Drukhari time to recover.', 'Recruit Companions', 'Rest'],
    market:['Equipment, provisions and traders of Precipice.', 'Buy Equipment', 'Buy Supplies'],
    temple:['Prayer and Confidence recovery for Space Marines.', 'Restore Confidence'],
    workshop:['Train heroes and repair damaged power armor.', 'Train Hero', 'Repair Armor']
  };
  const heroes = [
    {name:'Aeldari Ranger', file:'aeldari-ranger', role:'Mobile ranged fighter', positions:'2–4', moves:['Shuriken Catapult — targets 2–4','Swift Step — reposition and gain defense','Foresight — helps an ally evade the next hit'], trait:'Needs food at camp. Severe injuries require treatment at base.', rest:'Rogue Trader Yacht', available:true},
    {name:'Space Marine', file:'space-marine', role:'Frontline / Guard'},
    {name:'Rogue Trader', file:'rogue-trader', role:'Support / Versatile'},
    {name:'Drukhari Wych', file:'drukhari-wych', role:'Arena gladiator / Evasion'}
  ];
  const buildingOrder = ['temple','workshop','bar','market','ship','docks'];
  const buildingLevel = Object.fromEntries(buildingOrder.map(name => [name,1]));
  const effectFiles = {
    hover:'Mouse-hover.mp3', teleportOut:'Teleport - out.mp3', teleportIn:'Teleport-in.mp3',
    barEnter:'Bar - enter.mp3', barExit:'Bar - exit.mp3', docksEnter:'Docks - Enter.mp3',
    templeEnter:'Shrine - Enter.mp3', shipEnter:'Yacht - enter.mp3',
    marketEnter:'Market - enter.mp3', workshopEnter:'Workshop-Enter.mp3'
  };
  const effectVolume = {hover:.22,teleportOut:.62,teleportIn:.62};
  const effects = Object.fromEntries(Object.entries(effectFiles).map(([name,file]) => {
    const sound = new Audio(`sfx/${encodeURIComponent(file)}`);
    sound.preload = 'auto';
    sound.dataset.effect = name;
    document.body.append(sound);
    return [name,sound];
  }));
  const buildingEffects = {temple:'templeEnter',workshop:'workshopEnter',bar:'barEnter',market:'marketEnter',ship:'shipEnter',docks:'docksEnter'};
  function playEffect(name) {
    const sound = effects[name];
    if (!sound) return;
    sound.pause();
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }
  let hubScene = null;
  let hubError = false;
  const tracks = {menu:'Black Fortress - main menu.mp3', hub:'Black Fortress - Hub Location.mp3', mission:'Black Fortress - Raid.mp3'};
  let page = 'menu';
  let selectedHero = 0;
  let soundEnabled = true;
  let settingsOpen = false;
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

  function applyVolumes() {
    audio.volume = volumes.overall * volumes.music / 10000;
    for (const [name, sound] of Object.entries(effects)) {
      sound.volume = volumes.overall * volumes.sfx / 10000 * (effectVolume[name] ?? .55);
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
    if (control) control.textContent = musicLabel();
    const hint = document.querySelector('.menu-hint');
    if (hint) hint.textContent = !soundEnabled ? 'Menu music is off.' : audio.paused ? 'Click anywhere to start the menu music.' : 'Menu music is playing.';
  }

  audio.addEventListener('playing', updateMusicControl);
  audio.addEventListener('pause', updateMusicControl);

  function setMusic() {
    const track = page === 'mission' ? tracks.mission : page === 'menu' ? tracks.menu : tracks.hub;
    const path = `music/${encodeURIComponent(track)}`;
    if (audio.getAttribute('src') !== path) {
      audio.setAttribute('src', path);
      audio.load();
    }
    if (soundEnabled) audio.play().catch(updateMusicControl);
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

  function go(destination) {
    if (page === 'hub' && buildingEffects[destination]) playEffect(buildingEffects[destination]);
    if (page === 'bar' && destination === 'hub') playEffect('barExit');
    if (page === 'portals' && destination === 'mission') {
      playEffect('teleportOut');
      setTimeout(() => { if (page === 'mission') playEffect('teleportIn'); },650);
    }
    if (page === 'mission' && destination === 'hub') {
      const walkingIntoPortal = !!mission?.entering;
      if (!walkingIntoPortal) playEffect('teleportOut');
      setTimeout(() => { if (page === 'hub') playEffect('teleportIn'); },walkingIntoPortal ? 0 : 400);
    }
    if (page === 'mission' && destination !== 'mission') {
      mission = null;
      keys.clear();
    }
    page = destination;
    render();
  }

  function upgrade(place) {
    if (buildingLevel[place] < 3) buildingLevel[place]++;
    render();
  }

  function renderTop() {
    return `<header class="top"><div class="brand">Blackstone Expedition · Precipice</div><div class="hud">Party: Aeldari Ranger · Mission Playtest</div>${button(musicLabel(), 'sound', {small:true})}</header>`;
  }

  function renderMenu() {
    const controls = Object.entries({overall:'Overall',music:'Music',sfx:'SFX'}).map(([name,label]) => `<label class="volume-control" for="volume-${name}"><span>${label}</span><output for="volume-${name}">${volumes[name]}%</output><input id="volume-${name}" type="range" min="0" max="100" step="1" value="${volumes[name]}" data-volume="${name}"></label>`).join('');
    const content = settingsOpen
      ? `<div class="settings-panel"><h2>Settings</h2><p>Sound levels</p>${controls}<nav class="menu-nav settings-nav">${button(musicLabel(),'sound')}${button('Back to Menu','settings-back')}</nav></div>`
      : `<p>Enter the fortress from Precipice. The first passage is ready to explore.</p><nav class="menu-nav">${button('New Expedition','hub')}${button('Settings','settings')}${button('Continue · Coming Soon','', {disabled:true})}</nav>`;
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
      const place = layer.building ? layer.name.split(' · ')[0] : null;
      const level = place && buildingLevel[place];
      const src = place ? `layers/${place}-level-${level}.png?set=building-order-2` : `hub/${layer.src.split('/').pop()}`;
      const style = `left:${layer.x/16.72}%;top:${layer.y/9.41}%;width:${layer.w/16.72}%;${layer.h == null ? '' : `height:${layer.h/9.41}%;`}z-index:${index+1};opacity:${(layer.opacity ?? 100)/100};clip-path:inset(${layer.crop || 0}% 0 0 0);--label-left:${Math.max(0,-layer.x)/layer.w*100}%`;
      if (place && level) return `<button class="landmark hub-sprite" type="button" data-action="${place}" aria-label="${names[place]}, level ${level}" title="${names[place]}" style="${style}"><img src="${src}" alt=""><span>${names[place]} · Level ${level}</span></button>`;
      return `<div class="hub-sprite" style="${style}"><img src="${src}" alt=""></div>`;
    }).join('');
    app.innerHTML = `${renderTop()}<section class="stage"><div class="map">${layers}<div class="map-label">Precipice</div><div class="map-tip">Select the Docks to enter the fortress</div></div></section>`;
  }

  function renderHire() {
    const hero = heroes[selectedHero];
    const roster = heroes.map((item,index) => `<button type="button" class="recruit${selectedHero === index ? ' active' : ''}${item.available ? '' : ' locked'}" data-action="hero-${index}" ${item.available ? '' : 'disabled'}><img src="portraits/${item.file}.png" alt=""><span><strong>${item.name}</strong><small>${item.role} · ${item.available ? 'Selected' : 'Coming Soon'}</small></span></button>`).join('');
    app.innerHTML = `${renderTop()}<section class="scene" style="background-image:url('backgrounds/recruitment.png')"><div class="hire-wrap"><h2>Recruit Companions</h2><p class="caption">The Aeldari Ranger is available for this mission test. Other classes are coming soon.</p><div class="party"><div class="slot">Aeldari Ranger</div><div class="slot">Coming Soon</div><div class="slot">Coming Soon</div><div class="slot">Coming Soon</div></div><div class="hire-layout"><div class="roster">${roster}</div><div class="detail"><img src="portraits/${hero.file}.png" alt="Aeldari Ranger"><div><h3>${hero.name}</h3><dl class="facts"><dt>Role</dt><dd>${hero.role}</dd><dt>Ranks</dt><dd>${hero.positions}</dd><dt>Trait</dt><dd>${hero.trait}</dd><dt>Recovery</dt><dd>${hero.rest}</dd></dl><p class="tag">Starting abilities</p><ul class="moves">${hero.moves.map(move => `<li>${move}</li>`).join('')}</ul>${button('Selected for Expedition','',{disabled:true})}</div></div></div><div class="hire-back">${button('Back to Tavern','bar',{small:true})}</div></div></section>`;
  }

  function renderBuilding(place) {
    const details = places[place];
    const actions = details.slice(1).map(label => {
      const action = label === 'Recruit Companions' ? 'hire' : label === 'Portal Map' ? 'portals' : '';
      return button(action ? label : `${label} · Coming Soon`, action, {disabled:!action});
    }).join('');
    const level = buildingLevel[place];
    app.innerHTML = `${renderTop()}<section class="scene" style="background-image:url('interiors/${place}.png')"><div class="building-panel"><div class="building-panel-top"><div class="tag">Precipice Location · Level ${level}</div>${button('Back to Precipice','hub',{small:true})}</div><h2>${names[place]}</h2><p>${details[0]}</p>${actions}<div class="upgrade-box"><strong>Building Level ${level} / 3</strong><p class="caption">Visual upgrade preview.</p>${button(level === 3 ? 'Maximum Level' : 'Upgrade Building',`upgrade-${place}`,{disabled:level === 3})}</div></div></section>`;
  }

  function renderPortals() {
    app.innerHTML = `${renderTop()}<section class="scene portal-map" style="background-image:url('interiors/docks.png')"><div class="portal-panel"><div class="tag">Docks · Portal Map</div><h2>Choose a Portal</h2><p>The fortress shifts after every expedition. The First Passage is open for this test.</p><div class="portal-grid"><button type="button" class="portal-card available" data-action="mission"><span class="portal-mark">◇</span><strong>The First Passage</strong><small>Corridor · Enter and reach the far portal</small><em>ENTER</em></button><div class="portal-card unavailable"><span class="portal-mark">◇</span><strong>Unknown Portal</strong><small>Coming Soon</small></div><div class="portal-card unavailable"><span class="portal-mark">◇</span><strong>Unknown Portal</strong><small>Coming Soon</small></div></div>${button('Back to Docks','docks',{small:true})}</div></section>`;
  }

  function renderMission() {
    app.innerHTML = `<section class="mission" id="mission"><div id="deep"></div><div id="structures" class="world"><img class="module span" src="corridor/modules/bg20/blackstone_bg20_span_b.png" alt=""><img class="module ribs" src="corridor/modules/bg20/blackstone_bg20_ribs_d.png" alt=""><img class="module pylon" src="corridor/modules/bg20/blackstone_bg20_pylon_a.png" alt=""><img class="module aperture" src="corridor/modules/bg20/blackstone_bg20_aperture_c.png" alt=""></div><div id="fog"></div><div id="midground" class="world"><img class="module buttress" src="corridor/modules/bg40/blackstone_bg40_buttress_a.png" alt=""><img class="module overhang" src="corridor/modules/bg40/blackstone_bg40_overhang_b.png" alt=""><img class="module wallnode" src="corridor/modules/bg40/blackstone_bg40_wallnode_c.png" alt=""></div><div id="playfield" class="world"></div><div id="endcaps" class="world"><img class="cap cap-left" src="corridor/corridor_caps/blackstone_corridor_cap_left_a_1024.png" alt=""><img class="cap cap-right" src="corridor/corridor_caps/blackstone_corridor_cap_right_b_1024.png" alt=""></div><canvas id="hero" aria-label="Aeldari Ranger in the corridor"></canvas><div id="foreground" class="world"><img class="frame frame-left" src="corridor/endpoint_obstacles/blackstone_foreground_edge_left_approved.png" alt=""><img class="frame frame-right" src="corridor/endpoint_obstacles/blackstone_foreground_edge_right_approved.png" alt=""></div><div class="mission-top"><span>THE FIRST PASSAGE</span><span>Reach the far portal</span>${button(musicLabel(),'sound',{small:true})}</div><div class="mission-bottom"><span>A / D or ← / → to move · release to idle</span>${button('Return to Precipice','hub',{small:true})}</div><div class="touch-controls"><button type="button" data-direction="left" aria-label="Move left">←</button><button type="button" data-direction="right" aria-label="Move right">→</button></div><div class="mission-fade" id="missionFade"></div></section>`;
    startMission();
  }

  function render() {
    setMusic();
    if (page === 'menu') renderMenu();
    else if (page === 'hub') renderHub();
    else if (page === 'hire') renderHire();
    else if (page === 'portals') renderPortals();
    else if (page === 'mission') renderMission();
    else renderBuilding(page);
  }

  app.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target || target.disabled) return;
    const action = target.dataset.action;
    if (action === 'sound') toggleSound();
    else if (action === 'settings') { settingsOpen = true; renderMenu(); }
    else if (action === 'settings-back') { settingsOpen = false; renderMenu(); }
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
    if (page !== 'menu' && soundEnabled && !event.target.closest('[data-action="sound"]')) audio.play().catch(() => {});
  });

  addEventListener('keydown', event => {
    if (page !== 'mission') return;
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
    if (button && page === 'mission') {
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

  function startMission() {
    const viewport = document.querySelector('#mission');
    const canvas = document.querySelector('#hero');
    const ctx = canvas.getContext('2d');
    mission = {viewport, canvas, ctx, x:innerHeight * .48, facing:1, camera:0, animation:'idle', animationTime:0, lastTime:0, entering:false};
    keys.clear();
    function tick(now) {
      const state = mission;
      if (!state || state.canvas !== canvas || page !== 'mission') return;
      const dt = state.lastTime ? Math.min(.05, (now-state.lastTime)/1000) : 0;
      state.lastTime = now;
      const unit = viewport.clientHeight;
      const width = viewport.clientWidth;
      const worldWidth = unit * 6;
      const maxCamera = Math.max(0, worldWidth-width);
      const direction = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
      if (!state.entering && direction) {
        state.x = clamp(state.x + direction * unit * .27 * dt, unit*.29, unit*5.75);
        state.facing = direction;
      }
      const animation = !state.entering && direction ? 'walk' : 'idle';
      if (state.animation !== animation) { state.animation = animation; state.animationTime = 0; }
      else state.animationTime += dt;
      const targetCamera = clamp(state.x-width*.38, 0, maxCamera);
      state.camera += (targetCamera-state.camera) * Math.min(1,dt*8);
      document.querySelector('#deep').style.backgroundPosition = `${-state.camera*.10}px center`;
      document.querySelector('#structures').style.transform = `translateX(${-state.camera*.20}px)`;
      document.querySelector('#fog').style.backgroundPosition = `${-state.camera*.32}px center`;
      document.querySelector('#midground').style.transform = `translateX(${-state.camera*.55}px)`;
      for (const id of ['playfield','endcaps','foreground']) document.getElementById(id).style.transform = `translateX(${-state.camera}px)`;
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
      const count = isWalk ? 24 : 49;
      const fps = isWalk ? 12 : 12.8;
      const columns = isWalk ? 8 : 7;
      const border = isWalk ? 2 : 4;
      const gap = 4;
      const frame = Math.floor(state.animationTime*fps)%count;
      const sourceX = border+(frame%columns)*(512+gap);
      const sourceY = border+Math.floor(frame/columns)*(512+gap);
      const size = Math.min(unit*.48,410);
      const footY = unit*(846/1024);
      const screenX = state.x-state.camera;
      if (image.complete && image.naturalWidth) {
        ctx.save();
        ctx.translate(screenX,footY);
        ctx.scale(state.facing,1);
        ctx.drawImage(image,sourceX,sourceY,512,512,-size/2,-size*(468/512),size,size);
        ctx.restore();
      }
      if (!state.entering && (state.x >= unit*5.72 || state.x <= unit*.32)) {
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
  fetch('hub/scene.json').then(response => {
    if (!response.ok) throw new Error('Hub scene missing');
    return response.json();
  }).then(data => {
    if (data.version !== 1 || data.width !== 1672 || data.height !== 941 || !Array.isArray(data.layers)) throw new Error('Invalid hub scene');
    hubScene = data;
    if (page === 'hub') renderHub();
  }).catch(() => { hubError = true; if (page === 'hub') renderHub(); });
})();
