// web/src/core/render.ts

import type {Parser} from './parser-interface';
import { DbmlParser } from '../parsers/dbml/'; // Updated Import
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
  private hud: HUDComponent;

  private parsers: Record<string, Parser> = {
    'dbml': new DbmlParser(),
  };

  constructor(containerId: string, onTableMove: OnTableUpdateCallback, onTransform?: (scale:number,x:number,y:number) => void) {
    this.container = document.getElementById(containerId)!;

    this.wrapper = document.createElement('div');
    this.wrapper.className = 'schema-wrapper';
    this.container.appendChild(this.wrapper);

    this.connectionManager = new ConnectionManager(this.wrapper);
    this.dragManager = new DragManager(this.wrapper, this.connectionManager, onTableMove);

    this.panZoomManager = new PanZoomManager(this.wrapper, (scale) => {
      this.dragManager.updateScale(scale);
      this.connectionManager.updateScale(scale);
    }, (scale, x, y) => {
      this.dragManager.updateScale(scale);
      this.connectionManager.updateScale(scale);
      if (onTransform) onTransform(scale, x, y);
    });

    this.hud = new HUDComponent(this.container, this.panZoomManager, this.connectionManager);
  }

  public render(format: string, content: string) {
    this.wrapper.innerHTML = '';

    // Reset connection manager layer
    this.connectionManager = new ConnectionManager(this.wrapper);
    this.dragManager.updateConnectionManager(this.connectionManager);
    this.connectionManager.updateScale(this.panZoomManager.getScale());

    // Reset HUD
    this.container.querySelector('.schema-hud')?.remove();
    this.hud = new HUDComponent(this.container, this.panZoomManager, this.connectionManager);

    if (!content.trim()) return;

    try {
      let fmtKey = (format || '').toLowerCase().trim();
      if (fmtKey.startsWith('.')) fmtKey = fmtKey.slice(1);

      const parser = this.parsers[fmtKey];
      if (!parser) throw new Error(`Unsupported format: ${format}`);

      // Parse content including Project settings
      const { tables, relationships, projectSettings } = parser.parse(content);

      // --- APPLY PROJECT SETTINGS ---
      if (projectSettings) {
        // 1. Restore Zoom/Pan
        if (projectSettings.zoom !== undefined || projectSettings.panX !== undefined) {
          const s = projectSettings.zoom || 1;
          const x = projectSettings.panX || 0;
          const y = projectSettings.panY || 0;
          this.panZoomManager.setTransform(s, x, y);
        }

        // 2. Restore Grid
        // Note: DBML parser returns "true" string or boolean depending on how we parsed it.
        const showGrid = projectSettings.showGrid === 'true' || projectSettings.showGrid === true;
        if (showGrid) {
          this.wrapper.classList.add('grid-visible');
          // Update HUD button state visually if needed (requires HUD access or separate event)
        }

        // 3. Restore Line Style
        if (projectSettings.lineStyle) {
          this.connectionManager.setLineStyle(projectSettings.lineStyle as any);
        }
      }

      // Render Tables
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

      setTimeout(() => {
        this.connectionManager.draw(relationships);
      }, 0);

    } catch (e: any) {
      console.error(e);
      this.wrapper.innerHTML = `<div class="error">Error: ${e.message}</div>`;
    }
  }
}