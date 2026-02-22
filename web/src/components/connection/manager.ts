// web/src/components/connection/manager.ts

import type {DbRelationship, Cardinality} from '../../models/types';
import type {LineStyle, Rect, EndpointsConfig} from './types';
import {ConnectionLogic} from './logic';
import {LineComponent} from './line';
import {AnchorComponent} from './anchor';

/**
 * Temporary structure used during the layout calculation phase
 * to group and sort connections before drawing.
 */
interface EndpointInfo {
  rel: DbRelationship;
  colPairIndex: number; // Which column pair in the relationship (0 for simple)
  isFrom: boolean;
  rect: Rect;
  otherY: number; // Y center of the connected target
  label: string;
}

export class ConnectionManager {
  private svgLayer: SVGSVGElement;
  private scale = 1;
  private container: HTMLElement;

  private currentRelationships: DbRelationship[] = [];
  private currentLineStyle: LineStyle = 'Curve';

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

    const rects = new Map<string, Rect>();

    // --- 1. PREPARE DATA ---
    // We map each relationship to an array of configs (one for each column pair in the relationship)
    const relConfigs = new Map<DbRelationship, EndpointsConfig[]>();

    relationships.forEach(rel => {
      const count = Math.max(1, Math.min(rel.fromColumns.length, rel.toColumns.length));
      const configs: EndpointsConfig[] = [];
      for (let i = 0; i < count; i++) {
        configs.push({
          fromColIndex: 0, fromColTotal: 1, toColIndex: 0, toColTotal: 1,
          fromLaneIndex: 0, toLaneIndex: 0,
          fromLabel: null, fromStagger: 0, toLabel: null, toStagger: 0
        });
      }
      relConfigs.set(rel, configs);
    });

    // Helper to get rects (DOM read - cached)
    const getRect = (id: string) => {
      if (!rects.has(id)) {
        const el = document.getElementById(id);
        if (el) rects.set(id, this.getRelativeRect(el));
      }
      return rects.get(id);
    }

    // Maps to group endpoints for sorting
    const colGroups = new Map<string, EndpointInfo[]>();

    // Map key: "tableId-side" (e.g. "users-right") -> list of endpoints
    const tableSideGroups = new Map<string, EndpointInfo[]>();

    // --- LOOP THROUGH RELATIONSHIPS & POPULATE GROUPS ---
    relationships.forEach(rel => {
      // Handle Composite Keys (loop through matched pairs)
      const count = Math.min(rel.fromColumns.length, rel.toColumns.length);

      for(let i=0; i<count; i++) {
        const fromColName = rel.fromColumns[i];
        const toColName = rel.toColumns[i];

        const fromId = `col-${rel.fromTable}-${fromColName}`;
        const toId = `col-${rel.toTable}-${toColName}`;

        const rFrom = getRect(fromId);
        const rTo = getRect(toId);

        if (!rFrom || !rTo) continue;

        // Use labels only for the first line of a composite key to avoid clutter
        const isFirst = (i === 0);
        const labelFrom = isFirst ? this.getLabelString(rel.type, true) : '';
        const labelTo = isFirst ? this.getLabelString(rel.type, false) : '';

        // 1. Register for Column Grouping (Vertical Anchor Spacing)
        if (!colGroups.has(fromId)) colGroups.set(fromId, []);
        colGroups.get(fromId)!.push({
          rel, colPairIndex: i, isFrom: true, rect: rFrom, otherY: rTo.y + rTo.height/2, label: labelFrom
        });

        if (!colGroups.has(toId)) colGroups.set(toId, []);
        colGroups.get(toId)!.push({
          rel, colPairIndex: i, isFrom: false, rect: rTo, otherY: rFrom.y + rFrom.height/2, label: labelTo
        });

        // 2. Register for Table Side Grouping (Horizontal Lane Spacing)
        const fromSide = (rFrom.x < rTo.x) ? 'right' : 'left';
        const toSide = (rTo.x < rFrom.x) ? 'right' : 'left';

        const kFrom = `${rel.fromTable}-${fromSide}`;
        const kTo = `${rel.toTable}-${toSide}`;

        const infoFrom: EndpointInfo = { rel, colPairIndex: i, isFrom: true, rect: rFrom, otherY: rTo.y + rTo.height/2, label: '' };
        const infoTo: EndpointInfo = { rel, colPairIndex: i, isFrom: false, rect: rTo, otherY: rFrom.y + rFrom.height/2, label: '' };

        if (!tableSideGroups.has(kFrom)) tableSideGroups.set(kFrom, []);
        tableSideGroups.get(kFrom)!.push(infoFrom);

        if (!tableSideGroups.has(kTo)) tableSideGroups.set(kTo, []);
        tableSideGroups.get(kTo)!.push(infoTo);
      }
    });

