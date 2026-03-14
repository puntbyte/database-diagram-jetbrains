// web/src/components/relationship/path/path-geometer.ts

import type {Rect, Point, LineStyle, EndpointsConfig, WayPoint} from '../types';

const PATH_CONFIG = {
  minStraight: 20,
  maxStraight: 80,
  laneWidth: 10,
  minUTurnOffset: 30,
  uTurnFactor: 0.2,
  labelOffset: 10,
  staggerMultiplier: 18,
  maxStagger: 2,
  minLabelSegment: 20,
  minLabelVerticalSeparation: 10,
  pivotStaggerMultiplier: 1.4
} as const;

interface AnchorPoints {
  start: Point;
  end: Point;
  directionStart: number;  // +1 = right, -1 = left
  directionEnd: number;
}

interface ControlPoints {
  p1: Point;
  p2: Point;
}

export interface PathGeometry {
  start: Point;
  end: Point;
  control1: Point;
  control2: Point;
  isUTurn: boolean;
  /** Resolved absolute canvas waypoints when user defined them in YAML */
  resolvedWaypoints?: Point[];
}

export class PathGeometer {
  calculate(
      fromRect: Rect,
      toRect: Rect,
      config: EndpointsConfig,
      style: LineStyle
  ): PathGeometry {
    // FIX: Self-referencing tables (fromTable === toTable) must always fold to
    // the LEFT side so the line doesn't run across the table body.
    const isSelfRef = config.isSelfReference ?? false;
    const isUTurn = isSelfRef || this.detectUTurn(fromRect, toRect);

    const anchors = this.calculateAnchorPoints(fromRect, toRect, config, isUTurn, isSelfRef);

    // If YAML waypoints exist, resolve them to absolute canvas coords and return
    // early — the PathComposer will handle the multi-segment path.
    if (config.waypoints && config.waypoints.length > 0) {
      const resolved = this.resolveWaypoints(anchors, config.waypoints);
      const c1 = resolved[0] ?? anchors.start;
      const c2 = resolved[resolved.length - 1] ?? anchors.end;
      return {
        start: anchors.start,
        end: anchors.end,
        control1: c1,
        control2: c2,
        isUTurn,
        resolvedWaypoints: resolved
      };
    }

    const controls = this.calculateControlPoints(anchors, config, isUTurn, style);
    return {
      start: anchors.start,
      end: anchors.end,
      control1: controls.p1,
      control2: controls.p2,
      isUTurn
    };
  }

  // ── Waypoint resolution ──────────────────────────────────────────────────

  private resolveWaypoints(anchors: AnchorPoints, waypoints: WayPoint[]): Point[] {
    return waypoints.map(wp => {
      // `x` is outward from the anchor (positive = away from the table edge).
      // `y` is downward from the column-row centre.
      if (wp.from === 'source') {
        return {x: anchors.start.x + wp.x * anchors.directionStart, y: anchors.start.y + wp.y};
      } else {
        return {x: anchors.end.x + wp.x * anchors.directionEnd, y: anchors.end.y + wp.y};
      }
    });
  }

  // ── U-turn detection ─────────────────────────────────────────────────────

  private detectUTurn(fromRect: Rect, toRect: Rect): boolean {
    const overlap = fromRect.x < toRect.x + toRect.width && fromRect.x + fromRect.width > toRect.x;
    if (overlap) return true;

    const gap =
        fromRect.x < toRect.x
            ? toRect.x - (fromRect.x + fromRect.width)
            : fromRect.x - (toRect.x + toRect.width);

    const requiredPerSide = PATH_CONFIG.labelOffset + PATH_CONFIG.staggerMultiplier *
        PATH_CONFIG.maxStagger;
    return gap < requiredPerSide * 2 + 16;
  }

  // ── Anchor points ────────────────────────────────────────────────────────

  private calculateAnchorPoints(
      fromRect: Rect,
      toRect: Rect,
      config: EndpointsConfig,
      isUTurn: boolean,
      isSelfRef: boolean
  ): AnchorPoints {
    const fromY = this.anchorY(fromRect, config.fromColIndex, config.fromColTotal);
    const toY = this.anchorY(toRect, config.toColIndex, config.toColTotal);

    // Explicit YAML anchor overrides take priority.
    if (config.sourceAnchor || config.targetAnchor) {
      return this.buildExplicitAnchors(fromRect, toRect, fromY, toY, config);
    }

    if (isUTurn) {
      // FIX: Self-referencing relations always fold left so the arc appears
      // beside the table, not across it.  Without this fix, when fromCenterX
      // equals toCenterX (same table) `useLeftSide` was false (right-side fold)
      // which drew the line through the middle of the card.
      const useLeft = isSelfRef || (fromRect.x + fromRect.width / 2) >
          (toRect.x + toRect.width / 2);
      return this.buildUTurnAnchors(fromRect, toRect, fromY, toY, useLeft);
    }

    // Normal left-to-right or right-to-left.
    return fromRect.x < toRect.x
        ? {
          start: {x: fromRect.x + fromRect.width, y: fromY},
          end: {x: toRect.x, y: toY},
          directionStart: 1,
          directionEnd: -1
        }
        : {
          start: {x: fromRect.x, y: fromY},
          end: {x: toRect.x + toRect.width, y: toY},
          directionStart: -1,
          directionEnd: 1
        };
  }

