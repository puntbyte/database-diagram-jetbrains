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
        val textEditor = TextEditorProvider.getInstance().createEditor(project, file) as TextEditor
        val previewEditor = SchemaPreviewFileEditor(project, file)
        val updateAlarm = Alarm(Alarm.ThreadToUse.SWING_THREAD, previewEditor)
        val document = textEditor.editor.document

        // Important: Bind listener to previewEditor lifecycle
        document.addDocumentListener(object : DocumentListener {
          override fun documentChanged(event: DocumentEvent) {
            if (updateAlarm.isDisposed) return
            updateAlarm.cancelAllRequests()
            updateAlarm.addRequest({
              if (!previewEditor.isDisposed) {
                previewEditor.render(document.text)
              }
            }, 300)
          }
        }, previewEditor)

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