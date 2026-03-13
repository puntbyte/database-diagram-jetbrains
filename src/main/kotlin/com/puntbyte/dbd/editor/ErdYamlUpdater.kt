package com.puntbyte.dbd.editor

import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.project.Project
import com.intellij.psi.PsiFile
import org.jetbrains.yaml.YAMLElementGenerator
import org.jetbrains.yaml.psi.YAMLFile
import org.jetbrains.yaml.psi.YAMLMapping

object ErdYamlUpdater {

  fun updateTablePosition(
    project: Project,
    yamlFile: YAMLFile,
    tableName: String,
    x: Int,
    y: Int,
    width: Int?
  ) {
    WriteCommandAction.runWriteCommandAction(project) {
      val rootMapping = yamlFile.documents.firstOrNull()?.topLevelValue as? YAMLMapping
        ?: return@runWriteCommandAction
      val tablesMapping = getOrCreateMapping(project, rootMapping, "tables")
      val targetTableMapping = getOrCreateMapping(project, tablesMapping, tableName)

      updateKeyValue(project, targetTableMapping, "x", x.toString())
      updateKeyValue(project, targetTableMapping, "y", y.toString())
      if (width != null) {
        updateKeyValue(project, targetTableMapping, "width", width.toString())
      }
    }
  }

  fun updateNotePosition(
    project: Project,
    yamlFile: YAMLFile,
    noteName: String,
    x: Int,
    y: Int,
    width: Int,
    height: Int
  ) {
    // Look through notes array to find the right ID, or handle notes map.
    // Assuming your notes are in a dictionary/map similar to tables for easy lookup:
    WriteCommandAction.runWriteCommandAction(project) {
      val rootMapping = yamlFile.documents.firstOrNull()?.topLevelValue as? YAMLMapping
        ?: return@runWriteCommandAction
      val notesMapping = getOrCreateMapping(project, rootMapping, "notes")
      val targetNoteMapping = getOrCreateMapping(project, notesMapping, noteName)

      updateKeyValue(project, targetNoteMapping, "x", x.toString())
      updateKeyValue(project, targetNoteMapping, "y", y.toString())
      updateKeyValue(project, targetNoteMapping, "width", width.toString())
      updateKeyValue(project, targetNoteMapping, "height", height.toString())
    }
  }

  private fun getOrCreateMapping(
    project: Project,
    parentMapping: YAMLMapping,
    key: String
  ): YAMLMapping {
    val existingKeyValue = parentMapping.getKeyValueByKey(key)
    if (existingKeyValue != null) {
      val value = existingKeyValue.value
      if (value is YAMLMapping) return value
    }

    // If not exists, append a new mapping block
    val generator = YAMLElementGenerator.getInstance(project)
    val dummyFile = generator.createDummyYamlWithText("$key:\n  _dummy: value")
    val newMapping =
      (dummyFile.documents.first().topLevelValue as YAMLMapping).getKeyValueByKey(key)!!
    parentMapping.putKeyValue(newMapping)

    // Clean up dummy
    val addedMapping = parentMapping.getKeyValueByKey(key)!!.value as YAMLMapping
    addedMapping.getKeyValueByKey("_dummy")?.delete()

    return addedMapping
  }

  private fun updateKeyValue(project: Project, mapping: YAMLMapping, key: String, value: String) {
    val generator = YAMLElementGenerator.getInstance(project)
    val existing = mapping.getKeyValueByKey(key)

    if (existing != null) {
      val dummy = generator.createDummyYamlWithText("$key: $value")
      val newKv = (dummy.documents.first().topLevelValue as YAMLMapping).keyValues.first()
      existing.replace(newKv)
    } else {
      mapping.putKeyValue(generator.createYamlKeyValue(key, value))
    }
  }
}