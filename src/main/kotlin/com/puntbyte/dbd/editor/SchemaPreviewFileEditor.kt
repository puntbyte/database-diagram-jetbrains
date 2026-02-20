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
        // Ensure we are working on a valid, writable document
        val document = FileDocumentManager.getInstance().getDocument(file) ?: return
        if (!document.isWritable) return

        WriteCommandAction.runWriteCommandAction(project) {
            try {
                updateTableSettings(document, tableName, x, y, width)
            } catch (e: Exception) {
                // Log but don't crash the editor
                e.printStackTrace()
            }
        }
    }

    private fun updateTableSettings(document: Document, tableName: String, x: Int, y: Int, width: Int?) {
        val text = document.text
        val escapedName = Regex.escape(tableName)

        // 1. Regex to find the table block.
        // [\s\S]*? matches newlines inside the [...] block, fixing the "no update" issue.
        val tableRegex = Regex("""Table\s+("?$escapedName"?)\s*(?:\[([\s\S]*?)]\s*)?\{""", RegexOption.IGNORE_CASE)
        val match = tableRegex.find(text) ?: return

        val hasSettings = match.groups[2] != null
        val existingSettings = match.groupValues[2]

        // 2. Helper to replace a value specifically, or return null if key missing
        fun replaceValue(source: String, key: String, newValue: Int): String {
            val keyRegex = Regex("""(\b$key\s*:\s*)(\d+)""", RegexOption.IGNORE_CASE)
            return if (keyRegex.containsMatchIn(source)) {
                source.replace(keyRegex, "$1$newValue")
            } else {
                // Append if not found
                val prefix = if (source.isBlank()) "" else ", "
                "$source$prefix$key: $newValue"
            }
        }

        if (hasSettings) {
            // --- Modify Existing Settings Block ---
            var newSettings = existingSettings
            newSettings = replaceValue(newSettings, "x", x)
            newSettings = replaceValue(newSettings, "y", y)

            if (width != null && width > 0) {
                newSettings = replaceValue(newSettings, "width", width)
            }

            // Replace only the settings content range
            val range = match.groups[2]!!.range
            document.replaceString(range.first, range.last + 1, newSettings)

        } else {
            // --- Create New Settings Block ---
            var newBlock = "x: $x, y: $y"
            if (width != null && width > 0) {
                newBlock += ", width: $width"
            }

            // Insert before the '{'
            // We use range.last which points to '{' (or whitespace before it depending on capture)
            // Safest way: Find the last '{' in the match range
            val openBraceIndex = text.lastIndexOf('{', match.range.last)
            if (openBraceIndex != -1) {
                document.insertString(openBraceIndex, " [$newBlock] ")
            }
        }
    }

    override fun setState(state: FileEditorState) {}
    override fun isModified(): Boolean = false
    override fun isValid(): Boolean = true
    override fun addPropertyChangeListener(listener: PropertyChangeListener) {}
    override fun removePropertyChangeListener(listener: PropertyChangeListener) {}
    override fun dispose() { isDisposed = true }
}