  private buildExplicitAnchors(
      fromRect: Rect, toRect: Rect,
      fromY: number, toY: number,
      config: EndpointsConfig
  ): AnchorPoints {
    const sa = config.sourceAnchor ?? (fromRect.x < toRect.x ? 'right' : 'left');
    const ta = config.targetAnchor ?? (toRect.x < fromRect.x ? 'right' : 'left');
    return {
      start: {x: sa === 'right' ? fromRect.x + fromRect.width : fromRect.x, y: fromY},
      end: {x: ta === 'right' ? toRect.x + toRect.width : toRect.x, y: toY},
      directionStart: sa === 'right' ? 1 : -1,
      directionEnd: ta === 'right' ? 1 : -1
    };
  }

  private buildUTurnAnchors(
      fromRect: Rect, toRect: Rect,
      startY: number, endY: number,
      useLeft: boolean
  ): AnchorPoints {
    // Ensure the two endpoints have a minimum vertical separation so labels don't collide.
    const sep = PATH_CONFIG.minLabelVerticalSeparation;
    const diff = Math.abs(startY - endY);
    if (diff < sep) {
      const half = (sep - diff) / 2;
      if (startY <= endY) {
        startY -= half;
        endY += half;
      } else {
        startY += half;
        endY -= half;
      }
    }

    return useLeft
        ? {
          start: {x: fromRect.x, y: startY},
          end: {x: toRect.x, y: endY},
          directionStart: -1,
          directionEnd: -1
        }
        : {
          start: {x: fromRect.x + fromRect.width, y: startY},
          end: {x: toRect.x + toRect.width, y: endY},
          directionStart: 1,
          directionEnd: 1
        };
  }

  private anchorY(rect: Rect, index: number, total: number): number {
    return total <= 1 ? rect.y + rect.height / 2 : rect.y + (rect.height * (index + 1)) /
        (total + 1);
  }

  // ── Control points ───────────────────────────────────────────────────────

  private calculateControlPoints(
      anchors: AnchorPoints,
      config: EndpointsConfig,
      isUTurn: boolean,
      style: LineStyle
  ): ControlPoints {
    const isOrthogonal = style === 'Rectilinear' || style === 'RoundRectilinear';
    const hDist = Math.abs(anchors.end.x - anchors.start.x);
    const baseOffset = Math.max(PATH_CONFIG.minStraight, Math.min(PATH_CONFIG.maxStraight, hDist /
        2));

    const offsetFrom = baseOffset +
        (isOrthogonal ? config.fromLaneIndex * PATH_CONFIG.laneWidth : 0);
    const offsetTo = baseOffset + (isOrthogonal ? config.toLaneIndex * PATH_CONFIG.laneWidth : 0);

    let p1: Point = {x: anchors.start.x + offsetFrom * anchors.directionStart, y: anchors.start.y};
    let p2: Point = {x: anchors.end.x + offsetTo * anchors.directionEnd, y: anchors.end.y};

    if (isUTurn) {
      const pivotMid = (anchors.start.x + anchors.end.x) / 2;
      const vDist = Math.abs(anchors.end.y - anchors.start.y);
      const uOffset = Math.max(PATH_CONFIG.minUTurnOffset, vDist * PATH_CONFIG.uTurnFactor);
      const sign = anchors.directionStart > 0 ? 1 : -1;
      const laneOff = ((config.fromLaneIndex || 0) - (config.toLaneIndex || 0)) *
          PATH_CONFIG.laneWidth * PATH_CONFIG.pivotStaggerMultiplier;
      let pivot = pivotMid + sign * (uOffset + Math.abs(laneOff));

      const leftBound = Math.min(anchors.start.x, anchors.end.x);
      const rightBound = Math.max(anchors.start.x, anchors.end.x);
      if (sign > 0 && pivot < rightBound + PATH_CONFIG.minLabelSegment) pivot =
          rightBound + PATH_CONFIG.minLabelSegment;
      if (sign < 0 && pivot > leftBound - PATH_CONFIG.minLabelSegment) pivot =
          leftBound - PATH_CONFIG.minLabelSegment;

      const s1 = Math.abs(pivot - anchors.start.x);
      const s2 = Math.abs(anchors.end.x - pivot);
      const shortage = Math.max(0, PATH_CONFIG.minLabelSegment - Math.min(s1, s2));
      if (shortage > 0) pivot += sign * shortage;

      p1 = {x: pivot, y: anchors.start.y};
      p2 = {x: pivot, y: anchors.end.y};
    }

    return {p1, p2};
  }
}