// web/src/main.ts

import { Bridge, type ServerMessage } from "./core/bridge";
import { SchemaRenderer } from "./core/renderer";
import "./styles/main.css";

// 1. Initialize Bridge
const bridge = new Bridge((msg: ServerMessage) => {
  switch (msg.type) {
    case "UPDATE_CONTENT":
      renderer.render(msg.format, msg.content);
      break;
    case "UPDATE_THEME":
      applyTheme(msg.theme);
      break;
  }
});

// 2. Initialize Renderer
// - Callback 1: On Table Move/Resize -> Update Table Settings
// - (Callback 2 for Pan/Zoom tracking is removed to stop saving those settings)
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

// 3. Listen for HUD Events (Grid Toggle, Line Style)
const app = document.getElementById('app')!;
app.addEventListener('project-settings-changed', (e: any) => {
  const partial = e.detail || {};

  // Only send Grid and Line Style settings.
  // Zoom and Pan are no longer sent to the backend.
  bridge.send({
    type: "UPDATE_PROJECT_SETTINGS",
    settings: {
      lineStyle: partial.lineStyle, // string
      showGrid: partial.showGrid    // boolean
    }
  });
});

// 4. Theme Logic
function applyTheme(theme: "dark" | "light") {
  if (theme === "dark") document.body.classList.add("dark");
  else document.body.classList.remove("dark");
}

bridge.log("Webview Initialized & Ready");