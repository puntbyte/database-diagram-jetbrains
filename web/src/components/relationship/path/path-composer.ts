// web/src/components/relationship/path/path-composer.ts

import type { PathGeometry } from './path-geometer.ts';
import type { LineStyle } from '../types';

const ROUND_CORNER_RADIUS = 12;

export class PathComposer {
  generate(geometry: PathGeometry, style: LineStyle): string {
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

  private rectilinear(geo: PathGeometry, rounded: boolean): string {
    const midX = (geo.control1.x + geo.control2.x) / 2;
    const corner1 = { x: midX, y: geo.start.y };
    const corner2 = { x: midX, y: geo.end.y };

    if (!rounded) {
      return `M ${geo.start.x} ${geo.start.y} ` +
          `L ${corner1.x} ${corner1.y} ` +
          `L ${corner2.x} ${corner2.y} ` +
          `L ${geo.end.x} ${geo.end.y}`;
    }

    const r = Math.min(
        ROUND_CORNER_RADIUS,
        Math.abs(corner2.y - corner1.y) / 2,
        Math.abs(corner1.x - geo.start.x) / 2
    );

    const dirY = geo.end.y > geo.start.y ? 1 : -1;
    const dirX1 = corner1.x > geo.start.x ? 1 : -1;
    const dirX2 = geo.end.x > corner2.x ? 1 : -1;

    return `M ${geo.start.x} ${geo.start.y} ` +
        `L ${corner1.x - r * dirX1} ${corner1.y} ` +
        `Q ${corner1.x} ${corner1.y} ${corner1.x} ${corner1.y + r * dirY} ` +
        `L ${corner2.x} ${corner2.y - r * dirY} ` +
        `Q ${corner2.x} ${corner2.y} ${corner2.x + r * dirX2} ${corner2.y} ` +
        `L ${geo.end.x} ${geo.end.y}`;
  }

  private oblique(geo: PathGeometry, rounded: boolean): string {
    if (!rounded) {
      return `M ${geo.start.x} ${geo.start.y} ` +
          `L ${geo.control1.x} ${geo.control1.y} ` +
          `L ${geo.control2.x} ${geo.control2.y} ` +
          `L ${geo.end.x} ${geo.end.y}`;
    }

    const midX = (geo.control1.x + geo.control2.x) / 2;
    const midY = (geo.control1.y + geo.control2.y) / 2;

    return `M ${geo.start.x} ${geo.start.y} ` +
        `L ${geo.control1.x} ${geo.control1.y} ` +
        `Q ${midX} ${midY} ${geo.control2.x} ${geo.control2.y} ` +
        `L ${geo.end.x} ${geo.end.y}`;
  }

  private curved(geo: PathGeometry): string {
    return `M ${geo.start.x} ${geo.start.y} ` +
        `C ${geo.control1.x} ${geo.control1.y}, ` +
        `${geo.control2.x} ${geo.control2.y}, ` +
        `${geo.end.x} ${geo.end.y}`;
  }
}