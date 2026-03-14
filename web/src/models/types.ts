// web/src/models/types.ts

export interface DbProject {
  zoom?: number;
  panX?: number;
  panY?: number;
  databaseType?: string;
  note?: string;
  [key: string]: any;
}

export interface DbTable {
  id: string;
  schema: string;
  name: string;
  alias?: string;
  fields: DbField[];
  note?: string;
  color?: string;
  width?: number;
  horizontal?: number;
  vertical?: number;
  settings?: Record<string, string>;
  indexes?: DbIndex[];
}

export interface DbField {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isUnique: boolean;
  isNotNull: boolean;
  note?: string;
  default?: string;
  enumValues?: string[];
  reference?: DbReference;
}

export interface DbReference {
  symbol: string;
  toSchema: string;
  toTable: string;
  toColumn: string;
}

export type Cardinality = '1:1' | '1:n' | 'n:1' | 'm:n';

/** A single intermediate canvas point on a user-routed relationship path.
 *  Coordinates are relative to the anchor of the referenced table edge.
 *  `x` is measured outward from the anchor (positive = away from the table).
 *  `y` is measured downward from the column-row centre (may be negative). */
export interface WayPoint {
  /** Horizontal offset, always outward from the referenced edge */
  x: number;
  /** Vertical offset from the column-row centre */
  y: number;
  /** Which table's anchor to base this offset on */
  from: 'source' | 'target';
}

export interface DbRelationship {
  fromSchema: string;
  fromTable: string;
  fromColumns: string[];
  toSchema: string;
  toTable: string;
  toColumns: string[];
  type: Cardinality;
  settings?: Record<string, string>;
  /** Explicit side of the source table the line exits from */
  sourceAnchor?: 'left' | 'right';
  /** Explicit side of the target table the line arrives at */
  targetAnchor?: 'left' | 'right';
  /** User-defined intermediate waypoints loaded from the .erd.yaml */
  waypoints?: WayPoint[];
}

export interface DbIndex {
  columns: string[];
  settings?: Record<string, string>;
  raw?: string;
}

export interface DbNote {
  id: string;
  name: string;
  content: string;
  horizontal: number;
  vertical: number;
  width: number;
  height?: number;
  color?: string;
}