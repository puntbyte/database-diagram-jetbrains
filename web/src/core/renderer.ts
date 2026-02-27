// web/src/core/renderer.ts

import type {Parser} from './parser-interface';
import {DbmlParser} from '../parsers/dbml/';
import {TableComponent} from '../components/table';
import {ConnectionManager} from '../components/connection/manager';
import {DragManager, type OnTableUpdateCallback} from '../interactions/drag-manager';
import {PanZoomManager} from '../interactions/panzoom-manager';
import {HUDComponent} from '../components/hud';
import {NoteComponent} from "../components/note";
import type {DbNote} from "../models/types";

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

  constructor(containerId: string, onTableMove: OnTableUpdateCallback,
      onTransform?: (scale: number, x: number, y: number) => void
  ) {
    this.container = document.getElementById(containerId)!;
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'schema-wrapper';
    this.container.appendChild(this.wrapper);

    this.connectionManager = new ConnectionManager(this.wrapper);
    this.dragManager = new DragManager(this.wrapper, this.connectionManager, onTableMove);

    this.panZoomManager = new PanZoomManager(this.wrapper,
        (scale) => {
          this.updateZoomState(scale);
          this.dragManager.updateScale(scale);
          this.connectionManager.updateScale(scale);
        },
        (scale, x, y) => {
          this.updateZoomState(scale, x, y);
          this.dragManager.updateScale(scale);
          this.connectionManager.updateScale(scale);
          if (onTransform) onTransform(scale, x, y);
        }
    );

    this.hud = new HUDComponent(this.container, this.panZoomManager);
  }

  // Live update without re-parsing
  public updateVisuals(settings: { lineStyle: string, showGrid: boolean, gridSize: number }) {
    this.container.style.setProperty('--grid-size', `${settings.gridSize}px`);

    // Explicitly toggle class
    if (settings.showGrid) {
      this.container.classList.add('grid-visible');
    } else {
      this.container.classList.remove('grid-visible');
    }

    this.connectionManager.setLineStyle(settings.lineStyle as any);
  }

  private updateZoomState(scale: number, x?: number, y?: number) {
    const THRESHOLD = 0.5;
    if (scale < THRESHOLD) this.wrapper.classList.add('semantic-zoom');
    else this.wrapper.classList.remove('semantic-zoom');

    this.container.style.setProperty('--zoom', scale.toString());
    if (x !== undefined && y !== undefined) {
      this.container.style.setProperty('--pan-x', `${x}px`);
      this.container.style.setProperty('--pan-y', `${y}px`);
    }
  }

  public render(format: string, content: string, defaults?: any) {
    this.wrapper.innerHTML = '';

    // Reset managers
    this.connectionManager = new ConnectionManager(this.wrapper);
    this.dragManager.updateConnectionManager(this.connectionManager);

    const currentTransform = this.panZoomManager.getTransform();
    this.connectionManager.updateScale(currentTransform.scale);
    this.dragManager.updateScale(currentTransform.scale);
    this.updateZoomState(currentTransform.scale);

    // Reset HUD
    this.container.querySelector('.schema-hud')?.remove();
    this.hud = new HUDComponent(this.container, this.panZoomManager);

    // Apply Transforms
    this.container.style.setProperty('--zoom', currentTransform.scale.toString());
    this.container.style.setProperty('--pan-x', `${currentTransform.x}px`);
    this.container.style.setProperty('--pan-y', `${currentTransform.y}px`);

    if (!content.trim()) return;

    try {
      let fmtKey = (format || '').toLowerCase().trim();
      if (fmtKey.startsWith('.')) fmtKey = fmtKey.slice(1);
      const parser = this.parsers[fmtKey];
      if (!parser) throw new Error(`Unsupported format: ${format}`);

      const {tables, relationships, projectSettings, notes} = parser.parse(content);

      // 1. Apply Global Visuals (This ensures new tabs inherit correct settings)
      if (defaults) {
        this.updateVisuals(defaults);
      }

      // 2. Apply Zoom/Pan from Project if present
      if (projectSettings) {
        if (projectSettings.zoom !== undefined || projectSettings.panX !== undefined) {
          const s = projectSettings.zoom || 1;
          const x = projectSettings.panX || 0;
          const y = projectSettings.panY || 0;
          this.panZoomManager.setTransform(s, x, y);

          this.container.style.setProperty('--zoom', s.toString());
          this.container.style.setProperty('--pan-x', `${x}px`);
          this.container.style.setProperty('--pan-y', `${y}px`);
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
      });

      this.dragManager.setRelationships(relationships);

      if (notes) {
        notes.forEach((note: DbNote) => {
          this.wrapper.appendChild(NoteComponent.create(note));
        });
      }

      setTimeout(() => {
        this.connectionManager.draw(relationships);
      }, 0);

    } catch (e: any) {
      console.error(e);
      this.wrapper.innerHTML =
          `<div class="error" style="padding:20px; color:red;">Error: ${e.message}</div>`;
    }
  }
}