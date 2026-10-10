import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Puzzle,
} from 'lucide-react';
import { api, EXTENSION_CONNECTED_KEY } from '../api/api';

// Set this to the public Chrome Web Store listing after TraceX is published.
// Until then, the ZIP download uses the deployed backend endpoint.
const CHROME_WEB_STORE_URL = null;

export default function ConnectExtension({ onNavigate, user }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showManualGuide, setShowManualGuide] = useState(false);
  const [extensionVersion, setExtensionVersion] = useState(null);

  const checkLiveConnection = useCallback(async () => {
    setChecking(true);
    try {
      // Ask an installed TraceX extension to identify itself to this page.
      window.postMessage(
        {
          type: 'TRACEX_AUTO_CONNECT',
          connectedByTraceX: true,
          user: user || { user_id: 1, full_name: 'Student' },
        },
        '*'
      );

      const status = await api.getTrackingStatus().catch(() => null);
      if (status?.is_connected) {
        setIsConnected(true);
        setIsPaused(Boolean(status.is_paused));
        if (status.version) setExtensionVersion(status.version);
        localStorage.setItem(EXTENSION_CONNECTED_KEY, 'true');
        return;
      }

      const domActive = document.documentElement.getAttribute(
        'data-tracex-extension-active'
      );
      if (domActive) {
        setIsConnected(true);
        localStorage.setItem(EXTENSION_CONNECTED_KEY, 'true');
        return;
      }

      const currentActivity = await api.getCurrentActivity().catch(() => null);
      if (currentActivity?.active) {
        setIsConnected(true);
        localStorage.setItem(EXTENSION_CONNECTED_KEY, 'true');
      }
    } catch (error) {
      // A failed status request should not crash the onboarding page.
      console.warn('[TraceX] Connection check failed:', error);
    } finally {
      setChecking(false);
    }
  }, [user]);

  useEffect(() => {
    checkLiveConnection();

    const handleMessage = (event) => {
      if (event.source !== window || !event.data?.type) return;

      const extensionMessages = [
        'TRACEX_EXTENSION_AVAILABLE',
        'TRACEX_EXTENSION_STATUS',
        'TRACEX_EXTENSION_CONNECTED',
      ];
      if (!extensionMessages.includes(event.data.type)) return;

      setIsConnected(true);
      if (event.data.isPaused !== undefined) {
        setIsPaused(Boolean(event.data.isPaused));
      }
      if (event.data.version) setExtensionVersion(event.data.version);
      localStorage.setItem(EXTENSION_CONNECTED_KEY, 'true');
    };

    window.addEventListener('message', handleMessage);
    const intervalId = window.setInterval(checkLiveConnection, 10000);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.clearInterval(intervalId);
    };
  }, [checkLiveConnection]);

  const handleInstallClick = () => {
    if (CHROME_WEB_STORE_URL) {
      window.open(CHROME_WEB_STORE_URL, '_blank', 'noopener,noreferrer');
      return;
    }
    window.location.assign(api.getExtensionDownloadUrl());
  };

  return (
    <main className="tx-welcome">
      <div className="tx-welcome-glow tx-welcome-glow-one" aria-hidden="true" />
      <div className="tx-welcome-glow tx-welcome-glow-two" aria-hidden="true" />

      <div className="tx-welcome-content">
        <header className="tx-welcome-header">
          <div className="tx-welcome-mark" aria-hidden="true">
            <Sparkles size={25} strokeWidth={1.8} />
          </div>
          <div className="tx-welcome-eyebrow">YOUR DIGITAL LEARNING SPACE</div>
          <h1>Make your time online count.</h1>
          <p className="tx-welcome-subtitle">
            TraceX brings your browsing activity and learning resources together,
            so you can understand your digital day at a glance.
          </p>
        </header>

        <section className="tx-welcome-trust" aria-label="Privacy information">
          <div className="tx-welcome-trust-icon"><ShieldCheck size={21} /></div>
          <div>
            <h2>Your activity. Your control.</h2>
            <p>
              TraceX uses its browser extension to record activity. You can pause
              tracking whenever you choose.
            </p>
          </div>
          <span className="tx-welcome-private"><ShieldCheck size={14} /> Privacy first</span>
        </section>

        <section className="tx-welcome-card">
          <div className="tx-welcome-card-top">
            <div className="tx-welcome-step-icon"><Puzzle size={22} /></div>
            <div className="tx-welcome-card-copy">
              <div className="tx-welcome-step-label">GET STARTED</div>
              <h2>{isConnected ? 'Your browser is connected' : 'Connect your browser'}</h2>
              <p>
                {isConnected
                  ? 'TraceX has detected the extension. You can open your dashboard and start exploring your activity.'
                  : 'Install the TraceX Chrome extension to begin recording browser activity and discovering the resources you visit.'}
              </p>
            </div>
          </div>

          <div className="tx-welcome-actions">
            <button type="button" className="tx-welcome-primary" onClick={handleInstallClick}>
              {isConnected ? <CheckCircle2 size={18} /> : <Download size={18} />}
              <span>{isConnected ? 'Get extension again' : 'Get TraceX for Chrome'}</span>
              {!isConnected && <ArrowRight size={17} />}
            </button>
            <button
              type="button"
              className="tx-welcome-secondary"
              onClick={() => onNavigate('/today')}
            >
              Open dashboard <ArrowRight size={16} />
            </button>
          </div>

          <button
            type="button"
            className="tx-welcome-manual-toggle"
            onClick={() => setShowManualGuide((value) => !value)}
            aria-expanded={showManualGuide}
          >
            <span>Need help installing?</span>
            {showManualGuide ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
          </button>

          {showManualGuide && (
            <div className="tx-welcome-manual-guide">
              <p className="tx-welcome-guide-intro">
                The extension is currently provided as a ZIP file. Chrome requires
                a one-time manual setup for extensions that are not published in the Web Store.
              </p>
              <ol>
                <li>Click <strong>Get TraceX for Chrome</strong> to download the ZIP.</li>
                <li>Extract the ZIP file to a folder on your computer.</li>
                <li>Open <code>chrome://extensions</code> and turn on <strong>Developer mode</strong>.</li>
                <li>Choose <strong>Load unpacked</strong> and select the extracted <code>extension</code> folder.</li>
                <li>Return to TraceX and click <strong>Check connection</strong> below.</li>
              </ol>
            </div>
          )}
        </section>

        <section className={`tx-welcome-connection ${isConnected ? 'is-connected' : 'is-disconnected'}`}>
          <div className="tx-welcome-connection-indicator" aria-hidden="true" />
          <div className="tx-welcome-connection-copy">
            <strong>{isConnected ? (isPaused ? 'Extension connected · Tracking paused' : 'Extension connected · Tracking active') : 'Extension not connected yet'}</strong>
            <span>
              {isConnected
                ? `Ready to use${extensionVersion ? ` · Version ${extensionVersion}` : ''}`
                : 'Install the extension, then check the connection.'}
            </span>
          </div>
          <button
            type="button"
            className="tx-welcome-check"
            onClick={checkLiveConnection}
            disabled={checking}
          >
            <RefreshCw size={15} className={checking ? 'tx-welcome-spin' : ''} />
            {checking ? 'Checking…' : 'Check connection'}
          </button>
        </section>

        <footer className="tx-welcome-footer">
          <span>TRACE X</span>
          <span>Understand your digital day, one session at a time.</span>
        </footer>
      </div>

      <style>{`
        .tx-welcome {
          --tx-gold: #d8b66a;
          --tx-gold-light: #f1d99b;
          --tx-text: #f7f5ef;
          --tx-muted: #a6a8b6;
          min-height: 100vh;
          position: relative;
          isolation: isolate;
          overflow: hidden;
          display: flex;
          justify-content: center;
          padding: clamp(28px, 5vw, 64px) 20px 32px;
          background: radial-gradient(ellipse at 50% 0%, #172033 0%, #090c14 52%, #070910 100%);
          color: var(--tx-text);
          font-family: inherit;
        }
        .tx-welcome-glow { position: absolute; z-index: -1; width: 360px; height: 360px; border-radius: 50%; filter: blur(100px); opacity: .12; pointer-events: none; }
        .tx-welcome-glow-one { top: 4%; left: -160px; background: #d8b66a; }
        .tx-welcome-glow-two { right: -170px; top: 38%; background: #6476c8; }
        .tx-welcome-content { width: 100%; max-width: 790px; margin: auto; display: flex; flex-direction: column; gap: 22px; }
        .tx-welcome-header { text-align: center; padding: 4px 12px 12px; }
        .tx-welcome-mark { width: 54px; height: 54px; margin: 0 auto 19px; display: grid; place-items: center; color: var(--tx-gold-light); border: 1px solid #8b784c70; border-radius: 17px; background: linear-gradient(145deg, #202536, #10131d); box-shadow: 0 12px 40px #d8b66a12; }
        .tx-welcome-eyebrow { color: var(--tx-gold); font-size: 10px; font-weight: 800; letter-spacing: .22em; margin-bottom: 12px; }
        .tx-welcome-header h1 { margin: 0; font-size: clamp(30px, 5vw, 43px); line-height: 1.12; letter-spacing: -.045em; font-weight: 760; }
        .tx-welcome-subtitle { max-width: 580px; margin: 15px auto 0; color: #b7bbc8; font-size: 15px; line-height: 1.75; }
        .tx-welcome-trust, .tx-welcome-card, .tx-welcome-connection { border: 1px solid #ffffff13; background: linear-gradient(135deg, #151b29ed, #101521ed); box-shadow: 0 18px 50px #0000001a; backdrop-filter: blur(18px); }
        .tx-welcome-trust { display: flex; align-items: center; gap: 14px; padding: 17px 19px; border-radius: 17px; }
        .tx-welcome-trust-icon { width: 42px; height: 42px; flex: 0 0 42px; display: grid; place-items: center; border-radius: 13px; color: var(--tx-gold); background: #d8b66a13; border: 1px solid #d8b66a30; }
        .tx-welcome-trust h2 { margin: 0 0 4px; font-size: 14px; font-weight: 700; }
        .tx-welcome-trust p { margin: 0; color: var(--tx-muted); font-size: 12.5px; line-height: 1.6; }
        .tx-welcome-private { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; color: #b6d9c5; font-size: 11px; border: 1px solid #4c997d35; background: #14312640; border-radius: 999px; padding: 7px 10px; }
        .tx-welcome-card { border-radius: 22px; padding: clamp(21px, 4vw, 32px); }
        .tx-welcome-card-top { display: flex; align-items: flex-start; gap: 16px; }
        .tx-welcome-step-icon { width: 48px; height: 48px; flex: 0 0 48px; display: grid; place-items: center; border-radius: 15px; color: var(--tx-gold-light); background: #d8b66a15; border: 1px solid #d8b66a35; }
        .tx-welcome-card-copy { flex: 1; }
        .tx-welcome-step-label { color: var(--tx-gold); font-size: 10px; font-weight: 800; letter-spacing: .17em; margin: 2px 0 7px; }
        .tx-welcome-card-copy h2 { margin: 0 0 8px; font-size: 21px; letter-spacing: -.02em; }
        .tx-welcome-card-copy p { max-width: 570px; margin: 0; color: var(--tx-muted); font-size: 13.5px; line-height: 1.7; }
        .tx-welcome-actions { display: flex; flex-wrap: wrap; gap: 11px; margin: 25px 0 0 64px; }
        .tx-welcome-primary, .tx-welcome-secondary, .tx-welcome-check { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 9px; border-radius: 11px; padding: 0 17px; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; transition: transform .18s ease, border-color .18s ease, background .18s ease; }
        .tx-welcome-primary { color: #17140d; border: 1px solid #f1d99b; background: linear-gradient(135deg, #f1d99b, #c9a653); box-shadow: 0 7px 25px #d8b66a1c; }
        .tx-welcome-secondary { color: #e8e7e1; background: #ffffff06; border: 1px solid #ffffff1c; }
        .tx-welcome-primary:hover, .tx-welcome-secondary:hover, .tx-welcome-check:hover { transform: translateY(-1px); }
        .tx-welcome-secondary:hover { border-color: #d8b66a70; }
        .tx-welcome-manual-toggle { width: 100%; margin-top: 22px; padding: 16px 0 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #c5c7d1; background: transparent; border: 0; border-top: 1px solid #ffffff12; font: inherit; font-size: 12.5px; cursor: pointer; text-align: left; }
        .tx-welcome-manual-toggle:hover { color: var(--tx-gold-light); }
        .tx-welcome-manual-guide { margin-top: 14px; padding: 16px 18px; border: 1px solid #ffffff12; border-radius: 13px; background: #080b1280; color: #c4c7d2; font-size: 12.5px; line-height: 1.75; }
        .tx-welcome-guide-intro { margin: 0 0 10px; color: var(--tx-muted); }
        .tx-welcome-manual-guide ol { margin: 0; padding-left: 20px; }
        .tx-welcome-manual-guide li { padding: 3px 0 3px 3px; }
        .tx-welcome-manual-guide strong { color: #f0dfb4; }
        .tx-welcome-manual-guide code { padding: 2px 5px; border-radius: 5px; color: var(--tx-gold-light); background: #ffffff0d; font-size: 11.5px; }
        .tx-welcome-connection { display: flex; align-items: center; gap: 12px; padding: 15px 17px; border-radius: 15px; }
        .tx-welcome-connection-indicator { width: 9px; height: 9px; flex: 0 0 9px; border-radius: 50%; background: #e3a84d; box-shadow: 0 0 0 4px #e3a84d18; }
        .tx-welcome-connection.is-connected .tx-welcome-connection-indicator { background: #4fd1a1; box-shadow: 0 0 0 4px #4fd1a118; }
        .tx-welcome-connection-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 4px; }
        .tx-welcome-connection-copy strong { font-size: 12.5px; font-weight: 700; }
        .tx-welcome-connection.is-connected .tx-welcome-connection-copy strong { color: #73ddb5; }
        .tx-welcome-connection-copy span { color: var(--tx-muted); font-size: 11.5px; line-height: 1.5; }
        .tx-welcome-check { min-height: 36px; padding: 0 11px; flex-shrink: 0; color: #d9dbe4; background: #ffffff08; border: 1px solid #ffffff1a; font-size: 11.5px; }
        .tx-welcome-check:disabled { opacity: .65; cursor: wait; }
        .tx-welcome-spin { animation: tx-welcome-spin 1s linear infinite; }
        .tx-welcome-footer { display: flex; justify-content: space-between; gap: 12px; padding: 5px 3px; color: #74798b; font-size: 10px; }
        .tx-welcome-footer span:first-child { color: #c8b27b; font-weight: 800; letter-spacing: .18em; }
        @keyframes tx-welcome-spin { to { transform: rotate(360deg); } }
        @media (max-width: 600px) {
          .tx-welcome { padding: 28px 14px 22px; }
          .tx-welcome-content { gap: 15px; }
          .tx-welcome-header { padding-bottom: 5px; }
          .tx-welcome-subtitle { font-size: 13.5px; }
          .tx-welcome-trust { align-items: flex-start; padding: 14px; }
          .tx-welcome-private { display: none; }
          .tx-welcome-card { padding: 20px 16px; }
          .tx-welcome-card-top { gap: 12px; }
          .tx-welcome-step-icon { width: 42px; height: 42px; flex-basis: 42px; }
          .tx-welcome-card-copy h2 { font-size: 18px; }
          .tx-welcome-actions { margin-left: 0; flex-direction: column; }
          .tx-welcome-primary, .tx-welcome-secondary { width: 100%; }
          .tx-welcome-connection { align-items: flex-start; flex-wrap: wrap; }
          .tx-welcome-check { margin-left: 21px; }
          .tx-welcome-footer { flex-direction: column; align-items: center; text-align: center; }
        }
      `}</style>
    </main>
  );
}
