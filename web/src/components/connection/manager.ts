// web/src/components/connection/manager.ts

import type {DbRelationship} from '../../models/types';
import type {LineStyle, Rect} from './types';
import {ConnectionLogic} from './logic';
import {LineComponent} from './line';
import {AnchorComponent} from './anchor';

export class ConnectionManager {
  private svgLayer: SVGSVGElement;
  private scale = 1;
  private container: HTMLElement;

  private currentRelationships: DbRelationship[] = [];
  private currentLineStyle: LineStyle = 'Curve'; // Default

  constructor(container: HTMLElement) {
    this.container = container;
    this.svgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgLayer.classList.add('connection-layer');
    container.appendChild(this.svgLayer);

    this.setupInteractions();
  }

  public updateScale(newScale: number) {
    this.scale = newScale;
  }

  public setLineStyle(style: LineStyle) {
    this.currentLineStyle = style;
    this.draw(this.currentRelationships);
  }

  public draw(relationships: DbRelationship[]) {
    this.currentRelationships = relationships;
    this.svgLayer.innerHTML = '';
    relationships.forEach(rel => this.drawOne(rel));
  }

  private drawOne(rel: DbRelationship) {
    const fromId = `col-${rel.fromTable}-${rel.fromColumn}`;
    const toId = `col-${rel.toTable}-${rel.toColumn}`;
    const fromEl = document.getElementById(fromId);
    const toEl = document.getElementById(toId);

    if (!fromEl || !toEl) return;

    const fromRect = this.getRelativeRect(fromEl);
    const toRect = this.getRelativeRect(toEl);

    // Pass the style down to Logic
    const pathData = ConnectionLogic.calculatePath(
        fromRect, toRect, fromId, toId,
        `table-${rel.fromTable}`, `table-${rel.toTable}`,
        this.currentLineStyle
    );

    const lineGroup = LineComponent.createGroup(pathData, rel.type);
    this.svgLayer.appendChild(lineGroup);

    const startAnchor = AnchorComponent.create(pathData.start);
    startAnchor.dataset.anchorId = fromId;
    this.svgLayer.appendChild(startAnchor);

    const endAnchor = AnchorComponent.create(pathData.end);
    endAnchor.dataset.anchorId = toId;
    this.svgLayer.appendChild(endAnchor);
  }

  private getRelativeRect(el: HTMLElement): Rect {
    const elRect = el.getBoundingClientRect();
    const containerRect = this.svgLayer.getBoundingClientRect();
    return {
      x: (elRect.left - containerRect.left) / this.scale,
      y: (elRect.top - containerRect.top) / this.scale,
      width: elRect.width / this.scale,
      height: elRect.height / this.scale
    };
  }

  // --- NEW INTERACTION LOGIC ---

  private setupInteractions() {
    this.container.addEventListener('mouseover', (e) => this.handleHover(e, true));
    this.container.addEventListener('mouseout', (e) => this.handleHover(e, false));
  }

  private handleHover(e: Event, isOver: boolean) {
    // If mouseout, we just clear everything and return
    if (!isOver) {
      this.clearHighlights();
      return;
    }

    const target = e.target as HTMLElement;

    // 1. Hovering a Line Group
    const lineGroup = target.closest('.connection-group') as HTMLElement;
    if (lineGroup) {
      this.activateConnection(lineGroup);
      return;
    }

    // 2. Hovering a Table Column
    const column = target.closest('.db-row');
    if (column && column.id) {
      this.activateColumn(column.id);
      return;
    }

    // 3. Hovering a Table Header
    const table = target.closest('.db-table');
    if (table && table.id) {
      this.activateTable(table.id);
      return;
    }
  }

  private clearHighlights() {
    const allObj = document.querySelectorAll('.highlighted');
    allObj.forEach(el => el.classList.remove('highlighted'));
  }

  private activateConnection(lineGroup: HTMLElement) {
    // Highlight the line itself
    lineGroup.classList.add('highlighted');

    // Highlight connected columns
    const fromId = lineGroup.dataset.from;
    const toId = lineGroup.dataset.to;

    if (fromId) this.setHighlight(fromId);
    if (toId) this.setHighlight(toId);

    // Highlight Anchors
    this.highlightAnchorsForLine(fromId, toId);
  }

  private activateColumn(colId: string) {
    // Highlight the column
    this.setHighlight(colId);

    // Find and highlight all lines connected to this column
    const lines = this.svgLayer.querySelectorAll(`[data-from="${colId}"], [data-to="${colId}"]`);

    lines.forEach(line => {
      line.classList.add('highlighted');
      const l = line as HTMLElement;
      // Also highlight the OTHER end of the connection
      if (l.dataset.from !== colId) this.setHighlight(l.dataset.from);
      if (l.dataset.to !== colId) this.setHighlight(l.dataset.to);

      this.highlightAnchorsForLine(l.dataset.from, l.dataset.to);
    });
  }

  private activateTable(tableId: string) {
    // Highlight the table container
    this.setHighlight(tableId);

    // Highlight all lines related to this table
    const lines = this.svgLayer.querySelectorAll(`[data-from-table="${tableId}"], [data-to-table="${tableId}"]`);

    lines.forEach(line => {
      line.classList.add('highlighted');
      const l = line as HTMLElement;
      // Highlight specific columns involved
      this.setHighlight(l.dataset.from);
      this.setHighlight(l.dataset.to);
      this.highlightAnchorsForLine(l.dataset.from, l.dataset.to);
    });
  }

  private setHighlight(id: string | undefined) {
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.classList.add('highlighted');
  }

  private highlightAnchorsForLine(fromId: string | undefined, toId: string | undefined) {
    // We tagged anchors with data-anchor-id in drawOne
    if (fromId) {
      const anchors = this.svgLayer.querySelectorAll(`[data-anchor-id="${fromId}"]`);
      anchors.forEach(a => a.classList.add('highlighted'));
    }
    if (toId) {
      const anchors = this.svgLayer.querySelectorAll(`[data-anchor-id="${toId}"]`);
      anchors.forEach(a => a.classList.add('highlighted'));
    }
  }
}