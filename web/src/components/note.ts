import type { DbNote } from '../models/types';

export class NoteComponent {
  static create(note: DbNote): HTMLElement {
    const el = document.createElement('div');
    el.className = 'sticky-note';
    el.id = `note-${note.id}`;
    el.dataset.noteId = note.name; // Store original name for saves

    // Apply Position & Size
    el.style.left = `${note.x}px`;
    el.style.top = `${note.y}px`;
    el.style.width = `${note.width}px`;

    // Apply Color (Background)
    // We expect hex codes. If user passes specific color, we use it.
    if (note.color) {
      el.style.backgroundColor = note.color;
      // Simple contrast check could go here, but defaulting text to dark usually works for notes
      el.style.color = '#1f2937';
    }

    // Render Content (Pre-formatted to preserve whitespace)
    const content = document.createElement('div');
    content.className = 'note-content';
    content.innerText = note.content; // Safe text insertion

    el.appendChild(content);

    // Resize Handle
    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    el.appendChild(handle);

    return el;
  }
}