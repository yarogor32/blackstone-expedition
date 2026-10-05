(() => {
  'use strict';

  const VERSION = 3;
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

  function createRaidLayout(seed = newSeed(), roomCount = 8) {
    const rooms = Array.from({ length: roomCount }, (_, index) => {
      const id = `room-${index}`;
      return { id, index, type: 'room', variants: combination(seed, id, index), visited: false };
    });
    // Every room after the entry attaches to an earlier room. The saved graph may
    // branch, but always stays connected and therefore remains traversable.
    const corridors = rooms.slice(1).map((room, index) => {
      const childIndex = index + 1;
      const parentIndex = hash(`${seed}:edge:${childIndex}`) % childIndex;
      return { id: `corridor-${index}`, type: 'corridor', from: rooms[parentIndex].id, to: room.id };
    });
    const connections = Object.fromEntries(rooms.map(room => [room.id, []]));
    corridors.forEach(corridor => {
      connections[corridor.from].push({ room: corridor.to, corridor: corridor.id });
      connections[corridor.to].push({ room: corridor.from, corridor: corridor.id });
    });
    const nodes = [rooms[0], ...corridors.flatMap((corridor, index) => [corridor, rooms[index + 1]])];
    return { version: VERSION, seed, entry: rooms[0].id, current: 'corridor-entry', rooms, corridors, connections, nodes };
  }

  function ensureRun(run) {
    if (!run) return null;
    if (!run.raidLayout || run.raidLayout.version !== VERSION || !Array.isArray(run.raidLayout.rooms)) {
      run.raidLayout = createRaidLayout(run.raidLayout?.seed);
    }
    return run.raidLayout;
  }

  function getRoom(layout, id = layout?.entry) {
    return layout?.rooms?.find(room => room.id === id) || layout?.rooms?.[0] || null;
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
    () => `${img('room-ceiling-module ceiling-span','corridor/modules/bg20/blackstone_bg20_span_b.png')}`,
    () => `${img('room-ceiling-module ceiling-ribs','corridor/modules/bg20/blackstone_bg20_ribs_d.png')}${img('room-ceiling-module ceiling-overhang','corridor/modules/bg40/blackstone_bg40_overhang_b.png')}`,
    () => `${img('room-ceiling-module ceiling-arch','corridor/modules/bg40/blackstone-wide-arch-v1.png')}`,
    () => `${img('room-ceiling-module ceiling-left','corridor/modules/bg40/blackstone-column-asymmetric-v2.png')}${img('room-ceiling-module ceiling-right','corridor/modules/bg40/blackstone-column-asymmetric-v2.png')}`
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
        ${img('room-boundary boundary-left','corridor/corridor_caps/blackstone_corridor_cap_left_a_1024.png')}
        ${img('room-boundary boundary-right','corridor/corridor_caps/blackstone_corridor_cap_right_b_1024.png')}
      </div>
      <div class="room-layer room-floor room-variant-${variants.floor}" data-room-layer="floor">${floor[variants.floor]()}</div>
      <div class="room-vignette" aria-hidden="true"></div>`;
  }

  window.BlackstoneRooms = { VERSION, VARIANT_COUNT, combination, createRaidLayout, ensureRun, getRoom, renderLayers };
})();
