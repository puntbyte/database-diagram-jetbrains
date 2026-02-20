// web/src/interactions/drag-manager.ts

import {ConnectionManager} from '../components/connection/manager';
import type {DbRelationship} from '../models/types';

export type OnTableUpdateCallback = (tableName: string, x: number, y: number, width?: number) => void;

type InteractionMode = 'NONE' | 'DRAG' | 'RESIZE';

export class DragManager {
  private activeEl: HTMLElement | null = null;
  private mode: InteractionMode = 'NONE';

  private initialMouse = {x: 0, y: 0};
  private initialVal = {x: 0, y: 0, width: 0};
  private scale = 1;

  private relationships: DbRelationship[] = [];
  private connectionManager: ConnectionManager;
  private onUpdate: OnTableUpdateCallback;

  constructor(
      wrapper: HTMLElement,
      connectionManager: ConnectionManager,
      onUpdate: OnTableUpdateCallback
  ) {
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

    // Check for Resize Handle
    if (target.classList.contains('resize-handle')) {
      const table = target.closest('.db-table') as HTMLElement;
      if (table) this.startResize(table, e);
      return;
    }

    // Check for Header (Drag)
    const header = target.closest('.db-table-header');
    if (header) {
      const table = header.parentElement as HTMLElement;
      if (table) this.startDrag(table, e);
      return;
    }
  }

  private startDrag(table: HTMLElement, e: MouseEvent) {
    this.mode = 'DRAG';
    this.activeEl = table;
    this.initialVal.x = table.offsetLeft;
    this.initialVal.y = table.offsetTop;
    this.initialMouse = {x: e.clientX, y: e.clientY};

    e.stopPropagation();
    e.preventDefault();
    table.classList.add('dragging');
  }

  private startResize(table: HTMLElement, e: MouseEvent) {
    this.mode = 'RESIZE';
    this.activeEl = table;
    this.initialVal.width = table.offsetWidth;
    this.initialMouse = {x: e.clientX, y: e.clientY};

    e.stopPropagation();
    e.preventDefault();
    table.classList.add('resizing');
    document.body.style.cursor = 'col-resize'; // Force cursor
  }

  private onMouseMove(e: MouseEvent) {
    if (!this.activeEl) return;

    if (this.mode === 'DRAG') {
      const deltaX = (e.clientX - this.initialMouse.x) / this.scale;
      const deltaY = (e.clientY - this.initialMouse.y) / this.scale;

      this.activeEl.style.left = `${this.initialVal.x + deltaX}px`;
      this.activeEl.style.top = `${this.initialVal.y + deltaY}px`;
      this.activeEl.style.transform = 'none';

      this.connectionManager.draw(this.relationships);
    } else if (this.mode === 'RESIZE') {
      const deltaX = (e.clientX - this.initialMouse.x) / this.scale;
      const newWidth = Math.max(200, this.initialVal.width + deltaX);

      this.activeEl.style.width = `${newWidth}px`;
      this.connectionManager.draw(this.relationships);
    }
  }

  private onMouseUp() {
    if (!this.activeEl) return;

    const table = this.activeEl;

    // Find name
    const titleEl = table.querySelector('.title');
    const tableName = titleEl ? titleEl.textContent : table.id.replace('table-', '');

    if (tableName) {
      const x = Math.round(parseInt(table.style.left || '0', 10));
      const y = Math.round(parseInt(table.style.top || '0', 10));
      const width = Math.round(table.getBoundingClientRect().width / this.scale); // More accurate width

      this.onUpdate(tableName, x, y, width);
    }

    table.classList.remove('dragging');
    table.classList.remove('resizing');
    document.body.style.cursor = ''; // Reset cursor

    this.activeEl = null;
    this.mode = 'NONE';
  }
}