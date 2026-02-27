// web/src/components/column.ts

import type {DbField} from '../models/types';
import {Icons} from './icons';

export class ColumnComponent {
  static create(field: DbField, tableId: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'db-row';
    row.id = `col-${tableId}-${field.name}`;

    if (field.isUnique) {
      row.classList.add('indexed-row');
    }

    const left = document.createElement('div');
    left.className = 'row-left';

    // --- KEY ICON LOGIC ---
    const iconContainer = document.createElement('span');
    // Base class for CSS targeting
    iconContainer.className = 'key-icon';

    if (field.isPk || field.isFk) {
      // Inject SVG
      iconContainer.innerHTML = Icons.Key;

      // Add modifier classes for coloring
      if (field.isPk && field.isFk) {
        iconContainer.classList.add('pk-fk');
        iconContainer.title = "Primary & Foreign Key";
      } else if (field.isPk) {
        iconContainer.classList.add('pk');
        iconContainer.title = "Primary Key";
      } else {
        iconContainer.classList.add('fk');
        iconContainer.title = "Foreign Key";
      }
    } else {
      // Empty placeholder
      iconContainer.classList.add('empty');
    }

    left.appendChild(iconContainer);
    // ---------------------

    const nameContainer = document.createElement('div');
    nameContainer.className = 'name-container';

    const name = document.createElement('span');
    name.className = 'field-name';
    name.innerText = field.name;
    nameContainer.appendChild(name);

    if (field.note) {
      const note = document.createElement('div');
      note.className = 'field-note';
      note.innerText = field.note;
      nameContainer.appendChild(note);
    }

    left.appendChild(nameContainer);

    const right = document.createElement('div');
    right.className = 'row-right';

    // ... (Rest of the file remains unchanged: Types, Badges, etc.) ...
    const typeContainer = document.createElement('div');
    typeContainer.className = 'type-container';

    const type = document.createElement('span');
    type.className = 'field-type';
    if (field.isUnique) type.classList.add('constrained-type');
    type.innerText = field.type;
    typeContainer.appendChild(type);

    if (field.enumValues && field.enumValues.length > 0) {
      const enumBadge = this.createBadge('ENUM', 'enum');
      enumBadge.title = `Enum values: ${field.enumValues.join(', ')}`;
      right.appendChild(enumBadge);
    }

    if (field.isUnique) right.appendChild(this.createBadge('UQ', 'unique'));
    if (field.isNotNull) right.appendChild(this.createBadge('NN', 'not-null'));

    if (field.default) {
      const def = document.createElement('div');
      def.className = 'field-default';
      def.innerText = `default: ${field.default}`;
      typeContainer.appendChild(def);
    }

    right.appendChild(typeContainer);
    row.appendChild(left);
    row.appendChild(right);

    return row;
  }

  private static createBadge(text: string, cls: string): HTMLElement {
    const s = document.createElement('span');
    s.className = `badge ${cls}`;
    s.innerText = text;
    return s;
  }
}