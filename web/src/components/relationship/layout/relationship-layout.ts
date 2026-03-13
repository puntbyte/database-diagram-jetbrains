// web/src/components/relationship/layout/relationship-layout.ts

import type { DbRelationship } from '../../../models/types.ts';
import type { Rect, EndpointsConfig } from '../types.ts';
import { EndpointClassifier } from './endpoint-classifier.ts';
import { FieldArranger } from './field-arranger.ts';
import { LaneArranger } from './lane-arranger.ts';
import { LayoutConfig } from './layout-config.ts';

export interface LayoutContext {
  getRect: (id: string) => Rect | undefined;
  resolveTableId: (schema: string, table: string) => string;
  getLabel: (type: string, isSource: boolean) => string;
}

export class RelationshipLayout {
  private readonly grouper: EndpointClassifier;
  private readonly columnDistributor: FieldArranger;
  private readonly laneDistributor: LaneArranger;
  private readonly configBuilder: LayoutConfig;
  private context: LayoutContext;

  constructor(context: LayoutContext) {
    this.context = context;
    this.grouper = new EndpointClassifier(context);
    this.columnDistributor = new FieldArranger();
    this.laneDistributor = new LaneArranger();
    this.configBuilder = new LayoutConfig();
  }

  prepareLayout(relationships: DbRelationship[]): LayoutData {
    const configs = new Map<DbRelationship, EndpointsConfig[]>();
    const columnGroups = new Map<string, EndpointInfo[]>();
    const tableSideGroups = new Map<string, EndpointInfo[]>();

    relationships.forEach(rel => {
      const relConfigs = this.configBuilder.build(rel);
      configs.set(rel, relConfigs);
      this.grouper.groupRelationship(rel, relConfigs, columnGroups, tableSideGroups);
    });

    return { relationshipConfigs: configs, columnGroups, tableSideGroups };
  }

  distributeColumnSpacing(
      columnGroups: Map<string, EndpointInfo[]>,
      configs: Map<DbRelationship, EndpointsConfig[]>
  ): void {
    this.columnDistributor.distribute(columnGroups, configs);
  }

  distributeLaneSpacing(
      tableSideGroups: Map<string, EndpointInfo[]>,
      configs: Map<DbRelationship, EndpointsConfig[]>
  ): void {
    this.laneDistributor.distribute(tableSideGroups, configs);
  }
}

export interface EndpointInfo {
  relationship: DbRelationship;
  columnPairIndex: number;
  isSource: boolean;
  rect: Rect;
  targetY: number;
  label: string;
}

export interface LayoutData {
  relationshipConfigs: Map<DbRelationship, EndpointsConfig[]>;
  columnGroups: Map<string, EndpointInfo[]>;
  tableSideGroups: Map<string, EndpointInfo[]>;
}