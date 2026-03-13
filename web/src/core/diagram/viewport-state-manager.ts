// web/src/core/diagram/viewport-drug-state-manager.ts

import { ViewportController } from '../../interactions/viewport-controller';
import { ToolbarWidget } from '../../components/widgets/toolbar-widget.ts';
import type { TransformState } from './types';
import type { ViewSettings } from '../communication/protocol';

const ZOOM_THRESHOLD = 0.5;

export class ViewportStateManager {
  private readonly panZoomController: ViewportController;
  private controls: ToolbarWidget;
  private isInitialRender = true;
  private currentTransform: TransformState = { scale: 1, x: 0, y: 0 };

  private readonly container: HTMLElement;
  private readonly canvas: HTMLElement;
  private readonly onTransformChange?: (state: TransformState) => void;

  constructor(
      container: HTMLElement,
      canvas: HTMLElement,
      onTransformChange?: (state: TransformState) => void
  ) {
    this.container = container;
    this.canvas = canvas;
    this.onTransformChange = onTransformChange;
    this.panZoomController = this.initializePanZoom();
    this.controls = this.createControls();
  }

  private initializePanZoom(): ViewportController {
    return new ViewportController(
        this.canvas,
        (scale) => this.handleZoomUpdate(scale),
        (scale, x, y) => this.handleTransformUpdate(scale, x, y)
    );
  }

  private handleZoomUpdate(scale: number): void {
    this.currentTransform.scale = scale;
    this.updateZoomStyles(scale);
  }

  private handleTransformUpdate(scale: number, x: number, y: number): void {
    this.currentTransform = { scale, x, y };
    this.updateZoomStyles(scale, x, y);
    this.onTransformChange?.(this.currentTransform);
  }

  private updateZoomStyles(scale: number, x?: number, y?: number): void {
    const isSemanticZoom = scale < ZOOM_THRESHOLD;
    this.canvas.classList.toggle('semantic-zoom', isSemanticZoom);
    this.container.style.setProperty('--zoom', scale.toString());

    if (x !== undefined && y !== undefined) {
      this.container.style.setProperty('--pan-x', `${x}px`);
      this.container.style.setProperty('--pan-y', `${y}px`);
    }
  }

  private createControls(): ToolbarWidget {
    this.container.querySelector('.viewport-controls')?.remove();
    return new ToolbarWidget(this.container, this.panZoomController);
  }

  reinitializeControls(): void {
    if (this.controls) {
      this.controls.destroy(); // Safely destroy the old one!
    }
    this.controls = new ToolbarWidget(this.container, this.panZoomController);
  }

  applyGridSettings(settings: ViewSettings): void {
    this.container.style.setProperty('--grid-size', `${settings.gridSize}px`);
    this.container.classList.toggle('grid-visible', settings.showGrid);
  }

  getTransform(): TransformState {
    return this.panZoomController.getTransform();
  }

  applyInitialOrRestoreTransform(transform: TransformState): void {
    if (this.isInitialRender) {
      this.applyInitialTransform(transform);
    } else {
      this.restoreTransform(transform);
    }
    this.isInitialRender = false;
  }

  private applyInitialTransform(transform: TransformState): void {
    const hasSavedPosition = transform.x !== 0 || transform.y !== 0 || transform.scale !== 1;
    if (hasSavedPosition) {
      this.panZoomController.setTransform(transform.scale, transform.x, transform.y);
      this.updateZoomStyles(transform.scale, transform.x, transform.y);
    }
  }

  private restoreTransform(transform: TransformState): void {
    this.container.style.setProperty('--zoom', transform.scale.toString());
    this.container.style.setProperty('--pan-x', `${transform.x}px`);
    this.container.style.setProperty('--pan-y', `${transform.y}px`);
  }
}