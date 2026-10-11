// TraceX Background Service Worker — DBMS Phase
// Manifest V3 — all persistent state stored in chrome.storage.local
//
// Handles: tab switching, URL navigation, window focus, idle, pause/resume,
//          service-worker restart/recovery, offline buffering, deduplication.
//
// Architecture:
//   Chrome Extension
//         ↓
//   Live activity tracking
//         ↓
//   FastAPI  →  MySQL  →  React dashboard

"use strict";

const API_BASE_URL = "https://trace-x-bsms.onrender.com";
const IDLE_THRESHOLD_SECS = 60;      // 60 seconds of inactivity → idle
const HEARTBEAT_INTERVAL = 12_000;  // send live activity every 12 seconds
const RETRY_INTERVAL_MS = 30_000;  // retry pending queue every 30 seconds
const MIN_DURATION_SECONDS = 2;       // ignore activities shorter than this

// ── In-Memory State ────────────────────────────────────────────────────────────
let state = {
    activeDomain: null,
    activeUrl: null,
    activeTitle: null,
    startTime: null,       // ms timestamp
    currentEventId: null,       // unique event ID for current active tab session
    activeTabId: null,
    windowId: null,
    isIdle: false,
    isTrackingPaused: false,
};

// ── Generate a stable unique event ID ─────────────────────────────────────────
function generateEventId(domain, startTime) {
    const rand = Math.random().toString(36).substring(2, 9);
    return `${startTime}-${domain.replace(/[^a-z0-9]/gi, "_").substring(0, 40)}-${rand}`;
}

// ── Extract domain from URL ────────────────────────────────────────────────────
function getDomain(url) {
    try {
        const parsed = new URL(url);
        if (
            parsed.protocol === "chrome:" ||
            parsed.protocol === "edge:" ||
            parsed.protocol === "about:" ||
            parsed.protocol === "chrome-extension:"
        ) {
            return null;
        }
        let domain = parsed.hostname;
        if (domain.startsWith("www.")) domain = domain.substring(4);
        return domain || parsed.protocol.replace(":", "");
    } catch {
        return null;
    }
}

function isPdfUrl(url) {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.endsWith(".pdf") || lower.includes(".pdf?") || lower.includes("/pdf/");
}

// ── Check if URL belongs to TraceX web dashboard ──────────────────────────────
function isTraceXUrl(url) {
    if (!url) return false;

    try {
        const host = new URL(url).hostname.toLowerCase();

        return (
            host === "localhost" ||
            host === "127.0.0.1" ||
            host === "::1" ||
            host === "trace-x-bice.vercel.app"
        );
    } catch {
        return false;
    }
}


// ── Restore state from chrome.storage.local ───────────────────────────────────
async function restoreState() {
    const stored = await chrome.storage.local.get([
        "tracex_activeDomain",
        "tracex_activeUrl",
        "tracex_activeTitle",
        "tracex_startTime",
        "tracex_currentEventId",
        "tracex_activeTabId",
        "tracex_windowId",
        "tracex_isIdle",
        "isPaused",
    ]);

    state.activeDomain = stored.tracex_activeDomain || null;
    state.activeUrl = stored.tracex_activeUrl || null;
    state.activeTitle = stored.tracex_activeTitle || null;
    state.startTime = stored.tracex_startTime || null;
    state.currentEventId = stored.tracex_currentEventId || null;
    state.activeTabId = stored.tracex_activeTabId || null;
    state.windowId = stored.tracex_windowId || null;
    state.isIdle = !!stored.tracex_isIdle;
    state.isTrackingPaused = !!stored.isPaused;

    if (state.startTime) {
        console.log(`[TraceX] Recovered state: ${state.activeDomain} started at ${new Date(state.startTime).toISOString()}`);
    }
}

// ── Persist current state to chrome.storage.local ─────────────────────────────
function persistState() {
    chrome.storage.local.set({
        tracex_activeDomain: state.activeDomain,
        tracex_activeUrl: state.activeUrl,
        tracex_activeTitle: state.activeTitle,
        tracex_startTime: state.startTime,
        tracex_currentEventId: state.currentEventId,
        tracex_activeTabId: state.activeTabId,
        tracex_windowId: state.windowId,
        tracex_isIdle: state.isIdle,
    });
}

