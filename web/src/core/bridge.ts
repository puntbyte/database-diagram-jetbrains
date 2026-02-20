// web/src/core/bridge.ts

export type ServerMessage =
    | { type: "UPDATE_CONTENT"; format: string; content: string }
    | { type: "UPDATE_THEME"; theme: "dark" | "light" };

export type ClientMessage =
    | { type: "LOG"; level: string; message: string }
    | { type: "READY" }
    | { type: "UPDATE_TABLE_POS"; tableName: string; x: number; y: number; width?: number }
    | {
  type: "UPDATE_PROJECT_SETTINGS";
  settings: { lineStyle?: string; showGrid?: boolean; zoom?: number; panX?: number; panY?: number }
};

declare global {
  interface Window {
    cefQuery?: (options: { request: string; onSuccess?: Function; onFailure?: Function }) => void;
  }
}

export class Bridge {
  private onMessage: (m: ServerMessage) => void;

  constructor(onMessage: (m: ServerMessage) => void) {
    this.onMessage = onMessage;

    window.addEventListener("message", (ev) => {
      const data = ev.data;
      if (data && typeof data.type === "string") {
        this.onMessage(data as ServerMessage);
      }
    });

    this.send({type: "READY"});
  }

  send(msg: ClientMessage) {
    const payload = JSON.stringify(msg);
    if (window.cefQuery) {
      window.cefQuery({request: payload});
    } else {
      console.log("Bridge Dev Log:", msg);
    }
  }

  log(text: string) {
    this.send({type: "LOG", level: "INFO", message: text});
  }
}