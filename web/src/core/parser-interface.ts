// web/src/core/parser-interface.ts

import type {DbTable, DbRelationship, ProjectSettings, DbNote} from '../models/types';

export interface Parser {
  parse(text: string): {
    tables: DbTable[],
    relationships: DbRelationship[],
    projectSettings?: ProjectSettings
    notes?: DbNote[]
  };
}