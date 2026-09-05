const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

export function dragSteering(
  target: number,
  heading: number,
  reversing: boolean,
) {
  const delta = wrap(target - heading);
  if (!reversing && Math.abs(delta) > Math.PI * 0.75) reversing = true;
  else if (reversing && Math.abs(delta) < Math.PI * 0.5) reversing = false;
  return {
    reversing,
    steer: Math.max(
      -1,
      Math.min(1, wrap(delta + (reversing ? Math.PI : 0)) * 2),
    ),
  };
}

/** One captured pointer owns a floating joystick; other fingers can use the UI. */
export class DragControls {
  private pointer: number | null = null;
  private origin = { x: 0, y: 0 };
  private delta = { x: 0, y: 0 };
  private reversing = false;
  private braking = false;
  private stick = document.createElement("div");
  private knob = document.createElement("span");
  constructor(
    private canvas: HTMLCanvasElement,
    enabled: () => boolean,
  ) {
    this.stick.id = "drag-stick";
    this.stick.hidden = true;
    this.stick.setAttribute("aria-hidden", "true");
    this.stick.append(this.knob);
    canvas.parentElement!.append(this.stick);
    canvas.addEventListener("pointerdown", (e) => {
      if (!enabled() || this.pointer !== null || e.button !== 0) return;
      e.preventDefault();
      this.pointer = e.pointerId;
      this.origin = { x: e.clientX, y: e.clientY };
      this.delta = { x: 0, y: 0 };
      this.reversing = this.braking = false;
      this.stick.classList.remove("reversing");
      this.stick.style.left = e.clientX + "px";
      this.stick.style.top = e.clientY + "px";
      this.knob.style.transform = "translate(-50%, -50%)";
      this.stick.hidden = false;
      canvas.setPointerCapture(e.pointerId);
      canvas.focus({ preventScroll: true });
    });
    canvas.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.pointer) return;
      e.preventDefault();
      this.delta = {
        x: e.clientX - this.origin.x,
        y: e.clientY - this.origin.y,
      };
      const scale = Math.min(
        1,
        52 / (Math.hypot(this.delta.x, this.delta.y) || 1),
      );
      this.knob.style.transform = `translate(-50%, -50%) translate(${this.delta.x * scale}px, ${this.delta.y * scale}px)`;
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId !== this.pointer) return;
      this.cancel();
      this.braking = true;
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("lostpointercapture", release);
  }

  cancel() {
    const pointer = this.pointer;
    this.pointer = null;
    this.braking = false;
    this.stick.hidden = true;
    if (pointer !== null && this.canvas.hasPointerCapture(pointer))
      this.canvas.releasePointerCapture(pointer);
  }

  read(heading: number, screenHeading: (x: number, y: number) => number) {
    if (this.pointer === null)
      return this.braking ? { throttle: 0, steer: 0, brake: true } : null;
    const distance = Math.hypot(this.delta.x, this.delta.y);
    if (distance <= 8) return { throttle: 0, steer: 0, brake: true };
    const result = dragSteering(
      screenHeading(this.delta.x, this.delta.y),
      heading,
      this.reversing,
    );
    this.reversing = result.reversing;
    this.stick.classList.toggle("reversing", this.reversing);
    return {
      steer: result.steer,
      throttle: Math.min(1, (distance - 8) / 44) * (this.reversing ? -1 : 1),
      brake: false,
    };
  }
}
