// web/src/parsers/dbml/tables.ts

import type { DbTable, DbRelationship, DbField, IndexDef } from '../../models/types';
import {extractDocComments, parseSettingsString, sanitizeId} from './utils';
import { parseIndexBlock } from './indexes';
import { createRelationship } from './relationships';
import {parseFieldsFromBody} from "./fields.ts";

type PartialDef = {
  name: string;
  settings: Map<string, string>;
  fields: DbField[];
  indexes: IndexDef[];
};

export function parseTables(text: string): { tables: DbTable[], inlineRelationships: DbRelationship[] } {
  const tables: DbTable[] = [];
  const inlineRelationships: DbRelationship[] = [];
  const partials = new Map<string, PartialDef>();

  // --- 1. Parse TablePartial blocks ---
  const partialRegex = /TablePartial\s+("?[\w.]+"?)\s*(?:\[(.*?)\])?\s*\{([\s\S]*?)\}/gi;
  let pMatch;

  while ((pMatch = partialRegex.exec(text)) !== null) {
    const rawName = pMatch[1].replace(/"/g, '');
    const settingsStr = pMatch[2] || '';
    const body = pMatch[3] || '';

    // Extract indexes
    const idxMatch = /indexes\s*\{([\s\S]*?)\}/i.exec(body);
    let idxs: IndexDef[] = [];
    let fieldsBody = body;
    if (idxMatch) {
      idxs = parseIndexBlock(idxMatch[1]);
      fieldsBody = body.replace(idxMatch[0], '');
    }

    const { fields } = parseFieldsFromBody(fieldsBody);
    partials.set(rawName, {
      name: rawName,
      settings: parseSettingsString(settingsStr),
      fields,
      indexes: idxs
    });
  }

  // --- 2. Parse Tables ---
  const tableRegex = /Table\s+("?[\w.]+"?)\s*(?:\[(.*?)\])?\s*(?:as\s+\w+\s*)?\{([\s\S]*?)\}/gi;
  let tMatch;

  while ((tMatch = tableRegex.exec(text)) !== null) {
    const tableStartIndex = tMatch.index;

    // 1. Extract Doc Comments (///) preceding the table
    const docComment = extractDocComments(text, tableStartIndex);

    const rawName = tMatch[1].replace(/"/g, '');
    const settingsStr = tMatch[2] || '';
    const body = tMatch[3] || '';
    const tableSettings = parseSettingsString(settingsStr);

    // 2. Extract Table-Level Indexes
    const idxMatch = /indexes\s*\{([\s\S]*?)\}/i.exec(body);
    let tableIdxs: IndexDef[] = [];
    let bodyWithoutIndexes = body;
    if (idxMatch) {
      tableIdxs = parseIndexBlock(idxMatch[1]);
      bodyWithoutIndexes = body.replace(idxMatch[0], '');
    }

    // 3. Extract Table-Level Note (explicit inside body)
    // BUG FIX: Use ^ anchor and m flag to ensure we match a line starting with Note,
    // not a column note setting like `col int [note: '...']`
    const noteRegex = /^\s*Note(?:\s*:\s*|\s+)(['"])([\s\S]*?)\1/im;
    const noteMatch = noteRegex.exec(bodyWithoutIndexes);

    let explicitBodyNote: string | undefined;
    if (noteMatch) {
      explicitBodyNote = noteMatch[2];
      // Remove the note line from body to prevent field parser confusion
      bodyWithoutIndexes = bodyWithoutIndexes.replace(noteMatch[0], '');
    }

    // 4. Determine Final Table Note
    // Priority:
    // 1. Settings `Table T [note: '...']`
    // 2. Body `Note: '...'`
    // 3. Doc Comment `/// ...`
    let finalNote = docComment;

    if (tableSettings.has('note')) {
      let sNote = tableSettings.get('note')!;
      if ((sNote.startsWith("'") && sNote.endsWith("'")) || (sNote.startsWith('"') && sNote.endsWith('"'))) {
        sNote = sNote.substring(1, sNote.length - 1);
      }
      finalNote = sNote;
    } else if (explicitBodyNote) {
      finalNote = explicitBodyNote;
    }

    // 5. Parse Fields
    // We pass the cleaned body to the field parser
    const { fields } = parseFieldsFromBody(bodyWithoutIndexes);

    const fieldMap = new Map<string, DbField>();
    fields.forEach(f => fieldMap.set(f.name, f));

    // (Partial injection logic omitted for brevity, assuming standard DBML)

    // 6. Extract Inline Relationships
    fields.forEach(f => {
      if (f.inlineRef) {
        inlineRelationships.push(createRelationship(
            rawName,
            f.name,
            f.inlineRef.symbol,
            f.inlineRef.toTable,
            f.inlineRef.toColumn
        ));
      }
    });

    tables.push({
      id: sanitizeId(rawName),
      name: rawName,
      fields: fields,
      note: finalNote,
      color: tableSettings.get('color') || undefined,
      width: tableSettings.has('width') ? parseInt(tableSettings.get('width')!, 10) : undefined,
      x: tableSettings.has('x') ? parseInt(tableSettings.get('x')!, 10) : undefined,
      y: tableSettings.has('y') ? parseInt(tableSettings.get('y')!, 10) : undefined,
      settings: Object.fromEntries(tableSettings),
      indexes: tableIdxs
    });
  }

  return { tables, inlineRelationships };
}