import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Globe, RefreshCw, Filter, AlertTriangle } from 'lucide-react';
import { api } from '../api/api';

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatSeconds(s) {
  if (!s || s <= 0) return '<1m';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function formatTimeShort(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function getDomainColor(domain) {
  const colors = [
    '#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444',
    '#8b5cf6','#06b6d4','#84cc16','#f97316','#ec4899',
  ];
  let hash = 0;
  for (const ch of domain) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

function getFavicon(domain) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

// ── Single timeline event ─────────────────────────────────────────────────────
function TimelineEvent({ log, isLast }) {
  const [expanded, setExpanded] = useState(false);
  const color = getDomainColor(log.domain);

  return (
    <div className="tx-timeline-item" data-last={isLast}>
      {/* Left: time column */}
      <div className="tx-tl-time-col">
        <div className="tx-tl-time">{formatTimeShort(log.visit_time)}</div>
        {log.exit_time && (
          <div className="tx-tl-time-end">{formatTimeShort(log.exit_time)}</div>
        )}
      </div>

      {/* Line + dot */}
      <div className="tx-tl-line-col">
        <div className="tx-tl-dot" style={{ background: color, boxShadow: `0 0 0 3px ${color}22` }} />
        {!isLast && <div className="tx-tl-line" />}
      </div>

      {/* Content card */}
      <div
        className="tx-tl-card"
        onClick={() => setExpanded(e => !e)}
        style={{ cursor: 'pointer', borderLeft: `3px solid ${color}` }}
      >
        <div className="tx-tl-card-header">
          <img
            src={getFavicon(log.domain)}
            alt=""
            className="tx-tl-favicon"
            onError={e => { e.target.style.display = 'none'; }}
          />
          <div className="tx-tl-card-body">
            <div className="tx-tl-domain" style={{ color, fontWeight: 800, fontSize: '14px', marginBottom: '2px' }}>
              {log.domain}
            </div>
            <div className="tx-tl-title" title={log.page_title} style={{ color: '#cbd5e1', fontSize: '13px', fontWeight: 500 }}>
              {log.page_title || log.domain}
            </div>
          </div>
          <div className="tx-tl-duration" style={{ color, background: `${color}18`, padding: '4px 10px', borderRadius: '6px' }}>
            {formatSeconds(log.duration_seconds)}
          </div>
        </div>

        {expanded && (
          <div className="tx-tl-expanded">
            <div className="tx-tl-detail-row">
              <span className="tx-tl-detail-label">Start</span>
              <span>{formatTimeShort(log.visit_time)}</span>
            </div>
            {log.exit_time && (
              <div className="tx-tl-detail-row">
                <span className="tx-tl-detail-label">End</span>
                <span>{formatTimeShort(log.exit_time)}</span>
              </div>
            )}
            <div className="tx-tl-detail-row">
              <span className="tx-tl-detail-label">Duration</span>
              <span>{formatSeconds(log.duration_seconds)}</span>
            </div>
            <div className="tx-tl-url" title={log.url}>
              <Globe size={11} />
              <a href={log.url} target="_blank" rel="noreferrer">
                {log.url.length > 80 ? log.url.substring(0, 80) + '…' : log.url}
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Hour Group Label ──────────────────────────────────────────────────────────
function HourLabel({ hour }) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return (
    <div className="tx-tl-hour-label">
      {d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Timeline({ onNavigate }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [minDuration, setMinDuration] = useState(0); // filter: minimum seconds
  const [domainFilter, setDomainFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTodayActivities();
      setLogs(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  // Apply filters
  const filtered = logs.filter(l => {
    if (minDuration > 0 && (l.duration_seconds || 0) < minDuration) return false;
    if (domainFilter && !l.domain.toLowerCase().includes(domainFilter.toLowerCase())) return false;
    return true;
  });

  // Unique domains for filter dropdown
  const domains = [...new Set(logs.map(l => l.domain))].sort();

  const totalSeconds = filtered.reduce((sum, l) => sum + (l.duration_seconds || 0), 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Timeline</h1>
          <p className="page-description">
            Chronological record of today's browser activity.
          </p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={load}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '13px' }}
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="tx-error-banner">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="card-section" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Filter size={15} color="var(--text-dim)" />
          <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: 600 }}>Filter:</span>

          <select
            className="input-control"
            style={{ marginBottom: 0, width: 'auto', fontSize: '12px', padding: '6px 10px' }}
            value={domainFilter}
            onChange={e => setDomainFilter(e.target.value)}
          >
            <option value="">All sites</option>
            {domains.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            className="input-control"
            style={{ marginBottom: 0, width: 'auto', fontSize: '12px', padding: '6px 10px' }}
            value={minDuration}
            onChange={e => setMinDuration(Number(e.target.value))}
          >
            <option value={0}>Any duration</option>
            <option value={30}>≥ 30 seconds</option>
            <option value={60}>≥ 1 minute</option>
            <option value={300}>≥ 5 minutes</option>
            <option value={600}>≥ 10 minutes</option>
          </select>

          <span style={{ fontSize: '12px', color: 'var(--text-dim)', marginLeft: 'auto' }}>
            {filtered.length} events · {Math.round(totalSeconds / 60)}m recorded
          </span>
        </div>
      </div>

      {loading ? (
        <div className="tx-loading">Loading timeline…</div>
      ) : filtered.length === 0 ? (
        <div className="tx-glass-empty-state">
          <div className="tx-empty-state-icon">
            <Clock size={32} />
          </div>
          <h2 className="tx-empty-state-title">No activity recorded yet</h2>
          <p className="tx-empty-state-desc">
            {logs.length === 0 ? (
              <>
                Install and connect the TraceX extension,
                <br />
                then browse normally.
              </>
            ) : (
              'No events match the current filter. Try adjusting the filters above.'
            )}
          </p>
          <div className="tx-empty-state-actions">
            {logs.length === 0 && (
              <button
                onClick={() => onNavigate && onNavigate('/welcome')}
                className="tx-btn-glass-primary"
              >
                <span>Connect Extension</span>
              </button>
            )}
            <button
              onClick={load}
              className="tx-btn-glass-secondary"
            >
              <span>Refresh</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="tx-timeline">
          {filtered.map((log, idx) => (
            <TimelineEvent
              key={log.activity_id}
              log={log}
              isLast={idx === filtered.length - 1}
            />
          ))}
        </div>
      )}

      <div className="tx-observed-note" style={{ marginTop: '16px' }}>
        ℹ Timeline shows <strong>observed browser activity</strong>.
        Duration reflects active tab time, not necessarily focused attention.
      </div>
    </div>
  );
}
