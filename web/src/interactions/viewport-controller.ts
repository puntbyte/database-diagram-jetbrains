// web/src/interactions/viewport-controller.ts

import panzoom, {type PanZoom} from 'panzoom';

export type ZoomCallback = (scale: number) => void;
export type TransformCallback = (scale: number, x: number, y: number) => void;

interface ViewportConfig {
  minZoom: number;
  maxZoom: number;
  zoomStep: number;
  smoothZoomFactor: number;
}

const DEFAULT_CONFIG: ViewportConfig = {
  minZoom: 0.2,
  maxZoom: 3,
  zoomStep: 0.05,
  smoothZoomFactor: 1.25
};

interface Transform {
  scale: number;
  x: number;
  y: number;
}

export class ViewportController {
  private panzoom: PanZoom;
  private config: ViewportConfig;

  private currentTransform: Transform = {scale: 1, x: 0, y: 0};

  private readonly onZoom: ZoomCallback;
  private readonly onTransform?: TransformCallback;


  constructor(
      container: HTMLElement,
      onZoom: ZoomCallback,
      onTransform?: TransformCallback,
      config: Partial<ViewportConfig> = {}
  ) {
    this.onZoom = onZoom;
    this.onTransform = onTransform;
    this.config = {...DEFAULT_CONFIG, ...config};
    this.panzoom = this.initializePanzoom(container);
    this.setupEventHandlers();
    this.centerView();
  }

  private initializePanzoom(container: HTMLElement): PanZoom {
    return panzoom(container, {
      maxZoom: this.config.maxZoom,
      minZoom: this.config.minZoom,
      bounds: false,
      beforeMouseDown: (e) => this.shouldIgnoreMouseDown(e),
      beforeWheel: (e) => this.handleWheelZoom(e)
    });
  }

  private shouldIgnoreMouseDown(event: MouseEvent | TouchEvent): boolean {
    // Ignore if clicking on a table (let drag manager handle it)
    const target = event.target as HTMLElement;
    return target.closest('.db-table') !== null;
  }

  private handleWheelZoom(event: WheelEvent): boolean {
    if (!event.shiftKey) return false; // Allow default scroll

    const isHorizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    let delta = isHorizontal ? -event.deltaX : event.deltaY;

    if (delta === 0) {
      event.preventDefault();
      return true;
    }

    const zoomIn = delta < 0;
    const factor = zoomIn ? (1 + this.config.zoomStep) : (1 - this.config.zoomStep);
    const targetScale = this.clampZoom(this.currentTransform.scale * factor);

    event.preventDefault();
    this.panzoom.zoomAbs(event.clientX, event.clientY, targetScale);
    return true;
  }

  private clampZoom(scale: number): number {
    return Math.max(this.config.minZoom, Math.min(this.config.maxZoom, scale));
  }

  private setupEventHandlers(): void {
    const handleTransform = (e: { getTransform: () => Transform }) => {
      const t = e.getTransform();
      this.currentTransform = {scale: t.scale, x: t.x || 0, y: t.y || 0};

      this.onZoom(this.currentTransform.scale);
      this.onTransform?.(this.currentTransform.scale, this.currentTransform.x, this.currentTransform.y);
    };

    this.panzoom.on('zoom', handleTransform);
    this.panzoom.on('pan', handleTransform);
    this.panzoom.on('transform', handleTransform);
  }

  getScale(): number {
    return this.currentTransform.scale;
  }

  getTransform(): Transform {
    return {...this.currentTransform};
  }

  setTransform(scale: number, x: number, y: number): void {
    // Reset then apply for precise positioning
    this.panzoom.zoomAbs(x, y, 1);
    this.panzoom.moveTo(x, y);
    this.panzoom.zoomAbs(x, y, scale);

    this.currentTransform = {scale, x, y};
  }

  zoomIn(): void {
    this.smoothZoomAtCenter(this.config.smoothZoomFactor);
  }

  zoomOut(): void {
    this.smoothZoomAtCenter(1 / this.config.smoothZoomFactor);
  }

  private smoothZoomAtCenter(factor: number): void {
    const center = this.getViewportCenter();
    this.panzoom.smoothZoom(center.x, center.y, factor);
  }

  private getViewportCenter(): { x: number; y: number } {
    const container = document.getElementById('app');
    return {
      x: (container?.clientWidth || window.innerWidth) / 2,
      y: (container?.clientHeight || window.innerHeight) / 2
    };
  }

  centerView(): void {
    const center = this.getViewportCenter();
    this.setTransform(1, center.x, center.y);
  }

  resetView(): void {
    this.centerView();
  }

  dispose(): void {
    this.panzoom.dispose();
  }
}