// web/src/components/relationship/path/path-geometer.ts
import type {Rect, Point, LineStyle, EndpointsConfig} from '../types';

const PATH_CONFIG = {
  minStraight: 20,
  maxStraight: 80,
  laneWidth: 10,
  minUTurnOffset: 30,
  uTurnFactor: 0.2,
  // label sizing heuristics (kept in sync with LabelPlacer)
  labelOffset: 10,
  staggerMultiplier: 18,
  maxStagger: 2,
  // minimum horizontal length for outer segments to show labels comfortably
  minLabelSegment: 20,
  // minimum vertical separation to avoid label overlap
  minLabelVerticalSeparation: 10,
  // how strongly we stagger pivots per lane index (multiplier of laneWidth)
  pivotStaggerMultiplier: 1.4
} as const;

interface AnchorPoints {
  start: Point;
  end: Point;
  directionStart: number;
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
}

export class PathGeometer {
  calculate(
      fromRect: Rect,
      toRect: Rect,
      config: EndpointsConfig,
      style: LineStyle
  ): PathGeometry {
    const isUTurn = this.detectUTurn(fromRect, toRect);
    const anchors = this.calculateAnchorPoints(fromRect, toRect, config, isUTurn);
    const controls = this.calculateControlPoints(anchors, config, isUTurn, style);

    return {
      start: anchors.start,
      end: anchors.end,
      control1: controls.p1,
      control2: controls.p2,
      isUTurn
    };
  }

  private detectUTurn(fromRect: Rect, toRect: Rect): boolean {
    const overlap =
        fromRect.x < toRect.x + toRect.width && fromRect.x + fromRect.width > toRect.x;
    if (overlap) return true;

    const gap =
        fromRect.x < toRect.x
            ? toRect.x - (fromRect.x + fromRect.width)
            : fromRect.x - (toRect.x + toRect.width);

    const requiredPerSide =
        PATH_CONFIG.labelOffset + PATH_CONFIG.staggerMultiplier * PATH_CONFIG.maxStagger;
    const margin = 16;
    if (gap < requiredPerSide * 2 + margin) return true;

    return false;
  }

  private calculateAnchorPoints(
      fromRect: Rect,
      toRect: Rect,
      config: EndpointsConfig,
      isUTurn: boolean
  ): AnchorPoints {
    const fromY = this.calculateAnchorY(fromRect, config.fromColIndex, config.fromColTotal);
    const toY = this.calculateAnchorY(toRect, config.toColIndex, config.toColTotal);

    let startY = fromY;
    let endY = toY;

    if (isUTurn) {
      const fromCenterX = fromRect.x + fromRect.width / 2;
      const toCenterX = toRect.x + toRect.width / 2;
      const useLeftSide = fromCenterX > toCenterX;

      if (useLeftSide) {
        const startX = fromRect.x;
        const endX = toRect.x;

        const verticalSeparation = Math.abs(startY - endY);
        if (verticalSeparation < PATH_CONFIG.minLabelVerticalSeparation) {
          const half = (PATH_CONFIG.minLabelVerticalSeparation - verticalSeparation) / 2;
          if (startY < endY) {
            startY = startY - half;
            endY = endY + half;
          } else {
            startY = startY + half;
            endY = endY - half;
          }
        }

        return {
          start: {x: startX, y: startY},
          end: {x: endX, y: endY},
          directionStart: -1,
          directionEnd: -1
        };
      } else {
        const startX = fromRect.x + fromRect.width;
        const endX = toRect.x + toRect.width;

        const verticalSeparation = Math.abs(startY - endY);
        if (verticalSeparation < PATH_CONFIG.minLabelVerticalSeparation) {
          const half = (PATH_CONFIG.minLabelVerticalSeparation - verticalSeparation) / 2;
          if (startY < endY) {
            startY = startY - half;
            endY = endY + half;
          } else {
            startY = startY + half;
            endY = endY - half;
          }
        }

        return {
          start: {x: startX, y: startY},
          end: {x: endX, y: endY},
          directionStart: 1,
          directionEnd: 1
        };
      }
    }

    if (fromRect.x < toRect.x) {
      return {
        start: {x: fromRect.x + fromRect.width, y: startY},
        end: {x: toRect.x, y: endY},
        directionStart: 1,
        directionEnd: -1
      };
    } else {
      return {
        start: {x: fromRect.x, y: startY},
        end: {x: toRect.x + toRect.width, y: endY},
        directionStart: -1,
        directionEnd: 1
      };
    }
  }

