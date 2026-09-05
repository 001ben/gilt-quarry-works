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

The complete loop is push → sell → choose an upgrade → open a richer sector → clear the quarry. Three sectors contain 1,800 / 2,100 / 2,400 gems worth $1 / $2 / $4 each. Contracts award bonuses at half clearance. Engine, blade and intake each have five visible levels. Gates can be purchased, or opened free after clearing the previous sector, preventing economy softlocks. Clearing all sectors earns a victory lap with a fresh quarry and maximum equipment. Payout text combines collections over short intervals, rather than emitting a DOM element for every tiny gem.

Progress saves locally, including gem positions and credited gem IDs, upgrades, contracts and machine position. Pause, help, mute, camera zoom, touch controls and explicit new-shift reset are part of the playable build.

Version-one saves migrate to version two. Funds, earnings, equipment, gate access and completed contracts remain unchanged. Clearance counts are converted by sector completion fraction; remaining gems use the new packed layout. Migration does not award additional money.

## Boundaries

This is a single-player browser game with a planar rigid-body simulation and a 3D presentation. It does not simulate deformable soil, track suspension or vertical rock piles. No backend, account, multiplayer or external assets are required. The simulation owns collision geometry and dimensions; the renderer consumes the same upgrade stats. The Blender script and editable `.blend` are included.

## Verification

Exercise actual physics for collection, gate collisions, upgrades, top-speed bounds and a complete campaign; verify save round trips and invalid-save recovery. Build TypeScript and the production bundle. Load the real GLB in a browser and play through the first delivery, workshop, pause and reload. Document observed results in `docs/verification.md`.
