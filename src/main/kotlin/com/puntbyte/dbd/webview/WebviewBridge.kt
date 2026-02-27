package com.puntbyte.dbd.webview

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo

class WebviewBridge {

  // --- SHARED DATA CLASS ---
  data class GlobalSettings(
    val lineStyle: String,
    val showGrid: Boolean,
    val gridSize: Int
  )

  // MESSAGES: IDE -> WEBVIEW
  @JsonTypeInfo(
    use = JsonTypeInfo.Id.NAME,
    include = JsonTypeInfo.As.PROPERTY,
    property = "type"
  )
  @JsonSubTypes(
    JsonSubTypes.Type(value = Server.UpdateContent::class, name = "UPDATE_CONTENT"),
    JsonSubTypes.Type(value = Server.UpdateTheme::class, name = "UPDATE_THEME"),
    JsonSubTypes.Type(value = Server.UpdateGlobalSettings::class, name = "UPDATE_GLOBAL_SETTINGS")
  )
  sealed class Server {
    // UPDATED: Now carries settings
    data class UpdateContent(
      val format: String,
      val content: String,
      val settings: GlobalSettings? = null
    ) : Server()

    data class UpdateTheme(val theme: String) : Server()

    // Kept for live updates from Settings Panel
    data class UpdateGlobalSettings(
      val lineStyle: String,
      val showGrid: Boolean,
      val gridSize: Int
    ) : Server()
  }

  // MESSAGES: WEBVIEW -> IDE
  @JsonTypeInfo(
    use = JsonTypeInfo.Id.NAME,
    include = JsonTypeInfo.As.PROPERTY,
    property = "type"
  )
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
      val tableName: String, val x: Int, val y: Int, val width: Int? = null
    ) : Client()

    @JsonIgnoreProperties(ignoreUnknown = true)
    data class UpdateNotePos(
      val name: String, val x: Int, val y: Int, val width: Int, val height: Int
    ) : Client()
  }
}