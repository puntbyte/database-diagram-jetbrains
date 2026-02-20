// web/src/models/types.ts

export interface DbTable {
  id: string; // unique internal ID
  name: string;
  alias?: string;
  fields: DbField[];
  note?: string;
  color?: string;
  width?: number;
  // Position for dragging (initially 0,0 or from settings)
  x?: number;
  y?: number;
}

export interface DbField {
  name: string;
  type: string;
  isPk: boolean;
  isFk: boolean;
  isUnique: boolean;
  isNotNull: boolean;
  note?: string;
  default?: string;
  enumValues?: string[];
}

export type Cardinality = '1:1' | '1:n' | 'n:1' | 'm:n';

export interface DbRelationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type: Cardinality;
}