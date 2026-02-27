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
  labelStart: { text: string | null; pos: Point };
  labelEnd: { text: string | null; pos: Point };
  fromId: string;
  toId: string;
  fromTableId: string;
  toTableId: string;
}

export interface EndpointsConfig {
  // Vertical Spacing (per column)
  fromColIndex: number;
  fromColTotal: number;
  toColIndex: number;
  toColTotal: number;

  // Horizontal/Path Spacing (per table side)
  fromLaneIndex: number;
  toLaneIndex: number;

  // Labeling
  fromLabel: string | null;
  fromStagger: number;
  toLabel: string | null;
  toStagger: number;
}

export type LineStyle = 'Curve' | 'Rectilinear' | 'RoundRectilinear' | 'Oblique' | 'RoundOblique';