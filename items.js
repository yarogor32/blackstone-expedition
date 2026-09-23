/* Stable item IDs and balance data; display text lives in locales/inventory-en.js. */
(() => {
  window.EXPEDITION_DIFFICULTIES = {easy:{retreatLoss:.5},normal:{retreatLoss:.75},hard:{retreatLoss:1}};
  window.EXPEDITION_ITEMS = {
    ration: {stack:12, price:75, sell:5, kind:'supply', icon:'ration'},
    cell: {stack:8, price:75, sell:5, kind:'supply', icon:'cell'},
    cutter: {stack:4, price:250, sell:25, kind:'supply', icon:'cutter'},
    key: {stack:6, price:200, sell:20, kind:'supply', icon:'key'},
    bandage: {stack:6, price:150, sell:15, kind:'supply', icon:'bandage'},
    antidote: {stack:6, price:150, sell:15, kind:'supply', icon:'antidote'},
    credits: {stack:1750, sell:1, kind:'loot', icon:'credits'},
    salvage: {stack:12, sell:75, kind:'loot', icon:'salvage'},
    relic: {stack:3, sell:500, kind:'loot', icon:'relic'}
  };
  // Per supply checkpoint, independently configurable for every future recruit.
  window.EXPEDITION_METABOLISM = {
    ranger: {food:1, energy:0}, human: {food:1, energy:0}, kroot: {food:1, energy:0},
    'space-marine': {food:.25, energy:2}, drukhari: {food:1, energy:0},
    mechanicus: {food:1, energy:0}
  };
})();
