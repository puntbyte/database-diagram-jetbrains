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
    var defaultTheme: String = "System"
  )

  private var myState = State()

  override fun getState(): State = myState

  override fun loadState(state: State) {
    myState = state
  }

  companion object {
    val instance: DatabaseDiagramSettings
      get() = ApplicationManager.getApplication().getService(DatabaseDiagramSettings::class.java)

    // Topic to notify editors when settings change
    val TOPIC = Topic.create("DbDiagramSettingsChanged", SettingsChangedListener::class.java)
  }

  interface SettingsChangedListener {
    fun onSettingsChanged(settings: State)
  }
}