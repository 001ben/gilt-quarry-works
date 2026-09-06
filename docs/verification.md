# Verification — 2026-09-05

Environment: Windows, Node 24.18, Blender 5.0.1, headless Microsoft Edge, 1440×960 and 2560×1440 desktop, 390×844 portrait mobile viewport, and 844×390 landscape with touch emulation.

## Verified

- Blender successfully generated the editable dozer, runtime GLB and rendered review image. The rendered game loads that GLB, preserving named upgrade groups and combining static meshes by material.
- TypeScript type check and Vite production build pass.
- Forty-three tests cover the actual Matter.js simulation, vehicle-relative reverse and pivot turns, signed track travel, continuous chain sampling, exported blade triangle preservation and face raycasts, dense gem counts/bounds, migration from versions 1–5, platform escrow/reload/completion, free-key refunds, delayed gate collision removal, full conveyor reach, and magnet strength/direction/gate boundaries.
- Browser keyboard driving with W delivered 132 starter gems for $132. A saved fixture approaching the engine pad was driven onto it with W, paid $90 in installments from a $240 wallet, and fitted engine level two. Further time parked did not spend more. Reload restored collection progress and funds. Exact delivery counts vary with browser input timing.
- Browser runtime reported no uncaught page errors or console errors. Checking console errors now catches geometry-batching failures, which the original page-error-only check missed. Desktop, funding platform, portrait/landscape mobile and runtime magnet close-up screenshots were inspected.
- Pointer-held mobile directional control moved the dozer. Portrait touch controls and toolbar targets measured at least 44 px; the landscape touch layout was also exercised with no horizontal overflow. Escape pause and resume were exercised, including a fix to prevent native dialog cancellation from immediately undoing the pause key.
- A completed-save browser fixture reopens the victory screen; the victory-lap button starts a fresh quarry with all equipment fully upgraded (including refinery level three) and both gates open.
- The full campaign accounting test delivers all 6,300 gems through the actual collector and awards $16,480 including three contract bonuses. Victory emits once. The test positions gems at the collector; it is not evidence of a full manual driving playthrough.
- The renderer inspection verifies two 40-link track batches actually change instance matrices under motion and remain exactly stable while paused. The same inspection also verifies conveyor slats and holograms move during play and freeze during pause. A key-pad completion changes the actual key material to green; the gate is partly lowered before becoming hidden. A 120-frame full-quarry inspection measured a 13.3 ms median frame interval and 17.9 ms p95 on this host, with 336 render calls and approximately 94,000 triangles. This is a bounded headless desktop measurement, not a physical-mobile performance claim.

The conveyor performance pass adds collision-equivalence tests, idle-sleep coverage, instanced belts and cached gem transforms. See [before/after stress measurements](performance.md). The timings above describe the earlier equipment pass; the performance report records the optimized build.

## Progression and feedback polish

- Sector restrictions are tested at every transition: basic equipment through level three in Quartz; level four plus the first three magnet levels in Citrine; final equipment tiers and the refinery in Amethyst.
- Refinery bonuses are paid once per gem and survive save round trips. Version-three saves keep existing equipment and escrow while adding an unfitted refinery.
- The browser polish check funds both deeper-sector pads with the real simulation, checks expanded platform dimensions and raised previews, confirms spent key pads disappear, and checks refinery drum rotation. It then exercises the real refinery HUD and payment coin animation on desktop and portrait mobile.
- Coin effects are capped at 30 nodes; pause holds arrivals, resume completes and removes them, and resetting clears active flights. Desktop and mobile screenshots show the expanded engine pad and its unobscured overhead progress.
- See the performance report for the same 600-gem conveyor fixture after this pass.

## Late-game physics pass

The wake footprint, crowd-aware magnet and 8/4 solver are qualified with four additional behavior tests and a repeatable 2,400-stone push/turn/brake fixture. See [late-game measurements and containment evidence](late-game-performance.md).

## Floating drag controls

Touch-emulated browser checks physically drive forward and reverse, verify heading is preserved when reversing, and confirm release braking. Multi-touch, cancellation, opening a panel and changing orientation clear the owning gesture. Portrait and landscape joystick screenshots are inspected. A rendering check round-trips four ground directions through each camera projection and the drag heading conversion. Two unit tests cover steering angle wraparound and reverse hysteresis.

## Remaining evaluation

