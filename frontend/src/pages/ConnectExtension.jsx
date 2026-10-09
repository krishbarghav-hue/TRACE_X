import React, { useState, useEffect } from 'react';
import {
  Download,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Radio,
  RefreshCw,
  Chrome,
  Copy,
  Check,
  Zap,
  Info,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { api, EXTENSION_CONNECTED_KEY } from '../api/api';

// For production deployment, set CHROME_WEB_STORE_URL to the published extension URL.
// When null, the UI defaults to the local unpacked-extension workflow.
const CHROME_WEB_STORE_URL = null;

const EXTENSION_LOCAL_PATH = `c:\\Users\\NEHA\\Downloads\\HISTORYLENS (3)\\HISTORYLENS\\TRACE_X\\extension`;

export default function ConnectExtension({ onNavigate, user }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [checking, setChecking] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showUnpackedGuide, setShowUnpackedGuide] = useState(true);
  const [extensionVersion, setExtensionVersion] = useState(null);

  // Check actual live connection from extension and backend
  const checkLiveConnection = async () => {
    setChecking(true);
    try {
      // 1. Send handshake ping to extension via window postMessage
      window.postMessage({
        type: 'TRACEX_AUTO_CONNECT',
        connectedByTraceX: true,
        user: user || { user_id: 1, full_name: 'Student' },
      }, '*');

      // 2. Query backend tracking status (verifies extension heartbeats)
      const status = await api.getTrackingStatus().catch(() => null);
      if (status && status.is_connected) {
        setIsConnected(true);
        setIsPaused(!!status.is_paused);
        if (status.version) setExtensionVersion(status.version);
        localStorage.setItem(EXTENSION_CONNECTED_KEY, 'true');
        return;
      }

      // 3. Fallback: check DOM attribute set by content script
      const isDomActive = document.documentElement.getAttribute('data-tracex-extension-active');
      if (isDomActive) {
        setIsConnected(true);
        localStorage.setItem(EXTENSION_CONNECTED_KEY, 'true');
        return;
      }

      // Check current live activity
      const currentAct = await api.getCurrentActivity().catch(() => null);
      if (currentAct && currentAct.active) {
        setIsConnected(true);
        localStorage.setItem(EXTENSION_CONNECTED_KEY, 'true');
        return;
      }
    } catch {
      // offline or not yet connected
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkLiveConnection();

    // Listen for extension handshake events
    const handleMessage = (event) => {
      if (event.source !== window || !event.data || !event.data.type) return;

      if (
        event.data.type === 'TRACEX_EXTENSION_AVAILABLE' ||
        event.data.type === 'TRACEX_EXTENSION_STATUS' ||
        event.data.type === 'TRACEX_EXTENSION_CONNECTED'
      ) {
        setIsConnected(true);
        if (event.data.isPaused !== undefined) {
          setIsPaused(event.data.isPaused);
        }
        if (event.data.version) {
          setExtensionVersion(event.data.version);
        }
        localStorage.setItem(EXTENSION_CONNECTED_KEY, 'true');
      }
    };

    window.addEventListener('message', handleMessage);
    const pollInterval = setInterval(checkLiveConnection, 3000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(pollInterval);
    };
  }, []);

  const handleCopyPath = () => {
    navigator.clipboard.writeText(EXTENSION_LOCAL_PATH);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleInstallClick = () => {
    if (CHROME_WEB_STORE_URL) {
      window.open(CHROME_WEB_STORE_URL, '_blank', 'noopener,noreferrer');
    } else {
      // Download unpacked extension zip archive
      window.location.href = api.getExtensionDownloadUrl();
    }
  };

  return (
    <div className="tx-onboarding-page">
      <div className="tx-onboarding-bg">
        <img
          src="/mountain_hero_panorama.jpg"
          alt="Panoramic Twilight Mountains"
          className="tx-onboarding-bg-img"
        />
        <div className="tx-onboarding-bg-overlay" />
      </div>

      <div className="tx-onboarding-container">
        {/* Header with Glass Language */}
        <div className="tx-onboarding-header">
          <div className="tx-onboarding-logo-badge">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 4C9 1 3 3 2 9C1 15 7 19 12 21C17 19 23 15 22 9C21 3 15 1 12 4Z"
                fill="url(#ob-logo-grad)"
              />
              <path
                d="M12 6C10 3 6 4 5 8C4 12 8 16 12 18C16 16 20 12 19 8C18 4 14 3 12 6Z"
                fill="#070b14"
                opacity="0.35"
              />
              <defs>
                <linearGradient id="ob-logo-grad" x1="2" y1="2" x2="22" y2="22">
                  <stop stopColor="#a855f7" />
                  <stop offset="0.5" stopColor="#6366f1" />
                  <stop offset="1" stopColor="#0ea5e9" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="tx-onboarding-title">Welcome to TraceX</h1>
          <p className="tx-onboarding-subtitle">
            TraceX helps you understand how you spend your digital day.
          </p>
        </div>

        {/* Privacy Architecture Clarification Banner */}
        <div className="tx-glass-card tx-explainer-banner">
          <div className="tx-explainer-left">
            <div className="tx-explainer-icon-box">
              <ShieldCheck size={22} color="#10b981" />
            </div>
            <div>
              <div className="tx-explainer-title">How TraceX Activity Tracking Works</div>
              <div className="tx-explainer-points">
                <span className="tx-point-item">
                  <strong>1. Local Collector:</strong> The website itself does not monitor browser activity.
                </span>
                <span className="tx-point-sep">·</span>
                <span className="tx-point-item">
                  <strong>2. Chrome Extension:</strong> The extension is the local activity collector.
                </span>
                <span className="tx-point-sep">·</span>
                <span className="tx-point-item">
                  <strong>3. Private Storage:</strong> The extension sends activity securely to your local TraceX backend and MySQL database.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3-Step Linear Onboarding Cards */}
        <div className="tx-steps-flow">
          {/* STEP 1: Install the Chrome Extension */}
          <div className={`tx-glass-card tx-step-card ${isConnected ? 'tx-step-complete' : 'tx-step-active'}`}>
            <div className="tx-step-card-header">
              <div className="tx-step-badge">
                {isConnected ? <Check size={14} color="#10b981" /> : 'Step 1'}
              </div>
              <div className="tx-step-title-wrap">
                <h3 className="tx-step-title">Install the Chrome Extension</h3>
                <p className="tx-step-desc">
                  Download or load the TraceX extension to collect your browsing sessions securely.
                </p>
              </div>
            </div>

            <div className="tx-step-card-body">
              <div className="tx-install-action-row">
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="tx-btn-primary tx-btn-glow"
                >
                  <Download size={16} />
                  <span>{CHROME_WEB_STORE_URL ? 'Install from Chrome Web Store' : 'Install Extension (.zip)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowUnpackedGuide(!showUnpackedGuide)}
                  className="tx-btn-ghost-sm"
                  style={{ color: '#cbd5e1' }}
                >
                  <Chrome size={15} color="#38bdf8" />
                  <span>Load Unpacked (Dev)</span>
                  {showUnpackedGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {/* Unpacked Dev Guide */}
              {showUnpackedGuide && (
                <div className="tx-unpacked-guide-box">
                  <div className="tx-unpacked-path-row">
                    <span className="tx-unpacked-label">Local Extension Folder:</span>
                    <div className="tx-code-path-wrap">
                      <code>{EXTENSION_LOCAL_PATH}</code>
                      <button
                        type="button"
                        onClick={handleCopyPath}
                        className="tx-btn-copy-sm"
                        title="Copy folder path"
                      >
                        {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="tx-guide-steps-list">
                    <div className="tx-guide-step">
                      <span className="tx-step-num">1</span>
                      <span>Navigate to <code>chrome://extensions</code> in Chrome and enable <strong>Developer mode</strong>.</span>
                    </div>
                    <div className="tx-guide-step">
                      <span className="tx-step-num">2</span>
                      <span>Click <strong>Load unpacked</strong>.</span>
                    </div>
                    <div className="tx-guide-step">
                      <span className="tx-step-num">3</span>
                      <span>Select the TraceX <code>extension</code> folder above.</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* STEP 2: Connect TraceX */}
          <div className={`tx-glass-card tx-step-card ${isConnected ? 'tx-step-complete' : 'tx-step-active'}`}>
            <div className="tx-step-card-header">
              <div className="tx-step-badge">
                {isConnected ? <Check size={14} color="#10b981" /> : 'Step 2'}
              </div>
              <div className="tx-step-title-wrap">
                <h3 className="tx-step-title">Connect TraceX</h3>
                <p className="tx-step-desc">
                  Autonomous handshake verifies that the extension is active and sending heartbeats.
                </p>
              </div>
            </div>

            <div className="tx-step-card-body">
              <div className="tx-connection-status-pill">
                {isConnected ? (
                  <div className="tx-status-connected-box">
                    <div className="tx-status-pulse-container">
                      <span className="tx-status-beacon tx-beacon-active" />
                      <span className="tx-status-beacon-ring tx-ring-active" />
                    </div>
                    <div className="tx-status-info">
                      <span className="tx-status-tag-green">● Extension detected</span>
                      <span className="tx-status-meta">
                        Tracking Active {extensionVersion ? `· v${extensionVersion}` : ''} · Connected to FastAPI & MySQL
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="tx-status-disconnected-box">
                    <div className="tx-status-pulse-container">
                      <span className="tx-status-beacon tx-beacon-idle" />
                    </div>
                    <div className="tx-status-info">
                      <span className="tx-status-tag-amber">○ Waiting for extension connection...</span>
                      <span className="tx-status-meta">
                        Load the extension in Chrome to complete connection.
                      </span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={checkLiveConnection}
                  disabled={checking}
                  className="tx-btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '13px' }}
                >
                  <RefreshCw size={14} className={checking ? 'tx-rotating' : ''} />
                  <span>{checking ? 'Checking…' : 'Check Connection'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* STEP 3: Start Tracking & Open Dashboard */}
          <div className={`tx-glass-card tx-step-card ${isConnected ? 'tx-step-ready' : 'tx-step-disabled'}`}>
            <div className="tx-step-card-header">
              <div className="tx-step-badge">Step 3</div>
              <div className="tx-step-title-wrap">
                <h3 className="tx-step-title">Start Tracking</h3>
                <p className="tx-step-desc">
                  Browse normally. Every visit, duration, and learning session will be visualized.
                </p>
              </div>
            </div>

            <div className="tx-step-card-body">
              <button
                type="button"
                onClick={() => onNavigate('/today')}
                className={`tx-btn-primary tx-btn-full tx-btn-glow tx-btn-lg ${!isConnected ? 'tx-btn-muted' : ''}`}
              >
                <span>Open Dashboard</span>
                <ArrowRight size={18} />
              </button>

              {!isConnected && (
                <div className="tx-step-footnote">
                  <span>Want to preview the dashboard first?</span>
                  <button
                    type="button"
                    onClick={() => onNavigate('/today')}
                    className="tx-link-btn"
                  >
                    Open Dashboard anyway →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .tx-onboarding-page {
          min-height: 100vh;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          background: #070b14;
          font-family: inherit;
        }

        .tx-onboarding-bg {
          position: absolute;
          inset: 0;
          overflow: hidden;
          z-index: 0;
        }

        .tx-onboarding-bg-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: brightness(0.32) saturate(1.2);
        }

        .tx-onboarding-bg-overlay {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle, rgba(7, 11, 20, 0.65) 0%, #070b14 92%);
        }

        .tx-onboarding-container {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 760px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .tx-onboarding-header {
          text-align: center;
          margin-bottom: 8px;
        }

        .tx-onboarding-logo-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          border-radius: 16px;
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 10px 30px rgba(99, 102, 241, 0.25);
          margin-bottom: 16px;
        }

        .tx-onboarding-title {
          font-size: 28px;
          font-weight: 800;
          color: #f8fafc;
          letter-spacing: -0.5px;
          margin: 0 0 8px 0;
        }

        .tx-onboarding-subtitle {
          font-size: 15px;
          color: #cbd5e1;
          margin: 0;
        }

        /* Glass Explainer Banner */
        .tx-explainer-banner {
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(16, 185, 129, 0.25);
          border-radius: 16px;
          padding: 16px 20px;
          box-shadow: 0 15px 40px rgba(0, 0, 0, 0.4), 0 0 25px rgba(16, 185, 129, 0.08);
        }

        .tx-explainer-left {
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }

        .tx-explainer-icon-box {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .tx-explainer-title {
          font-size: 14px;
          font-weight: 700;
          color: #f8fafc;
          margin-bottom: 4px;
        }

        .tx-explainer-points {
          font-size: 12.5px;
          color: #cbd5e1;
          line-height: 1.5;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .tx-point-item strong {
          color: #a7f3d0;
        }

        .tx-point-sep {
          color: #475569;
        }

        /* Steps Flow */
        .tx-steps-flow {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .tx-step-card {
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 18px;
          padding: 24px 28px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
          transition: all 0.2s ease;
        }

        .tx-step-card-header {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 16px;
        }

        .tx-step-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.5px;
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.35);
          color: #a5b4fc;
          flex-shrink: 0;
        }

        .tx-step-complete .tx-step-badge {
          background: rgba(16, 185, 129, 0.15);
          border-color: rgba(16, 185, 129, 0.35);
          color: #34d399;
        }

        .tx-step-title {
          font-size: 17px;
          font-weight: 700;
          color: #f8fafc;
          margin: 0 0 4px 0;
        }

        .tx-step-desc {
          font-size: 13px;
          color: #cbd5e1;
          margin: 0;
          line-height: 1.4;
        }

        .tx-install-action-row {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }

        /* Unpacked dev guide */
        .tx-unpacked-guide-box {
          margin-top: 16px;
          padding: 16px;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .tx-unpacked-path-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .tx-unpacked-label {
          font-size: 11.5px;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .tx-code-path-wrap {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 6px 12px;
          gap: 10px;
        }

        .tx-code-path-wrap code {
          font-family: monospace;
          font-size: 12.5px;
          color: #38bdf8;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .tx-btn-copy-sm {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          background: rgba(99, 102, 241, 0.2);
          border: 1px solid rgba(99, 102, 241, 0.35);
          border-radius: 6px;
          color: #a5b4fc;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.15s;
        }

        .tx-btn-copy-sm:hover {
          background: rgba(99, 102, 241, 0.3);
          color: #ffffff;
        }

        .tx-guide-steps-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .tx-guide-step {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: #cbd5e1;
        }

        .tx-step-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          font-size: 11px;
          font-weight: 700;
          color: #f8fafc;
          flex-shrink: 0;
        }

        .tx-guide-step code {
          background: rgba(255, 255, 255, 0.1);
          padding: 1px 6px;
          border-radius: 4px;
          color: #38bdf8;
          font-family: monospace;
        }

        /* Step 2 connection pill */
        .tx-connection-status-pill {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          gap: 14px;
          flex-wrap: wrap;
        }

        .tx-status-connected-box,
        .tx-status-disconnected-box {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .tx-status-tag-green {
          font-size: 14px;
          font-weight: 700;
          color: #10b981;
          display: block;
        }

        .tx-status-tag-amber {
          font-size: 14px;
          font-weight: 700;
          color: #f59e0b;
          display: block;
        }

        .tx-status-meta {
          font-size: 12px;
          color: #94a3b8;
          display: block;
          margin-top: 2px;
        }

        .tx-btn-lg {
          padding: 14px 24px;
          font-size: 15px;
          font-weight: 700;
        }

        .tx-step-footnote {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 12.5px;
          color: #94a3b8;
          margin-top: 12px;
        }

        .tx-rotating {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
