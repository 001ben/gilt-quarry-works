# Late-game pushing performance — 2026-09-05

Baseline: 21e856f. Windows, headless Microsoft Edge, 1440 × 960. The complete quarry remains present; all 2,400 amethyst stones are placed in one non-overlapping, staggered heap. Maximum equipment drives straight for 240 fixed steps, turns for 60, then brakes for 120. The first 60 steps are warm-up. Magnet-off and level-five magnet runs start from identical fixtures.

These timings measure CPU physics plus render submission, not GPU completion or end-to-end FPS. Pile motion changes deliberately with the new magnet behavior; counts are preserved, trajectories are not expected to match.

| Maximum magnet | Median before | Median after | p95 before | p95 after |
| --- | ---: | ---: | ---: | ---: |
| Pushing | 9.7 ms | 9.0 ms | 14.5 ms | 11.4 ms |
| Turning | 9.5 ms | 6.9 ms | 10.5 ms | 8.2 ms |
| Braking / settling | 9.0 ms | 3.8 ms | 11.3 ms | 6.2 ms |

The magnet run's median awake count drops from 1,744 to 1,345 while pushing, and 1,807 to 307 while braking. The dozer advances about 177 physics units during the straight push instead of 86. At the end of braking its speed reaches zero; the baseline magnet run still moves at 0.16 units per step. No stones escape the quarry. All runs retain 6,192 stones after the same 108 starter stones reach the maximum conveyor.

The previous 600-gem conveyor fixture also improves: 6.5 ms median / 9.5 ms p95 versus 6.8 / 12.3 ms in the preceding polish pass. It collects 386 stones in the bounded run versus 387 before; the driving conveyor fixture still collects 593. Desktop/mobile gameplay checks pass with no browser errors or horizontal overflow.

## Changes

- Wake only the previous/current dozer footprint plus a margin for contact and next-step movement, rather than an 8.7 m radius around it. This includes turning and reversing.
- Magnet targets form a strip across the plow. Loose outliers move inward; stones within the blade width retain separate lanes.
- Pull tapers near the capture strip and stops once a stone arrives. A local 16-unit spatial grid identifies stones with three neighbors within 12 units; the magnet leaves these packed stones to the plow instead of continuously compressing the heap.
- Keep eight position-correction passes, reduce velocity-solving passes from eight to four. A 6/4 trial had similar timings, but 8/4 provided tighter contact correction in the pressure test.

No gem counts, visual detail, magnet upgrade range/strength, rendering resolution, or save format were reduced or changed. The behavioral change is intentional: the magnet gathers stragglers without dragging the entire packed mountain toward the machine.

## Qualification

29 simulation tests pass, including rotated contact waking, untouched distant sleepers, separated magnet lanes, captured/packed stones sleeping, pulling a nearby loose stone, and existing directional/gate/strength constraints.

A 300-stone load compressed between the largest plow and a barrier for 180 steps, then braked for 60, produces no central plow crossings and no barrier crossings. Maximum residual overlap with machine parts is 2.67 physics units for 8/4 versus 2.46 for 8/8, below the smallest gem radius (3.1). The test also guards this bound; collision geometry is unchanged.

Run with Vite on port 5173 and Edge installed:

    node tools/late-game-check.mjs current

To compare solver settings without editing the game, set GILT_SOLVER to 6,4 or 8,8 before running. Measurements, final machine poses and screenshots are written under ignored .local/. Browser contexts are isolated from player saves.

These are repeatable desktop fixtures, not measurements of the user's saved pile or physical mobile hardware.
