package com.puntbyte.dbd.settings

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.options.Configurable
import com.intellij.openapi.ui.DialogPanel
import com.intellij.ui.dsl.builder.*
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

      // ── Doc-comment note display ─────────────────────────────────────────
      group("Doc-Comment Notes") {
        // FIX: Capture the Cell<JCheckBox> in a lateinit var so we can call
        // .selected on it.  `Cell<AbstractButton>.selected` is an extension
        // property that returns a ComponentPredicate, which is what enabledIf()
        // expects.  The previous code called a standalone selected() function
        // that does not exist in this scope, causing the compile error.
        lateinit var showTableNotes: Cell<javax.swing.JCheckBox>
        lateinit var showFieldNotes: Cell<javax.swing.JCheckBox>

        row {
          showTableNotes = checkBox("Show table header notes")
            .bindSelected(
              getter = { settings.state.showTableNotes },
              setter = { settings.state.showTableNotes = it }
            )
        }
        row("Max table note lines:") {
          intTextField(range = 0..10)
            .bindIntText(
              getter = { settings.state.tableNoteMaxLines },
              setter = { settings.state.tableNoteMaxLines = it }
            )
            .comment("0 = show all lines (no clamp)")
            .enabledIf(showTableNotes.selected)
        }

        row {
          showFieldNotes = checkBox("Show column / field notes")
            .bindSelected(
              getter = { settings.state.showFieldNotes },
              setter = { settings.state.showFieldNotes = it }
            )
        }
        row("Max field note lines:") {
          intTextField(range = 0..10)
            .bindIntText(
              getter = { settings.state.fieldNoteMaxLines },
              setter = { settings.state.fieldNoteMaxLines = it }
            )
            .comment("0 = show all lines (no clamp)")
            .enabledIf(showFieldNotes.selected)
        }
      }
    }

    myPanel = panel
    return panel
  }

  override fun isModified(): Boolean = myPanel?.isModified() ?: false

  override fun apply() {
    myPanel?.apply()
    ApplicationManager.getApplication().messageBus
      .syncPublisher(DatabaseDiagramSettings.TOPIC)
      .onSettingsChanged(settings.state)
  }

  override fun reset() {
    myPanel?.reset()
  }

  override fun disposeUIResources() {
    myPanel = null
  }
}