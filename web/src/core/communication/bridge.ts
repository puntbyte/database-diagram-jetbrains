// web/src/core/communication/bridge.ts

import type { ServerMessage, ClientMessage } from './protocol.ts';

declare global {
  interface Window {
    cefQuery?: (options: {
      request: string;
      onSuccess?: (response: string) => void;
      onFailure?: (errorCode: number, errorMessage: string) => void
    }) => void;
  }
}

export type MessageHandler = (message: ServerMessage) => void;

export class Bridge {
  private handler: MessageHandler;

  constructor(handler: MessageHandler) {
    this.handler = handler;
    this.initializeListener();
    this.notifyReady();
  }

  private initializeListener(): void {
    window.addEventListener('message', (event) => {
      const data = event.data;
      if (this.isValidServerMessage(data)) {
        this.handler(data as ServerMessage);
      }
    });
  }

  private isValidServerMessage(data: unknown): data is { type: string } {
    return data !== null &&
        typeof data === 'object' &&
        'type' in data &&
        typeof (data as Record<string, unknown>).type === 'string';
  }

  private notifyReady(): void {
    this.send({ type: 'READY' });
  }

  send(message: ClientMessage): void {
    const payload = JSON.stringify(message);

    if (window.cefQuery) {
      window.cefQuery({ request: payload });
    } else {
      console.log('[Bridge Dev Mode]', message);
    }
  }

  log(message: string, level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' = 'INFO'): void {
    this.send({ type: 'LOG', level, message });
  }

  // Allow hot-swapping handler if needed
  setHandler(handler: MessageHandler): void {
    this.handler = handler;
  }
}