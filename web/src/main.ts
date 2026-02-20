// web/src/main.ts

import {Bridge, type ServerMessage} from "./core/bridge";
import {SchemaRenderer} from "./core/renderer";
import "./styles/main.css";

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

const renderer = new SchemaRenderer("app", (tableName, x, y, width) => {
    bridge.send({
        type: "UPDATE_TABLE_POS",
        tableName: tableName,
        x: x,
        y: y,
        width: width // Pass the width
    });
});

function applyTheme(theme: "dark" | "light") {
    if (theme === "dark") document.body.classList.add("dark");
    else document.body.classList.remove("dark");
}

bridge.log("Webview Initialized");