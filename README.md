# GILT — Quarry Works

A fresh 3D gem-pushing game inspired by [Gem Miner Bulldozer](https://github.com/001ben/Gem-miner-vibe). Drive a small tracked machine through a sun-warmed quarry, sweep physical gems into a collector, and grow into a machine that can clear the whole operation.

![Original GILT dozer, authored in Blender](art/dozer-preview.png)

## Play locally

Requires Node.js 22.12+ (verified with Node 24).

```sh
npm ci
npm run dev
```

Open the local address Vite prints. For a production build, run `npm run build`, then `npm run preview`. The build is static and can be served from any web host at its root path. The game has no backend; models, fonts and audio all run locally.

## Controls

| Control | Action |
| --- | --- |
| W / S (or up / down arrows) | Forward / reverse relative to the machine |
| Left / right arrows (or A / D) | Steer, including pivot turns at rest |
| Space | Brake |
| E | Workshop |
| C | Follow / quarry overview camera |
| Mouse wheel | Zoom |
| M | Toggle audio |
| Escape | Pause / resume |
| ? | Operator's manual |

Touch devices have forward, reverse, steering and brake buttons. Start your shift, then hold W to push the first blue heap onto the marked deposit belt. Buying equipment pauses the simulation. Upgrades are explicit button purchases, available from anywhere in the quarry.

## The campaign

- 6,300 small physical gems in packed heaps: 1,800 quartz, 2,100 citrine and 2,400 amethyst.
- Two continuous 40-link track chains follow measured ground travel, reverse direction, and counter-rotate during pivot turns.
- Five engine/chassis levels, five blade widths (with wings from level three), and five working collector configurations.
- Two gates, purchasable with earnings or free after the preceding sector is completely cleared.
- Half-clearance contract bonuses, collection particles, flying payouts and synthesized sound.
- Completion screen and a fresh fully upgraded victory lap.
- Automatic browser-local saves: remaining gems and their positions, money, upgrades, contracts and machine position. Original sparse-layout saves migrate funds, equipment and clearance fractions to the new heap layout. New quarry reset requires an explicit confirmation.

The simulation is planar Matter.js physics with a Three.js presentation; it is not deformable terrain or a full vehicle dynamics simulator. Actual mobile-device performance and subjective campaign pacing remain to be evaluated beyond the included browser viewport checks.

## Original artwork

`art/gilt-dozer.blend` is the editable source. `art/build_assets.py` authors all dozer meshes and materials, exports the runtime GLB, and renders a review image. Rebuild using Blender 5:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe' --background --python art/build_assets.py
```

The renderer combines compatible static meshes by material while preserving the chassis, blade and two wing groups for progression. Missing UV attributes are normalized so the procedural plow plate cannot disappear during batching. The plow is a closed, thick, concave solid with end caps. A separate Blender-authored shoe is instanced along both track loops. Both visual and physical dimensions come from `src/progression.ts`.

## Verification and design

```sh
npm test
npm run build
# With the dev server running on port 5173 and Microsoft Edge installed:
node tools/browser-check.mjs
node tools/machinery-check.mjs
```

See [design and source study](docs/design.md) and [verification results](docs/verification.md). The original repository lives only in an ignored local `.reference` folder during development; none of its code or assets are shipped here.

## Project map

| File | Responsibility |
| --- | --- |
| `src/progression.ts` | Sector definitions, prices and shared machinery dimensions |
| `src/simulation.ts` | Physics, purchases, collections and validated saves |
| `src/world.ts` | Quarry geometry, Blender model loading, rendering and camera |
| `src/model.ts` / `src/tracks.ts` | Safe model batching and constant-spacing track loops |
| `src/gems.ts` | Deterministic packed-heap layout |
| `src/main.ts` | Inputs, HUD, menus, save lifecycle and game loop |
| `src/audio.ts` | Procedural engine and feedback sounds |
| `art/` | Reproducible original Blender assets |

Fonts are locally bundled from Fontsource (Barlow Condensed and DM Sans under their SIL Open Font Licenses). Third-party libraries retain their respective licenses.