function clearPersistedState() {
    state.activeDomain = null;
    state.activeUrl = null;
    state.activeTitle = null;
    state.startTime = null;
    state.currentEventId = null;
    chrome.storage.local.set({
        tracex_activeDomain: null,
        tracex_activeUrl: null,
        tracex_activeTitle: null,
        tracex_startTime: null,
        tracex_currentEventId: null,
    });
}

// ── Get auth headers ───────────────────────────────────────────────────────────
async function getAuthHeaders() {
    const { tracex_user } = await chrome.storage.local.get("tracex_user");
    const headers = { "Content-Type": "application/json" };
    if (tracex_user && tracex_user.token) {
        headers["Authorization"] = `Bearer ${tracex_user.token}`;
    }
    return { headers, user: tracex_user };
}

// ── Enqueue a completed activity for sending ───────────────────────────────────
async function enqueueActivity(url, domain, title, startTime, exitTime, durationSeconds, eventId = null) {
    if (!url || !domain || durationSeconds < MIN_DURATION_SECONDS || isTraceXUrl(url)) return;

    const { user } = await getAuthHeaders();
    if (!user || !user.token || !user.user_id) {
        // Do not record or queue unauthenticated activities to prevent cross-user data leaks
        return;
    }
    const currentUserId = user.user_id;

    const pageTitle = title || (isPdfUrl(url) ? "PDF Document" : domain);
    const resolvedEventId = eventId || generateEventId(domain, startTime);

    const startIso = new Date(startTime).toISOString();
    const exitIso = exitTime ? new Date(exitTime).toISOString() : null;

    const event = {
        event_id: resolvedEventId,
        user_id: currentUserId,
        source: "chrome",
        url: url,
        domain: domain,
        title: pageTitle,
        page_title: pageTitle,
        visit_time: startIso,
        exit_time: exitIso,
        started_at: startIso,
        ended_at: exitIso,
        duration_seconds: Math.max(0, Math.round(durationSeconds)),
        tab_id: state.activeTabId,
        window_id: state.windowId,
    };

    const { tracex_pending } = await chrome.storage.local.get("tracex_pending");
    const pending = tracex_pending || [];

    // Deduplication: don't add if event_id already exists
    if (!pending.some(e => e.event_id === resolvedEventId)) {
        pending.push(event);
        await chrome.storage.local.set({ tracex_pending: pending });
        console.log(`[TraceX] Enqueued: ${domain} ${durationSeconds}s (user: ${currentUserId}, queue: ${pending.length})`);
    }

    flushPendingQueue();
}

// ── Flush pending queue to FastAPI ─────────────────────────────────────────────
async function flushPendingQueue() {
    const { tracex_pending } = await chrome.storage.local.get("tracex_pending");
    if (!tracex_pending || tracex_pending.length === 0) return;

    const { headers, user } = await getAuthHeaders();
    if (!user || !user.token || !user.user_id) {
        // Not linked or missing JWT: do not flush queue
        return;
    }

    const currentUserId = user.user_id;
    const stillPending = [];
    let sent = 0, failed = 0;

    for (const event of tracex_pending) {
        // Strict user boundary: never submit User A's queued activities under User B's token
        if (!event.user_id || event.user_id !== currentUserId) {
            stillPending.push(event);
            continue;
        }

        const success = await sendActivityToBackend(event);
        if (success) {
            sent++;
        } else {
            stillPending.push(event);
            failed++;
        }
    }

    await chrome.storage.local.set({ tracex_pending: stillPending });

    if (sent > 0 || failed > 0) {
        console.log(`[TraceX] Flush: sent=${sent}, pending=${failed}`);
    }
}

// ── Send a single completed activity event to FastAPI ─────────────────────────
async function sendActivityToBackend(event) {
    try {
        const { headers, user } = await getAuthHeaders();
        if (!user || !user.token) return false;

        const response = await fetch(`${API_BASE_URL}/api/activity-logs`, {
            method: "POST",
            headers,
            body: JSON.stringify(event),
            signal: AbortSignal.timeout(8000),
        });
        // 201 = created, 200 = already exists — both success
        if (response.ok || response.status === 409) {
            return true;
        }
        if (response.status === 401) {
            console.warn("[TraceX] Unauthorized event submission (token expired/invalid).");
        }
        return false;
    } catch {
        return false;  // Network error or timeout
    }
}

