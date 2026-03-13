// web/src/components/relationship/layout/layout-config.ts

import type { DbRelationship } from '../../../models/types';
import type { EndpointsConfig } from '../types';

export class LayoutConfig {
  build(relationship: DbRelationship): EndpointsConfig[] {
    const pairCount = Math.max(1, Math.min(
        relationship.fromColumns.length,
        relationship.toColumns.length
    ));

    return Array.from({ length: pairCount }, () => ({
      fromColIndex: 0, fromColTotal: 1,
      toColIndex: 0, toColTotal: 1,
      fromLaneIndex: 0, toLaneIndex: 0,
      fromLabel: null, fromStagger: 0,
      toLabel: null, toStagger: 0
    }));
  }
}