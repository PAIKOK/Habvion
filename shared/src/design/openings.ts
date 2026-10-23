import type { HomeDesign, Door, WindowOpening } from "../types/home";
import { edgeLength, EPS } from "../lib/geometry";
import { deriveWalls, openingLine, spanOnWall } from "./walls";
import { DOOR_TYPES, WINDOW_TYPES } from "./openingTypes";
import { issue, type Issue, type ValidationResult } from "./actions";
export function validateOpening(d: HomeDesign, o: Door | WindowOpening): ValidationResult {
  const issues: Issue[] = [],
    p = openingLine(d, o),
    r = d.rooms.find((r) => r.id === o.roomId);
  if (!p || !r)
    return {
      ok: false,
      issues: [issue("opening/no-room", "The opening needs an existing room.", [o.id])],
    };
  const min =
    "doorType" in o ? DOOR_TYPES[o.doorType].minWidth : WINDOW_TYPES[o.windowType].minWidth;
  if (o.width < min)
    issues.push(
      issue("opening/too-narrow", `This type needs an opening at least ${min} ft wide.`, [o.id]),
    );
  if (
    o.offset - o.width / 2 < 0.5 - EPS ||
    o.offset + o.width / 2 > edgeLength(r, o.side) - 0.5 + EPS
  )
    issues.push(
      issue("opening/corner-clearance", "Keep at least 0.5 ft clear at both corners.", [
        o.id,
        r.id,
      ]),
    );
  const walls = deriveWalls(d).filter((w) => spanOnWall(p, w));
  const covered = walls.reduce((sum, w) => {
    const a = p.horizontal ? w.a.x : w.a.y,
      b = p.horizontal ? w.b.x : w.b.y;
    return sum + Math.max(0, Math.min(b, p.end) - Math.max(a, p.start));
  }, 0);
  if (covered < o.width - EPS)
    issues.push(
      issue("opening/no-wall", "The whole opening must sit on a derived wall, not an open edge.", [
        o.id,
      ]),
    );
  const top = o.height + ("sill" in o ? o.sill : 0);
  if (walls.some((w) => top > w.height + EPS))
    issues.push(issue("opening/too-high", "The opening extends above its wall.", [o.id]));
  for (const other of [...d.doors, ...d.windows]) {
    if (other.id === o.id) continue;
    const q = openingLine(d, other);
    if (
      q &&
      q.floor === p.floor &&
      q.horizontal === p.horizontal &&
      Math.abs(q.line - p.line) < EPS &&
      q.start < p.end - EPS &&
      q.end > p.start + EPS
    )
      issues.push(
        issue("opening/collision", "Two openings overlap on the same physical wall.", [
          o.id,
          other.id,
        ]),
      );
  }
  return { ok: !issues.some((i) => i.level === "error"), issues };
}
