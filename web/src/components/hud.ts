// web/src/components/hud.ts

import type {LineStyle} from '../models/types';
import type {PanZoomManager} from '../interactions/panzoom-manager';
import type {ConnectionManager} from './connection/manager';

export class HUDComponent {
  private el: HTMLElement;

  constructor(
      container: HTMLElement,
      panZoom: PanZoomManager,
      connectionManager: ConnectionManager
  ) {
    this.el = document.createElement('div');
    this.el.className = 'schema-hud';

    // 1. Zoom Controls
    const zoomGroup = document.createElement('div');
    zoomGroup.className = 'hud-group';

    const btnIn = this.createButton('+', 'Zoom In');
    btnIn.onclick = () => panZoom.zoomIn();

    const btnOut = this.createButton('−', 'Zoom Out');
    btnOut.onclick = () => panZoom.zoomOut();

    const btnFit = this.createButton('⌂', 'Reset View');
    btnFit.onclick = () => panZoom.resetView();

    zoomGroup.append(btnIn, btnOut, btnFit);

    // 2. Line Style Dropdown
    const styleGroup = document.createElement('div');
    styleGroup.className = 'hud-group';

    const select = document.createElement('select');
    select.className = 'hud-select';
    select.title = "Connection Line Style";

    const options: { value: LineStyle, text: string }[] = [
      {value: 'Curve', text: 'Curve'},
      {value: 'Rectilinear', text: 'Rectilinear'},
      {value: 'RoundRectilinear', text: 'Round Rectilinear'},
      {value: 'Oblique', text: 'Oblique'},
      {value: 'RoundOblique', text: 'Round Oblique'},
    ];

    options.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.innerText = opt.text;
      select.appendChild(o);
    });

    select.onchange = (e) => {
      const val = (e.target as HTMLSelectElement).value as LineStyle;
      connectionManager.setLineStyle(val);
    };

    styleGroup.appendChild(select);

    // Add to HUD
    this.el.append(zoomGroup, styleGroup);
    container.appendChild(this.el);
  }

  private createButton(text: string, title: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'hud-btn';
    btn.innerText = text;
    btn.title = title;
    return btn;
  }
}