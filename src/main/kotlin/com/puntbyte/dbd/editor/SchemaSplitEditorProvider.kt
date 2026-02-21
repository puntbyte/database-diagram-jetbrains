package com.puntbyte.dbd.editor

import com.intellij.openapi.editor.event.DocumentEvent
import com.intellij.openapi.editor.event.DocumentListener
import com.intellij.openapi.fileEditor.*
import com.intellij.openapi.fileEditor.impl.text.TextEditorProvider
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.util.Alarm

class SchemaSplitEditorProvider : AsyncFileEditorProvider, DumbAware {

  override fun accept(project: Project, file: VirtualFile): Boolean {
    return file.extension.equals("dbml", ignoreCase = true)
  }

  override fun createEditor(project: Project, file: VirtualFile): FileEditor {
    return createEditorAsync(project, file).build()
  }

  override fun getEditorTypeId() = "dbml-split-editor"
  override fun getPolicy() = FileEditorPolicy.HIDE_DEFAULT_EDITOR

  override fun createEditorAsync(
    project: Project,
    file: VirtualFile
  ): AsyncFileEditorProvider.Builder {
    return object : AsyncFileEditorProvider.Builder() {
      override fun build(): FileEditor {
        // 1. Create Editors
        val textEditor = TextEditorProvider.getInstance().createEditor(project, file) as TextEditor
        val previewEditor = SchemaPreviewFileEditor(project, file)

        // 2. Setup Debouncer (Alarm) attached to the previewEditor's lifecycle
        val updateAlarm = Alarm(Alarm.ThreadToUse.SWING_THREAD, previewEditor)

        // 3. Document Listener
        val document = textEditor.editor.document

        // CRITICAL FIX: Pass 'previewEditor' as the second argument (parentDisposable).
        // IntelliJ will automatically remove this listener when previewEditor is disposed.
        document.addDocumentListener(object : DocumentListener {
          override fun documentChanged(event: DocumentEvent) {
            // Extra defensive check
            if (updateAlarm.isDisposed) return

            updateAlarm.cancelAllRequests()
            updateAlarm.addRequest({
              // Ensure we don't try to render if the editor died during the delay
              if (!previewEditor.isDisposed) {
                previewEditor.render(document.text)
              }
            }, 300)
          }
        }, previewEditor)

        // 4. Initial Render
        previewEditor.render(document.text)

        return TextEditorWithPreview(
          textEditor,
          previewEditor,
          "DBML Editor",
          TextEditorWithPreview.Layout.SHOW_EDITOR_AND_PREVIEW
        )
      }
    }
  }
}