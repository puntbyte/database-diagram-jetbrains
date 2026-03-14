// web/src/interactions/drag/entity-drag-handler.ts

import {RelationshipManager} from '../../components/relationship';
import type {DbRelationship} from '../../models/types';
import {DragStateManager} from './drug-state-manager.ts';
import {TablePositionNotifier} from './table-notifier';
import {NotePositionNotifier} from './note-notifier';
import {DragInteractionDetector} from "./interaction-detector";

export type TablePositionCallback = (
    tableName: string, x: number, y: number, width?: number
) => void;

export class EntityDragHandler {
  private readonly stateManager: DragStateManager;
  private readonly interactionDetector: DragInteractionDetector;
  private readonly tableNotifier: TablePositionNotifier;
  private readonly noteNotifier: NotePositionNotifier;

  private relationshipManager: RelationshipManager;
  private relationships: DbRelationship[] = [];
  private scale = 1; // kept as fallback only

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
    // FIX: Set grabbing cursor on the whole document during drag so the cursor
    // doesn't flicker back to the default when the mouse moves off the element.
    document.body.style.cursor = 'grabbing';
    this.preventEvent(event);
  }

  beginResize(element: HTMLElement, event: MouseEvent): void {
    this.stateManager.beginResize(element, event);
    // FIX: se-resize communicates the resize direction clearly.
    document.body.style.cursor = 'se-resize';
    this.preventEvent(event);
  }

  handleMove(event: MouseEvent): void {
    const state = this.stateManager.getState();
    if (state.mode === 'idle' || !state.element) return;

    const delta = this.calculateDelta(event);

    if (state.mode === 'dragging') {
      this.updateDragPosition(state.element, delta);
    } else if (state.mode === 'resizing') {
      this.updateResizeDimensions(state.element, delta);
    }
  }

  private calculateDelta(event: MouseEvent): { x: number; y: number } {
    const start = this.stateManager.getStartMouse();
    // FIX: Read the live --zoom CSS variable instead of the cached this.scale which
    // is only updated on schema loads and goes stale after any pan/zoom interaction.
    const s = this.liveScale();
    return {x: (event.clientX - start.x) / s, y: (event.clientY - start.y) / s};
  }

  /** Read the current zoom scale from the CSS variable set by ViewportStateManager.
   *  Falls back to the last known scale if the variable cannot be read. */
  private liveScale(): number {
    try {
      const app = document.getElementById('app');
      if (app) {
        const v = getComputedStyle(app).getPropertyValue('--zoom').trim();
        const n = parseFloat(v);
        if (!isNaN(n) && n > 0) return n;
      }
    } catch (_) { /* ignore */
    }
    return this.scale;
  }

  private updateDragPosition(element: HTMLElement, delta: { x: number; y: number }): void {
    const start = this.stateManager.getStartValues();
    element.style.left = `${start.x + delta.x}px`;
    element.style.top = `${start.y + delta.y}px`;
    element.style.transform = 'none';

    if (element.classList.contains('db-table')) {
      requestAnimationFrame(() => this.relationshipManager.draw(this.relationships));
    }
  }

  private updateResizeDimensions(element: HTMLElement, delta: { x: number; y: number }): void {
    const start = this.stateManager.getStartValues();
    element.style.width = `${Math.max(100, start.width + delta.x)}px`;

    if (element.classList.contains('sticky-note')) {
      element.style.height = `${Math.max(100, start.height + delta.y)}px`;
    }
    if (element.classList.contains('db-table')) {
      requestAnimationFrame(() => this.relationshipManager.draw(this.relationships));
    }
  }

  handleEnd(): void {
    const state = this.stateManager.getState();
    if (state.mode === 'idle' || !state.element) return;

    const rect = this.finalRect(state.element);
    if (state.element.classList.contains('db-table')) {
      this.tableNotifier.notify(state.element, rect);
    } else if (state.element.classList.contains('sticky-note')) {
      this.noteNotifier.notify(state.element, rect);
    }

    this.cleanup(state.element);
  }

  private finalRect(element: HTMLElement): { x: number; y: number; width: number; height: number } {
    // FIX: Use offsetLeft/offsetTop/offsetWidth/offsetHeight instead of
    // parseInt(style.left) or getBoundingClientRect().width / this.scale.
    //
    // - parseInt(style.left) truncates sub-pixel values → tiny positional drift
    //   that accumulates over repeated drag-save cycles.
    // - getBoundingClientRect().width / this.scale uses the potentially stale
    //   cached scale → wrong width after any zoom between drags.
    //
    // offset* values are the element's logical CSS pixel dimensions inside its
    // positioned parent (the canvas), exactly what we want to save to YAML.
    return {
      x: Math.round(element.offsetLeft),
      y: Math.round(element.offsetTop),
      width: Math.round(element.offsetWidth),
      height: Math.round(element.offsetHeight),
    };
  }

  private cleanup(element: HTMLElement): void {
    element.classList.remove('dragging', 'resizing');
    // FIX: Restore the cursor to the canvas default (grab) rather than the
    // browser default (arrow), so the panning affordance is visible again.
    document.body.style.cursor = '';
    this.stateManager.reset();
  }

  private preventEvent(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
  }
}