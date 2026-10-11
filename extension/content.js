// TraceX Content Script — Secure Bridge between web app and TraceX extension
"use strict";

const ALLOWED_ORIGINS = new Set([
  "https://trace-x-bice.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
]);

function isAllowedOrigin(origin) {
  return ALLOWED_ORIGINS.has(origin);
}

// Inject a flag into DOM so web app knows extension is loaded even before postMessage
try {
  document.documentElement.setAttribute("data-tracex-extension-active", "1.2");
} catch (e) {}

// Listen for messages from the TraceX React web application
window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data || !event.data.type) return;
  if (!isAllowedOrigin(window.location.origin)) return;

  if (event.data.type === "TRACEX_WEB_PING") {
    // Web app asking if extension is present and for current state
    chrome.storage.local.get(["tracex_user", "isPaused"], (res) => {
      const sanitizedUser = res.tracex_user
        ? {
            user_id: res.tracex_user.user_id,
            email: res.tracex_user.email,
            full_name: res.tracex_user.full_name,
            is_linked: !!res.tracex_user.token
          }
        : null;

      window.postMessage({
        type: "TRACEX_EXTENSION_STATUS",
        installed: true,
        version: "1.2",
        user: sanitizedUser,
        isPaused: !!res.isPaused
      }, window.location.origin);
    });
  } else if (event.data.type === "TRACEX_WEB_CONNECT_USER" || event.data.type === "TRACEX_AUTO_CONNECT") {
    // Web app linking authenticated user and JWT
    const incomingUser = event.data.user;
    if (!incomingUser || !incomingUser.user_id || !incomingUser.token) {
      console.warn("[TraceX Extension] Linking rejected: missing authenticated user or token.");
      return;
    }

    const secureUser = {
      user_id: incomingUser.user_id,
      email: incomingUser.email || "",
      full_name: incomingUser.full_name || "TraceX Student",
      token: incomingUser.token
    };

    chrome.storage.local.set({ tracex_user: secureUser, tracex_connected_by_tracex: true }, () => {
      chrome.runtime.sendMessage({ action: "connectUser", user: secureUser });
      window.postMessage({
        type: "TRACEX_EXTENSION_CONNECTED",
        success: true,
        connectedByTraceX: true,
        user: {
          user_id: secureUser.user_id,
          email: secureUser.email,
          full_name: secureUser.full_name
        }
      }, window.location.origin);
    });
  } else if (event.data.type === "TRACEX_WEB_LOGOUT") {
    // Web app logged out; disconnect extension credentials and clear queued events
    chrome.storage.local.remove(["tracex_user", "tracex_connected_by_tracex", "tracex_pending"], () => {
      chrome.runtime.sendMessage({ action: "logoutUser" });
      window.postMessage({
        type: "TRACEX_EXTENSION_LOGGED_OUT",
        success: true
      }, window.location.origin);
    });
  } else if (event.data.type === "TRACEX_WEB_TOGGLE_PAUSE") {
    // Web app requested pause/resume toggle
    const isPaused = !!event.data.isPaused;
    chrome.storage.local.set({ isPaused }, () => {
      chrome.runtime.sendMessage({ action: "togglePause", isPaused });
      window.postMessage({
        type: "TRACEX_EXTENSION_PAUSE_CHANGED",
        isPaused
      }, window.location.origin);
    });
  }
});

// Announce presence immediately
if (isAllowedOrigin(window.location.origin)) {
  window.postMessage({ type: "TRACEX_EXTENSION_AVAILABLE", version: "1.2" }, window.location.origin);
}
