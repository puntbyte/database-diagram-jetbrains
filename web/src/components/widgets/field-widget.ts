// web/src/components/widgets/field-widget.ts

import type {DbField} from '../../models/types.ts';
import {Icons} from '../ui/icons.ts';

const BADGE_CONFIG = {
  enum: {text: 'ENUM', className: 'enum', titlePrefix: 'Enum values: '},
  unique: {text: 'UQ', className: 'unique'},
  notNull: {text: 'NN', className: 'not-null'}
} as const;

const CSS = {
  row: 'db-row',
  indexedRow: 'indexed-row',
  mainRow: 'row-main',
  leftSection: 'row-left',
  rightSection: 'row-right',
  keyIcon: 'key-icon',
  pk: 'pk', fk: 'fk', pkFk: 'pk-fk', empty: 'empty',
  fieldName: 'field-name',
  fieldNote: 'field-note',     // full-width, placed outside the flex row
  typeContainer: 'type-container',
  fieldType: 'field-type',
  constrainedType: 'constrained-type',
  badge: 'badge'
} as const;

type KeyType = 'pk' | 'fk' | 'pkFk' | null;

export class FieldWidget {
  static create(field: DbField, tableId: string): HTMLElement {
    const row = document.createElement('div');
    row.className = CSS.row;
    row.id = `col-${tableId}-${field.name}`;
    if (field.isUnique) row.classList.add(CSS.indexedRow);

    // ── Main content row (flex between left and right) ──
    const mainRow = document.createElement('div');
    mainRow.className = CSS.mainRow;
    mainRow.append(this.createLeftSection(field), this.createRightSection(field));
    row.appendChild(mainRow);

    // ── Note: full-width, rendered BELOW the main row ──
    // FIX: Previously the note was nested inside .row-left (name-container) which
    // has `overflow: hidden` and only spans the left column width.  Long notes were
    // clipped mid-word.  Placing the note as a second child of .db-row (which is
    // now flex-direction:column) lets it span the full card width and wrap freely.
    if (field.note) {
      const note = document.createElement('div');
      note.className = CSS.fieldNote;
      note.textContent = field.note;
      row.appendChild(note);
    }

    return row;
  }

  // ── Left: key icon + field name ──────────────────────────────────────────

  private static createLeftSection(field: DbField): HTMLElement {
    const section = document.createElement('div');
    section.className = CSS.leftSection;
    section.append(this.createKeyIcon(field), this.createFieldName(field));
    return section;
  }

  private static createFieldName(field: DbField): HTMLElement {
    const span = document.createElement('span');
    span.className = CSS.fieldName;
    span.textContent = field.name;
    return span;
  }

  private static createKeyIcon(field: DbField): HTMLElement {
    const el = document.createElement('span');
    el.className = CSS.keyIcon;
    const keyType = this.keyType(field);
    if (keyType) {
      el.innerHTML = Icons.key;
      el.classList.add(CSS[keyType]);
      el.title = {pk: 'Primary Key', fk: 'Foreign Key', pkFk: 'Primary & Foreign Key'}[keyType];
    } else {
      el.classList.add(CSS.empty);
    }
    return el;
  }

  private static keyType(field: DbField): KeyType {
    if (field.isPrimaryKey && field.isForeignKey) return 'pkFk';
    if (field.isPrimaryKey) return 'pk';
    if (field.isForeignKey) return 'fk';
    return null;
  }

  // ── Right: badges + type chip (with inline default) ──────────────────────

  private static createRightSection(field: DbField): HTMLElement {
    const section = document.createElement('div');
    section.className = CSS.rightSection;
    section.append(...this.createBadges(field), this.createTypeChip(field));
    return section;
  }

  /** FIX: Show the default value inline beside the type as `type: default`
   *  instead of on a separate line.  This keeps rows compact and eliminates
   *  the ".field-default" element that caused the row to grow unpredictably. */
  private static createTypeChip(field: DbField): HTMLElement {
    const container = document.createElement('div');
    container.className = CSS.typeContainer;

    const chip = document.createElement('span');
    chip.className = CSS.fieldType;
    if (field.isUnique) chip.classList.add(CSS.constrainedType);

    chip.textContent = field.default
        ? `${field.type}: ${field.default}`
        : field.type;

    container.appendChild(chip);
    return container;
  }

  private static createBadges(field: DbField): HTMLElement[] {
    const badges: HTMLElement[] = [];
    if (field.enumValues?.length) {
      const b = this.badge(BADGE_CONFIG.enum);
      b.title = `${BADGE_CONFIG.enum.titlePrefix}${field.enumValues.join(', ')}`;
      badges.push(b);
    }
    if (field.isUnique) badges.push(this.badge(BADGE_CONFIG.unique));
    if (field.isNotNull) badges.push(this.badge(BADGE_CONFIG.notNull));
    return badges;
  }

  private static badge(config: { text: string; className: string }): HTMLElement {
    const el = document.createElement('span');
    el.className = `${CSS.badge} ${config.className}`;
    el.textContent = config.text;
    return el;
  }
}