import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  Globe,
  Radio,
  ExternalLink,
  Search,
  Bell,
  ChevronDown,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Layers,
  ShieldCheck,
  Download,
  Activity,
  FileText,
  Compass,
  CheckCircle2,
  Calendar,
  LogOut,
  Settings as SettingsIcon,
  Sun,
  Moon,
} from 'lucide-react';
import { api, EXTENSION_CONNECTED_KEY } from '../api/api';

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

function formatLiveTimer(totalSeconds) {
  const secs = Math.max(0, Number(totalSeconds) || 0);
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const h = Math.floor(m / 60);
  if (h > 0) {
    const remM = m % 60;
    return `${String(h).padStart(2, '0')}:${String(remM).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDurationDigital(totalSeconds) {
  const secs = Math.max(0, Number(totalSeconds) || 0);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return [
    h.toString().padStart(2, '0'),
    m.toString().padStart(2, '0'),
    s.toString().padStart(2, '0'),
  ].join(':');
}

function formatTime(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '';
  }
}

function getFavicon(domain) {
  if (!domain || typeof domain !== 'string') return '';
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

function inferCategory(domain = '', title = '') {
  const d = String(domain || '').toLowerCase();
  const t = String(title || '').toLowerCase();

  if (d.includes('youtube') || d.includes('vimeo') || d.includes('netflix') || d.includes('twitch') || d.includes('hotstar')) {
    return { name: 'Media & Video', color: '#ef4444' };
  }
  if (d.includes('openai') || d.includes('chatgpt') || d.includes('claude') || d.includes('anthropic') || d.includes('perplexity')) {
    return { name: 'AI & Research', color: '#f59e0b' };
  }
  if (d.includes('github') || d.includes('gitlab') || d.includes('leetcode') || d.includes('stackoverflow') || d.includes('localhost')) {
    return { name: 'Development', color: '#6366f1' };
  }
  if (d.includes('notion') || d.includes('docs.google') || d.includes('linear') || d.includes('obsidian')) {
    return { name: 'Notes & Planning', color: '#a855f7' };
  }
  if (d.includes('wikipedia') || d.includes('geeksforgeeks') || d.includes('w3schools') || d.includes('medium') || d.includes('arxiv')) {
    return { name: 'Documentation', color: '#0ea5e9' };
  }
  return { name: 'General Web', color: '#94a3b8' };
}

// ── Defensive Response Normalizer ────────────────────────────────────────────
function normalizeAnalytics(raw) {
  if (!raw) return null;
  const data = (raw && typeof raw === 'object' && 'data' in raw && raw.data && typeof raw.data === 'object')
    ? raw.data
    : raw;

  if (!data || typeof data !== 'object') return null;

  const totalActivities = Number(data.total_activities ?? 0) || 0;
  const totalSeconds = Number(data.total_seconds ?? 0) || 0;

  let totalMinutes = 0;
  if (typeof data.total_minutes === 'number' && !isNaN(data.total_minutes)) {
    totalMinutes = data.total_minutes;
  } else if (data.total_minutes !== undefined && data.total_minutes !== null && !isNaN(Number(data.total_minutes))) {
    totalMinutes = Number(data.total_minutes);
  } else {
    totalMinutes = Math.round((totalSeconds / 60) * 10) / 10;
  }

  const uniqueDomains = Number(data.unique_domains ?? 0) || 0;
  const uniqueResources = Number(data.unique_resources ?? 0) || 0;

  const rawTopDomains = Array.isArray(data.top_domains) ? data.top_domains : [];
  const topDomains = rawTopDomains
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const sec = Number(item.total_seconds ?? 0) || 0;
      const min = (typeof item.total_minutes === 'number' && !isNaN(item.total_minutes))
        ? item.total_minutes
        : (Math.round((sec / 60) * 10) / 10);
      return {
        domain: String(item.domain || 'unknown'),
        visits: Number(item.visits ?? 1) || 1,
        total_seconds: sec,
        total_minutes: min,
      };
    });

  let currentActivity = null;
  if (data.current_activity && typeof data.current_activity === 'object') {
    const ca = data.current_activity;
    if (ca.domain || ca.title) {
      currentActivity = {
        domain: String(ca.domain || ''),
        title: String(ca.title || ca.domain || ''),
        url: ca.url ? String(ca.url) : (ca.domain ? `https://${ca.domain}` : ''),
        duration_seconds: Number(ca.duration_seconds ?? 0) || 0,
        started_at: ca.started_at ? String(ca.started_at) : null,
        active: ca.active !== false,
      };
    }
  }

  return {
    date: data.date || new Date().toISOString().split('T')[0],
    total_activities: totalActivities,
    total_seconds: totalSeconds,
    total_minutes: totalMinutes,
    unique_domains: uniqueDomains,
    unique_resources: uniqueResources,
    top_domains: topDomains,
    current_activity: currentActivity,
  };
}

