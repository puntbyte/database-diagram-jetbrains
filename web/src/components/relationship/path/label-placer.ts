// web/src/components/relationship/path/label-placer.ts

import type { Point } from '../types';
import type { PathGeometry } from './path-geometer.ts';
import type { EndpointsConfig } from '../types';

const LABEL_OFFSET = 25;
const STAGGER_MULTIPLIER = 18;

interface LabelPositions {
  start: Point;
  end: Point;
}

export class LabelPlacer {
  calculate(geometry: PathGeometry, config: EndpointsConfig): LabelPositions {
    return {
      start: this.calculateSingle(geometry.start, geometry.control1, config.fromStagger),
      end: this.calculateSingle(geometry.end, geometry.control2, config.toStagger)
    };
  }

  private calculateSingle(
      anchor: Point,
      target: Point,
      stagger: number
  ): Point {
    const dx = target.x - anchor.x;
    const dy = target.y - anchor.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const offsetDistance = LABEL_OFFSET + stagger * STAGGER_MULTIPLIER;
    const ratio = offsetDistance / (distance || 1);

    return {
      x: anchor.x + dx * ratio,
      y: anchor.y + dy * ratio
    };
  }
}