// ── Send Heartbeat with live activity to FastAPI ───────────────────────────────
// This is what populates /api/activity-logs/current on the backend.
async function sendHeartbeat() {
    try {
        const { headers, user } = await getAuthHeaders();
        if (!user || !user.token) {
            // Extension not yet linked to an active session
            return;
        }

        const { isPaused } = await chrome.storage.local.get("isPaused");
        const isSelf = state.activeUrl && isTraceXUrl(state.activeUrl);

        const heartbeatPayload = {
            version: "1.2",
            is_paused: !!isPaused,
            // Live activity — allows dashboard to show real-time status
            current_domain: state.isIdle || isPaused || isSelf ? null : state.activeDomain,
            current_title: state.isIdle || isPaused || isSelf ? null : state.activeTitle,
            current_url: state.isIdle || isPaused || isSelf ? null : state.activeUrl,
            started_at: state.startTime && !isSelf ? new Date(state.startTime).toISOString() : null,
            event_id: state.isIdle || isPaused || isSelf ? null : state.currentEventId,
            tab_id: state.activeTabId,
            window_id: state.windowId,
        };

        const resp = await fetch(`${API_BASE_URL}/api/activity-logs/extension-heartbeat`, {
            method: "POST",
            headers,
            body: JSON.stringify(heartbeatPayload),
            signal: AbortSignal.timeout(5000),
        });

        if (resp.ok) {
            const data = await resp.json();
            // If backend toggles pause state, sync it
            if (data.is_paused !== undefined && data.is_paused !== !!isPaused) {
                chrome.storage.local.set({ isPaused: data.is_paused });
            }
        }
    } catch {
        // Backend offline — ignore
    }
}

// ── Stop tracking current page ─────────────────────────────────────────────────
async function stopTracking() {
    if (!state.activeUrl || !state.activeDomain || !state.startTime) return;

    const exitTime = Date.now();
    const durationSeconds = Math.floor((exitTime - state.startTime) / 1000);

    if (durationSeconds >= MIN_DURATION_SECONDS) {
        await enqueueActivity(
            state.activeUrl,
            state.activeDomain,
            state.activeTitle,
            state.startTime,
            exitTime,
            durationSeconds,
            state.currentEventId
        );
    }

    clearPersistedState();
}

// ── Start tracking a new tab/page ─────────────────────────────────────────────
async function startTracking(tab) {
    if (state.isTrackingPaused || !tab || !tab.url) return;

    const { user } = await getAuthHeaders();
    if (!user || !user.token || !user.user_id) {
        clearPersistedState();
        return;
    }

    // Ignore TraceX dashboard completely
    if (isTraceXUrl(tab.url)) {
        clearPersistedState();
        sendHeartbeat();
        console.log(`[TraceX] Ignoring TraceX self-tracking: ${tab.url}`);
        return;
    }

    const domain = getDomain(tab.url);
    if (!domain) {
        clearPersistedState();
        return;
    }

    // If already tracking this exact tab/URL with an active session, preserve the timer
    if (state.activeDomain === domain && state.activeUrl === tab.url && state.startTime && state.currentEventId) {
        state.activeTabId = tab.id;
        state.windowId = tab.windowId || null;
        if (tab.title) state.activeTitle = tab.title;
        persistState();
        sendHeartbeat();
        return;
    }

    state.activeDomain = domain;
    state.activeUrl = tab.url;
    state.activeTitle = tab.title || (isPdfUrl(tab.url) ? "PDF Document" : domain);
    state.startTime = Date.now();
    state.currentEventId = generateEventId(domain, state.startTime);
    state.activeTabId = tab.id;
    state.windowId = tab.windowId || null;

    persistState();
    console.log(`[TraceX] Started tracking: ${domain}`);

    // Send heartbeat immediately so dashboard shows new activity right away
    sendHeartbeat();
}

