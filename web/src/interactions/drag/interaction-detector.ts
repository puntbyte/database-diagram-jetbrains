// web/src/interactions/drag/interaction-detector.ts

import type { EntityDragHandler } from './entity-drag-handler.ts';

export class DragInteractionDetector {
  private wrapper: HTMLElement;
  private handler: EntityDragHandler;

  constructor(
      wrapper: HTMLElement,
      handler: EntityDragHandler
  ) {
    this.wrapper = wrapper;
    this.handler = handler;
    this.bindEvents();
  }

  private bindEvents(): void {
    this.wrapper.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    window.addEventListener('mousemove', (e) => this.handler.handleMove(e));
    window.addEventListener('mouseup', () => this.handler.handleEnd());
  }

  private handleMouseDown(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    if (target.classList.contains('resize-handle')) {
      const parent = target.parentElement;
      if (parent) this.handler.beginResize(parent, event);
      return;
    }

    const table = target.closest('.db-table') as HTMLElement | null;
    if (table && (target.closest('.db-table-header') || target.closest('.semantic-overlay'))) {
      this.handler.beginDrag(table, event);
      return;
    }

    const note = target.closest('.sticky-note') as HTMLElement | null;
    if (note) {
      this.handler.beginDrag(note, event);
    }
  }
}