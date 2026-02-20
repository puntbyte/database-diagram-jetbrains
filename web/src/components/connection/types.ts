// web/src/components/connection/types.ts

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ConnectionPathData {
  d: string;
  start: Point;
  end: Point;
  labelStart: Point;
  labelEnd: Point;
  // Identifiers for interaction
  fromId: string;
  toId: string;
  fromTableId: string;
  toTableId: string;
}

export type LineStyle = 'Curve' | 'Rectilinear' | 'RoundRectilinear' | 'Oblique' | 'RoundOblique';
