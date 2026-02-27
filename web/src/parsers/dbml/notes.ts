// web/src/parsers/dbml/notes.ts

import type { DbNote } from '../../models/types';
import { parseSettingsString, sanitizeId } from './utils';

export function parseNotes(text: string): DbNote[] {
  const notes: DbNote[] = [];

  // Regex: Note name [settings] { content }
  // Group 1: Name
  // Group 2: Settings (optional)
  // Group 3: Content (handling triple quotes or standard text inside braces)
  const noteRegex = /Note\s+(\w+)\s*(?:\[(.*?)\])?\s*\{([\s\S]*?)\}/g;

  let match;
  while ((match = noteRegex.exec(text)) !== null) {
    const name = match[1];
    const settingsStr = match[2] || '';
    let rawContent = match[3].trim();

    // Handle triple quotes inside the content block
    if (rawContent.startsWith("'''") && rawContent.endsWith("'''")) {
      rawContent = rawContent.substring(3, rawContent.length - 3);
    } else if (rawContent.startsWith("'") && rawContent.endsWith("'")) {
      rawContent = rawContent.substring(1, rawContent.length - 1);
    }

    const settings = parseSettingsString(settingsStr);

    notes.push({
      id: sanitizeId(name),
      name: name,
      content: rawContent.trim(), // Keep formatting but trim ends
      x: settings.has('x') ? parseInt(settings.get('x')!, 10) : 0,
      y: settings.has('y') ? parseInt(settings.get('y')!, 10) : 0,
      width: settings.has('width') ? parseInt(settings.get('width')!, 10) : 250,
      color: settings.get('color') || '#fff9c4' // Default yellow-ish note color
    });
  }

  return notes;
}