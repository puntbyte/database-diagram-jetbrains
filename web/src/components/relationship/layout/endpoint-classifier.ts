// web/src/components/relationship/layout/endpoint-classifier.ts

import type { DbRelationship } from '../../../models/types';
import type { Rect, EndpointsConfig } from '../types';
import type { EndpointInfo, LayoutContext } from './relationship-layout.ts';

export class EndpointClassifier {
  private context: LayoutContext;

  constructor(context: LayoutContext) {
    this.context = context;
  }

  groupRelationship(
      rel: DbRelationship,
      configs: EndpointsConfig[],
      columnGroups: Map<string, EndpointInfo[]>,
      tableSideGroups: Map<string, EndpointInfo[]>
  ): void {
    const sourceTableId = this.context.resolveTableId(rel.fromSchema, rel.fromTable);
    const targetTableId = this.context.resolveTableId(rel.toSchema, rel.toTable);

    for (let i = 0; i < configs.length; i++) {
      this.groupColumnPair(
          rel, i, sourceTableId, targetTableId,
          columnGroups, tableSideGroups
      );
    }
  }

  private groupColumnPair(
      rel: DbRelationship,
      index: number,
      sourceTableId: string,
      targetTableId: string,
      columnGroups: Map<string, EndpointInfo[]>,
      tableSideGroups: Map<string, EndpointInfo[]>
  ): void {
    const sourceColId = `col-${sourceTableId}-${rel.fromColumns[index]}`;
    const targetColId = `col-${targetTableId}-${rel.toColumns[index]}`;

    const sourceRect = this.context.getRect(sourceColId);
    const targetRect = this.context.getRect(targetColId);

    if (!sourceRect || !targetRect) return;

    const isFirstPair = index === 0;
    const sourceLabel = isFirstPair ? this.context.getLabel(rel.type, true) : '';
    const targetLabel = isFirstPair ? this.context.getLabel(rel.type, false) : '';

    this.addToColumnGroup(columnGroups, sourceColId, {
      relationship: rel,
      columnPairIndex: index,
      isSource: true,
      rect: sourceRect,
      targetY: targetRect.y + targetRect.height / 2,
      label: sourceLabel
    });

    this.addToColumnGroup(columnGroups, targetColId, {
      relationship: rel,
      columnPairIndex: index,
      isSource: false,
      rect: targetRect,
      targetY: sourceRect.y + sourceRect.height / 2,
      label: targetLabel
    });

    this.categorizeByTableSide(rel, index, sourceRect, targetRect, sourceTableId, targetTableId, tableSideGroups);
  }

  private addToColumnGroup(
      groups: Map<string, EndpointInfo[]>,
      key: string,
      info: EndpointInfo
  ): void {
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(info);
  }

  private categorizeByTableSide(
      rel: DbRelationship,
      index: number,
      sourceRect: Rect,
      targetRect: Rect,
      sourceTableId: string,
      targetTableId: string,
      tableSideGroups: Map<string, EndpointInfo[]>
  ): void {
    const sourceSide = sourceRect.x < targetRect.x ? 'right' : 'left';
    const targetSide = targetRect.x < sourceRect.x ? 'right' : 'left';

    const sourceKey = `${sourceTableId}-${sourceSide}`;
    const targetKey = `${targetTableId}-${targetSide}`;

    this.addToSideGroup(tableSideGroups, sourceKey, {
      relationship: rel,
      columnPairIndex: index,
      isSource: true,
      rect: sourceRect,
      targetY: targetRect.y + targetRect.height / 2,
      label: ''
    });

    this.addToSideGroup(tableSideGroups, targetKey, {
      relationship: rel,
      columnPairIndex: index,
      isSource: false,
      rect: targetRect,
      targetY: sourceRect.y + sourceRect.height / 2,
      label: ''
    });
  }

  private addToSideGroup(
      groups: Map<string, EndpointInfo[]>,
      key: string,
      info: EndpointInfo
  ): void {
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(info);
  }
}