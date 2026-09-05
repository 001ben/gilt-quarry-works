# Verification — 2026-09-05

Environment: Windows, Node 24.18, Blender 5.0.1, headless Microsoft Edge, 1440×960 desktop and 390×844 mobile viewport.

## Verified

- Blender successfully generated the editable dozer, runtime GLB and rendered review image. The rendered game loads that GLB, preserving named upgrade groups and combining static meshes by material.
- TypeScript type check and Vite production build pass.
- Fourteen tests cover the actual Matter.js simulation, vehicle-relative reverse and pivot turns, signed track travel, continuous chain sampling, exported blade triangle preservation and face raycasts, dense gem counts/bounds, and migration from the original save format.
- Browser keyboard driving with W delivered 135 starter gems for $135. The workshop purchased engine level two for $90, leaving $45. Reload restored those funds, the engine level, and the credited gems. Exact delivery counts can vary with screenshot and browser input timing.
- Browser runtime reported no uncaught page errors or console errors. Checking console errors now catches geometry-batching failures, which the original page-error-only check missed. Desktop, workshop, mobile viewport and runtime dozer close-up screenshots were inspected.
- Pointer-held mobile directional control moved the dozer. Escape pause and resume were exercised, including a fix to prevent native dialog cancellation from immediately undoing the pause key.
- A completed-save browser fixture reopens the victory screen; the victory-lap button starts a fresh quarry with all equipment at level five and both gates open.
- The full campaign accounting test delivers all 6,300 gems through the actual collector and awards $16,480 including three contract bonuses. Victory emits once. The test positions gems at the collector; it is not evidence of a full manual driving playthrough.
- The renderer inspection verifies two 40-link track batches actually change instance matrices under motion and remain exactly stable while paused. A 120-frame full-quarry inspection measured a 7.1 ms median frame interval and 9.2 ms p95 on this host, with 261 render calls and approximately 81,000 triangles. This is a bounded headless desktop measurement, not a physical-mobile performance claim.

## Remaining evaluation

- This is a playable first release. A full human campaign playthrough is still needed to judge long-term pacing and any awkward edge-case gem positions.
- Mobile layout and touch input can be checked in browser emulation; hardware performance and real touch ergonomics require a physical device.
- Audio generation is implemented and activated only after a user gesture. Subjective sound quality was not assessed by listening.
- Saves are browser-local. A denied or full storage area is reported in the HUD; there is no cloud sync.

Reproduce with the commands in the README. Browser evidence is written to ignored `.local/` files.
