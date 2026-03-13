// web/src/components/relationship/relationship-manager.ts

import type {DbRelationship} from '../../models/types';
import type {LineStyle, Rect} from './types';
import {RelationshipRenderer} from './relationship-renderer.ts';
import {RelationshipInteraction} from './relationship-interaction.ts';
import {RelationshipLayout} from "./layout/relationship-layout.ts";

export class RelationshipManager {
  private readonly svgLayer: SVGSVGElement;
  private scale = 1;

  private currentRelationships: DbRelationship[] = [];
  private currentStyle: LineStyle = 'Curve';
  private rectCache = new Map<string, Rect>();

  private layoutEngine: RelationshipLayout;
  private renderer: RelationshipRenderer;
  private interactions: RelationshipInteraction;

  constructor(container: HTMLElement, svgLayer: SVGSVGElement) {
    this.svgLayer = svgLayer;

    this.layoutEngine = new RelationshipLayout({
      getRect: (id) => this.getCachedRect(id),
      resolveTableId: (schema, table) => this.buildTableId(schema, table),
      getLabel: (type, isFrom) => this.parseCardinality(type, isFrom)
    });

    this.renderer = new RelationshipRenderer(this.svgLayer, () => this.scale);
    this.interactions = new RelationshipInteraction(container, this.svgLayer);
    this.interactions.bind();
  }

  setScale(scale: number): void {
    this.scale = scale;
  }

  setStyle(style: LineStyle): void {
    this.currentStyle = style;
    this.draw(this.currentRelationships);
  }

  draw(relationships: DbRelationship[]): void {
    this.currentRelationships = relationships;

    // FIX: Read the CSS --zoom variable from the *container* (#app), not the
    // svgLayer itself.  The svgLayer never has --zoom set on it directly, so
    // the previous read always returned an empty string and scale stayed at 1
    // even when the user had panned/zoomed.  We now walk up the DOM to find
    // the first ancestor that carries the variable.
    try {
      let el: HTMLElement | null = this.svgLayer.parentElement;
      while (el) {
        const cssZoom = getComputedStyle(el).getPropertyValue('--zoom').trim();
        const parsed = parseFloat(cssZoom);
        if (!Number.isNaN(parsed) && parsed > 0) {
          this.scale = parsed;
          break;
        }
        el = el.parentElement;
      }
    } catch (_e) { /* ignore */ }

    this.rectCache.clear();

    while (this.svgLayer.firstChild) {
      this.svgLayer.removeChild(this.svgLayer.firstChild);
    }

    const canvasEl = this.svgLayer.closest('.diagram-canvas') as HTMLElement | null;
    const isSemanticZoom = !!(canvasEl && canvasEl.classList.contains('semantic-zoom'));

    const layout = this.layoutEngine.prepareLayout(relationships);
    this.layoutEngine.distributeColumnSpacing(layout.columnGroups, layout.relationshipConfigs);
    this.layoutEngine.distributeLaneSpacing(layout.tableSideGroups, layout.relationshipConfigs);

    this.renderer.render(relationships, layout.relationshipConfigs, this.currentStyle, isSemanticZoom);
  }

  private getCachedRect(elementId: string): Rect | undefined {
    if (!this.rectCache.has(elementId)) {
      const rect = this.measureElement(elementId);
      if (rect) this.rectCache.set(elementId, rect);
    }
    return this.rectCache.get(elementId);
  }

  private measureElement(elementId: string): Rect | undefined {
    const element = document.getElementById(elementId);
    if (!element) return undefined;

    const elementRect = element.getBoundingClientRect();
    const containerRect = this.svgLayer.getBoundingClientRect();

    // FIX: Guard against zero-size containers (happens on first render before
    // the browser has painted).  Return undefined so the caller skips the
    // relationship rather than drawing it at (0,0).
    if (containerRect.width === 0 && containerRect.height === 0) return undefined;

    return {
      x: (elementRect.left - containerRect.left) / this.scale,
      y: (elementRect.top - containerRect.top) / this.scale,
      width: elementRect.width / this.scale,
      height: elementRect.height / this.scale
    };
  }

  private buildTableId(_schema: string, table: string): string {
    // Match the Kotlin backend which uses the raw table name as the ID
    return table;
  }

  private parseCardinality(relationshipType: string, isSource: boolean): string {
    // Safely handle Kotlin's "many_to_one" string if it doesn't use the ":" format
    if (!relationshipType.includes(':')) {
      return ''; // Hide label if it's not in standard 1:n format
    }
    const [source, target] = relationshipType.split(':');
    return isSource ? source : target;
  }
}