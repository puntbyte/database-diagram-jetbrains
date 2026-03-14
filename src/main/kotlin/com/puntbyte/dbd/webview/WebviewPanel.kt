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
      component.add(JLabel("JCEF Not Supported"), BorderLayout.CENTER)
      return
    }

    val browser = JBCefBrowser.createBuilder()
      .setEnableOpenDevToolsMenuItem(true)
      .build()

    jbCefBrowser = browser
    component.add(browser.component, BorderLayout.CENTER)

    val router = CefMessageRouter.create()
    router.addHandler(object : CefMessageRouterHandlerAdapter() {
      override fun onQuery(
        browser: CefBrowser?, frame: CefFrame?, queryId: Long, request: String?,
        persistent: Boolean, callback: CefQueryCallback?
      ): Boolean {
        handleClientQuery(request)
        return true
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
      browser.loadHTML("<h3>Error: index.html not found</h3>")
      return
    }
    val html = stream.bufferedReader().use { it.readText() }
    val encoded = Base64.getEncoder().encodeToString(html.toByteArray(Charsets.UTF_8))
    browser.loadURL("data:text/html;charset=utf-8;base64,$encoded")
  }

  private fun handleClientQuery(request: String?) {
    if (request == null) return
    try {
      val message = mapper.readValue(request, WebviewBridge.Client::class.java)
      when (message) {
        is WebviewBridge.Client.Ready -> listener.onWebviewReady()
        is WebviewBridge.Client.Log -> logger.info("Webview: ${message.message}")
        is WebviewBridge.Client.UpdateTablePos -> listener.onTablePositionUpdated(
          message.tableName, message.x, message.y, message.width
        )

        is WebviewBridge.Client.UpdateNotePos -> listener.onNotePositionUpdated(
          message.name, message.x, message.y, message.width, message.height
        )
      }
    } catch (e: Exception) {
      logger.warn("Failed to parse webview message: ${e.message}")
    }
  }

  fun updateSchemaPayload(
    payload: WebviewBridge.SchemaPayload,
    settings: WebviewBridge.GlobalSettings? = null
  ) {
    executeJs(WebviewBridge.Server.UpdateSchemaPayload(payload, settings))
  }

  fun updateTheme(theme: String) {
    executeJs(WebviewBridge.Server.UpdateTheme(theme))
  }

  // FIX: Extended signature to include note-display settings.
  // All params are forwarded into UpdateGlobalSettings which Jackson serialises
  // as flat top-level fields, matching the TS SettingsUpdateMessage interface.
  fun updateGlobalSettings(
    lineStyle: String,
    showGrid: Boolean,
    gridSize: Int,
    showTableNotes: Boolean = true,
    showFieldNotes: Boolean = true,
    tableNoteMaxLines: Int = 2,
    fieldNoteMaxLines: Int = 2,
  ) {
    executeJs(
      WebviewBridge.Server.UpdateGlobalSettings(
        lineStyle = lineStyle,
        showGrid = showGrid,
        gridSize = gridSize,
        showTableNotes = showTableNotes,
        showFieldNotes = showFieldNotes,
        tableNoteMaxLines = tableNoteMaxLines,
        fieldNoteMaxLines = fieldNoteMaxLines,
      )
    )
  }

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