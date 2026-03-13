// web/src/interactions/drag/table-notifier.ts

import type { TablePositionCallback } from './entity-drag-handler.ts';

interface PositionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class TablePositionNotifier {
  private readonly callback: TablePositionCallback;

  constructor(callback: TablePositionCallback) {
    this.callback = callback;
  }

  notify(element: HTMLElement, rect: PositionRect): void {
    const tableName = this.extractTableName(element);
    if (tableName) {
      this.callback(tableName, rect.x, rect.y, rect.width);
    }
  }

  private extractTableName(element: HTMLElement): string | null {
    if (element.dataset.tableName) return element.dataset.tableName;

    const titleEl = element.querySelector('.title');
    if (titleEl?.textContent) return titleEl.textContent;

    return element.id.replace('table-', '') || null;
  }
}