// web/src/components/widgets/note-widget.ts

import type { DbNote } from '../../models/types.ts';

const CSS_CLASSES = {
  stickyNote: 'sticky-note',
  content: 'note-content',
  resizeHandle: 'resize-handle'
} as const;

const DEFAULT_TEXT_COLOR = '#1f2937';

export class NoteWidget {
  static create(note: DbNote): HTMLElement {
    const element = this.createContainer(note);
    const content = this.createContent(note.content);
    const handle = this.createResizeHandle();

    element.append(content, handle);
    return element;
  }

  private static createContainer(note: DbNote): HTMLElement {
    const el = document.createElement('div');
    el.className = CSS_CLASSES.stickyNote;
    el.id = `note-${note.id}`;
    el.dataset.noteId = note.name;

    // Apply Position & Size
    el.style.left = `${note.horizontal}px`;
    el.style.top = `${note.vertical}px`;
    el.style.width = `${note.width}px`;

    // Apply Color (Background)
    if (note.color) {
      el.style.backgroundColor = note.color;
      el.style.color = DEFAULT_TEXT_COLOR;
    }

    return el;
  }

  private static createContent(text: string): HTMLElement {
    const content = document.createElement('div');
    content.className = CSS_CLASSES.content;
    content.textContent = text; // Safe text insertion
    return content;
  }

  private static createResizeHandle(): HTMLElement {
    const handle = document.createElement('div');
    handle.className = CSS_CLASSES.resizeHandle;
    return handle;
  }
}