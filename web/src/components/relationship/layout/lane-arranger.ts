// web/src/components/relationship/layout/lane-arranger.ts

import type {DbRelationship} from '../../../models/types';
import type {EndpointsConfig} from '../types';
import type {EndpointInfo} from './relationship-layout.ts';

export class LaneArranger {
  distribute(
      tableSideGroups: Map<string, EndpointInfo[]>,
      configs: Map<DbRelationship, EndpointsConfig[]>
  ): void {
    for (const endpoints of tableSideGroups.values()) {
      if (endpoints.length <= 1) continue;
      this.distributeGroup(endpoints, configs);
    }
  }

  private distributeGroup(
      endpoints: EndpointInfo[],
      configs: Map<DbRelationship, EndpointsConfig[]>
  ): void {
    const avgSourceY = endpoints.reduce((sum, ep) => sum + ep.rect.y, 0) / endpoints.length;
    const avgTargetY = endpoints.reduce((sum, ep) => sum + ep.targetY, 0) / endpoints.length;
    const goingDown = avgTargetY > avgSourceY;

    endpoints.sort((a, b) => {
      const yDiff = a.rect.y - b.rect.y;
      if (Math.abs(yDiff) > 1) return yDiff;
      return a.targetY - b.targetY;
    });

    endpoints.forEach((ep, i) => {
      const config = configs.get(ep.relationship)?.[ep.columnPairIndex];
      if (!config) return;

      const laneIndex = goingDown ? (endpoints.length - 1 - i) : i;

      if (ep.isSource) {
        config.fromLaneIndex = laneIndex;
      } else {
        config.toLaneIndex = laneIndex;
      }
    });
  }
}