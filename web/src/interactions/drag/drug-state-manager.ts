// web/src/interactions/drag/drug-state-manager.ts

export type DragMode = 'idle' | 'dragging' | 'resizing';

interface DragState {
  mode: DragMode;
  element: HTMLElement | null;
  startMouse: { x: number; y: number };
  startValues: { x: number; y: number; width: number; height: number };
}

export class DragStateManager {
  private state: DragState = {
    mode: 'idle',
    element: null,
    startMouse: { x: 0, y: 0 },
    startValues: { x: 0, y: 0, width: 0, height: 0 }
  };

  beginDrag(element: HTMLElement, event: MouseEvent): void {
    this.state = {
      mode: 'dragging',
      element,
      startMouse: { x: event.clientX, y: event.clientY },
      startValues: {
        x: element.offsetLeft,
        y: element.offsetTop,
        width: element.offsetWidth,
        height: element.offsetHeight
      }
    };
    element.classList.add('dragging');
  }

  beginResize(element: HTMLElement, event: MouseEvent): void {
    this.state = {
      mode: 'resizing',
      element,
      startMouse: { x: event.clientX, y: event.clientY },
      startValues: {
        x: element.offsetLeft,
        y: element.offsetTop,
        width: element.offsetWidth,
        height: element.offsetHeight
      }
    };
    element.classList.add('resizing');
  }

  getState(): DragState {
    return this.state;
  }

  getStartMouse(): { x: number; y: number } {
    return this.state.startMouse;
  }

  getStartValues(): { x: number; y: number; width: number; height: number } {
    return this.state.startValues;
  }

  reset(): void {
    this.state = {
      mode: 'idle',
      element: null,
      startMouse: { x: 0, y: 0 },
      startValues: { x: 0, y: 0, width: 0, height: 0 }
    };
  }
}