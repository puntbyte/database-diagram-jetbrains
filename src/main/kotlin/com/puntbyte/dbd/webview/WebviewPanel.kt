// src/main/kotlin/com.puntbyte.databaseschemaintellij/webview/WebviewPanel.kt

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
    // Define the Listener Interface here
    interface WebviewListener {
        fun onWebviewReady()
        fun onTablePositionUpdated(tableName: String, x: Int, y: Int, width: Int?)
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

        // Create Browser
        val browser = JBCefBrowser.createBuilder()
            .setEnableOpenDevToolsMenuItem(true)
            .build()

        jbCefBrowser = browser
        component.add(browser.component, BorderLayout.CENTER)

        // Add Message Router
        val router = CefMessageRouter.create()
        router.addHandler(object : CefMessageRouterHandlerAdapter() {
            override fun onQuery(
                browser: CefBrowser?,
                frame: CefFrame?,
                queryId: Long,
                request: String?,
                persistent: Boolean,
                callback: CefQueryCallback?
            ): Boolean {
                handleClientQuery(request)
                return true
            }
        }, true)
        browser.jbCefClient.cefClient.addMessageRouter(router)

        // Load Content
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
                is WebviewBridge.Client.Ready -> {
                    listener.onWebviewReady()
                }
                is WebviewBridge.Client.UpdateTablePos -> {
                    // FIX: Pass the width property from the message
                    listener.onTablePositionUpdated(
                        message.tableName,
                        message.x,
                        message.y,
                        message.width
                    )
                }
                is WebviewBridge.Client.Log -> {
                    logger.info("Webview Log: ${message.message}")
                }
            }
        } catch (e: Exception) {
            logger.warn("Failed to parse webview message: ${e.message}")
        }
    }

    fun updateSchema(format: String, content: String) {
        val browser = jbCefBrowser ?: return
        if (browser.cefBrowser == null) return
        try {
            val payload = WebviewBridge.Server.UpdateContent(format, content)
            val json = mapper.writeValueAsString(payload)
            browser.cefBrowser.executeJavaScript("window.postMessage($json, '*')", browser.cefBrowser.url, 0)
        } catch (_: Exception) {}
    }

    fun updateTheme(theme: String) {
        val browser = jbCefBrowser ?: return
        if (browser.cefBrowser == null) return
        try {
            val payload = WebviewBridge.Server.UpdateTheme(theme)
            val json = mapper.writeValueAsString(payload)
            browser.cefBrowser.executeJavaScript("window.postMessage($json, '*')", browser.cefBrowser.url, 0)
        } catch (_: Exception) {}
    }

    override fun dispose() {
        jbCefBrowser = null
    }

    // REMOVED: conflicting `fun getComponent()`
}