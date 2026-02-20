// web/src/parsers/dbml/indexes.ts

import type { IndexDef } from '../../models/types';
import { parseSettingsString } from './utils';

export function parseIndexBlock(block: string): IndexDef[] {
  const result: IndexDef[] = [];
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);

  for (let line of lines) {
    // Matches: (col1, col2) [settings]
    const m = /^(\(?\s*[\w\.,\s]+\s*\)?)(?:\s*\[(.*?)\])?$/i.exec(line);
    if (!m) continue;

    const cols = m[1].replace(/^\(/, '').replace(/\)$/, '').split(',').map(c => c.trim()).filter(Boolean);
    const settingsMap = parseSettingsString(m[2] || '');

    result.push({
      columns: cols,
      settings: Object.fromEntries(settingsMap),
      raw: line
    });
  }
  return result;
}