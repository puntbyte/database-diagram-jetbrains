// web/src/core/diagram/relationship-coordinator.ts

import { RelationshipManager } from '../../components/relationship';
import type { DbRelationship } from '../../models/types';

export class RelationshipCoordinator {
  readonly manager: RelationshipManager;

  constructor(container: HTMLElement, svgLayer: SVGSVGElement) {
    // Pass the persistent layer, it handles its own interactions securely
    this.manager = new RelationshipManager(container, svgLayer);
  }

  setStyle(style: string): void {
    this.manager.setStyle(style as any);
  }

  scheduleRender(relationships: DbRelationship[]): void {
    // FIX: A single requestAnimationFrame fires *before* the browser has
    // finished laying out newly-inserted HTML table elements.  Two nested rAFs
    // guarantee we measure elements only after the layout pass is complete,
    // so getBoundingClientRect() returns real coordinates instead of zeros.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.manager.draw(relationships);
      });
    });
  }
}