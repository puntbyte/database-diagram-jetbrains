// web/src/components/connection/logic.ts

import type {Rect, Point, ConnectionPathData, LineStyle} from './types';

export class ConnectionLogic {
  private static readonly MIN_STRAIGHT = 15;
  private static readonly MAX_STRAIGHT = 40;
  private static readonly LABEL_OFFSET = 25;

  static calculatePath(
      fromRect: Rect, toRect: Rect,
      fromId: string, toId: string,
      fromTableId: string, toTableId: string,
      style: LineStyle = 'Curve'
  ): ConnectionPathData {
    const fromY = fromRect.y + fromRect.height / 2;
    const toY = toRect.y + toRect.height / 2;

    const fromRight = {x: fromRect.x + fromRect.width, y: fromY};
    const fromLeft = {x: fromRect.x, y: fromY};
    const toRight = {x: toRect.x + toRect.width, y: toY};
    const toLeft = {x: toRect.x, y: toY};

    const isUTurn = (fromRect.x < toRect.x + toRect.width) && (fromRect.x + fromRect.width > toRect.x);

    let start: Point, end: Point;
    let dirStart: number, dirEnd: number;

    if (isUTurn) {
      start = fromRight;
      end = toRight;
      dirStart = 1; dirEnd = 1;
    } else {
      if (fromRect.x < toRect.x) {
        start = fromRight;
        end = toLeft;
        dirStart = 1; dirEnd = -1;
      } else {
        start = fromLeft;
        end = toRight;
        dirStart = -1; dirEnd = 1;
      }
    }

    const distH = Math.abs(end.x - start.x);
    const offset = Math.max(this.MIN_STRAIGHT, Math.min(this.MAX_STRAIGHT, distH / 3));

    // Control points for bezier or corners for orthogonal
    const p1 = { x: start.x + (offset * dirStart), y: start.y };
    const p2 = { x: end.x + (offset * dirEnd), y: end.y };

    if (isUTurn) {
      const uTurnOffset = Math.max(40, Math.abs(end.y - start.y) * 0.4);
      p1.x = Math.max(start.x, end.x) + uTurnOffset;
      p2.x = p1.x;
    }

    let d = '';

    switch (style) {
      case 'Rectilinear':
      case 'RoundRectilinear': {
        const midX = (p1.x + p2.x) / 2;
        const corner1 = { x: midX, y: start.y };
        const corner2 = { x: midX, y: end.y };

        if (style === 'Rectilinear') {
          d = `M ${start.x} ${start.y} L ${corner1.x} ${corner1.y} L ${corner2.x} ${corner2.y} L ${end.x} ${end.y}`;
        } else {
          // Round Rectilinear
          const r = Math.min(15, Math.abs(corner2.y - corner1.y) / 2, Math.abs(corner1.x - start.x) / 2);
          const dirY = end.y > start.y ? 1 : -1;
          const dirX1 = corner1.x > start.x ? 1 : -1;
          const dirX2 = end.x > corner2.x ? 1 : -1;

          d = `M ${start.x} ${start.y} 
               L ${corner1.x - r * dirX1} ${corner1.y} 
               Q ${corner1.x} ${corner1.y} ${corner1.x} ${corner1.y + r * dirY} 
               L ${corner2.x} ${corner2.y - r * dirY} 
               Q ${corner2.x} ${corner2.y} ${corner2.x + r * dirX2} ${corner2.y} 
               L ${end.x} ${end.y}`;
        }
        break;
      }

      case 'Oblique':
      case 'RoundOblique': {
        if (style === 'Oblique') {
          d = `M ${start.x} ${start.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${end.x} ${end.y}`;
        } else {
          // Round Oblique (uses small bezier curves at the joints)
          d = `M ${start.x} ${start.y} 
               L ${p1.x} ${p1.y} 
               Q ${(p1.x + p2.x)/2} ${(p1.y + p2.y)/2} ${p2.x} ${p2.y} 
               L ${end.x} ${end.y}`;
        }
        break;
      }

      case 'Curve':
      default: {
        d = `M ${start.x} ${start.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${end.x} ${end.y}`;
        break;
      }
    }

    const labelStart = this.getLabelPos(start, p1);
    const labelEnd = this.getLabelPos(end, p2);

    return {d, start, end, labelStart, labelEnd, fromId, toId, fromTableId, toTableId};
  }

  private static getLabelPos(anchor: Point, target: Point): Point {
    const dx = target.x - anchor.x;
    const dy = target.y - anchor.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const ratio = this.LABEL_OFFSET / (dist || 1);
    return {x: anchor.x + dx * ratio, y: anchor.y + dy * ratio};
  }
}