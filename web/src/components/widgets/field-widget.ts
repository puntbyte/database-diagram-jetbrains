// web/src/components/widgets/field-widget.ts

import type {DbField} from '../../models/types.ts';
import {Icons} from '../ui/icons.ts';

// Extract configuration
const BADGE_CONFIG = {
  enum: { text: 'ENUM', className: 'enum', titlePrefix: 'Enum values: ' },
  unique: { text: 'UQ', className: 'unique' },
  notNull: { text: 'NN', className: 'not-null' }
} as const;

const CSS_CLASSES = {
  row: 'db-row',
  indexedRow: 'indexed-row',
  leftSection: 'row-left',
  rightSection: 'row-right',
  keyIcon: 'key-icon',
  pk: 'pk',
  fk: 'fk',
  pkFk: 'pk-fk',
  empty: 'empty',
  nameContainer: 'name-container',
  fieldName: 'field-name',
  fieldNote: 'field-note',
  typeContainer: 'type-container',
  fieldType: 'field-type',
  constrainedType: 'constrained-type',
  fieldDefault: 'field-default',
  badge: 'badge'
} as const;

type KeyType = 'pk' | 'fk' | 'pkFk' | null;

export class FieldWidget {
  static create(field: DbField, tableId: string): HTMLElement {
    const row = this.createRow(field, tableId);
    const leftSection = this.createLeftSection(field);
    const rightSection = this.createRightSection(field);

    row.append(leftSection, rightSection);
    return row;
  }

  private static createRow(field: DbField, tableId: string): HTMLElement {
    const row = document.createElement('div');
    row.className = CSS_CLASSES.row;
    row.id = `col-${tableId}-${field.name}`;

    if (field.isUnique) {
      row.classList.add(CSS_CLASSES.indexedRow);
    }

    return row;
  }

  private static createLeftSection(field: DbField): HTMLElement {
    const section = document.createElement('div');
    section.className = CSS_CLASSES.leftSection;

    const keyIcon = this.createKeyIcon(field);
    const nameContainer = this.createNameContainer(field);

    section.append(keyIcon, nameContainer);
    return section;
  }

  private static createKeyIcon(field: DbField): HTMLElement {
    const container = document.createElement('span');
    container.className = CSS_CLASSES.keyIcon;

    const keyType = this.determineKeyType(field);

    if (keyType) {
      container.innerHTML = Icons.key;
      container.classList.add(CSS_CLASSES[keyType]);
      container.title = this.getKeyTitle(keyType);
    } else {
      container.classList.add(CSS_CLASSES.empty);
    }

    return container;
  }

  private static determineKeyType(field: DbField): KeyType {
    if (field.isPrimaryKey && field.isForeignKey) return 'pkFk';
    if (field.isPrimaryKey) return 'pk';
    if (field.isForeignKey) return 'fk';
    return null;
  }

  private static getKeyTitle(keyType: Exclude<KeyType, null>): string {
    const titles = {
      pk: 'Primary Key',
      fk: 'Foreign Key',
      pkFk: 'Primary & Foreign Key'
    };
    return titles[keyType];
  }

  private static createNameContainer(field: DbField): HTMLElement {
    const container = document.createElement('div');
    container.className = CSS_CLASSES.nameContainer;

    const name = document.createElement('span');
    name.className = CSS_CLASSES.fieldName;
    name.textContent = field.name;
    container.appendChild(name);

    if (field.note) {
      const note = document.createElement('div');
      note.className = CSS_CLASSES.fieldNote;
      note.textContent = field.note;
      container.appendChild(note);
    }

    return container;
  }

  private static createRightSection(field: DbField): HTMLElement {
    const section = document.createElement('div');
    section.className = CSS_CLASSES.rightSection;

    const typeContainer = this.createTypeContainer(field);
    const badges = this.createBadges(field);

    section.append(...badges, typeContainer);
    return section;
  }

  private static createTypeContainer(field: DbField): HTMLElement {
    const container = document.createElement('div');
    container.className = CSS_CLASSES.typeContainer;

    const type = document.createElement('span');
    type.className = CSS_CLASSES.fieldType;
    if (field.isUnique) {
      type.classList.add(CSS_CLASSES.constrainedType);
    }
    type.textContent = field.type;
    container.appendChild(type);

    if (field.default) {
      const defaultValue = document.createElement('div');
      defaultValue.className = CSS_CLASSES.fieldDefault;
      defaultValue.textContent = `default: ${field.default}`;
      container.appendChild(defaultValue);
    }

    return container;
  }

  private static createBadges(field: DbField): HTMLElement[] {
    const badges: HTMLElement[] = [];

    if (field.enumValues?.length) {
      const enumBadge = this.createBadge(BADGE_CONFIG.enum);
      enumBadge.title = `${BADGE_CONFIG.enum.titlePrefix}${field.enumValues.join(', ')}`;
      badges.push(enumBadge);
    }

    if (field.isUnique) {
      badges.push(this.createBadge(BADGE_CONFIG.unique));
    }

    if (field.isNotNull) {
      badges.push(this.createBadge(BADGE_CONFIG.notNull));
    }

    return badges;
  }

  private static createBadge(config: { text: string; className: string }): HTMLElement {
    const badge = document.createElement('span');
    badge.className = `${CSS_CLASSES.badge} ${config.className}`;
    badge.textContent = config.text;
    return badge;
  }
}