// web/src/components/table.ts
import type {DbTable} from '../models/types';
import {ColumnComponent} from './column';
import {Icons} from './icons';

export class TableComponent {
  static create(table: DbTable): HTMLElement {
    const el = document.createElement('div');
    el.className = 'db-table';
    el.id = `table-${table.id}`;

    // <-- Expose the full (original) table name on the DOM so the drag code can
    // send the exact name back to the IDE when updating the DBML source.
    el.dataset.tableName = table.name;

    if (table.width) {
      el.style.width = `${table.width}px`;
    }

    const header = document.createElement('div');
    header.className = 'db-table-header';

    if (table.color) header.style.backgroundColor = table.color;

    const [schema, tableName] = table.name.includes('.') ? table.name.split('.') : ['', table.name];

    const titleWrapper = document.createElement('div');
    titleWrapper.className = 'header-title-wrapper';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'table-icon';
    iconSpan.innerHTML = Icons.Table;
    titleWrapper.appendChild(iconSpan);

    const title = document.createElement('span');
    title.className = 'title';
    title.innerText = tableName;
    titleWrapper.appendChild(title);

    header.appendChild(titleWrapper);

    const schemaBanner = document.createElement('span');
    schemaBanner.className = 'schema-banner';
    schemaBanner.innerText = schema || 'public';
    header.appendChild(schemaBanner);

    if (table.note) {
      const note = document.createElement('div');
      note.className = 'table-note';
      note.innerText = table.note;
      header.appendChild(note);
    }

    el.appendChild(header);

    table.fields.forEach(field => {
      el.appendChild(ColumnComponent.create(field, table.id));
    });

    // Add handle last
    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.title = 'Drag to resize';
    el.appendChild(handle);

    return el;
  }
}