// web/src/parsers/dbml/utils.ts

export function sanitizeId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

export function cleanText(text: string): string {
  // 1. Remove /* */ comments
  let cleaned = text.replace(/\/\*[\s\S]*?\*\//g, '');

  // 2. Remove // comments BUT keep /// comments
  // Explanation:
  // (?<!\/)  : Negative lookbehind to ensure we don't match the 3rd slash of ///
  // \/\/     : Match //
  // (?!\/)   : Negative lookahead to ensure the next char isn't / (so it's strictly //, not ///)
  //
  // However, simpler logic: Split lines, if line starts with /// keep it, else if // remove it.

  return cleaned.split('\n').map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('///')) return line; // Keep Doc Comments

    // Remove inline // comments (e.g., "id int // pk")
    // We strictly look for // that is NOT followed by /
    const commentIdx = line.indexOf('//');
    if (commentIdx !== -1) {
      // Check if it's actually ///
      if (line[commentIdx + 2] === '/') {
        // This is a doc comment line, keep it whole
        return line;
      }
      return line.substring(0, commentIdx);
    }
    return line;
  }).join('\n');
}

export function parseSettingsString(settingsStr: string): Map<string, string> {
  const settings = new Map<string, string>();
  if (!settingsStr) return settings;

  // Handle comma separation, filtering empty strings
  // We need to be careful not to split commas inside quotes
  const items: string[] = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < settingsStr.length; i++) {
    const char = settingsStr[i];
    if (char === "'" || char === '"') inQuote = !inQuote;

    if (char === ',' && !inQuote) {
      items.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) items.push(current.trim());

  for (let item of items) {
    if (!item) continue;
    // Check for key: value
    const colonIdx = item.indexOf(':');
    if (colonIdx !== -1) {
      const k = item.substring(0, colonIdx).trim();
      const v = item.substring(colonIdx + 1).trim();
      settings.set(k.toLowerCase(), v);
    } else {
      // Flag style (e.g., 'primary key')
      settings.set(item.toLowerCase(), 'true');
    }
  }
  return settings;
}

/**
 * Extracts "///" comments immediately preceding a given index in the text.
 */
export function extractDocComments(fullText: string, startIndex: number): string | undefined {
  const textBefore = fullText.substring(0, startIndex);
  const lines = textBefore.split('\n');
  const comments: string[] = [];

  // Iterate backwards from the line before the definition
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines, but keep looking?
    // Usually doc comments are adjacent. Let's allow empty lines but stop at code.

    if (line.startsWith('///')) {
      // Remove '///' and whitespace
      comments.unshift(line.replace(/^\/\/\/\s?/, ''));
    } else {
      // Found a non-comment, non-empty line. Stop.
      break;
    }
  }

  return comments.length > 0 ? comments.join('\n') : undefined;
}

/**
 * Parses a DBML Ref path which could be:
 * 1. table.column
 * 2. schema.table.column
 * 3. table.(col1, col2)
 * 4. schema.table.(col1, col2)
 */
export function parseRefPath(path: string): { table: string, columns: string[] } | null {
  const clean = path.trim();

  // check for composite keys: something.(...)
  const compositeMatch = /^(.*)\.\((.*)\)$/.exec(clean);

  if (compositeMatch) {
    const tablePart = compositeMatch[1];
    const colsPart = compositeMatch[2];
    return {
      table: sanitizeId(tablePart),
      columns: colsPart.split(',').map(c => c.trim())
    };
  }

  // standard single column: schema.table.col or table.col
  const parts = clean.split('.');
  if (parts.length < 2) return null;

  const col = parts.pop()!;
  const table = parts.join('.'); // Rejoin schema.table

  return {
    table: sanitizeId(table),
    columns: [col]
  };
}