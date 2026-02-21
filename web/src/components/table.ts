// web/src/components/table.ts

import type {DbTable} from '../models/types';
import {ColumnComponent} from './column';
import {Icons} from './icons';

export class TableComponent {
    static create(table: DbTable): HTMLElement {
        const el = document.createElement('div');
        el.className = 'db-table';
        el.id = `table-${table.id}`;
        el.dataset.tableName = table.name;

        // 1. Set Color Variable
        // Use the provided color or fall back to the CSS variable default
        const tableColor = table.color || 'var(--header-bg)';
        el.style.setProperty('--table-main-color', tableColor);

        if (table.width) {
            el.style.width = `${table.width}px`;
        }

        // 2. Parse Name
        const [schema, tableName] = table.name.includes('.') ? table.name.split('.') : ['', table.name];

        // --- CREATE OVERLAY (Hidden by default) ---
        const overlay = document.createElement('div');
        overlay.className = 'semantic-overlay';

        // Create a container for the text to handle scaling
        const overlayText = document.createElement('div');
        overlayText.className = 'overlay-text';
        overlayText.innerText = tableName;

        overlay.appendChild(overlayText);
        el.appendChild(overlay);
        // ------------------------------------------

        // 3. Normal Header
        const header = document.createElement('div');
        header.className = 'db-table-header';

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

        // 4. Columns
        table.fields.forEach(field => {
            el.appendChild(ColumnComponent.create(field, table.id));
        });

        // 5. Resize Handle
        const handle = document.createElement('div');
        handle.className = 'resize-handle';
        handle.title = 'Drag to resize';
        el.appendChild(handle);

        return el;
    }
}