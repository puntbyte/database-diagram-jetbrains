package com.puntbyte.dbd.webview

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.intellij.openapi.Disposable
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.ui.jcef.JBCefApp
import com.intellij.ui.jcef.JBCefBrowser
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.browser.CefMessageRouter
import org.cef.callback.CefQueryCallback
import org.cef.handler.CefMessageRouterHandlerAdapter
import java.awt.BorderLayout
import java.util.Base64
import javax.swing.JLabel
import javax.swing.JPanel

class WebviewPanel(
  private val parentDisposable: Disposable,
  private val file: VirtualFile,
  private val listener: WebviewListener
) : Disposable {

  interface WebviewListener {
    fun onWebviewReady()
    fun onTablePositionUpdated(tableName: String, x: Int, y: Int, width: Int?)
    fun onNotePositionUpdated(name: String, x: Int, y: Int, width: Int, height: Int)
    fun onTableColorUpdated(tableName: String, color: String)
    fun onNoteColorUpdated(noteId: String, color: String)
  }

  companion object {
    private const val RESOURCE_PATH = "/web/index.html"
    private val mapper = jacksonObjectMapper()
  }

  private val logger = thisLogger()
  val component = JPanel(BorderLayout())
  private var jbCefBrowser: JBCefBrowser? = null

  init {
    initBrowser()
  }

  private fun initBrowser() {
    if (!JBCefApp.isSupported()) {
      component.add(JLabel("JCEF Not Supported"), BorderLayout.CENTER); return
    }
    val browser = JBCefBrowser.createBuilder().setEnableOpenDevToolsMenuItem(true).build()
    jbCefBrowser = browser
    component.add(browser.component, BorderLayout.CENTER)

    val router = CefMessageRouter.create()
    router.addHandler(object : CefMessageRouterHandlerAdapter() {
      override fun onQuery(
        browser: CefBrowser?, frame: CefFrame?, queryId: Long,
        request: String?, persistent: Boolean, callback: CefQueryCallback?
      ): Boolean {
        handleClientQuery(request); return true
      }
    }, true)
    browser.jbCefClient.cefClient.addMessageRouter(router)
    loadContent(browser)
    Disposer.register(parentDisposable, browser)
    Disposer.register(parentDisposable, this)
  }

  private fun loadContent(browser: JBCefBrowser) {
    val stream = javaClass.getResourceAsStream(RESOURCE_PATH)
    if (stream == null) {
      browser.loadHTML("<h3>Error: index.html not found</h3>"); return
    }
    val encoded = Base64.getEncoder()
      .encodeToString(stream.bufferedReader().use { it.readText() }.toByteArray(Charsets.UTF_8))
    browser.loadURL("data:text/html;charset=utf-8;base64,$encoded")
  }

  private fun handleClientQuery(request: String?) {
    if (request == null) return
    try {
      when (val msg = mapper.readValue(request, WebviewBridge.Client::class.java)) {
        is WebviewBridge.Client.Ready -> listener.onWebviewReady()
        is WebviewBridge.Client.Log -> logger.info("Webview: ${msg.message}")
        is WebviewBridge.Client.UpdateTablePos -> listener.onTablePositionUpdated(
          msg.tableName,
          msg.x,
          msg.y,
          msg.width
        )

        is WebviewBridge.Client.UpdateNotePos -> listener.onNotePositionUpdated(
          msg.name,
          msg.x,
          msg.y,
          msg.width,
          msg.height
        )

        is WebviewBridge.Client.UpdateTableColor -> listener.onTableColorUpdated(
          msg.tableName,
          msg.color
        )

        is WebviewBridge.Client.UpdateNoteColor -> listener.onNoteColorUpdated(
          msg.noteId,
          msg.color
        )
      }
    } catch (e: Exception) {
      logger.warn("Failed to parse webview message: ${e.message}")
    }
  }

  fun updateSchemaPayload(
    payload: WebviewBridge.SchemaPayload,
    settings: WebviewBridge.GlobalSettings? = null
  ) =
    executeJs(WebviewBridge.Server.UpdateSchemaPayload(payload, settings))

  fun updateTheme(theme: String) = executeJs(WebviewBridge.Server.UpdateTheme(theme))

  fun updateGlobalSettings(
    lineStyle: String, showGrid: Boolean, gridSize: Int,
    showTableNotes: Boolean = true, showFieldNotes: Boolean = true,
    tableNoteMaxLines: Int = 2, fieldNoteMaxLines: Int = 2,
  ) = executeJs(
    WebviewBridge.Server.UpdateGlobalSettings(
      lineStyle,
      showGrid,
      gridSize,
      showTableNotes,
      showFieldNotes,
      tableNoteMaxLines,
      fieldNoteMaxLines
    )
  )

  private fun executeJs(payload: WebviewBridge.Server) {
    val browser = jbCefBrowser ?: return
    if (browser.cefBrowser == null) return
    try {
      val json = mapper.writeValueAsString(payload)
      browser.cefBrowser.executeJavaScript(
        "window.postMessage($json, '*')",
        browser.cefBrowser.url,
        0
      )
    } catch (_: Exception) {
    }
  }

  override fun dispose() {
    jbCefBrowser = null
  }
}