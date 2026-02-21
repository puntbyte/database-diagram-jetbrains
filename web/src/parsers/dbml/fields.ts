// web/src/parsers/dbml/fields.ts

import type { DbField } from '../../models/types';
import { parseSettingsString } from './utils';

export function parseSingleFieldLine(
    name: string,
    type: string,
    settingsStr: string,
    docComment?: string
): DbField {

  const settingsMap = parseSettingsString(settingsStr);

  let isPk = settingsMap.has('pk') || settingsMap.has('primary key');
  let isUnique = settingsMap.has('unique');
  let isNotNull = settingsMap.has('not null');

  // Note parsing: Explicit setting takes precedence over Doc Comment
  let note = docComment;
  if (settingsMap.has('note')) {
    let rawNote = settingsMap.get('note')!;
    // Remove surrounding quotes
    if ((rawNote.startsWith("'") && rawNote.endsWith("'")) ||
        (rawNote.startsWith('"') && rawNote.endsWith('"'))) {
      note = rawNote.substring(1, rawNote.length - 1);
    } else {
      note = rawNote;
    }
  }

  let defaultVal = settingsMap.get('default');
  if (defaultVal) {
    if ((defaultVal.startsWith("'") && defaultVal.endsWith("'")) ||
        (defaultVal.startsWith('`') && defaultVal.endsWith('`'))) {
      defaultVal = defaultVal.substring(1, defaultVal.length - 1);
    }
  }

  let isFk = false;
  let inlineRef: { symbol: string; toTable: string; toColumn: string } | undefined;

  // Handle 'ref' setting
  // Settings parser separates by comma, but ref might look like "ref: > table.col"
  // The simple settings parser handles "ref": "> table.col"
  if (settingsMap.has('ref')) {
    const refVal = settingsMap.get('ref')!;
    const refMatch = /([<>=-])\s*("?[\w.]+"?)\.("?[\w"]+"?)/i.exec(refVal);
    if (refMatch) {
      isFk = true;
      inlineRef = {
        symbol: refMatch[1],
        toTable: refMatch[2],
        toColumn: refMatch[3]
      };
    }
  }

  // Parse enum values if type is seemingly an enum or has values?
  // DBML usually defines Enums separately, but we just store the type string.

  return {
    name,
    type,
    isPk,
    isUnique,
    isNotNull,
    isFk,
    note,
    default: defaultVal,
    enumValues: undefined, // DBML specific enum parsing is complex, skipping for now
    inlineRef
  };
}

export function parseFieldsFromBody(body: string): { fields: DbField[] } {
  const fields: DbField[] = [];
  const lines = body.split('\n');

  let pendingDocComments: string[] = [];

  for (let line of lines) {
    const trimmed = line.trim();

    // 1. Accumulate Doc Comments
    if (trimmed.startsWith('///')) {
      pendingDocComments.push(trimmed.replace(/^\/\/\/\s?/, ''));
      continue;
    }

    if (!trimmed || trimmed.startsWith('Note')) {
      // If it's a Table Note line, it consumes the doc comments?
      // No, usually doc comments stick to the next field.
      // But if we hit a blank line, standard practice is to reset docs?
      // Let's keep them until we hit a Field or a Table Note.
      continue;
    }

    // 2. Parse Field
    // Regex: Name Type [Settings]
    const fieldRegex = /^("?[\w]+"?)\s+([a-zA-Z0-9_()\[\]]+)(?:\s*\[(.*?)\])?/;
    const match = fieldRegex.exec(trimmed);

    if (match) {
      const name = match[1].replace(/"/g, '');
      const type = match[2];
      const settings = match[3] || '';

      const docNote = pendingDocComments.length > 0 ? pendingDocComments.join('\n') : undefined;

      fields.push(parseSingleFieldLine(
          name,
          type,
          settings,
          docNote
      ));

      // Clear comments after assignment
      pendingDocComments = [];
    }
        // If line is not a field (e.g. index block), we might lose the comments.
    // Ideally, we clear them to avoid assigning comments to the wrong thing.
    else if (trimmed.startsWith('indexes') || trimmed.startsWith('Note')) {
      pendingDocComments = [];
    }
  }
  return { fields };
}