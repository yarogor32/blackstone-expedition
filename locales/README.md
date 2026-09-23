# NPC dialogue

`en.js` is the English source and complete list of NPC lines. It contains three entry greetings and two conversation topics (with replies) per building.

Building IDs: `bar` — bartender; `temple` — confessor; `market` — merchant; `workshop` — forge worker; `docks` — foreman; `ship` — yacht host.

## Translation

1. Copy `en.js` to a language file such as `ru.js`.
2. Change `window.NPC_LOCALES.en` to `window.NPC_LOCALES.ru`.
3. Translate values only. Preserve all keys, including topic and greeting numbers.
4. Load the new script after `en.js` and before `app.js` in `index.html`, then set `<html lang="ru">`.

Missing translations fall back to English. Strings are rendered as text, never HTML. JavaScript dictionaries are used so the game also works when opened directly from a local file. This dictionary currently covers NPC names, greetings and conversations; the rest of the existing game UI is separate.

On the first visit to each building, a greeting appears over the bottom of the portrait, which grows slightly. It fades after 6.5 seconds or Continue, and the portrait returns to its normal size. Seen greetings are stored in localStorage independently per building. Entering a mission through the portal resets all six flags; returning from a mission does not reset them again. Repeat visits and page reloads do not replay a seen greeting. Topic strings remain available for future conversations but are not displayed in the building panel. These greetings do not spend resources or grant gameplay effects.

## Portrait sources

The `npcs` folder contains copies of approved candidates from `art-source/npc-candidates/game-style-v1`: bartender-v2, priest, merchant-v7, forge-worker, dock-foreman and yacht-woman. Each filename uses its building ID.
