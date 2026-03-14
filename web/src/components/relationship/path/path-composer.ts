// web/src/components/relationship/path/path-composer.ts

import type {PathGeometry} from './path-geometer.ts';
import type {LineStyle, Point} from '../types';

const ROUND_CORNER_RADIUS = 12;

export class PathComposer {
  generate(geometry: PathGeometry, style: LineStyle): string {
    // When the user defined YAML waypoints, route through them using
    // the active line style (Curve = smooth spline, others = polyline ± rounded corners).
    if (geometry.resolvedWaypoints && geometry.resolvedWaypoints.length > 0) {
      return this.waypointPath(geometry, style);
    }

    switch (style) {
      case 'Rectilinear':
        return this.rectilinear(geometry, false);
      case 'RoundRectilinear':
        return this.rectilinear(geometry, true);
      case 'Oblique':
        return this.oblique(geometry, false);
      case 'RoundOblique':
        return this.oblique(geometry, true);
      case 'Curve':
      default:
        return this.curved(geometry);
    }
  }

  // ── Waypoint paths ────────────────────────────────────────────────────────

  private waypointPath(geometry: PathGeometry, style: LineStyle): string {
    const pts: Point[] = [geometry.start, ...geometry.resolvedWaypoints!, geometry.end];

    if (style === 'Curve') return this.catmullRomSpline(pts);

    const rounded = style === 'RoundRectilinear' || style === 'RoundOblique';
    if (!rounded) {
      return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    }
    return this.roundedPolyline(pts);
  }

  /** Catmull-Rom → cubic Bézier conversion for smooth splines through arbitrary points. */
  private catmullRomSpline(pts: Point[]): string {
    if (pts.length < 2) return '';
    if (pts.length === 2) {
      const mx = (pts[0].x + pts[1].x) / 2;
      return `M ${pts[0].x} ${pts[0].y} C ${mx} ${pts[0].y}, ${mx} ${pts[1].y}, ${pts[1].x} ${pts[1].y}`;
    }
    const p = [pts[0], ...pts, pts[pts.length - 1]]; // duplicate endpoints
    let d = `M ${p[1].x} ${p[1].y}`;
    const t = 1 / 3; // tension
    for (let i = 1; i < p.length - 2; i++) {
      const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
      const cp1x = p1.x + (p2.x - p0.x) * t;
      const cp1y = p1.y + (p2.y - p0.y) * t;
      const cp2x = p2.x - (p3.x - p1.x) * t;
      const cp2y = p2.y - (p3.y - p1.y) * t;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  /** Polyline with arc-rounded corners at each intermediate vertex. */
  private roundedPolyline(pts: Point[]): string {
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const prev = pts[i - 1], curr = pts[i], next = pts[i + 1];
      const r = Math.min(
          ROUND_CORNER_RADIUS,
          Math.hypot(curr.x - prev.x, curr.y - prev.y) / 2,
          Math.hypot(next.x - curr.x, next.y - curr.y) / 2
      );
      const [dxi, dyi] = [curr.x - prev.x, curr.y - prev.y];
      const [dxo, dyo] = [next.x - curr.x, next.y - curr.y];
      const li = Math.hypot(dxi, dyi) || 1, lo = Math.hypot(dxo, dyo) || 1;
      const enterX = curr.x - (dxi / li) * r, enterY = curr.y - (dyi / li) * r;
      const exitX = curr.x + (dxo / lo) * r, exitY = curr.y + (dyo / lo) * r;
      d += ` L ${enterX} ${enterY} Q ${curr.x} ${curr.y} ${exitX} ${exitY}`;
    }
    d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
    return d;
  }

  // ── Standard styles ───────────────────────────────────────────────────────

  private rectilinear(geo: PathGeometry, rounded: boolean): string {
    const midX = (geo.control1.x + geo.control2.x) / 2;
    const c1 = {x: midX, y: geo.start.y};
    const c2 = {x: midX, y: geo.end.y};

    if (!rounded) {
      return `M ${geo.start.x} ${geo.start.y} L ${c1.x} ${c1.y} L ${c2.x} ${c2.y} L ${geo.end.x} ${geo.end.y}`;
    }

    const r = Math.min(ROUND_CORNER_RADIUS, Math.abs(c2.y - c1.y) / 2, Math.abs(c1.x -
        geo.start.x) / 2);
    const dirY = geo.end.y > geo.start.y ? 1 : -1;
    const dx1 = c1.x > geo.start.x ? 1 : -1;
    const dx2 = geo.end.x > c2.x ? 1 : -1;

    return `M ${geo.start.x} ${geo.start.y} ` +
        `L ${c1.x - r * dx1} ${c1.y} Q ${c1.x} ${c1.y} ${c1.x} ${c1.y + r * dirY} ` +
        `L ${c2.x} ${c2.y - r * dirY} Q ${c2.x} ${c2.y} ${c2.x + r * dx2} ${c2.y} ` +
        `L ${geo.end.x} ${geo.end.y}`;
  }

  private oblique(geo: PathGeometry, rounded: boolean): string {
    if (!rounded) {
      return `M ${geo.start.x} ${geo.start.y} L ${geo.control1.x} ${geo.control1.y} L ${geo.control2.x} ${geo.control2.y} L ${geo.end.x} ${geo.end.y}`;
    }
    const mx = (geo.control1.x + geo.control2.x) / 2;
    const my = (geo.control1.y + geo.control2.y) / 2;
    return `M ${geo.start.x} ${geo.start.y} L ${geo.control1.x} ${geo.control1.y} Q ${mx} ${my} ${geo.control2.x} ${geo.control2.y} L ${geo.end.x} ${geo.end.y}`;
  }

  private curved(geo: PathGeometry): string {
    return `M ${geo.start.x} ${geo.start.y} C ${geo.control1.x} ${geo.control1.y}, ${geo.control2.x} ${geo.control2.y}, ${geo.end.x} ${geo.end.y}`;
  }
}