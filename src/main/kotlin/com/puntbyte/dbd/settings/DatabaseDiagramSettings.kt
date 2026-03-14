package com.puntbyte.dbd.settings

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.util.messages.Topic

@State(
  name = "DbDiagramSettings",
  storages = [Storage("dbdiagram.xml")]
)
class DatabaseDiagramSettings : PersistentStateComponent<DatabaseDiagramSettings.State> {

  enum class EditorLayout(val displayName: String) {
    EDITOR_ONLY("Editor"),
    EDITOR_AND_PREVIEW("Editor and Preview"),
    PREVIEW_ONLY("Preview");

    override fun toString() = displayName
  }

  data class State(
    var defaultLineStyle: String = "Curve",
    var defaultShowGrid: Boolean = true,
    var defaultGridSize: Int = 20,
    var defaultTheme: String = "System",
    /** Which panels to show when opening an .erd.yaml file */
    var defaultEditorLayout: EditorLayout = EditorLayout.EDITOR_AND_PREVIEW,
    var showTableNotes: Boolean = true,
    var showFieldNotes: Boolean = true,
    var tableNoteMaxLines: Int = 2,
    var fieldNoteMaxLines: Int = 2,
  )

  private var myState = State()

  override fun getState(): State = myState
  override fun loadState(state: State) {
    myState = state
  }

  companion object {
    val instance: DatabaseDiagramSettings
      get() = ApplicationManager.getApplication().getService(DatabaseDiagramSettings::class.java)

    val TOPIC: Topic<SettingsChangedListener> =
      Topic.create("DbDiagramSettingsChanged", SettingsChangedListener::class.java)
  }

  interface SettingsChangedListener {
    fun onSettingsChanged(settings: State)
  }
}