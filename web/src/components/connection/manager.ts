import type {DbRelationship, Cardinality} from '../../models/types';
import type {LineStyle, Rect, EndpointsConfig} from './types';
import {ConnectionLogic} from './logic';
import {LineComponent} from './line';
import {AnchorComponent} from './anchor';

interface EndpointInfo {
  rel: DbRelationship;
  isFrom: boolean;
  rect: Rect;
  otherY: number; // Y center of the target
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
    const relConfigs = new Map<DbRelationship, EndpointsConfig>();
    relationships.forEach(rel => {
      relConfigs.set(rel, {
        fromColIndex: 0, fromColTotal: 1, toColIndex: 0, toColTotal: 1,
        fromLaneIndex: 0, toLaneIndex: 0,
        fromLabel: null, fromStagger: 0, toLabel: null, toStagger: 0
      });
    });

    const colGroups = new Map<string, EndpointInfo[]>();

    // Helper to get rects
    const getRect = (id: string) => {
      if (!rects.has(id)) {
        const el = document.getElementById(id);
        if (el) rects.set(id, this.getRelativeRect(el));
      }
      return rects.get(id);
    }

    relationships.forEach(rel => {
      const fromId = `col-${rel.fromTable}-${rel.fromColumn}`;
      const toId = `col-${rel.toTable}-${rel.toColumn}`;
      const rFrom = getRect(fromId);
      const rTo = getRect(toId);

      if (!rFrom || !rTo) return;

      const labelFrom = this.getLabelString(rel.type, true);
      const labelTo = this.getLabelString(rel.type, false);

      if (!colGroups.has(fromId)) colGroups.set(fromId, []);
      colGroups.get(fromId)!.push({
        rel, isFrom: true, rect: rFrom, otherY: rTo.y + rTo.height / 2, label: labelFrom
      });

      if (!colGroups.has(toId)) colGroups.set(toId, []);
      colGroups.get(toId)!.push({
        rel, isFrom: false, rect: rTo, otherY: rFrom.y + rFrom.height / 2, label: labelTo
      });
    });

    // --- 2. COLUMN GROUPING (Vertical Anchors & Labels) ---
    // Sort connections sharing the exact same column
    for (const list of colGroups.values()) {
      // Sort by target Y to untangle crossing lines immediately leaving the anchor
      list.sort((a, b) => a.otherY - b.otherY);

      const total = list.length;
      const seenLabels = new Set<string>();
      let staggerCounter = 0;

      list.forEach((ep, index) => {
        const config = relConfigs.get(ep.rel);
        if (!config) return;

        // Label Staggering
        let labelStr: string | null = null;
        let labelStagger = 0;

        if (!seenLabels.has(ep.label)) {
          seenLabels.add(ep.label);
          labelStr = ep.label;
          labelStagger = staggerCounter++;
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

    // --- 3. TABLE-SIDE GROUPING (Horizontal Lanes) ---
    // This logic prevents crossing when turning.

    // Map key: "tableId-side" (e.g. "table1-right", "table2-left")
    const tableSideGroups = new Map<string, EndpointInfo[]>();

    relationships.forEach(rel => {
      const fromId = `col-${rel.fromTable}-${rel.fromColumn}`;
      const toId = `col-${rel.toTable}-${rel.toColumn}`;
      const rFrom = rects.get(fromId);
      const rTo = rects.get(toId);
      if (!rFrom || !rTo) return;

      // Determine side (Right or Left) logic
      // Simplistic check: If To is to the right of From, leave From-Right.
      const fromSide = (rFrom.x < rTo.x) ? 'right' : 'left';
      const toSide = (rTo.x < rFrom.x) ? 'right' : 'left'; // If From is right of To, To enters Left? No.
      // Actually: if rFrom.x < rTo.x: From leaves Right, To enters Left.

      const kFrom = `${rel.fromTable}-${fromSide}`;
      const kTo = `${rel.toTable}-${toSide}`;

      // Re-fetch info to ensure we have it
      // Note: we just reconstruct info here, lightweight
      const infoFrom: EndpointInfo = {
        rel,
        isFrom: true,
        rect: rFrom,
        otherY: rTo.y + rTo.height / 2,
        label: ''
      };
      const infoTo: EndpointInfo = {
        rel,
        isFrom: false,
        rect: rTo,
        otherY: rFrom.y + rFrom.height / 2,
        label: ''
      };

      if (!tableSideGroups.has(kFrom)) tableSideGroups.set(kFrom, []);
      tableSideGroups.get(kFrom)!.push(infoFrom);

      if (!tableSideGroups.has(kTo)) tableSideGroups.set(kTo, []);
      tableSideGroups.get(kTo)!.push(infoTo);
    });

    for (const [key, list] of tableSideGroups.entries()) {
      if (list.length <= 1) continue; // No lane conflict

      // 1. Determine general direction (Up or Down)
      // Calculate average Y of this side's anchors
      const avgSourceY = list.reduce((sum, ep) => sum + ep.rect.y, 0) / list.length;
      const avgTargetY = list.reduce((sum, ep) => sum + ep.otherY, 0) / list.length;

      const goingDown = avgTargetY > avgSourceY;

      // 2. Sort by Source Y position (Top to Bottom)
      // Secondary sort by Target Y to resolve same-row conflicts
      list.sort((a, b) => {
        if (Math.abs(a.rect.y - b.rect.y) > 1) return a.rect.y - b.rect.y;
        return a.otherY - b.otherY;
      });

      // 3. Assign Lanes
      // Rule: The connection "closest" to the target vertical center gets the smallest offset (inner track).
      // The connection "furthest" gets the largest offset (outer track).

      list.forEach((ep, i) => {
        const config = relConfigs.get(ep.rel);
        if (!config) return;

        // If Going Down: Top Row (index 0) is furthest away. Needs Outer Lane (Big Index).
        // If Going Up: Top Row (index 0) is closest. Needs Inner Lane (Small Index).

        const laneIndex = goingDown ? (list.length - 1 - i) : i;

        if (ep.isFrom) config.fromLaneIndex = laneIndex;
        else config.toLaneIndex = laneIndex;
      });
    }

    // --- 4. DRAW ---
    relationships.forEach(rel => {
      const fromId = `col-${rel.fromTable}-${rel.fromColumn}`;
      const toId = `col-${rel.toTable}-${rel.toColumn}`;
      const fromRect = rects.get(fromId);
      const toRect = rects.get(toId);
      const config = relConfigs.get(rel);

      if (fromRect && toRect && config) {
        const pathData = ConnectionLogic.calculatePath(
            fromRect, toRect, fromId, toId,
            `table-${rel.fromTable}`, `table-${rel.toTable}`,
            this.currentLineStyle, config
        );

        const lineGroup = LineComponent.createGroup(pathData);
        this.svgLayer.appendChild(lineGroup);

        const startAnchor = AnchorComponent.create(pathData.start);
        startAnchor.dataset.anchorId = fromId;
        this.svgLayer.appendChild(startAnchor);

        const endAnchor = AnchorComponent.create(pathData.end);
        endAnchor.dataset.anchorId = toId;
        this.svgLayer.appendChild(endAnchor);
      }
    });
  }

  // ... (Rest of class methods: getLabelString, getRelativeRect, interaction handlers)
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
    const lineGroup = target.closest('.connection-group') as HTMLElement;
    if (lineGroup) {
      this.activateConnection(lineGroup);
      return;
    }
    const column = target.closest('.db-row');
    if (column && column.id) {
      this.activateColumn(column.id);
      return;
    }
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