import test from "node:test";
import assert from "node:assert/strict";
import { dragSteering } from "../src/drag-controls";

test("drag steering follows a heading and backs toward a target behind the machine", () => {
  const forward = dragSteering(0.2, 0, false);
  assert.equal(forward.reversing, false);
  assert.ok(Math.abs(forward.steer - 0.4) < 1e-10);
  const backward = dragSteering(Math.PI, 0, false);
  assert.equal(backward.reversing, true);
  assert.ok(Math.abs(backward.steer) < 1e-10);
  assert.ok(
    Math.abs(dragSteering(-Math.PI + 0.05, Math.PI - 0.05, false).steer - 0.2) <
      1e-10,
  );
});

test("reverse hysteresis avoids oscillation while dragging sideways", () => {
  const target = Math.PI * 0.6;
  assert.equal(dragSteering(target, 0, false).reversing, false);
  assert.equal(dragSteering(target, 0, true).reversing, true);
  assert.equal(dragSteering(Math.PI * 0.4, 0, true).reversing, false);
});
