package com.puntbyte.dbd.editor

import com.intellij.ide.ui.LafManager
import com.intellij.ide.ui.LafManagerListener
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.editor.Document
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileEditor
import com.intellij.openapi.fileEditor.FileEditorState
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.UserDataHolderBase
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.psi.PsiDocumentManager
import com.intellij.ui.JBColor
import com.puntbyte.dbd.builders.ErdDataBuilder
import com.puntbyte.dbd.settings.DatabaseDiagramSettings
import com.puntbyte.dbd.webview.WebviewBridge
import com.puntbyte.dbd.webview.WebviewPanel
import org.jetbrains.yaml.psi.YAMLFile
import java.beans.PropertyChangeListener
import javax.swing.JComponent

class SchemaPreviewFileEditor(
  private val project: Project,
  private val file: VirtualFile
) : UserDataHolderBase(), FileEditor, WebviewPanel.WebviewListener {

  private val webviewPanel = WebviewPanel(this, file, this)

  @Volatile
  var isDisposed = false; private set

  // Counter to suppress re-renders triggered by layout-only YAML saves.
  @Volatile
  var pendingLayoutSaves = 0; private set

  init {
    val connection = ApplicationManager.getApplication().messageBus.connect(this)
    connection.subscribe(LafManagerListener.TOPIC, object : LafManagerListener {
      override fun lookAndFeelChanged(source: LafManager) {
        updateTheme()
      }
    })
    connection.subscribe(
      DatabaseDiagramSettings.TOPIC,
      object : DatabaseDiagramSettings.SettingsChangedListener {
        override fun onSettingsChanged(settings: DatabaseDiagramSettings.State) {
          if (!isDisposed) {
            pushSettings(settings); updateTheme()
          }
        }
      })
  }

  override fun getComponent(): JComponent = webviewPanel.component
  override fun getPreferredFocusedComponent(): JComponent = webviewPanel.component
  override fun getName(): String = "ERD Preview"

  private fun pushSettings(settings: DatabaseDiagramSettings.State) {
    webviewPanel.updateGlobalSettings(
      lineStyle = settings.defaultLineStyle,
      showGrid = settings.defaultShowGrid,
      gridSize = settings.defaultGridSize,
      showTableNotes = settings.showTableNotes,
      showFieldNotes = settings.showFieldNotes,
      tableNoteMaxLines = settings.tableNoteMaxLines,
      fieldNoteMaxLines = settings.fieldNoteMaxLines,
    )
  }

  fun render(document: Document) {
    if (isDisposed) return
    val psiFile =
      PsiDocumentManager.getInstance(project).getPsiFile(document) as? YAMLFile ?: return
    val payload = ErdDataBuilder.build(psiFile, project)
    val settings = DatabaseDiagramSettings.instance.state
    val global = WebviewBridge.GlobalSettings(
      lineStyle = settings.defaultLineStyle,
      showGrid = settings.defaultShowGrid,
      gridSize = settings.defaultGridSize,
      showTableNotes = settings.showTableNotes,
      showFieldNotes = settings.showFieldNotes,
      tableNoteMaxLines = settings.tableNoteMaxLines,
      fieldNoteMaxLines = settings.fieldNoteMaxLines,
    )
    webviewPanel.updateSchemaPayload(payload, global)
  }

  private fun updateTheme() {
    if (isDisposed) return
    val themeStr = when (DatabaseDiagramSettings.instance.state.defaultTheme) {
      "Light" -> "light"
      "Dark" -> "dark"
      else -> if (!JBColor.isBright()) "dark" else "light"
    }
    webviewPanel.updateTheme(themeStr)
  }

  override fun onWebviewReady() {
    if (isDisposed) return
    updateTheme()
    ApplicationManager.getApplication().runReadAction {
      FileDocumentManager.getInstance().getDocument(file)?.let { render(it) }
    }
  }

  override fun onTablePositionUpdated(tableName: String, x: Int, y: Int, width: Int?) {
    pendingLayoutSaves++
    updateFile { psi -> ErdYamlUpdater.updateTablePosition(project, psi, tableName, x, y, width) }
    ApplicationManager.getApplication()
      .invokeLater { if (pendingLayoutSaves > 0) pendingLayoutSaves-- }
  }

  override fun onNotePositionUpdated(name: String, x: Int, y: Int, width: Int, height: Int) {
    pendingLayoutSaves++
    updateFile { psi -> ErdYamlUpdater.updateNotePosition(project, psi, name, x, y, width, height) }
    ApplicationManager.getApplication()
      .invokeLater { if (pendingLayoutSaves > 0) pendingLayoutSaves-- }
  }

  private fun updateFile(action: (YAMLFile) -> Unit) {
    if (isDisposed || project.isDisposed) return
    val document = ApplicationManager.getApplication().runReadAction<Document?> {
      FileDocumentManager.getInstance().getDocument(file)
    } ?: return
    if (!file.isValid || !document.isWritable) return
    val psi = PsiDocumentManager.getInstance(project).getPsiFile(document) as? YAMLFile ?: return
    action(psi)
  }

  override fun setState(state: FileEditorState) {}
  override fun isModified(): Boolean = false
  override fun isValid(): Boolean = true
  override fun addPropertyChangeListener(listener: PropertyChangeListener) {}
  override fun removePropertyChangeListener(listener: PropertyChangeListener) {}
  override fun dispose() {
    isDisposed = true
  }
}