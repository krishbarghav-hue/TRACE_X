import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Globe, Activity, BarChart2, RefreshCw, AlertTriangle } from 'lucide-react';
import { api } from '../api/api';

function formatSeconds(s) {
  if (!s || s <= 0) return '0m';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
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

// Weekly trend mini chart
function WeeklyTrendChart({ data }) {
  const max = Math.max(...data.map(d => d.total_minutes), 10);
  return (
    <div className="bar-chart" style={{ height: '120px' }}>
      {data.map(day => {
        const pct = Math.max(5, (day.total_minutes / max) * 100);
        const d = new Date(day.date);
        const label = d.toLocaleDateString('en-US', { weekday: 'short' });
        const isToday = day.date === new Date().toISOString().split('T')[0];
        return (
          <div key={day.date} className="chart-bar-wrap" title={`${day.date}: ${Math.round(day.total_minutes)}m active`}>
            <span className="chart-bar-val" style={{ fontSize: '10px' }}>
              {day.total_minutes > 0 ? `${Math.round(day.total_minutes)}m` : ''}
            </span>
            <div
              className="chart-bar"
              style={{
                height: `${pct}%`,
                background: isToday
                  ? 'linear-gradient(180deg, #0ea5e9, #6366f1)'
                  : 'linear-gradient(180deg, #334155, #1e293b)',
              }}
            />
            <span className="chart-bar-label" style={{ color: isToday ? 'var(--sky)' : undefined, fontWeight: isToday ? 700 : undefined }}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function DailySummary({ onNavigate }) {
  const [todaySummary, setTodaySummary] = useState(null);
  const [weeklyTrend, setWeeklyTrend]   = useState([]);
  const [domains, setDomains]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sum, trend, dom] = await Promise.all([
        api.getActivityTodaySummary().catch(() => null),
        api.getActivityDailyTrend(7).catch(() => ({ data: [] })),
        api.getActivityDomains(1).catch(() => []),
      ]);
      setTodaySummary(sum);
      setWeeklyTrend(trend?.data || []);
      setDomains(dom || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const hasData = todaySummary && todaySummary.total_activities > 0;
  const totalSeconds = todaySummary?.total_seconds || 0;
  const totalHours = Math.floor(totalSeconds / 3600);
  const totalMinutes = Math.floor((totalSeconds % 3600) / 60);

  const topDomains = (todaySummary?.top_domains || []).slice(0, 5);
  const totalDomainSeconds = topDomains.reduce((s, d) => s + d.total_seconds, 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Daily Summary</h1>
          <p className="page-description">
            Overview of your recorded digital activity today and this week.
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

      {/* Today's summary headline */}
      <div className="card-section tx-summary-hero">
        <div className="tx-summary-date">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
        {hasData ? (
          <>
            <div className="tx-summary-headline">
              TraceX recorded{' '}
              <span className="tx-summary-accent">
                {totalHours > 0
                  ? `${totalHours} hour${totalHours > 1 ? 's' : ''} ${totalMinutes} minute${totalMinutes !== 1 ? 's' : ''}`
                  : `${totalMinutes} minute${totalMinutes !== 1 ? 's' : ''}`}
              </span>{' '}
              of browser activity today.
            </div>
            {topDomains.length > 0 && (
              <div style={{ marginTop: '8px', fontSize: '15px', color: '#cbd5e1', fontWeight: 600 }}>
                You spent {formatSeconds(topDomains[0].total_seconds)} on {topDomains[0].domain}.
              </div>
            )}
            <p className="tx-summary-subline" style={{ marginTop: '10px' }}>
              This represents <strong>observed browser activity</strong> across {todaySummary.total_activities} recorded events
              and {todaySummary.unique_domains} different sites.
            </p>
          </>
        ) : (
          <div className="tx-summary-headline" style={{ color: 'var(--text-dim)' }}>
            No browser activity recorded yet today.
          </div>
        )}
      </div>

      {!hasData && !loading && (
        <div className="tx-glass-empty-state" style={{ marginTop: '20px' }}>
          <div className="tx-empty-state-icon">
            <BarChart2 size={32} />
          </div>
          <h2 className="tx-empty-state-title">No activity recorded yet</h2>
          <p className="tx-empty-state-desc">
            Install and connect the TraceX extension,
            <br />
            then browse normally.
          </p>
          <div className="tx-empty-state-actions">
            <button
              onClick={() => onNavigate && onNavigate('/welcome')}
              className="tx-btn-glass-primary"
            >
              <span>Connect Extension</span>
            </button>
            <button
              onClick={load}
              className="tx-btn-glass-secondary"
            >
              <span>Refresh Summary</span>
            </button>
          </div>
        </div>
      )}

      {/* Top sites breakdown */}
      {topDomains.length > 0 && (
        <div className="card-section">
          <div className="section-head">
            <div className="section-title">
              <Globe size={18} color="var(--sky)" />
              <span>Time by Site — Today</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {topDomains.map((d, i) => {
              const color = getDomainColor(d.domain);
              const pct = totalDomainSeconds > 0 ? Math.round((d.total_seconds / totalDomainSeconds) * 100) : 0;
              return (
                <div key={d.domain} className="tx-summary-domain-row">
                  <img
                    src={getFavicon(d.domain)}
                    alt=""
                    style={{ width: 18, height: 18, borderRadius: 3, flexShrink: 0 }}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '14px', fontWeight: 600 }}>{d.domain}</span>
                      <span style={{ fontSize: '14px', fontWeight: 800, color }}>{formatSeconds(d.total_seconds)}</span>
                    </div>
                    <div className="progress-container" style={{ height: 5, margin: 0 }}>
                      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: 3 }}>
                      {d.visits} visit{d.visits !== 1 ? 's' : ''} · {pct}% of recorded time
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Weekly trend */}
      {weeklyTrend.length > 0 && (
        <div className="card-section">
          <div className="section-head">
            <div className="section-title">
              <TrendingUp size={18} color="var(--success)" />
              <span>7-Day Activity Trend</span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Recorded browser activity (minutes/day)</span>
          </div>
          <WeeklyTrendChart data={weeklyTrend} />
        </div>
      )}

      {/* Stats row */}
      {hasData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          {[
            { label: 'Total Activities', value: todaySummary.total_activities, icon: Activity, color: 'var(--primary)' },
            { label: 'Active Minutes', value: Math.round(totalSeconds / 60), icon: BarChart2, color: 'var(--sky)' },
            { label: 'Sites Visited', value: todaySummary.unique_domains, icon: Globe, color: 'var(--success)' },
          ].map(card => (
            <div key={card.label} className="stat-card">
              <div className="stat-top">
                <span className="stat-label">{card.label}</span>
                <div className="stat-icon" style={{ background: `${card.color}18`, color: card.color }}>
                  <card.icon size={18} />
                </div>
              </div>
              <div className="stat-value" style={{ color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="tx-observed-note">
        ℹ TraceX records <strong>browser activity</strong> only.
        Recorded time ≠ study time or productivity. Use this as a personal reference.
      </div>
    </div>
  );
}
