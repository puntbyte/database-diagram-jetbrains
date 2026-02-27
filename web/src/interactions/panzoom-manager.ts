// web/src/interactions/panzoom-manager.ts

import panzoom, {type PanZoom} from 'panzoom';

export type OnZoomCallback = (scale: number) => void;
export type OnTransformCallback = (scale: number, x: number, y: number) => void;

export class PanZoomManager {
  private pz: PanZoom;
  private currentScale: number = 1;
  private currentX = 0;
  private currentY = 0;

  // Define limits here to reuse them
  private readonly minZoom = 0.2;
  private readonly maxZoom = 3;

  constructor(wrapper: HTMLElement, onZoom: OnZoomCallback, onTransform?: OnTransformCallback) {
    this.pz = panzoom(wrapper, {
      maxZoom: this.maxZoom,
      minZoom: this.minZoom,
      bounds: false,

      beforeMouseDown: (e: MouseEvent | TouchEvent) => {
        const target = e.target as HTMLElement;
        return target.closest('.db-table') !== null;
      },

      // Intercept Wheel for Fine-Tuned Zooming
      beforeWheel: (e: WheelEvent) => {
        if (!e.shiftKey) return false;

        // Choose the dominant axis (handles shift-converted horizontal scrolling)
        const useX = Math.abs(e.deltaX) > Math.abs(e.deltaY);
        let delta = useX ? e.deltaX : e.deltaY;

        // If we're using the horizontal axis (shift-mapped), invert it so direction
        // matches the vertical wheel behavior (so "wheel up" zooms in).
        if (useX) delta = -delta;

        // No movement -> nothing to do
        if (delta === 0) {
          // prevent default so the page doesn't scroll horizontally
          e.preventDefault();
          return true;
        }

        const isZoomIn = delta < 0; // negative means wheel up / toward user -> zoom in
        const factor = 0.05;
        const multiplier = isZoomIn ? (1 + factor) : (1 - factor);

        let targetScale = this.currentScale * multiplier;
        targetScale = Math.max(this.minZoom, Math.min(this.maxZoom, targetScale));

        e.preventDefault(); // stop the page from scrolling
        this.pz.zoomAbs(e.clientX, e.clientY, targetScale);
        return true;
      }
    });

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
    this.pz.on('transform', update);

    this.resetView();
  }

  public getScale(): number {
    return this.currentScale;
  }

  public getTransform() {
    return {scale: this.currentScale, x: this.currentX, y: this.currentY};
  }

  public setTransform(scale: number, x: number, y: number) {
    this.pz.zoomAbs(0, 0, 1);
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

    this.pz.moveTo(cx, cy);
    this.pz.zoomAbs(0, 0, 1);

    this.currentX = cx;
    this.currentY = cy;
    this.currentScale = 1;
  }

  public dispose() {
    this.pz.dispose();
  }
}