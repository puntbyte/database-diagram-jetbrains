// web/src/components/relationship/types.ts

import type { WayPoint } from '../../models/types';
export type { WayPoint };

export interface Point { x: number; y: number; }
export interface Rect  { x: number; y: number; width: number; height: number; }

export interface ConnectionPathData {
  d: string;
  start: Point;
  end: Point;
  labelStart: { text: string | null; pos: Point };
  labelEnd:   { text: string | null; pos: Point };
  fromId: string;
  toId: string;
  fromTableId: string;
  toTableId: string;
}

export interface EndpointsConfig {
  // Vertical spacing (per column)
  fromColIndex: number;
  fromColTotal: number;
  toColIndex: number;
  toColTotal: number;

  // Horizontal/path spacing (per table side)
  fromLaneIndex: number;
  toLaneIndex: number;

  // Labelling
  fromLabel: string | null;
  fromStagger: number;
  toLabel: string | null;
  toStagger: number;

  // Routing overrides from .erd.yaml
  /** Force exit from this side of the source table */
  sourceAnchor?: 'left' | 'right';
  /** Force arrival at this side of the target table */
  targetAnchor?: 'left' | 'right';
  /** Resolved YAML waypoints; PathGeometer converts these to absolute canvas coords */
  waypoints?: WayPoint[];
  /** True when fromTable === toTable (self-referencing FK) */
  isSelfReference?: boolean;
}

export type LineStyle = 'Curve' | 'Rectilinear' | 'RoundRectilinear' | 'Oblique' | 'RoundOblique';