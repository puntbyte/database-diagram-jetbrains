package com.puntbyte.dbd.builders

import com.intellij.openapi.project.Project
import com.intellij.psi.PsiComment
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiManager
import com.intellij.psi.PsiWhiteSpace
import com.intellij.psi.util.PsiTreeUtil
import com.intellij.sql.psi.SqlColumnDefinition
import com.intellij.sql.psi.SqlTableDefinition
import com.puntbyte.dbd.webview.WebviewBridge.*
import org.jetbrains.yaml.psi.YAMLFile
import org.jetbrains.yaml.psi.YAMLMapping
import org.jetbrains.yaml.psi.YAMLSequence

object ErdDataBuilder {

  // Matches:  REFERENCES users(id)
  //           REFERENCES "public"."users"
  //           REFERENCES orders
  private val REFERENCES_REGEX = Regex(
    """REFERENCES\s+(?:"?\w+"?\.)?"?(\w+)"?\s*(?:\(\s*"?(\w+)"?\s*\))?""",
    RegexOption.IGNORE_CASE
  )

  fun build(yamlFile: YAMLFile, project: Project): SchemaPayload {
    val rootMapping = yamlFile.documents.firstOrNull()?.topLevelValue as? YAMLMapping
      ?: return SchemaPayload(emptyList(), emptyList(), DbProject(), emptyList())

    val imports = extractImports(rootMapping)
    val dbTables = mutableListOf<DbTable>()
    val relationships = mutableListOf<DbRelationship>()

    val baseDir = yamlFile.virtualFile.parent

    // ── Pass 1: collect each table's actual primary-key column name ────────
    // Needed so bare REFERENCES orders (no explicit column) resolves to the
    // table's real PK instead of always guessing "id".
    val tablePrimaryKeys = mutableMapOf<String, String>()

    for (importPath in imports) {
      val sqlVirtualFile = baseDir.findFileByRelativePath(importPath) ?: continue
      val sqlPsiFile = PsiManager.getInstance(project).findFile(sqlVirtualFile) ?: continue

      PsiTreeUtil.findChildrenOfType(sqlPsiFile, SqlTableDefinition::class.java)
        .forEach { tableDef ->
          val name = tableDef.name ?: return@forEach
          val pk = PsiTreeUtil.findChildrenOfType(tableDef, SqlColumnDefinition::class.java)
            .firstOrNull { it.text.contains("PRIMARY KEY", ignoreCase = true) }?.name
          if (pk != null) tablePrimaryKeys[name] = pk
        }
    }

    // ── Pass 2: build tables + infer FK relationships from SQL ─────────────
    for (importPath in imports) {
      val sqlVirtualFile = baseDir.findFileByRelativePath(importPath) ?: continue
      val sqlPsiFile = PsiManager.getInstance(project).findFile(sqlVirtualFile) ?: continue

      for (tableDef in PsiTreeUtil.findChildrenOfType(sqlPsiFile, SqlTableDefinition::class.java)) {
        val tableName = tableDef.name ?: continue
        val tableComment = extractDocComment(tableDef)
        val fields = mutableListOf<DbField>()

        for (column in PsiTreeUtil.findChildrenOfType(tableDef, SqlColumnDefinition::class.java)) {
          val colName = column.name ?: continue
          val colText = column.text
          val isPk = colText.contains("PRIMARY KEY", ignoreCase = true)
          val isFk = colText.contains("REFERENCES", ignoreCase = true)

          fields.add(
            DbField(
              name = colName,
              isPrimaryKey = isPk,
              isForeignKey = isFk,
              isUnique = colText.contains("UNIQUE", ignoreCase = true) || isPk,
              isNotNull = column.isNotNull || isPk,
              type = column.dasType.toDataType().typeName,
              note = extractDocComment(column)
            )
          )

          if (isFk) {
            val match = REFERENCES_REGEX.find(colText)
            if (match != null) {
              val refTable = match.groupValues[1]
              val refCol = match.groupValues[2].ifEmpty { tablePrimaryKeys[refTable] ?: "id" }
              relationships.add(
                DbRelationship(
                  fromSchema = "public", fromTable = tableName, fromColumns = listOf(colName),
                  toSchema = "public", toTable = refTable, toColumns = listOf(refCol),
                  type = "n:1"
                )
              )
            }
          }
        }

        dbTables.add(
          DbTable(
            id = tableName, schema = "public", name = tableName,
            fields = fields, note = tableComment
          )
        )
      }
    }

    // ── Merge YAML visual properties (x, y, width, color) ─────────────────
    val tablesMapping = rootMapping.getKeyValueByKey("tables")?.value as? YAMLMapping
    if (tablesMapping != null) {
      for (i in dbTables.indices) {
        val t = dbTables[i]
        val lm = tablesMapping.getKeyValueByKey(t.id)?.value as? YAMLMapping ?: continue
        dbTables[i] = t.copy(
          horizontal = lm.getKeyValueByKey("x")?.valueText?.toIntOrNull(),
          vertical = lm.getKeyValueByKey("y")?.valueText?.toIntOrNull(),
          width = lm.getKeyValueByKey("width")?.valueText?.toIntOrNull(),
          color = lm.getKeyValueByKey("color")?.valueText
        )
      }
    }

    // ── Merge / override relationships from YAML ───────────────────────────
    // The YAML `relationships` block lets users:
    //   - Override an inferred FK relationship with explicit anchor sides.
    //   - Add virtual/display-only links that don't exist in the SQL.
    //   - Attach way_points for manual line routing.
    //
    // Format:
    //   relationships:
    //     - source: order_items.order_id
    //       target: orders.id
    //       source_anchor: right        # optional: left | right
    //       target_anchor: left         # optional: left | right
    //       way_points:
    //         - { x: 50, y: 30, from: source }
    //         - { x: 50, y: 0,  from: target }
    val yamlRelationshipsSeq = rootMapping.getKeyValueByKey("relationships")?.value as? YAMLSequence
    if (yamlRelationshipsSeq != null) {
      val yamlRels = parseYamlRelationships(yamlRelationshipsSeq)

      // For each YAML entry, either update the matching inferred relationship
      // (preserving cardinality determined from the SQL) or add it as a new one.
      for (yr in yamlRels) {
        val existingIdx = relationships.indexOfFirst { r ->
          r.fromTable == yr.fromTable && r.fromColumns == yr.fromColumns &&
              r.toTable == yr.toTable && r.toColumns == yr.toColumns
        }
        if (existingIdx >= 0) {
          // Patch routing data onto the existing inferred entry.
          relationships[existingIdx] = relationships[existingIdx].copy(
            sourceAnchor = yr.sourceAnchor ?: relationships[existingIdx].sourceAnchor,
            targetAnchor = yr.targetAnchor ?: relationships[existingIdx].targetAnchor,
            waypoints = yr.waypoints ?: relationships[existingIdx].waypoints
          )
        } else {
          // Brand-new virtual link not present in the SQL.
          relationships.add(yr)
        }
      }
    }

    return SchemaPayload(
      tables = dbTables,
      relationships = relationships,
      projectSettings = DbProject(),
      notes = emptyList()
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // YAML relationship parsing
  // ─────────────────────────────────────────────────────────────────────────

  /** Parse the `relationships:` sequence from the YAML layout file.
   *
   *  Each item must have at least a `source` and `target` key in the form
   *  `table.column`.  Optional keys: `source_anchor`, `target_anchor`,
   *  `way_points` (sequence of `{x, y, from}` mappings). */
  private fun parseYamlRelationships(seq: YAMLSequence): List<DbRelationship> {
    return seq.items.mapNotNull { item ->
      val m = item.value as? YAMLMapping ?: return@mapNotNull null

      val source = m.getKeyValueByKey("source")?.valueText ?: return@mapNotNull null
      val target = m.getKeyValueByKey("target")?.valueText ?: return@mapNotNull null

      val (fromTable, fromCol) = splitTableColumn(source) ?: return@mapNotNull null
      val (toTable, toCol) = splitTableColumn(target) ?: return@mapNotNull null

      val sourceAnchor = m.getKeyValueByKey("source_anchor")?.valueText?.lowercase()
        ?.takeIf { it == "left" || it == "right" }
      val targetAnchor = m.getKeyValueByKey("target_anchor")?.valueText?.lowercase()
        ?.takeIf { it == "left" || it == "right" }

      val waypointsSeq = m.getKeyValueByKey("way_points")?.value as? YAMLSequence
      val waypoints = waypointsSeq?.let { parseWayPoints(it) }

      DbRelationship(
        fromSchema = "public", fromTable = fromTable, fromColumns = listOf(fromCol),
        toSchema = "public", toTable = toTable, toColumns = listOf(toCol),
        type = "n:1",   // default; overridden below if a `type` key is present
        sourceAnchor = sourceAnchor,
        targetAnchor = targetAnchor,
        waypoints = waypoints
      ).let { rel ->
        val typeOverride = m.getKeyValueByKey("type")?.valueText
        if (typeOverride != null) rel.copy(type = typeOverride) else rel
      }
    }
  }

  /** Parse a `way_points` sequence of `{x: <num>, y: <num>, from: <str>}` mappings. */
  private fun parseWayPoints(seq: YAMLSequence): List<WayPoint>? {
    val pts = seq.items.mapNotNull { item ->
      val m = item.value as? YAMLMapping ?: return@mapNotNull null
      val x = m.getKeyValueByKey("x")?.valueText?.toDoubleOrNull() ?: return@mapNotNull null
      val y = m.getKeyValueByKey("y")?.valueText?.toDoubleOrNull() ?: return@mapNotNull null
      val from = m.getKeyValueByKey("from")?.valueText?.lowercase()
        ?.takeIf { it == "source" || it == "target" } ?: return@mapNotNull null
      WayPoint(x = x, y = y, from = from)
    }
    return pts.ifEmpty { null }
  }

  /** Split "table.column" into a Pair, returns null if the format is invalid. */
  private fun splitTableColumn(raw: String): Pair<String, String>? {
    val dot = raw.lastIndexOf('.')
    if (dot <= 0 || dot >= raw.length - 1) return null
    return raw.substring(0, dot).trim() to raw.substring(dot + 1).trim()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private fun extractImports(rootMapping: YAMLMapping): List<String> {
    val schemaMapping = rootMapping.getKeyValueByKey("schema")?.value as? YAMLMapping
      ?: return emptyList()
    val importsSeq = schemaMapping.getKeyValueByKey("imports")?.value as? YAMLSequence
      ?: return emptyList()
    return importsSeq.items.mapNotNull { it.value?.text?.removeSurrounding("\"") }
  }

  private fun extractDocComment(element: PsiElement): String? {
    var prev = element.prevSibling
    while (prev != null && prev is PsiWhiteSpace) prev = prev.prevSibling
    if (prev is PsiComment) {
      val text = prev.text.trim()
      if (text.startsWith("---")) return text.removePrefix("---").trim()
    }
    return null
  }
}