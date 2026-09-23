# Expedition inventory

## Reference and adaptation

The model is Darkest Dungeon **1**, not its sequel:

- One shared 16-slot expedition inventory, occupied by both supplies and loot.
- Stack limits vary by item; no weight system or weapon-shaped grid.
- Preparation happens before departure. Purchased supplies can be returned at full price before leaving.
- During an expedition, taking loot may require discarding supplies. Returning converts cargo into base funds; defeat loses carried cargo.

Research: [Inventory](https://darkestdungeon.wiki.gg/wiki/Inventory), [Provisions](https://darkestdungeon.fandom.com/wiki/Provisions), [Food](https://darkestdungeon.wiki.gg/wiki/Food), [Light Meter](https://darkestdungeon.wiki.gg/wiki/Light_Meter).

Our adaptation uses Thrones, provisions and **equipment energy**. There is no light meter. All current character types eat. Hunger intervals, energy costs, emergency recovery and prices are prototype balance, not a claim to reproduce DD's entire simulation.

## Current playable loop

1. Buy supplies at Market → Buy Supplies, then Docks → Portal Map → Portal. Portal entry directly starts the expedition loading screen; no shop is shown. Difficulty is selected on the portal map. The market cannot launch an expedition.
2. Buy single items; Shift-click buys a full stack. A recommended pack costs 1,050 Thrones for the current one-person short expedition. Initial test funds: 6,000.
3. Inventory: 16 slots; click to inspect/use, drag to swap or merge, or use Move / merge. Split halves a stack into an empty slot. Discard requires a second click. The expedition HUD shows four crew slots, face portraits, live health and saved Morale values. Morale starts at 100; its gameplay changes and effects are not implemented yet. Map opens a placeholder reserved for future survey data. The hub has a separate resource panel and a portrait with the current character level (initially 1; progression remains pending).
4. `I` or Inventory opens the bag in the corridor. Combat inventory opens only on the player's turn. Consumables do not consume the turn; food cannot be used in combat.
5. Victory awards selectable loot. Close (or Escape) closes an emptied loot window; if loot remains, it asks whether to leave it behind or keep sorting.
6. Two food checkpoints, one obstacle, one sealed cache demonstrate resource interactions in the current corridor.
7. Both the entry and far portals settle supplies at low resale value and loot at its full listed value. The separate Flee action loses 50% of loot value on Easy, 75% on Normal, 100% on Hard, as specified in DESIGN.md. Supplies are not loot and do not incur that deduction. Difficulty defaults to Normal, is selected before departure, and is fixed for that expedition. The debrief shows gross cargo value, fleeing loss and net banked funds. Party defeat loses everything carried; previously banked funds remain.

The design also specifies a Confidence reduction after fleeing. Confidence and its numeric penalties are not yet implemented, so the current settlement implements the agreed loot penalties only.

## Balance

| Supply | Stack | Cost | Current effect |
|---|---:|---:|---|
| Field Rations | 12 | 75 | Heals 10% max HP outside combat; feeds crew at hunger checks |
| Power Cell | 8 | 75 | +25 equipment energy, capped at 100 |
| Breaching Charge | 4 | 250 | Clears the scripted obstacle safely |
| Cipher Key | 6 | 200 | Opens the sealed cache without spending energy |
| Haemostatic Dressing | 6 | 150 | Removes `bleed`; purchase disabled until status encounters exist |
| Antitoxin | 6 | 150 | Removes `poison`; purchase disabled until status encounters exist |

Normal crew, including Mechanicus, consume 1 ration per hunger check. Space Marines accrue 0.25 ration per check and consume a whole ration every fourth check. Fractional food debt persists between expeditions. Demand sums only living crew, up to four. Skipping a needed meal costs that hero 20% max HP, leaving at least 1 HP.

Energy starts at 100. Each new corridor segment (0.4 screen-height world units) costs 6 energy for equipment plus 2 per living Space Marine for powered armour. No added tax for retracing explored segments. Door: 10 energy or a cipher key. Return portal: 10 energy. At insufficient charge, use a cell or hand-charge an emergency converter: +10 energy for 10% max HP per living hero, leaving at least 1 HP. No softlock from running out of cells.

Combat loot: 650 Thrones and 4 salvage components. Cache: 450 Thrones and a relic. Salvage sells for 75 each; relics for 500. These are test rewards, not final progression balance.

## Files and saving

- `items.js`: stable IDs, stacks, prices, metabolism profiles.
- `locales/inventory-en.js`: item names, descriptions and inventory interface strings.
- `inventory.js`: transactions, stacks, consumables, metabolism, loot and save data.
- `inventory-ui.js` / `inventory.css`: preparation and bag/loot/debrief interfaces.
- `app.js`: corridor events, energy, transitions and combat hooks.

Stored under `blackstone-expedition-inventory-v1` in localStorage. Shop purchases, bank funds, cargo, HP and expedition checkpoints survive reload. Resume restores the corridor; an unfinished battle restarts with saved crew health. A completed encounter and unclaimed loot persist without duplicate rewards. File and HTTP URLs have separate browser storage.

Not yet implemented: equippable weapons/trinkets, camping, stress, random curios, status-inflicting enemy attacks, separate item art and a full multi-room dungeon. The system accepts up to four crew; the current game still deploys only the Ranger.
