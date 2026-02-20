package com.puntbyte.dbd.editor

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
import com.intellij.ui.JBColor
import com.puntbyte.dbd.webview.WebviewPanel
import java.beans.PropertyChangeListener
import javax.swing.JComponent

class SchemaPreviewFileEditor(
  private val project: Project,
  private val file: VirtualFile
) : UserDataHolderBase(), FileEditor, WebviewPanel.WebviewListener {

  private val webviewPanel = WebviewPanel(this, file, this)
  private var isDisposed = false

  init {
    val connection = ApplicationManager.getApplication().messageBus.connect(this)
    connection.subscribe(LafManagerListener.TOPIC, LafManagerListener {
      updateTheme()
    })
  }

  override fun getComponent(): JComponent = webviewPanel.component
  override fun getPreferredFocusedComponent(): JComponent = webviewPanel.component
  override fun getName(): String = "DBML Preview"

  fun render(content: String) {
    if (isDisposed) return
    val format = file.extension ?: "dbml"
    webviewPanel.updateSchema(format, content)
  }

  private fun updateTheme() {
    if (isDisposed) return
    val isDark = !JBColor.isBright()
    val themeStr = if (isDark) "dark" else "light"
    webviewPanel.updateTheme(themeStr)
  }

  override fun onWebviewReady() {
    updateTheme()
  }

  // --- Synchronization Logic ---

  override fun onTablePositionUpdated(tableName: String, x: Int, y: Int, width: Int?) {
    val document = ApplicationManager.getApplication().runReadAction<Document?> {
      FileDocumentManager.getInstance().getDocument(file)
    } ?: return

    if (!ApplicationManager.getApplication().runReadAction<Boolean> { document.isWritable }) return

    WriteCommandAction.runWriteCommandAction(project) {
      try {
        updateTableSettings(document, tableName, x, y, width)
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
    val text = document.text

    // Regex matches schema.table, "schema"."table", etc.
    val parts = tableName.split(".")
    val escapedNameRegexPart = parts.joinToString(separator = "\\s*\\.\\s*") { part ->
      "\"?\\Q$part\\E\"?"
    }

    val tableRegex = Regex(
      """Table\s+($escapedNameRegexPart)\s*(?:as\s+\w+\s*)?(?:\[([\s\S]*?)])?\s*\{""",
      RegexOption.IGNORE_CASE
    )

    val match = tableRegex.find(text) ?: return

    val settingsBlock = match.groups[2]
    val hasSettings = settingsBlock != null

    fun updateSettingString(source: String): String {
      var newSettings = source

      fun replaceOrAppend(key: String, value: Any) {
        // Matches "key: 123", "key: -50"
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
      if (width != null && width > 0) {
        replaceOrAppend("width", width)
      }
      return newSettings
    }

    if (hasSettings) {
      val currentContent = settingsBlock!!.value
      val newContent = updateSettingString(currentContent)
      val range = settingsBlock.range
      document.replaceString(range.first, range.last + 1, newContent)
    } else {
      val insertIndex = match.groups[1]!!.range.last + 1
      val braceIndex = text.indexOf('{', insertIndex)
      if (braceIndex != -1) {
        val newBlock = " [${updateSettingString("")}] "
        document.insertString(braceIndex, newBlock)
      }
    }
  }

  override fun onProjectSettingsUpdated(settings: Map<String, String?>) {
    val document = ApplicationManager.getApplication().runReadAction<Document?> {
      FileDocumentManager.getInstance().getDocument(file)
    } ?: return

    if (!ApplicationManager.getApplication().runReadAction<Boolean> { document.isWritable }) return

    WriteCommandAction.runWriteCommandAction(project) {
      try {
        updateProjectBlock(document, settings, file.nameWithoutExtension)
      } catch (e: Exception) {
        e.printStackTrace()
      }
    }
  }

  private fun updateProjectBlock(
    document: Document,
    settings: Map<String, String?>,
    defaultProjectName: String?
  ) {
    val text = document.text

    // Regex: Project [optional_name] { ... }
    val projectRegex = Regex("""Project(?:\s+("?[^"{]*"?))?\s*\{([\s\S]*?)}""", RegexOption.IGNORE_CASE)
    val match = projectRegex.find(text)

    fun formatValue(v: String): String {
      return if (v.matches(Regex("^-?[\\d.]+$")) || v == "true" || v == "false") v
      else "'${v.replace("'", "\\'")}'"
    }

    if (match != null) {
      val bodyRange = match.groups[2]!!.range
      val body = match.groupValues[2]
      var newBody = body

      for ((key, value) in settings) {
        if (value == null) continue
        val formattedVal = formatValue(value)

        // Matches "key: value"
        val keyRegex = Regex("""(\b$key\s*:\s*)(.*)""")

        newBody = if (keyRegex.containsMatchIn(newBody)) {
          newBody.replace(keyRegex, "$1$formattedVal")
        } else {
          val prefix = if (newBody.trim().isEmpty()) "\n  " else "\n  "
          "$newBody$prefix$key: $formattedVal"
        }
      }
      document.replaceString(bodyRange.first, bodyRange.last + 1, newBody)

    } else {
      val sb = StringBuilder()
      val name = defaultProjectName?.let { " \"$it\"" } ?: ""
      sb.append("Project$name {\n")
      for ((key, value) in settings) {
        if (value != null) {
          sb.append("  $key: ${formatValue(value)}\n")
        }
      }
      sb.append("}\n\n")
      document.insertString(0, sb.toString())
    }
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