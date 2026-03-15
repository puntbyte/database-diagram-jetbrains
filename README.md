# Database Diagram — IntelliJ Plugin

An Entity-Relationship Diagram (ERD) previewer and editor for IntelliJ-based IDEs.
Open any `.erd.yaml` file to see a live, interactive diagram of your SQL schema.

---

## Features

- **Split editor** — YAML source on the left, interactive diagram on the right
- **Live updates** — diagram re-renders as you type in the `.erd.yaml` or any imported `.sql` file
- **Drag & drop layout** — move and resize tables; positions are written back to the YAML automatically
- **Relationship lines** — infers FK relationships from `REFERENCES` clauses; supports explicit routing with `way_points`, `source_anchor`, and `target_anchor`
- **Self-referencing tables** — FK loops are drawn on the left side to avoid overlap
- **Semantic zoom** — zooming out switches to a compact overlay view showing table name and column count
- **Custom colours** — per-table and per-note colour picker with Material Design palette
- **Doc-comment tooltips** — `--- comment` lines above columns/tables appear as tooltips on hover
- **Sticky notes** — annotate the diagram with Markdown-rendered notes, optionally with callout arrows pointing to specific tables or columns
- **Line style** — Curve, Rectilinear, RoundRectilinear, Oblique, RoundOblique
- **Theme** — System / Light / Dark, detected automatically from the IDE Look & Feel
- **"New" menu** — right-click a directory → New → ERD Diagram or SQL Schema File

---

## Requirements

| Requirement | Version |
|---|---|
| IntelliJ IDEA (or any IntelliJ-based IDE) | 2025.2.4+ (build 252+) |
| JDK | 21 |
| Kotlin | 2.1.20 |
| Node.js (for building the web UI) | 22 |

---

## Project structure

```
database-diagram-jetbrains/
├── build.gradle.kts                  Main Gradle build
├── gradle.properties                 Memory + path settings (gitignored locally)
│
└── src/main/
    ├── kotlin/com/puntbyte/dbd/
    │   ├── actions/
    │   │   ├── NewErdYamlAction.kt   "New → ERD Diagram" menu action
    │   │   └── NewSqlSchemaAction.kt "New → SQL Schema File" menu action
    │   ├── builders/
    │   │   └── ErdDataBuilder.kt     Parses SQL PSI + YAML into SchemaPayload
    │   ├── editor/
    │   │   ├── SchemaSplitEditorProvider.kt  Registers the split editor
    │   │   ├── SchemaPreviewFileEditor.kt    Preview panel + bridge callbacks
    │   │   └── ErdYamlUpdater.kt             Writes positions/colours back to YAML
    │   ├── settings/
    │   │   ├── DatabaseDiagramSettings.kt    Persistent settings state
    │   │   └── DatabaseDiagramConfigurable.kt  IDE Settings panel
    │   ├── templates/
    │   │   └── ErdFileTemplateGroup.kt       Registers .ft file templates
    │   └── webview/
    │       ├── WebviewBridge.kt              Kotlin ↔ JS data model + message types
    │       ├── WebviewPanel.kt               JCEF browser host
    │       └── WebviewSchemeHandler.kt       Custom scheme for resource loading
    │
    └── resources/
        ├── META-INF/plugin.xml
        ├── fileTemplates/
        │   ├── ErdYaml.ft            Default .erd.yaml template
        │   └── SqlSchema.ft          Default .sql template
        └── web/                      Built web UI (generated, gitignored)
```

---

## Building

### Prerequisites

- The standalone web project must be accessible (see **Web UI** below)
- Set `localIdePath` in `build.gradle.kts` to your local IntelliJ installation, or use `intellijIdea("version")` to download one

### Web UI location

The build reads the web project path from (highest priority first):

1. `WEB_PROJECT_DIR` environment variable
2. `webProjectDir` in `gradle.properties`
3. Sibling directory default: `../database-diagram-web`

Example `gradle.properties` (gitignored):
```properties
webProjectDir=../database-diagram-web
kotlin.daemon.jvmargs=-Xmx2g -XX:+UseG1GC
org.gradle.jvmargs=-Xmx1500m -XX:+UseG1GC
```

### Commands

```bash
# Build the plugin JAR (also builds the web UI)
./gradlew buildPlugin

# Build only the web UI bundle and copy it to resources
./gradlew copyWebDist

# Run the plugin in a sandboxed IDE instance
./gradlew runIde

# Type-check the Kotlin sources
./gradlew compileKotlin
```

---

## `.erd.yaml` format

```yaml
schema:
  imports:
    - "schema.sql"          # Relative paths to SQL files

# Visual layout — managed automatically by dragging tables
tables:
  users:
    x: 100
    y: 150
    width: 260
    color: "#3b82f6"        # Optional header colour (hex)

# Relationship routing overrides (optional)
relationships:
  - source: orders.user_id
    target: users.id
    source_anchor: right    # left | right
    target_anchor: left
    way_points:
      - { x: 50, y: 0, from: source }
      - { x: 50, y: 0, from: target }

# Diagram annotations
notes:
  - id: "note_001"
    text: |
      **Important:** All timestamps are stored in UTC.
    x: 1300
    y: 150
    width: 250
    color: "#fffde7"
    target: "orders.user_id"   # Optional callout arrow
    target_anchor: right
```

---

## IDE Settings

**Settings → Tools → Database Diagram**

| Setting | Description |
|---|---|
| Default layout | Editor / Editor and Preview / Preview |
| Line style | Curve / Rectilinear / RoundRectilinear / Oblique / RoundOblique |
| Show grid | Toggle grid background |
| Grid size | Grid cell size in pixels |
| Theme | System / Light / Dark |
| Show table notes | Toggle `--- comment` display in table headers |
| Show field notes | Toggle `--- comment` display on columns |
| Max table note lines | Line clamp for table notes (0 = unlimited) |
| Max field note lines | Line clamp for field notes (0 = unlimited) |

---

## SQL doc-comment syntax

Place a `---` comment on the line directly above a `CREATE TABLE` or column definition to attach a note that appears in the diagram:

```sql
--- Stores authenticated user accounts.
CREATE TABLE users (
    id          SERIAL      PRIMARY KEY,

    --- The user's display name shown in the UI.
    display_name VARCHAR(120) NOT NULL,

    --- Role of this account; determines which workflows are available.
    --- See public.account_type enum for valid values.
    account_type account_type NOT NULL DEFAULT 'individual'
);
```

Multi-line `---` blocks are joined into a single note with a space.

---

## Architecture

```
IDE (Kotlin)
  SchemaSplitEditorProvider
    └─ SchemaPreviewFileEditor          Disposable, owns the lifecycle
         ├─ ErdDataBuilder              SQL PSI + YAML → SchemaPayload
         ├─ ErdYamlUpdater              Writes x/y/colour back to YAML
         └─ WebviewPanel                Hosts the JCEF browser
              └─ window.postMessage()  ──► JS: Bridge.ts
                                               └─ DiagramApplication
                                                    └─ DiagramController
```

Messages are JSON objects tagged with a `type` discriminator.
`WebviewBridge.kt` defines all shared data classes (tables, fields, relationships, notes) and both sealed class hierarchies (`Server` and `Client`).

---

## Contributing

1. Fork and clone the repo
2. Open in IntelliJ IDEA
3. Set `localIdePath` in `build.gradle.kts`
4. Run `./gradlew runIde` to launch a sandbox IDE with the plugin loaded
5. The web UI hot-reloads via `npm run dev` in the web project — see the web project README for details