// web/src/parsers/dbml/project.ts

import type { ProjectSettings } from '../../models/types';

export function parseProjectSettings(text: string): ProjectSettings {
  const projectSettings: ProjectSettings = {};

  // Project "Name" { ... } or Project { ... }
  const projectRegex = /Project\s*(?:(?:"[^"]*")|(?:[\w]+))?\s*\{([\s\S]*?)\}/i;
  const projectMatch = projectRegex.exec(text);

  if (projectMatch) {
    const body = projectMatch[1];
    const lines = body.split('\n');

    lines.forEach(line => {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        let val = parts.slice(1).join(':').trim();

        // Remove wrapping quotes if present
        if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
          val = val.substring(1, val.length - 1);
        }

        // Try to convert numbers, ignore empty strings
        if (!isNaN(Number(val)) && val !== '') {
          projectSettings[key] = Number(val);
        } else {
          projectSettings[key] = val;
        }
      }
    });
  }

  return projectSettings;
}