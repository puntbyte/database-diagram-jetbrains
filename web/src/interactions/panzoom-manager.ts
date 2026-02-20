// web/src/interactions/panzoom-manager.ts

import panzoom, { type PanZoom } from 'panzoom';

export type OnZoomCallback = (scale: number) => void;

export class PanZoomManager {
  private pz: PanZoom;
  private currentScale: number = 1;

  constructor(wrapper: HTMLElement, onZoom: OnZoomCallback) {
    this.pz = panzoom(wrapper, {
      maxZoom: 3,
      minZoom: 0.2,
      bounds: false,
      beforeMouseDown: (e: MouseEvent | TouchEvent) => {
        const target = e.target as HTMLElement;
        return target.closest('.db-table') !== null;
      }
    });

    this.pz.on('zoom', (e: any) => {
      const transform = e.getTransform();
      this.currentScale = transform.scale;
      onZoom(this.currentScale);
    });
  }

  public getScale(): number {
    return this.currentScale;
  }

  public zoomIn() {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    this.pz.smoothZoom(cx, cy, 1.25);
  }

  public zoomOut() {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    this.pz.smoothZoom(cx, cy, 0.8);
  }

  public resetView() {
    this.pz.moveTo(0, 0);
    this.pz.zoomAbs(0, 0, 1);
  }

  public dispose() {
    this.pz.dispose();
  }
}