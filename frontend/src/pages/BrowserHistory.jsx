import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  History,
  Search,
  Calendar,
  Globe,
  ExternalLink,
  Clock,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Database,
  TrendingUp,
  AlertCircle,
  Copy,
  Check,
  Zap,
} from 'lucide-react';
import { api } from '../api/api';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getFavicon(domain) {
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

function formatRelativeTime(isoString) {
  if (!isoString) return 'Unknown';
  try {
    const date  = new Date(isoString);
    const now   = new Date();
    const diff  = now - date;
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);

    if (mins  < 1)   return 'Just now';
    if (mins  < 60)  return `${mins}m ago`;
    if (hours < 24)  return `${hours}h ago`;
    if (days  < 7)   return `${days}d ago`;
    return date.toLocaleDateString();
  } catch {
    return isoString;
  }
}

function formatDateTime(isoString) {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleString([], {
      month: 'short', day: 'numeric',
      year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function getDateRange(preset) {
  const today = new Date();
  const fmt   = (d) => d.toISOString().split('T')[0];

  switch (preset) {
    case 'today':
      return { start: fmt(today), end: fmt(today) };
    case 'yesterday': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { start: fmt(y), end: fmt(y) };
    }
    case 'last7': {
      const d7 = new Date(today);
      d7.setDate(d7.getDate() - 6);
      return { start: fmt(d7), end: fmt(today) };
    }
    case 'last30': {
      const d30 = new Date(today);
      d30.setDate(d30.getDate() - 29);
      return { start: fmt(d30), end: fmt(today) };
    }
    default:
      return { start: null, end: null };
  }
}

// ── History Record Card with Expandable Details ──────────────────────────────
function HistoryCard({ record, index }) {
  const [imgError, setImgError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(record.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`hist-card ${expanded ? 'hist-card-expanded' : ''}`}
      style={{ '--delay': `${Math.min(index * 0.02, 0.3)}s` }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="hist-card-main-row">
        <div className="hist-card-icon">
          {!imgError && record.domain ? (
            <img
              src={getFavicon(record.domain)}
              alt={record.domain}
              onError={() => setImgError(true)}
              className="hist-favicon"
            />
          ) : (
            <Globe size={18} className="hist-favicon-fallback" />
          )}
        </div>

        <div className="hist-card-body">
          <div className="hist-card-title">
            {record.title || record.domain || 'Untitled Page'}
          </div>
          <div className="hist-card-url">
            <Globe size={11} className="hist-url-domain-icon" />
            <span className="hist-domain-bold">{record.domain}</span>
            <span className="hist-sep">·</span>
            <span className="hist-url-text">{record.url}</span>
          </div>
        </div>

        <div className="hist-card-meta">
          <div className="hist-visit-count">
            <TrendingUp size={12} />
            <span>{record.visit_count} {record.visit_count === 1 ? 'visit' : 'visits'}</span>
          </div>
          <div className="hist-time">
            <Clock size={11} />
            <span>{formatRelativeTime(record.last_visit_time)}</span>
          </div>
          <div className="hist-datetime">{formatDateTime(record.last_visit_time)}</div>
        </div>

        <div className="hist-card-actions" onClick={(e) => e.stopPropagation()}>
          <a
            href={record.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hist-external-link"
            title="Open in new tab"
          >
            <ExternalLink size={14} />
          </a>
          <button
            type="button"
            className="hist-expand-btn"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? 'Collapse details' : 'Expand details'}
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Expandable Details Drawer */}
      {expanded && (
        <div className="hist-expanded-drawer" onClick={(e) => e.stopPropagation()}>
          <div className="hist-drawer-grid">
            <div className="hist-drawer-col">
              <span className="hist-drawer-label">FULL DESTINATION URL</span>
              <div className="hist-full-url-row">
                <span className="hist-full-url">{record.url}</span>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="hist-drawer-copy-btn"
                  title="Copy full URL"
                >
                  {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="hist-drawer-meta-row">
              <div className="hist-meta-pill">
                <span className="hist-meta-k">First Visited:</span>
                <span className="hist-meta-v">
                  {record.first_visit_time ? formatDateTime(record.first_visit_time) : 'Recorded by extension'}
                </span>
              </div>
              <div className="hist-meta-pill">
                <span className="hist-meta-k">Last Recorded Visit:</span>
                <span className="hist-meta-v">{formatDateTime(record.last_visit_time)}</span>
              </div>
              <div className="hist-meta-pill">
                <span className="hist-meta-k">Storage Target:</span>
                <span className="hist-meta-v">MySQL (browser_history)</span>
              </div>
              <div className="hist-meta-pill">
                <span className="hist-meta-k">Telemetry Source:</span>
                <span className="hist-meta-v">{record.source || 'chrome_history'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main History Page ─────────────────────────────────────────────────────────
export default function BrowserHistory() {
  const navigate = useNavigate();
  const [records,    setRecords]    = useState([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  // Filters
  const [search,     setSearch]     = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [startDate,  setStartDate]  = useState('');
  const [endDate,    setEndDate]    = useState('');
  const [preset,     setPreset]     = useState('');
  const [page,       setPage]       = useState(0);
  const limit = 50;

  // Search debounce
  const searchTimer = useRef(null);

  const fetchHistory = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getBrowserHistory({
        search:     params.search     ?? search,
        domain:     params.domain     ?? domainFilter,
        start_date: (params.start_date ?? startDate) || undefined,
        end_date:   (params.end_date ?? endDate) || undefined,
        limit,
        offset: (params.page ?? page) * limit,
      });
      setRecords(result.records || []);
      setTotal(result.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [search, domainFilter, startDate, endDate, page]);

  useEffect(() => {
    fetchHistory();
  }, [page]);

  const handleSearch = (value) => {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(0);
      fetchHistory({ search: value, page: 0 });
    }, 400);
  };

  const applyPreset = (p) => {
    setPreset(p);
    const { start, end } = getDateRange(p);
    setStartDate(start || '');
    setEndDate(end || '');
    setPage(0);
    fetchHistory({ start_date: start, end_date: end, page: 0 });
  };

  const clearFilters = () => {
    setSearch('');
    setDomainFilter('');
    setStartDate('');
    setEndDate('');
    setPreset('');
    setPage(0);
    fetchHistory({ search: '', domain: '', start_date: null, end_date: null, page: 0 });
  };

  const applyFilters = () => {
    setPage(0);
    fetchHistory({ page: 0 });
  };

  const totalPages = Math.ceil(total / limit);
  const hasFilters = search || domainFilter || startDate || endDate;

  return (
    <div className="hist-page">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="hist-header">
        <div className="hist-header-left">
          <div className="hist-header-icon">
            <History size={22} />
          </div>
          <div>
            <h1 className="hist-title">History</h1>
            <p className="hist-subtitle">
              Your recorded browser history · <strong>{total.toLocaleString()}</strong> records
            </p>
          </div>
        </div>
        <div className="hist-header-actions">
          <div className="hist-db-badge">
            <Database size={12} />
            <span>MySQL · browser_history</span>
          </div>
          <button
            className="hist-refresh-btn"
            onClick={() => fetchHistory()}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Filter Bar ─────────────────────────────────────────────────────── */}
      <div className="hist-filters">
        {/* Search */}
        <div className="hist-search-wrap">
          <Search size={15} className="hist-search-icon" />
          <input
            type="text"
            className="hist-search-input"
            placeholder="Search titles, URLs, domains…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {search && (
            <button className="hist-clear-btn" onClick={() => handleSearch('')}>
              <X size={13} />
            </button>
          )}
        </div>

        {/* Domain filter */}
        <div className="hist-domain-wrap">
          <Globe size={13} className="hist-domain-icon" />
          <input
            type="text"
            className="hist-domain-input"
            placeholder="Filter domain…"
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
          />
        </div>

        {/* Date range */}
        <div className="hist-date-range">
          <Calendar size={13} />
          <input
            type="date"
            className="hist-date-input"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPreset(''); }}
          />
          <span className="hist-date-sep">→</span>
          <input
            type="date"
            className="hist-date-input"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPreset(''); }}
          />
        </div>

        {/* Apply / Clear */}
        <button className="hist-apply-btn" onClick={applyFilters}>
          <Filter size={13} />
          <span>Apply</span>
        </button>
        {hasFilters && (
          <button className="hist-clear-all-btn" onClick={clearFilters}>
            <X size={13} />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* ── Quick Date Presets ──────────────────────────────────────────────── */}
      <div className="hist-presets">
        {['today', 'yesterday', 'last7', 'last30'].map((p) => (
          <button
            key={p}
            className={`hist-preset-btn ${preset === p ? 'active' : ''}`}
            onClick={() => applyPreset(p)}
          >
            {p === 'today'     ? 'Today'
           : p === 'yesterday' ? 'Yesterday'
           : p === 'last7'     ? '7 Days'
                               : '30 Days'}
          </button>
        ))}
      </div>

      {/* ── Error State with Retry ─────────────────────────────────────────── */}
      {error && (
        <div className="hist-error-glass">
          <div className="hist-error-left">
            <AlertCircle size={22} color="#f87171" />
            <div>
              <div className="hist-error-title">Unable to reach TraceX backend.</div>
              <div className="hist-error-desc">Your locally buffered activity is safe. {error}</div>
            </div>
          </div>
          <button onClick={() => fetchHistory()} className="tx-btn-secondary" style={{ padding: '8px 16px' }}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* ── Records List ───────────────────────────────────────────────────── */}
      <div className="hist-list">
        {loading ? (
          <div className="hist-loading">
            <div className="hist-spinner" />
            <span>Loading from MySQL browser_history…</span>
          </div>
        ) : records.length === 0 ? (
          <div className="hist-empty-glass">
            <div className="hist-empty-icon-wrap">
              <History size={40} color="#6366f1" />
            </div>
            <h3 className="hist-empty-title">No activity recorded yet</h3>
            <p className="hist-empty-desc">
              {hasFilters
                ? 'No records match your active search and date filters.'
                : 'Install and connect the TraceX extension,\nthen browse normally.'}
            </p>
            {!hasFilters && (
              <button
                onClick={() => navigate('/connect-extension')}
                className="tx-btn-primary tx-btn-glow"
                style={{ marginTop: '16px' }}
              >
                <Zap size={15} />
                <span>Connect Extension</span>
              </button>
            )}
          </div>
        ) : (
          records.map((record, i) => (
            <HistoryCard key={record.history_id} record={record} index={i} />
          ))
        )}
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="hist-pagination">
          <button
            className="hist-page-btn"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="hist-page-info">
            Page {page + 1} of {totalPages} · {total.toLocaleString()} records
          </span>
          <button
            className="hist-page-btn"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1 || loading}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <style>{`
        /* ── History Page Styles (scoped with hist- prefix) ─────────────────── */
        .hist-page {
          padding: 0 0 48px;
          animation: fadeIn 0.3s ease;
        }

        .hist-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .hist-header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .hist-header-icon {
          width: 44px; height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex; align-items: center; justify-content: center;
          color: white;
          box-shadow: 0 4px 16px rgba(99,102,241,0.35);
          flex-shrink: 0;
        }

        .hist-title {
          font-size: 1.35rem;
          font-weight: 700;
          color: var(--text-primary, #e2e8f0);
          margin: 0;
        }

        .hist-subtitle {
          font-size: 0.8rem;
          color: var(--text-muted, #94a3b8);
          margin: 2px 0 0;
        }

        .hist-header-actions {
          display: flex; align-items: center; gap: 10px;
        }

        .hist-db-badge {
          display: flex; align-items: center; gap: 6px;
          padding: 6px 12px;
          background: rgba(16,185,129,0.12);
          border: 1px solid rgba(16,185,129,0.25);
          border-radius: 20px;
          font-size: 0.72rem;
          color: #34d399;
          font-family: monospace;
        }

        .hist-refresh-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 14px;
          background: rgba(99,102,241,0.15);
          border: 1px solid rgba(99,102,241,0.3);
          border-radius: 8px;
          color: #a5b4fc;
          font-size: 0.82rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .hist-refresh-btn:hover {
          background: rgba(99,102,241,0.25);
          color: #c7d2fe;
        }

        .hist-refresh-btn:disabled { opacity: 0.5; cursor: default; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Filters ─────────────────────────────────────────────────────────── */
        .hist-filters {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          padding: 14px 16px;
          margin-bottom: 12px;
          backdrop-filter: blur(10px);
        }

        .hist-search-wrap, .hist-domain-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .hist-search-icon, .hist-domain-icon {
          position: absolute;
          left: 10px;
          color: var(--text-muted, #94a3b8);
          pointer-events: none;
        }

        .hist-search-input, .hist-domain-input {
          padding: 8px 10px 8px 32px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: var(--text-primary, #e2e8f0);
          font-size: 0.82rem;
          outline: none;
          transition: border-color 0.2s;
        }

        .hist-search-input { width: 220px; }
        .hist-domain-input { width: 150px; }

        .hist-search-input:focus, .hist-domain-input:focus {
          border-color: rgba(99,102,241,0.5);
        }

        .hist-clear-btn {
          position: absolute;
          right: 8px;
          background: none;
          border: none;
          color: var(--text-muted, #94a3b8);
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
        }

        .hist-date-range {
          display: flex; align-items: center; gap: 6px;
          color: var(--text-muted, #94a3b8);
        }

        .hist-date-input {
          padding: 7px 10px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: var(--text-primary, #e2e8f0);
          font-size: 0.8rem;
          outline: none;
        }

        .hist-date-sep {
          color: var(--text-muted, #64748b);
          font-size: 0.8rem;
        }

        .hist-apply-btn {
          display: flex; align-items: center; gap: 5px;
          padding: 8px 14px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 0.82rem;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .hist-apply-btn:hover { opacity: 0.85; }

        .hist-clear-all-btn {
          display: flex; align-items: center; gap: 5px;
          padding: 8px 12px;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 8px;
          color: #f87171;
          font-size: 0.82rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .hist-clear-all-btn:hover { background: rgba(239,68,68,0.2); }

        /* ── Presets ──────────────────────────────────────────────────────────── */
        .hist-presets {
          display: flex; gap: 8px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .hist-preset-btn {
          padding: 6px 14px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px;
          color: var(--text-muted, #94a3b8);
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .hist-preset-btn:hover {
          background: rgba(99,102,241,0.1);
          border-color: rgba(99,102,241,0.3);
          color: #a5b4fc;
        }

        .hist-preset-btn.active {
          background: rgba(99,102,241,0.2);
          border-color: #6366f1;
          color: #c7d2fe;
          font-weight: 600;
        }

        /* ── Error ────────────────────────────────────────────────────────────── */
        .hist-error {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 14px 16px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 10px;
          color: #fca5a5;
          font-size: 0.85rem;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .hist-error-hint {
          width: 100%;
          color: #94a3b8;
          font-size: 0.78rem;
          margin-top: 4px;
        }

        .hist-error-hint code {
          background: rgba(255,255,255,0.1);
          padding: 1px 5px;
          border-radius: 4px;
          font-family: monospace;
          color: #fbbf24;
        }

        /* ── Loading ──────────────────────────────────────────────────────────── */
        .hist-loading {
          display: flex; flex-direction: column; align-items: center;
          gap: 16px; padding: 60px 0;
          color: var(--text-muted, #94a3b8);
        }

        .hist-spinner {
          width: 36px; height: 36px;
          border: 3px solid rgba(99,102,241,0.2);
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        /* ── Empty Glass State ─────────────────────────────────────────── */
        .hist-empty-glass {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 64px 24px;
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 20px;
          text-align: center;
          margin-top: 16px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
        }

        .hist-empty-icon-wrap {
          width: 64px; height: 64px;
          border-radius: 16px;
          background: rgba(99, 102, 241, 0.12);
          border: 1px solid rgba(99, 102, 241, 0.25);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 18px;
        }

        .hist-empty-title {
          font-size: 1.2rem;
          font-weight: 700;
          color: #f8fafc;
          margin: 0 0 8px 0;
        }

        .hist-empty-desc {
          font-size: 0.88rem;
          color: #cbd5e1;
          max-width: 440px;
          margin: 0;
          line-height: 1.5;
          white-space: pre-line;
        }

        /* ── Error Glass State ─────────────────────────────────────────── */
        .hist-error-glass {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px;
          background: rgba(239, 68, 68, 0.12);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 14px;
          margin-bottom: 20px;
          gap: 16px;
          flex-wrap: wrap;
        }

        .hist-error-left {
          display: flex; align-items: center; gap: 12px;
        }

        .hist-error-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: #fca5a5;
        }

        .hist-error-desc {
          font-size: 0.82rem;
          color: #fecaca;
          margin-top: 2px;
        }

        /* ── Record Cards (Glass Login-derived) ────────────────────────── */
        .hist-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .hist-card {
          display: flex;
          flex-direction: column;
          padding: 14px 18px;
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: pointer;
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.25);
          animation: fadeIn 0.3s ease both;
          animation-delay: var(--delay, 0s);
        }

        .hist-card:hover {
          background: rgba(22, 33, 58, 0.9);
          border-color: rgba(99, 102, 241, 0.35);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35), 0 0 15px rgba(99, 102, 241, 0.15);
          transform: translateY(-1px);
        }

        .hist-card-expanded {
          border-color: rgba(99, 102, 241, 0.45);
          background: rgba(22, 33, 58, 0.95);
        }

        .hist-card-main-row {
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
        }

        .hist-card-icon {
          width: 36px; height: 36px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }

        .hist-favicon { width: 20px; height: 20px; border-radius: 4px; }
        .hist-favicon-fallback { color: #94a3b8; }

        .hist-card-body {
          flex: 1;
          min-width: 0;
        }

        .hist-card-title {
          font-size: 0.94rem;
          font-weight: 600;
          color: #f8fafc;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 4px;
        }

        .hist-card-url {
          display: flex; align-items: center; gap: 6px;
          font-size: 0.76rem;
          color: #94a3b8;
          white-space: nowrap;
          overflow: hidden;
        }

        .hist-url-domain-icon { color: #38bdf8; opacity: 0.8; }
        .hist-domain-bold { color: #e2e8f0; font-weight: 600; }

        .hist-url-text {
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 440px;
          color: #94a3b8;
        }

        .hist-sep { color: #475569; }

        .hist-card-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 3px;
          flex-shrink: 0;
          min-width: 120px;
        }

        .hist-visit-count {
          display: flex; align-items: center; gap: 5px;
          font-size: 0.75rem;
          font-weight: 700;
          color: #c084fc;
          background: rgba(168, 85, 247, 0.12);
          padding: 2px 8px;
          border-radius: 12px;
          border: 1px solid rgba(168, 85, 247, 0.2);
        }

        .hist-time {
          display: flex; align-items: center; gap: 4px;
          font-size: 0.74rem;
          color: #cbd5e1;
        }

        .hist-datetime { font-size: 0.72rem; color: #94a3b8; }

        .hist-card-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-left: 6px;
        }

        .hist-external-link, .hist-expand-btn {
          display: flex; align-items: center; justify-content: center;
          width: 30px; height: 30px;
          border-radius: 8px;
          color: #94a3b8;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          cursor: pointer;
          transition: all 0.15s;
          text-decoration: none;
        }

        .hist-external-link:hover, .hist-expand-btn:hover {
          color: #f8fafc;
          background: rgba(99, 102, 241, 0.25);
          border-color: rgba(99, 102, 241, 0.4);
        }

        /* ── Expandable Details Drawer ──────────────────────────────────── */
        .hist-expanded-drawer {
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          animation: fadeIn 0.2s ease;
        }

        .hist-drawer-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .hist-drawer-label {
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.5px;
          color: #94a3b8;
        }

        .hist-full-url-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 12px;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          margin-top: 4px;
        }

        .hist-full-url {
          font-size: 0.78rem;
          font-family: monospace;
          color: #38bdf8;
          word-break: break-all;
        }

        .hist-drawer-copy-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          background: rgba(99, 102, 241, 0.18);
          border: 1px solid rgba(99, 102, 241, 0.35);
          border-radius: 6px;
          color: #a5b4fc;
          font-size: 0.74rem;
          font-weight: 600;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.15s;
        }

        .hist-drawer-copy-btn:hover {
          background: rgba(99, 102, 241, 0.3);
          color: #ffffff;
        }

        .hist-drawer-meta-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 4px;
        }

        .hist-meta-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 6px;
          font-size: 0.74rem;
        }

        .hist-meta-k { color: #94a3b8; font-weight: 600; }
        .hist-meta-v { color: #f8fafc; font-weight: 500; }

        /* ── Pagination ───────────────────────────────────────────────────────── */
        .hist-pagination {
          display: flex; align-items: center; justify-content: center;
          gap: 16px;
          margin-top: 28px;
          padding-top: 20px;
          border-top: 1px solid rgba(255,255,255,0.07);
        }

        .hist-page-btn {
          display: flex; align-items: center;
          padding: 8px 12px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: var(--text-muted, #94a3b8);
          cursor: pointer;
          transition: all 0.2s;
        }

        .hist-page-btn:hover:not(:disabled) {
          background: rgba(99,102,241,0.15);
          border-color: rgba(99,102,241,0.3);
          color: #a5b4fc;
        }

        .hist-page-btn:disabled { opacity: 0.4; cursor: default; }

        .hist-page-info {
          font-size: 0.82rem;
          color: var(--text-muted, #94a3b8);
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
