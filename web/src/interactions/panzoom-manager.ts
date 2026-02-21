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
        // Prevent panning when clicking on a table to drag it
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
    this.pz.on('transform', update); // catch manual moves

    // --- INITIAL CENTER TO (0,0) ---
    // We want the logical point (0,0) of the canvas to be in the center of the screen.
    // To do this, we translate the wrapper by half the screen width/height.
    this.resetView();
  }

  public getScale(): number {
    return this.currentScale;
  }

  public getTransform() {
    return { scale: this.currentScale, x: this.currentX, y: this.currentY };
  }

  // Restores state from DBML file
  public setTransform(scale: number, x: number, y: number) {
    this.pz.zoomAbs(0, 0, 1); // Reset zoom scale first to avoid compounding math
    this.pz.moveTo(x, y);
    this.pz.zoomAbs(0, 0, scale);

    // Update internal state immediately
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
    // Center the origin (0,0) of the canvas in the viewport
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    // 1. Move (0,0) to center
    this.pz.moveTo(cx, cy);

    // 2. Reset Scale to 1
    this.pz.zoomAbs(0, 0, 1);

    // Update internal tracking
    this.currentX = cx;
    this.currentY = cy;
    this.currentScale = 1;
  }

  public dispose() {
    this.pz.dispose();
  }
}