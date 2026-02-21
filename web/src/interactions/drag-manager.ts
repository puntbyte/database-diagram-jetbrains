// web/src/interactions/drag-manager.ts

import {ConnectionManager} from '../components/connection/manager';
import type {DbRelationship} from '../models/types';

export type OnTableUpdateCallback = (tableName: string, x: number, y: number, width?: number) => void;

type InteractionMode = 'NONE' | 'DRAG' | 'RESIZE';

export class DragManager {
  private activeEl: HTMLElement | null = null;
  private mode: InteractionMode = 'NONE';

  private initialMouse = {x: 0, y: 0};
  private initialVal = {x: 0, y: 0, width: 0, height: 0};
  private scale = 1;

  private relationships: DbRelationship[] = [];
  private connectionManager: ConnectionManager;
  private onUpdate: OnTableUpdateCallback;

  // The wrapper is needed to dispatch custom events for Notes
  private wrapper: HTMLElement;

  constructor(
      wrapper: HTMLElement,
      connectionManager: ConnectionManager,
      onUpdate: OnTableUpdateCallback
  ) {
    this.wrapper = wrapper;
    this.connectionManager = connectionManager;
    this.onUpdate = onUpdate;

    // Attach listeners
    // We bind to wrapper for start, but window for move/end to handle fast drags outside bounds
    wrapper.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', () => this.onMouseUp());
  }

  public updateConnectionManager(cm: ConnectionManager) {
    this.connectionManager = cm;
  }

  public setRelationships(rels: DbRelationship[]) {
    this.relationships = rels;
  }

  public updateScale(newScale: number) {
    this.scale = newScale;
  }

  private onMouseDown(e: MouseEvent) {
    const target = e.target as HTMLElement;

    // 1. Check for Resize Handle (Shared by Table and Note)
    if (target.classList.contains('resize-handle')) {
      // The handle is a child of the Table or Note
      const parent = target.parentElement as HTMLElement;
      if (parent) {
        this.startResize(parent, e);
      }
      return;
    }

    // 2. Check for Table Drag (Header OR Semantic Overlay)
    if (target.closest('.db-table-header') || target.closest('.semantic-overlay')) {
      const table = target.closest('.db-table') as HTMLElement;
      if (table) {
        this.startDrag(table, e);
      }
      return;
    }

    // 3. Check for Sticky Note Drag (Clicking anywhere on the note body)
    // Notes have the class .sticky-note
    const note = target.closest('.sticky-note') as HTMLElement;
    if (note) {
      this.startDrag(note, e);
      return;
    }
  }

  private startDrag(el: HTMLElement, e: MouseEvent) {
    this.mode = 'DRAG';
    this.activeEl = el;

    this.initialVal.x = el.offsetLeft;
    this.initialVal.y = el.offsetTop;
    this.initialMouse = {x: e.clientX, y: e.clientY};

    e.stopPropagation();
    e.preventDefault();

    el.classList.add('dragging');
  }

  private startResize(el: HTMLElement, e: MouseEvent) {
    this.mode = 'RESIZE';
    this.activeEl = el;

    this.initialVal.width = el.offsetWidth;
    this.initialVal.height = el.offsetHeight;
    this.initialMouse = {x: e.clientX, y: e.clientY};

    e.stopPropagation();
    e.preventDefault();

    el.classList.add('resizing');
    // Force cursor globally during drag
    document.body.style.cursor = 'nwse-resize';
  }

  private onMouseMove(e: MouseEvent) {
    if (!this.activeEl) return;

    // Calculate delta adjusted for zoom scale
    const deltaX = (e.clientX - this.initialMouse.x) / this.scale;
    const deltaY = (e.clientY - this.initialMouse.y) / this.scale;

    if (this.mode === 'DRAG') {
      this.activeEl.style.left = `${this.initialVal.x + deltaX}px`;
      this.activeEl.style.top = `${this.initialVal.y + deltaY}px`;

      // Ensure no CSS transforms interfere with absolute positioning
      this.activeEl.style.transform = 'none';

      // Redraw lines while dragging tables
      // (Notes don't usually have connections, but redrawing is safe)
      if (this.activeEl.classList.contains('db-table')) {
        this.connectionManager.draw(this.relationships);
      }

    } else if (this.mode === 'RESIZE') {
      const newWidth = Math.max(100, this.initialVal.width + deltaX);
      this.activeEl.style.width = `${newWidth}px`;

      // If it's a note, we also allow height resizing
      if (this.activeEl.classList.contains('sticky-note')) {
        const newHeight = Math.max(100, this.initialVal.height + deltaY);
        this.activeEl.style.height = `${newHeight}px`;
      }

      if (this.activeEl.classList.contains('db-table')) {
        this.connectionManager.draw(this.relationships);
      }
    }
  }

  private onMouseUp() {
    if (!this.activeEl) return;

    const el = this.activeEl;

    // Calculate final values (rounded for cleaner DBML)
    const x = Math.round(parseInt(el.style.left || '0', 10));
    const y = Math.round(parseInt(el.style.top || '0', 10));
    const width = Math.round(el.getBoundingClientRect().width / this.scale);
    const height = Math.round(el.getBoundingClientRect().height / this.scale);

    // 1. Handle Table Update
    if (el.classList.contains('db-table')) {
      const titleEl = el.querySelector('.title');
      // Prefer dataset name if available
      const tableName = (el.dataset && el.dataset.tableName) ||
          (titleEl ? titleEl.textContent || '' : el.id.replace('table-', ''));

      if (tableName) {
        this.onUpdate(tableName, x, y, width);
      }
    }
    // 2. Handle Note Update
    else if (el.classList.contains('sticky-note')) {
      // Since onUpdate callback is specifically typed for Tables (only 4 args, specific name),
      // we dispatch a custom event for Notes that the bridge/main.ts can listen to.
      // Note ID is stored in dataset.noteId
      const noteName = el.dataset.noteId || el.id.replace('note-', '');

      const event = new CustomEvent('note-pos-changed', {
        detail: {
          name: noteName,
          x: x,
          y: y,
          width: width,
          height: height
        },
        bubbles: true
      });
      this.wrapper.dispatchEvent(event);
    }

    // Cleanup
    el.classList.remove('dragging');
    el.classList.remove('resizing');
    document.body.style.cursor = '';

    this.activeEl = null;
    this.mode = 'NONE';
  }
}