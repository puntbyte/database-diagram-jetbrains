// web/src/core/parser.ts

import type {DbTable, DbField, DbRelationship, Cardinality} from '../models/types';

export class DbmlParser {
  parse(text: string): { tables: DbTable[], relationships: DbRelationship[] } {
    const tables: DbTable[] = [];
    const relationships: DbRelationship[] = [];

    // 1. Remove comments
    const cleanText = text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

    // 2. Parse Tables
    const tableRegex = /Table\s+("?[\w.]+"?)\s*(?:as\s+\w+\s*)?\{([^}]+)\}/gi;
    let tMatch;
    while ((tMatch = tableRegex.exec(cleanText)) !== null) {
      const rawName = tMatch[1];
      const body = tMatch[2];
      const tableName = rawName.replace(/"/g, '');

      const {fields, inlineRels} = this.parseFields(tableName, body);

      tables.push({
        id: this.sanitizeId(tableName),
        name: tableName,
        fields: fields,
        x: 0, y: 0
      });

      relationships.push(...inlineRels);
    }

    // 3. Parse Standalone Refs (Short & Long forms)
    // Matches: Ref optional_name { T1.C1 > T2.C2 }  OR  Ref: T1.C1 > T2.C2
    // We look for the pattern: Table.Col <Op> Table.Col
    const refPattern = /("?[\w.]+"?)\.("?[\w"]+"?)\s*([<>=-])\s*("?[\w.]+"?)\.("?[\w"]+"?)/g;

    // We scan the whole text for these patterns, excluding those inside Table definitions (heuristic)
    // A safer way for "Ref" blocks is to find the Ref keyword first.

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

  private parseFields(tableName: string, body: string): {
    fields: DbField[],
    inlineRels: DbRelationship[]
  } {
    const fields: DbField[] = [];
    const inlineRels: DbRelationship[] = [];
    const lines = body.split('\n');

    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('Note')) continue;

      // Regex: Name Type [Settings]
      // Group 1: Name, Group 2: Type, Group 3: Settings (optional)
      const fieldRegex = /^("?[\w]+"?)\s+([a-zA-Z0-9_()]+)(?:\s*\[(.*?)\])?/;
      const match = fieldRegex.exec(line);

      if (match) {
        const name = match[1].replace(/"/g, '');
        const type = match[2];
        const settings = match[3] || '';

        const isPk = /pk|primary key/i.test(settings);
        const isUnique = /unique/i.test(settings);
        const isNotNull = /not null/i.test(settings);

        // Parse Inline Ref: [ref: > other_table.col]
        const refMatch = /ref:\s*([<>=-])\s*("?[\w.]+"?)\.("?[\w"]+"?)/i.exec(settings);
        if (refMatch) {
          const operator = refMatch[1];
          const targetTable = refMatch[2];
          const targetCol = refMatch[3];

          // Note: In inline, the current field is the left side
          inlineRels.push(this.createRelationship(
              tableName, name, operator, targetTable, targetCol
          ));
        }

        fields.push({name, type, isPk, isUnique, isNotNull, isFk: !!refMatch});
      }
    }
    return {fields, inlineRels};
  }

  private createRelationship(t1: string, c1: string, op: string, t2: string, c2: string): DbRelationship {
    const clean = (s: string) => s.replace(/"/g, '');
    t1 = clean(t1);
    c1 = clean(c1);
    t2 = clean(t2);
    c2 = clean(c2);

    // Normalize DBML operators to Cardinality
    // < : one-to-many (T1 is one, T2 is many)
    // > : many-to-one (T1 is many, T2 is one)
    // - : one-to-one
    // <>: many-to-many

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