// web/src/models/type.ts

export interface IndexDef {
  columns: string[];
  settings?: Record<string,string>;
  raw?: string;
}

export interface DbTable {
  id: string;
  name: string;
  alias?: string;
  fields: DbField[];
  note?: string;
  color?: string;
  width?: number;
  x?: number;
  y?: number;
  settings?: Record<string,string>;
  indexes?: IndexDef[];
}

export interface DbNote {
  id: string;
  name: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height?: number;
  color?: string;
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
  inlineRef?: { symbol: string; toTable: string; toColumn: string };
}

export type Cardinality = '1:1' | '1:n' | 'n:1' | 'm:n';

export interface DbRelationship {
  fromTable: string;
  fromColumns: string[]; // Changed from string to string[]
  toTable: string;
  toColumns: string[];   // Changed from string to string[]
  type: Cardinality;
  settings?: Record<string, string>; // Added settings
}

// FIX: Allow boolean for showGrid
export interface ProjectSettings {
  zoom?: number;
  panX?: number;
  panY?: number;
  showGrid?: boolean;
  gridSize?: number; // New
  lineStyle?: string;
  databaseType?: string; // New
  note?: string;
  [key: string]: any;
}