package com.puntbyte.dbd.webview

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo

class WebviewBridge {

  data class GlobalSettings(
    val lineStyle: String,
    val showGrid: Boolean,
    val gridSize: Int
  )

  data class SchemaPayload(
    val tables: List<DbTable>,
    val relationships: List<DbRelationship>,
    val projectSettings: DbProject,
    val notes: List<DbNote>
  )

  data class DbProject(
    val zoom: Double? = null,
    val panX: Double? = null,
    val panY: Double? = null,
    val databaseType: String? = null,
    val note: String? = null
  )

  data class DbTable(
    val id: String,
    val schema: String,
    val name: String,
    val alias: String? = null,
    val fields: List<DbField>,
    val settings: Map<String, String>? = null,
    val indexes: List<DbIndex>? = null,
    val note: String? = null,
    val color: String? = null,
    val horizontal: Int? = null,
    val vertical: Int? = null,
    val width: Int? = null
  )

  data class DbField(
    val name: String,
    val isPrimaryKey: Boolean = false,
    val isForeignKey: Boolean = false,
    val isUnique: Boolean,
    val isNotNull: Boolean,
    val type: String,
    val default: String? = null,
    val enumValues: List<String>? = null,
    val reference: DbReference? = null,
    val note: String? = null
  )

  data class DbReference(
    val symbol: String,
    val toSchema: String,
    val toTable: String,
    val toColumn: String
  )

  // FIX: A single intermediate routing point defined in the .erd.yaml.
  // `x` is measured outward from the referenced table anchor (always positive).
  // `y` is measured downward from the column-row centre (may be negative).
  // `from` tells the JS side which anchor to base the offset on.
  data class WayPoint(
    val x: Double,
    val y: Double,
    val from: String   // "source" | "target"
  )

  data class DbRelationship(
    val fromSchema: String,
    val fromTable: String,
    val fromColumns: List<String>,
    val toSchema: String,
    val toTable: String,
    val toColumns: List<String>,
    val type: String,
    val settings: Map<String, String>? = null,
    // FIX: Routing overrides loaded from the .erd.yaml `source_anchor`,
    // `target_anchor`, and `way_points` keys.  Null means "auto-route".
    val sourceAnchor: String? = null,   // "left" | "right" | null
    val targetAnchor: String? = null,   // "left" | "right" | null
    val waypoints: List<WayPoint>? = null
  )

  data class DbNote(
    val id: String,
    val name: String,
    val content: String,
    val horizontal: Int,
    val vertical: Int,
    val width: Int,
    val height: Int? = null,
    val color: String? = null
  )

  data class DbIndex(
    val columns: List<String>,
    val settings: Map<String, String>? = null,
    val raw: String? = null
  )

  // MESSAGES: IDE → WEBVIEW
  @JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "type")
  @JsonSubTypes(
    JsonSubTypes.Type(value = Server.UpdateSchemaPayload::class, name = "UPDATE_SCHEMA_PAYLOAD"),
    JsonSubTypes.Type(value = Server.UpdateTheme::class, name = "UPDATE_THEME"),
    JsonSubTypes.Type(value = Server.UpdateGlobalSettings::class, name = "UPDATE_GLOBAL_SETTINGS")
  )
  sealed class Server {
    data class UpdateSchemaPayload(
      val payload: SchemaPayload,
      val settings: GlobalSettings? = null
    ) : Server()

    data class UpdateTheme(val theme: String) : Server()

    // FIX: The TypeScript side reads lineStyle/showGrid/gridSize as flat properties
    // on the message object.  Jackson serialises this data class with those exact
    // property names at the top level, so no custom serialiser is needed.
    data class UpdateGlobalSettings(
      val lineStyle: String,
      val showGrid: Boolean,
      val gridSize: Int
    ) : Server()
  }

  // MESSAGES: WEBVIEW → IDE
  @JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "type")
  @JsonSubTypes(
    JsonSubTypes.Type(value = Client.Log::class, name = "LOG"),
    JsonSubTypes.Type(value = Client.Ready::class, name = "READY"),
    JsonSubTypes.Type(value = Client.UpdateTablePos::class, name = "UPDATE_TABLE_POS"),
    JsonSubTypes.Type(value = Client.UpdateNotePos::class, name = "UPDATE_NOTE_POS")
  )
  sealed class Client {
    data class Log(val level: String, val message: String) : Client()
    data object Ready : Client()

    @JsonIgnoreProperties(ignoreUnknown = true)
    data class UpdateTablePos(
      val tableName: String,
      val x: Int,
      val y: Int,
      val width: Int? = null
    ) : Client()

    @JsonIgnoreProperties(ignoreUnknown = true)
    data class UpdateNotePos(
      val name: String,
      val x: Int,
      val y: Int,
      val width: Int,
      val height: Int
    ) : Client()
  }
}