// web/src/components/connection/anchor.ts

import type {Point} from './types';

export class AnchorComponent {
  static create(point: Point): SVGCircleElement {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', point.x.toString());
    circle.setAttribute('cy', point.y.toString());
    circle.setAttribute('r', '3.5');
    circle.classList.add('anchor-port');
    return circle;
  }
}