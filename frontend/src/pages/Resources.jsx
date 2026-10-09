import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Compass,
  Search,
  ExternalLink,
  Clock,
  Eye,
  Calendar,
  Globe,
  Radio,
  Sparkles,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  FileText,
  Video,
  Code2,
  BookOpen,
  RefreshCw,
  Layers,
  ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/api';

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatSeconds(totalSeconds) {
  const secs = Number(totalSeconds);
  if (!secs || isNaN(secs) || secs <= 0) return '0s';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);

  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatRelativeTime(dateString) {
  if (!dateString) return 'Observed recently';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'Observed recently';
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Observed recently';
  }
}

function formatExactDate(dateString) {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function getFavicon(domain) {
  if (!domain) return '';
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

function getDomainDisplay(domain) {
  if (!domain) return 'Web Resource';
  return domain.replace(/^www\./, '');
}

function getResourceTypeMeta(type, domain = '', url = '') {
  const d = (domain || '').toLowerCase();
  const u = (url || '').toLowerCase();
  const t = (type || '').toLowerCase();

  if (t === 'pdf' || u.includes('.pdf')) {
    return { label: 'Web PDF', color: '#ef4444', icon: FileText };
  }
  if (t === 'youtube' || d.includes('youtube') || d.includes('vimeo') || d.includes('hotstar') || d.includes('netflix')) {
    return { label: 'Media & Video', color: '#f43f5e', icon: Video };
  }
  if (d.includes('github') || d.includes('gitlab') || d.includes('leetcode') || d.includes('stackoverflow')) {
    return { label: 'Development', color: '#6366f1', icon: Code2 };
  }
  if (d.includes('openai') || d.includes('chatgpt') || d.includes('claude') || d.includes('perplexity')) {
    return { label: 'AI Assistant', color: '#f59e0b', icon: Sparkles };
  }
  if (t === 'documentation' || d.includes('docs.') || d.includes('wikipedia') || d.includes('w3schools')) {
    return { label: 'Documentation', color: '#0ea5e9', icon: BookOpen };
  }
  if (t === 'article' || d.includes('medium') || d.includes('dev.to') || d.includes('blog.')) {
    return { label: 'Article / Guide', color: '#10b981', icon: BookOpen };
  }
  return { label: 'Web Page', color: '#94a3b8', icon: Globe };
}

export default function Resources() {
  const navigate = useNavigate();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [sortBy, setSortBy] = useState('duration'); // duration, recent, visits

  // Fetch auto-discovered resources from backend
  const loadResources = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const data = await api.getResources({
        sort_by: sortBy,
        resource_type: selectedType !== 'all' ? selectedType : undefined,
        search: searchQuery.trim() || undefined,
        limit: 150
      });

      if (Array.isArray(data)) {
        setResources(data);
      }
    } catch (err) {
      console.error('[TraceX] Failed to fetch discovered resources:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sortBy, selectedType, searchQuery]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  // Polling every 8 seconds to reflect newly visited pages automatically
  useEffect(() => {
    const interval = setInterval(() => loadResources(true), 8000);
    return () => clearInterval(interval);
  }, [loadResources]);

  // Summary statistics across discovered resources
  const stats = useMemo(() => {
    const totalCount = resources.length;
    const totalSecs = resources.reduce((acc, r) => acc + (Number(r.total_observed_seconds) || 0), 0);
    const totalVisits = resources.reduce((acc, r) => acc + (Number(r.visit_count) || 1), 0);
    const uniqueDomains = new Set(resources.map((r) => r.domain).filter(Boolean)).size;

    return {
      totalCount,
      totalHours: (totalSecs / 3600).toFixed(1),
      totalMinutes: Math.round(totalSecs / 60),
      totalVisits,
      uniqueDomains
    };
  }, [resources]);

  // Filtered and searched resources list
  const filteredResources = useMemo(() => {
    let result = resources;
    if (selectedType !== 'all') {
      result = result.filter((r) => {
        const meta = getResourceTypeMeta(r.resource_type, r.domain, r.url);
        return meta.label.toLowerCase().includes(selectedType.toLowerCase()) || r.resource_type === selectedType;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          (r.title && r.title.toLowerCase().includes(q)) ||
          (r.domain && r.domain.toLowerCase().includes(q)) ||
          (r.url && r.url.toLowerCase().includes(q))
      );
    }
    return result;
  }, [resources, selectedType, searchQuery]);

  return (
    <div className="d1-dashboard-container" style={{ paddingBottom: '60px' }}>
      {/* ── 1. Atmospheric Mountain Hero Panorama Banner ─────────────────── */}
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
              Discovered Web Resources <Compass size={22} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: '6px', color: '#38bdf8' }} />
            </h1>
            <p className="d1-hero-sub">
              Automatically cataloged from passive browser telemetry. Zero manual bookmarking required.
            </p>
          </div>

          {/* Quick Refresh & Telemetry Pill */}
          <div className="d1-hero-meta-col">
            <button
              onClick={() => loadResources(false)}
              className="tx-btn-secondary-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Refresh telemetry catalog"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? 'Syncing...' : 'Sync Catalog'}</span>
            </button>
            <div className="tx-status-pulse-container" title="Continuous passive discovery enabled">
              <span className="tx-status-beacon tx-beacon-active" />
              <span className="tx-status-beacon-ring tx-ring-active" />
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Real Telemetry Summary Metrics ────────────────────────────── */}
      <div className="d1-metrics-row" style={{ marginTop: '20px' }}>
        <div className="d1-metric-card">
          <div className="d1-card-left-col">
            <div className="d1-icon-box d1-icon-blue">
              <Compass size={22} />
            </div>
            <div>
              <div className="d1-card-label">DISCOVERED PAGES</div>
              <div className="d1-card-value">{stats.totalCount}</div>
              <div className="d1-card-trend d1-trend-green">
                <span>↑ From observed browsing</span>
              </div>
            </div>
          </div>
        </div>

        <div className="d1-metric-card">
          <div className="d1-card-left-col">
            <div className="d1-icon-box d1-icon-orange">
              <Globe size={22} />
            </div>
            <div>
              <div className="d1-card-label">DOMAINS VISITED</div>
              <div className="d1-card-value">{stats.uniqueDomains}</div>
              <div className="d1-card-subtext d1-sub-orange">
                <span>Unique web origins</span>
              </div>
            </div>
          </div>
        </div>

        <div className="d1-metric-card">
          <div className="d1-card-left-col">
            <div className="d1-icon-box d1-icon-purple">
              <Clock size={22} />
            </div>
            <div>
              <div className="d1-card-label">RECORDED TIME</div>
              <div className="d1-card-value">{stats.totalMinutes}m</div>
              <div className="d1-card-trend d1-trend-green">
                <span>{stats.totalHours} hours dwell time</span>
              </div>
            </div>
          </div>
        </div>

        <div className="d1-metric-card">
          <div className="d1-card-left-col">
            <div className="d1-icon-box d1-icon-emerald">
              <Eye size={22} />
            </div>
            <div>
              <div className="d1-card-label">TOTAL VISITS</div>
              <div className="d1-card-value">{stats.totalVisits}</div>
              <div className="d1-card-subtext d1-sub-blue">
                <span>Telemetry page events</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Filter & Search Controls Bar ──────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '14px 20px',
          margin: '22px 0',
          backdropFilter: 'blur(16px)'
        }}
      >
        {/* Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1', minWidth: '260px' }}>
          <Search size={16} style={{ color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search discovered resources, page titles, domains..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f8fafc',
              fontSize: '14px',
              width: '100%'
            }}
          />
        </div>

        {/* Sorting Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ArrowUpDown size={13} /> Sort:
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#f8fafc',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="duration" style={{ background: '#0f172a' }}>Most Recorded Time</option>
            <option value="recent" style={{ background: '#0f172a' }}>Recently Visited</option>
            <option value="visits" style={{ background: '#0f172a' }}>Most Visits</option>
          </select>
        </div>
      </div>

      {/* ── 4. Discovered Resources Grid ─────────────────────────────────── */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px auto', color: '#6366f1' }} />
          <p>Discovering observed browser resources...</p>
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="tx-empty-activity-placeholder" style={{ padding: '60px 20px' }}>
          <Compass size={36} className="tx-text-dim" style={{ marginBottom: '12px' }} />
          <h3>No matching resources discovered</h3>
          <p>
            Browse web pages with the TraceX Chrome extension enabled to automatically catalog visited documentation, repos, and websites.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '18px'
          }}
        >
          {filteredResources.map((res) => {
            const typeMeta = getResourceTypeMeta(res.resource_type, res.domain, res.url);
            const Icon = typeMeta.icon;
            const durationSecs = Number(res.total_observed_seconds) || 0;
            const visits = Number(res.visit_count) || 1;

            return (
              <div
                key={res.resource_id}
                style={{
                  background: 'rgba(15, 23, 42, 0.55)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.25s ease',
                  backdropFilter: 'blur(16px)',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                className="d1-rec-card-hover"
              >
                {/* Top Row: Favicon, Domain, Resource Type Badge */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          background: `${typeMeta.color}15`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '4px'
                        }}
                      >
                        <img
                          src={getFavicon(res.domain)}
                          alt=""
                          style={{ width: '16px', height: '16px', borderRadius: '3px' }}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#e2e8f0',
                          letterSpacing: '0.01em'
                        }}
                      >
                        {getDomainDisplay(res.domain)}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: `${typeMeta.color}15`,
                        color: typeMeta.color,
                        border: `1px solid ${typeMeta.color}35`,
                        fontWeight: 600
                      }}
                    >
                      {typeMeta.label}
                    </span>
                  </div>

                  {/* Resource Page Title */}
                  <h3
                    title={res.title || res.url}
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: '#f8fafc',
                      marginBottom: '8px',
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      minHeight: '42px'
                    }}
                  >
                    {res.title || res.domain || 'Observed Resource'}
                  </h3>

                  {/* URL sub-label */}
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#94a3b8',
                      marginBottom: '16px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontFamily: 'monospace'
                    }}
                    title={res.url || ''}
                  >
                    <code>{res.url || `https://${res.domain}`}</code>
                  </div>
                </div>

                {/* Bottom Metrics Bar */}
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '14px' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '10px',
                      marginBottom: '14px'
                    }}
                  >
                    {/* Recorded Time */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={13} style={{ color: '#38bdf8' }} />
                      <div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Recorded Time</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                          {formatSeconds(durationSecs)}
                        </div>
                      </div>
                    </div>

                    {/* Visits */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Eye size={13} style={{ color: '#a855f7' }} />
                      <div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Visits</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                          {visits} {visits === 1 ? 'visit' : 'visits'}
                        </div>
                      </div>
                    </div>

                    {/* First Observed */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={13} style={{ color: '#10b981' }} />
                      <div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>First Seen</div>
                        <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                          {formatRelativeTime(res.first_seen)}
                        </div>
                      </div>
                    </div>

                    {/* Last Visited */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={13} style={{ color: '#f59e0b' }} />
                      <div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Last Visited</div>
                        <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                          {formatRelativeTime(res.last_seen)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    {res.url ? (
                      <a
                        href={res.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12px',
                          color: '#38bdf8',
                          textDecoration: 'none',
                          fontWeight: 500,
                          padding: '4px 8px',
                          borderRadius: '6px',
                          background: 'rgba(56, 189, 248, 0.1)',
                          transition: 'background 0.2s'
                        }}
                      >
                        <span>Open Page</span>
                        <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Automatic Discovery</span>
                    )}

                    <button
                      onClick={() => navigate('/timeline')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        fontSize: '12px',
                        cursor: 'pointer',
                        padding: '4px 8px'
                      }}
                      title="View occurrences in Activity Timeline"
                    >
                      <span>Timeline</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
