// web/src/core/communication/protocol.ts

import type {DbTable, DbRelationship, DbProject, DbNote} from '../../models/types.ts';

export interface SchemaPayload {
  tables: DbTable[];
  relationships: DbRelationship[];
  projectSettings: DbProject;
  notes: DbNote[];
}

export interface ViewSettings {
  lineStyle: string;
  showGrid: boolean;
  gridSize: number;
}

export type ServerMessage =
    | SchemaUpdateMessage
    | ThemeUpdateMessage
    | SettingsUpdateMessage;

export interface SchemaUpdateMessage {
  type: 'UPDATE_SCHEMA_PAYLOAD';
  payload: SchemaPayload;
  settings?: ViewSettings;
}

export interface ThemeUpdateMessage {
  type: 'UPDATE_THEME';
  theme: 'dark' | 'light';
}

// FIX: Kotlin's UpdateGlobalSettings serialises as flat top-level properties,
// NOT nested under a "settings" key.  The previous interface had `settings: ViewSettings`
// which caused message.settings to always be undefined.
export interface SettingsUpdateMessage {
  type: 'UPDATE_GLOBAL_SETTINGS';
  lineStyle: string;
  showGrid: boolean;
  gridSize: number;
}

export type ClientMessage =
    | LogMessage
    | ReadyMessage
    | TablePositionUpdateMessage
    | NotePositionUpdateMessage;

export interface LogMessage {
  type: 'LOG';
  level: string;
  message: string;
}

export interface ReadyMessage {
  type: 'READY';
}

export interface TablePositionUpdateMessage {
  type: 'UPDATE_TABLE_POS';
  tableName: string;
  x: number;
  y: number;
  width?: number;
}

export interface NotePositionUpdateMessage {
  type: 'UPDATE_NOTE_POS';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}