package com.puntbyte.dbd.editor

import com.intellij.ide.ui.LafManager
import com.intellij.ide.ui.LafManagerListener
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.editor.Document
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileEditor
import com.intellij.openapi.fileEditor.FileEditorState
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.UserDataHolderBase
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.psi.PsiDocumentManager
import com.intellij.psi.util.PsiTreeUtil
import com.intellij.ui.JBColor
import com.puntbyte.dbd.settings.DatabaseDiagramSettings
import com.puntbyte.dbd.webview.WebviewPanel
import com.puntbyte.dbml.psi.DbmlId
import com.puntbyte.dbml.psi.DbmlStickyNoteDefinition
import com.puntbyte.dbml.psi.DbmlTableDefinition
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
  override fun getName(): String = "DBML Preview"

  private fun pushSettings(settings: DatabaseDiagramSettings.State) {
    webviewPanel.updateGlobalSettings(
      lineStyle = settings.defaultLineStyle,
      showGrid = settings.defaultShowGrid,
      gridSize = settings.defaultGridSize
    )
  }

  fun render(content: String) {
    if (isDisposed) return
    pushSettings(DatabaseDiagramSettings.instance.state)
    webviewPanel.updateSchema(format = file.extension ?: "dbml", content = content)
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
    pushSettings(DatabaseDiagramSettings.instance.state)
    ApplicationManager.getApplication().runReadAction {
      val document = FileDocumentManager.getInstance().getDocument(file)
      if (document != null) {
        webviewPanel.updateSchema(file.extension ?: "dbml", document.text)
      }
    }
  }

  // --- SYNCHRONIZATION LOGIC ---

  override fun onTablePositionUpdated(tableName: String, x: Int, y: Int, width: Int?) {
    updateFile { document -> updateTableSettings(document, tableName, x, y, width) }
  }

  override fun onNotePositionUpdated(name: String, x: Int, y: Int, width: Int, height: Int) {
    updateFile { document -> updateNoteSettings(document, name, x, y, width, height) }
  }

  private fun updateFile(action: (Document) -> Unit) {
    if (isDisposed || project.isDisposed) return
    val document = ApplicationManager.getApplication().runReadAction<Document?> {
      FileDocumentManager.getInstance().getDocument(file)
    } ?: return
    if (!file.isValid || !document.isWritable) return

    WriteCommandAction.runWriteCommandAction(project) {
      if (isDisposed || project.isDisposed) return@runWriteCommandAction
      try {
        action(document)
      } catch (e: Exception) {
        e.printStackTrace()
      }
    }
  }

  private fun updateTableSettings(
    document: Document,
    tableName: String,
    x: Int,
    y: Int,
    width: Int?
  ) {
    // 1. Force sync the PSI tree with the current document text
    val psiManager = PsiDocumentManager.getInstance(project)
    psiManager.commitDocument(document)
    val psiFile = psiManager.getPsiFile(document) ?: return

    // Normalize the target name from the webview (remove quotes and spaces)
    val normalizedTarget = tableName.replace("\"", "").replace("\\s+".toRegex(), "")

    // 2. Safely find the exact Table using the PSI Tree
    val tables = PsiTreeUtil.findChildrenOfType(psiFile, DbmlTableDefinition::class.java)
    val targetTable = tables.find { table ->
      // Use tableIdentifier to get the FULL 'schema.table' string.
      // nameIdentifier might only return 'table' if PsiImplUtil isn't fully configured.
      val rawParsedName = table.tableIdentifier?.text ?: table.nameIdentifier?.text ?: ""

      // Normalize the parsed name
      val normalizedParsed = rawParsedName.replace("\"", "").replace("\\s+".toRegex(), "")

      normalizedParsed == normalizedTarget
    } ?: return

    // 3. Target the AST nodes and replace them exactly
    WriteCommandAction.runWriteCommandAction(project) {
      val settingBlock = targetTable.settingBlock
      if (settingBlock != null) {
        val innerText = settingBlock.text.removeSurrounding("[", "]")
        val newContent = "[${updateTableSettingString(innerText, x, y, width)}]"
        document.replaceString(
          settingBlock.textRange.startOffset,
          settingBlock.textRange.endOffset,
          newContent
        )
      } else {
        val tableBlock = targetTable.tableBlock
        if (tableBlock != null) {
          val newContent = "[${updateTableSettingString("", x, y, width)}] "
          document.insertString(tableBlock.textRange.startOffset, newContent)
        }
      }
    }
  }

  private fun updateNoteSettings(
    document: Document,
    noteName: String,
    x: Int,
    y: Int,
    width: Int,
    height: Int
  ) {
    // 1. Force sync the PSI tree with the current document text
    val psiManager = PsiDocumentManager.getInstance(project)
    psiManager.commitDocument(document)
    val psiFile = psiManager.getPsiFile(document) ?: return

    // 2. Find the exact Note using PSI
    val notes = PsiTreeUtil.findChildrenOfType(psiFile, DbmlStickyNoteDefinition::class.java)
    val targetNote = notes.find { note ->
      val idElement = PsiTreeUtil.findChildOfType(note, DbmlId::class.java)
      idElement?.text?.replace("\"", "") == noteName
    } ?: return

    // 3. Target the AST nodes and replace them exactly
    val settingBlock = targetNote.settingBlock
    if (settingBlock != null) {
      val innerText = settingBlock.text.removeSurrounding("[", "]")
      val newContent = "[${updateNoteSettingString(innerText, x, y, width, height)}]"
      document.replaceString(
        settingBlock.textRange.startOffset,
        settingBlock.textRange.endOffset,
        newContent
      )
    } else {
      val noteBlock = targetNote.noteBlock
      if (noteBlock != null) {
        val newContent = "[${updateNoteSettingString("", x, y, width, height)}] "
        document.insertString(noteBlock.textRange.startOffset, newContent)
      }
    }
  }

  // --- STRING MANIPULATION HELPERS ---

  private fun updateTableSettingString(source: String, x: Int, y: Int, width: Int?): String {
    var newSettings = source
    fun replaceOrAppend(key: String, value: Any) {
      val keyRegex = Regex("""(\b$key\s*:\s*)([-\d.]+)""", RegexOption.IGNORE_CASE)
      newSettings = if (keyRegex.containsMatchIn(newSettings)) {
        newSettings.replace(keyRegex, "$1$value")
      } else {
        val trimmed = newSettings.trimEnd()
        val separator = if (trimmed.isNotEmpty() && !trimmed.endsWith(",")) ", " else ""
        val prefix = if (trimmed.isEmpty()) "" else separator
        "$trimmed$prefix$key: $value"
      }
    }
    replaceOrAppend("x", x)
    replaceOrAppend("y", y)
    if (width != null) replaceOrAppend("width", width)
    return newSettings
  }

  private fun updateNoteSettingString(
    source: String,
    x: Int,
    y: Int,
    width: Int,
    height: Int
  ): String {
    var newSettings = source
    fun replaceOrAppend(key: String, value: Any) {
      val keyRegex = Regex("""(\b$key\s*:\s*)([-\d.]+)""", RegexOption.IGNORE_CASE)
      newSettings = if (keyRegex.containsMatchIn(newSettings)) {
        newSettings.replace(keyRegex, "$1$value")
      } else {
        val trimmed = newSettings.trimEnd()
        val separator = if (trimmed.isNotEmpty() && !trimmed.endsWith(",")) ", " else ""
        val prefix = if (trimmed.isEmpty()) "" else separator
        "$trimmed$prefix$key: $value"
      }
    }
    replaceOrAppend("x", x)
    replaceOrAppend("y", y)
    replaceOrAppend("width", width)
    replaceOrAppend("height", height)
    return newSettings
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