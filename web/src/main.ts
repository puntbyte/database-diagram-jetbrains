// web/src/main.ts

import {Bridge} from './core/communication/bridge.ts';
import type {ServerMessage, ViewSettings} from './core/communication/protocol.ts';
import './styles/main.css';
import {DiagramController} from "./core/diagram/diagram-controller.ts";

class DiagramApplication {
  private bridge: Bridge;
  private controller: DiagramController;
  private viewSettings: ViewSettings = {
    lineStyle: 'Curve',
    showGrid: true,
    gridSize: 20
  };

  constructor() {
    this.bridge = new Bridge((msg) => this.handleServerMessage(msg));
    this.controller = this.initializeController();
    this.setupEventListeners();

    this.bridge.log('Diagram application initialized', 'INFO');
  }

  private initializeController(): DiagramController {
    return new DiagramController(
        'app',
        (tableName, x, y, width) => this.handleTableMove(tableName, x, y, width),
        (transform) => this.handleTransformChange(transform)
    );
  }

  private handleServerMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'UPDATE_GLOBAL_SETTINGS':
        this.updateSettings(message.settings);
        break;

      case 'UPDATE_SCHEMA_PAYLOAD':
        if (message.settings) {
          this.updateSettings(message.settings);
        }
        this.controller.loadSchema(message.payload, this.viewSettings);
        break;

      case 'UPDATE_THEME':
        this.applyTheme(message.theme);
        break;
    }
  }

  private updateSettings(settings: ViewSettings): void {
    this.viewSettings = settings;
    this.controller.updateVisuals(settings);
  }

  private handleTableMove(
      tableName: string,
      x: number,
      y: number,
      width?: number
  ): void {
    this.bridge.send({
      type: 'UPDATE_TABLE_POS',
      tableName,
      x,
      y,
      width
    });
  }

  private handleTransformChange(transform: { scale: number; x: number; y: number }): void {
    // Could debounce this for performance if needed
    // bridge.send({ type: 'UPDATE_VIEWPORT', ...transform });
  }

  private setupEventListeners(): void {
    const app = document.getElementById('app');
    if (!app) return;

    app.addEventListener('note-position-changed', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        this.bridge.send({
          type: 'UPDATE_NOTE_POS',
          name: detail.name,
          x: detail.x,
          y: detail.y,
          width: detail.width,
          height: detail.height
        });
      }
    });
  }

  private applyTheme(theme: 'dark' | 'light'): void {
    document.body.classList.toggle('dark', theme === 'dark');
  }
}

// Bootstrap
new DiagramApplication();