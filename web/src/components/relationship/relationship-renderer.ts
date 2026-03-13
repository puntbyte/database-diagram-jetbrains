// web/src/components/relationship/relationship-renderer.ts

import type {DbRelationship} from '../../models/types';
import type {EndpointsConfig, LineStyle, Rect} from './types';
import {RelationshipPath} from './path/relationship-path.ts';
import {RelationshipWidget} from '../widgets/relationship-widget.ts';
import {AnchorWidget} from '../widgets/anchor-widget.ts';

export class RelationshipRenderer {
  //private scale = 1;
  private svgLayer: SVGSVGElement;
  private readonly getScale: () => number;

  constructor(
      svgLayer: SVGSVGElement,
      getScale: () => number
  ) {
    this.svgLayer = svgLayer;
    this.getScale = getScale;
  }

  // change function signature and implementation
  render(
      relationships: DbRelationship[],
      configs: Map<DbRelationship, EndpointsConfig[]>,
      style: LineStyle,
      overlayMode: boolean = false
  ): void {
    if (overlayMode) {
      // Render simplified lines: one per relationship between table centers
      relationships.forEach(rel => this.renderOverlayRelationship(rel, style));
      return;
    }

    // existing full-detail render (unchanged)
    relationships.forEach(rel => this.renderRelationship(rel, configs.get(rel) || [], style));
  }

  // new helper: render overlay line (table center to table center)
  private renderOverlayRelationship(relationship: DbRelationship, style: LineStyle): void {
    const sourceTableId = this.sanitizeTableId(relationship.fromSchema, relationship.fromTable);
    const targetTableId = this.sanitizeTableId(relationship.toSchema, relationship.toTable);

    // measure tables (table elements are expected to be `table-${id}`)
    const sourceRect = this.getElementRect(`table-${sourceTableId}`);
    const targetRect = this.getElementRect(`table-${targetTableId}`);

    if (!sourceRect || !targetRect) return;

    const start = {
      x: sourceRect.x + sourceRect.width / 2,
      y: sourceRect.y + sourceRect.height / 2
    };
    const end = {
      x: targetRect.x + targetRect.width / 2,
      y: targetRect.y + targetRect.height / 2
    };

    // Create a gentle curved path (single cubic) between centers
    const midX = (start.x + end.x) / 2;
    const pathD = `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`;

    const group = document.createElementNS(this.svgLayer.namespaceURI!, 'g');
    group.classList.add('relationship-group', 'overlay');
    // set table metadata for potential hover logic
    //group.dataset.fromTable = `table-${sourceTableId}`;
    //group.dataset.toTable = `table-${targetTableId}`;

    const baseLine = RelationshipWidget.createBaseLine(pathD);
    const flowLine = RelationshipWidget.createFlowLine(pathD);

    group.append(baseLine, flowLine);
    this.svgLayer.appendChild(group);
  }

  private renderRelationship(
      relationship: DbRelationship,
      pairConfigs: EndpointsConfig[],
      style: LineStyle
  ): void {
    const sourceTableId = this.sanitizeTableId(relationship.fromSchema, relationship.fromTable);
    const targetTableId = this.sanitizeTableId(relationship.toSchema, relationship.toTable);
    const pairCount = Math.min(relationship.fromColumns.length, relationship.toColumns.length);

    for (let i = 0; i < pairCount; i++) {
      this.renderColumnPair(
          relationship, i, sourceTableId, targetTableId,
          pairConfigs[i], style
      );
    }
  }

  private renderColumnPair(
      relationship: DbRelationship,
      index: number,
      sourceTableId: string,
      targetTableId: string,
      config: EndpointsConfig | undefined,
      style: LineStyle
  ): void {
    const sourceColId = `col-${sourceTableId}-${relationship.fromColumns[index]}`;
    const targetColId = `col-${targetTableId}-${relationship.toColumns[index]}`;

    const sourceRect = this.getElementRect(sourceColId);
    const targetRect = this.getElementRect(targetColId);

    if (!sourceRect || !targetRect || !config) return;

    const relationshipPath = new RelationshipPath();
    const pathData = relationshipPath.calculate(
        sourceRect, targetRect,
        sourceColId, targetColId,
        `table-${sourceTableId}`, `table-${targetTableId}`,
        style, config
    );

    const group = RelationshipWidget.createGroup(pathData);
    this.applyRelationshipColor(group, relationship);

    this.svgLayer.appendChild(group);
    this.renderAnchorPorts(pathData);
  }

  private renderAnchorPorts(pathData: import('./types').ConnectionPathData): void {
    const startPort = AnchorWidget.create(pathData.start);
    startPort.dataset.anchorId = pathData.fromId;
    this.svgLayer.appendChild(startPort);

    const endPort = AnchorWidget.create(pathData.end);
    endPort.dataset.anchorId = pathData.toId;
    this.svgLayer.appendChild(endPort);
  }

  private applyRelationshipColor(group: SVGGElement, relationship: DbRelationship): void {
    const color = relationship.settings?.color;
    if (!color) return;

    const baseLine = group.querySelector('.relation-line-base') as SVGPathElement | null;
    const flowLine = group.querySelector('.relation-line-flow') as SVGPathElement | null;

    if (baseLine) baseLine.style.stroke = color;
    if (flowLine) flowLine.style.stroke = color;
  }

  private getElementRect(elementId: string): Rect | undefined {
    const element = document.getElementById(elementId);
    if (!element) return undefined;

    const elementRect = element.getBoundingClientRect();
    const containerRect = this.svgLayer.getBoundingClientRect();
    const scale = this.getScale();

    return {
      x: (elementRect.left - containerRect.left) / scale,
      y: (elementRect.top - containerRect.top) / scale,
      width: elementRect.width / scale,
      height: elementRect.height / scale
    };
  }

  private sanitizeTableId(schema: string, table: string): string {
    // Match the Kotlin backend which uses the raw table name as the ID
    return table;
  }
}