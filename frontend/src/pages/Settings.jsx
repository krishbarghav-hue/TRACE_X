import React, { useState, useEffect } from 'react';
import {
  User,
  Shield,
  Server,
  Radio,
  Pause,
  Play,
  Sun,
  Moon,
  LogOut,
  Download,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { api, EXTENSION_CONNECTED_KEY } from '../api/api';

export default function Settings({ onNavigate, onLogout, theme, onToggleTheme }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isExtensionConnected, setIsExtensionConnected] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    // Load current user
    const user = api.getCurrentUser() || { user_id: 1, full_name: 'Krishna', email: 'test@tracex.com' };
    setCurrentUser(user);

    // Fetch tracking status from backend
    fetchTrackingStatus();

    // Check extension via postMessage
    window.postMessage({ type: 'TRACEX_WEB_PING' }, '*');

    const handleMessage = (e) => {
      if (e.source !== window || !e.data) return;
      if (e.data.type === 'TRACEX_EXTENSION_STATUS' || e.data.type === 'TRACEX_EXTENSION_AVAILABLE') {
        setIsExtensionConnected(true);
        if (e.data.isPaused !== undefined) {
          setIsPaused(e.data.isPaused);
        }
      } else if (e.data.type === 'TRACEX_EXTENSION_PAUSE_CHANGED') {
        setIsPaused(e.data.isPaused);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const fetchTrackingStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await api.getTrackingStatus();
      if (res) {
        setIsPaused(!!res.is_paused);
        if (res.is_connected || localStorage.getItem(EXTENSION_CONNECTED_KEY) === 'true') {
          setIsExtensionConnected(true);
        }
      }
    } catch {
      // Backend offline or error
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleTogglePause = async () => {
    const newPaused = !isPaused;
    setIsPaused(newPaused);

    // 1. Notify extension via content script
    window.postMessage({
      type: 'TRACEX_WEB_TOGGLE_PAUSE',
      isPaused: newPaused,
    }, '*');

    // 2. Notify backend
    try {
      await api.setTrackingStatus(newPaused);
      setStatusMsg(newPaused ? 'Tracking paused successfully.' : 'Tracking resumed successfully.');
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (err) {
      setStatusMsg('Updated locally; failed to sync to backend.');
      setTimeout(() => setStatusMsg(''), 3000);
    }
  };

  const handleExportData = async () => {
    try {
      const logs = await api.getTodayActivities();
      const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tracex_activity_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Could not export activity logs at this time.');
    }
  };

  return (
    <div className="tx-settings-container">
      <div className="tx-settings-header">
        <div>
          <h1 className="tx-settings-title">Settings & System Preferences</h1>
          <p className="tx-settings-subtitle">Manage your account, browser tracking controls, and local data policies.</p>
        </div>
      </div>

      {statusMsg && (
        <div className="tx-settings-alert-success">
          <CheckCircle2 size={16} />
          <span>{statusMsg}</span>
        </div>
      )}

      <div className="tx-settings-grid">
        {/* Card 1: Account Settings */}
        <div className="tx-glass-card tx-settings-card">
          <div className="tx-card-header">
            <div className="tx-icon-box tx-icon-blue">
              <User size={18} />
            </div>
            <div>
              <h3 className="tx-settings-card-title">User Account</h3>
              <span className="tx-settings-card-sub">Authenticated TraceX profile</span>
            </div>
          </div>

          <div className="tx-account-details">
            <div className="tx-detail-row">
              <span className="tx-detail-lbl">Full Name</span>
              <span className="tx-detail-val">{currentUser?.full_name || 'Krishna'}</span>
            </div>
            <div className="tx-detail-row">
              <span className="tx-detail-lbl">Email Address</span>
              <span className="tx-detail-val">{currentUser?.email || 'test@tracex.com'}</span>
            </div>
            <div className="tx-detail-row">
              <span className="tx-detail-lbl">User ID</span>
              <span className="tx-detail-val">#{currentUser?.user_id || 1}</span>
            </div>
          </div>

          <div className="tx-settings-action-row">
            <button
              onClick={() => onLogout && onLogout()}
              className="tx-btn-danger-outline"
            >
              <LogOut size={15} />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        {/* Card 2: Tracking Status & Pause Switch */}
        <div className="tx-glass-card tx-settings-card">
          <div className="tx-card-header">
            <div className={`tx-icon-box ${isPaused ? 'tx-icon-orange' : 'tx-icon-emerald'}`}>
              <Radio size={18} />
            </div>
            <div>
              <h3 className="tx-settings-card-title">Tracking Status</h3>
              <span className="tx-settings-card-sub">Live communication with Chrome extension</span>
            </div>
          </div>

          <div className="tx-tracking-control-box">
            <div className="tx-tcb-info">
              <div className="tx-tcb-status">
                <span className={`tx-status-dot ${isPaused ? 'tx-dot-paused' : 'tx-dot-green'}`} />
                <span className="tx-tcb-label">{isPaused ? 'Tracking Paused' : 'Tracking Active'}</span>
              </div>
              <p className="tx-tcb-desc">
                {isPaused
                  ? 'The extension will not record new tab visits or durations while paused.'
                  : 'Browsing telemetry is being recorded and saved to your local database.'}
              </p>
            </div>

            <button
              onClick={handleTogglePause}
              className={`tx-btn-toggle-tracking ${isPaused ? 'tx-btn-resume-glow' : 'tx-btn-pause-glow'}`}
            >
              {isPaused ? (
                <>
                  <Play size={16} />
                  <span>Resume Tracking</span>
                </>
              ) : (
                <>
                  <Pause size={16} />
                  <span>Pause Tracking</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Card 3: Extension Status */}
        <div className="tx-glass-card tx-settings-card">
          <div className="tx-card-header">
            <div className="tx-icon-box tx-icon-purple">
              <Server size={18} />
            </div>
            <div>
              <h3 className="tx-settings-card-title">Extension Status</h3>
              <span className="tx-settings-card-sub">Chromium Companion connection</span>
            </div>
          </div>

          <div className="tx-account-details">
            <div className="tx-detail-row">
              <span className="tx-detail-lbl">Status</span>
              <span className="tx-detail-val" style={{ color: isExtensionConnected ? '#10b981' : '#f59e0b' }}>
                {isExtensionConnected ? '● Connected & Linked' : '○ Waiting for extension'}
              </span>
            </div>
            <div className="tx-detail-row">
              <span className="tx-detail-lbl">Extension Version</span>
              <span className="tx-detail-val">Manifest V3 (v1.1)</span>
            </div>
            <div className="tx-detail-row">
              <span className="tx-detail-lbl">Backend Port</span>
              <span className="tx-detail-val">http://127.0.0.1:8000</span>
            </div>
          </div>

          <div className="tx-settings-action-row">
            <button
              onClick={() => onNavigate('/connect-extension')}
              className="tx-btn-secondary"
            >
              <span>Extension Setup Page →</span>
            </button>
          </div>
        </div>

        {/* Card 4: Appearance & Theme */}
        <div className="tx-glass-card tx-settings-card">
          <div className="tx-card-header">
            <div className="tx-icon-box tx-icon-pink">
              {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
            </div>
            <div>
              <h3 className="tx-settings-card-title">Appearance</h3>
              <span className="tx-settings-card-sub">Theme & Visual Experience</span>
            </div>
          </div>

          <div className="tx-account-details">
            <div className="tx-detail-row">
              <span className="tx-detail-lbl">Current Theme</span>
              <span className="tx-detail-val" style={{ textTransform: 'capitalize' }}>
                {theme || 'dark'} Mode
              </span>
            </div>
          </div>

          <div className="tx-settings-action-row">
            <button
              onClick={onToggleTheme}
              className="tx-btn-secondary"
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              <span>Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode</span>
            </button>
          </div>
        </div>

        {/* Card 5: Privacy & Local Data */}
        <div className="tx-glass-card tx-settings-card" style={{ gridColumn: '1 / -1' }}>
          <div className="tx-card-header">
            <div className="tx-icon-box tx-icon-emerald">
              <Shield size={18} />
            </div>
            <div>
              <h3 className="tx-settings-card-title">Privacy & Data Sovereignty</h3>
              <span className="tx-settings-card-sub">Export or inspect your local database records</span>
            </div>
          </div>

          <p className="tx-privacy-desc-text">
            All telemetry is stored strictly in your local MySQL instance. No personal data is sent to external servers.
            You can export your recorded browsing events at any time.
          </p>

          <div className="tx-settings-action-row" style={{ marginTop: '16px', gap: '12px' }}>
            <button
              onClick={handleExportData}
              className="tx-btn-secondary"
            >
              <Download size={15} />
              <span>Export Today's Activity (JSON)</span>
            </button>

            <button
              onClick={() => onNavigate('/privacy')}
              className="tx-btn-ghost"
            >
              <span>View Privacy Policy →</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
