// web/src/components/relationship/relationship-renderer.ts

import type {DbRelationship} from '../../models/types';
import type {EndpointsConfig, LineStyle, Rect} from './types';
import {RelationshipPath} from './path/relationship-path.ts';
import {RelationshipWidget} from '../widgets/relationship-widget.ts';
import {AnchorWidget} from '../widgets/anchor-widget.ts';
import {PathGeometer} from './path/path-geometer.ts';
import {PathComposer} from './path/path-composer.ts';

export class RelationshipRenderer {
  private svgLayer: SVGSVGElement;
  private readonly getScale: () => number;

  constructor(svgLayer: SVGSVGElement, getScale: () => number) {
    this.svgLayer = svgLayer;
    this.getScale = getScale;
  }

  render(
      relationships: DbRelationship[],
      configs: Map<DbRelationship, EndpointsConfig[]>,
      style: LineStyle,
      overlayMode: boolean = false
  ): void {
    if (overlayMode) {
      // FIX: Use the configured line style for overlay lines instead of a hardcoded bezier.
      // This makes the overlay visually consistent with the full-detail view and removes
      // the jarring style switch that happened at the semantic-zoom threshold.
      relationships.forEach(rel => this.renderOverlayRelationship(rel, style));
      return;
    }
    relationships.forEach(rel => this.renderRelationship(rel, configs.get(rel) ?? [], style));
  }

  // FIX: Use PathGeometer + PathComposer so overlay lines honour the configured style.
  private renderOverlayRelationship(relationship: DbRelationship, style: LineStyle): void {
    const srcId = `table-${relationship.fromTable}`;
    const dstId = `table-${relationship.toTable}`;

    const srcRect = this.getElementRect(srcId);
    const dstRect = this.getElementRect(dstId);
    if (!srcRect || !dstRect) return;

    // Measure from table centre to table centre.
    const fromRect: Rect = {
      x: srcRect.x + srcRect.width / 2,
      y: srcRect.y + srcRect.height / 2,
      width: 0,
      height: 0
    };
    const toRect: Rect = {
      x: dstRect.x + dstRect.width / 2,
      y: dstRect.y + dstRect.height / 2,
      width: 0,
      height: 0
    };

    const isSelfRef = relationship.fromTable === relationship.toTable;
    const config: EndpointsConfig = {
      fromColIndex: 0, fromColTotal: 1, toColIndex: 0, toColTotal: 1,
      fromLaneIndex: 0, toLaneIndex: 0,
      fromLabel: null, fromStagger: 0, toLabel: null, toStagger: 0,
      isSelfReference: isSelfRef
    };

    const geo = new PathGeometer().calculate(fromRect, toRect, config, style);
    const d = new PathComposer().generate(geo, style);

    const group = document.createElementNS(this.svgLayer.namespaceURI!, 'g');
    group.classList.add('relationship-group', 'overlay');
    group.append(RelationshipWidget.createBaseLine(d), RelationshipWidget.createFlowLine(d));
    this.svgLayer.appendChild(group);
  }

  private renderRelationship(
      relationship: DbRelationship,
      pairConfigs: EndpointsConfig[],
      style: LineStyle
  ): void {
    const sourceTableId = relationship.fromTable;
    const targetTableId = relationship.toTable;
    // FIX: Mark self-referencing relationships so PathGeometer forces the left anchor.
    const isSelfReference = sourceTableId === targetTableId;
    const pairCount = Math.min(relationship.fromColumns.length, relationship.toColumns.length);

    for (let i = 0; i < pairCount; i++) {
      const baseConfig = pairConfigs[i];
      if (!baseConfig) continue;
      // Inject isSelfReference into the config without mutating the shared object.
      const config: EndpointsConfig = {...baseConfig, isSelfReference};
      this.renderColumnPair(relationship, i, sourceTableId, targetTableId, config, style);
    }
  }

  private renderColumnPair(
      relationship: DbRelationship,
      index: number,
      sourceTableId: string,
      targetTableId: string,
      config: EndpointsConfig,
      style: LineStyle
  ): void {
    const srcColId = `col-${sourceTableId}-${relationship.fromColumns[index]}`;
    const dstColId = `col-${targetTableId}-${relationship.toColumns[index]}`;

    const srcRect = this.getElementRect(srcColId);
    const dstRect = this.getElementRect(dstColId);
    if (!srcRect || !dstRect) return;

    const pathData = new RelationshipPath().calculate(
        srcRect, dstRect, srcColId, dstColId,
        `table-${sourceTableId}`, `table-${targetTableId}`,
        style, config
    );

    const group = RelationshipWidget.createGroup(pathData);
    this.applyRelationshipColor(group, relationship);
    this.svgLayer.appendChild(group);
    this.renderAnchorPorts(pathData);
  }

  private renderAnchorPorts(pathData: import('./types').ConnectionPathData): void {
    const s = AnchorWidget.create(pathData.start);
    s.dataset.anchorId = pathData.fromId;
    this.svgLayer.appendChild(s);

    const e = AnchorWidget.create(pathData.end);
    e.dataset.anchorId = pathData.toId;
    this.svgLayer.appendChild(e);
  }

  private applyRelationshipColor(group: SVGGElement, rel: DbRelationship): void {
    const color = rel.settings?.color;
    if (!color) return;
    (group.querySelector('.relation-line-base') as SVGPathElement | null)?.style.setProperty('stroke', color);
    (group.querySelector('.relation-line-flow') as SVGPathElement | null)?.style.setProperty('stroke', color);
  }

  private getElementRect(elementId: string): Rect | undefined {
    const el = document.getElementById(elementId);
    if (!el) return undefined;
    const er = el.getBoundingClientRect();
    const cr = this.svgLayer.getBoundingClientRect();
    if (cr.width === 0 && cr.height === 0) return undefined;
    const s = this.getScale();
    return {
      x: (er.left - cr.left) / s,
      y: (er.top - cr.top) / s,
      width: er.width / s,
      height: er.height / s
    };
  }
}