// ── Query and start tracking the current active tab ───────────────────────────
// Called on startup, window focus, idle-end recovery
async function trackCurrentActiveTab() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length > 0 && !state.isIdle && !state.isTrackingPaused) {
            await startTracking(tabs[0]);
        }
    } catch (err) {
        console.error("[TraceX] Failed to query active tab:", err);
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ══════════════════════════════════════════════════════════════════════════════

// ── Tab becomes active ─────────────────────────────────────────────────────────
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    await stopTracking();
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        state.activeTabId = activeInfo.tabId;
        state.windowId = activeInfo.windowId;
        if (!state.isIdle && !state.isTrackingPaused) {
            await startTracking(tab);
        }
    } catch (err) {
        console.error("[TraceX] Tab activation error:", err);
    }
});

// ── URL changes in active tab ──────────────────────────────────────────────────
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (tabId !== state.activeTabId) return;

    if (changeInfo.url) {
        await stopTracking();
        if (!state.isIdle && !state.isTrackingPaused) {
            await startTracking(tab);
        }
        return;
    }

    // Title changed without URL change (SPA navigation, YouTube video title)
    if (changeInfo.title && state.activeUrl === tab.url) {
        state.activeTitle = changeInfo.title;
        persistState();
    }
});

// ── Tab closed ─────────────────────────────────────────────────────────────────
chrome.tabs.onRemoved.addListener(async (tabId) => {
    if (tabId === state.activeTabId) {
        await stopTracking();
        state.activeTabId = null;
        persistState();
    }
});

// ── Window focus changes ───────────────────────────────────────────────────────
chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        await stopTracking();
        return;
    }
    if (!state.isIdle && !state.isTrackingPaused) {
        try {
            const tabs = await chrome.tabs.query({ active: true, windowId });
            if (tabs.length > 0) {
                await startTracking(tabs[0]);
            }
        } catch (err) {
            console.error("[TraceX] Window focus error:", err);
        }
    }
});

// ── Idle state detection ───────────────────────────────────────────────────────
chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECS);

chrome.idle.onStateChanged.addListener(async (idleState) => {
    if (idleState === "idle" || idleState === "locked") {
        await stopTracking();
        state.isIdle = true;
        chrome.storage.local.set({ tracex_isIdle: true });
        // Tell backend live activity stopped
        sendHeartbeat();
    } else if (idleState === "active") {
        state.isIdle = false;
        chrome.storage.local.set({ tracex_isIdle: false });
        if (!state.isTrackingPaused) {
            await trackCurrentActiveTab();
        }
    }
});

// ── Pause / Resume ────────────────────────────────────────────────────────────
chrome.storage.onChanged.addListener(async (changes) => {
    if (!("isPaused" in changes)) return;

    const wasPaused = state.isTrackingPaused;
    state.isTrackingPaused = !!changes.isPaused.newValue;

    if (!wasPaused && state.isTrackingPaused) {
        await stopTracking();
        sendHeartbeat();
        console.log("[TraceX] Tracking paused");
    } else if (wasPaused && !state.isTrackingPaused) {
        console.log("[TraceX] Tracking resumed");
        if (!state.isIdle) {
            await trackCurrentActiveTab();
        }
    }
});