    // --- 2. PROCESS COLUMN GROUPS (Vertical Anchors & Labels) ---
    for (const list of colGroups.values()) {
      // Sort by target Y to untangle crossing lines immediately leaving the anchor
      list.sort((a, b) => a.otherY - b.otherY);

      const total = list.length;
      const seenLabels = new Set<string>();
      let staggerCounter = 0;

      list.forEach((ep, index) => {
        const config = relConfigs.get(ep.rel)?.[ep.colPairIndex];
        if (!config) return;

        // Label Staggering: Only increment offset if we see a NEW label type overlapping here
        let labelStr: string | null = null;
        let labelStagger = 0;

        // If the line has a label (isFirst), check overlap
        if (ep.label) {
          if (!seenLabels.has(ep.label)) {
            seenLabels.add(ep.label);
            labelStr = ep.label;
            labelStagger = staggerCounter++;
          } else {
            // Same label type (e.g. multiple 1:n connections), just reuse the first one visually?
            // Or stack them? Requirement says "overlapping is not good... keep only one relation indicator"
            // So we effectively hide subsequent identical labels by keeping labelStr null here,
            // OR we just let them overlap perfectly (which looks like one).
            // Let's explicitly set it to the labelStr so it renders, but it will be at the same stagger index 0.
            labelStr = ep.label;
            labelStagger = 0; // Or find the existing stagger for this label?

            // Correct logic based on requirement "if similar relation ... keep only one indicator"
            // If we already saw '1', we don't need to stagger a new '1' out. They can overlap.
          }
        }

        if (ep.isFrom) {
          config.fromColIndex = index;
          config.fromColTotal = total;
          config.fromLabel = labelStr;
          config.fromStagger = labelStagger;
        } else {
          config.toColIndex = index;
          config.toColTotal = total;
          config.toLabel = labelStr;
          config.toStagger = labelStagger;
        }
      });
    }

    // --- 3. PROCESS TABLE-SIDE GROUPS (Horizontal Lanes) ---
    for (const [key, list] of tableSideGroups.entries()) {
      if (list.length <= 1) continue; // No lane conflict

      // A. Determine general direction (Up or Down)
      const avgSourceY = list.reduce((sum, ep) => sum + ep.rect.y, 0) / list.length;
      const avgTargetY = list.reduce((sum, ep) => sum + ep.otherY, 0) / list.length;
      const goingDown = avgTargetY > avgSourceY;

      // B. Sort by Source Y position (Top to Bottom)
      list.sort((a, b) => {
        // Primary sort: Physical Y position on the table
        if (Math.abs(a.rect.y - b.rect.y) > 1) return a.rect.y - b.rect.y;
        // Secondary sort: Target Y (to keep bundles straight)
        return a.otherY - b.otherY;
      });

      // C. Assign Lanes
      // Rule: The connection "closest" to the vertical center of travel gets the inner track.
      // Going Down -> Bottom-most source is inner track (shortest path). Top-most is outer.
      // Going Up -> Top-most source is inner track. Bottom-most is outer.

      list.forEach((ep, i) => {
        const config = relConfigs.get(ep.rel)?.[ep.colPairIndex];
        if (!config) return;

        // laneIndex 0 = Base Offset (Closest to table)
        // laneIndex N = Further out
        const laneIndex = goingDown ? (list.length - 1 - i) : i;

        if (ep.isFrom) config.fromLaneIndex = laneIndex;
        else config.toLaneIndex = laneIndex;
      });
    }

