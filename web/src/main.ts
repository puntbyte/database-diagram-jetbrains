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
// - Callback 2: On Pan/Zoom -> Update Project Settings
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
  },
  (scale, x, y) => {
    // Debounce this in production if needed, but for now send directly
    bridge.send({
      type: "UPDATE_PROJECT_SETTINGS",
      settings: {
        zoom: scale,
        panX: Math.round(x),
        panY: Math.round(y)
      }
    });
  }
);

// 3. Listen for HUD Events (Grid Toggle, Line Style)
// These events bubble up from the HUD component
const app = document.getElementById('app')!;
app.addEventListener('project-settings-changed', (e: any) => {
  const partial = e.detail || {};

  // We need to include the current transform so we don't lose position
  // when toggling the grid or changing line style.
  // Accessing private manager via 'any' cast or public getter if available.
  const t = renderer['panZoomManager']?.getTransform?.() || { scale: 1, x: 0, y: 0 };

  bridge.send({
    type: "UPDATE_PROJECT_SETTINGS",
    settings: {
      lineStyle: partial.lineStyle, // string
      showGrid: partial.showGrid,   // boolean
      zoom: partial.zoom ?? t.scale,
      panX: partial.panX ?? Math.round(t.x),
      panY: partial.panY ?? Math.round(t.y)
    }
  });
});

// 4. Theme Logic
function applyTheme(theme: "dark" | "light") {
  if (theme === "dark") document.body.classList.add("dark");
  else document.body.classList.remove("dark");
}

bridge.log("Webview Initialized & Ready");