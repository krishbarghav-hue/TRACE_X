import React, { useState } from 'react';
import { ShieldCheck, ExternalLink, Download, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../api/api';

export default function ExtensionStatus({
  hasActivityToday = false,
  hasRecentActivity = false,
  onShowPrivacyModal,
}) {
  const [showPrivacy, setShowPrivacy] = useState(false);

  // If there is activity today, render a sleek status bar or card
  if (hasActivityToday) {
    return (
      <div className="tx-glass-card tx-status-banner">
        <div className="tx-status-banner-left">
          <div className="tx-status-pulse-container">
            <span className={`tx-status-beacon ${hasRecentActivity ? 'tx-beacon-active' : 'tx-beacon-idle'}`} />
            <span className={`tx-status-beacon-ring ${hasRecentActivity ? 'tx-ring-active' : ''}`} />
          </div>
          <div>
            <div className="tx-status-title">
              {hasRecentActivity ? '● Tracking Active — Connected by TraceX' : '○ Connected by TraceX — Idle'}
            </div>
            <div className="tx-status-subtitle">
              Passive telemetry logging directly to your private local database.
            </div>
          </div>
        </div>

        <div className="tx-status-banner-right">
          <button
            onClick={() => setShowPrivacy(true)}
            className="tx-btn-ghost-sm"
          >
            <ShieldCheck size={14} color="#10b981" />
            <span>Privacy Guard Active</span>
          </button>
        </div>

        {showPrivacy && (
          <div className="tx-modal-overlay" onClick={() => setShowPrivacy(false)}>
            <div className="tx-glass-modal" onClick={(e) => e.stopPropagation()}>
              <div className="tx-modal-header">
                <ShieldCheck size={24} color="#10b981" />
                <h3>TraceX Privacy & Telemetry Model</h3>
              </div>
              <div className="tx-modal-body">
                <p><strong>100% Local & Transparent:</strong> TraceX only captures top-level URL, domain name, page title, and active duration.</p>
                <ul>
                  <li><CheckCircle2 size={14} color="#10b981" /> Passwords, forms, cookies, and keystrokes are never tracked or saved.</li>
                  <li><CheckCircle2 size={14} color="#10b981" /> Screen captures and webpage content are strictly excluded.</li>
                  <li><CheckCircle2 size={14} color="#10b981" /> Data never leaves your local machine or trusted local server.</li>
                  <li><CheckCircle2 size={14} color="#10b981" /> Incognito and private browsing tabs are automatically ignored.</li>
                </ul>
              </div>
              <div className="tx-modal-footer">
                <button className="tx-btn-primary" onClick={() => setShowPrivacy(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Beautiful Onboarding Empty State when no activity is recorded yet
  return (
    <div className="tx-glass-card tx-onboarding-empty-card">
      <div className="tx-onboarding-glow" />
      <div className="tx-onboarding-icon-wrap">
        <Sparkles size={32} className="tx-onboarding-icon" />
      </div>

      <h2 className="tx-onboarding-title">Your digital day starts here.</h2>
      <p className="tx-onboarding-description">
        Install and connect the TraceX Chrome extension to begin recording your browser activity.
        Once installed, your digital footprint will organize itself automatically.
      </p>

      <div className="tx-onboarding-actions">
        <a
          href={api.getExtensionDownloadUrl()}
          className="tx-btn-primary tx-onboarding-btn"
        >
          <Download size={16} />
          <span>Download Extension (.zip)</span>
        </a>

        <button
          onClick={() => setShowPrivacy(true)}
          className="tx-btn-secondary"
        >
          <ShieldCheck size={15} />
          <span>Learn About Privacy</span>
        </button>
      </div>

      <div className="tx-extension-state-indicator">
        <span className="tx-dot-amber" />
        <span>Waiting for browser activity</span>
      </div>

      {showPrivacy && (
        <div className="tx-modal-overlay" onClick={() => setShowPrivacy(false)}>
          <div className="tx-glass-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tx-modal-header">
              <ShieldCheck size={24} color="#10b981" />
              <h3>TraceX Privacy & Telemetry Model</h3>
            </div>
            <div className="tx-modal-body">
              <p><strong>100% Local & Transparent:</strong> TraceX only captures top-level URL, domain name, page title, and active duration.</p>
              <ul>
                <li><CheckCircle2 size={14} color="#10b981" /> Passwords, forms, cookies, and keystrokes are never tracked or saved.</li>
                <li><CheckCircle2 size={14} color="#10b981" /> Screen captures and webpage content are strictly excluded.</li>
                <li><CheckCircle2 size={14} color="#10b981" /> Data never leaves your local machine or trusted local server.</li>
                <li><CheckCircle2 size={14} color="#10b981" /> Incognito and private browsing tabs are automatically ignored.</li>
              </ul>
            </div>
            <div className="tx-modal-footer">
              <button className="tx-btn-primary" onClick={() => setShowPrivacy(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
