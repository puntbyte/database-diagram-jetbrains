// web/src/parsers/dbml/relationships.ts

import type { Cardinality, DbRelationship } from '../../models/types';
import { sanitizeId } from './utils';

export function createRelationship(t1: string, c1: string, op: string, t2: string, c2: string): DbRelationship {
  const clean = (s: string) => s.replace(/"/g, '');
  let type: Cardinality = '1:n';

  if (op === '<') type = '1:n';
  else if (op === '>') type = 'n:1';
  else if (op === '-') type = '1:1';
  else if (op === '<>') type = 'm:n';

  return {
    fromTable: sanitizeId(clean(t1)),
    fromColumn: clean(c1),
    toTable: sanitizeId(clean(t2)),
    toColumn: clean(c2),
    type
  };
}

export function parseStandaloneRefs(text: string): DbRelationship[] {
  const relationships: DbRelationship[] = [];

  // Pattern: Table.Col <Op> Table.Col
  const refPattern = /("?[\w.]+"?)\.("?[\w"]+"?)\s*(<>|[<>=-])\s*("?[\w.]+"?)\.("?[\w"]+"?)/g;

  // Pattern: Ref [name] { ... }
  const refBlockRegex = /Ref\s*[^{:]*[:\{]\s*([^}]+)\s*\}?/gi;

  let rMatch;
  while ((rMatch = refBlockRegex.exec(text)) !== null) {
    const content = rMatch[1];
    let m;
    while ((m = refPattern.exec(content)) !== null) {
      relationships.push(createRelationship(m[1], m[2], m[3], m[4], m[5]));
    }
  }

  return relationships;
}