// web/src/parsers/dbml/index.ts

import type {Parser} from '../../core/parser-interface';
import type {DbTable, DbRelationship, ProjectSettings, DbNote} from '../../models/types';
import {cleanText} from './utils';
import {parseProjectSettings} from './project';
import {parseTables} from './tables';
import {parseStandaloneRefs} from './relationships';
import {parseNotes} from "./notes.ts";

export class DbmlParser implements Parser {
  parse(text: string): {
    tables: DbTable[],
    relationships: DbRelationship[],
    projectSettings: ProjectSettings,
    notes: DbNote[] // Add to return type
  } {

    // 1. Clean Text
    const cleaned = cleanText(text);

    // 2. Parse Project Settings
    const projectSettings = parseProjectSettings(cleaned);

    // 3. Parse Tables (includes partials and inline refs)
    const {tables, inlineRelationships} = parseTables(cleaned);

    // 4. Parse Standalone Refs
    const standaloneRelationships = parseStandaloneRefs(cleaned);

    // 5. Merge Relationships
    const relationships = [...inlineRelationships, ...standaloneRelationships];

    // 6. Parse Notes
    const notes = parseNotes(cleaned);

    return {tables, relationships, projectSettings, notes};
  }
}