# Verification — 2026-09-05

Environment: Windows, Node 24.18, Blender 5.0.1, headless Microsoft Edge, 1440×960 and 2560×1440 desktop, 390×844 portrait mobile viewport, and 844×390 landscape with touch emulation.

## Verified

- Blender successfully generated the editable dozer, runtime GLB and rendered review image. The rendered game loads that GLB, preserving named upgrade groups and combining static meshes by material.
- TypeScript type check and Vite production build pass.
- Nineteen tests cover the actual Matter.js simulation, vehicle-relative reverse and pivot turns, signed track travel, continuous chain sampling, exported blade triangle preservation and face raycasts, dense gem counts/bounds, migration from both older save formats, platform escrow/reload/completion, free-key refunds, delayed gate collision removal, full conveyor reach, and magnet strength/direction/gate boundaries.
- Browser keyboard driving with W delivered 132 starter gems for $132. A saved fixture approaching the engine pad was driven onto it with W, paid $90 in installments from a $240 wallet, and fitted engine level two. Further time parked did not spend more. Reload restored collection progress and funds. Exact delivery counts vary with browser input timing.
- Browser runtime reported no uncaught page errors or console errors. Checking console errors now catches geometry-batching failures, which the original page-error-only check missed. Desktop, funding platform, portrait/landscape mobile and runtime magnet close-up screenshots were inspected.
- Pointer-held mobile directional control moved the dozer. Portrait touch controls and toolbar targets measured at least 44 px; the landscape touch layout was also exercised with no horizontal overflow. Escape pause and resume were exercised, including a fix to prevent native dialog cancellation from immediately undoing the pause key.
- A completed-save browser fixture reopens the victory screen; the victory-lap button starts a fresh quarry with all equipment at level five and both gates open.
- The full campaign accounting test delivers all 6,300 gems through the actual collector and awards $16,480 including three contract bonuses. Victory emits once. The test positions gems at the collector; it is not evidence of a full manual driving playthrough.
- The renderer inspection verifies two 40-link track batches actually change instance matrices under motion and remain exactly stable while paused. The same inspection also verifies conveyor slats and holograms move during play and freeze during pause. A key-pad completion changes the actual key material to green; the gate is partly lowered before becoming hidden. A 120-frame full-quarry inspection measured a 13.3 ms median frame interval and 17.9 ms p95 on this host, with 336 render calls and approximately 94,000 triangles. This is a bounded headless desktop measurement, not a physical-mobile performance claim.

## Remaining evaluation

- This is a playable first release. A full human campaign playthrough is still needed to judge long-term pacing and any awkward edge-case gem positions.
- Mobile layout and touch input can be checked in browser emulation; hardware performance and real touch ergonomics require a physical device.
- Audio generation is implemented and activated only after a user gesture. Subjective sound quality was not assessed by listening.
- Saves are browser-local. A denied or full storage area is reported in the HUD; there is no cloud sync.

Reproduce with the commands in the README. Browser evidence is written to ignored `.local/` files.
