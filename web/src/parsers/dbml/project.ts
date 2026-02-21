// web/src/parsers/dbml/project.ts

import type { ProjectSettings } from '../../models/types';

export function parseProjectSettings(text: string): ProjectSettings {
  const projectSettings: ProjectSettings = {};

  // Regex: Project [optional_name] { ... }
  const projectRegex = /Project\s*(?:(?:"[^"]*")|(?:[\w]+))?\s*\{([\s\S]*?)\}/i;
  const projectMatch = projectRegex.exec(text);

  if (projectMatch) {
    const body = projectMatch[1];

    // Key Mapping: snake_case (DBML) -> camelCase (Internal)
    const keyMap: Record<string, string> = {
      'line_style': 'lineStyle',
      'show_grid': 'showGrid',
      'grid_size': 'gridSize',
      'database_type': 'databaseType',
      'note': 'note'
    };

    // Regex to match key: value OR key: '''value'''
    // 1. Key (snake_case supported)
    // 2. Triple Quote Content
    // 3. Single Quote Content
    // 4. Raw Value (numbers, booleans)
    const settingRegex = /(\w+)\s*:\s*(?:'''([\s\S]*?)'''|'([^']*)'|([^ \n}]+))/g;

    let match;
    while ((match = settingRegex.exec(body)) !== null) {
      const rawKey = match[1];
      const tripleVal = match[2];
      const singleVal = match[3];
      const plainVal = match[4];

      const key = keyMap[rawKey] || rawKey; // Map to internal name if exists
      let val: any = tripleVal || singleVal || plainVal;

      if (val === 'true') val = true;
      if (val === 'false') val = false;
      if (!isNaN(Number(val)) && val !== '' && typeof val === 'string') {
        // Check if it really is a number (simple check)
        if (!val.includes("'")) val = Number(val);
      }

      projectSettings[key] = val;
    }
  }

  return projectSettings;
}