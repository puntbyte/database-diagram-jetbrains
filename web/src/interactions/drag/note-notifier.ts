// web/src/interactions/drag/note-notifier.ts

interface PositionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class NotePositionNotifier {
  private wrapper: HTMLElement;

  constructor(wrapper: HTMLElement) {
    this.wrapper = wrapper;
  }

  notify(element: HTMLElement, rect: PositionRect): void {
    const noteName = element.dataset.noteId || element.id.replace('note-', '');

    this.wrapper.dispatchEvent(new CustomEvent('note-position-changed', {
      detail: {
        name: noteName,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      },
      bubbles: true
    }));
  }
}