    // --- 4. DRAW ---
    relationships.forEach(rel => {
      const count = Math.min(rel.fromColumns.length, rel.toColumns.length);

      for(let i=0; i<count; i++) {
        const fromId = `col-${rel.fromTable}-${rel.fromColumns[i]}`;
        const toId = `col-${rel.toTable}-${rel.toColumns[i]}`;

        const fromRect = rects.get(fromId);
        const toRect = rects.get(toId);
        const config = relConfigs.get(rel)?.[i];

        if (fromRect && toRect && config) {

          // Calculate Path
          const pathData = ConnectionLogic.calculatePath(
              fromRect, toRect, fromId, toId,
              `table-${rel.fromTable}`, `table-${rel.toTable}`,
              this.currentLineStyle, config
          );

          // Create Elements
          const lineGroup = LineComponent.createGroup(pathData);

          // Apply Settings Color if present
          if (rel.settings && rel.settings['color']) {
            const color = rel.settings['color'];
            const base = lineGroup.querySelector('.relation-line-base') as SVGPathElement;
            const flow = lineGroup.querySelector('.relation-line-flow') as SVGPathElement;
            if(base) base.style.stroke = color;
            if(flow) flow.style.stroke = color;
          }

          // Append to SVG
          this.svgLayer.appendChild(lineGroup);

          // Create Anchors
          const startAnchor = AnchorComponent.create(pathData.start);
          startAnchor.dataset.anchorId = fromId;
          this.svgLayer.appendChild(startAnchor);

          const endAnchor = AnchorComponent.create(pathData.end);
          endAnchor.dataset.anchorId = toId;
          this.svgLayer.appendChild(endAnchor);
        }
      }
    });
  }

  private getLabelString(type: Cardinality, isFrom: boolean): string {
    const parts = type.split(':');
    return isFrom ? parts[0] : parts[1];
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

  // --- INTERACTIONS ---

  private setupInteractions() {
    this.container.addEventListener('mouseover', (e) => this.handleHover(e, true));
    this.container.addEventListener('mouseout', (e) => this.handleHover(e, false));
  }

  private handleHover(e: Event, isOver: boolean) {
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

    // 3. Hovering a Table Header (Active Table)
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
    lineGroup.classList.add('highlighted');
    const fromId = lineGroup.dataset.from;
    const toId = lineGroup.dataset.to;

    if (fromId) this.setHighlight(fromId);
    if (toId) this.setHighlight(toId);
    this.highlightAnchorsForLine(fromId, toId);
  }

  private activateColumn(colId: string) {
    this.setHighlight(colId);

    // Find all lines connected to this column
    const lines = this.svgLayer.querySelectorAll(`[data-from="${colId}"], [data-to="${colId}"]`);
    lines.forEach(line => {
      line.classList.add('highlighted');
      const l = line as HTMLElement;
      if (l.dataset.from !== colId) this.setHighlight(l.dataset.from);
      if (l.dataset.to !== colId) this.setHighlight(l.dataset.to);
      this.highlightAnchorsForLine(l.dataset.from, l.dataset.to);
    });
  }

  private activateTable(tableId: string) {
    this.setHighlight(tableId);

    // Find all lines related to this table
    const lines = this.svgLayer.querySelectorAll(`[data-from-table="${tableId}"], [data-to-table="${tableId}"]`);
    lines.forEach(line => {
      line.classList.add('highlighted');
      const l = line as HTMLElement;
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