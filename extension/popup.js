// TraceX popup.js — Polished production UI
"use strict";

const API_BASE_URL = "http://127.0.0.1:8000";
const DASHBOARD_URL = "http://127.0.0.1:5173/today";

// ── DOM Elements ─────────────────────────────────────────────────────────────
const trackingDot        = document.getElementById("trackingDot");
const trackingLabel      = document.getElementById("trackingLabel");
const currentPageDomain  = document.getElementById("currentPageDomain");
const currentPageTitle   = document.getElementById("currentPageTitle");
const currentDurationEl  = document.getElementById("currentDuration");
const activeTimeEl       = document.getElementById("activeTime");
const visitCountEl       = document.getElementById("visitCount");
const domainCountEl      = document.getElementById("domainCount");
const backendStatusGroup = document.getElementById("backendStatusGroup");
const backendDot         = document.getElementById("backendDot");
const backendStatusText  = document.getElementById("backendStatusText");
const pendingGroup       = document.getElementById("pendingGroup");
const queueCountEl       = document.getElementById("queueCount");
const offlineBufferMsg   = document.getElementById("offlineBufferMsg");
const toggleTrackingBtn  = document.getElementById("toggleTrackingBtn");
const dashboardBtn       = document.getElementById("dashboardBtn");

let pageStartTime = null;
let durationInterval = null;
let isCurrentlyPaused = false;

