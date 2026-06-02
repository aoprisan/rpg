// A* pathfinding over the dungeon walkability grid. 4-directional movement
// (no diagonal cutting through wall corners) keeps the Diablo-style feel clean.

export interface GridLike {
  width: number;
  height: number;
  isWalkable(x: number, y: number): boolean;
}

interface Node {
  x: number;
  y: number;
  g: number;
  f: number;
  parent: Node | null;
}

const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function heuristic(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by); // Manhattan
}

/**
 * Returns a list of grid waypoints from start to goal (inclusive of goal,
 * excluding start), or null if unreachable. Coordinates are integer tiles.
 */
export function findPath(
  grid: GridLike,
  sx: number,
  sy: number,
  gx: number,
  gy: number,
): { x: number; y: number }[] | null {
  sx = Math.round(sx);
  sy = Math.round(sy);
  gx = Math.round(gx);
  gy = Math.round(gy);

  if (!grid.isWalkable(gx, gy)) return null;
  if (sx === gx && sy === gy) return [];

  const key = (x: number, y: number) => y * grid.width + x;
  const open = new Map<number, Node>();
  const openHeap: Node[] = [];
  const closed = new Set<number>();

  const start: Node = { x: sx, y: sy, g: 0, f: heuristic(sx, sy, gx, gy), parent: null };
  open.set(key(sx, sy), start);
  openHeap.push(start);

  let iterations = 0;
  const maxIterations = grid.width * grid.height * 4;

  while (openHeap.length > 0) {
    if (iterations++ > maxIterations) return null;

    // Pop lowest f (linear scan; grids here are small enough).
    let bestIdx = 0;
    for (let i = 1; i < openHeap.length; i++) {
      if (openHeap[i].f < openHeap[bestIdx].f) bestIdx = i;
    }
    const current = openHeap.splice(bestIdx, 1)[0];
    const ck = key(current.x, current.y);
    open.delete(ck);
    closed.add(ck);

    if (current.x === gx && current.y === gy) {
      const path: { x: number; y: number }[] = [];
      let n: Node | null = current;
      while (n && n.parent) {
        path.push({ x: n.x, y: n.y });
        n = n.parent;
      }
      path.reverse();
      return path;
    }

    for (const [dx, dy] of NEIGHBORS) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
      if (!grid.isWalkable(nx, ny)) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;

      const g = current.g + 1;
      const existing = open.get(nk);
      if (!existing) {
        const node: Node = { x: nx, y: ny, g, f: g + heuristic(nx, ny, gx, gy), parent: current };
        open.set(nk, node);
        openHeap.push(node);
      } else if (g < existing.g) {
        existing.g = g;
        existing.f = g + heuristic(nx, ny, gx, gy);
        existing.parent = current;
      }
    }
  }

  return null;
}
