// web/src/interactions/drag/entity-drag-handler.ts

import {RelationshipManager} from '../../components/relationship';
import type {DbRelationship} from '../../models/types';
import {DragStateManager} from './drug-state-manager.ts';
import {TablePositionNotifier} from './table-notifier';
import {NotePositionNotifier} from './note-notifier';
import {DragInteractionDetector} from "./interaction-detector";

export type TablePositionCallback = (
    tableName: string,
    x: number,
    y: number,
    width?: number
) => void;

export class EntityDragHandler {
  private readonly stateManager: DragStateManager;
  private readonly interactionDetector: DragInteractionDetector;
  private readonly tableNotifier: TablePositionNotifier;
  private readonly noteNotifier: NotePositionNotifier;

  private relationshipManager: RelationshipManager;
  private relationships: DbRelationship[] = [];
  private scale = 1;

  constructor(
      wrapper: HTMLElement,
      relationshipManager: RelationshipManager,
      onPositionUpdate: TablePositionCallback
  ) {
    this.relationshipManager = relationshipManager;
    this.stateManager = new DragStateManager();
    this.tableNotifier = new TablePositionNotifier(onPositionUpdate);
    this.noteNotifier = new NotePositionNotifier(wrapper);

    this.interactionDetector = new DragInteractionDetector(wrapper, this);
  }

  updateConnectionManager(manager: RelationshipManager): void {
    this.relationshipManager = manager;
  }

  setRelationships(relationships: DbRelationship[]): void {
    this.relationships = relationships;
  }

  updateScale(scale: number): void {
    this.scale = scale;
  }

  beginDrag(element: HTMLElement, event: MouseEvent): void {
    this.stateManager.beginDrag(element, event);
    this.preventEvent(event);
  }

  beginResize(element: HTMLElement, event: MouseEvent): void {
    this.stateManager.beginResize(element, event);
    document.body.style.cursor = 'nwse-resize';
    this.preventEvent(event);
  }

  handleMove(event: MouseEvent): void {
    const state = this.stateManager.getState();
    if (state.mode === 'idle') return;

    const delta = this.calculateDelta(event);
    const el = state.element;
    if (!el) return;

    if (state.mode === 'dragging') {
      this.updateDragPosition(el, delta);
    } else if (state.mode === 'resizing') {
      this.updateResizeDimensions(el, delta);
    }
  }

  private calculateDelta(event: MouseEvent): { x: number; y: number } {
    const start = this.stateManager.getStartMouse();
    // FIX: Read the live scale from the CSS variable instead of the
    // (potentially stale) this.scale field, which is only refreshed on
    // full schema loads and goes stale after any pan/zoom.
    const liveScale = this.readLiveScale();
    return {
      x: (event.clientX - start.x) / liveScale,
      y: (event.clientY - start.y) / liveScale
    };
  }

  // FIX: Read the current zoom scale directly from the CSS variable set by
  // ViewportStateManager.  This is always up-to-date, even when the user
  // zooms between two interactions without triggering a schema reload.
  private readLiveScale(): number {
    try {
      let el: HTMLElement | null = document.getElementById('app');
      if (el) {
        const v = getComputedStyle(el).getPropertyValue('--zoom').trim();
        const n = parseFloat(v);
        if (!isNaN(n) && n > 0) return n;
      }
    } catch (_) { /* ignore */ }
    return this.scale; // fallback to last known scale
  }

  private updateDragPosition(element: HTMLElement, delta: { x: number; y: number }): void {
    const start = this.stateManager.getStartValues();
    element.style.left = `${start.x + delta.x}px`;
    element.style.top = `${start.y + delta.y}px`;
    element.style.transform = 'none';

    if (element.classList.contains('db-table')) {
      requestAnimationFrame(() => {
        this.relationshipManager.draw(this.relationships);
      });
    }
  }

  private updateResizeDimensions(
      element: HTMLElement,
      delta: { x: number; y: number }
  ): void {
    const start = this.stateManager.getStartValues();
    const newWidth = Math.max(100, start.width + delta.x);
    element.style.width = `${newWidth}px`;

    if (element.classList.contains('sticky-note')) {
      const newHeight = Math.max(100, start.height + delta.y);
      element.style.height = `${newHeight}px`;
    }

    if (element.classList.contains('db-table')) {
      requestAnimationFrame(() => {
        this.relationshipManager.draw(this.relationships);
      });
    }
  }

  handleEnd(): void {
    const state = this.stateManager.getState();
    if (state.mode === 'idle' || !state.element) return;

    const rect = this.calculateFinalRect(state.element);

    if (state.element.classList.contains('db-table')) {
      this.tableNotifier.notify(state.element, rect);
    } else if (state.element.classList.contains('sticky-note')) {
      this.noteNotifier.notify(state.element, rect);
    }

    this.cleanup(state.element);
  }

  private calculateFinalRect(element: HTMLElement): {
    x: number; y: number; width: number; height: number;
  } {
    // FIX: Use element.offsetLeft / offsetTop / offsetWidth / offsetHeight
    // instead of parsing style strings or using getBoundingClientRect().
    //
    // Reason:
    //   - parseInt(style.left) truncates sub-pixel values, causing a tiny
    //     position drift on every drag that accumulates over time.
    //   - getBoundingClientRect().width / scale uses the potentially-stale
    //     this.scale (only updated on schema loads, not on zoom events),
    //     producing wrong widths after any zoom interaction.
    //
    // offset* properties are layout values in CSS logical pixels — exactly
    // what we need — and require no scale conversion because they already
    // live in the canvas coordinate space (the canvas element itself holds
    // the transform, not its children).
    return {
      x: Math.round(element.offsetLeft),
      y: Math.round(element.offsetTop),
      width: Math.round(element.offsetWidth),
      height: Math.round(element.offsetHeight)
    };
  }

  private cleanup(element: HTMLElement): void {
    element.classList.remove('dragging', 'resizing');
    document.body.style.cursor = '';
    this.stateManager.reset();
  }

  private preventEvent(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
  }
}