// ── Message handler for popup queries ─────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getTrackingState") {
        const duration = state.startTime
            ? Math.floor((Date.now() - state.startTime) / 1000)
            : 0;
        sendResponse({
            startTime: state.startTime,
            url: state.activeUrl,
            domain: state.activeDomain,
            title: state.activeTitle,
            isIdle: state.isIdle,
            isPaused: state.isTrackingPaused,
            durationSeconds: duration,
        });
    } else if (request.action === "getQueueSize") {
        chrome.storage.local.get("tracex_pending", (res) => {
            sendResponse({ queueSize: (res.tracex_pending || []).length });
        });
        return true;
    } else if (request.action === "forceFlush") {
        flushPendingQueue().then(() => sendResponse({ ok: true }));
        return true;
    } else if (request.action === "connectUser" || request.action === "userConnected") {
        console.log("[TraceX] Linked to user:", request.user);
        chrome.storage.local.get(["tracex_user", "tracex_pending"], (stored) => {
            const prevUser = stored.tracex_user;
            let pending = stored.tracex_pending || [];
            if (prevUser && prevUser.user_id && prevUser.user_id !== request.user.user_id) {
                pending = [];
                clearPersistedState();
            } else if (pending.length > 0) {
                pending = pending.filter(e => e.user_id === request.user.user_id);
            }
            chrome.storage.local.set({
                tracex_user: request.user,
                tracex_connected_by_tracex: true,
                tracex_pending: pending
            }, () => {
                sendHeartbeat();
                flushPendingQueue();
                sendResponse({ ok: true, user: request.user });
            });
        });
        return true;
    } else if (request.action === "logoutUser") {
        console.log("[TraceX] Disconnecting user session");
        chrome.storage.local.remove(["tracex_user", "tracex_connected_by_tracex", "tracex_pending"], () => {
            clearPersistedState();
            sendResponse({ ok: true });
        });
        return true;
    } else if (request.action === "togglePause") {
        state.isTrackingPaused = !!request.isPaused;
        chrome.storage.local.set({ isPaused: !!request.isPaused }, () => {
            sendResponse({ success: true, isPaused: !!request.isPaused });
        });
        return true;
    } else if (request.action === "syncChromeHistory" || request.action === "syncHistory") {
        syncChromeHistory().then(() => sendResponse({ ok: true }));
        return true;
    }
    return true;
});

// ── External messages from React web app ──────────────────────────────────────
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    if (request.action === "ping") {
        sendResponse({ installed: true, version: "1.2", isPaused: state.isTrackingPaused });
    } else if (request.action === "connectUser") {
        chrome.storage.local.get(["tracex_user", "tracex_pending"], (stored) => {
            const prevUser = stored.tracex_user;
            let pending = stored.tracex_pending || [];
            if (prevUser && prevUser.user_id && prevUser.user_id !== request.user.user_id) {
                pending = [];
                clearPersistedState();
            } else if (pending.length > 0) {
                pending = pending.filter(e => e.user_id === request.user.user_id);
            }
            chrome.storage.local.set({
                tracex_user: request.user,
                tracex_connected_by_tracex: true,
                tracex_pending: pending
            }, () => {
                sendHeartbeat();
                flushPendingQueue();
                sendResponse({ success: true, user: request.user });
            });
        });
        return true;
    } else if (request.action === "logoutUser") {
        chrome.storage.local.remove(["tracex_user", "tracex_connected_by_tracex", "tracex_pending"], () => {
            clearPersistedState();
            sendResponse({ success: true });
        });
        return true;
    } else if (request.action === "togglePause") {
        state.isTrackingPaused = !!request.isPaused;
        chrome.storage.local.set({ isPaused: !!request.isPaused }, () => {
            sendResponse({ success: true, isPaused: !!request.isPaused });
        });
        return true;
    } else if (request.action === "syncHistory" || request.action === "syncChromeHistory") {
        syncChromeHistory().then(() => sendResponse({ ok: true }));
        return true;
    }
    return true;
});

