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

## GitHub Pages deployment

The Check and deploy game workflow runs tests and builds for the repository subdirectory. Pushes to main publish the dist artifact to GitHub Pages after checks pass; pull requests only test and build. The workflow can also be run manually from Actions.

Enable Settings > Pages > Source: GitHub Actions before the first deployment. The expected project URL is https://001ben.github.io/gilt-quarry-works/. Pages from a private repository requires a supporting GitHub plan; otherwise the repository must be public.

To check the same build locally:

    npm run build -- --base=/gilt-quarry-works/
    npm run preview -- --base=/gilt-quarry-works/

Only the compiled game is deployed. Browser saves belong to their origin, so the hosted game starts a separate save from localhost.

## Controls

| Control                        | Action                                    |
| ------------------------------ | ----------------------------------------- |
| W / S (or up / down arrows)    | Forward / reverse relative to the machine |
| Left / right arrows (or A / D) | Steer, including pivot turns at rest      |
| Space                          | Brake                                     |
| C                              | Follow / quarry overview camera           |
| Mouse wheel                    | Zoom                                      |
| M                              | Toggle audio                              |
| Escape                         | Pause / resume                            |
| ?                              | Operator's manual                         |

Touch devices have forward, reverse, steering and brake buttons. Start your shift, then hold W to push the first blue heap onto the marked deposit belt. Park on a glowing platform to fund the rotating part above it. Coins transfer gradually and the platform bar fills. Partial payments survive leaving and reloading; each visit fits one level, then you drive off before funding another.

## The campaign

- 6,300 small physical gems in packed heaps: 1,800 quartz, 2,100 citrine and 2,400 amethyst.
- Two continuous 40-link track chains follow measured ground travel, reverse direction, and counter-rotate during pivot turns.
- Five engine/chassis levels, five blade widths (with wings from level three), five working collector configurations, and an optional five-level front magnet.
- Conveyors animate toward the hopper and grow from a 3 m span to 28 m, with an 11 m forward feeder at maximum level.
- A front boom magnet starts with a slow pull on small stones, then gains range and strength. Ground pulses show its reach.
- Upgrade pads show rotating holograms of the runtime parts, funding totals and physical progress bars.
- Two red key platforms turn green on purchase and lower the gates over 1.5 seconds. Keys are free after the preceding sector is completely cleared.
- Half-clearance contract bonuses, collection particles, flying payouts and synthesized sound.
- Completion screen and a fresh fully upgraded victory lap.
- Automatic browser-local saves: remaining gems and their positions, money, upgrades, partial platform funding, contracts and machine position. Original sparse-layout saves migrate funds, equipment and clearance fractions to the new heap layout. New quarry reset requires an explicit confirmation.

The simulation is planar Matter.js physics with a Three.js presentation; it is not deformable terrain or a full vehicle dynamics simulator. Actual mobile-device performance and subjective campaign pacing remain to be evaluated beyond the included browser viewport checks.

## Original artwork

`art/gilt-dozer.blend` is the editable source. `art/build_assets.py` authors all dozer meshes and materials, exports the runtime GLB, and renders a review image. Rebuild using Blender 5:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe' --background --python art/build_assets.py
```

The renderer combines compatible static meshes by material while preserving the chassis, blade and two wing groups for progression. Missing UV attributes are normalized so the procedural plow plate cannot disappear during batching. The plow is a closed, thick, concave solid with end caps. A separate Blender-authored shoe is instanced along both track loops. The front magnet and conveyors are code-authored meshes in src/equipment.ts and reused for holographic previews. Both visual and physical dimensions come from `src/progression.ts`.

## Verification and design

```sh
npm test
npm run build
# With the dev server running on port 5173 and Microsoft Edge installed:
node tools/browser-check.mjs
node tools/machinery-check.mjs
node tools/performance-check.mjs current
```

See [conveyor performance measurements](docs/performance.md), [design and source study](docs/design.md) and [verification results](docs/verification.md). The original repository lives only in an ignored local `.reference` folder during development; none of its code or assets are shipped here.

## Project map

| File                                | Responsibility                                                    |
| ----------------------------------- | ----------------------------------------------------------------- |
| `src/progression.ts`                | Sector definitions, prices and shared machinery dimensions        |
| `src/simulation.ts`                 | Physics, platform funding, collections and validated saves        |
| `src/world.ts`                      | Quarry geometry, Blender model loading, rendering and camera      |
| `src/model.ts` / `src/tracks.ts`    | Safe model batching and constant-spacing track loops              |
| src/equipment.ts / src/platforms.ts | Animated conveyors, magnet geometry and drive-on holographic pads |
| `src/gems.ts`                       | Deterministic packed-heap layout                                  |
| `src/main.ts`                       | Inputs, HUD, menus, save lifecycle and game loop                  |
| `src/audio.ts`                      | Procedural engine and feedback sounds                             |
| `art/`                              | Reproducible original Blender assets                              |

Fonts are locally bundled from Fontsource (Barlow Condensed and DM Sans under their SIL Open Font Licenses). Third-party libraries retain their respective licenses.
