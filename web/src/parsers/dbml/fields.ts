// web/src/parsers/dbml/fields.ts

import type { DbField } from '../../models/types';

export function parseSingleFieldLine(name: string, type: string, settingsStr: string): DbField {
  // Split settings by comma
  const settings = settingsStr.split(',').map(s => s.trim());

  let isPk = false;
  let isUnique = false;
  let isNotNull = false;
  let isFk = false;
  let note: string | undefined;
  let defaultVal: string | undefined;
  let enumValues: string[] | undefined;
  let inlineRef: { symbol: string; toTable: string; toColumn: string } | undefined;

  for (const s of settings) {
    if (/pk|primary key/i.test(s)) isPk = true;
    if (/unique/i.test(s)) isUnique = true;
    if (/not null/i.test(s)) isNotNull = true;

    const nm = /note:\s*(['"])([\s\S]*?)\1/i.exec(s);
    if (nm) note = nm[2];

    const dm = /default:\s*(['`])?([\s\S]*?)\1?/i.exec(s);
    if (dm) defaultVal = dm[2];

    // Match inline ref: ref: > table.col
    const refMatch = /ref:\s*(<>|[<>=-])\s*("?[\w.]+"?)\.("?[\w"]+"?)/i.exec(s);
    if (refMatch) {
      isFk = true;
      inlineRef = {
        symbol: refMatch[1],
        toTable: refMatch[2],
        toColumn: refMatch[3]
      };
    }
  }

  return {
    name,
    type,
    isPk,
    isUnique,
    isNotNull,
    isFk,
    note,
    default: defaultVal,
    enumValues,
    inlineRef
  };
}

export function parseFieldsFromBody(body: string): { fields: DbField[] } {
  const fields: DbField[] = [];
  const lines = body.split('\n');

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('Note')) continue;

    // Regex: Name Type [Settings]
    const fieldRegex = /^("?[\w]+"?)\s+([a-zA-Z0-9_()]+)(?:\s*\[(.*?)\])?/;
    const match = fieldRegex.exec(line);
    if (!match) continue;

    fields.push(parseSingleFieldLine(
        match[1].replace(/"/g, ''),
        match[2],
        match[3] || ''
    ));
  }
  return { fields };
}