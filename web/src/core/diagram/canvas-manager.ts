// web/src/core/diagram/canvas-manager.ts

export class CanvasManager {
  readonly container: HTMLElement;
  readonly canvas: HTMLElement;
  readonly svgLayer: SVGSVGElement;
  readonly entityLayer: HTMLElement;

  constructor(containerId: string) {
    this.container = this.resolveContainer(containerId);

    this.canvas = document.createElement('div');
    this.canvas.className = 'diagram-canvas';

    // Layer 1: SVG Lines (Bottom)
    this.svgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgLayer.classList.add('relationship-layer');

    // FIX 1: Without explicit width/height="100%" the SVG defaults to 300x150px
    // in most browsers, which clips any path that exits that tiny box.
    this.svgLayer.setAttribute('width', '100%');
    this.svgLayer.setAttribute('height', '100%');

    // FIX 2: Allow the SVG to paint outside its own bounding box so lines that
    // connect tables near the edges of the viewport are never clipped.
    this.svgLayer.style.overflow = 'visible';

    // Layer 2: HTML Tables & Notes (Top)
    this.entityLayer = document.createElement('div');
    this.entityLayer.className = 'entity-layer';

    this.canvas.append(this.svgLayer, this.entityLayer);
    this.container.appendChild(this.canvas);
  }

  private resolveContainer(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Container #${id} not found`);
    return element;
  }

  clear(): void {
    // Safely wipe contents without destroying the layers or event listeners
    this.svgLayer.innerHTML = '';
    this.entityLayer.innerHTML = '';
  }

  showError(error: unknown): void {
    console.error('Diagram render failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    this.entityLayer.innerHTML = `
      <div class="diagram-error">
        <h3>Failed to load diagram</h3>
        <p>${this.escapeHtml(message)}</p>
      </div>
    `;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}