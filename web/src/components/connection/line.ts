// web/src/components/connection/line.ts

import type {ConnectionPathData} from './types';

export class LineComponent {
  static createGroup(data: ConnectionPathData): SVGGElement {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('connection-group');

    group.dataset.from = data.fromId;
    group.dataset.to = data.toId;
    group.dataset.fromTable = data.fromTableId;
    group.dataset.toTable = data.toTableId;

    const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitPath.setAttribute('d', data.d);
    hitPath.classList.add('relation-hit-area');
    group.appendChild(hitPath);

    const baseLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    baseLine.setAttribute('d', data.d);
    baseLine.classList.add('relation-line-base');
    group.appendChild(baseLine);

    const flowLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    flowLine.setAttribute('d', data.d);
    flowLine.classList.add('relation-line-flow');
    group.appendChild(flowLine);

    // Labels
    const labels = this.createLabels(data);
    labels.forEach(l => group.appendChild(l));

    return group;
  }

  private static createLabels(data: ConnectionPathData): SVGGElement[] {
    const labels: SVGGElement[] = [];
    if (data.labelStart.text) {
      labels.push(this.createLabelBadge(data.labelStart.text, data.labelStart.pos.x, data.labelStart.pos.y));
    }
    if (data.labelEnd.text) {
      labels.push(this.createLabelBadge(data.labelEnd.text, data.labelEnd.pos.x, data.labelEnd.pos.y));
    }
    return labels;
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
}