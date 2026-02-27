// web/src/parsers/dbml/relationships.ts

import type { Cardinality, DbRelationship } from '../../models/types';
import { parseRefPath, parseSettingsString } from './utils';

export function createRelationship(
    t1: string, c1: string[],
    op: string,
    t2: string, c2: string[],
    settings?: Map<string, string>
): DbRelationship {

  let type: Cardinality = '1:n';

  if (op === '<') type = '1:n';
  else if (op === '>') type = 'n:1';
  else if (op === '-') type = '1:1';
  else if (op === '<>') type = 'm:n';

  return {
    fromTable: t1,
    fromColumns: c1,
    toTable: t2,
    toColumns: c2,
    type,
    settings: settings ? Object.fromEntries(settings) : undefined
  };
}

export function parseStandaloneRefs(text: string): DbRelationship[] {
  const relationships: DbRelationship[] = [];

  // 1. Parse LONG FORM: Ref [name] { ... }
  const longFormRegex = /Ref\s*(?:[a-zA-Z0-9_]+)?\s*\{([\s\S]*?)\}/gi;
  let match;

  // We remove the Long Form blocks from text after parsing to avoid double matching
  // with the Short Form parser if we were to run them sequentially on same text.
  // Ideally, we iterate through the text.

  while ((match = longFormRegex.exec(text)) !== null) {
    const body = match[1];
    // Inside body: path <op> path [settings]
    parseRefLines(body, relationships);
  }

  // 2. Parse SHORT FORM: Ref [name]: ...
  // Match lines starting with Ref:
  const shortFormRegex = /Ref\s*(?:[a-zA-Z0-9_]+)?\s*:\s*(.*)/gi;
  while ((match = shortFormRegex.exec(text)) !== null) {
    const line = match[1];
    parseRefLines(line, relationships);
  }

  return relationships;
}

function parseRefLines(content: string, relationships: DbRelationship[]) {
  const lines = content.split('\n');

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('//')) continue;

    // Pattern: Endpoint1 Operator Endpoint2 [Settings]
    // Endpoint can contain dots and parenthesis: schema.table.(c1,c2)
    // Operator: <, >, -, <>
    // We split by the operator.

    // Regex to find the operator and split the string
    // Capture groups: 1=Left, 2=Operator, 3=RightRest
    const opRegex = /^(.*?)\s*(<>|[<>=-])\s*(.*)$/;
    const opMatch = opRegex.exec(line);

    if (!opMatch) continue;

    const leftRaw = opMatch[1].trim();
    const op = opMatch[2];
    const rightRest = opMatch[3].trim();

    // Separate Right side from Settings
    // Look for starting '['
    let rightRaw = rightRest;
    let settingsStr = '';

    const settingIdx = rightRest.indexOf('[');
    if (settingIdx !== -1) {
      rightRaw = rightRest.substring(0, settingIdx).trim();
      const endIdx = rightRest.lastIndexOf(']');
      if (endIdx !== -1) {
        settingsStr = rightRest.substring(settingIdx + 1, endIdx);
      }
    }

    const leftData = parseRefPath(leftRaw);
    const rightData = parseRefPath(rightRaw);
    const settings = parseSettingsString(settingsStr);

    if (leftData && rightData) {
      relationships.push(createRelationship(
          leftData.table, leftData.columns,
          op,
          rightData.table, rightData.columns,
          settings
      ));
    }
  }
}