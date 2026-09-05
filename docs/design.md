# GILT — Quarry Works

A fresh implementation inspired by [Gem Miner Bulldozer](https://github.com/001ben/Gem-miner-vibe), studied at commit `a124e57` on 2026-09-05. No original implementation or assets are copied into this game.

## What the original was reaching for

- `docs/living/guide/game_design_principles.md`: tactile reactions, visibly powerful upgrades, short reachable goals, readable machinery; sound, saves and a victory sandbox were explicitly missing ambitions.
- `docs/planning/plow_asset_design.md` and `src/entities/bulldozer.js`: a modular concave blade, teeth, and flared wings; physical size must match the visual model.
- `src/entities/collector.js`: upgrades add side conveyors, then a central conveyor, with bounded reach.
- `docs/planning/speed_and_acceleration_tuning.md`: weight without slippery lateral drift or uncontrollable late-game speeds.
- `src/entities/shop.js`: separate engine, plow, collector and gate purchases. Workshop interactions should be deliberate.
- `src/entities/gem.js`: finite resources in three increasingly valuable zones, clearance bonuses and victory.
- `docs/planning/archive/2026-01-07_ui_gameplay_polish.md`: clean currency feedback instead of a physical money pile.

Some original documents disagree with the code (automatic gate unlocks, prices and gem values). Runtime code is treated as the evidence for implemented behavior; plans establish intent.

## New design

An industrial miniature in a sun-warmed terracotta quarry. Cream instrument panels, dark pine machinery, saffron paint, cyan quartz, gold citrine and violet amethyst. The vehicle is the hero: bevelled panels, individual track shoes, hydraulic struts, safety cage and a curved steel blade. All Blender geometry is authored afresh and exported with named attachment parts.

Drive with world-direction WASD/arrows. Heading turns smoothly toward travel; acceleration is bounded and lateral slip is damped. Space brakes. Gems physically collide with the chassis, blade, wings, boundaries and each other. Push them onto a striped receiving apron; conveyor upgrades genuinely transport gems toward the hopper.

The complete loop is push → sell → choose an upgrade → open a richer sector → clear the quarry. Three sectors contain 60 / 75 / 90 gems. Contracts award bonuses at half clearance. Engine, blade and intake each have five visible levels. Gates can be purchased, or opened free after clearing the previous sector, preventing economy softlocks. Clearing all sectors earns a victory lap with a fresh quarry and maximum equipment.

Progress saves locally, including gem positions and credited gem IDs, upgrades, contracts and machine position. Pause, help, mute, camera zoom, touch controls and explicit new-shift reset are part of the playable build.

## Boundaries

This is a single-player browser game with a planar rigid-body simulation and a 3D presentation. It does not simulate deformable soil, track suspension or vertical rock piles. No backend, account, multiplayer or external assets are required. The simulation owns collision geometry and dimensions; the renderer consumes the same upgrade stats. The Blender script and editable `.blend` are included.

## Verification

Exercise actual physics for collection, gate collisions, upgrades, top-speed bounds and a complete campaign; verify save round trips and invalid-save recovery. Build TypeScript and the production bundle. Load the real GLB in a browser and play through the first delivery, workshop, pause and reload. Document observed results in `docs/verification.md`.
