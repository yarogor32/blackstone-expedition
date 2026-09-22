# Blackstone Expedition — mission playtest

Serve this directory as a static website and open `index.html`. The build uses relative paths and can be hosted on GitHub Pages. The hub arrangement loads from `hub/scene.json`, so opening the HTML directly with `file://` is insufficient.

## Playtest route

1. Select **New Expedition**.
2. In **Precipice**, select **Docks**.
3. Open **Portal Map**, then select **The First Passage**.
4. Move the Aeldari Ranger with **A/D** or **←/→**. Releasing movement switches to Idle. Touch buttons are available on narrow screens.
5. Walk into the far portal to return to Precipice. The left portal also returns to the hub if revisited.

The Aeldari Ranger is the only available hero. Other class cards show **Coming Soon**. Building upgrade buttons preview the three existing visual levels; economy and combat are outside this playtest.

## Branding

The main menu uses the transparent `branding/blackstone-expedition-logo.png` title artwork. It was generated as an original antique-gold gothic science-fantasy wordmark with a faceted blackstone crest and exact title text.

## Music

- Main menu: `Black Fortress - main menu.mp3`
- Hub and interiors: `Black Fortress - Hub Location.mp3`
- Corridor mission: `Black Fortress - Raid.mp3`
- Packaged for future combat scenes: `Black Fortress - combat 1.mp3`, `Black Fortress - combat 1 2.mp3`

Music is enabled by default. The browser can block audible autoplay until a user gesture. The menu starts its track on the first pointer or keyboard action anywhere on the page; the **Start Music** button also starts it with one click. Once playback starts, the control shows **Music On**.

## Sound effects

The ten user-supplied MP3 files are packaged in `sfx/`. `Mouse-hover.mp3` plays when entering a building's hover area. Each of the six buildings plays its matching enter sound when opened from the hub. The Tavern plays `Bar - exit.mp3` when returning to Precipice. Portal travel plays `Teleport - out.mp3` on departure and `Teleport-in.mp3` on arrival, including the corridor exit portal. The music switch controls the background track; effects play independently.

## Source assets

The 18 building layers are copied from the user-ordered `outputs/blackstone-ui-v3/layers` and are the authoritative building progression. The user-exported editor arrangement is copied unchanged to `hub/scene.json`. Its platform tops, separate foundations, and clean background are packaged in `hub/`; the game draws them in the JSON order with its exact positions, visibility, opacity, and crop. Building buttons follow those same placements and swap to the corresponding image when upgraded. The original export is also archived in `outputs/perimeter-detailed-cut/extended/scene-approved.json`. Corridor layers come from `assets/environments/blackstone`. The Ranger walk is the approved 1080p generation trimmed to frames 9–32 and normalized to the current Idle character scale.
