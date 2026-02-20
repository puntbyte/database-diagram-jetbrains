// web/src/parsers/dbml/utils.ts

export function sanitizeId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

export function cleanText(text: string): string {
  // Remove // comments and /* */ comments
  return text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

export function parseSettingsString(settingsStr: string): Map<string, string> {
  const settings = new Map<string, string>();
  if (!settingsStr) return settings;

  // Handle comma separation, filtering empty strings
  const items = settingsStr.split(',').map(s => s.trim()).filter(Boolean);

  for (let item of items) {
    // Check for key: value
    if (item.includes(':')) {
      const [k, ...rest] = item.split(':');
      settings.set(k.trim().toLowerCase(), rest.join(':').trim());
    } else {
      // Flag style (e.g., 'primary key')
      settings.set(item.toLowerCase(), 'true');
    }
  }
  return settings;
}