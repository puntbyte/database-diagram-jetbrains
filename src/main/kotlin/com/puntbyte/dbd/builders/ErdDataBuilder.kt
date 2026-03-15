package com.puntbyte.dbd.builders

import com.intellij.openapi.project.Project
import com.intellij.psi.PsiComment
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiWhiteSpace
import com.intellij.psi.util.PsiTreeUtil
import com.intellij.sql.psi.SqlColumnDefinition
import com.intellij.sql.psi.SqlTableDefinition
import com.puntbyte.dbd.webview.WebviewBridge.*
import org.jetbrains.yaml.psi.YAMLFile
import org.jetbrains.yaml.psi.YAMLMapping
import org.jetbrains.yaml.psi.YAMLSequence

object ErdDataBuilder {

  private val KNOWN_BUILTIN_TYPES = setOf(
    "int", "int2", "int4", "int8", "integer", "bigint", "smallint",
    "serial", "bigserial", "smallserial",
    "float", "float4", "float8", "real", "double", "double precision",
    "numeric", "decimal", "money",
    "bool", "boolean",
    "char", "bpchar", "character", "character varying",
    "varchar", "text", "name", "bytea", "uuid", "citext",
    "date", "time", "timetz", "timestamp", "timestamptz", "interval",
    "time without time zone", "time with time zone",
    "timestamp without time zone", "timestamp with time zone",
    "json", "jsonb", "xml", "hstore",
    "point", "line", "lseg", "box", "path", "polygon", "circle",
    "cidr", "inet", "macaddr", "macaddr8",
    "bit", "varbit", "tsvector", "tsquery",
    "oid", "void", "record", "any", "anyelement", "anyarray",
    "pg_lsn", "txid_snapshot", "xid", "cid", "tid", "regclass", "regtype",
  )

  private val REFERENCES_REGEX = Regex(
    """REFERENCES\s+(?:"?\w+"?\.)?"?(\w+)"?\s*(?:\(\s*"?(\w+)"?\s*\))?""",
    RegexOption.IGNORE_CASE
  )
  private val DEFAULT_REGEX =
    Regex("""DEFAULT\s+((?:'[^']*'|"[^"]*"|\w+\([^)]*\)|\S+))""", RegexOption.IGNORE_CASE)
  private val INLINE_ENUM_REGEX = Regex("""ENUM\s*\(([^)]+)\)""", RegexOption.IGNORE_CASE)

