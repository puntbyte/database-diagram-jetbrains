// web/src/components/widgets/relationship-widget.ts

import type { ConnectionPathData } from '../relationship';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class RelationshipWidget {
  static createGroup(data: ConnectionPathData): SVGGElement {
    const group = document.createElementNS(SVG_NS, 'g');
    group.classList.add('relationship-group');

    // Set metadata attributes
    group.dataset.from = data.fromId;
    group.dataset.to = data.toId;
    group.dataset.fromTable = data.fromTableId;
    group.dataset.toTable = data.toTableId;

    // Create visual layers
    const hitArea = this.createHitArea(data.d);
    const baseLine = this.createBaseLine(data.d);
    const flowLine = this.createFlowLine(data.d);
    const labels = this.createLabels(data);

    group.append(hitArea, baseLine, flowLine, ...labels);
    return group;
  }

  private static createHitArea(pathData: string): SVGPathElement {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', pathData);
    path.classList.add('relation-hit-area');
    return path;
  }

  static createBaseLine(pathData: string): SVGPathElement {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', pathData);
    path.classList.add('relation-line-base');
    return path;
  }

  static createFlowLine(pathData: string): SVGPathElement {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', pathData);
    path.classList.add('relation-line-flow');
    return path;
  }

  private static createLabels(data: ConnectionPathData): SVGGElement[] {
    const labels: SVGGElement[] = [];

    if (data.labelStart.text) {
      labels.push(this.createLabelBadge(
          data.labelStart.text,
          data.labelStart.pos.x,
          data.labelStart.pos.y
      ));
    }

    if (data.labelEnd.text) {
      labels.push(this.createLabelBadge(
          data.labelEnd.text,
          data.labelEnd.pos.x,
          data.labelEnd.pos.y
      ));
    }

    return labels;
  }

  private static createLabelBadge(text: string, x: number, y: number): SVGGElement {
    const group = document.createElementNS(SVG_NS, 'g');
    group.classList.add('relation-label-group');

    const background = this.createLabelBackground(x, y);
    const label = this.createLabelText(text, x, y);

    group.append(background, label);
    return group;
  }

  private static createLabelBackground(x: number, y: number): SVGRectElement {
    const rect = document.createElementNS(SVG_NS, 'rect');
    const width = 18;
    const height = 14;

    rect.setAttribute('x', (x - width / 2).toString());
    rect.setAttribute('y', (y - height / 2 + 1).toString()); // +1 for visual centering
    rect.setAttribute('width', width.toString());
    rect.setAttribute('height', height.toString());
    rect.setAttribute('rx', '4');
    rect.classList.add('label-bg');

    return rect;
  }

  private static createLabelText(text: string, x: number, y: number): SVGTextElement {
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', x.toString());
    label.setAttribute('y', (y + 1).toString()); // +1 for visual centering
    label.classList.add('relation-label-text');
    label.textContent = text;
    return label;
  }
}