// ── Visual Sparklines ────────────────────────────────────────────────────────
function WaveSparkline({ color = '#8b5cf6' }) {
  return (
    <svg width="60" height="28" viewBox="0 0 60 28" fill="none" className="d1-sparkline">
      <path
        d="M2 22C10 14 15 25 24 16C32 8 38 18 46 10C51 5 55 12 58 4"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M2 22C10 14 15 25 24 16C32 8 38 18 46 10C51 5 55 12 58 4V28H2V22Z"
        fill={color}
        fillOpacity="0.15"
      />
    </svg>
  );
}

function BarSparkline({ color = '#10b981' }) {
  const heights = [10, 16, 8, 22, 14, 26, 18];
  return (
    <div className="d1-bar-sparkline">
      {heights.map((h, i) => (
        <span
          key={i}
          className="d1-bar-sparkline-item"
          style={{ height: `${h}px`, backgroundColor: color }}
        />
      ))}
    </div>
  );
}

function CircularProgress({ percentage, color = '#3b82f6', size = 52, stroke = 5 }) {
  const num = Math.max(0, Math.min(Number(percentage) || 0, 100));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (num / 100) * circumference;

  return (
    <div className="d1-circ-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span className="d1-circ-label">{Math.round(num)}%</span>
    </div>
  );
}

