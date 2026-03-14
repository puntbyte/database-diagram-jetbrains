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

  // The canvas element we attach panzoom to — used for cursor management.
  private readonly canvas: HTMLElement;

  constructor(
      container: HTMLElement,
      onZoom: ZoomCallback,
      onTransform?: TransformCallback,
      config: Partial<ViewportConfig> = {}
  ) {
    this.onZoom = onZoom;
    this.onTransform = onTransform;
    this.config = {...DEFAULT_CONFIG, ...config};
    this.canvas = container;
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
      beforeWheel: (e) => this.handleWheelZoom(e),
      // FIX: Suppress panzoom's own cursor management so we can set
      // grab/grabbing ourselves in a predictable, consolidated way.
      onTouch: () => false
    });
  }

  private shouldIgnoreMouseDown(event: MouseEvent | TouchEvent): boolean {
    const target = event.target as HTMLElement;
    // Let the drag handler own table elements; let panzoom own the canvas.
    const ignore = target.closest('.db-table') !== null ||
        target.closest('.sticky-note') !== null ||
        target.closest('.toolbar-widget') !== null;
    if (!ignore) {
      // FIX: Switch to grabbing cursor the moment panzoom is about to start
      // panning, so the user gets immediate visual feedback.
      this.canvas.style.cursor = 'grabbing';
    }
    return ignore;
  }

  private handleWheelZoom(event: WheelEvent): boolean {
    if (!event.shiftKey) return false;

    const isHorizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    const delta = isHorizontal ? -event.deltaX : event.deltaY;
    if (delta === 0) {
      event.preventDefault();
      return true;
    }

    const factor = delta < 0 ? 1 + this.config.zoomStep : 1 - this.config.zoomStep;
    const targetScale = this.clampZoom(this.currentTransform.scale * factor);
    event.preventDefault();
    this.panzoom.zoomAbs(event.clientX, event.clientY, targetScale);
    return true;
  }

  private clampZoom(scale: number): number {
    return Math.max(this.config.minZoom, Math.min(this.config.maxZoom, scale));
  }

  private setupEventHandlers(): void {
    const onTransform = (e: { getTransform: () => Transform }) => {
      const t = e.getTransform();
      this.currentTransform = {scale: t.scale, x: t.x || 0, y: t.y || 0};
      this.onZoom(this.currentTransform.scale);
      this.onTransform?.(this.currentTransform.scale, this.currentTransform.x, this.currentTransform.y);
    };

    this.panzoom.on('zoom', onTransform);
    this.panzoom.on('pan', onTransform);
    this.panzoom.on('transform', onTransform);

    // FIX: Restore grab cursor when panning ends (mouseup / touchend on the canvas).
    // We listen at the document level so releasing outside the canvas is also caught.
    const onPanEnd = () => {
      // Only restore if the drag handler isn't currently active (it manages its own cursor).
      if (document.body.style.cursor !== 'se-resize' &&
          document.body.style.cursor !== 'grabbing') {
        this.canvas.style.cursor = 'grab';
      }
    };

    document.addEventListener('mouseup', onPanEnd);
    document.addEventListener('touchend', onPanEnd);

    // FIX: Apply grab cursor on the canvas immediately so it's visible before
    // the first interaction, giving a clear panning affordance.
    this.canvas.style.cursor = 'grab';
  }

  getScale(): number {
    return this.currentTransform.scale;
  }

  getTransform(): Transform {
    return {...this.currentTransform};
  }

  setTransform(scale: number, x: number, y: number): void {
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
    const center = this.viewportCenter();
    this.panzoom.smoothZoom(center.x, center.y, factor);
  }

  private viewportCenter(): { x: number; y: number } {
    const container = document.getElementById('app');
    return {
      x: (container?.clientWidth ?? window.innerWidth) / 2,
      y: (container?.clientHeight ?? window.innerHeight) / 2
    };
  }

  centerView(): void {
    const center = this.viewportCenter();
    this.setTransform(1, center.x, center.y);
  }

  resetView(): void {
    this.centerView();
  }

  dispose(): void {
    this.panzoom.dispose();
  }
}