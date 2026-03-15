package com.puntbyte.dbd.editor

import com.intellij.openapi.editor.Document
import com.intellij.openapi.editor.event.DocumentEvent
import com.intellij.openapi.editor.event.DocumentListener
import com.intellij.openapi.fileEditor.*
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.impl.text.TextEditorProvider
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.util.Alarm
import com.puntbyte.dbd.settings.DatabaseDiagramSettings
import org.jetbrains.yaml.psi.YAMLFile
import org.jetbrains.yaml.psi.YAMLMapping
import org.jetbrains.yaml.psi.YAMLSequence
import com.intellij.openapi.application.ApplicationManager
import com.intellij.psi.PsiDocumentManager

class SchemaSplitEditorProvider : AsyncFileEditorProvider, DumbAware {

  override fun accept(project: Project, file: VirtualFile): Boolean =
    file.name.endsWith(".erd.yaml", ignoreCase = true)

  override fun createEditor(project: Project, file: VirtualFile): FileEditor =
    createEditorAsync(project, file).build()

  override fun getEditorTypeId() = "erd-yaml-split-editor"
  override fun getPolicy()       = FileEditorPolicy.HIDE_DEFAULT_EDITOR

  override fun createEditorAsync(project: Project, file: VirtualFile): AsyncFileEditorProvider.Builder {
    return object : AsyncFileEditorProvider.Builder() {
      override fun build(): FileEditor {
        val textEditor    = TextEditorProvider.getInstance().createEditor(project, file) as TextEditor
        val previewEditor = SchemaPreviewFileEditor(project, file)
        val updateAlarm   = Alarm(Alarm.ThreadToUse.SWING_THREAD, previewEditor)
        val yamlDocument  = textEditor.editor.document

        // Helper: schedule a debounced re-render.
        fun scheduleRender(delayMs: Int = 400) {
          if (updateAlarm.isDisposed || previewEditor.isDisposed) return
          if (previewEditor.pendingLayoutSaves > 0) return
          updateAlarm.cancelAllRequests()
          updateAlarm.addRequest({ if (!previewEditor.isDisposed) previewEditor.render(yamlDocument) }, delayMs)
        }

        // ── 1. Watch the .erd.yaml file (unchanged) ──────────────────────────
        yamlDocument.addDocumentListener(object : DocumentListener {
          override fun documentChanged(event: DocumentEvent) = scheduleRender(300)
        }, previewEditor)

        // ── 2. Watch imported SQL files for live updates ──────────────────────
        //
        // BulkFileListener (VFS events) only fires on file-save, so edits in
        // an open editor tab that haven't been saved yet don't trigger a redraw.
        //
        // The correct approach: after each render we scan the YAML `schema.imports`
        // list to find which SQL VirtualFiles are referenced, obtain their
        // in-memory `Document` objects via FileDocumentManager, and attach a
        // `DocumentListener` to each.  The listener is registered on a shared
        // Alarm with a 500ms debounce so rapid typing doesn't spam renders.
        //
        // `sqlListenerKey` tracks which documents already have a listener so
        // we don't register duplicates when `render()` is called multiple times.
        val sqlListenerKey = mutableSetOf<Document>()

        fun attachSqlListeners() {
          ApplicationManager.getApplication().runReadAction {
            val psiFile = PsiDocumentManager.getInstance(project)
              .getPsiFile(yamlDocument) as? YAMLFile ?: return@runReadAction

            val root = psiFile.documents.firstOrNull()?.topLevelValue
                as? YAMLMapping ?: return@runReadAction

            val imports = (
                (root.getKeyValueByKey("schema")?.value as? YAMLMapping)
                  ?.getKeyValueByKey("imports")?.value as? YAMLSequence
                )?.items?.mapNotNull { it.value?.text?.removeSurrounding("\"") }
              ?: return@runReadAction

            val baseDir = file.parent ?: return@runReadAction

            for (importPath in imports) {
              val sqlVf = baseDir.findFileByRelativePath(importPath) ?: continue
              val sqlDoc = FileDocumentManager.getInstance().getDocument(sqlVf) ?: continue

              if (sqlDoc in sqlListenerKey) continue  // already attached
              sqlListenerKey.add(sqlDoc)

              sqlDoc.addDocumentListener(object : DocumentListener {
                override fun documentChanged(event: DocumentEvent) = scheduleRender(500)
              }, previewEditor)
              // `previewEditor` is the parent Disposable — when the preview tab
              // closes, all listeners registered on it are automatically removed.
            }
          }
        }

        // Attach listeners for the initial set of imports after the first render.
        // We wrap in invokeLater so the YAML PSI is fully committed first.
        ApplicationManager.getApplication().invokeLater { attachSqlListeners() }

        // Re-attach whenever the YAML itself changes (imports may have changed).
        // A short delay ensures PSI is committed before we scan again.
        yamlDocument.addDocumentListener(object : DocumentListener {
          override fun documentChanged(event: DocumentEvent) {
            ApplicationManager.getApplication().invokeLater { attachSqlListeners() }
          }
        }, previewEditor)

        previewEditor.render(yamlDocument)

        val layout = when (DatabaseDiagramSettings.instance.state.defaultEditorLayout) {
          DatabaseDiagramSettings.EditorLayout.EDITOR_ONLY         -> TextEditorWithPreview.Layout.SHOW_EDITOR
          DatabaseDiagramSettings.EditorLayout.PREVIEW_ONLY        -> TextEditorWithPreview.Layout.SHOW_PREVIEW
          DatabaseDiagramSettings.EditorLayout.EDITOR_AND_PREVIEW  -> TextEditorWithPreview.Layout.SHOW_EDITOR_AND_PREVIEW
        }

        return TextEditorWithPreview(textEditor, previewEditor, "ERD Editor", layout)
      }
    }
  }
}