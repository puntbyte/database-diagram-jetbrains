package com.puntbyte.dbd.webview

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo

/**
 * Defines the JSON protocol for communication between the IDE (Kotlin) and the WebView (JS).
 */
class WebviewBridge {

  // --- Messages sent FROM the IDE TO the WebView ---
  @JsonTypeInfo(
    use = JsonTypeInfo.Id.NAME,
    include = JsonTypeInfo.As.PROPERTY,
    property = "type"
  )
  @JsonSubTypes(
    JsonSubTypes.Type(value = Server.UpdateContent::class, name = "UPDATE_CONTENT"),
    JsonSubTypes.Type(value = Server.UpdateTheme::class, name = "UPDATE_THEME")
  )
  sealed class Server {
    data class UpdateContent(val format: String, val content: String) : Server()
    data class UpdateTheme(val theme: String) : Server()
  }

  // --- Messages sent FROM the WebView TO the IDE ---
  @JsonTypeInfo(
    use = JsonTypeInfo.Id.NAME,
    include = JsonTypeInfo.As.PROPERTY,
    property = "type"
  )
  @JsonSubTypes(
    JsonSubTypes.Type(value = Client.Log::class, name = "LOG"),
    JsonSubTypes.Type(value = Client.Ready::class, name = "READY"),
    JsonSubTypes.Type(value = Client.UpdateTablePos::class, name = "UPDATE_TABLE_POS"),
    // FIX: Explicitly register the project settings type here
    JsonSubTypes.Type(value = Client.UpdateProjectSettings::class, name = "UPDATE_PROJECT_SETTINGS")
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
    data class UpdateProjectSettings(
      val settings: Map<String, @JvmSuppressWildcards Any?>
    ) : Client()
  }
}