  private calculateAnchorY(rect: Rect, index: number, total: number): number {
    if (total <= 1) return rect.y + rect.height / 2;
    return rect.y + (rect.height * (index + 1)) / (total + 1);
  }

  private calculateControlPoints(
      anchors: AnchorPoints,
      config: EndpointsConfig,
      isUTurn: boolean,
      style: LineStyle
  ): ControlPoints {
    const isOrthogonal = this.isOrthogonal(style);
    const horizontalDistance = Math.abs(anchors.end.x - anchors.start.x);

    let baseOffset = Math.max(
        PATH_CONFIG.minStraight,
        Math.min(PATH_CONFIG.maxStraight, horizontalDistance / 2)
    );

    const offsetFrom = baseOffset +
        (isOrthogonal ? config.fromLaneIndex * PATH_CONFIG.laneWidth : 0);
    const offsetTo = baseOffset + (isOrthogonal ? config.toLaneIndex * PATH_CONFIG.laneWidth : 0);

    let p1: Point = {
      x: anchors.start.x + offsetFrom * anchors.directionStart,
      y: anchors.start.y
    };
    let p2: Point = {
      x: anchors.end.x + offsetTo * anchors.directionEnd,
      y: anchors.end.y
    };

    if (isUTurn) {
      const pivotMid = (anchors.start.x + anchors.end.x) / 2;
      const verticalDistance = Math.abs(anchors.end.y - anchors.start.y);
      const uTurnOffset = Math.max(PATH_CONFIG.minUTurnOffset, verticalDistance *
          PATH_CONFIG.uTurnFactor);

      // compute base sign (+1 for right-side folds, -1 for left-side folds)
      const sign = anchors.directionStart > 0 ? 1 : -1;

      // base proposed pivot biased away from tables by offset
      let proposedPivot = pivotMid + sign * uTurnOffset;

      // STAGGER: compute a lane-derived lateral offset so multiple U-turns don't share same pivot
      // Use the difference of lane indexes as a simple, stable discriminator
      const laneDiff = (config.fromLaneIndex || 0) - (config.toLaneIndex || 0);
      const laneOffset = laneDiff * PATH_CONFIG.laneWidth * PATH_CONFIG.pivotStaggerMultiplier;
      // push outward in the same direction as sign to keep fold outside tables, add laneOffset
      proposedPivot = proposedPivot + sign * Math.abs(laneOffset);

      // ensure pivot is outside both table bounds with at least minLabelSegment spacing
      const leftBound = Math.min(anchors.start.x, anchors.end.x);
      const rightBound = Math.max(anchors.start.x, anchors.end.x);

      if (sign > 0) {
        const minPivot = rightBound + PATH_CONFIG.minLabelSegment;
        if (proposedPivot < minPivot) proposedPivot = minPivot;
      } else {
        const maxPivot = leftBound - PATH_CONFIG.minLabelSegment;
        if (proposedPivot > maxPivot) proposedPivot = maxPivot;
      }

      // Ensure the two horizontal arms are long enough; if short, push pivot further outward.
      const ensureSegments = () => {
        const seg1 = Math.abs(proposedPivot - anchors.start.x);
        const seg3 = Math.abs(anchors.end.x - proposedPivot);
        const minSeg = PATH_CONFIG.minLabelSegment;

        if (seg1 < minSeg || seg3 < minSeg) {
          const shortfall1 = Math.max(0, minSeg - seg1);
          const shortfall3 = Math.max(0, minSeg - seg3);

          // move pivot further outward by the larger shortfall
          const moveOut = Math.max(shortfall1, shortfall3);
          proposedPivot = proposedPivot + sign * moveOut;
        }
      };

      ensureSegments();

      // assign pivot to both control points (vertical fold)
      p1.x = proposedPivot;
      p2.x = proposedPivot;
      p1.y = anchors.start.y;
      p2.y = anchors.end.y;
    }

    return {p1, p2};
  }

  private isOrthogonal(style: LineStyle): boolean {
    return style === 'Rectilinear' || style === 'RoundRectilinear';
  }
}