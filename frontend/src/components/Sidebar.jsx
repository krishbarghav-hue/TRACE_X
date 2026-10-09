import React from 'react';
import {
  LayoutDashboard,
  Clock,
  Globe,
  BarChart3,
  Calendar,
  Settings,
  ShieldCheck,
  BookOpen,
  FileText,
  Target,
  GraduationCap,
  Zap,
  History,
} from 'lucide-react';


export default function Sidebar({ activeTab, onSelectTab }) {
  const activityNav = [
    { id: 'today',         label: 'Today',           icon: LayoutDashboard },
    { id: 'timeline',      label: 'Timeline',        icon: Clock },
    { id: 'history',       label: 'History',         icon: History },
    { id: 'resources',     label: 'Resources',       icon: Globe },
    { id: 'analytics',     label: 'Analytics',       icon: BarChart3 },
    { id: 'daily-summary', label: 'Daily Summary',   icon: Calendar },
  ];

  const studyToolsNav = [
    { id: 'courses',        label: 'Courses',        icon: BookOpen },
    { id: 'study-sessions', label: 'Study Sessions', icon: GraduationCap },
    { id: 'notes',          label: 'Notes',          icon: FileText },
    { id: 'goals',          label: 'Goals',          icon: Target },
  ];

  const systemNav = [
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'privacy',  label: 'Privacy',  icon: ShieldCheck },
  ];

  const isCurrentActive = (id) => {
    if (id === 'today' && (activeTab === 'today' || activeTab === 'dashboard')) return true;
    return activeTab === id;
  };

  return (
    <aside className="d1-sidebar">
      {/* ── Brand Logo Header ────────────────────────────────────── */}
      <div className="d1-sidebar-header">
        <div className="d1-logo-container" onClick={() => onSelectTab('today')} style={{ cursor: 'pointer' }}>
          <div className="d1-logo-symbol">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 4C9 1 3 3 2 9C1 15 7 19 12 21C17 19 23 15 22 9C21 3 15 1 12 4Z"
                fill="url(#d1-logo-grad)"
              />
              <path
                d="M12 6C10 3 6 4 5 8C4 12 8 16 12 18C16 16 20 12 19 8C18 4 14 3 12 6Z"
                fill="#0f172a"
                opacity="0.3"
              />
              <defs>
                <linearGradient id="d1-logo-grad" x1="2" y1="2" x2="22" y2="22">
                  <stop stopColor="#a855f7" />
                  <stop offset="0.5" stopColor="#6366f1" />
                  <stop offset="1" stopColor="#0ea5e9" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="d1-logo-text">TraceX</span>
        </div>
      </div>

      {/* ── Scrollable Nav Links ──────────────────────────────────── */}
      <div className="d1-sidebar-scroll-area">
        {/* Section 1: ACTIVITY */}
        <div className="d1-nav-section">
          <div className="d1-nav-section-title">ACTIVITY</div>
          <nav className="d1-sidebar-nav">
            {activityNav.map((item) => {
              const Icon = item.icon;
              const active = isCurrentActive(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`d1-nav-btn ${active ? 'd1-nav-btn-active' : ''}`}
                >
                  <Icon size={17} strokeWidth={2} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Section 2: STUDY TOOLS */}
        <div className="d1-nav-section">
          <div className="d1-nav-section-title">STUDY TOOLS</div>
          <nav className="d1-sidebar-nav">
            {studyToolsNav.map((item) => {
              const Icon = item.icon;
              const active = isCurrentActive(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`d1-nav-btn ${active ? 'd1-nav-btn-active' : ''}`}
                >
                  <Icon size={17} strokeWidth={2} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Section 3: SYSTEM */}
        <div className="d1-nav-section">
          <div className="d1-nav-section-title">SYSTEM</div>
          <nav className="d1-sidebar-nav">
            {systemNav.map((item) => {
              const Icon = item.icon;
              const active = isCurrentActive(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`d1-nav-btn ${active ? 'd1-nav-btn-active' : ''}`}
                >
                  <Icon size={17} strokeWidth={2} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ── Bottom Habits Promo Card ──────────────────────────────── */}
      <div className="d1-sidebar-bottom">
        <div className="d1-promo-card">
          <div className="d1-promo-bg" />
          <div className="d1-promo-content">
            <div className="d1-promo-title">Learn Smarter</div>
            <div className="d1-promo-title">Track Deeper</div>
            <div className="d1-promo-sub">Build Better Habits</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
