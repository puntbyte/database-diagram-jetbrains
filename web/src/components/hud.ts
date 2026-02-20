// web/src/components/hud.ts

import type {PanZoomManager} from '../interactions/panzoom-manager';
import type {ConnectionManager} from './connection/manager';
import type {LineStyle} from "./connection/types.ts";

export class HUDComponent {
  private el: HTMLElement;
  private container: HTMLElement;

  constructor(
      container: HTMLElement,
      panZoom: PanZoomManager,
      connectionManager: ConnectionManager
  ) {
    this.container = container;
    this.el = document.createElement('div');
    this.el.className = 'schema-hud';

    // 1. Zoom Controls (group)
    const zoomGroup = document.createElement('div');
    zoomGroup.className = 'hud-group';

    const btnIn = this.createButton('+', 'Zoom In');
    btnIn.onclick = () => panZoom.zoomIn();

    const btnOut = this.createButton('−', 'Zoom Out');
    btnOut.onclick = () => panZoom.zoomOut();

    const btnFit = this.createButton('⌂', 'Reset View');
    btnFit.onclick = () => panZoom.resetView();

    zoomGroup.append(btnIn, btnOut, btnFit);

    // 2. Line Style Dropdown (group)
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

      // notify host that a project setting changed
      this.dispatchProjectSettingsChange({ lineStyle: val });
    };

    styleGroup.appendChild(select);

    // 3. Grid toggle button (group)
    const gridGroup = document.createElement('div');
    gridGroup.className = 'hud-group';

    const gridBtn = this.createButton('▓', 'Toggle Grid');
    gridBtn.title = 'Toggle grid';
    // store state on the button
    gridBtn.dataset.state = 'off';
    gridBtn.onclick = () => {
      const state = gridBtn.dataset.state === 'on';
      const newState = !state;
      gridBtn.dataset.state = newState ? 'on' : 'off';
      // toggle CSS class on wrapper
      if (newState) this.container.querySelector('.schema-wrapper')?.classList.add('grid-visible');
      else this.container.querySelector('.schema-wrapper')?.classList.remove('grid-visible');

      // notify host of change
      this.dispatchProjectSettingsChange({ showGrid: newState });
    };

    gridGroup.appendChild(gridBtn);

    // Compose HUD groups. Because we use column-reverse the "first" group ends up
    // visually at the bottom and additional groups grow upwards.
    this.el.append(gridGroup, styleGroup, zoomGroup);
    container.appendChild(this.el);
  }

  private createButton(text: string, title: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'hud-btn';
    btn.innerText = text;
    btn.title = title;
    return btn;
  }

  private dispatchProjectSettingsChange(partial: Partial<{ lineStyle: LineStyle; showGrid: boolean; zoom: number; panX: number; panY: number }>) {
    const ev = new CustomEvent('project-settings-changed', { detail: partial });
    this.container.dispatchEvent(ev);
  }
}