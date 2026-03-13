// web/src/core/diagram/entity-renderer.ts

import { TableWidget } from '../../components/widgets/table-widget';
import { NoteWidget } from '../../components/widgets/note-widget';
import { RelationshipManager } from '../../components/relationship';
import type { DbTable, DbNote, DbRelationship } from '../../models/types';
import { TableArranger } from './table-arranger.ts';
import { EntityDragHandler } from "../../interactions/drag/entity-drag-handler.ts";

export class EntityRenderer {
  readonly dragHandler: EntityDragHandler;
  private readonly entityLayer: HTMLElement;
  private readonly layoutEngine: TableArranger;

  constructor(
      entityLayer: HTMLElement,
      relationshipManager: RelationshipManager,
      onTablePositionChange: (name: string, x: number, y: number, width?: number) => void
  ) {
    this.entityLayer = entityLayer;
    this.layoutEngine = new TableArranger();

    this.dragHandler = new EntityDragHandler(
        entityLayer,
        relationshipManager,
        onTablePositionChange
    );
  }

  updateScale(scale: number): void {
    this.dragHandler.updateScale(scale);
  }

  // FIX: Provide a way to pass relationships to the drag handler
  setRelationships(relationships: DbRelationship[]): void {
    this.dragHandler.setRelationships(relationships);
  }

  renderAll(tables: DbTable[], notes?: DbNote[]): void {
    this.renderTables(tables);
    this.renderNotes(notes);
  }

  private renderTables(tables: DbTable[]): void {
    const layout = this.layoutEngine.calculate(tables.length);

    tables.forEach((table, index) => {
      const element = TableWidget.create(table);
      const position = this.resolvePosition(table, index, layout);

      element.style.left = `${position.x}px`;
      element.style.top = `${position.y}px`;

      this.entityLayer.appendChild(element);
    });
  }

  private resolvePosition(table: DbTable, index: number, layout: ReturnType<TableArranger['calculate']>): { x: number; y: number } {
    if (table.horizontal !== undefined && table.horizontal !== null) {
      return { x: table.horizontal, y: table.vertical! };
    }
    return this.layoutEngine.getPosition(index, layout);
  }

  private renderNotes(notes?: DbNote[]): void {
    if (!notes) return;
    notes.forEach(note => this.entityLayer.appendChild(NoteWidget.create(note)));
  }
}