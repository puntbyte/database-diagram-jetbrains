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
  var isDisposed = false
    private set

  // FIX: Track whether the current document change was triggered by the webview
  // saving a layout position (drag/resize).  When true the document listener in
  // SchemaSplitEditorProvider must skip the re-render so the diagram does not
  // flash or "settle" back to a slightly-rounded position right after the user
  // drops a table.
  //
  // We use a counter instead of a boolean so that rapid back-to-back saves
  // (e.g. multi-column composite FK writes) are handled correctly.
  @Volatile
  var pendingLayoutSaves = 0
    private set

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
            pushSettings(settings)
            updateTheme()
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
      gridSize = settings.defaultGridSize
    )
  }

  fun render(document: Document) {
    if (isDisposed) return

    val psiManager = PsiDocumentManager.getInstance(project)
    val psiFile = psiManager.getPsiFile(document) as? YAMLFile ?: return

    val payload = ErdDataBuilder.build(psiFile, project)

    val settings = DatabaseDiagramSettings.instance.state
    val globalSettings = WebviewBridge.GlobalSettings(
      lineStyle = settings.defaultLineStyle,
      showGrid = settings.defaultShowGrid,
      gridSize = settings.defaultGridSize
    )

    webviewPanel.updateSchemaPayload(payload, globalSettings)
  }

  private fun updateTheme() {
    if (isDisposed) return
    val globalTheme = DatabaseDiagramSettings.instance.state.defaultTheme
    val themeStr = when (globalTheme) {
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
      val document = FileDocumentManager.getInstance().getDocument(file)
      if (document != null) {
        render(document)
      }
    }
  }

  override fun onTablePositionUpdated(tableName: String, x: Int, y: Int, width: Int?) {
    // FIX: Increment the counter BEFORE the write so the document listener
    // sees it in time, then decrement via invokeLater which runs after the
    // document change event has been dispatched on the EDT.
    pendingLayoutSaves++
    updateFile { document ->
      val psiFile = PsiDocumentManager.getInstance(project).getPsiFile(document) as? YAMLFile
        ?: return@updateFile
      ErdYamlUpdater.updateTablePosition(project, psiFile, tableName, x, y, width)
    }
    ApplicationManager.getApplication().invokeLater {
      if (pendingLayoutSaves > 0) pendingLayoutSaves--
    }
  }

  override fun onNotePositionUpdated(name: String, x: Int, y: Int, width: Int, height: Int) {
    pendingLayoutSaves++
    updateFile { document ->
      val psiFile = PsiDocumentManager.getInstance(project).getPsiFile(document) as? YAMLFile
        ?: return@updateFile
      ErdYamlUpdater.updateNotePosition(project, psiFile, name, x, y, width, height)
    }
    ApplicationManager.getApplication().invokeLater {
      if (pendingLayoutSaves > 0) pendingLayoutSaves--
    }
  }

  private fun updateFile(action: (Document) -> Unit) {
    if (isDisposed || project.isDisposed) return
    val document = ApplicationManager.getApplication().runReadAction<Document?> {
      FileDocumentManager.getInstance().getDocument(file)
    } ?: return
    if (!file.isValid || !document.isWritable) return

    action(document)
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