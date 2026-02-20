// web/src/parsers/dbml/tables.ts

import type { DbTable, DbRelationship, DbField, IndexDef } from '../../models/types';
import { parseSettingsString, sanitizeId } from './utils';
import { parseIndexBlock } from './indexes';
import { parseSingleFieldLine, parseFieldsFromBody } from './fields';
import { createRelationship } from './relationships';

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
    const rawName = tMatch[1].replace(/"/g, '');
    const settingsStr = tMatch[2] || '';
    const body = tMatch[3] || '';
    const tableSettings = parseSettingsString(settingsStr);

    // Extract table-level indexes
    const idxMatch = /indexes\s*\{([\s\S]*?)\}/i.exec(body);
    let tableIdxs: IndexDef[] = [];
    let bodyWithoutIndexes = body;
    if (idxMatch) {
      tableIdxs = parseIndexBlock(idxMatch[1]);
      bodyWithoutIndexes = body.replace(idxMatch[0], '');
    }

    // Process fields and injections
    const lines = bodyWithoutIndexes.split('\n');
    const fieldMap = new Map<string, DbField>();
    const orderList: string[] = [];
    const indexMap = new Map<string, IndexDef>();
    const mergedSettings = new Map<string, string>();

    for (let rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Partial Injection (~name)
      if (line.startsWith('~')) {
        const pname = line.replace(/^~\s*/, '').trim();
        const p = partials.get(pname);
        if (p) {
          for (const [k, v] of p.settings.entries()) mergedSettings.set(k, v);
          for (const f of p.fields) {
            if (fieldMap.has(f.name)) {
              const idx = orderList.indexOf(f.name);
              if (idx !== -1) orderList.splice(idx, 1);
            }
            fieldMap.set(f.name, f);
            orderList.push(f.name);
          }
          for (const idx of p.indexes) {
            indexMap.set(idx.columns.join('|').toLowerCase(), idx);
          }
        }
        continue;
      }

      // Standard Field Definition
      const fieldRegex = /^("?[\w]+"?)\s+([a-zA-Z0-9_()]+)(?:\s*\[(.*?)\])?/;
      const match = fieldRegex.exec(line);
      if (match) {
        const name = match[1].replace(/"/g, '');
        const parsed = parseSingleFieldLine(name, match[2], match[3] || '');

        if (fieldMap.has(parsed.name)) {
          const idx = orderList.indexOf(parsed.name);
          if (idx !== -1) orderList.splice(idx, 1);
        }
        fieldMap.set(parsed.name, parsed);
        orderList.push(parsed.name);
      }
    }

    // Merge Table Settings/Indexes
    for (const idx of tableIdxs) indexMap.set(idx.columns.join('|').toLowerCase(), idx);
    for (const [k, v] of tableSettings.entries()) mergedSettings.set(k, v);

    const finalFields = orderList.map(n => fieldMap.get(n)!).filter(Boolean);

    // Extract Inline Relationships
    finalFields.forEach(f => {
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

    // Extract Note
    const noteMatch = /Note:\s*(['"])([\s\S]*?)\1/i.exec(body);

    tables.push({
      id: sanitizeId(rawName),
      name: rawName,
      fields: finalFields,
      note: noteMatch ? noteMatch[2] : undefined,
      color: mergedSettings.get('color') || undefined,
      width: mergedSettings.has('width') ? parseInt(mergedSettings.get('width')!, 10) : undefined,
      x: mergedSettings.has('x') ? parseInt(mergedSettings.get('x')!, 10) : undefined,
      y: mergedSettings.has('y') ? parseInt(mergedSettings.get('y')!, 10) : undefined,
      settings: Object.fromEntries(mergedSettings),
      indexes: Array.from(indexMap.values())
    });
  }

  return { tables, inlineRelationships };
}