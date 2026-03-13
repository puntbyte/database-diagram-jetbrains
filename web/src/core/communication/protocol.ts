// web/src/core/communication/protocol.ts

import type { DbTable, DbRelationship, DbProject, DbNote } from '../../models/types.ts';

export interface SchemaPayload {
  tables: DbTable[];
  relationships: DbRelationship[];
  projectSettings: DbProject;
  notes: DbNote[];
}

// Visual configuration shared across messages
export interface ViewSettings {
  lineStyle: string;
  showGrid: boolean;
  gridSize: number;
}

// Server → Client messages
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

export interface SettingsUpdateMessage {
  type: 'UPDATE_GLOBAL_SETTINGS';
  settings: ViewSettings;
}

// Client → Server messages
export type ClientMessage =
    | LogMessage
    | ReadyMessage
    | TablePositionUpdateMessage
    | NotePositionUpdateMessage
    | SettingsSaveMessage;

export interface LogMessage {
  type: 'LOG';
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
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

export interface SettingsSaveMessage {
  type: 'SAVE_GLOBAL_SETTINGS';
  settings: Partial<ViewSettings>;
}