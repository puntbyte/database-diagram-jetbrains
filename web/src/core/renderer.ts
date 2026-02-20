// web/src/core/renderer.ts

import type {Parser} from './parser-interface';
import {DbmlParser} from './parsers/dbml-parser';
import {TableComponent} from '../components/table';
import {ConnectionManager} from '../components/connection/manager';
import {DragManager, type OnTableUpdateCallback} from '../interactions/drag-manager';
import {PanZoomManager} from '../interactions/panzoom-manager';
import {HUDComponent} from '../components/hud';

export class SchemaRenderer {
  private container: HTMLElement;
  private wrapper: HTMLElement;
  private connectionManager: ConnectionManager;
  private dragManager: DragManager;
  private panZoomManager: PanZoomManager;
  private hud: HUDComponent; // <-- Add HUD property

  private parsers: Record<string, Parser> = {
    'dbml': new DbmlParser(),
  };

  constructor(containerId: string, onTableMove: OnTableUpdateCallback) {
    this.container = document.getElementById(containerId)!;

    this.wrapper = document.createElement('div');
    this.wrapper.className = 'schema-wrapper';
    this.container.appendChild(this.wrapper);

    this.connectionManager = new ConnectionManager(this.wrapper);
    this.dragManager = new DragManager(this.wrapper, this.connectionManager, onTableMove);

    this.panZoomManager = new PanZoomManager(this.wrapper, (scale) => {
      this.dragManager.updateScale(scale);
      this.connectionManager.updateScale(scale);
    });

    // Initialize the HUD, append to container (not wrapper, so it stays fixed to screen)
    this.hud = new HUDComponent(this.container, this.panZoomManager, this.connectionManager);
  }

  public render(format: string, content: string) {
    this.wrapper.innerHTML = '';

    // recreate the connection manager layer so it sits above the wrapper contents
    this.connectionManager = new ConnectionManager(this.wrapper);
    this.dragManager.updateConnectionManager(this.connectionManager);
    this.connectionManager.updateScale(this.panZoomManager.getScale());

    // Re-create HUD so it references the new connection manager (remove old first)
    this.container.querySelector('.schema-hud')?.remove();
    this.hud = new HUDComponent(this.container, this.panZoomManager, this.connectionManager);

    if (!content.trim()) return;

    try {
      // Normalize format key (accept ".dbml", " DBML ", etc.)
      let fmtKey = (format || '').toLowerCase().trim();
      if (fmtKey.startsWith('.')) fmtKey = fmtKey.slice(1);

      const parser = this.parsers[fmtKey];
      if (!parser) throw new Error(`Unsupported format: ${format}`);

      const { tables, relationships } = parser.parse(content);

      const gapX = 350;
      const gapY = 300;
      const cols = 3;

      tables.forEach((table, index) => {
        const tableEl = TableComponent.create(table);
        this.wrapper.appendChild(tableEl);

        let left = (table.x !== undefined) ? table.x : (50 + (index % cols) * gapX);
        let top = (table.y !== undefined) ? table.y : (50 + Math.floor(index / cols) * gapY);

        tableEl.style.left = `${left}px`;
        tableEl.style.top = `${top}px`;

        if (table.width) tableEl.style.width = `${table.width}px`;

        if (table.color) {
          const headerEl = tableEl.querySelector('.db-table-header') as HTMLElement;
          if (headerEl) headerEl.style.backgroundColor = table.color;
        }
      });

      this.dragManager.setRelationships(relationships);

      // ensure DOM is painted before measuring/drawing connections
      setTimeout(() => {
        this.connectionManager.draw(relationships);
      }, 0);

    } catch (e: any) {
      console.error(e);
      this.wrapper.innerHTML = `<div class="error">Error: ${e.message}</div>`;
    }
  }
}