(() => {
  'use strict';

  const VERSION = 10;
  const VARIANT_COUNT = 4;
  const clampVariant = value => ((Number(value) || 0) % VARIANT_COUNT + VARIANT_COUNT) % VARIANT_COUNT;
  const hash = value => {
    let h = 2166136261;
    for (const c of String(value)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  const newSeed = () => `${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffffff).toString(36)}`;

  function combination(seed, roomId, roomIndex = 0) {
    const offset = hash(`${seed}:${roomId.replace(/\d+$/, '')}`) % 1024;
    // A base-four walk prevents complete room duplicates during the first 1024 rooms.
    const code = (offset + roomIndex * 277) % 1024;
    return {
      deep: clampVariant(code),
      rear: clampVariant(code >> 2),
      middle: clampVariant(code >> 4),
      ceiling: clampVariant(code >> 6),
      floor: clampVariant(code >> 8)
    };
  }

  function positionCorridorAccesses(seed, rooms, corridors) {
    const degree=Object.fromEntries(rooms.map(room=>[room.id,0]));
    corridors.forEach(corridor=>{degree[corridor.from]=(degree[corridor.from]||0)+1;degree[corridor.to]=(degree[corridor.to]||0)+1;});
    corridors.forEach((corridor,index)=>{
      const left=.68+(hash(`${seed}:platform-left:${index}`)%25)/100;
      const right=5.08+(hash(`${seed}:platform-right:${index}`)%25)/100;
      const fromRoom=rooms.find(room=>room.id===corridor.from),toRoom=rooms.find(room=>room.id===corridor.to);
      const fromIsLeft=fromRoom.y===toRoom.y?fromRoom.x<toRoom.x:fromRoom.y>toRoom.y;
      corridor.fromAccess=fromIsLeft?left:right;
      corridor.toAccess=fromIsLeft?right:left;
      delete corridor.branchRoom;delete corridor.branchAccess;
      const candidates=[];
      for(const junction of [corridor.from,corridor.to].filter(id=>(degree[id]||0)>=3))for(const edge of corridors){
        if(edge===corridor)continue;
        const room=edge.from===junction?edge.to:edge.to===junction?edge.from:null;
        if(room&&room!==corridor.from&&room!==corridor.to&&!candidates.includes(room))candidates.push(room);
      }
      if(candidates.length&&hash(`${seed}:central-branch:${index}`)%4===0){
        corridor.branchRoom=candidates[hash(`${seed}:central-branch-room:${index}`)%candidates.length];
        corridor.branchAccess=2.7+(hash(`${seed}:central-branch-position:${index}`)%61)/100;
      }
    });
  }

  function positionCorridorEncounters(seed,corridors){
    corridors.forEach((corridor,index)=>{
      corridor.hasEncounter=hash(`${seed}:encounter-roll:${index}`)%100<45;
      corridor.encounterPosition=1.75+(hash(`${seed}:encounter-position:${index}`)%280)/100;
    });
    if(corridors.length&&!corridors.some(corridor=>corridor.hasEncounter))corridors[hash(`${seed}:encounter-required`)%corridors.length].hasEncounter=true;
  }

  function createRaidLayout(seed = newSeed(), roomCount = 8) {
    const rooms = Array.from({ length: roomCount }, (_, index) => {
      const id = `room-${index}`;
      return { id, index, type: 'room', x: 0, y: 0, variants: combination(seed, id, index), visited: false, discovered: index === 0 };
    });
    // Grow a connected orthogonal dungeon. Occupied cells are rejected so the
    // same seed always produces a readable Darkest Dungeon style map.
    const occupied = new Set(['0,0']);
    const degrees = Array(roomCount).fill(0);
    const corridors = [];
    const directions = [{x:1,y:0},{x:0,y:1},{x:0,y:-1},{x:-1,y:0}];
    for (let childIndex = 1; childIndex < rooms.length; childIndex++) {
      const candidates = rooms.slice(0, childIndex).filter((room, index) => degrees[index] < 4 && directions.some(dir => !occupied.has(`${room.x + dir.x},${room.y + dir.y}`)));
      const parent = candidates[hash(`${seed}:parent:${childIndex}`) % candidates.length] || rooms[childIndex - 1];
      const parentIndex = rooms.indexOf(parent);
      const open = directions.filter(dir => !occupied.has(`${parent.x + dir.x},${parent.y + dir.y}`));
      const dir = open[hash(`${seed}:direction:${childIndex}`) % open.length];
      const room = rooms[childIndex];
      room.x = parent.x + dir.x; room.y = parent.y + dir.y;
      occupied.add(`${room.x},${room.y}`); degrees[parentIndex]++; degrees[childIndex]++;
      corridors.push({ id: `corridor-${childIndex - 1}`, type: 'corridor', from: parent.id, to: room.id, discovered: false, visited: false });
    }
    // Most passages have a stop at each end. A junction room may occasionally
    // add its stop near the middle to read as a genuine side branch.
    positionCorridorAccesses(seed,rooms,corridors);
    positionCorridorEncounters(seed,corridors);
    const connections = Object.fromEntries(rooms.map(room => [room.id, []]));
    corridors.forEach(corridor => {
      connections[corridor.from].push({ room: corridor.to, corridor: corridor.id });
      connections[corridor.to].push({ room: corridor.from, corridor: corridor.id });
    });
    const distance = {[rooms[0].id]:0}, queue=[rooms[0].id];
    while(queue.length){const id=queue.shift();for(const edge of connections[id])if(distance[edge.room]===undefined){distance[edge.room]=distance[id]+1;queue.push(edge.room);}}
    const finalRoom=rooms.slice().sort((a,b)=>(distance[b.id]||0)-(distance[a.id]||0)||b.index-a.index)[0];
    const finalEdge=connections[finalRoom.id][0];
    const finalCorridor=corridors.find(c=>c.id===finalEdge.corridor);
    const exitPosition=5.58;
    const entryAccess=5.08+(hash(`${seed}:entry-platform`)%25)/100;
    const nodes = [rooms[0], ...corridors.flatMap((corridor, index) => [corridor, rooms[index + 1]])];
    return { version: VERSION, seed, entry: rooms[0].id, finalRoom:finalRoom.id, startPortal:{corridor:'corridor-entry',position:.34}, exitPortal:{corridor:finalCorridor.id,position:exitPosition}, entryAccess, entryEncounter:hash(`${seed}:entry-encounter-roll`)%100<35, entryEncounterPosition:2.1+(hash(`${seed}:entry-encounter-position`)%180)/100, current: 'corridor-entry', currentCorridor: 'corridor-entry', corridorFrom: null, corridorTo: rooms[0].id, rooms, corridors, connections, nodes };
  }

  function ensureRun(run) {
    if (!run) return null;
    if([5,6,7,8,9].includes(run.raidLayout?.version)&&Array.isArray(run.raidLayout.rooms)&&Array.isArray(run.raidLayout.corridors)){
      positionCorridorAccesses(run.raidLayout.seed,run.raidLayout.rooms,run.raidLayout.corridors);
      positionCorridorEncounters(run.raidLayout.seed,run.raidLayout.corridors);
      run.raidLayout.entryAccess=5.08+(hash(`${run.raidLayout.seed}:entry-platform`)%25)/100;
      run.raidLayout.entryEncounter=hash(`${run.raidLayout.seed}:entry-encounter-roll`)%100<35;
      run.raidLayout.entryEncounterPosition=2.1+(hash(`${run.raidLayout.seed}:entry-encounter-position`)%180)/100;
      if(run.raidLayout.exitPortal)run.raidLayout.exitPortal.position=5.58;
      run.raidLayout.version=VERSION;
    }else if (!run.raidLayout || run.raidLayout.version !== VERSION || !Array.isArray(run.raidLayout.rooms)) {
      run.raidLayout = createRaidLayout(run.raidLayout?.seed);
      run.progress = .48;
      run.roomPosition = .34;
    }
    return run.raidLayout;
  }

  function getRoom(layout, id = layout?.entry) {
    return layout?.rooms?.find(room => room.id === id) || layout?.rooms?.[0] || null;
  }

  function getCorridor(layout, id = layout?.currentCorridor) {
    if (id === 'corridor-entry') return { id, type:'corridor', from:null, to:layout.entry, fromAccess:.34, toAccess:layout.entryAccess, discovered:true, visited:true, entry:true };
    return layout?.corridors?.find(corridor => corridor.id === id) || null;
  }

  function roomAccess(layout, corridor, roomId) {
    if (!corridor || !roomId) return null;
    if (corridor.entry) return roomId === layout.entry ? corridor.toAccess : null;
    if (corridor.branchRoom === roomId) return corridor.branchAccess;
    if (corridor.from === roomId) return corridor.fromAccess;
    if (corridor.to === roomId) return corridor.toAccess;
    return null;
  }

  function revealRoom(layout, roomId) {
    const room = getRoom(layout, roomId); if (!room) return null;
    room.discovered = true; room.visited = true;
    for (const edge of layout.connections?.[room.id] || []) {
      const corridor = getCorridor(layout, edge.corridor);
      const neighbour = getRoom(layout, edge.room);
      if (corridor) corridor.discovered = true;
      if (neighbour) neighbour.discovered = true;
    }
    return room;
  }

  function otherRoom(corridor, roomId) {
    if (!corridor) return null;
    return corridor.from === roomId ? corridor.to : corridor.to === roomId ? corridor.from : null;
  }

  const img = (className, src, extra = '') => `<img class="${className}" src="${src}" alt="" ${extra}>`;
  const deep = [
    () => `<div class="room-deep-texture"></div><div class="room-void room-void-a"></div>`,
    () => `<div class="room-deep-texture deep-shift"></div><div class="room-void room-void-b"></div>`,
    () => `<div class="room-deep-texture deep-mirror"></div><div class="room-void room-void-c"></div>`,
    () => `<div class="room-deep-texture deep-low"></div><div class="room-void room-void-d"></div>`
  ];
  const rear = [
    () => `${img('room-mega mega-left','corridor/modules/bg20/blackstone-megastructure-range-v4.png')}${img('room-bg-module rear-aperture','corridor/modules/bg20/blackstone_bg20_aperture_c.png')}`,
    () => `${img('room-bg-module rear-span','corridor/modules/bg20/blackstone_bg20_span_b.png')}${img('room-bg-module rear-ribs','corridor/modules/bg20/blackstone_bg20_ribs_d.png')}`,
    () => `${img('room-mega mega-center','corridor/modules/bg20/blackstone-megastructure-range-v3.png')}${img('room-bg-module rear-pylon','corridor/modules/bg20/blackstone_bg20_pylon_a.png')}`,
    () => `${img('room-bg-module rear-aperture rear-aperture-left','corridor/modules/bg20/blackstone_bg20_aperture_c.png')}${img('room-bg-module rear-span rear-span-right','corridor/modules/bg20/blackstone_bg20_span_b.png')}`
  ];
  const middle = [
    () => `${img('room-mid-module mid-buttress','corridor/modules/bg40/blackstone_bg40_buttress_a.png')}${img('room-mid-module mid-wallnode','corridor/modules/bg40/blackstone_bg40_wallnode_c.png')}`,
    () => `${img('room-mid-module mid-arch','corridor/modules/bg40/blackstone-wide-arch-v1.png')}${img('room-mid-module mid-overhang','corridor/modules/bg40/blackstone_bg40_overhang_b.png')}`,
    () => `${img('room-mid-module mid-pier mid-pier-left','corridor/modules/bg40/blackstone-wide-pier-v1.png')}${img('room-mid-module mid-pier mid-pier-right','corridor/modules/bg40/blackstone-wide-pier-v1.png')}`,
    () => `${img('room-mid-module mid-asym','corridor/modules/bg40/blackstone-column-asymmetric-v2.png')}${img('room-mid-module mid-buttress mid-buttress-right','corridor/modules/bg40/blackstone_bg40_buttress_a.png')}`
  ];
  const ceiling = [
    () => `${img('room-ceiling-sprite','rooms/ceilings/blackstone-ceiling-intact.png')}`,
    () => `${img('room-ceiling-sprite','rooms/ceilings/blackstone-ceiling-breach-small.png')}`,
    () => `${img('room-ceiling-sprite','rooms/ceilings/blackstone-ceiling-breach-large.png')}`,
    () => `${img('room-ceiling-sprite','rooms/ceilings/blackstone-ceiling-ribbed.png')}`
  ];
  const floor = [
    () => `<div class="room-floor-texture floor-a"></div><div class="room-floor-detail floor-detail-a"></div>`,
    () => `<div class="room-floor-texture floor-b"></div><div class="room-floor-detail floor-detail-b"></div>`,
    () => `<div class="room-floor-texture floor-c"></div><div class="room-floor-detail floor-detail-c"></div>`,
    () => `<div class="room-floor-texture floor-d"></div><div class="room-floor-detail floor-detail-d"></div>`
  ];

  function renderLayers(spec) {
    const variants = {
      deep: clampVariant(spec?.deep), rear: clampVariant(spec?.rear),
      middle: clampVariant(spec?.middle), ceiling: clampVariant(spec?.ceiling), floor: clampVariant(spec?.floor)
    };
    return `<div class="room-layer room-deep room-variant-${variants.deep}" data-room-layer="deep">${deep[variants.deep]()}</div>
      <div class="room-stage-frame" aria-hidden="true">
        <div class="room-layer room-rear room-variant-${variants.rear}" data-room-layer="rear">${rear[variants.rear]()}</div>
        <div class="room-layer room-fog"></div>
        <div class="room-layer room-middle room-variant-${variants.middle}" data-room-layer="middle">${middle[variants.middle]()}</div>
        <div class="room-layer room-ceiling room-variant-${variants.ceiling}" data-room-layer="ceiling">${ceiling[variants.ceiling]()}</div>
      </div>
      <div class="room-layer room-boundaries" aria-hidden="true">
        ${img('room-boundary boundary-left','corridor/modules/bg40/blackstone-wide-pier-v1.png')}
        ${img('room-boundary boundary-right','corridor/modules/bg40/blackstone-wide-pier-v1.png')}
      </div>
      <div class="room-layer room-floor room-variant-${variants.floor}" data-room-layer="floor">${floor[variants.floor]()}</div>
      <div class="room-vignette" aria-hidden="true"></div>`;
  }

  window.BlackstoneRooms = { VERSION, VARIANT_COUNT, combination, createRaidLayout, ensureRun, getRoom, getCorridor, roomAccess, revealRoom, otherRoom, renderLayers };
})();