// ── Formatters ───────────────────────────────────────────────────────────────
function formatTimer(seconds) {
    if (!seconds || seconds < 0) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const h = Math.floor(m / 60);
    if (h > 0) {
        const remM = m % 60;
        return `${String(h).padStart(2, "0")}:${String(remM).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatMinutes(totalSeconds) {
    if (!totalSeconds || totalSeconds <= 0) return "0m";
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${totalSeconds}s`;
}

function extractDomain(url) {
    try {
        const parsed = new URL(url);
        return parsed.hostname.replace(/^www\./, "");
    } catch {
        return url || "";
    }
}

// ── Backend status UI ────────────────────────────────────────────────────────
function setBackendOnline(pendingCount = 0) {
    backendStatusGroup.className = "backend-status-badge";
    backendDot.className = "backend-dot";
    backendStatusText.textContent = "● Online";
    queueCountEl.textContent = pendingCount;
    if (pendingCount > 0) {
        pendingGroup.className = "pending-count has-pending";
        offlineBufferMsg.style.display = "block";
    } else {
        pendingGroup.className = "pending-count";
        offlineBufferMsg.style.display = "none";
    }
}

function setBackendOffline(pendingCount = 0) {
    backendStatusGroup.className = "backend-status-badge offline";
    backendDot.className = "backend-dot offline";
    backendStatusText.textContent = "● Backend Offline";
    queueCountEl.textContent = pendingCount;
    pendingGroup.className = "pending-count has-pending";
    offlineBufferMsg.style.display = "block";
}

// ── Tracking state UI ─────────────────────────────────────────────────────────
function updateTrackingUI(isPaused) {
    isCurrentlyPaused = !!isPaused;
    if (isCurrentlyPaused) {
        trackingDot.className = "beacon-dot paused";
        trackingLabel.textContent = "○ Tracking Paused";
        trackingLabel.className = "beacon-text paused";
        toggleTrackingBtn.textContent = "Resume Tracking";
        toggleTrackingBtn.className = "btn-tracking is-paused";
    } else {
        trackingDot.className = "beacon-dot";
        trackingLabel.textContent = "● Tracking Active";
        trackingLabel.className = "beacon-text";
        toggleTrackingBtn.textContent = "Pause Tracking";
        toggleTrackingBtn.className = "btn-tracking";
    }
}

// ── Live duration timer ───────────────────────────────────────────────────────
function startDurationTimer() {
    if (durationInterval) clearInterval(durationInterval);
    const update = () => {
        if (!pageStartTime || isCurrentlyPaused) return;
        const elapsed = Math.max(0, Math.floor((Date.now() - pageStartTime) / 1000));
        currentDurationEl.textContent = formatTimer(elapsed);
    };
    update();
    durationInterval = setInterval(update, 1000);
}

// ── Fetch today's activity stats ─────────────────────────────────────────────
async function fetchTodayStats() {
    try {
        const resp = await fetch(`${API_BASE_URL}/api/activity-logs/analytics/today`, {
            signal: AbortSignal.timeout(3500)
        });
        if (resp.ok) {
            const data = await resp.json();
            visitCountEl.textContent  = data.total_activities || 0;
            activeTimeEl.textContent  = formatMinutes(data.total_seconds || 0);
            domainCountEl.textContent = data.unique_domains || 0;
            checkQueueSize(true);
        } else {
            fallbackStats();
        }
    } catch {
        fallbackStats();
    }
}

async function fallbackStats() {
    try {
        const resp = await fetch(`${API_BASE_URL}/api/activity-logs/today`, {
            signal: AbortSignal.timeout(3000)
        });
        if (resp.ok) {
            const logs = await resp.json();
            const totalSeconds = logs.reduce((acc, l) => acc + (l.duration_seconds || 0), 0);
            const domains = new Set(logs.map(l => l.domain)).size;
            visitCountEl.textContent  = logs.length;
            activeTimeEl.textContent  = formatMinutes(totalSeconds);
            domainCountEl.textContent = domains;
            checkQueueSize(true);
        } else {
            checkQueueSize(false);
        }
    } catch {
        checkQueueSize(false);
    }
}

// ── Check pending queue size ─────────────────────────────────────────────────
function checkQueueSize(isOnline) {
    chrome.runtime.sendMessage({ action: "getQueueSize" }, (resp) => {
        const count = resp?.queueSize || 0;
        if (isOnline) {
            setBackendOnline(count);
        } else {
            setBackendOffline(count);
        }
    });
}

function isTraceXUrl(url) {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

// ── Update current page display ──────────────────────────────────────────────
function updateCurrentPage(tab) {
    if (!tab || !tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) {
        currentPageDomain.textContent = "TraceX Ready";
        currentPageTitle.textContent = "Navigate to any web page to record";
        currentDurationEl.textContent = "00:00";
        return;
    }

    if (isTraceXUrl(tab.url)) {
        currentPageDomain.textContent = "TraceX Dashboard";
        currentPageTitle.textContent = "Not tracked";
        currentDurationEl.textContent = "00:00";
        if (durationInterval) {
            clearInterval(durationInterval);
            durationInterval = null;
        }
        pageStartTime = null;
        return;
    }

    const domain = extractDomain(tab.url);
    const title = tab.title && tab.title !== tab.url ? tab.title : domain;
    currentPageDomain.textContent = domain;
    currentPageTitle.textContent = title;

    chrome.runtime.sendMessage({ action: "getTrackingState" }, (resp) => {
        if (chrome.runtime.lastError || !resp) return;
        if (resp.startTime && !resp.isPaused) {
            pageStartTime = resp.startTime;
            startDurationTimer();
        } else {
            pageStartTime = null;
            if (durationInterval) {
                clearInterval(durationInterval);
                durationInterval = null;
            }
            currentDurationEl.textContent = resp.isPaused ? "Paused" : "00:00";
        }
    });
}

// ── Toggle Tracking ──────────────────────────────────────────────────────────
toggleTrackingBtn.addEventListener("click", () => {
    const nextPaused = !isCurrentlyPaused;
    chrome.storage.local.set({ isPaused: nextPaused }, () => {
        updateTrackingUI(nextPaused);
        if (nextPaused) {
            if (durationInterval) { clearInterval(durationInterval); durationInterval = null; }
            pageStartTime = null;
            currentDurationEl.textContent = "Paused";
        } else {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs && tabs[0]) updateCurrentPage(tabs[0]);
            });
        }

        // Inform backend
        fetch(`${API_BASE_URL}/api/activity-logs/tracking-status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_paused: nextPaused })
        }).catch(() => {});
    });
});

// ── Open Dashboard ───────────────────────────────────────────────────────────
dashboardBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: DASHBOARD_URL });
});

// ── Initialize ───────────────────────────────────────────────────────────────
chrome.runtime.sendMessage({ action: "getTrackingState" }, (resp) => {
    if (chrome.runtime.lastError || !resp) {
        chrome.storage.local.get(["isPaused"], (res) => {
            updateTrackingUI(!!res.isPaused);
        });
    } else {
        updateTrackingUI(resp.isPaused);
    }
});

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) updateCurrentPage(tabs[0]);
});

fetchTodayStats();
