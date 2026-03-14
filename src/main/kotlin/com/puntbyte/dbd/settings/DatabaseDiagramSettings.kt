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

  data class State(
    var defaultLineStyle: String = "Curve",
    var defaultShowGrid: Boolean = true,
    var defaultGridSize: Int = 20,
    var defaultTheme: String = "System",

    // ── Doc-comment note display ──────────────────────────────────────────
    /** Show the table-header doc comment in the diagram card */
    var showTableNotes: Boolean = true,
    /** Show column/field doc comments in the diagram card */
    var showFieldNotes: Boolean = true,
    /**
     * Maximum visible lines for table notes.
     * 0 = unlimited (full text shown, scrolls if needed).
     * Applied via CSS -webkit-line-clamp so no JS re-render is required.
     */
    var tableNoteMaxLines: Int = 2,
    /**
     * Maximum visible lines for field notes.
     * 0 = unlimited.
     */
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