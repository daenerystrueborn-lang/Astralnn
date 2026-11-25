export interface NavigationPoint { x: number; y: number; }
export interface NavigationBlocker { x: number; y: number; width: number; height: number; }

/** Small eight-way A* grid with a line-of-sight pass keeps tap movement clear of trunks. */
export function findRoute(start: NavigationPoint, requestedGoal: NavigationPoint, blockers: NavigationBlocker[], bounds: { width: number; height: number }): NavigationPoint[] {
  const cell = 34, margin = 70, clearance = 18;
  const columns = Math.ceil((bounds.width - margin * 2) / cell);
  const rows = Math.ceil((bounds.height - margin * 2) / cell);
  const center = (index: number): NavigationPoint => ({ x: margin + (index % columns + .5) * cell, y: margin + (Math.floor(index / columns) + .5) * cell });
  const indexOf = (point: NavigationPoint) => Math.max(0, Math.min(rows - 1, Math.floor((point.y - margin) / cell))) * columns + Math.max(0, Math.min(columns - 1, Math.floor((point.x - margin) / cell)));
  const blocked = (point: NavigationPoint) => point.x < margin || point.y < margin || point.x > bounds.width - margin || point.y > bounds.height - margin || blockers.some(blocker => point.x > blocker.x - clearance && point.x < blocker.x + blocker.width + clearance && point.y > blocker.y - clearance && point.y < blocker.y + blocker.height + clearance);
  const clearLine = (from: NavigationPoint, to: NavigationPoint) => {
    const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 9);
    for (let step = 1; step <= steps; step++) if (blocked({ x: from.x + (to.x - from.x) * step / steps, y: from.y + (to.y - from.y) * step / steps })) return false;
    return true;
  };
  let goal = { x: Math.max(margin + 2, Math.min(bounds.width - margin - 2, requestedGoal.x)), y: Math.max(margin + 2, Math.min(bounds.height - margin - 2, requestedGoal.y)) };
  if (!blocked(goal) && clearLine(start, goal)) return [goal];
  const walkable = Array.from({ length: columns * rows }, (_, index) => !blocked(center(index)));
  const startIndex = indexOf(start);
  walkable[startIndex] = true;
  let goalIndex = indexOf(goal);
  if (!walkable[goalIndex]) {
    const candidates = walkable.map((open, index) => ({ open, index, distance: Math.hypot(center(index).x - goal.x, center(index).y - goal.y) })).filter(candidate => candidate.open).sort((a, b) => a.distance - b.distance);
    if (!candidates.length) return [];
    goalIndex = candidates[0].index;
    goal = center(goalIndex);
  }
  const heuristic = (index: number) => Math.hypot(index % columns - goalIndex % columns, Math.floor(index / columns) - Math.floor(goalIndex / columns));
  const open = new Set([startIndex]);
  const closed = new Set<number>();
  const costs = new Map([[startIndex, 0]]);
  const previous = new Map<number, number>();
  while (open.size) {
    let current = -1, lowest = Infinity;
    for (const candidate of open) {
      const score = (costs.get(candidate) ?? Infinity) + heuristic(candidate);
      if (score < lowest) { lowest = score; current = candidate; }
    }
    if (current === goalIndex) {
      const indices = [current];
      while (previous.has(indices[0])) indices.unshift(previous.get(indices[0])!);
      const raw = indices.slice(1).map(center);
      if (clearLine(raw[raw.length - 1] ?? start, goal)) raw.push(goal);
      const result: NavigationPoint[] = [];
      let anchor = start;
      for (let index = 0; index < raw.length;) {
        let next = raw.length - 1;
        while (next > index && !clearLine(anchor, raw[next])) next--;
        result.push(raw[next]); anchor = raw[next]; index = next + 1;
      }
      return result;
    }
    open.delete(current); closed.add(current);
    const x = current % columns, y = Math.floor(current / columns);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= columns || ny < 0 || ny >= rows) continue;
      const neighbor = ny * columns + nx;
      if (!walkable[neighbor] || closed.has(neighbor)) continue;
      if (dx && dy && (!walkable[y * columns + nx] || !walkable[ny * columns + x])) continue;
      const candidateCost = (costs.get(current) ?? 0) + (dx && dy ? Math.SQRT2 : 1);
      if (candidateCost < (costs.get(neighbor) ?? Infinity)) { previous.set(neighbor, current); costs.set(neighbor, candidateCost); open.add(neighbor); }
    }
  }
  return [];
}
