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

  // FIX: Regex to reliably extract the referenced table and optional column
  // from a REFERENCES clause, e.g.:
  //   REFERENCES users(id)          → table="users", column="id"
  //   REFERENCES "public"."users"   → table="users", column=null (infer from PK)
  //   REFERENCES orders             → table="orders", column=null (infer from PK)
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

    // --- PASS 1: Collect every table's primary-key column name ---
    // This is needed so that "REFERENCES orders" (no explicit column) can
    // resolve to the real PK of the "orders" table instead of guessing "id".
    val tablePrimaryKeys = mutableMapOf<String, String>() // tableName -> pkColumnName

    for (importPath in imports) {
      val sqlVirtualFile = baseDir.findFileByRelativePath(importPath) ?: continue
      val sqlPsiFile = PsiManager.getInstance(project).findFile(sqlVirtualFile) ?: continue

      PsiTreeUtil.findChildrenOfType(sqlPsiFile, SqlTableDefinition::class.java)
        .forEach { tableDef ->
          val tableName = tableDef.name ?: return@forEach
          val pkCol = PsiTreeUtil
            .findChildrenOfType(tableDef, SqlColumnDefinition::class.java)
            .firstOrNull { it.text.contains("PRIMARY KEY", ignoreCase = true) }
            ?.name
          if (pkCol != null) tablePrimaryKeys[tableName] = pkCol
        }
    }

    // --- PASS 2: Build tables + relationships with correct column references ---
    for (importPath in imports) {
      val sqlVirtualFile = baseDir.findFileByRelativePath(importPath) ?: continue
      val sqlPsiFile = PsiManager.getInstance(project).findFile(sqlVirtualFile) ?: continue

      val tableDefs = PsiTreeUtil.findChildrenOfType(sqlPsiFile, SqlTableDefinition::class.java)

      for (tableDef in tableDefs) {
        val tableName = tableDef.name ?: continue
        val tableComment = extractDocComment(tableDef)
        val columns = PsiTreeUtil.findChildrenOfType(tableDef, SqlColumnDefinition::class.java)
        val fields = mutableListOf<DbField>()

        for (column in columns) {
          val colName = column.name ?: continue
          val colText = column.text
          val colComment = extractDocComment(column)

          val isPk = colText.contains("PRIMARY KEY", ignoreCase = true)
          val isFk = colText.contains("REFERENCES", ignoreCase = true)
          val isNotNull = column.isNotNull || isPk
          val type = column.dasType.toDataType().typeName

          fields.add(
            DbField(
              name = colName,
              isPrimaryKey = isPk,
              isForeignKey = isFk,
              isUnique = colText.contains("UNIQUE", ignoreCase = true) || isPk,
              isNotNull = isNotNull,
              type = type,
              note = colComment
            )
          )

          // FIX: Extract FK relationships using regex instead of SqlReferenceExpression.
          // SqlReferenceExpression.firstOrNull() may resolve to the column *type*
          // expression rather than the REFERENCES table, giving a wrong table name.
          // Regex on the raw text is stable and covers all common SQL dialects.
          if (isFk) {
            val match = REFERENCES_REGEX.find(colText)
            if (match != null) {
              val refTable = match.groupValues[1]
              // FIX: Use the explicitly declared target column when present.
              // Fall back to the target table's actual PK, then "id" as last resort.
              // The old code always used "id" which caused `col-{table}-id` DOM
              // lookups to fail whenever the real PK had a different name.
              val refCol = match.groupValues[2]
                .ifEmpty { tablePrimaryKeys[refTable] ?: "id" }

              relationships.add(
                DbRelationship(
                  fromSchema = "public",
                  fromTable = tableName,
                  fromColumns = listOf(colName),
                  toSchema = "public",
                  toTable = refTable,
                  toColumns = listOf(refCol),
                  // FIX: Use "n:1" format so the JS parseCardinality()
                  // function can split on ":" and display labels correctly.
                  // The old "many_to_one" string caused labels to silently
                  // be suppressed (no ":" present → empty label returned).
                  type = "n:1"
                )
              )
            }
          }
        }

        dbTables.add(
          DbTable(
            id = tableName,
            schema = "public",
            name = tableName,
            fields = fields,
            note = tableComment
          )
        )
      }
    }

    // 2. Merge YAML Visual Properties (x, y, color, width)
    val tablesMapping = rootMapping.getKeyValueByKey("tables")?.value as? YAMLMapping
    if (tablesMapping != null) {
      for (i in dbTables.indices) {
        val table = dbTables[i]
        val layoutMapping =
          tablesMapping.getKeyValueByKey(table.id)?.value as? YAMLMapping

        if (layoutMapping != null) {
          val x = layoutMapping.getKeyValueByKey("x")?.valueText?.toIntOrNull()
          val y = layoutMapping.getKeyValueByKey("y")?.valueText?.toIntOrNull()
          val width = layoutMapping.getKeyValueByKey("width")?.valueText?.toIntOrNull()
          val color = layoutMapping.getKeyValueByKey("color")?.valueText

          dbTables[i] = table.copy(horizontal = x, vertical = y, width = width, color = color)
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

  private fun extractImports(rootMapping: YAMLMapping): List<String> {
    val schemaMapping =
      rootMapping.getKeyValueByKey("schema")?.value as? YAMLMapping ?: return emptyList()
    val importsSeq =
      schemaMapping.getKeyValueByKey("imports")?.value as? YAMLSequence ?: return emptyList()
    return importsSeq.items.mapNotNull { it.value?.text?.removeSurrounding("\"") }
  }

  private fun extractDocComment(element: PsiElement): String? {
    var prev = element.prevSibling
    while (prev != null && prev is PsiWhiteSpace) {
      prev = prev.prevSibling
    }
    if (prev is PsiComment) {
      val text = prev.text.trim()
      if (text.startsWith("---")) {
        return text.removePrefix("---").trim()
      }
    }
    return null
  }
}