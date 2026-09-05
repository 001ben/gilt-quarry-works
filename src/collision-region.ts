import Matter from "matter-js";

/**
 * Keep Matter's solver and collision tests, but exclude distant sleeping bodies.
 * Called after integration (beforeSolve), so bounds include this step's motion.
 * The quarry has no constraints that could move bodies after this selection.
 */
export class CollisionRegion {
  private activeCells = new Set<number>();
  private cells(bounds: Matter.Bounds, visit: (key: number) => boolean) {
    for (
      let y = Math.floor(bounds.min.y / 64);
      y <= Math.floor(bounds.max.y / 64);
      y++
    )
      for (
        let x = Math.floor(bounds.min.x / 64);
        x <= Math.floor(bounds.max.x / 64);
        x++
      )
        // 1024 columns comfortably cover the bounded quarry, including its walls.
        if (visit(x + y * 1024)) return true;
    return false;
  }
  private mark = (key: number) => {
    this.activeCells.add(key);
    return false;
  };
  private contains = (key: number) => this.activeCells.has(key);
  select(bodies: Matter.Body[], output: Matter.Body[]) {
    this.activeCells.clear();
    output.length = 0;
    for (const body of bodies)
      if (!body.isStatic && !body.isSleeping)
        this.cells(body.bounds, this.mark);
    for (const body of bodies)
      if (
        body.isStatic ||
        !body.isSleeping ||
        this.cells(body.bounds, this.contains)
      )
        output.push(body);
  }
}
