// web/src/components/connection/line.ts

import type {ConnectionPathData} from './types';
import type {Cardinality} from '../../models/types';

export class LineComponent {
  static createGroup(data: ConnectionPathData, type: Cardinality): SVGGElement {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('connection-group');

    // Data attributes for interaction
    group.dataset.from = data.fromId;
    group.dataset.to = data.toId;
    group.dataset.fromTable = data.fromTableId;
    group.dataset.toTable = data.toTableId;

    // 1. Invisible thick path for easier hovering
    const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitPath.setAttribute('d', data.d);
    hitPath.classList.add('relation-hit-area');
    group.appendChild(hitPath);

    // 2. Visible Base Line (Solid)
    const baseLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    baseLine.setAttribute('d', data.d);
    baseLine.classList.add('relation-line-base');
    group.appendChild(baseLine);

    // 3. Flow Animation Line (Dashed & Moving)
    const flowLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    flowLine.setAttribute('d', data.d);
    flowLine.classList.add('relation-line-flow');
    group.appendChild(flowLine);

    // 4. Labels
    const labels = this.createLabels(data, type);
    labels.forEach(l => group.appendChild(l));

    return group;
  }

  private static createLabels(data: ConnectionPathData, type: Cardinality): SVGGElement[] {
    const labels = this.getLabelText(type);
    if (!labels) return [];
    return [
      this.createLabelBadge(labels.from, data.labelStart.x, data.labelStart.y),
      this.createLabelBadge(labels.to, data.labelEnd.x, data.labelEnd.y)
    ];
  }

  private static createLabelBadge(text: string, x: number, y: number): SVGGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('relation-label-group');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', (x - 9).toString());
    rect.setAttribute('y', (y - 7).toString());
    rect.setAttribute('width', '18');
    rect.setAttribute('height', '14');
    rect.setAttribute('rx', '4');
    rect.classList.add('label-bg');

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', x.toString());
    label.setAttribute('y', (y + 1).toString());
    label.classList.add('relation-label-text');
    label.textContent = text;

    g.appendChild(rect);
    g.appendChild(label);
    return g;
  }

  private static getLabelText(type: Cardinality): { from: string, to: string } | null {
    switch (type) {
      case '1:n':
        return {from: '1', to: 'n'};
      case 'n:1':
        return {from: 'n', to: '1'};
      case '1:1':
        return {from: '1', to: '1'};
      case 'm:n':
        return {from: 'm', to: 'n'};
      default:
        return null;
    }
  }
}