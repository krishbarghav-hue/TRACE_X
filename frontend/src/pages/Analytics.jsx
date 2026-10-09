import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3,
  Clock,
  Globe,
  Radio,
  ExternalLink,
  Compass,
  Sparkles,
  TrendingUp,
  Activity,
  Layers,
  Calendar,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/api';

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatSecondsToHhMm(totalSeconds) {
  const secs = Number(totalSeconds);
  if (!secs || isNaN(secs) || secs <= 0) return '0m';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.round(secs)}s`;
}

function getFavicon(domain) {
  if (!domain) return '';
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

const donutColors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#94a3b8'];

export default function Analytics() {
  const navigate = useNavigate();

  // Real Activity Analytics States
  const [todaySummary, setTodaySummary] = useState(null);
  const [hourlyData, setHourlyData]     = useState([]);
  const [domainBreakdown, setDomainBreakdown] = useState([]);
  const [dailyTrend, setDailyTrend]     = useState([]);
  const [topResources, setTopResources] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [trendDays, setTrendDays]       = useState(7);

  // Fetch real activity analytics from verified endpoints
  const loadAnalytics = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const [summaryRes, hourlyRes, domainsRes, trendRes, resourcesRes] = await Promise.all([
        api.getActivityTodaySummary().catch((e) => {
          console.error('[TraceX] summary error:', e);
          return null;
        }),
        api.getActivityHourly().catch((e) => {
          console.error('[TraceX] hourly error:', e);
          return { hourly: [] };
        }),
        api.getActivityDomains(trendDays).catch((e) => {
          console.error('[TraceX] domains error:', e);
          return [];
        }),
        api.getActivityDailyTrend(trendDays).catch((e) => {
          console.error('[TraceX] trend error:', e);
          return { data: [] };
        }),
        api.getResources({ sort_by: 'duration', limit: 6 }).catch((e) => {
          console.error('[TraceX] resources error:', e);
          return [];
        }),
      ]);

      if (summaryRes) setTodaySummary(summaryRes);
      if (hourlyRes?.hourly) setHourlyData(hourlyRes.hourly);
      if (Array.isArray(domainsRes)) setDomainBreakdown(domainsRes);
      if (trendRes?.data) setDailyTrend(trendRes.data);
      if (Array.isArray(resourcesRes)) setTopResources(resourcesRes);
    } catch (err) {
      console.error('[TraceX] Error loading real activity analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [trendDays]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Polling every 10 seconds for live data sync
  useEffect(() => {
    const timer = setInterval(() => loadAnalytics(true), 10000);
    return () => clearInterval(timer);
  }, [loadAnalytics]);

  // Normalized Today Metrics (Single Source of Truth)
  const todayMetrics = useMemo(() => {
    const raw = todaySummary || {};
    const totalActivities = Number(raw.total_activities ?? 0) || 0;
    const totalSeconds = Number(raw.total_seconds ?? 0) || 0;
    const totalMinutes = typeof raw.total_minutes === 'number'
      ? raw.total_minutes
      : (Math.round((totalSeconds / 60) * 10) / 10);
    const uniqueDomains = Number(raw.unique_domains ?? 0) || 0;
    const uniqueResources = Number(raw.unique_resources ?? 0) || 0;

    return {
      totalActivities,
      totalSeconds,
      totalMinutes,
      uniqueDomains,
      uniqueResources,
      activeTimeFormatted: `${totalMinutes} minutes`,
    };
  }, [todaySummary]);

  // Total seconds across domain breakdown
  const totalDomainSeconds = useMemo(() => {
    return domainBreakdown.reduce((acc, d) => acc + (Number(d.total_seconds) || 0), 0) || 1;
  }, [domainBreakdown]);

  // Maximum hourly seconds for scaling bar chart
  const maxHourlySeconds = useMemo(() => {
    return Math.max(...hourlyData.map((h) => Number(h.total_seconds) || 0), 60);
  }, [hourlyData]);

  // Maximum daily trend seconds
  const maxDailySeconds = useMemo(() => {
    return Math.max(...dailyTrend.map((d) => Number(d.total_seconds) || 0), 60);
  }, [dailyTrend]);

  return (
    <div className="d1-dashboard-container" style={{ paddingBottom: '60px' }}>
      {/* ── 1. Scenic Mountain Twilight Hero Header ──────────────────────── */}
      <div className="d1-hero-banner" style={{ minHeight: '180px' }}>
        <img
          src="/mountain_hero_panorama.jpg"
          alt="Panoramic Twilight Mountains"
          className="d1-hero-bg-img"
        />
        <div className="d1-hero-overlay" />

        <div className="d1-hero-top-row">
          <div className="d1-hero-greeting-col">
            <h1 className="d1-hero-title">
              Activity Intelligence & Telemetry <Sparkles size={20} style={{ display: 'inline', color: '#f59e0b', verticalAlign: 'middle', marginLeft: '6px' }} />
            </h1>
            <p className="d1-hero-sub">
              Empirical analytics derived strictly from observed browser activity. No manual study logs or estimates.
            </p>
          </div>

          <div className="d1-hero-meta-col">
            <button
              onClick={() => loadAnalytics(false)}
              className="tx-btn-secondary-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Refresh telemetry"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? 'Syncing...' : 'Sync Telemetry'}</span>
            </button>
            <div className="tx-status-pulse-container">
              <span className="tx-status-beacon tx-beacon-active" />
              <span className="tx-status-beacon-ring tx-ring-active" />
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Today's Key Activity Metrics (Matches Today Dashboard) ────── */}
      <div className="d1-metrics-row" style={{ marginTop: '20px' }}>
        {/* Active Time */}
        <div className="d1-metric-card">
          <div className="d1-card-left-col">
            <div className="d1-icon-box d1-icon-blue">
              <Clock size={22} />
            </div>
            <div>
              <div className="d1-card-label">TOTAL ACTIVE TIME (TODAY)</div>
              <div className="d1-card-value">{todayMetrics.activeTimeFormatted}</div>
              <div className="d1-card-trend d1-trend-green">
                <span>{todayMetrics.totalActivities > 0 ? '↑ Recorded today' : '○ 0m recorded today'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Total Activities */}
        <div className="d1-metric-card">
          <div className="d1-card-left-col">
            <div className="d1-icon-box d1-icon-purple">
              <Activity size={22} />
            </div>
            <div>
              <div className="d1-card-label">TOTAL ACTIVITIES</div>
              <div className="d1-card-value">{todayMetrics.totalActivities}</div>
              <div className="d1-card-trend d1-trend-green">
                <span>{todayMetrics.totalActivities > 0 ? `↑ ${todayMetrics.totalActivities} browser events` : '0 events'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Unique Websites */}
        <div className="d1-metric-card">
          <div className="d1-card-left-col">
            <div className="d1-icon-box d1-icon-orange">
              <Globe size={22} />
            </div>
            <div>
              <div className="d1-card-label">UNIQUE WEBSITES</div>
              <div className="d1-card-value">{todayMetrics.uniqueDomains}</div>
              <div className="d1-card-subtext d1-sub-orange">
                <span>{todayMetrics.uniqueDomains > 0 ? `${todayMetrics.uniqueDomains} domains visited` : '0 domains'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Unique Resources */}
        <div className="d1-metric-card">
          <div className="d1-card-left-col">
            <div className="d1-icon-box d1-icon-emerald">
              <Compass size={22} />
            </div>
            <div>
              <div className="d1-card-label">UNIQUE RESOURCES</div>
              <div className="d1-card-value">{todayMetrics.uniqueResources}</div>
              <div className="d1-card-subtext d1-sub-blue">
                <span>{todayMetrics.uniqueResources > 0 ? `${todayMetrics.uniqueResources} distinct URLs` : '0 URLs'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Main Analytical Grid: Top Domains & Hourly Activity ─────────── */}
      <div className="d1-main-grid" style={{ marginTop: '22px' }}>
        {/* ── Top Domains Breakdown with Percentage ──────────────────────── */}
        <div className="d1-panel" style={{ flex: '1.2' }}>
          <div className="d1-panel-header">
            <div className="d1-panel-title-group">
              <div className="d1-header-icon d1-header-yellow">
                <Sparkles size={16} />
              </div>
              <h2 className="d1-panel-title">TOP DOMAINS (PAST {trendDays} DAYS)</h2>
            </div>
            <span className="tx-tag-derived">Empirical Usage</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {domainBreakdown.length === 0 ? (
              <div className="tx-empty-activity-placeholder">
                <Globe size={24} className="tx-text-dim" />
                <p>No domain telemetry recorded</p>
                <span>Browse web pages to view domain distributions here.</span>
              </div>
            ) : (
              domainBreakdown.slice(0, 6).map((d, idx) => {
                const color = donutColors[idx % donutColors.length];
                const secs = Number(d.total_seconds) || 0;
                const pct = Math.round((secs / totalDomainSeconds) * 100);

                return (
                  <div
                    key={d.domain || idx}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '14px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '160px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', width: '18px' }}>
                        #{idx + 1}
                      </span>
                      <img
                        src={getFavicon(d.domain)}
                        alt=""
                        style={{ width: '18px', height: '18px', borderRadius: '4px' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                          {d.domain}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {d.visits} {d.visits === 1 ? 'visit' : 'visits'}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar & Percentage */}
                    <div style={{ flex: '1', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          height: '8px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          borderRadius: '4px',
                          flex: '1',
                          overflow: 'hidden'
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.max(5, pct)}%`,
                            backgroundColor: color,
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: color, width: '40px', textAlign: 'right' }}>
                        {pct}%
                      </span>
                    </div>

                    {/* Total Duration */}
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', minWidth: '70px', textAlign: 'right' }}>
                      {formatSecondsToHhMm(secs)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Activity By Hour (Actual 24h Distribution) ─────────────────── */}
        <div className="d1-panel" style={{ flex: '1' }}>
          <div className="d1-panel-header">
            <div className="d1-panel-title-group">
              <div className="d1-header-icon d1-header-blue">
                <Clock size={16} />
              </div>
              <h2 className="d1-panel-title">ACTIVITY BY HOUR (TODAY)</h2>
            </div>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>24-hour cycle</span>
          </div>

          <div style={{ marginTop: '10px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                height: '140px',
                gap: '4px',
                padding: '10px 0',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              {hourlyData.map((h) => {
                const secs = Number(h.total_seconds) || 0;
                const heightPct = Math.max(4, Math.round((secs / maxHourlySeconds) * 100));
                const hasAct = secs > 0;

                return (
                  <div
                    key={h.hour}
                    style={{
                      flex: '1',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      alignItems: 'center'
                    }}
                    title={`${h.label}: ${formatSecondsToHhMm(secs)} (${h.activities} activities)`}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: `${heightPct}%`,
                        backgroundColor: hasAct ? '#38bdf8' : 'rgba(255, 255, 255, 0.06)',
                        borderRadius: '3px 3px 0 0',
                        transition: 'height 0.3s ease'
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Hour Axis Labels */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: '6px',
                fontSize: '10px',
                color: '#64748b'
              }}
            >
              <span>12 AM</span>
              <span>6 AM</span>
              <span>12 PM</span>
              <span>6 PM</span>
              <span>11 PM</span>
            </div>
          </div>

          {/* Hourly Insights */}
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(56, 189, 248, 0.08)', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={14} color="#38bdf8" />
              <span style={{ fontSize: '12px', color: '#e0f2fe' }}>
                Peak browsing period: <strong>{
                  hourlyData.reduce((prev, curr) => (curr.total_seconds > (prev?.total_seconds || 0) ? curr : prev), null)?.label || 'Evening'
                }</strong>
              </span>
            </div>
            <button onClick={() => navigate('/timeline')} className="tx-btn-ghost-sm" style={{ padding: '2px 8px', fontSize: '11px' }}>
              Timeline →
            </button>
          </div>
        </div>
      </div>

      {/* ── 4. 7-Day Activity Trend & Top Discovered Resources ────────────── */}
      <div className="d1-lower-grid" style={{ marginTop: '22px' }}>
        {/* 7-Day Trend Chart */}
        <div className="d1-panel">
          <div className="d1-panel-header">
            <div className="d1-panel-title-group">
              <div className="d1-header-icon d1-header-purple">
                <TrendingUp size={16} />
              </div>
              <h2 className="d1-panel-title">7-DAY ACTIVITY TREND</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => setTrendDays(7)}
                className={`tx-btn-ghost-sm ${trendDays === 7 ? 'active' : ''}`}
                style={{ fontSize: '11px', padding: '2px 8px', background: trendDays === 7 ? 'rgba(99, 102, 241, 0.2)' : 'transparent', color: trendDays === 7 ? '#818cf8' : '#94a3b8' }}
              >
                7 Days
              </button>
              <button
                onClick={() => setTrendDays(14)}
                className={`tx-btn-ghost-sm ${trendDays === 14 ? 'active' : ''}`}
                style={{ fontSize: '11px', padding: '2px 8px', background: trendDays === 14 ? 'rgba(99, 102, 241, 0.2)' : 'transparent', color: trendDays === 14 ? '#818cf8' : '#94a3b8' }}
              >
                14 Days
              </button>
            </div>
          </div>

          <div style={{ padding: '10px 0' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                height: '140px',
                gap: '12px',
                padding: '10px 0',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              {dailyTrend.map((d, idx) => {
                const secs = Number(d.total_seconds) || 0;
                const heightPct = Math.max(8, Math.round((secs / maxDailySeconds) * 100));
                const dayLabel = new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' });

                return (
                  <div
                    key={d.date || idx}
                    style={{
                      flex: '1',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      alignItems: 'center'
                    }}
                    title={`${d.date}: ${formatSecondsToHhMm(secs)} (${d.activities} events)`}
                  >
                    <div
                      style={{
                        width: '100%',
                        maxWidth: '36px',
                        height: `${heightPct}%`,
                        background: 'linear-gradient(180deg, #818cf8 0%, #4f46e5 100%)',
                        borderRadius: '6px 6px 0 0',
                        boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                        transition: 'height 0.3s ease'
                      }}
                    />
                    <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>
                      {dayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top Auto-Discovered Resources */}
        <div className="d1-panel">
          <div className="d1-panel-header">
            <div className="d1-panel-title-group">
              <div className="d1-header-icon d1-header-emerald">
                <Compass size={16} />
              </div>
              <h2 className="d1-panel-title">TOP OBSERVED RESOURCES</h2>
            </div>
            <button onClick={() => navigate('/resources')} className="d1-btn-view-all">
              All Resources →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {topResources.length === 0 ? (
              <div className="tx-empty-activity-placeholder">
                <Compass size={24} className="tx-text-dim" />
                <p>No resources cataloged yet</p>
                <span>Visited documentation and webpages will rank here automatically.</span>
              </div>
            ) : (
              topResources.slice(0, 5).map((r, idx) => (
                <div
                  key={r.resource_id || idx}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                    <img
                      src={getFavicon(r.domain)}
                      alt=""
                      style={{ width: '16px', height: '16px', borderRadius: '3px', flexShrink: 0 }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div style={{ overflow: 'hidden' }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#f8fafc',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={r.title || r.url}
                      >
                        {r.title || r.domain || 'Observed Resource'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {r.domain} • {r.visit_count || 1} {(r.visit_count || 1) === 1 ? 'visit' : 'visits'}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8', flexShrink: 0 }}>
                    {formatSecondsToHhMm(r.total_observed_seconds)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
