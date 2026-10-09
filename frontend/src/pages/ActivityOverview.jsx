import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Globe, Clock, BarChart2, RefreshCw, AlertTriangle } from 'lucide-react';
import { api } from '../api/api';

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatSeconds(s) {
  if (!s || s <= 0) return '0m';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function formatTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
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

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="tracex-empty-state">
      <div className="tracex-empty-icon">
        <Activity size={40} strokeWidth={1.5} />
      </div>
      <h3>No Activity Yet Today</h3>
      <p>
        Install and enable the TraceX Chrome extension to start recording your browser activity.
        Activity will appear here as you browse.
      </p>
      <div className="tracex-privacy-note">
        <span>🔒</span>
        TraceX records URL, title, and time — never passwords or screen content.
      </div>
    </div>
  );
}

// ── Top Metric Card ───────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, icon: Icon, accent }) {
  return (
    <div className="tx-metric-card" style={{ '--accent': accent }}>
      <div className="tx-metric-icon" style={{ background: `${accent}18`, color: accent }}>
        <Icon size={18} />
      </div>
      <div className="tx-metric-val">{value}</div>
      <div className="tx-metric-label">{label}</div>
      {sub && <div className="tx-metric-sub">{sub}</div>}
    </div>
  );
}

// ── Domain Row ────────────────────────────────────────────────────────────────
function DomainRow({ domain, visits, totalSeconds, maxSeconds, rank }) {
  const color = getDomainColor(domain);
  const pct = maxSeconds > 0 ? Math.max(4, (totalSeconds / maxSeconds) * 100) : 4;
  return (
    <div className="tx-domain-row">
      <div className="tx-domain-rank" style={{ color }}>{rank}</div>
      <img
        className="tx-domain-favicon"
        src={getFavicon(domain)}
        alt=""
        onError={e => { e.target.style.display = 'none'; }}
      />
      <div className="tx-domain-info">
        <div className="tx-domain-name">{domain}</div>
        <div className="tx-domain-bar-track">
          <div className="tx-domain-bar-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
      <div className="tx-domain-time-col">
        <div className="tx-domain-time" style={{ color }}>{formatSeconds(totalSeconds)}</div>
        <div className="tx-domain-visits">{visits} visit{visits !== 1 ? 's' : ''}</div>
      </div>
    </div>
  );
}

// ── Hourly Heatmap ────────────────────────────────────────────────────────────
function HourlyChart({ hourly }) {
  const maxMin = Math.max(...hourly.map(h => h.total_minutes), 1);
  const workHours = hourly.slice(6, 24); // show 6am–midnight

  return (
    <div className="tx-hourly-chart">
      {workHours.map(h => {
        const pct = Math.max(4, (h.total_minutes / maxMin) * 100);
        const isNow = new Date().getHours() === h.hour;
        return (
          <div key={h.hour} className={`tx-hour-col${isNow ? ' tx-hour-now' : ''}`} title={`${h.label}: ${formatSeconds(h.total_seconds)}`}>
            <div className="tx-hour-val">{h.total_minutes > 0 ? `${Math.round(h.total_minutes)}m` : ''}</div>
            <div className="tx-hour-bar-track">
              <div
                className="tx-hour-bar-fill"
                style={{ height: `${pct}%`, opacity: h.total_minutes > 0 ? 1 : 0.12 }}
              />
            </div>
            <div className="tx-hour-label">{h.hour % 3 === 0 ? h.label : ''}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ActivityOverview() {
  const [summary, setSummary] = useState(null);
  const [hourly, setHourly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumData, hourData] = await Promise.all([
        api.getActivityTodaySummary().catch(() => null),
        api.getActivityHourly().catch(() => ({ hourly: [] })),
      ]);
      setSummary(sumData);
      setHourly(hourData?.hourly || []);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60s
  useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const hasData = summary && summary.total_activities > 0;
  const maxDomainSeconds = Math.max(...(summary?.top_domains?.map(d => d.total_seconds) || [0]), 1);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Today</h1>
          <p className="page-description">
            Your recorded browser activity for {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.
          </p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={load}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '13px' }}
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="tx-error-banner">
          <AlertTriangle size={16} />
          Backend unreachable: {error}. Make sure FastAPI is running on port 8000.
        </div>
      )}

      {/* Metric cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <MetricCard
          label="Active Time"
          value={formatSeconds(summary?.total_seconds || 0)}
          sub="Recorded browser activity"
          icon={Clock}
          accent="var(--sky)"
        />
        <MetricCard
          label="Activities"
          value={summary?.total_activities || 0}
          sub="Tab visits recorded"
          icon={Activity}
          accent="var(--primary)"
        />
        <MetricCard
          label="Sites Visited"
          value={summary?.unique_domains || 0}
          sub="Unique domains"
          icon={Globe}
          accent="var(--success)"
        />
        <MetricCard
          label="Top Site"
          value={summary?.top_domains?.[0]?.domain || '—'}
          sub={summary?.top_domains?.[0] ? formatSeconds(summary.top_domains[0].total_seconds) : 'No data'}
          icon={BarChart2}
          accent="var(--warning)"
        />
      </div>

      {!hasData && !loading ? (
        <EmptyState />
      ) : (
        <>
          {/* Hourly Activity Chart */}
          {hourly.length > 0 && (
            <div className="card-section">
              <div className="section-head">
                <div className="section-title">
                  <BarChart2 size={18} color="var(--primary)" />
                  <span>Activity by Hour</span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Today (6am–midnight)</span>
              </div>
              <HourlyChart hourly={hourly} />
            </div>
          )}

          {/* Top Domains */}
          {summary?.top_domains?.length > 0 && (
            <div className="card-section">
              <div className="section-head">
                <div className="section-title">
                  <Globe size={18} color="var(--sky)" />
                  <span>Time by Site</span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Today's recorded activity</span>
              </div>
              <div className="tx-domain-list">
                {summary.top_domains.map((d, i) => (
                  <DomainRow
                    key={d.domain}
                    rank={i + 1}
                    domain={d.domain}
                    visits={d.visits}
                    totalSeconds={d.total_seconds}
                    maxSeconds={maxDomainSeconds}
                  />
                ))}
              </div>
              <div className="tx-observed-note">
                ℹ These figures represent observed browser activity, not verified learning time.
              </div>
            </div>
          )}
        </>
      )}

      {lastRefresh && (
        <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-dim)', marginTop: '8px' }}>
          Last refreshed: {lastRefresh.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
