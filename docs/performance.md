# Conveyor performance — 2026-09-05

The reported slowdown was reproduced by parking a fully upgraded dozer over the hopper while 600 spaced gems feed inward on the maximum conveyor. The original collision scan was the largest CPU cost. Rendering also issued one draw per belt slat and rebuilt all gem transforms every frame.

## Measured results

Windows, headless Microsoft Edge, 1440 × 960, full 6,300-gem quarry, all equipment level five. Each deterministic fixture runs 360 animation callbacks; the first 60 are warm-up. Each callback runs one 60 Hz physics step, collection particles and one render. Chrome's CPU sampling profiler is enabled in both runs.

These values measure CPU physics plus render submission, **not GPU completion or end-to-end FPS**. They show headroom gained on this host, not a hardware-independent frame-rate guarantee. Baseline game revision: 85888a0.

| Scene                            | Median before | Median after | p95 before | p95 after |
| -------------------------------- | ------------: | -----------: | ---------: | --------: |
| Parked away from belt            |       13.2 ms |       2.3 ms |    16.1 ms |    2.9 ms |
| Parked on conveyor, starter feed |        9.7 ms |       2.7 ms |    12.1 ms |    3.2 ms |
| Parked on conveyor, 600-gem feed |       18.1 ms |       7.5 ms |    23.7 ms |   11.9 ms |
| Driving into 600-gem feed        |        9.9 ms |       2.9 ms |    14.1 ms |    5.0 ms |

The crowded conveyor's p95 work drops about 50%. Its final frame uses 340 draw calls instead of 552. Both versions collect 387 gems in that fixture and retain the physical pile against the dozer. The driving fixture collects 593 in both versions.

## Changes and safeguards

- A per-engine spatial filter selects moving bodies, static boundaries and nearby sleeping bodies before Matter performs its normal collision detection and solving. Selection runs after integration, using complete velocity-expanded bounds. The game has no constraints that could move a body after selection. Tests compare resulting contact sets to stock Matter, including compound bodies and cell boundaries.
- An idle dozer no longer repeatedly wakes untouched heaps. Approaching or turning vehicles still wake stones before contact, preserving the slow-speed pushing fix.
- Each conveyor section now renders its slats as one instanced batch, retaining movement, stripe colors and shadows.
- Gems retain stable instance slots. Their matrices update only when position, angle or local heap height changes. Collected slots are hidden, and replacing the simulation clears all old slots. Browser checks cover pause stability, collection and restore.

No gem counts, solver iteration counts, model detail or render resolution were reduced.

## Reproduce

With the dev server running on port 5173 and Microsoft Edge installed:

    node tools/performance-check.mjs current

The tool writes scenario screenshots, timing summaries and a Chrome-loadable CPU profile under ignored .local/. Fixtures use an isolated browser context and never read or change the player's saved quarry.

Correctness checks:

    npm test
    npm run build
    node tools/machinery-check.mjs
    node tools/browser-check.mjs

Twenty-two tests pass, including the new collision equivalence and idle-sleep tests. Desktop and mobile browser regression checks pass with no page errors. Physical mobile hardware and the user's exact accumulated pile are still separate measurements.


## Progression polish follow-up

The same fixture with expanded platforms, overhead bars and the later-sector refinery preview measures 6.8 ms median / 12.3 ms p95 for the 600-gem conveyor pile (347 draws). It still collects 387 gems; the driving fixture still collects 593. Parked on the conveyor without the large pile measures 3.0 / 4.2 ms. These are the same CPU work measurements, with run-to-run variation.

Funding rims use one instanced batch per pad. Coin effects use at most 30 DOM nodes, batched across collections, pause with gameplay, and clean up after arrival/reset. The stress fixture isolates the simulation and renderer; the separate polish browser check verifies the coin cap and lifecycle. No gem detail or counts were reduced.
