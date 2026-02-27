// web/src/parsers/dbml/project.ts

import type { ProjectSettings } from '../../models/types';

export function parseProjectSettings(text: string): ProjectSettings {
  const projectSettings: ProjectSettings = {};

  // Regex: Project [optional_name] { ... }
  const projectRegex = /Project\s*(?:(?:"[^"]*")|(?:[\w]+))?\s*\{([\s\S]*?)\}/i;
  const projectMatch = projectRegex.exec(text);

  if (projectMatch) {
    const body = projectMatch[1];

    // Only map semantic properties, ignore visual ones
    const keyMap: Record<string, string> = {
      'database_type': 'databaseType',
      'note': 'note'
    };

    const settingRegex = /(\w+)\s*:\s*(?:'''([\s\S]*?)'''|'([^']*)'|([^ \n}]+))/g;

    let match;
    while ((match = settingRegex.exec(body)) !== null) {
      const rawKey = match[1];
      const tripleVal = match[2];
      const singleVal = match[3];
      const plainVal = match[4];

      // Only process keys we care about
      if (keyMap[rawKey] || rawKey === 'note' || rawKey === 'database_type') {
        const key = keyMap[rawKey] || rawKey;
        let val: any = tripleVal || singleVal || plainVal;
        projectSettings[key] = val;
      }
    }
  }

  return projectSettings;
}