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
  @Volatile
  var pendingLayoutSaves = 0; private set

  init {
    val conn = ApplicationManager.getApplication().messageBus.connect(this)
    conn.subscribe(LafManagerListener.TOPIC, object : LafManagerListener {
      override fun lookAndFeelChanged(source: LafManager) {
        updateTheme()
      }
    })
    conn.subscribe(
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
    val psi = PsiDocumentManager.getInstance(project).getPsiFile(document) as? YAMLFile ?: return
    val payload = ErdDataBuilder.build(psi, project)
    val s = DatabaseDiagramSettings.instance.state
    webviewPanel.updateSchemaPayload(
      payload, WebviewBridge.GlobalSettings(
        lineStyle = s.defaultLineStyle, showGrid = s.defaultShowGrid, gridSize = s.defaultGridSize,
        showTableNotes = s.showTableNotes, showFieldNotes = s.showFieldNotes,
        tableNoteMaxLines = s.tableNoteMaxLines, fieldNoteMaxLines = s.fieldNoteMaxLines,
      )
    )
  }

  private fun updateTheme() {
    if (isDisposed) return
    val t = when (DatabaseDiagramSettings.instance.state.defaultTheme) {
      "Light" -> "light"; "Dark" -> "dark"
      else -> if (!JBColor.isBright()) "dark" else "light"
    }
    webviewPanel.updateTheme(t)
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
    updateFile { ErdYamlUpdater.updateTablePosition(project, it, tableName, x, y, width) }
    ApplicationManager.getApplication()
      .invokeLater { if (pendingLayoutSaves > 0) pendingLayoutSaves-- }
  }

  override fun onNotePositionUpdated(name: String, x: Int, y: Int, width: Int, height: Int) {
    pendingLayoutSaves++
    updateFile { ErdYamlUpdater.updateNotePosition(project, it, name, x, y, width, height) }
    ApplicationManager.getApplication()
      .invokeLater { if (pendingLayoutSaves > 0) pendingLayoutSaves-- }
  }

  override fun onTableColorUpdated(tableName: String, color: String) {
    pendingLayoutSaves++
    updateFile { ErdYamlUpdater.updateTableColor(project, it, tableName, color) }
    ApplicationManager.getApplication()
      .invokeLater { if (pendingLayoutSaves > 0) pendingLayoutSaves-- }
  }

  override fun onNoteColorUpdated(noteId: String, color: String) {
    pendingLayoutSaves++
    updateFile { ErdYamlUpdater.updateNoteColor(project, it, noteId, color) }
    ApplicationManager.getApplication()
      .invokeLater { if (pendingLayoutSaves > 0) pendingLayoutSaves-- }
  }

  private fun updateFile(action: (YAMLFile) -> Unit) {
    if (isDisposed || project.isDisposed) return
    val doc = ApplicationManager.getApplication().runReadAction<Document?> {
      FileDocumentManager.getInstance().getDocument(file)
    } ?: return
    if (!file.isValid || !doc.isWritable) return
    val psi = PsiDocumentManager.getInstance(project).getPsiFile(doc) as? YAMLFile ?: return
    action(psi)
  }

  override fun setState(state: FileEditorState) {}
  override fun isModified() = false
  override fun isValid() = true
  override fun addPropertyChangeListener(listener: PropertyChangeListener) {}
  override fun removePropertyChangeListener(listener: PropertyChangeListener) {}
  override fun dispose() {
    isDisposed = true
  }
}