// web/src/main.ts

import { Bridge, type ServerMessage } from "./core/bridge";
import { SchemaRenderer } from "./core/renderer";
import "./styles/main.css";

// Store globals locally. Default to sensible values,
// but backend will overwrite this immediately on READY.
let globalDefaults = {
  lineStyle: 'Curve',
  showGrid: true,
  gridSize: 20
};

const bridge = new Bridge((msg: ServerMessage) => {
  switch (msg.type) {
    case "UPDATE_GLOBAL_SETTINGS":
      globalDefaults = {
        lineStyle: msg.lineStyle,
        showGrid: msg.showGrid,
        gridSize: msg.gridSize
      };
      // Apply instantly to current view
      renderer.updateVisuals(globalDefaults);
      break;

    case "UPDATE_CONTENT":
      // Pass the current globals to the renderer
      renderer.render(msg.format, msg.content, globalDefaults);
      break;

    case "UPDATE_THEME":
      applyTheme(msg.theme);
      break;
  }
});

const renderer = new SchemaRenderer(
    "app",
    (tableName, x, y, width) => {
      bridge.send({
        type: "UPDATE_TABLE_POS",
        tableName: tableName,
        x: x,
        y: y,
        width: width
      });
    }
);

const app = document.getElementById('app')!;

app.addEventListener('note-pos-changed', (e: any) => {
  const detail = e.detail;
  if (detail) {
    bridge.send({
      type: "UPDATE_NOTE_POS",
      name: detail.name,
      x: detail.x,
      y: detail.y,
      width: detail.width,
      height: detail.height
    });
  }
});

function applyTheme(theme: "dark" | "light") {
  if (theme === "dark") document.body.classList.add("dark");
  else document.body.classList.remove("dark");
}

bridge.log("Webview Initialized & Ready");