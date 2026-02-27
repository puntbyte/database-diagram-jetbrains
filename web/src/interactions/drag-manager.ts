// web/src/interactions/drag-manager.ts

import {ConnectionManager} from '../components/connection/manager';
import type {DbRelationship} from '../models/types';

export type OnTableUpdateCallback = (tableName: string, x: number, y: number,
    width?: number
) => void;

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
  private wrapper: HTMLElement;

  constructor(
      wrapper: HTMLElement,
      connectionManager: ConnectionManager,
      onUpdate: OnTableUpdateCallback
  ) {
    this.wrapper = wrapper;
    this.connectionManager = connectionManager;
    this.onUpdate = onUpdate;

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

    // 1. Resize Handle
    if (target.classList.contains('resize-handle')) {
      const parent = target.parentElement as HTMLElement;
      if (parent) this.startResize(parent, e);
      return;
    }

    // 2. Table Drag (Header or Overlay)
    if (target.closest('.db-table-header') || target.closest('.semantic-overlay')) {
      const table = target.closest('.db-table') as HTMLElement;
      if (table) this.startDrag(table, e);
      return;
    }

    // 3. Note Drag
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
    document.body.style.cursor = 'nwse-resize';
  }

  private onMouseMove(e: MouseEvent) {
    if (!this.activeEl) return;

    const deltaX = (e.clientX - this.initialMouse.x) / this.scale;
    const deltaY = (e.clientY - this.initialMouse.y) / this.scale;

    if (this.mode === 'DRAG') {
      this.activeEl.style.left = `${this.initialVal.x + deltaX}px`;
      this.activeEl.style.top = `${this.initialVal.y + deltaY}px`;
      this.activeEl.style.transform = 'none';

      if (this.activeEl.classList.contains('db-table')) {
        this.connectionManager.draw(this.relationships);
      }

    } else if (this.mode === 'RESIZE') {
      const newWidth = Math.max(100, this.initialVal.width + deltaX);
      this.activeEl.style.width = `${newWidth}px`;

      // Handle Height Resizing for Notes
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

    // Calculate final positions (integers)
    const x = Math.round(parseInt(el.style.left || '0', 10));
    const y = Math.round(parseInt(el.style.top || '0', 10));
    const width = Math.round(el.getBoundingClientRect().width / this.scale);
    const height = Math.round(el.getBoundingClientRect().height / this.scale);

    // 1. UPDATE TABLE
    if (el.classList.contains('db-table')) {
      const titleEl = el.querySelector('.title');
      const tableName = (el.dataset && el.dataset.tableName) ||
          (titleEl ? titleEl.textContent || '' : el.id.replace('table-', ''));

      if (tableName) {
        // Calls SchemaRenderer -> calls Bridge -> sends UPDATE_TABLE_POS
        this.onUpdate(tableName, x, y, width);
      }
    }
    // 2. UPDATE NOTE
    else if (el.classList.contains('sticky-note')) {
      const noteName = el.dataset.noteId || el.id.replace('note-', '');
      // Dispatch event -> main.ts listens -> sends UPDATE_NOTE_POS
      const event = new CustomEvent('note-pos-changed', {
        detail: {name: noteName, x, y, width, height},
        bubbles: true
      });
      this.wrapper.dispatchEvent(event);
    }

    el.classList.remove('dragging');
    el.classList.remove('resizing');
    document.body.style.cursor = '';

    this.activeEl = null;
    this.mode = 'NONE';
  }
}