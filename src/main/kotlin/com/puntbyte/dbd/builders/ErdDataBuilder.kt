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

  // ─────────────────────────────────────────────────────────────────────────
  // Known built-in types (PostgreSQL + ANSI SQL).
  //
  // This set is the SINGLE SOURCE OF TRUTH for what is "standard".
  // The web layer (TypeScript) never sees this list — it only receives the
  // computed `typeCategory` string and renders it verbatim.
  //
  // If a column's base type is NOT in this set AND NOT found via CREATE TYPE
  // scanning, it is treated as a generic user-defined type ("TYPE").
  // ─────────────────────────────────────────────────────────────────────────
  private val KNOWN_BUILTIN_TYPES = setOf(
    // Integer
    "int", "int2", "int4", "int8", "integer", "bigint", "smallint",
    "serial", "bigserial", "smallserial",
    // Floating point / exact numeric
    "float", "float4", "float8", "real", "double", "double precision",
    "numeric", "decimal", "money",
    // Boolean
    "bool", "boolean",
    // Text / binary
    "char", "bpchar", "character", "character varying",
    "varchar", "text", "name", "bytea", "uuid", "citext",
    // Date / time
    "date", "time", "timetz", "timestamp", "timestamptz", "interval",
    "time without time zone", "time with time zone",
    "timestamp without time zone", "timestamp with time zone",
    // JSON / XML / KV
    "json", "jsonb", "xml", "hstore",
    // Geometric
    "point", "line", "lseg", "box", "path", "polygon", "circle",
    // Network
    "cidr", "inet", "macaddr", "macaddr8",
    // Bit / text-search
    "bit", "varbit", "tsvector", "tsquery",
    // Misc
    "oid", "void", "record", "any", "anyelement", "anyarray",
    "pg_lsn", "txid_snapshot", "xid", "cid", "tid", "regclass", "regtype",
  )

  // ─────────────────────────────────────────────────────────────────────────
  // SQL patterns
  // ─────────────────────────────────────────────────────────────────────────

  private val REFERENCES_REGEX = Regex(
    """REFERENCES\s+(?:"?\w+"?\.)?"?(\w+)"?\s*(?:\(\s*"?(\w+)"?\s*\))?""",
    RegexOption.IGNORE_CASE
  )
  private val DEFAULT_REGEX = Regex(
    """DEFAULT\s+((?:'[^']*'|"[^"]*"|\w+\([^)]*\)|\S+))""",
    RegexOption.IGNORE_CASE
  )
  private val INLINE_ENUM_REGEX = Regex(
    """ENUM\s*\(([^)]+)\)""", RegexOption.IGNORE_CASE
  )

  // CREATE TYPE patterns — applied to raw file text.
  // Uses DOTALL so multi-line definitions still match.
  private val CREATE_ENUM_REGEX = Regex(
    """CREATE\s+TYPE\s+(?:\w+\.)?"?(\w+)"?\s+AS\s+ENUM\s*\(([^)]*)\)""",
    setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL)
  )
  private val CREATE_COMPOSITE_REGEX = Regex(
    """CREATE\s+TYPE\s+(?:\w+\.)?"?(\w+)"?\s+AS\s*\(""",
    setOf(RegexOption.IGNORE_CASE)
  )
  private val CREATE_RANGE_REGEX = Regex(
    """CREATE\s+TYPE\s+(?:\w+\.)?"?(\w+)"?\s+AS\s+RANGE\s*\(""",
    setOf(RegexOption.IGNORE_CASE)
  )
  private val CREATE_BASE_REGEX = Regex(
    """CREATE\s+TYPE\s+(?:\w+\.)?"?(\w+)"?\s*\(\s*INPUT\s*=""",
    setOf(RegexOption.IGNORE_CASE)
  )
  private val CREATE_DOMAIN_REGEX = Regex(
    """CREATE\s+DOMAIN\s+(?:\w+\.)?"?(\w+)"?\s+AS\s+\w""",
    setOf(RegexOption.IGNORE_CASE)
  )

  // ─────────────────────────────────────────────────────────────────────────
  // Entry point
  // ─────────────────────────────────────────────────────────────────────────

  fun build(yamlFile: YAMLFile, project: Project): SchemaPayload {
    val rootMapping = yamlFile.documents.firstOrNull()?.topLevelValue as? YAMLMapping
      ?: return SchemaPayload(emptyList(), emptyList(), DbProject(), emptyList())

    val imports = extractImports(rootMapping)
    val dbTables = mutableListOf<DbTable>()
    val rels = mutableListOf<DbRelationship>()
    val baseDir = yamlFile.virtualFile.parent

    // ── Pass 0: build custom-type registry from all imported SQL files ─────
    //
    // Strategy A — explicit: scan CREATE TYPE / CREATE DOMAIN statements.
    //   Maps lowercase type name → category string ("ENUM", "RECORD", …).
    //   Also collects enum values for named enum types.
    //
    // Strategy B — implicit fallback (applied per-column in Pass 2):
    //   If the base type name is NOT in KNOWN_BUILTIN_TYPES AND NOT in the
    //   registry, it is still user-defined and gets category "TYPE".
    //
    // Strategy A wins when present; B catches anything A misses (e.g. types
    // defined in files not listed in imports, or dialect-specific syntax).

    val customTypeRegistry = mutableMapOf<String, String>()     // name → category
    val enumValueRegistry = mutableMapOf<String, List<String>>() // name → values

    for (importPath in imports) {
      val psi = psiFromPath(baseDir, importPath, project) ?: continue
      val raw = psi.text

      // ENUM
      CREATE_ENUM_REGEX.findAll(raw).forEach { m ->
        val name = m.groupValues[1].lowercase()
        val values = m.groupValues[2].split(",")
          .map { it.trim().removeSurrounding("'").removeSurrounding("\"") }
          .filter { it.isNotEmpty() }
        customTypeRegistry[name] = "ENUM"
        enumValueRegistry[name] = values
      }
      // COMPOSITE / RECORD
      CREATE_COMPOSITE_REGEX.findAll(raw).forEach { m ->
        val name = m.groupValues[1].lowercase()
        if (name !in customTypeRegistry) customTypeRegistry[name] = "RECORD"
      }
      // RANGE
      CREATE_RANGE_REGEX.findAll(raw).forEach { m ->
        val name = m.groupValues[1].lowercase()
        if (name !in customTypeRegistry) customTypeRegistry[name] = "RANGE"
      }
      // BASE
      CREATE_BASE_REGEX.findAll(raw).forEach { m ->
        val name = m.groupValues[1].lowercase()
        if (name !in customTypeRegistry) customTypeRegistry[name] = "BASE"
      }
      // DOMAIN
      CREATE_DOMAIN_REGEX.findAll(raw).forEach { m ->
        val name = m.groupValues[1].lowercase()
        if (name !in customTypeRegistry) customTypeRegistry[name] = "DOMAIN"
      }
    }

    // ── Pass 1: collect PK column name per table ──────────────────────────

    val tablePKs = mutableMapOf<String, String>()
    for (importPath in imports) {
      val psi = psiFromPath(baseDir, importPath, project) ?: continue
      PsiTreeUtil.findChildrenOfType(psi, SqlTableDefinition::class.java).forEach { td ->
        val name = td.name ?: return@forEach
        val pk = PsiTreeUtil.findChildrenOfType(td, SqlColumnDefinition::class.java)
          .firstOrNull { it.text.contains("PRIMARY KEY", ignoreCase = true) }?.name
        if (pk != null) tablePKs[name] = pk
      }
    }

    // ── Pass 2: build tables + relationships ──────────────────────────────

    for (importPath in imports) {
      val psi = psiFromPath(baseDir, importPath, project) ?: continue

      for (tableDef in PsiTreeUtil.findChildrenOfType(psi, SqlTableDefinition::class.java)) {
        val tableName = tableDef.name ?: continue
        val fields = mutableListOf<DbField>()

        for (col in PsiTreeUtil.findChildrenOfType(tableDef, SqlColumnDefinition::class.java)) {
          val colName = col.name ?: continue
          val colText = col.text
          val isPk = colText.contains("PRIMARY KEY", ignoreCase = true)
          val isFk = colText.contains("REFERENCES", ignoreCase = true)

          // Full type string (preserves size and array markers)
          val fullType = extractFullType(colName, colText)
            ?: col.dasType.toDataType().typeName

          // Normalise base type: strip (size), [], and extra spaces; lowercase
          val baseType = fullType
            .split("(")[0].split("[")[0]
            .replace(Regex("\\s+"), " ").trim().lowercase()

          // Inline ENUM: column text contains ENUM('a','b',…)
          val inlineEnumValues = extractInlineEnumValues(colText)

          // ── Determine typeCategory ──────────────────────────────────────
          //
          // Priority:
          //   1. Inline ENUM(…) in column definition → "ENUM"
          //   2. Strategy A: exact match in customTypeRegistry
          //   3. Strategy B (fallback): baseType not in KNOWN_BUILTIN_TYPES
          //      → "TYPE" (generic user-defined; we know it's custom but not
          //        what kind because CREATE TYPE wasn't found)
          //   4. null → standard built-in, no badge
          val typeCategory: String? = when {
            inlineEnumValues != null -> "ENUM"
            customTypeRegistry.containsKey(baseType) -> customTypeRegistry[baseType]
            !KNOWN_BUILTIN_TYPES.contains(baseType)
                && baseType.isNotEmpty()
                && !baseType.matches(Regex("[a-z]+\\d*"))    // exclude e.g. "int4" aliases
                && baseType.length > 1 -> "TYPE"

            else -> null
          }

          // Enum values: inline definition wins; then registry lookup
          val enumValues: List<String>? = inlineEnumValues
            ?: if (typeCategory == "ENUM") enumValueRegistry[baseType] else null

          fields.add(
            DbField(
              name = colName,
              isPrimaryKey = isPk,
              isForeignKey = isFk,
              isUnique = colText.contains("UNIQUE", ignoreCase = true) || isPk,
              isNotNull = col.isNotNull || isPk,
              type = fullType,
              default = extractDefault(colText),
              enumValues = enumValues,
              note = extractDocComment(col),
              typeCategory = typeCategory,
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

    // ── Merge YAML visual layout ──────────────────────────────────────────

    val tablesMap = rootMapping.getKeyValueByKey("tables")?.value as? YAMLMapping
    if (tablesMap != null) {
      for (i in dbTables.indices) {
        val t = dbTables[i]
        val lm = tablesMap.getKeyValueByKey(t.id)?.value as? YAMLMapping ?: continue
        dbTables[i] = t.copy(
          horizontal = lm.getKeyValueByKey("x")?.valueText?.toIntOrNull(),
          vertical = lm.getKeyValueByKey("y")?.valueText?.toIntOrNull(),
          width = lm.getKeyValueByKey("width")?.valueText?.toIntOrNull(),
          color = lm.getKeyValueByKey("color")?.valueText
        )
      }
    }

    // ── Merge YAML relationship overrides ─────────────────────────────────

    val yamlRelsSeq = rootMapping.getKeyValueByKey("relationships")?.value as? YAMLSequence
    if (yamlRelsSeq != null) {
      for (yr in parseYamlRelationships(yamlRelsSeq)) {
        val idx = rels.indexOfFirst { r ->
          r.fromTable == yr.fromTable && r.fromColumns == yr.fromColumns &&
              r.toTable == yr.toTable && r.toColumns == yr.toColumns
        }
        if (idx >= 0) {
          rels[idx] = rels[idx].copy(
            sourceAnchor = yr.sourceAnchor ?: rels[idx].sourceAnchor,
            targetAnchor = yr.targetAnchor ?: rels[idx].targetAnchor,
            waypoints = yr.waypoints ?: rels[idx].waypoints
          )
        } else {
          rels.add(yr)
        }
      }
    }

    return SchemaPayload(
      tables = dbTables, relationships = rels,
      projectSettings = DbProject(), notes = emptyList()
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Type / default / enum extraction helpers
  // ─────────────────────────────────────────────────────────────────────────

  private fun extractFullType(colName: String, colText: String): String? {
    val afterName = colText
      .removePrefix("\"$colName\"")
      .removePrefix(colName)
      .trimStart()
    if (afterName.isEmpty()) return null
    val regex = Regex(
      """^([a-zA-Z][a-zA-Z0-9 ]*?(?:\([^)]*\))?\s*(?:\[\])*)\s*""" +
          """(?:NOT\s+NULL|NULL\b|DEFAULT\b|PRIMARY\b|UNIQUE\b|REFERENCES\b|CHECK\b|GENERATED\b|${'$'})""",
      setOf(RegexOption.IGNORE_CASE)
    )
    return regex.find(afterName)?.groupValues?.get(1)?.trim()?.ifEmpty { null }
  }

  private fun extractDefault(colText: String): String? {
    val raw = DEFAULT_REGEX.find(colText)?.groupValues?.get(1)?.trim() ?: return null
    return if (raw.startsWith("'") && raw.endsWith("'") && raw.length >= 2)
      raw.substring(1, raw.length - 1) else raw
  }

  private fun extractInlineEnumValues(colText: String): List<String>? {
    val inner = INLINE_ENUM_REGEX.find(colText)?.groupValues?.get(1) ?: return null
    val values = inner.split(",")
      .map { it.trim().removeSurrounding("'").removeSurrounding("\"") }
      .filter { it.isNotEmpty() }
    return values.ifEmpty { null }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Multi-line doc-comment extraction
  // ─────────────────────────────────────────────────────────────────────────

  private fun extractDocComment(element: PsiElement): String? {
    val lines = mutableListOf<String>()
    var prev = element.prevSibling

    // Skip the single whitespace directly before the element.
    while (prev != null && prev is PsiWhiteSpace) {
      if (prev.text.contains("\n\n")) return null
      prev = prev.prevSibling
    }

    outer@ while (prev != null) {
      when {
        prev is PsiComment -> {
          val text = prev.text.trim()
          if (text.startsWith("---")) {
            lines.add(0, text.removePrefix("---").trim())
            prev = prev.prevSibling
            while (prev != null && prev is PsiWhiteSpace) {
              if (prev.text.contains("\n\n")) break@outer
              prev = prev.prevSibling
            }
          } else break@outer
        }

        prev is PsiWhiteSpace -> {
          if (prev.text.contains("\n\n")) break@outer
          prev = prev.prevSibling
        }

        else -> break@outer
      }
    }

    return if (lines.isEmpty()) null else lines.joinToString(" ")
  }

  // ─────────────────────────────────────────────────────────────────────────
  // YAML helpers
  // ─────────────────────────────────────────────────────────────────────────

  private fun parseYamlRelationships(seq: YAMLSequence): List<DbRelationship> {
    return seq.items.mapNotNull { item ->
      val m = item.value as? YAMLMapping ?: return@mapNotNull null
      val source = m.getKeyValueByKey("source")?.valueText ?: return@mapNotNull null
      val target = m.getKeyValueByKey("target")?.valueText ?: return@mapNotNull null
      val (fromTable, fromCol) = splitDot(source) ?: return@mapNotNull null
      val (toTable, toCol) = splitDot(target) ?: return@mapNotNull null
      DbRelationship(
        fromSchema = "public", fromTable = fromTable, fromColumns = listOf(fromCol),
        toSchema = "public", toTable = toTable, toColumns = listOf(toCol),
        type = m.getKeyValueByKey("type")?.valueText ?: "n:1",
        sourceAnchor = m.getKeyValueByKey("source_anchor")?.valueText?.lowercase()
          ?.takeIf { it == "left" || it == "right" },
        targetAnchor = m.getKeyValueByKey("target_anchor")?.valueText?.lowercase()
          ?.takeIf { it == "left" || it == "right" },
        waypoints = (m.getKeyValueByKey("way_points")?.value as? YAMLSequence)
          ?.let { parseWayPoints(it) }
      )
    }
  }

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

  private fun splitDot(raw: String): Pair<String, String>? {
    val dot = raw.lastIndexOf('.')
    if (dot <= 0 || dot >= raw.length - 1) return null
    return raw.substring(0, dot).trim() to raw.substring(dot + 1).trim()
  }

  private fun extractImports(rootMapping: YAMLMapping): List<String> {
    val sm = rootMapping.getKeyValueByKey("schema")?.value as? YAMLMapping ?: return emptyList()
    val seq = sm.getKeyValueByKey("imports")?.value as? YAMLSequence ?: return emptyList()
    return seq.items.mapNotNull { it.value?.text?.removeSurrounding("\"") }
  }

  private fun psiFromPath(
    baseDir: com.intellij.openapi.vfs.VirtualFile,
    path: String,
    project: Project
  ) =
    baseDir.findFileByRelativePath(path)?.let { PsiManager.getInstance(project).findFile(it) }
}