// web/src/core/parsers/dbml-parser.ts

import type {DbTable, DbField, DbRelationship, Cardinality} from '../../models/types';
import type {Parser} from '../parser-interface';

export class DbmlParser implements Parser {
  parse(text: string): { tables: DbTable[], relationships: DbRelationship[] } {
    const tables: DbTable[] = [];
    const relationships: DbRelationship[] = [];

    // 1. Remove comments
    const cleanText = text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

    // Parse Enums
    const enumMap = new Map<string, string[]>();
    const enumRegex = /Enum\s+(\w+)\s*\{([^}]+)\}/gi;
    let eMatch;
    while ((eMatch = enumRegex.exec(cleanText)) !== null) {
      const enumName = eMatch[1];
      const body = eMatch[2];
      const values: string[] = [];
      const lines = body.split('\n');
      for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        // value [note: 'desc'] -> take value
        const valueMatch = /^(['"]?[\w]+['"]?)/.exec(line);
        if (valueMatch) {
          values.push(valueMatch[1].replace(/['"]/g, ''));
        }
      }
      enumMap.set(enumName, values);
    }

    // 2. Parse Tables
    const tableRegex = /Table\s+("?[\w.]+"?)\s*(?:\[(.*?)\])?\s*(?:as\s+\w+\s*)?\{([^}]+)\}/gi;
    let tMatch;
    while ((tMatch = tableRegex.exec(cleanText)) !== null) {
      const rawName = tMatch[1];
      const settingsStr = tMatch[2];
      const body = tMatch[3];
      const tableName = rawName.replace(/"/g, '');

      const settings = this.parseSettings(settingsStr || '');

      const {fields, inlineRels, note} = this.parseFieldsAndNote(tableName, body, enumMap);

      tables.push({
        id: this.sanitizeId(tableName),
        name: tableName,
        fields: fields,
        note,
        color: settings.get('color'),
        width: settings.has('width') ? parseInt(settings.get('width')!, 10) : undefined,
        x: settings.has('x') ? parseInt(settings.get('x')!, 10) : undefined,
        y: settings.has('y') ? parseInt(settings.get('y')!, 10) : undefined
      });

      relationships.push(...inlineRels);
    }

    // 3. Parse Standalone Refs (Short & Long forms)
    const refPattern = /("?[\w.]+"?)\.("?[\w"]+"?)\s*([<>=-])\s*("?[\w.]+"?)\.("?[\w"]+"?)/g;

    const refBlockRegex = /Ref\s*[^{:]*[:\{]\s*([^}]+)\s*\}?/gi;
    let rMatch;
    while ((rMatch = refBlockRegex.exec(cleanText)) !== null) {
      const content = rMatch[1];
      let m;
      while ((m = refPattern.exec(content)) !== null) {
        relationships.push(this.createRelationship(
            m[1], m[2], m[3], m[4], m[5]
        ));
      }
    }

    return {tables, relationships};
  }

  private parseSettings(settingsStr: string): Map<string, string> {
    const settings = new Map<string, string>();
    if (!settingsStr) return settings;

    const items = settingsStr.split(',').map(s => s.trim());
    for (let item of items) {
      if (item.includes(':')) {
        const [key, value] = item.split(':').map(p => p.trim());
        settings.set(key.toLowerCase(), value);
      } else {
        settings.set(item.toLowerCase(), 'true');
      }
    }
    return settings;
  }

  private parseFieldsAndNote(tableName: string, body: string, enumMap: Map<string, string[]>): {
    fields: DbField[],
    inlineRels: DbRelationship[],
    note?: string
  } {
    const fields: DbField[] = [];
    const inlineRels: DbRelationship[] = [];
    const lines = body.split('\n');
    let tableNote: string | undefined;

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      if (line.startsWith('Note:')) {
        tableNote = this.parseNote(line);
        continue;
      }

      // Regex: Name Type [Settings]
      const fieldRegex = /^("?[\w]+"?)\s+([a-zA-Z0-9_()]+)(?:\s*\[(.*?)\])?/;
      const match = fieldRegex.exec(line);

      if (match) {
        const name = match[1].replace(/"/g, '');
        let type = match[2];
        const settingsStr = match[3] || '';

        const settings = settingsStr.split(',').map(s => s.trim());

        let isPk = false;
        let isUnique = false;
        let isNotNull = false;
        let note: string | undefined;
        let defaultVal: string | undefined;
        let enumValues: string[] | undefined;

        // Parse Inline Ref
        let refMatch: RegExpExecArray | null = null;

        for (let setting of settings) {
          if (/pk|primary key/i.test(setting)) isPk = true;
          if (/unique/i.test(setting)) isUnique = true;
          if (/not null/i.test(setting)) isNotNull = true;

          const noteMatch = /note:\s*(['"])([\s\S]*?)\1/i.exec(setting);
          if (noteMatch) {
            note = noteMatch[2];
            continue;
          }

          const defaultMatch = /default:\s*(['`])?([\s\S]*?)\1?/i.exec(setting);
          if (defaultMatch) {
            defaultVal = defaultMatch[2];
            continue;
          }

          refMatch = /ref:\s*([<>=-])\s*("?[\w.]+"?)\.("?[\w"]+"?)/i.exec(setting);
          if (refMatch) {
            const operator = refMatch[1];
            const targetTable = refMatch[2].replace(/"/g, '');
            const targetCol = refMatch[3].replace(/"/g, '');

            inlineRels.push(this.createRelationship(
                tableName, name, operator, targetTable, targetCol
            ));
          }
        }

        if (enumMap.has(type)) {
          enumValues = enumMap.get(type);
        }

        fields.push({
          name,
          type,
          isPk,
          isUnique,
          isNotNull,
          isFk: !!refMatch,
          note,
          default: defaultVal,
          enumValues
        });
      }
    }
    return {fields, inlineRels, note: tableNote};
  }

  private parseNote(line: string): string {
    const noteRegex = /Note:\s*(['"])([\s\S]*?)\1/i;
    const match = noteRegex.exec(line);
    return match ? match[2] : '';
  }

  private createRelationship(t1: string, c1: string, op: string, t2: string, c2: string): DbRelationship {
    const clean = (s: string) => s.replace(/"/g, '');
    t1 = clean(t1);
    c1 = clean(c1);
    t2 = clean(t2);
    c2 = clean(c2);

    let type: Cardinality = '1:n';
    if (op === '<') type = '1:n';
    else if (op === '>') type = 'n:1';
    else if (op === '-') type = '1:1';
    else if (op === '<>') type = 'm:n';

    return {
      fromTable: this.sanitizeId(t1),
      fromColumn: c1,
      toTable: this.sanitizeId(t2),
      toColumn: c2,
      type
    };
  }

  // Helper to make schema.names safe for HTML IDs (core.users -> core_users)
  private sanitizeId(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
  }
}