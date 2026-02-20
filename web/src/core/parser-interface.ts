// web/src/core/parser-interface.ts

import type {DbTable, DbRelationship, ProjectSettings} from '../models/types';

export interface Parser {
  parse(text: string): {
    tables: DbTable[],
    relationships: DbRelationship[],
    projectSettings?: ProjectSettings // Added this
  };
}