export default function Dashboard({ onNavigate, onLogout, theme, onToggleTheme }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Real Data states — Single Source of Truth
  const [todaySummary, setTodaySummary]       = useState(null);
  const [todayLogs, setTodayLogs]             = useState([]);
  const [trackingStatus, setTrackingStatus]   = useState({ is_paused: false, is_connected: false });
  const [currentActivity, setCurrentActivity] = useState(null);
  const [loading, setLoading]                 = useState(true);
  const [apiError, setApiError]               = useState(false);

  const [ticker, setTicker] = useState(0);

  // Live Clock & 1-second ticker for smooth live timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      setTicker((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch real API data with defensive error handling
  const loadData = useCallback(async () => {
    try {
      const user = api.getCurrentUser() || { user_id: 1, full_name: 'Krishna', email: 'test@tracex.com' };
      setCurrentUser(user);

      const [summaryRaw, logsRaw, statusRaw, currentActRaw] = await Promise.all([
        api.getActivityTodaySummary().catch((err) => {
          console.error('[TraceX] getActivityTodaySummary poll failed:', err);
          return null;
        }),
        api.getTodayActivities().catch((err) => {
          console.error('[TraceX] getTodayActivities poll failed:', err);
          return null;
        }),
        api.getTrackingStatus().catch((err) => {
          console.error('[TraceX] getTrackingStatus poll failed:', err);
          return null;
        }),
        api.getCurrentActivity().catch((err) => {
          console.error('[TraceX] getCurrentActivity poll failed:', err);
          return null;
        }),
      ]);

      let hadSuccess = false;

      // 1. Primary analytics normalization (Single source of truth)
      if (summaryRaw) {
        const normalized = normalizeAnalytics(summaryRaw);
        if (normalized) {
          setTodaySummary(normalized);
          hadSuccess = true;
          // Set current activity from verified analytics summary
          if (normalized.current_activity) {
            setCurrentActivity(normalized.current_activity);
          }
        }
      }

      // 2. Fallback / real-time override from /current endpoint
      if (currentActRaw && typeof currentActRaw === 'object') {
        hadSuccess = true;
        const cData = currentActRaw.data ?? currentActRaw;
        if (cData && (cData.active || cData.domain)) {
          setCurrentActivity({
            domain: String(cData.domain || ''),
            title: String(cData.title || cData.domain || ''),
            url: cData.url ? String(cData.url) : (cData.domain ? `https://${cData.domain}` : ''),
            duration_seconds: Number(cData.duration_seconds ?? 0) || 0,
            started_at: cData.started_at ? String(cData.started_at) : null,
            active: true,
          });
        } else if (cData && cData.active === false) {
          // If no active session reported and summary didn't contain current_activity
          if (!summaryRaw || !summaryRaw.current_activity) {
            setCurrentActivity(null);
          }
        }
      }

      // 3. Extension tracking status
      if (statusRaw && typeof statusRaw === 'object') {
        hadSuccess = true;
        const sData = statusRaw.data ?? statusRaw;
        setTrackingStatus({
          is_paused: Boolean(sData.is_paused),
          is_connected: Boolean(sData.is_connected),
        });
        if (sData.is_connected) {
          localStorage.setItem(EXTENSION_CONNECTED_KEY, 'true');
        }
      }

      // 4. Timeline logs
      if (logsRaw) {
        hadSuccess = true;
        const lData = logsRaw.data ?? logsRaw;
        if (Array.isArray(lData)) {
          setTodayLogs(lData);
        }
      }

      if (hadSuccess) {
        setApiError(false);
      } else if (!summaryRaw && !statusRaw && !currentActRaw && !logsRaw) {
        // Backend completely unreachable
        setApiError(true);
      }
    } catch (err) {
      console.error('[TraceX] Live polling failed:', err);
      setApiError(true);
      // NEVER setAnalytics(null) or blank out the dashboard on failure!
    } finally {
      setLoading(false);
    }
  }, []);

  // PART 2: Fast live polling (2.5s) to reflect tab switches immediately
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2500);
    return () => clearInterval(interval);
  }, [loadData]);

  // Real-time live duration computed dynamically from started_at
  const liveDuration = useMemo(() => {
    if (!currentActivity) return 0;
    if (currentActivity.started_at) {
      try {
        const startMs = new Date(currentActivity.started_at).getTime();
        if (!isNaN(startMs) && startMs > 0) {
          return Math.max(0, Math.floor((Date.now() - startMs) / 1000));
        }
      } catch {
        // Fallback to static duration_seconds
      }
    }
    return Number(currentActivity.duration_seconds) || 0;
  }, [currentActivity, ticker]);

  // Dynamic Greeting based on current hour
  const hour = currentTime.getHours();
  let timeOfDay = 'Evening';
  if (hour >= 5 && hour < 12) {
    timeOfDay = 'Morning';
  } else if (hour >= 12 && hour < 17) {
    timeOfDay = 'Afternoon';
  }

  const firstName = currentUser?.full_name?.split(' ')[0] || 'Krishna';
  const greeting = `Good ${timeOfDay}, ${firstName}`;

  const formattedDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  // Calculate Real Dashboard Metrics using ONE consistent source of truth
  const totalActivities = Number(todaySummary?.total_activities ?? (Array.isArray(todayLogs) ? todayLogs.length : 0)) || 0;
  const totalSeconds = Number(todaySummary?.total_seconds ?? (Array.isArray(todayLogs) ? todayLogs.reduce((acc, l) => acc + (Number(l?.duration_seconds) || 0), 0) : 0)) || 0;
  const totalMinutes = todaySummary?.total_minutes !== undefined && todaySummary?.total_minutes !== null
    ? Number(todaySummary.total_minutes)
    : (Math.round((totalSeconds / 60) * 10) / 10);
  const totalWebsites = Number(todaySummary?.unique_domains ?? (Array.isArray(todayLogs) ? new Set(todayLogs.map((l) => l?.domain).filter(Boolean)).size : 0)) || 0;
  const totalResources = Number(todaySummary?.unique_resources ?? (Array.isArray(todayLogs) ? new Set(todayLogs.map((l) => l?.url).filter(Boolean)).size : 0)) || 0;

  // Active time display matching verified backend format (e.g. 123.2 minutes)
  const activeTimeDisplay = `${totalMinutes} minutes`;

  // Has activity today?
  const hasActivityToday = totalActivities > 0 || (Array.isArray(todayLogs) && todayLogs.length > 0);

  // PART 3: Connection & live activity status
  const isPaused = Boolean(trackingStatus?.is_paused);
  const isLive = Boolean(currentActivity && (currentActivity.domain || currentActivity.title));
  const isConnected = Boolean(trackingStatus?.is_connected || localStorage.getItem(EXTENSION_CONNECTED_KEY) === 'true');

  let statusConfig;
  if (isPaused) {
    statusConfig = {
      beaconClass: 'tx-beacon-paused',
      ringClass: '',
      color: '#f59e0b',
      text: '🟡 Tracking Paused',
      subtext: 'Tracking is currently paused in the TraceX extension. Resume to record activity.',
    };
  } else if (isLive) {
    statusConfig = {
      beaconClass: 'tx-beacon-active',
      ringClass: 'tx-ring-active',
      color: '#10b981',
      text: '🟢 Extension Connected — Tracking Active',
      subtext: `Currently recording ${currentActivity?.domain || 'active tab'} live to local MySQL database.`,
    };
  } else if (isConnected) {
    statusConfig = {
      beaconClass: 'tx-beacon-idle',
      ringClass: '',
      color: '#38bdf8',
      text: '🔵 Extension Ready — Waiting for browser activity...',
      subtext: 'Extension is connected and listening for web browsing activity.',
    };
  } else {
    statusConfig = {
      beaconClass: 'tx-beacon-idle',
      ringClass: '',
      color: '#94a3b8',
      text: '○ Extension Ready — Waiting for browser activity...',
      subtext: 'Telemetry events log directly into your local database. Zero third-party surveillance.',
    };
  }

  // Top domains for PART 6 Donut Chart & TOP SITES (Single source of truth)
  const domainDistribution = useMemo(() => {
    if (Array.isArray(todaySummary?.top_domains) && todaySummary.top_domains.length > 0) {
      return todaySummary.top_domains.slice(0, 5);
    }
    if (Array.isArray(todayLogs) && todayLogs.length > 0) {
      const dMap = {};
      todayLogs.forEach((l) => {
        if (!l || !l.domain) return;
        if (!dMap[l.domain]) dMap[l.domain] = { domain: l.domain, total_seconds: 0, visits: 0 };
        dMap[l.domain].total_seconds += (Number(l.duration_seconds) || 60);
        dMap[l.domain].visits += 1;
      });
      return Object.values(dMap).sort((a, b) => b.total_seconds - a.total_seconds).slice(0, 5);
    }
    return [];
  }, [todaySummary, todayLogs]);

  // Group observed activities by category for PART 7 ("WHAT YOU DID TODAY")
  const derivedCategories = useMemo(() => {
    if (Array.isArray(todayLogs) && todayLogs.length > 0) {
      const catMap = {};
      let sumSecs = 0;

      todayLogs.forEach((log) => {
        if (!log) return;
        const cat = inferCategory(log.domain, log.page_title);
        const s = Number(log.duration_seconds) || 60;
        sumSecs += s;
        if (!catMap[cat.name]) {
          catMap[cat.name] = { name: cat.name, color: cat.color, seconds: 0, count: 0 };
        }
        catMap[cat.name].seconds += s;
        catMap[cat.name].count += 1;
      });

      return Object.values(catMap)
        .sort((a, b) => b.seconds - a.seconds)
        .map((item) => ({
          ...item,
          percentage: sumSecs > 0 ? Math.round((item.seconds / sumSecs) * 100) : 0,
        }));
    }

    // Fallback: derive categories from domainDistribution
    if (Array.isArray(domainDistribution) && domainDistribution.length > 0) {
      const catMap = {};
      let sumSecs = 0;

      domainDistribution.forEach((d) => {
        if (!d || !d.domain) return;
        const cat = inferCategory(d.domain, '');
        const s = Number(d.total_seconds) || 60;
        sumSecs += s;
        if (!catMap[cat.name]) {
          catMap[cat.name] = { name: cat.name, color: cat.color, seconds: 0, count: 0 };
        }
        catMap[cat.name].seconds += s;
        catMap[cat.name].count += (Number(d.visits) || 1);
      });

      return Object.values(catMap)
        .sort((a, b) => b.seconds - a.seconds)
        .map((item) => ({
          ...item,
          percentage: sumSecs > 0 ? Math.round((item.seconds / sumSecs) * 100) : 0,
        }));
    }

    return [];
  }, [todayLogs, domainDistribution]);

  // Colors for donut chart
  const donutColors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#94a3b8'];

  // Filtered logs for search
  const filteredLogs = useMemo(() => {
    if (!Array.isArray(todayLogs)) return [];
    if (!searchQuery.trim()) return todayLogs;
    const q = searchQuery.toLowerCase();
    return todayLogs.filter(
      (l) => l && (l.domain?.toLowerCase().includes(q) || l.page_title?.toLowerCase().includes(q) || l.url?.toLowerCase().includes(q))
    );
  }, [todayLogs, searchQuery]);

  return (
    <div className="d1-dashboard-container">
      {/* ── Optional Connection Warning if FastAPI is temporarily stopped ── */}
      {apiError && (
        <div
          className="tx-connection-warning-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.28)',
            color: '#fca5a5',
            padding: '8px 16px',
            borderRadius: '10px',
            fontSize: '13px',
            marginBottom: '16px',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                boxShadow: '0 0 8px #ef4444',
                display: 'inline-block',
              }}
            />
            <span>
              <strong>Backend connection interrupted:</strong> Displaying cached data. Reconnecting to local telemetry service...
            </span>
          </div>
          <button
            onClick={loadData}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#ffffff',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Retry Now
          </button>
        </div>
      )}

      {/* ── 1. Scenic Mountain Twilight Hero Header ──────────────────────── */}
      <div className="d1-hero-banner">
        <img
          src="/mountain_hero_panorama.jpg"
          alt="Panoramic Twilight Mountains"
          className="d1-hero-bg-img"
        />
        <div className="d1-hero-overlay" />

        <div className="d1-hero-top-row">
          {/* Greeting on the left */}
          <div className="d1-hero-greeting-col">
            <h1 className="d1-hero-title">
              {greeting} <span className="d1-wave-hand">👋</span>
            </h1>
            <p className="d1-hero-sub">Here's what your digital day looked like.</p>
          </div>

          {/* Search bar in the center */}
          <div className="d1-hero-search-col">
            <div className="d1-search-box">
              <Search size={15} className="d1-search-icon" />
              <input
                type="text"
                placeholder="Search observed activity, domains, resources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="d1-search-input"
              />
              <span className="d1-search-shortcut">⌘K</span>
            </div>
          </div>

          {/* Right: Date, Time, Notification, User Profile */}
          <div className="d1-hero-meta-col">
            <div className="d1-hero-clock-box">
              <div className="d1-hero-date">{formattedDate}</div>
              <div className="d1-hero-time">{formattedTime}</div>
            </div>

            <div
              className="d1-hero-bell-btn"
              title="Activity status"
              onClick={() => onNavigate('/settings')}
            >
              <Bell size={18} />
              {hasActivityToday && <span className="d1-bell-badge">●</span>}
            </div>

            {/* User Profile Pill with Dropdown */}
            <div className="d1-profile-wrapper">
              <div
                className="d1-hero-user-pill"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
              >
                <div className="d1-avatar-circle">{firstName.charAt(0).toUpperCase()}</div>
                <span className="d1-user-name">{firstName}</span>
                <ChevronDown size={14} className="d1-chevron" />
              </div>

              {showProfileMenu && (
                <div className="d1-user-dropdown" onClick={(e) => e.stopPropagation()}>
                  <div className="d1-dropdown-user-info">
                    <strong>{currentUser?.full_name || 'Krishna'}</strong>
                    <span>{currentUser?.email || 'test@tracex.com'}</span>
                  </div>
                  <div className="d1-dropdown-divider" />
                  <button onClick={() => { setShowProfileMenu(false); onNavigate('/settings'); }} className="d1-dropdown-item">
                    <SettingsIcon size={14} />
                    <span>Settings</span>
                  </button>
                  <button onClick={() => { setShowProfileMenu(false); onToggleTheme && onToggleTheme(); }} className="d1-dropdown-item">
                    {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                    <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                  </button>
                  <button onClick={() => { setShowProfileMenu(false); onNavigate('/privacy'); }} className="d1-dropdown-item">
                    <ShieldCheck size={14} />
                    <span>Privacy Guarantee</span>
                  </button>
                  <div className="d1-dropdown-divider" />
                  <button onClick={() => { setShowProfileMenu(false); onLogout && onLogout(); }} className="d1-dropdown-item d1-dropdown-danger">
                    <LogOut size={14} />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Motivational / Statement quote badge on the lower right */}
        <div className="d1-hero-quote-card">
          <span>“See what you actually did today.”</span>
        </div>
      </div>

      {/* ── Status Banner: Extension Connection & Tracking Active (PART 3) ── */}
      <div className="tx-status-banner-row">
        <div className="tx-status-banner-content">
          <div className="tx-status-pulse-container">
            <span className={`tx-status-beacon ${statusConfig.beaconClass}`} />
            {statusConfig.ringClass ? (
              <span className={`tx-status-beacon-ring ${statusConfig.ringClass}`} />
            ) : null}
          </div>
          <div className="tx-status-text-wrap">
            <div className="tx-status-headline" style={{ color: statusConfig.color }}>
              {statusConfig.text}
            </div>
            <div className="tx-status-subtext">
              {statusConfig.subtext}
            </div>
          </div>
        </div>

        <div className="tx-status-banner-action">
          <button onClick={() => onNavigate('/privacy')} className="tx-btn-ghost-sm">
            <ShieldCheck size={14} color="#10b981" />
            <span>100% Local & Private</span>
          </button>
        </div>
      </div>

      {/* ── 2. Top Metric Cards Row (REAL API DATA) ─────────────────────── */}
      <div className="d1-metrics-row">
        {/* Card 1: ACTIVE TIME */}
        <div className="d1-metric-card">
          <div className="d1-card-left-col">
            <div className="d1-icon-box d1-icon-blue">
              <Clock size={22} />
            </div>
            <div>
              <div className="d1-card-label">ACTIVE TIME</div>
              <div className="d1-card-value">{activeTimeDisplay}</div>
              <div className="d1-card-trend d1-trend-green">
                <span>{hasActivityToday ? '↑ Recorded today' : '○ 0m recorded today'}</span>
              </div>
            </div>
          </div>
          <WaveSparkline color="#0ea5e9" />
        </div>

        {/* Card 2: ACTIVITIES */}
        <div className="d1-metric-card">
          <div className="d1-card-left-col">
            <div className="d1-icon-box d1-icon-purple">
              <Activity size={22} />
            </div>
            <div>
              <div className="d1-card-label">ACTIVITIES</div>
              <div className="d1-card-value">{totalActivities}</div>
              <div className="d1-card-trend d1-trend-green">
                <span>{totalActivities > 0 ? `↑ ${totalActivities} visits today` : '○ 0 visits today'}</span>
              </div>
            </div>
          </div>
          <BarSparkline color="#8b5cf6" />
        </div>

        {/* Card 3: WEBSITES */}
        <div className="d1-metric-card">
          <div className="d1-card-left-col">
            <div className="d1-icon-box d1-icon-orange">
              <Globe size={22} />
            </div>
            <div>
              <div className="d1-card-label">WEBSITES</div>
              <div className="d1-card-value">{totalWebsites}</div>
              <div className="d1-card-subtext d1-sub-orange">
                <span>{totalWebsites > 0 ? `${totalWebsites} distinct domains` : '0 domains'}</span>
              </div>
            </div>
          </div>
          <CircularProgress percentage={totalWebsites > 0 ? Math.min(totalWebsites * 15, 100) : 0} color="#f97316" />
        </div>

        {/* Card 4: RESOURCES */}
        <div className="d1-metric-card">
          <div className="d1-card-left-col">
            <div className="d1-icon-box d1-icon-emerald">
              <Compass size={22} />
            </div>
            <div>
              <div className="d1-card-label">RESOURCES</div>
              <div className="d1-card-value">{totalResources}</div>
              <div className="d1-card-subtext d1-sub-blue">
                <span>{totalResources > 0 ? `${totalResources} unique URLs` : '0 pages'}</span>
              </div>
            </div>
          </div>
          <CircularProgress percentage={totalResources > 0 ? Math.min(totalResources * 8, 100) : 0} color="#10b981" />
        </div>
      </div>

      {/* ── EMPTY STATE ONBOARDING CARD (Only when 0 activities AND no active tab) ── */}
      {!hasActivityToday && !isLive && !loading && (
        <div className="tx-glass-empty-state">
          <div className="tx-empty-state-icon">
            <Radio size={32} />
          </div>

          <h2 className="tx-empty-state-title">No activity recorded yet</h2>
          <p className="tx-empty-state-desc">
            Install and connect the TraceX extension,
            <br />
            then browse normally.
          </p>

          <div className="tx-empty-state-actions">
            <button
              onClick={() => onNavigate('/welcome')}
              className="tx-btn-glass-primary"
            >
              <Download size={16} />
              <span>Connect Extension</span>
            </button>

            <button
              onClick={loadData}
              className="tx-btn-glass-secondary"
            >
              <Activity size={16} />
              <span>Check Connection</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 3. Main 3-Column Layout ──────────────────────────────────────── */}
      <div className="d1-main-grid">
        {/* ── Column 1: LIVE BROWSER ACTIVITY (PART 1) ──────────────────── */}
        <div className="d1-panel d1-panel-activity">
          <div className="d1-panel-header">
            <div className="d1-panel-title-group">
              <div className="d1-header-icon d1-header-purple">
                <Radio size={16} />
              </div>
              <h2 className="d1-panel-title">LIVE BROWSER ACTIVITY</h2>
              {isLive && (
                <span className="d1-live-badge">
                  <span className="d1-pulse-dot" /> Live
                </span>
              )}
            </div>
            <button onClick={() => onNavigate('/timeline')} className="d1-btn-view-all">
              Timeline →
            </button>
          </div>

          {isLive && currentActivity ? (
            <div className="tx-live-tab-card">
              <div className="tx-live-tab-top">
                <div className="tx-live-status-pill">
                  <span className="tx-live-pulse-dot" />
                  <span className="tx-live-pill-text">🟢 LIVE</span>
                </div>
                <span className="tx-live-active-tag">
                  <span className="tx-live-tag-pip" /> Active
                </span>
              </div>

              <div className="tx-live-tab-main">
                <div className="tx-live-favicon-large">
                  <img
                    src={getFavicon(currentActivity.domain)}
                    alt=""
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
                <div className="tx-live-tab-info">
                  <div className="tx-live-domain-title" title={currentActivity.domain || ''}>
                    {currentActivity.domain || 'Active Domain'}
                  </div>
                  <div className="tx-live-page-headline" title={currentActivity.title || currentActivity.domain || ''}>
                    {currentActivity.title || currentActivity.domain || 'Active Tab'}
                  </div>
                  <div className="tx-live-url-sub" title={currentActivity.url || ''}>
                    <code>{currentActivity.url || currentActivity.domain || ''}</code>
                  </div>
                </div>
              </div>

              <div className="tx-live-tab-bottom">
                <div className="tx-live-timer-wrap">
                  <span className="tx-live-timer-label">CURRENT DURATION</span>
                  <div className="tx-live-timer-digital">
                    {formatLiveTimer(liveDuration)}
                  </div>
                </div>
                <div className="tx-live-tab-meta">
                  <span className="tx-live-meta-badge">Active Tab</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="tx-live-tab-empty">
              <div className="tx-live-empty-icon">
                <Radio size={32} />
              </div>
              <h3 className="tx-live-empty-title">○ Waiting for browser activity...</h3>
              <p className="tx-live-empty-desc">
                Navigate to any website in Chrome with the TraceX extension enabled to stream live telemetry.
              </p>
              <div className="tx-live-empty-status">
                <span className="tx-live-empty-dot" /> Extension Ready
              </div>
            </div>
          )}
        </div>

        {/* ── Column 2: TIME DISTRIBUTION (PART 6) ─────────────────────── */}
        <div className="d1-panel d1-panel-distribution">
          <div className="d1-panel-header">
            <div className="d1-panel-title-group">
              <div className="d1-header-icon d1-header-blue">
                <Clock size={16} />
              </div>
              <h2 className="d1-panel-title">TIME DISTRIBUTION</h2>
            </div>
            <button onClick={() => onNavigate('/analytics')} className="d1-dropdown-btn">
              <span>Analytics →</span>
            </button>
          </div>

          {/* Donut Chart & Legend */}
          <div className="d1-donut-layout">
            <div className="d1-donut-visual">
              <svg width="160" height="160" viewBox="0 0 160 160">
                {domainDistribution.length === 0 ? (
                  // Empty state ring
                  <circle
                    cx="80"
                    cy="80"
                    r="56"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeWidth="18"
                  />
                ) : (
                  // Dynamic SVG donut segments
                  (() => {
                    const totalDonutSecs = domainDistribution.reduce((acc, d) => acc + (Number(d?.total_seconds) || 1), 0) || 1;
                    const circumference = 2 * Math.PI * 56; // 351.858
                    let accumulatedOffset = 0;

                    return domainDistribution.map((item, i) => {
                      const secs = Number(item?.total_seconds) || 1;
                      const pct = secs / totalDonutSecs;
                      const strokeDasharray = `${pct * circumference} ${circumference}`;
                      const strokeDashoffset = -accumulatedOffset;
                      accumulatedOffset += pct * circumference;
                      const color = donutColors[i % donutColors.length];

                      return (
                        <circle
                          key={item?.domain || i}
                          cx="80"
                          cy="80"
                          r="56"
                          fill="none"
                          stroke={color}
                          strokeWidth="18"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                          transform="rotate(-90 80 80)"
                          style={{ transition: 'stroke-dasharray 0.6s ease' }}
                        />
                      );
                    });
                  })()
                )}
              </svg>

              <div className="d1-donut-center">
                <span className="d1-donut-hrs">{formatSecondsToHhMm(totalSeconds)}</span>
                <span className="d1-donut-sub">Total Active</span>
              </div>
            </div>

            {/* Legend */}
            <div className="d1-donut-legend">
              {domainDistribution.length === 0 ? (
                <div className="tx-donut-empty-legend">
                  <span>No domain activity yet today</span>
                </div>
              ) : (
                domainDistribution.map((item, i) => {
                  const color = donutColors[i % donutColors.length];
                  const totalDonutSecs = domainDistribution.reduce((acc, d) => acc + (Number(d?.total_seconds) || 1), 0) || 1;
                  const secs = Number(item?.total_seconds) || 0;
                  const pct = totalDonutSecs > 0 ? Math.round((secs / totalDonutSecs) * 100) : 0;

                  return (
                    <div key={item?.domain || i} className="d1-legend-item">
                      <span className="d1-legend-dot" style={{ backgroundColor: color }} />
                      <span className="d1-legend-name" title={item?.domain || ''}>
                        {item?.domain || 'unknown'} ({pct}%)
                      </span>
                      <span className="d1-legend-time">{formatSecondsToHhMm(secs)}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Bottom: Observed Activity Focus */}
          <div className="d1-ratio-section">
            <div className="d1-ratio-header">
              <div className="d1-ratio-title-wrap">
                <div className="d1-ratio-icon">
                  <Layers size={13} />
                </div>
                <span className="d1-ratio-title">Observed Focus Distribution</span>
              </div>
            </div>

            {derivedCategories.length > 0 ? (
              <div className="d1-ratio-bar">
                {derivedCategories.map((c) => (
                  <div
                    key={c.name}
                    style={{
                      width: `${c.percentage}%`,
                      backgroundColor: c.color,
                      height: '100%',
                    }}
                    title={`${c.name}: ${c.percentage}%`}
                  />
                ))}
              </div>
            ) : (
              <div className="d1-ratio-bar">
                <div style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.06)', height: '100%' }} />
              </div>
            )}

            <div className="d1-ratio-labels">
              {derivedCategories.slice(0, 2).map((c) => (
                <span key={c.name} style={{ color: c.color }}>
                  {c.percentage}% {c.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Column 3: TOP SITES TODAY (PART 7) ────────────────────── */}
        <div className="d1-panel d1-panel-recommendations">
          <div className="d1-panel-header">
            <div className="d1-panel-title-group">
              <div className="d1-header-icon d1-header-yellow">
                <Sparkles size={16} />
              </div>
              <h2 className="d1-panel-title">TOP SITES TODAY</h2>
            </div>
            <span className="tx-tag-derived" title="Factual browsing metrics aggregated from recorded activity">
              Derived from recorded activity
            </span>
          </div>

          <div className="d1-recs-list">
            {domainDistribution.length === 0 ? (
              <div className="tx-empty-activity-placeholder" style={{ padding: '24px 12px' }}>
                <Activity size={24} className="tx-text-dim" />
                <p>No activity recorded yet</p>
                <span>Visited domains and active dwell time will rank here as you browse.</span>
              </div>
            ) : (
              domainDistribution.slice(0, 4).map((d, idx) => {
                const totalDonutSecs = domainDistribution.reduce((acc, item) => acc + (Number(item?.total_seconds) || 1), 0) || 1;
                const secs = Number(d?.total_seconds) || 0;
                const pct = totalDonutSecs > 0 ? Math.round((secs / totalDonutSecs) * 100) : 0;
                const color = donutColors[idx % donutColors.length];
                const visits = Number(d?.visits) || 1;

                return (
                  <div key={d?.domain || idx} className="d1-rec-card">
                    <div className="d1-rec-num">#{idx + 1}</div>
                    <div
                      className="d1-rec-icon-box"
                      style={{ backgroundColor: `${color}18`, color: color }}
                    >
                      <img
                        src={getFavicon(d?.domain)}
                        alt=""
                        style={{ width: 16, height: 16, borderRadius: 3 }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                    <div className="d1-rec-details">
                      <div className="d1-rec-top-row">
                        <h4 className="d1-rec-topic">{d?.domain || 'unknown'}</h4>
                        <span
                          className="d1-tag-course"
                          style={{ borderColor: `${color}40`, color: color }}
                        >
                          {formatSecondsToHhMm(secs)}
                        </span>
                        <span className="d1-tag-priority-high">{pct}% of Day</span>
                      </div>
                      <p className="d1-rec-desc">
                        Recorded across <strong>{visits} visit{visits !== 1 ? 's' : ''}</strong> from observed browsing.
                      </p>
                    </div>
                    <button
                      onClick={() => onNavigate('/timeline')}
                      className="d1-rec-arrow-btn"
                      title="View in Timeline"
                    >
                      <ArrowRight size={16} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── 4. Lower Row: TIMELINE PREVIEW (PART 8) & TOP RESOURCES (PART 9) */}
      <div className="d1-lower-grid">
        {/* Timeline Preview (Part 8) */}
        <div className="d1-panel d1-panel-timeline-preview">
          <div className="d1-panel-header">
            <div className="d1-panel-title-group">
              <div className="d1-header-icon d1-header-blue">
                <Clock size={16} />
              </div>
              <h2 className="d1-panel-title">TIMELINE PREVIEW</h2>
            </div>
            <button
              onClick={() => onNavigate('/timeline')}
              className="tx-btn-secondary-sm"
            >
              <span>View Full Timeline →</span>
            </button>
          </div>

          <div className="tx-timeline-preview-stream">
            {!Array.isArray(todayLogs) || todayLogs.length === 0 ? (
              <div className="tx-empty-activity-placeholder">
                <Clock size={24} className="tx-text-dim" />
                <p>Timeline is clear</p>
                <span>Browse web pages with the extension active to build your timeline.</span>
              </div>
            ) : (
              todayLogs.slice(0, 4).map((log, index) => (
                <div key={log?.activity_id || index} className="tx-tp-row">
                  <div className="tx-tp-time">{formatTime(log?.visit_time || log?.started_at)}</div>
                  <div className="tx-tp-dot" />
                  <div className="tx-tp-content">
                    <div className="tx-tp-head">
                      <span className="tx-tp-domain">{log?.domain || 'unknown'}</span>
                      <span className="tx-tp-duration">{formatSecondsToHhMm(Number(log?.duration_seconds) || 30)}</span>
                    </div>
                    <div className="tx-tp-title" title={log?.page_title || log?.url || ''}>
                      {log?.page_title || log?.url || log?.domain || 'Web activity'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Resources Today (Part 9) */}
        <div className="d1-panel d1-panel-top-resources">
          <div className="d1-panel-header">
            <div className="d1-panel-title-group">
              <div className="d1-header-icon d1-header-purple">
                <Compass size={16} />
              </div>
              <h2 className="d1-panel-title">TOP RESOURCES TODAY</h2>
            </div>
            <button
              onClick={() => onNavigate('/resources')}
              className="tx-btn-secondary-sm"
            >
              <span>All Resources →</span>
            </button>
          </div>

          <div className="tx-top-resources-list">
            {domainDistribution.length === 0 ? (
              <div className="tx-empty-activity-placeholder">
                <Compass size={24} className="tx-text-dim" />
                <p>No resources recorded yet</p>
                <span>Visited domains and docs will rank here based on dwell time.</span>
              </div>
            ) : (
              domainDistribution.slice(0, 5).map((d, idx) => {
                const maxSecs = Number(domainDistribution[0]?.total_seconds) || 1;
                const secs = Number(d?.total_seconds) || 0;
                const fillPct = Math.min(100, Math.max(10, Math.round((secs / maxSecs) * 100)));

                return (
                  <div key={d?.domain || idx} className="tx-tr-row">
                    <div className="tx-tr-rank">#{idx + 1}</div>
                    <img
                      src={getFavicon(d?.domain)}
                      alt=""
                      className="tx-tr-favicon"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div className="tx-tr-info">
                      <div className="tx-tr-name">{d?.domain || 'unknown'}</div>
                      <div className="tx-tr-bar-bg">
                        <div
                          className="tx-tr-bar-fill"
                          style={{
                            width: `${fillPct}%`,
                            backgroundColor: donutColors[idx % donutColors.length],
                          }}
                        />
                      </div>
                    </div>
                    <div className="tx-tr-time">
                      {formatSecondsToHhMm(secs)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
