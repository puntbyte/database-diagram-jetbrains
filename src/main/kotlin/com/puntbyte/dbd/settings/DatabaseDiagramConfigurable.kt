package com.puntbyte.dbd.settings

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.options.Configurable
import com.intellij.openapi.ui.DialogPanel
import com.intellij.ui.dsl.builder.bindIntText
import com.intellij.ui.dsl.builder.bindItem
import com.intellij.ui.dsl.builder.bindSelected
import com.intellij.ui.dsl.builder.panel
import javax.swing.JComponent

class DatabaseDiagramConfigurable : Configurable {

  private val settings = DatabaseDiagramSettings.instance
  private var myPanel: DialogPanel? = null

  override fun getDisplayName(): String = "Database Diagram"

  override fun createComponent(): JComponent {
    val panel = panel {
      group("Defaults") {
        row("Line Style:") {
          comboBox(listOf("Curve", "Rectilinear", "RoundRectilinear", "Oblique", "RoundOblique"))
            .bindItem(
              getter = { settings.state.defaultLineStyle },
              setter = { settings.state.defaultLineStyle = it ?: "Curve" }
            )
        }
        row("Grid Size (px):") {
          intTextField()
            .bindIntText(
              getter = { settings.state.defaultGridSize },
              setter = { settings.state.defaultGridSize = it }
            )
        }
        row {
          checkBox("Show grid by default")
            .bindSelected(
              getter = { settings.state.defaultShowGrid },
              setter = { settings.state.defaultShowGrid = it }
            )
        }
      }

      group("Appearance") {
        row("Theme:") {
          comboBox(listOf("System", "Light", "Dark"))
            .bindItem(
              getter = { settings.state.defaultTheme },
              setter = { settings.state.defaultTheme = it ?: "System" }
            )
            .comment("System follows the IDE theme")
        }
      }
    }
    myPanel = panel
    return panel
  }

  override fun isModified(): Boolean {
    // Delegate to the panel to check if UI matches the bound properties
    return myPanel?.isModified() ?: false
  }

  override fun apply() {
    // 1. Commit UI changes to the settings.state properties
    myPanel?.apply()

    // 2. Notify Listeners (Editors)
    ApplicationManager.getApplication().messageBus
      .syncPublisher(DatabaseDiagramSettings.TOPIC)
      .onSettingsChanged(settings.state)
  }

  override fun reset() {
    // Reset UI from the settings.state properties
    myPanel?.reset()
  }

  override fun disposeUIResources() {
    myPanel = null
  }
}