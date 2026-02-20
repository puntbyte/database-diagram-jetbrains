// web/src/interactions/panzoom-manager.ts

import panzoom, { type PanZoom } from 'panzoom';

export type OnZoomCallback = (scale: number) => void;
export type OnTransformCallback = (scale: number, x: number, y: number) => void;

export class PanZoomManager {
  private pz: PanZoom;
  private currentScale: number = 1;
  private currentX = 0;
  private currentY = 0;

  constructor(wrapper: HTMLElement, onZoom: OnZoomCallback, onTransform?: OnTransformCallback) {
    this.pz = panzoom(wrapper, {
      maxZoom: 3,
      minZoom: 0.2,
      bounds: false,
      beforeMouseDown: (e: MouseEvent | TouchEvent) => {
        const target = e.target as HTMLElement;
        return target.closest('.db-table') !== null;
      }
    });

    // Tracking logic
    const update = (e: any) => {
      const transform = e.getTransform();
      this.currentScale = transform.scale;
      this.currentX = transform.x || 0;
      this.currentY = transform.y || 0;
      onZoom(this.currentScale);
      if (onTransform) onTransform(this.currentScale, this.currentX, this.currentY);
    };

    this.pz.on('zoom', update);
    this.pz.on('pan', update);

    // Initial Center
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    this.pz.moveTo(-cx, -cy);
    this.currentX = -cx;
    this.currentY = -cy;
    if (onTransform) onTransform(1, -cx, -cy);
  }

  public getScale(): number {
    return this.currentScale;
  }

  public getTransform() {
    return { scale: this.currentScale, x: this.currentX, y: this.currentY };
  }

  // NEW METHOD: Used to restore state from DBML file
  public setTransform(scale: number, x: number, y: number) {
    this.pz.moveTo(x, y);
    this.pz.zoomAbs(0, 0, scale);
    this.currentScale = scale;
    this.currentX = x;
    this.currentY = y;
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
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    this.pz.moveTo(-cx, -cy);
    this.pz.zoomAbs(0, 0, 1);
    this.currentScale = 1;
    this.currentX = -cx;
    this.currentY = -cy;
  }

  public dispose() {
    this.pz.dispose();
  }
}