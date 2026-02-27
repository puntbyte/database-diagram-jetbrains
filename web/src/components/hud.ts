// web/src/components/hud.ts

import type {PanZoomManager} from '../interactions/panzoom-manager';
import {Icons} from './icons';

export class HUDComponent {
  private el: HTMLElement;
  private container: HTMLElement;

  constructor(
      container: HTMLElement,
      panZoom: PanZoomManager
      // Removed ConnectionManager dependency as we don't change line styles here anymore
  ) {
    this.container = container;
    this.el = document.createElement('div');
    this.el.className = 'schema-hud';

    // 1. Zoom Controls (Only group remaining)
    const zoomGroup = document.createElement('div');
    zoomGroup.className = 'hud-group';

    const btnIn = this.createButton(Icons.ZoomIn, 'Zoom In');
    btnIn.onclick = () => panZoom.zoomIn();

    const btnOut = this.createButton(Icons.ZoomOut, 'Zoom Out');
    btnOut.onclick = () => panZoom.zoomOut();

    const btnFit = this.createButton(Icons.Center, 'Reset View');
    btnFit.onclick = () => panZoom.resetView();

    zoomGroup.append(btnOut, btnFit, btnIn);

    this.el.append(zoomGroup);
    container.appendChild(this.el);
  }

  private createButton(iconHtml: string, title: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'hud-btn';
    btn.innerHTML = iconHtml;
    btn.title = title;
    return btn;
  }
}