  private val CREATE_ENUM_REGEX = Regex(
    """CREATE\s+TYPE\s+(?:\w+\.)?"?(\w+)"?\s+AS\s+ENUM\s*\(([^)]*)\)""",
    setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL)
  )
  private val CREATE_COMPOSITE_REGEX =
    Regex("""CREATE\s+TYPE\s+(?:\w+\.)?"?(\w+)"?\s+AS\s*\(""", setOf(RegexOption.IGNORE_CASE))
  private val CREATE_RANGE_REGEX = Regex(
    """CREATE\s+TYPE\s+(?:\w+\.)?"?(\w+)"?\s+AS\s+RANGE\s*\(""",
    setOf(RegexOption.IGNORE_CASE)
  )
  private val CREATE_BASE_REGEX = Regex(
    """CREATE\s+TYPE\s+(?:\w+\.)?"?(\w+)"?\s*\(\s*INPUT\s*=""",
    setOf(RegexOption.IGNORE_CASE)
  )
  private val CREATE_DOMAIN_REGEX =
    Regex("""CREATE\s+DOMAIN\s+(?:\w+\.)?"?(\w+)"?\s+AS\s+\w""", setOf(RegexOption.IGNORE_CASE))

  fun build(yamlFile: YAMLFile, project: Project): SchemaPayload {
    val root = yamlFile.documents.firstOrNull()?.topLevelValue as? YAMLMapping
      ?: return SchemaPayload(emptyList(), emptyList(), DbProject(), emptyList())

    val imports = extractImports(root)
    val dbTables = mutableListOf<DbTable>()
    val rels = mutableListOf<DbRelationship>()
    val baseDir = yamlFile.virtualFile.parent

    // Pass 0: custom type registry
    val customTypeRegistry = mutableMapOf<String, String>()
    val enumValueRegistry = mutableMapOf<String, List<String>>()
    for (path in imports) {
      val psi = psiFromPath(baseDir, path, project) ?: continue
      val raw = psi.text
      CREATE_ENUM_REGEX.findAll(raw).forEach { m ->
        val n = m.groupValues[1].lowercase()
        customTypeRegistry[n] = "ENUM"
        enumValueRegistry[n] = m.groupValues[2].split(",")
          .map { it.trim().removeSurrounding("'").removeSurrounding("\"") }
          .filter { it.isNotEmpty() }
      }
      CREATE_COMPOSITE_REGEX.findAll(raw)
        .forEach { m -> customTypeRegistry.putIfAbsent(m.groupValues[1].lowercase(), "RECORD") }
      CREATE_RANGE_REGEX.findAll(raw)
        .forEach { m -> customTypeRegistry.putIfAbsent(m.groupValues[1].lowercase(), "RANGE") }
      CREATE_BASE_REGEX.findAll(raw)
        .forEach { m -> customTypeRegistry.putIfAbsent(m.groupValues[1].lowercase(), "BASE") }
      CREATE_DOMAIN_REGEX.findAll(raw)
        .forEach { m -> customTypeRegistry.putIfAbsent(m.groupValues[1].lowercase(), "DOMAIN") }
    }

    // Pass 1: PK names
    val tablePKs = mutableMapOf<String, String>()
    for (path in imports) {
      val psi = psiFromPath(baseDir, path, project) ?: continue
      PsiTreeUtil.findChildrenOfType(psi, SqlTableDefinition::class.java).forEach { td ->
        val pk = PsiTreeUtil.findChildrenOfType(td, SqlColumnDefinition::class.java)
          .firstOrNull { it.text.contains("PRIMARY KEY", ignoreCase = true) }?.name
        if (td.name != null && pk != null) tablePKs[td.name!!] = pk
      }
    }

    // Pass 2: build tables + relationships
    for (path in imports) {
      val psi = psiFromPath(baseDir, path, project) ?: continue
      for (tableDef in PsiTreeUtil.findChildrenOfType(psi, SqlTableDefinition::class.java)) {
        val tableName = tableDef.name ?: continue
        val fields = mutableListOf<DbField>()
        for (col in PsiTreeUtil.findChildrenOfType(tableDef, SqlColumnDefinition::class.java)) {
          val colName = col.name ?: continue
          val colText = col.text
          val isPk = colText.contains("PRIMARY KEY", ignoreCase = true)
          val isFk = colText.contains("REFERENCES", ignoreCase = true)
          val fullType = extractFullType(colName, colText) ?: col.dasType.toDataType().typeName
          val baseType =
            fullType.split("(")[0].split("[")[0].replace(Regex("\\s+"), " ").trim().lowercase()
          val inlineEnum = extractInlineEnumValues(colText)
          val typeCategory: String? = when {
            inlineEnum != null -> "ENUM"
            customTypeRegistry.containsKey(baseType) -> customTypeRegistry[baseType]
            !KNOWN_BUILTIN_TYPES.contains(baseType) && baseType.isNotEmpty() && baseType.length > 1 -> "TYPE"
            else -> null
          }
          fields.add(
            DbField(
              name = colName, isPrimaryKey = isPk, isForeignKey = isFk,
              isUnique = colText.contains("UNIQUE", ignoreCase = true) || isPk,
              isNotNull = col.isNotNull || isPk,
              type = fullType, default = extractDefault(colText),
              enumValues = inlineEnum
                ?: if (typeCategory == "ENUM") enumValueRegistry[baseType] else null,
              note = extractDocComment(col), typeCategory = typeCategory,
            )
          )
          if (isFk) {
            val m = REFERENCES_REGEX.find(colText)
            if (m != null) {
              val refTable = m.groupValues[1]
              val refCol = m.groupValues[2].ifEmpty { tablePKs[refTable] ?: "id" }
              rels.add(
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
            fields = fields, note = extractDocComment(tableDef)
          )
        )
      }
    }

    // ── Merge YAML visual layout ──────────────────────────────────────────────
    //
    // FIX: Detect table renames.
    //
    // When a table is renamed in SQL (e.g. CREATE TABLE old → CREATE TABLE new):
    //   • The YAML `tables:` still has the old name as a key with saved x/y/width.
    //   • The new SQL name has no entry, so it appears at 0,0 with default width.
    //   • The old key becomes an orphan that accumulates over time.
    //
    // Detection heuristic (conservative — avoids false positives):
    //   • sqlTableNames  = all tables found in SQL this render
    //   • yamlLayoutKeys = all keys in the YAML `tables:` mapping
    //   • orphaned = yamlLayoutKeys − sqlTableNames  (exist in YAML but not SQL)
    //   • newTables = sqlTableNames − yamlLayoutKeys (in SQL but no YAML layout)
    //
    // If exactly ONE table disappeared and exactly ONE new table appeared, it
    // is very likely a rename.  We copy the orphan's layout to the new name
    // so the table keeps its position and width, and the orphan key is left
    // in the YAML (the user can clean it up, or the IDE will overwrite it
    // naturally on next drag/resize under the new name).
    //
    // We intentionally do NOT auto-delete the old key here because:
    //   a) We don't want to silently mutate the YAML file on every render.
    //   b) The heuristic could be wrong (two simultaneous add/remove operations).
    // The user sees the correct position immediately; the YAML self-corrects on
    // the next drag or resize under the new name.

    val tablesMap = root.getKeyValueByKey("tables")?.value as? YAMLMapping

    if (tablesMap != null) {
      val sqlTableNames = dbTables.map { it.id }.toSet()
      val yamlLayoutKeys = tablesMap.keyValues.mapNotNull { it.keyText }.toSet()

      val orphaned = yamlLayoutKeys - sqlTableNames   // in YAML but not SQL
      val newTables = sqlTableNames - yamlLayoutKeys  // in SQL but not YAML

      // Build a rename map: orphan → new table (only when 1-to-1 match)
      val renameMap: Map<String, String> = if (orphaned.size == 1 && newTables.size == 1) {
        mapOf(orphaned.first() to newTables.first())
      } else {
        emptyMap()
      }

      for (i in dbTables.indices) {
        val t = dbTables[i]

        // Look up layout key: try exact match first, then renamed source
        val layoutKey = when {
          yamlLayoutKeys.contains(t.id) -> t.id
          renameMap.values.contains(t.id) -> renameMap.entries.first { it.value == t.id }.key
          else -> null
        } ?: continue

        val lm = tablesMap.getKeyValueByKey(layoutKey)?.value as? YAMLMapping ?: continue
        dbTables[i] = t.copy(
          horizontal = lm.getKeyValueByKey("x")?.valueText?.toIntOrNull(),
          vertical = lm.getKeyValueByKey("y")?.valueText?.toIntOrNull(),
          width = lm.getKeyValueByKey("width")?.valueText?.toIntOrNull(),
          color = lm.getKeyValueByKey("color")?.valueText
        )
      }
    }

    // ── Merge YAML relationship overrides ─────────────────────────────────────
    val relSeq = root.getKeyValueByKey("relationships")?.value as? YAMLSequence
    if (relSeq != null) {
      for (yr in parseYamlRelationships(relSeq)) {
        val idx = rels.indexOfFirst { r ->
          r.fromTable == yr.fromTable && r.fromColumns == yr.fromColumns &&
              r.toTable == yr.toTable && r.toColumns == yr.toColumns
        }
        if (idx >= 0) rels[idx] = rels[idx].copy(
          sourceAnchor = yr.sourceAnchor ?: rels[idx].sourceAnchor,
          targetAnchor = yr.targetAnchor ?: rels[idx].targetAnchor,
          waypoints = yr.waypoints ?: rels[idx].waypoints
        )
        else rels.add(yr)
      }
    }

    return SchemaPayload(
      tables = dbTables, relationships = rels,
      projectSettings = DbProject(), notes = parseYamlNotes(root)
    )
  }

  // ── Type helpers ───────────────────────────────────────────────────────────

  private fun extractFullType(colName: String, colText: String): String? {
    val after = colText.removePrefix("\"$colName\"").removePrefix(colName).trimStart()
    if (after.isEmpty()) return null
    return Regex(
      """^([a-zA-Z][a-zA-Z0-9 ]*?(?:\([^)]*\))?\s*(?:\[\])*)\s*(?:NOT\s+NULL|NULL\b|DEFAULT\b|PRIMARY\b|UNIQUE\b|REFERENCES\b|CHECK\b|GENERATED\b|${'$'})""",
      setOf(RegexOption.IGNORE_CASE)
    )
      .find(after)?.groupValues?.get(1)?.trim()?.ifEmpty { null }
  }

  private fun extractDefault(colText: String): String? {
    val raw = DEFAULT_REGEX.find(colText)?.groupValues?.get(1)?.trim() ?: return null
    return if (raw.startsWith("'") && raw.endsWith("'") && raw.length >= 2) raw.substring(
      1,
      raw.length - 1
    ) else raw
  }

  private fun extractInlineEnumValues(colText: String): List<String>? {
    val inner = INLINE_ENUM_REGEX.find(colText)?.groupValues?.get(1) ?: return null
    return inner.split(",").map { it.trim().removeSurrounding("'").removeSurrounding("\"") }
      .filter { it.isNotEmpty() }.ifEmpty { null }
  }

  // ── Doc comment (multi-line) ───────────────────────────────────────────────

  private fun extractDocComment(element: PsiElement): String? {
    val lines = mutableListOf<String>()
    var prev = element.prevSibling
    while (prev != null && prev is PsiWhiteSpace) {
      if (prev.text.contains("\n\n")) return null
      prev = prev.prevSibling
    }
    outer@ while (prev != null) {
      when {
        prev is PsiComment -> {
          val t = prev.text.trim()
          if (t.startsWith("---")) {
            lines.add(0, t.removePrefix("---").trim())
            prev = prev.prevSibling
            while (prev != null && prev is PsiWhiteSpace) {
              if (prev.text.contains("\n\n")) break@outer
              prev = prev.prevSibling
            }
          } else break@outer
        }

        prev is PsiWhiteSpace -> {
          if (prev.text.contains("\n\n")) break@outer; prev = prev.prevSibling
        }

        else -> break@outer
      }
    }
    return if (lines.isEmpty()) null else lines.joinToString(" ")
  }

  // ── YAML notes ─────────────────────────────────────────────────────────────

  private fun parseYamlNotes(root: YAMLMapping): List<DbNote> {
    val seq = root.getKeyValueByKey("notes")?.value as? YAMLSequence ?: return emptyList()
    return seq.items.mapNotNull { item ->
      val m = item.value as? YAMLMapping ?: return@mapNotNull null
      val id =
        m.getKeyValueByKey("id")?.valueText?.removeSurrounding("\"") ?: return@mapNotNull null
      val text = m.getKeyValueByKey("text")?.valueText ?: m.getKeyValueByKey("content")?.valueText
      ?: return@mapNotNull null
      val x = m.getKeyValueByKey("x")?.valueText?.toIntOrNull() ?: 0
      val y = m.getKeyValueByKey("y")?.valueText?.toIntOrNull() ?: 0
      val width = m.getKeyValueByKey("width")?.valueText?.toIntOrNull() ?: 200
      DbNote(
        id = id, name = id,
        content = text.removeSurrounding("\"").trim(),
        horizontal = x, vertical = y, width = width,
        height = m.getKeyValueByKey("height")?.valueText?.toIntOrNull(),
        color = m.getKeyValueByKey("color")?.valueText?.removeSurrounding("\""),
        target = m.getKeyValueByKey("target")?.valueText?.removeSurrounding("\""),
        targetAnchor = m.getKeyValueByKey("target_anchor")?.valueText?.lowercase()
          ?.takeIf { it in setOf("left", "right", "top", "bottom") }
      )
    }
  }

  // ── YAML relationships ─────────────────────────────────────────────────────

  private fun parseYamlRelationships(seq: YAMLSequence): List<DbRelationship> {
    return seq.items.mapNotNull { item ->
      val m = item.value as? YAMLMapping ?: return@mapNotNull null
      val (fromTable, fromCol) = splitDot(
        m.getKeyValueByKey("source")?.valueText ?: return@mapNotNull null
      ) ?: return@mapNotNull null
      val (toTable, toCol) = splitDot(
        m.getKeyValueByKey("target")?.valueText ?: return@mapNotNull null
      ) ?: return@mapNotNull null
      DbRelationship(
        fromSchema = "public", fromTable = fromTable, fromColumns = listOf(fromCol),
        toSchema = "public", toTable = toTable, toColumns = listOf(toCol),
        type = m.getKeyValueByKey("type")?.valueText ?: "n:1",
        sourceAnchor = m.getKeyValueByKey("source_anchor")?.valueText?.lowercase()
          ?.takeIf { it in setOf("left", "right") },
        targetAnchor = m.getKeyValueByKey("target_anchor")?.valueText?.lowercase()
          ?.takeIf { it in setOf("left", "right") },
        waypoints = (m.getKeyValueByKey("way_points")?.value as? YAMLSequence)?.let {
          parseWayPoints(
            it
          )
        }
      )
    }
  }

  private fun parseWayPoints(seq: YAMLSequence): List<WayPoint>? {
    val pts = seq.items.mapNotNull { item ->
      val m = item.value as? YAMLMapping ?: return@mapNotNull null
      WayPoint(
        x = m.getKeyValueByKey("x")?.valueText?.toDoubleOrNull() ?: return@mapNotNull null,
        y = m.getKeyValueByKey("y")?.valueText?.toDoubleOrNull() ?: return@mapNotNull null,
        from = m.getKeyValueByKey("from")?.valueText?.lowercase()
          ?.takeIf { it in setOf("source", "target") } ?: return@mapNotNull null
      )
    }
    return pts.ifEmpty { null }
  }

  private fun splitDot(raw: String): Pair<String, String>? {
    val dot = raw.lastIndexOf('.')
    if (dot <= 0 || dot >= raw.length - 1) return null
    return raw.substring(0, dot).trim() to raw.substring(dot + 1).trim()
  }

  private fun extractImports(root: YAMLMapping): List<String> {
    val seq = (root.getKeyValueByKey("schema")?.value as? YAMLMapping)
      ?.getKeyValueByKey("imports")?.value as? YAMLSequence ?: return emptyList()
    return seq.items.mapNotNull { it.value?.text?.removeSurrounding("\"") }
  }

  private fun psiFromPath(
    baseDir: com.intellij.openapi.vfs.VirtualFile,
    path: String,
    project: Project
  ) =
    baseDir.findFileByRelativePath(path)
      ?.let { com.intellij.psi.PsiManager.getInstance(project).findFile(it) }
}