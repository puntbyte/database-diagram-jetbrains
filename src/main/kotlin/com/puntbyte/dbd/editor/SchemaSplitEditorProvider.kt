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
    return file.name.endsWith(".erd.yaml", ignoreCase = true)
  }

  override fun createEditor(project: Project, file: VirtualFile): FileEditor {
    return createEditorAsync(project, file).build()
  }

  override fun getEditorTypeId() = "erd-yaml-split-editor"
  override fun getPolicy() = FileEditorPolicy.HIDE_DEFAULT_EDITOR

  override fun createEditorAsync(
    project: Project,
    file: VirtualFile
  ): AsyncFileEditorProvider.Builder {
    return object : AsyncFileEditorProvider.Builder() {
      override fun build(): FileEditor {
        val textEditor =
          TextEditorProvider.getInstance().createEditor(project, file) as TextEditor
        val previewEditor = SchemaPreviewFileEditor(project, file)
        val updateAlarm = Alarm(Alarm.ThreadToUse.SWING_THREAD, previewEditor)
        val document = textEditor.editor.document

        document.addDocumentListener(object : DocumentListener {
          override fun documentChanged(event: DocumentEvent) {
            if (updateAlarm.isDisposed) return

            // FIX: When the webview sends a drag/resize position update the
            // IDE writes x/y/width back into the YAML.  That write fires this
            // document listener, which previously scheduled a full re-render
            // 300 ms later — causing the "settle" jump where every table
            // visually snapped to its rounded YAML coordinate right after the
            // user released the mouse.
            //
            // We skip the re-render entirely for layout-only saves. The webview
            // already has the correct positions; there is nothing new to send.
            if (previewEditor.pendingLayoutSaves > 0) return

            updateAlarm.cancelAllRequests()
            updateAlarm.addRequest({
              if (!previewEditor.isDisposed) {
                previewEditor.render(document)
              }
            }, 300)
          }
        }, previewEditor)

        previewEditor.render(document)

        return TextEditorWithPreview(
          textEditor,
          previewEditor,
          "ERD Editor",
          TextEditorWithPreview.Layout.SHOW_EDITOR_AND_PREVIEW
        )
      }
    }
  }
}