import type {Rect, Point, ConnectionPathData, LineStyle, EndpointsConfig} from './types';

export class ConnectionLogic {
  private static readonly MIN_STRAIGHT = 20;
  private static readonly MAX_STRAIGHT = 80; // Increased to allow more lanes
  private static readonly LANE_WIDTH = 10;   // Distance between parallel lines
  private static readonly LABEL_OFFSET = 25;

  static calculatePath(
      fromRect: Rect, toRect: Rect,
      fromId: string, toId: string,
      fromTableId: string, toTableId: string,
      style: LineStyle,
      config: EndpointsConfig
  ): ConnectionPathData {

    // 1. Vertical Anchor Spacing (Based on Column Grouping)
    const getAnchorY = (rect: Rect, idx: number, tot: number) => {
      if (tot <= 1) return rect.y + rect.height / 2;
      // Distribute evenly within the row height
      return rect.y + (rect.height * (idx + 1)) / (tot + 1);
    };

    const fromY = getAnchorY(fromRect, config.fromColIndex, config.fromColTotal);
    const toY = getAnchorY(toRect, config.toColIndex, config.toColTotal);

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

    // 2. Path Offset (Based on Table-Side Lane Grouping)
    // We use the lane index to push lines further out to prevent crossing
    const isOrthogonal = (style === 'Rectilinear' || style === 'RoundRectilinear');

    // Base distance calc
    const distH = Math.abs(end.x - start.x);
    let baseOffset = Math.max(this.MIN_STRAIGHT, Math.min(this.MAX_STRAIGHT, distH / 2));

    // Apply Lane Offsets
    // If we have many lanes, we might need to reduce the base slightly to make room,
    // or just let them expand. Here we let them expand.
    const offsetFrom = baseOffset + (isOrthogonal ? (config.fromLaneIndex * this.LANE_WIDTH) : 0);
    const offsetTo = baseOffset + (isOrthogonal ? (config.toLaneIndex * this.LANE_WIDTH) : 0);

    const p1 = { x: start.x + (offsetFrom * dirStart), y: start.y };
    const p2 = { x: end.x + (offsetTo * dirEnd), y: end.y };

    if (isUTurn) {
      const uTurnOffset = Math.max(40, Math.abs(end.y - start.y) * 0.5);
      // For U-Turns, we also stagger the "far" edge to prevent overlap
      const laneAdjust = isOrthogonal ? (Math.max(config.fromLaneIndex, config.toLaneIndex) * this.LANE_WIDTH) : 0;

      p1.x = Math.max(start.x, end.x) + uTurnOffset + laneAdjust;
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
          // Radius logic
          const r = Math.min(12, Math.abs(corner2.y - corner1.y) / 2, Math.abs(corner1.x - start.x) / 2);
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
        d = `M ${start.x} ${start.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${end.x} ${end.y}`;
        break;

      case 'RoundOblique':
        d = `M ${start.x} ${start.y} 
             L ${p1.x} ${p1.y} 
             Q ${(p1.x + p2.x)/2} ${(p1.y + p2.y)/2} ${p2.x} ${p2.y} 
             L ${end.x} ${end.y}`;
        break;

      case 'Curve':
      default:
        d = `M ${start.x} ${start.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${end.x} ${end.y}`;
        break;
    }

    const labelStart = this.getLabelPos(start, p1, config.fromStagger);
    const labelEnd = this.getLabelPos(end, p2, config.toStagger);

    return {
      d, start, end,
      labelStart: { text: config.fromLabel, pos: labelStart },
      labelEnd: { text: config.toLabel, pos: labelEnd },
      fromId, toId, fromTableId, toTableId
    };
  }

  private static getLabelPos(anchor: Point, target: Point, stagger: number): Point {
    const dx = target.x - anchor.x;
    const dy = target.y - anchor.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const offsetDist = this.LABEL_OFFSET + (stagger * 18);

    const ratio = offsetDist / (dist || 1);
    return {x: anchor.x + dx * ratio, y: anchor.y + dy * ratio};
  }
}