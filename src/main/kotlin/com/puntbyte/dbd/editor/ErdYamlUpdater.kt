package com.puntbyte.dbd.editor

import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.project.Project
import org.jetbrains.yaml.YAMLElementGenerator
import org.jetbrains.yaml.psi.YAMLFile
import org.jetbrains.yaml.psi.YAMLMapping
import org.jetbrains.yaml.psi.YAMLSequence

object ErdYamlUpdater {

  // ── Table position ─────────────────────────────────────────────────────────

  fun updateTablePosition(
    project: Project, yamlFile: YAMLFile,
    tableName: String, x: Int, y: Int, width: Int?
  ) {
    WriteCommandAction.runWriteCommandAction(project) {
      val root = root(yamlFile) ?: return@runWriteCommandAction
      val table =
        getOrCreateMapping(project, getOrCreateMapping(project, root, "tables"), tableName)
      setScalar(project, table, "x", x.toString())
      setScalar(project, table, "y", y.toString())
      if (width != null) setScalar(project, table, "width", width.toString())
    }
  }

  // ── Table color ────────────────────────────────────────────────────────────

  fun updateTableColor(
    project: Project, yamlFile: YAMLFile,
    tableName: String, color: String
  ) {
    WriteCommandAction.runWriteCommandAction(project) {
      val root = root(yamlFile) ?: return@runWriteCommandAction
      val table =
        getOrCreateMapping(project, getOrCreateMapping(project, root, "tables"), tableName)
      setScalar(project, table, "color", "\"$color\"")
    }
  }

  // ── Note position ──────────────────────────────────────────────────────────
  //
  // Notes are a YAML sequence, not a mapping.  We find the item by its `id` key.

  fun updateNotePosition(
    project: Project, yamlFile: YAMLFile,
    noteName: String, x: Int, y: Int, width: Int, height: Int
  ) {
    WriteCommandAction.runWriteCommandAction(project) {
      val noteMapping = findNoteMapping(yamlFile, noteName) ?: return@runWriteCommandAction
      setScalar(project, noteMapping, "x", x.toString())
      setScalar(project, noteMapping, "y", y.toString())
      setScalar(project, noteMapping, "width", width.toString())
      setScalar(project, noteMapping, "height", height.toString())
    }
  }

  // ── Note color ─────────────────────────────────────────────────────────────

  fun updateNoteColor(
    project: Project, yamlFile: YAMLFile,
    noteId: String, color: String
  ) {
    WriteCommandAction.runWriteCommandAction(project) {
      val noteMapping = findNoteMapping(yamlFile, noteId) ?: return@runWriteCommandAction
      setScalar(project, noteMapping, "color", "\"$color\"")
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Find the YAMLMapping for a note item by its `id` value. */
  private fun findNoteMapping(yamlFile: YAMLFile, noteId: String): YAMLMapping? {
    val root = root(yamlFile) ?: return null
    val seq = root.getKeyValueByKey("notes")?.value as? YAMLSequence ?: return null
    return seq.items
      .mapNotNull { it.value as? YAMLMapping }
      .firstOrNull { it.getKeyValueByKey("id")?.valueText?.removeSurrounding("\"") == noteId }
  }

  private fun root(yamlFile: YAMLFile): YAMLMapping? =
    yamlFile.documents.firstOrNull()?.topLevelValue as? YAMLMapping

  private fun getOrCreateMapping(
    project: Project, parent: YAMLMapping, key: String
  ): YAMLMapping {
    val existing = parent.getKeyValueByKey(key)
    if (existing != null) {
      val v = existing.value
      if (v is YAMLMapping) return v
      throw IllegalStateException("YAML key '$key' is not a mapping — refusing to overwrite it.")
    }
    val gen = YAMLElementGenerator.getInstance(project)
    val dummy = gen.createDummyYamlWithText("$key:\n  _dummy: value")
    parent.putKeyValue(
      (dummy.documents.first().topLevelValue as YAMLMapping).getKeyValueByKey(key)!!
    )
    val added = parent.getKeyValueByKey(key)!!.value as YAMLMapping
    added.getKeyValueByKey("_dummy")?.delete()
    return added
  }

  private fun setScalar(project: Project, mapping: YAMLMapping, key: String, value: String) {
    val gen = YAMLElementGenerator.getInstance(project)
    val existing = mapping.getKeyValueByKey(key)
    if (existing != null) {
      val dummy = gen.createDummyYamlWithText("$key: $value")
      existing.replace(
        (dummy.documents.first().topLevelValue as YAMLMapping).keyValues.first()
      )
    } else {
      mapping.putKeyValue(gen.createYamlKeyValue(key, value))
    }
  }
}