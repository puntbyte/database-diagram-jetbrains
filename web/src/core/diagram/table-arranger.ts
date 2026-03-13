// web/src/core/diagram/table-arranger.ts

interface LayoutConfig {
  gapX: number;
  gapY: number;
  columns: number;
  rows: number;
  offsetX: number;
  offsetY: number;
}

export class TableArranger {
  private readonly defaultGapX = 350;
  private readonly defaultGapY = 300;

  calculate(tableCount: number): LayoutConfig {
    const columns = Math.ceil(Math.sqrt(tableCount || 1));
    const rows = Math.ceil(tableCount / columns);

    return {
      gapX: this.defaultGapX,
      gapY: this.defaultGapY,
      columns,
      rows,
      offsetX: -((columns - 1) * this.defaultGapX) / 2,
      offsetY: -((rows - 1) * this.defaultGapY) / 2
    };
  }

  getPosition(index: number, layout: LayoutConfig): { x: number; y: number } {
    return {
      x: layout.offsetX + (index % layout.columns) * layout.gapX,
      y: layout.offsetY + Math.floor(index / layout.columns) * layout.gapY
    };
  }
}