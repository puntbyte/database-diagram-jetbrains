package com.puntbyte.dbd.actions

import com.intellij.icons.AllIcons
import com.intellij.ide.actions.CreateFileFromTemplateAction
import com.intellij.ide.actions.CreateFileFromTemplateDialog
import com.intellij.ide.fileTemplates.FileTemplate
import com.intellij.ide.fileTemplates.FileTemplateManager
import com.intellij.ide.fileTemplates.FileTemplateUtil
import com.intellij.openapi.project.Project
import com.intellij.psi.PsiDirectory
import com.intellij.psi.PsiFile

/**
 * "New → ERD Diagram (.erd.yaml)"
 *
 * We override `createFileFromTemplate` directly instead of using
 * `getDefaultExtension()` (which does not exist on this base class).
 * The override appends ".erd.yaml" to the user-supplied name so the
 * file name is e.g. "my_schema.erd.yaml", which is required for
 * SchemaSplitEditorProvider.accept() to recognise it.
 */
class NewErdYamlAction : CreateFileFromTemplateAction(
  "ERD Diagram",
  "Create a new ERD layout file (.erd.yaml)",
  AllIcons.FileTypes.Yaml
) {

  override fun buildDialog(
    project: Project,
    directory: PsiDirectory,
    builder: CreateFileFromTemplateDialog.Builder
  ) {
    builder
      .setTitle("New ERD Diagram")
      .addKind("ERD layout file (.erd.yaml)", AllIcons.FileTypes.Yaml, "ErdYaml")
  }

  override fun getActionName(
    directory: PsiDirectory,
    newName: String,
    templateName: String
  ): String = "Create ERD Diagram '$newName'"

  /**
   * Override to control the final file name.
   * The base class passes `fileName` as just the user-typed name (no extension).
   * We append ".erd.yaml" before delegating to FileTemplateUtil.
   */
  override fun createFileFromTemplate(
    name: String,
    template: FileTemplate,
    dir: PsiDirectory
  ): PsiFile? {
    // Append extension only if not already present (prevents double-extension
    // if the user typed the extension themselves).
    val fileName = if (name.endsWith(".erd.yaml")) name else "$name.erd.yaml"

    val project    = dir.project
    val properties = FileTemplateManager.getInstance(project).defaultProperties
    properties.setProperty("NAME", name.removeSuffix(".erd.yaml"))

    return FileTemplateUtil.createFromTemplate(template, fileName, properties, dir) as? PsiFile
  }
}