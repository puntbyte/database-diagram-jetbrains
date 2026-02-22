import type { DbTable, DbRelationship, DbField, IndexDef } from '../../models/types';
import { parseSettingsString, sanitizeId, extractDocComments } from './utils';
import { parseIndexBlock } from './indexes';
import { parseSingleFieldLine } from './fields'; // Import single line parser
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
  // Syntax: TablePartial name [settings] { ... }
  const partialRegex = /TablePartial\s+("?[\w.]+"?)\s*(?:\[(.*?)\])?\s*\{([\s\S]*?)\}/gi;
  let pMatch;

  while ((pMatch = partialRegex.exec(text)) !== null) {
    const rawName = pMatch[1].replace(/"/g, '');
    const settingsStr = pMatch[2] || '';
    const body = pMatch[3] || '';

    // 1a. Extract Indexes from Partial
    const idxMatch = /indexes\s*\{([\s\S]*?)\}/i.exec(body);
    let idxs: IndexDef[] = [];
    let fieldsBody = body;
    if (idxMatch) {
      idxs = parseIndexBlock(idxMatch[1]);
      fieldsBody = body.replace(idxMatch[0], '');
    }

    // 1b. Parse Fields from Partial
    // We can reuse the simple field parser here as partials don't usually recurse
    const fields: DbField[] = [];
    const lines = fieldsBody.split('\n');
    let pendingDocComments: string[] = [];

    for (let line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('///')) {
        pendingDocComments.push(trimmed.replace(/^\/\/\/\s?/, ''));
        continue;
      }
      if (!trimmed || trimmed.startsWith('Note')) continue;

      const fieldRegex = /^("?[\w]+"?)\s+([a-zA-Z0-9_()\[\]]+)(?:\s*\[(.*?)\])?/;
      const match = fieldRegex.exec(trimmed);
      if (match) {
        const docNote = pendingDocComments.length > 0 ? pendingDocComments.join('\n') : undefined;
        fields.push(parseSingleFieldLine(
            match[1].replace(/"/g, ''),
            match[2],
            match[3] || '',
            docNote
        ));
        pendingDocComments = [];
      }
    }

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
    const docComment = extractDocComments(text, tableStartIndex);

    const rawName = tMatch[1].replace(/"/g, '');
    const settingsStr = tMatch[2] || '';
    const body = tMatch[3] || '';
    const localHeaderSettings = parseSettingsString(settingsStr);

    // 2a. Extract Local Indexes
    const idxMatch = /indexes\s*\{([\s\S]*?)\}/i.exec(body);
    let localIndexes: IndexDef[] = [];
    let bodyProcessing = body;
    if (idxMatch) {
      localIndexes = parseIndexBlock(idxMatch[1]);
      bodyProcessing = body.replace(idxMatch[0], '');
    }

    // 2b. Extract Local Explicit Note
    const noteRegex = /^\s*Note(?:\s*:\s*|\s+)(['"])([\s\S]*?)\1/im;
    const noteMatch = noteRegex.exec(bodyProcessing);
    let explicitBodyNote: string | undefined;
    if (noteMatch) {
      explicitBodyNote = noteMatch[2];
      bodyProcessing = bodyProcessing.replace(noteMatch[0], '');
    }

    // --- 3. Process Body (Merging Partials & Fields) ---
    // Data structures for merging
    const fieldMap = new Map<string, DbField>();
    const fieldOrder: string[] = [];
    const localFieldNames = new Set<string>(); // Tracks fields defined locally in this table

    // Accumulate settings (start empty, partials merge in, local overrides at end)
    const accumulatedSettings = new Map<string, string>();

    // Indexes map: key = column list string
    const indexMap = new Map<string, IndexDef>();

    const lines = bodyProcessing.split('\n');
    let pendingDocComments: string[] = [];

    for (let rawLine of lines) {
      const line = rawLine.trim();

      // Doc Comment
      if (line.startsWith('///')) {
        pendingDocComments.push(line.replace(/^\/\/\/\s?/, ''));
        continue;
      }
      if (!line) continue;

      // 3a. Injection: ~partial_name
      if (line.startsWith('~')) {
        const pName = line.substring(1).trim();
        const partial = partials.get(pName);

        if (partial) {
          // Merge Settings (Last injected partial overrides earlier partials)
          for (const [k, v] of partial.settings) {
            accumulatedSettings.set(k, v);
          }

          // Merge Indexes
          for (const idx of partial.indexes) {
            const key = idx.columns.join(',').toLowerCase();
            indexMap.set(key, idx); // Last partial wins
          }

          // Merge Fields
          for (const f of partial.fields) {
            // Priority: Local > Last Partial > First Partial
            // If field is already defined locally, ignore partial's version
            if (localFieldNames.has(f.name)) continue;

            // If field exists from previous partial, overwrite it (Last Partial wins)
            // But maintain order of the FIRST occurrence?
            // "Final result" in prompt lists fields in injection order.
            // If base has A, email_index has B. Table { ~base, ~email }. Result A, B.
            // If Table { ~base (A), name, ~soft (C) }. Result A, name, C.
            // This implies we append if new.

            if (fieldMap.has(f.name)) {
              // Already exists from a previous partial. Update def, keep order.
              fieldMap.set(f.name, f);
            } else {
              // New field
              fieldMap.set(f.name, f);
              fieldOrder.push(f.name);
            }
          }
        }
        pendingDocComments = []; // Partials consume comments? Usually no, but let's clear to be safe
        continue;
      }

      // 3b. Local Field Definition
      const fieldRegex = /^("?[\w]+"?)\s+([a-zA-Z0-9_()\[\]]+)(?:\s*\[(.*?)\])?/;
      const match = fieldRegex.exec(line);

      if (match) {
        const name = match[1].replace(/"/g, '');
        const type = match[2];
        const settings = match[3] || '';
        const docNote = pendingDocComments.length > 0 ? pendingDocComments.join('\n') : undefined;

        const localField = parseSingleFieldLine(name, type, settings, docNote);

        // Logic: Local overrides everything.
        localFieldNames.add(name);

        if (fieldMap.has(name)) {
          // Update existing (whether from partial or previous local line)
          fieldMap.set(name, localField);
        } else {
          fieldMap.set(name, localField);
          fieldOrder.push(name);
        }

        pendingDocComments = [];
      }
    }

    // --- 4. Finalize Merges ---

    // Apply Local Settings (Override accumulated partial settings)
    for (const [k, v] of localHeaderSettings) {
      accumulatedSettings.set(k, v);
    }

    // Apply Local Indexes (Override accumulated partial indexes)
    for (const idx of localIndexes) {
      const key = idx.columns.join(',').toLowerCase();
      indexMap.set(key, idx);
    }

    // Construct Final Field List
    const finalFields = fieldOrder.map(name => fieldMap.get(name)!);

    // Determine Final Note
    let finalNote = docComment;
    if (accumulatedSettings.has('note')) {
      let sNote = accumulatedSettings.get('note')!;
      if ((sNote.startsWith("'") && sNote.endsWith("'")) || (sNote.startsWith('"') && sNote.endsWith('"'))) {
        sNote = sNote.substring(1, sNote.length - 1);
      }
      finalNote = sNote;
    } else if (explicitBodyNote) {
      finalNote = explicitBodyNote;
    }

    // Extract Inline Relationships from final fields
    finalFields.forEach(f => {
      if (f.inlineRef) {
        inlineRelationships.push(createRelationship(
            sanitizeId(rawName),
            [f.name],
            f.inlineRef.symbol,
            sanitizeId(f.inlineRef.toTable),
            [f.inlineRef.toColumn]
        ));
      }
    });

    tables.push({
      id: sanitizeId(rawName),
      name: rawName,
      fields: finalFields,
      note: finalNote,
      color: accumulatedSettings.get('color') || undefined,
      width: accumulatedSettings.has('width') ? parseInt(accumulatedSettings.get('width')!, 10) : undefined,
      x: accumulatedSettings.has('x') ? parseInt(accumulatedSettings.get('x')!, 10) : undefined,
      y: accumulatedSettings.has('y') ? parseInt(accumulatedSettings.get('y')!, 10) : undefined,
      settings: Object.fromEntries(accumulatedSettings),
      indexes: Array.from(indexMap.values())
    });
  }

  return { tables, inlineRelationships };
}