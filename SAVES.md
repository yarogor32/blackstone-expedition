# Campaign saves

Three local campaigns are stored in `blackstone-campaigns-v1`; the previous valid write is stored under `blackstone-campaigns-v1-backup`. The existing inventory save is migrated to campaign 1 without deleting the original. Settings remain separate from campaigns.

Continue opens the active campaign. New Game chooses a slot and difficulty, asking before replacing an occupied slot. Load Game lists location, party, difficulty, Thrones and last save time. Export/Import use versioned JSON files. Options exposes Export Save and Main Menu. Imported saves are checked before replacing a slot. A storage failure shows an export warning.

Inventory transactions, upgrades, rest assignments, exploration progress and combat checkpoints save automatically. Combat snapshots contain units, initiative queue, active unit, round, log and result. They are written after resolved actions; pending animation/sound timers are not saved. On resume a completed hit is not applied twice. Rest completes on expedition return as before.

Browser storage is local to the site origin and browser profile. Export files are needed to transfer campaigns between localhost, GitHub Pages, browsers or devices. No cloud sync is implemented. Format version 1 is accepted; unknown future versions are rejected.
