// web/src/components/relationship/layout/field-arranger.ts

import type { DbRelationship } from '../../../models/types';
import type { EndpointsConfig } from '../types';
import type { EndpointInfo } from './relationship-layout.ts';

export class FieldArranger {
  distribute(
      columnGroups: Map<string, EndpointInfo[]>,
      configs: Map<DbRelationship, EndpointsConfig[]>
  ): void {
    for (const endpoints of columnGroups.values()) {
      this.distributeGroup(endpoints, configs);
    }
  }

  private distributeGroup(
      endpoints: EndpointInfo[],
      configs: Map<DbRelationship, EndpointsConfig[]>
  ): void {
    endpoints.sort((a, b) => a.targetY - b.targetY);

    const total = endpoints.length;
    const seenLabels = new Set<string>();
    let staggerCounter = 0;

    endpoints.forEach((ep, index) => {
      const config = configs.get(ep.relationship)?.[ep.columnPairIndex];
      if (!config) return;

      const { label, stagger } = this.determineLabel(ep.label, seenLabels, staggerCounter);
      if (stagger > 0) staggerCounter = stagger;

      this.applyConfig(config, ep.isSource, index, total, label, stagger);
    });
  }

  private determineLabel(
      rawLabel: string,
      seenLabels: Set<string>,
      currentStagger: number
  ): { label: string | null; stagger: number } {
    if (!rawLabel) return { label: null, stagger: 0 };

    if (!seenLabels.has(rawLabel)) {
      seenLabels.add(rawLabel);
      return { label: rawLabel, stagger: currentStagger + 1 };
    }

    return { label: rawLabel, stagger: 0 };
  }

  private applyConfig(
      config: EndpointsConfig,
      isSource: boolean,
      index: number,
      total: number,
      label: string | null,
      stagger: number
  ): void {
    if (isSource) {
      config.fromColIndex = index;
      config.fromColTotal = total;
      config.fromLabel = label;
      config.fromStagger = stagger;
    } else {
      config.toColIndex = index;
      config.toColTotal = total;
      config.toLabel = label;
      config.toStagger = stagger;
    }
  }
}