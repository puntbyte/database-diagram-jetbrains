package com.puntbyte.dbd.editor

import com.intellij.openapi.fileEditor.*
import com.intellij.openapi.fileEditor.impl.text.TextEditorProvider
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.util.Alarm

class SchemaSplitEditorProvider : AsyncFileEditorProvider, DumbAware {

  override fun accept(project: Project, file: VirtualFile): Boolean {
    // Look purely at the file extension.
    // Now it works regardless of which plugin provides the DBML FileType!
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
        val textEditor =
          TextEditorProvider.getInstance().createEditor(project, file) as TextEditor
        val previewEditor = SchemaPreviewFileEditor(project, file)

        // 2. Setup Debouncer (Alarm)
        val updateAlarm = Alarm(Alarm.ThreadToUse.SWING_THREAD, previewEditor)

        // 3. Document Listener
        val document = textEditor.editor.document
        document.addDocumentListener(object :
          com.intellij.openapi.editor.event.DocumentListener {
          override fun documentChanged(event: com.intellij.openapi.editor.event.DocumentEvent) {
            updateAlarm.cancelAllRequests()
            updateAlarm.addRequest({
              previewEditor.render(document.text)
            }, 300)
          }
        })

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