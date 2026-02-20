// web/src/parsers/dbml/index.ts

import type { Parser } from '../../core/parser-interface';
import type { DbTable, DbRelationship, ProjectSettings } from '../../models/types';
import { cleanText } from './utils';
import { parseProjectSettings } from './project';
import { parseTables } from './tables';
import { parseStandaloneRefs } from './relationships';

export class DbmlParser implements Parser {
  parse(text: string): { tables: DbTable[], relationships: DbRelationship[], projectSettings: ProjectSettings } {

    // 1. Clean Text
    const cleaned = cleanText(text);

    // 2. Parse Project Settings
    const projectSettings = parseProjectSettings(cleaned);

    // 3. Parse Tables (includes partials and inline refs)
    const { tables, inlineRelationships } = parseTables(cleaned);

    // 4. Parse Standalone Refs
    const standaloneRelationships = parseStandaloneRefs(cleaned);

    // 5. Merge Relationships
    const relationships = [...inlineRelationships, ...standaloneRelationships];

    return { tables, relationships, projectSettings };
  }
}