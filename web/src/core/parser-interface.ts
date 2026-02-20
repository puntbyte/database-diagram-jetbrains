// web/src/core/parser-interface.ts

import type {DbTable, DbRelationship} from '../models/types';

export interface Parser {
  parse(text: string): { tables: DbTable[], relationships: DbRelationship[] };
}