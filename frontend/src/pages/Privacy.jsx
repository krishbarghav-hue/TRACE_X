import React from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Database,
  Lock,
  EyeOff,
  Server,
  FileCode,
  ArrowLeft,
  Download,
} from 'lucide-react';

export default function Privacy({ onNavigate }) {
  return (
    <div className="tx-privacy-page">
      <div className="tx-privacy-hero">
        <div className="tx-badge-glass">
          <ShieldCheck size={14} color="#10b981" />
          <span>Privacy & Security Architecture</span>
        </div>
        <h1 className="tx-privacy-title">TraceX Privacy Manifesto</h1>
        <p className="tx-privacy-subtitle">
          Transparent, local-first telemetry designed to help you understand your digital day without surveillance.
        </p>
      </div>

      <div className="tx-privacy-content">
        {/* Comparison Grid: What We Record vs What We Never Record */}
        <div className="tx-privacy-comparison-grid">
          {/* Card 1: What We Record */}
          <div className="tx-glass-card tx-privacy-box tx-box-positive">
            <div className="tx-box-header">
              <div className="tx-box-icon tx-icon-green">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h3>What TraceX Records</h3>
                <span>Supported and observed by our open extension code</span>
              </div>
            </div>

            <ul className="tx-privacy-list">
              <li>
                <CheckCircle2 size={16} color="#10b981" />
                <div>
                  <strong>Active Webpage URL & Domain</strong>
                  <p>Top-level address (e.g. <code>github.com/project</code>, <code>youtube.com/watch</code>) to identify the resource visited.</p>
                </div>
              </li>
              <li>
                <CheckCircle2 size={16} color="#10b981" />
                <div>
                  <strong>Webpage Title</strong>
                  <p>The document HTML title (e.g. <code>"SQL Query Discussion — ChatGPT"</code>) for chronological timeline identification.</p>
                </div>
              </li>
              <li>
                <CheckCircle2 size={16} color="#10b981" />
                <div>
                  <strong>Timestamps & Active Dwell Duration</strong>
                  <p>Start time, exit time, and elapsed seconds spent actively focused on the tab.</p>
                </div>
              </li>
              <li>
                <CheckCircle2 size={16} color="#10b981" />
                <div>
                  <strong>Window Focus & Idle State</strong>
                  <p>Detects when Chrome is minimized or when no user activity occurs for 60 seconds to halt the timer.</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Card 2: What We Never Record */}
          <div className="tx-glass-card tx-privacy-box tx-box-negative">
            <div className="tx-box-header">
              <div className="tx-box-icon tx-icon-red">
                <XCircle size={20} />
              </div>
              <div>
                <h3>What TraceX Never Records</h3>
                <span>Strictly excluded by design and architectural constraints</span>
              </div>
            </div>

            <ul className="tx-privacy-list">
              <li>
                <XCircle size={16} color="#f43f5e" />
                <div>
                  <strong>Passwords & Credentials</strong>
                  <p>No password fields, session tokens, or authentication cookies are ever inspected or stored.</p>
                </div>
              </li>
              <li>
                <XCircle size={16} color="#f43f5e" />
                <div>
                  <strong>Keystrokes & Form Inputs</strong>
                  <p>TraceX does NOT log keyboard input, search text inside forms, or clipboard copy/paste buffers.</p>
                </div>
              </li>
              <li>
                <XCircle size={16} color="#f43f5e" />
                <div>
                  <strong>Screenshots & Screen Recordings</strong>
                  <p>Zero visual screen captures or video recording APIs are utilized in our extension or backend.</p>
                </div>
              </li>
              <li>
                <XCircle size={16} color="#f43f5e" />
                <div>
                  <strong>Unrelated Personal Local Files</strong>
                  <p>Zero access to your personal filesystem outside of the dedicated local MySQL database.</p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Local Sovereignty Section */}
        <div className="tx-glass-card tx-privacy-architecture-card">
          <div className="tx-arch-head">
            <Server size={22} color="#0ea5e9" />
            <h3>Your Database, Your Machine</h3>
          </div>
          <p>
            TraceX does not run on a multitenant public cloud where third parties can analyze your browsing telemetry.
            Events flow strictly from your Chromium browser directly to your local FastAPI backend (port <code>8000</code>)
            and are stored in your private MySQL <code>trace_x</code> database.
          </p>

          <div className="tx-arch-flow">
            <div className="tx-arch-node">
              <span className="tx-arch-badge">Browser</span>
              <span>Chrome / Brave / Edge</span>
            </div>
            <div className="tx-arch-arrow">→</div>
            <div className="tx-arch-node">
              <span className="tx-arch-badge">Telemetry</span>
              <span>TraceX Extension</span>
            </div>
            <div className="tx-arch-arrow">→</div>
            <div className="tx-arch-node">
              <span className="tx-arch-badge">Local API</span>
              <span>FastAPI (127.0.0.1:8000)</span>
            </div>
            <div className="tx-arch-arrow">→</div>
            <div className="tx-arch-node">
              <span className="tx-arch-badge">Local DB</span>
              <span>MySQL trace_x</span>
            </div>
          </div>
        </div>

        {/* Data Ownership & Controls */}
        <div className="tx-glass-card tx-privacy-controls-card">
          <h3>Full User Data Control</h3>
          <p>You maintain complete control over what is recorded and stored:</p>
          <div className="tx-controls-grid">
            <div className="tx-control-item">
              <strong>One-Click Pause</strong>
              <p>Pause telemetry recording at any moment from the extension popup or the web Settings page.</p>
            </div>
            <div className="tx-control-item">
              <strong>Incognito Automatic Exclusion</strong>
              <p>Incognito and private browsing windows are never tracked by default.</p>
            </div>
            <div className="tx-control-item">
              <strong>Data Export & Inspection</strong>
              <p>Export all recorded activity logs as standard JSON or inspect them in MySQL.</p>
            </div>
          </div>
        </div>

        {/* Back CTA */}
        <div className="tx-privacy-actions">
          <button onClick={() => onNavigate('/today')} className="tx-btn-primary">
            <ArrowLeft size={16} />
            <span>Return to Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
}
