package com.puntbyte.dbd.editor

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.editor.Document
import com.intellij.openapi.editor.event.DocumentEvent
import com.intellij.openapi.editor.event.DocumentListener
import com.intellij.openapi.fileEditor.*
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.impl.text.TextEditorProvider
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.psi.PsiDocumentManager
import com.intellij.util.Alarm
import com.puntbyte.dbd.settings.DatabaseDiagramSettings
import org.jetbrains.yaml.psi.YAMLFile
import org.jetbrains.yaml.psi.YAMLMapping
import org.jetbrains.yaml.psi.YAMLSequence

class SchemaSplitEditorProvider : AsyncFileEditorProvider, DumbAware {

  override fun accept(project: Project, file: VirtualFile): Boolean =
    file.name.endsWith(".erd.yaml", ignoreCase = true)

  override fun createEditor(project: Project, file: VirtualFile): FileEditor =
    createEditorAsync(project, file).build()

  override fun getEditorTypeId() = "erd-yaml-split-editor"
  override fun getPolicy() = FileEditorPolicy.HIDE_DEFAULT_EDITOR

  override fun createEditorAsync(
    project: Project,
    file: VirtualFile
  ): AsyncFileEditorProvider.Builder {
    return object : AsyncFileEditorProvider.Builder() {
      override fun build(): FileEditor {
        val textEditor = TextEditorProvider.getInstance().createEditor(project, file) as TextEditor
        val previewEditor = SchemaPreviewFileEditor(project, file)
        val updateAlarm = Alarm(Alarm.ThreadToUse.SWING_THREAD, previewEditor)
        val yamlDocument = textEditor.editor.document

        val attachedSqlDocs = mutableSetOf<Document>()

        // ── Debounced render ─────────────────────────────────────────────────
        fun scheduleRender(delayMs: Int = 400) {
          if (updateAlarm.isDisposed || previewEditor.isDisposed) return
          if (previewEditor.pendingLayoutSaves > 0) return
          updateAlarm.cancelAllRequests()
          updateAlarm.addRequest({
            if (!previewEditor.isDisposed) previewEditor.render(yamlDocument)
          }, delayMs)
        }

        // ── Attach DocumentListeners to imported SQL files ───────────────────
        fun attachSqlListeners() {
          PsiDocumentManager.getInstance(project).performLaterWhenAllCommitted {
            if (previewEditor.isDisposed) return@performLaterWhenAllCommitted
            ApplicationManager.getApplication().runReadAction {
              val psi = PsiDocumentManager.getInstance(project)
                .getPsiFile(yamlDocument) as? YAMLFile ?: return@runReadAction
              val root = psi.documents.firstOrNull()?.topLevelValue
                  as? YAMLMapping ?: return@runReadAction
              val imports = ((root.getKeyValueByKey("schema")?.value as? YAMLMapping)
                ?.getKeyValueByKey("imports")?.value as? YAMLSequence)
                ?.items?.mapNotNull { it.value?.text?.removeSurrounding("\"") }
                ?: return@runReadAction
              val baseDir = file.parent ?: return@runReadAction
              for (importPath in imports) {
                val sqlVf = baseDir.findFileByRelativePath(importPath) ?: continue
                val sqlDoc = FileDocumentManager.getInstance().getDocument(sqlVf) ?: continue
                if (sqlDoc in attachedSqlDocs) continue
                attachedSqlDocs.add(sqlDoc)
                sqlDoc.addDocumentListener(object : DocumentListener {
                  override fun documentChanged(event: DocumentEvent) = scheduleRender(500)
                }, previewEditor)
              }
            }
          }
        }

        // ── Watch the .erd.yaml text ─────────────────────────────────────────
        yamlDocument.addDocumentListener(object : DocumentListener {
          override fun documentChanged(event: DocumentEvent) {
            scheduleRender(300)
            attachSqlListeners()   // re-scan in case imports changed
          }
        }, previewEditor)

        // Attach SQL listeners once at startup (PSI may not be committed yet
        // so we use performLaterWhenAllCommitted).
        attachSqlListeners()

        // FIX: Do NOT call previewEditor.render(yamlDocument) here.
        //
        // The previous code called render() eagerly in build(), but
        // WebviewPanel defers browser creation to StartupManager.runAfterOpened.
        // The render() call happened before the browser existed, so the
        // schema payload was either queued and sent before the page loaded
        // (and therefore dropped), or never sent at all.
        //
        // The correct sequence is:
        //   build() → WebviewPanel defers browser init
        //   browser loads → JS sends READY → onWebviewReady() fires
        //   onWebviewReady() calls render() ← the single authoritative render
        //
        // All subsequent renders are triggered by document changes via the
        // listeners above.

        val layout = when (DatabaseDiagramSettings.instance.state.defaultEditorLayout) {
          DatabaseDiagramSettings.EditorLayout.EDITOR_ONLY -> TextEditorWithPreview.Layout.SHOW_EDITOR
          DatabaseDiagramSettings.EditorLayout.PREVIEW_ONLY -> TextEditorWithPreview.Layout.SHOW_PREVIEW
          DatabaseDiagramSettings.EditorLayout.EDITOR_AND_PREVIEW -> TextEditorWithPreview.Layout.SHOW_EDITOR_AND_PREVIEW
        }

        return TextEditorWithPreview(textEditor, previewEditor, "ERD Editor", layout)
      }
    }
  }
}