// ── Chrome History Sync ────────────────────────────────────────────────────────
// Pulls Chrome browser history and saves it to the browser_history MySQL table.
// This is separate from live activity tracking.
async function syncChromeHistory() {
    if (!chrome.history) {
        console.warn("[TraceX] chrome.history API not available (missing permission)");
        return;
    }

    try {
        const { headers, user } = await getAuthHeaders();
        if (!user || !user.token) {
            console.log("[TraceX] Cannot sync history: user not authenticated");
            return;
        }

        // Fetch history from last 7 days
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const items = await chrome.history.search({
            text: "",
            startTime: sevenDaysAgo,
            maxResults: 500,
        });

        if (!items || items.length === 0) {
            console.log("[TraceX] No Chrome history to sync");
            return;
        }

        // Filter out internal pages
        const filtered = items.filter(item => {
            const url = item.url || "";
            return !url.startsWith("chrome://") &&
                !url.startsWith("chrome-extension://") &&
                !url.startsWith("edge://") &&
                !url.startsWith("about:");
        });

        console.log(`[TraceX] Syncing ${filtered.length} Chrome history records...`);

        const BATCH_SIZE = 50;
let totalSaved = 0;
let failedBatches = 0;

for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
    const batch = filtered.slice(i, i + BATCH_SIZE);

    try {
        const resp = await fetch(
            `${API_BASE_URL}/api/activity-logs/browser-history`,
            {
                method: "POST",
                headers,
                body: JSON.stringify(
                    batch.map(item => ({
                        url: item.url,
                        title: item.title || item.url,
                        visit_count: item.visitCount || 1,
                        lastVisitTime: item.lastVisitTime
                    }))
                ),
                signal: AbortSignal.timeout(30000)
            }
        );

        if (!resp.ok) {
            console.error(
                `[TraceX] History batch failed: HTTP ${resp.status}`,
                await resp.text()
            );
            failedBatches++;
            continue;
        }

        const result = await resp.json();
        totalSaved += Number(result.count) || 0;

        console.log(
            `[TraceX] History batch ${Math.floor(i / BATCH_SIZE) + 1} saved`
        );
    } catch (err) {
        console.error("[TraceX] History batch error:", err);
        failedBatches++;
    }
}

console.log(
    `[TraceX] History sync finished: ${totalSaved} saved, ${failedBatches} failed batches`
);
    } catch (err) {
        console.error("[TraceX] History sync error:", err);
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// ALARMS — Periodic heartbeat and queue retry
// ══════════════════════════════════════════════════════════════════════════════

chrome.alarms.create("tracex_heartbeat", { periodInMinutes: 0.2 }); // every 12 seconds
chrome.alarms.create("tracex_retry", { periodInMinutes: 0.5 }); // every 30 seconds
chrome.alarms.create("tracex_history", { periodInMinutes: 60 }); // sync history hourly

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "tracex_heartbeat") {
        sendHeartbeat();
    } else if (alarm.name === "tracex_retry") {
        flushPendingQueue();
    } else if (alarm.name === "tracex_history") {
        syncChromeHistory();
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// SERVICE WORKER STARTUP & RECOVERY
// ══════════════════════════════════════════════════════════════════════════════

(async () => {
    await restoreState();
    chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECS);

    // Query the currently active tab in browser
    let currentTab = null;
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs.length > 0) {
            currentTab = tabs[0];
        }
    } catch (err) {
        console.warn("[TraceX] Query active tab during recovery error:", err);
    }

    const currentTabDomain = currentTab && currentTab.url ? getDomain(currentTab.url) : null;

    // Check if user is still on the same tab that was active before service worker restarted
    if (
        currentTab &&
        currentTabDomain &&
        state.activeDomain === currentTabDomain &&
        state.startTime &&
        !state.isTrackingPaused
    ) {
        // RECOVER CURRENT ACTIVITY WITHOUT LOSING STATE OR RESETTING TIMER
        console.log(`[TraceX] Recovered active tab via storage + tabs.query: ${state.activeDomain} (started at ${new Date(state.startTime).toISOString()})`);
        state.activeTabId = currentTab.id;
        state.windowId = currentTab.windowId || null;
        if (currentTab.title) state.activeTitle = currentTab.title;
        persistState();
    } else {
        // Tab changed or closed while service worker was inactive:
        // Finalize previous orphaned session if one existed
        if (state.startTime && state.activeUrl && !state.isTrackingPaused) {
            const durationSeconds = Math.floor((Date.now() - state.startTime) / 1000);
            if (durationSeconds >= MIN_DURATION_SECONDS) {
                console.log(`[TraceX] Finalizing orphaned session: ${state.activeDomain} ${durationSeconds}s`);
                await enqueueActivity(
                    state.activeUrl,
                    state.activeDomain,
                    state.activeTitle,
                    state.startTime,
                    Date.now(),
                    durationSeconds,
                    state.currentEventId
                );
            }
            clearPersistedState();
        }

        // Start tracking the new active tab if one exists
        if (currentTab && !state.isIdle && !state.isTrackingPaused) {
            await startTracking(currentTab);
        }
    }

    // Flush any buffered events from before the restart
    await flushPendingQueue();

    // Send initial heartbeat
    await sendHeartbeat();

    console.log(`[TraceX] Service worker v1.2 initialized. Tracking: ${!state.isTrackingPaused ? "ACTIVE" : "PAUSED"}`);
})();