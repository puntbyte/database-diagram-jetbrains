// web/src/components/widgets/anchor-widget.ts

import type { Point } from '../relationship';

const SVG_NS = 'http://www.w3.org/2000/svg';
const PORT_RADIUS = 3.5;

export class AnchorWidget {
  static create(point: Point): SVGCircleElement {
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', point.x.toString());
    circle.setAttribute('cy', point.y.toString());
    circle.setAttribute('r', PORT_RADIUS.toString());
    circle.classList.add('anchor-port');
    return circle;
  }
}