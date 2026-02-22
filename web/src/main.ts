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

// 3. Listen for Interactions
const app = document.getElementById('app')!;

// A. Project Settings (Grid, Zoom, Line Style)
app.addEventListener('project-settings-changed', (e: any) => {
  const partial = e.detail || {};
  bridge.send({
    type: "UPDATE_PROJECT_SETTINGS",
    settings: {
      lineStyle: partial.lineStyle,
      showGrid: partial.showGrid
      // Zoom/Pan are typically not saved on every frame,
      // but if you want to save them on specific actions, add them here.
    }
  });
});

// B. Sticky Note Updates (NEW)
// This event is dispatched by DragManager in onMouseUp
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

// 4. Theme Logic
function applyTheme(theme: "dark" | "light") {
  if (theme === "dark") document.body.classList.add("dark");
  else document.body.classList.remove("dark");
}

bridge.log("Webview Initialized & Ready");