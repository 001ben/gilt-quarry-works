# Verification — 2026-09-05

Environment: Windows, Node 24.18, Blender 5.0.1, headless Microsoft Edge, 1440×960 desktop and 390×844 mobile viewport.

## Verified

- Blender successfully generated the editable dozer, runtime GLB and rendered review image. The rendered game loads that GLB, preserving named upgrade groups and combining static meshes by material.
- TypeScript type check and Vite production build pass.
- Eight tests execute the actual Matter.js simulation: first-sweep delivery, locked gate collision and purchased passage, extended conveyor transport, upgrade geometry and position preservation, all engine speed limits and braking, full campaign accounting and victory, save round trip, and invalid save rejection.
- Browser keyboard driving delivered eight starter gems for $96. The workshop purchased engine level two for $90, leaving $6. Reload restored those funds, the engine level, and the eight credited gems.
- Browser runtime reported no uncaught page errors. Desktop, workshop and mobile viewport screenshots were inspected. The narrow-screen camera and contract panel were adjusted to keep the vehicle visible.
- Pointer-held mobile directional control moved the dozer. Escape pause and resume were exercised, including a fix to prevent native dialog cancellation from immediately undoing the pause key.
- A completed-save browser fixture reopens the victory screen; the victory-lap button starts a fresh quarry with all equipment at level five and both gates open.
- The full campaign accounting test delivers all 225 gems through the actual collector and awards $9,550 including three contract bonuses. Victory emits once. The test positions gems at the collector; it is not evidence of a full manual driving playthrough.

## Remaining evaluation

- This is a playable first release. A full human campaign playthrough is still needed to judge long-term pacing and any awkward edge-case gem positions.
- Mobile layout and touch input can be checked in browser emulation; hardware performance and real touch ergonomics require a physical device.
- Audio generation is implemented and activated only after a user gesture. Subjective sound quality was not assessed by listening.
- Saves are browser-local. A denied or full storage area is reported in the HUD; there is no cloud sync.

Reproduce with the commands in the README. Browser evidence is written to ignored `.local/` files.