- This is a playable first release. A full human campaign playthrough is still needed to judge long-term pacing and any awkward edge-case gem positions.
- Mobile layout and touch input can be checked in browser emulation; hardware performance and real touch ergonomics require a physical device.
- Audio generation is implemented and activated only after a user gesture. Subjective sound quality was not assessed by listening.
- Saves are browser-local. A denied or full storage area is reported in the HUD; there is no cloud sync.

Reproduce with the commands in the README. Browser evidence is written to ignored `.local/` files.


## Lucky Assay, overtime and reset

The unit suite enumerates all 64 crystal combinations to verify displayed odds and expected payouts. Tests cover rejected/insufficient stakes, net-win accounting, saved settled results, old-save migration, corrupt contract saves, one activity opening per visit, and reload while parked. Twelve complete overtime jobs verify sector rotation, the 900-body cap, exact bonus accounting, preserved upgrades and a free start with no coins. A real Matter collector test delivers overtime stones.

Run node tools/activities-check.mjs to drive onto the gold pad, place a wager, close during the reveal, reopen/reload without a second charge, and check portrait layout. It accepts a free overtime job with an empty bank, resumes it, physically collects its final gem, and starts the next sector. Reset cancellation keeps progress; confirmation resets the game while preserving an unrelated storage key. GILT_TEST_URL can target the deployed build. Screenshots are written under .local/.

The existing browser driving/save/victory check and touch-drag regression also pass. The late-game stress script, with 6,192 stones remaining and maximum magnet, measured p95 physics-plus-render-submission costs of 14.0 ms pushing, 10.0 ms turning and 7.2 ms braking on this Windows/Edge run; no escaped stones or browser errors. These are local CPU/submission measurements, not mobile-device FPS guarantees.

## Vacuum attachment and reel visuals

Six additional unit tests cover cargo capacity, ID conservation, save/reload during intake and discharge, gate/conveyor exclusions, Zone 3 costs and physical hopper dimensions, and overtime completion only after sale. The build and 43-test suite pass.

Run node tools/vacuum-check.mjs for rendered intake, full-bin and larger-bin frames, tipping hopper and opening rear gates, paused simulation, physical belt payment and the mobile cargo display. Lucky Assay's browser check also verifies moving reel strips, a complete triple reveal and cleaned-up strips, alongside interrupted-spin persistence.

With GILT_BENCH_VACUUM=3, the existing late-game stress script exercised the maximum vacuum and magnet together: 6,118 stones remained on the ground and 74 were carried. Local p95 physics-plus-render-submission costs were 12.2 ms pushing, 10.0 ms turning and 8.3 ms braking, with no escaped stones or browser errors. This is a Windows/Edge CPU/submission check, not a physical-phone FPS measurement.

The slot presentation now displays the neighboring symbols above and below the center payline. Browser checks verify geometric center alignment, exactly two highlighted symbols for a non-adjacent pair, three for a triple, and none for a loss. Neighbor symbols remain decorative; payout rules and the 93.75% RTP are unchanged. Desktop and portrait screenshots were inspected.

Reel continuity regression: scrolling and stopped symbols now share one persistent repeating belt. The browser check samples every animation frame for empty windows and replaced strip nodes, rotates the viewport mid-spin, and verifies exact center alignment after stopping. Completion follows the animation frame, without replacing the reel with a still image on a separate timer.

Lucky Assay's revised paytable returns 6.8x for triples and 1x for pairs: 98.75% RTP with a 1.25% house edge. Exhaustive tests cover all 64 outcomes at every allowed stake and verify whole-coin payouts. Historical 6x results retain their settled balance across repeated reloads. The 45-test suite, production build and local desktop/mobile activity regression pass. The browser check also asserts the revised paytable, return label and settled triple payout.

Compact mobile HUD and magnet reach: tools/mobile-hud-check.mjs verifies a full late-game cargo hold at 390x760, 360x640 and 844x390. Persistent HUD rectangles do not overlap and cover less than 23% of those viewports. Screenshots were inspected for portrait, landscape, nearby-platform details and optional direction buttons. The touch-drag regression passes forward/reverse/brake, multi-touch and cancellation checks. All 45 tests and the production build pass; magnet tests cover tier-four/five range boundaries, closed gates and packed sleeping ore at the expanded reach. An isolated Windows/Edge stress run with over 6,100 ground gems and maximum vacuum measured p95 physics plus render submission of 14.8/11.6/10.7 ms (push/turn/brake), versus 14.0/10.5/8.3 ms before. Median awake gems during pushing fell from 1,302 to 1,293. This is desktop timing evidence, not a physical-phone FPS guarantee.
