// web/src/components/widgets/table-widget.ts

import type {DbTable} from '../../models/types.ts';
import {FieldWidget} from './field-widget.ts';
import {Icons} from '../ui/icons.ts';

// Extract constants for magic values
const CSS_CLASSES = {
  table: 'db-table',
  overlay: 'semantic-overlay',
  overlayText: 'overlay-text',
  header: 'db-table-header',
  titleWrapper: 'header-title-wrapper',
  tableIcon: 'table-icon',
  title: 'title',
  schemaBanner: 'schema-banner',
  tableNote: 'table-note',
  resizeHandle: 'resize-handle'
} as const;

export class TableWidget {
  static create(table: DbTable): HTMLElement {
    const tableElement = this.createTableContainer(table);
    const header = this.createHeader(table);
    const fields = this.createFields(table);
    const resizeHandle = this.createResizeHandle();

    tableElement.append(header, ...fields, resizeHandle);
    return tableElement;
  }

  private static createTableContainer(table: DbTable): HTMLElement {
    const el = document.createElement('div');
    el.className = CSS_CLASSES.table;
    el.id = `table-${table.id}`;

    // CRITICAL: Construct the exact name the Kotlin Editor expects so saves work!
    el.dataset.tableName = table.schema === 'public'
        ? table.name
        : `${table.schema}.${table.name}`;

    const tableColor = table.color || 'var(--header-bg)';
    el.style.setProperty('--table-main-color', tableColor);

    if (table.width) {
      el.style.width = `${table.width}px`;
    }

    el.appendChild(this.createOverlay(table.name));
    return el;
  }

  private static createOverlay(displayName: string): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = CSS_CLASSES.overlay;

    const text = document.createElement('div');
    text.className = CSS_CLASSES.overlayText;
    text.textContent = displayName;

    overlay.appendChild(text);
    return overlay;
  }

  private static createHeader(table: DbTable): HTMLElement {
    const header = document.createElement('div');
    header.className = CSS_CLASSES.header;

    const titleSection = this.createTitleSection(table.name);
    const schemaBadge = this.createSchemaBadge(table.schema);

    header.append(titleSection, schemaBadge);

    if (table.note) {
      header.appendChild(this.createNote(table.note));
    }

    return header;
  }

  private static createTitleSection(tableName: string): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = CSS_CLASSES.titleWrapper;

    const icon = document.createElement('span');
    icon.className = CSS_CLASSES.tableIcon;
    icon.innerHTML = Icons.table;

    const title = document.createElement('span');
    title.className = CSS_CLASSES.title;
    title.textContent = tableName;

    wrapper.append(icon, title);
    return wrapper;
  }

  private static createSchemaBadge(schema: string): HTMLElement {
    const badge = document.createElement('span');
    badge.className = CSS_CLASSES.schemaBanner;
    badge.textContent = schema;
    return badge;
  }

  private static createNote(noteText: string): HTMLElement {
    const note = document.createElement('div');
    note.className = CSS_CLASSES.tableNote;
    note.textContent = noteText;
    return note;
  }

  private static createFields(table: DbTable): HTMLElement[] {
    return table.fields.map(field => FieldWidget.create(field, table.id));
  }

  private static createResizeHandle(): HTMLElement {
    const handle = document.createElement('div');
    handle.className = CSS_CLASSES.resizeHandle;
    handle.title = 'Drag to resize';
    return handle;
  }
}