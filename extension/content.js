// TraceX Content Script — Bridges web app at localhost:5173 with TraceX extension
"use strict";

// Inject a flag into DOM so web app knows extension is loaded even before postMessage
try {
  document.documentElement.setAttribute("data-tracex-extension-active", "1.1");
} catch (e) {}

// Listen for messages from the TraceX React web application
window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data || !event.data.type) return;

  if (event.data.type === "TRACEX_WEB_PING") {
    // Web app asking if extension is present and for current state
    chrome.storage.local.get(["tracex_user", "isPaused"], (res) => {
      window.postMessage({
        type: "TRACEX_EXTENSION_STATUS",
        installed: true,
        version: "1.1",
        user: res.tracex_user || null,
        isPaused: !!res.isPaused
      }, "*");
    });
  } else if (event.data.type === "TRACEX_WEB_CONNECT_USER" || event.data.type === "TRACEX_AUTO_CONNECT") {
    // Web app automatically connects extension
    const user = event.data.user || { user_id: 1, full_name: "TraceX Engine" };
    chrome.storage.local.set({ tracex_user: user, tracex_connected_by_tracex: true }, () => {
      chrome.runtime.sendMessage({ action: "userConnected", user });
      window.postMessage({
        type: "TRACEX_EXTENSION_CONNECTED",
        success: true,
        connectedByTraceX: true,
        user
      }, "*");
    });
  } else if (event.data.type === "TRACEX_WEB_TOGGLE_PAUSE") {
    // Web app requested pause/resume toggle
    const isPaused = !!event.data.isPaused;
    chrome.storage.local.set({ isPaused }, () => {
      window.postMessage({
        type: "TRACEX_EXTENSION_PAUSE_CHANGED",
        isPaused
      }, "*");
    });
  }
});

// Announce presence immediately
window.postMessage({ type: "TRACEX_EXTENSION_AVAILABLE", version: "1.1" }, "*");
