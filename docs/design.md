# GILT — Quarry Works

A fresh implementation inspired by [Gem Miner Bulldozer](https://github.com/001ben/Gem-miner-vibe), studied at commit `a124e57` on 2026-09-05. No original implementation or assets are copied into this game.

## What the original was reaching for

- `docs/living/guide/game_design_principles.md`: tactile reactions, visibly powerful upgrades, short reachable goals, readable machinery; sound, saves and a victory sandbox were explicitly missing ambitions.
- `docs/planning/plow_asset_design.md` and `src/entities/bulldozer.js`: a modular concave blade, teeth, and flared wings; physical size must match the visual model.
- `src/entities/collector.js`: upgrades add side conveyors, then a central conveyor, with bounded reach.
- `docs/planning/speed_and_acceleration_tuning.md`: weight without slippery lateral drift or uncontrollable late-game speeds.
- `src/entities/shop.js`: separate engine, plow, collector and gate purchases. Workshop interactions should be deliberate.
- `src/entities/gem.js`: finite resources in three increasingly valuable zones, clearance bonuses and victory.
- `src/core/input.js` and `src/entities/bulldozer_render.js`: vehicle-relative throttle and steering; individual track links advance along independent left and right loops.
- `docs/planning/archive/2026-01-07_ui_gameplay_polish.md`: clean currency feedback instead of a physical money pile.

Some original documents disagree with the code (automatic gate unlocks, prices and gem values). Runtime code is treated as the evidence for implemented behavior; plans establish intent.

## New design

An industrial miniature in a sun-warmed terracotta quarry. Cream instrument panels, dark pine machinery, saffron paint, cyan quartz, gold citrine and violet amethyst. The vehicle is the hero: bevelled panels, individual track shoes, hydraulic struts, safety cage and a curved steel blade. All Blender geometry is authored afresh and exported with named attachment parts.

W/S controls vehicle-relative forward/reverse; left/right arrows steer, with A/D aliases. Reversing keeps the same heading. Steering at rest pivots the chassis. Acceleration is bounded and lateral slip is damped. Space brakes. Each 40-shoe track loop advances according to signed chassis ground travel plus or minus the turn distance at its side. Stopping freezes the links, reverse reverses them, and pivots counter-rotate the sides.

Gems physically collide with the chassis, blade, wings, boundaries and each other. Push them onto a striped receiving apron; conveyor upgrades genuinely transport gems toward the hopper. Packed heaps replace isolated large stones. Radii are 3.1–3.7 simulation units, down from 7.3–10.6; the three sectors render with three instanced batches. Sleeping stones wake before the blade contacts them to prevent low-speed pile jamming.

The complete loop is push → sell → fund an upgrade platform → open a richer sector → clear the quarry. Three sectors contain 1,800 / 2,100 / 2,400 gems worth $1 / $2 / $4 each. Contracts award bonuses at half clearance. Engine, blade and intake each have five levels; the optional magnet starts unfitted and has five upgrade tiers. Gates can be purchased, or opened free after clearing the previous sector, preventing economy softlocks. Clearing all sectors earns a victory lap with a fresh quarry and maximum equipment. Payout text combines collections over short intervals, rather than emitting a DOM element for every tiny gem.

Progress saves locally, including gem positions and credited gem IDs, upgrades, contracts and machine position. Pause, help, mute, camera zoom, touch controls and explicit new-shift reset are part of the playable build.

Version-one and version-two saves migrate to version three, with an unfitted magnet and empty platform funding. Funds, earnings, equipment, gate access and completed contracts remain unchanged. Clearance counts are converted by sector completion fraction; remaining gems use the new packed layout. Migration does not award additional money.

## Drive-on equipment pass

Four equipment platforms occupy the east and west edges of the starting quarry, with key pads on the approach to each gate. The machine centre enters a 94-unit square trigger, waits one third of a second, then transfers integer coins four times per second. A fully funded part installs immediately without opening a menu. One level is fitted per visit, including across reloads; drive off and return for another. Escrow is saved separately from spendable money. Clearing a sector refunds any partial key payment when the free gate is unlocked.

The pads display the actual runtime chassis, blade and wing geometry, or the same conveyor and magnet builders used on the machine. The preview rotates above the platform; a ground bar and sign show funding. When the vehicle enters, the preview moves above its roof. A nearby HUD explains the next upgrade and the direction to the pad.

The receiving belt spans 3 / 8 / 14 / 21 / 28 metres. Levels three through five add a 3.7 / 7.3 / 11 metre forward feeder. Slats travel toward the hopper and freeze during pause. Transport speed is capped, preventing long belts from launching far-edge gems.

The magnet is a red horseshoe suspended from a front boom. It attracts stones into the gap ahead of the plow, never behind the chassis or through a locked gate. Low tiers affect smaller stones slowly; later tiers increase reach and acceleration and accept larger stones. Fading ground arcs move inward to show the field. It remains a gathering aid: the plow and belts still do the bulk work.

Gate keys change from red to green immediately on completion. Their barriers sink over 90 simulation ticks, and collision remains until the lowering finishes. Restored unlocked gates begin fully lowered.

Desktop HUD text and controls are larger, with additional scaling at 1900 px and 3000 px widths. Portrait and landscape touch layouts retain 44 px or larger driving and toolbar targets, safe-area spacing and a compact contextual upgrade card.

## Boundaries

This is a single-player browser game with a planar rigid-body simulation and a 3D presentation. It does not simulate deformable soil, track suspension or vertical rock piles. No backend, account, multiplayer or external assets are required. The simulation owns collision geometry and dimensions; the renderer consumes the same upgrade stats. The Blender script and editable `.blend` are included.

## Verification

Exercise actual physics for collection, gate collisions, upgrades, top-speed bounds and a complete campaign; verify save round trips and invalid-save recovery. Build TypeScript and the production bundle. Load the real GLB in a browser and play through the first delivery, platform funding, pause and reload. Document observed results in `docs/verification.md`.
