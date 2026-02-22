package com.puntbyte.dbd.webview

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo

class WebviewBridge {

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

    @JsonTypeInfo(
        use = JsonTypeInfo.Id.NAME,
        include = JsonTypeInfo.As.PROPERTY,
        property = "type"
    )
    @JsonSubTypes(
        JsonSubTypes.Type(value = Client.Log::class, name = "LOG"),
        JsonSubTypes.Type(value = Client.Ready::class, name = "READY"),
        JsonSubTypes.Type(value = Client.UpdateTablePos::class, name = "UPDATE_TABLE_POS"),
        JsonSubTypes.Type(value = Client.UpdateProjectSettings::class, name = "UPDATE_PROJECT_SETTINGS"),
        // NEW TYPE
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
        data class UpdateProjectSettings(
            val settings: Map<String, @JvmSuppressWildcards Any?>
        ) : Client()

        // NEW DATA CLASS
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