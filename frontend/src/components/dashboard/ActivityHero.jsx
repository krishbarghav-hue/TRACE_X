import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Sun, Moon, ShieldCheck, Zap, Activity } from 'lucide-react';

export default function ActivityHero({
  isTrackingActive = false,
  hasRecentActivity = false,
  onRefresh,
  loading = false,
  theme = 'dark',
  onToggleTheme,
  searchQuery = '',
  onSearchChange,
}) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Dynamic Greeting based on current hour
  const hour = currentTime.getHours();
  let greeting = 'Good Evening';
  if (hour >= 5 && hour < 12) {
    greeting = 'Good Morning';
  } else if (hour >= 12 && hour < 17) {
    greeting = 'Good Afternoon';
  }

  const formattedDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const formattedClock = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <div className="tx-hero-banner">
      {/* Background atmospheric scenery */}
      <div className="tx-hero-backdrop">
        <div className="tx-hero-gradient-orb tx-hero-orb-1" />
        <div className="tx-hero-gradient-orb tx-hero-orb-2" />
        <div className="tx-hero-gradient-orb tx-hero-orb-3" />
        
        {/* Subtle atmospheric mountain silhouette */}
        <svg
          className="tx-hero-mountains"
          viewBox="0 0 1440 280"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <path
            d="M0 280L120 230C240 180 480 80 720 120C960 160 1200 240 1320 260L1440 280V280H1320C1200 280 960 280 720 280C480 280 240 280 120 280H0Z"
            fill="url(#mountainGrad1)"
            opacity="0.25"
          />
          <path
            d="M0 280L160 210C320 140 640 110 880 160C1120 210 1280 250 1360 270L1440 280V280H0Z"
            fill="url(#mountainGrad2)"
            opacity="0.35"
          />
          <path
            d="M0 280L200 240C400 200 680 190 920 220C1160 250 1300 270 1370 275L1440 280V280H0Z"
            fill="url(#mountainGrad3)"
            opacity="0.5"
          />
          <defs>
            <linearGradient id="mountainGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <linearGradient id="mountainGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#090d16" />
            </linearGradient>
            <linearGradient id="mountainGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#090d16" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Content Layer */}
      <div className="tx-hero-content">
        {/* Top bar: Badge, Live Clock, Status, Controls */}
        <div className="tx-hero-topbar">
          <div className="tx-hero-tags">
            <span className="tx-badge-glass">
              <Zap size={13} className="tx-text-primary" />
              <span>Digital Activity Intelligence</span>
            </span>
            <span className="tx-badge-glass tx-date-badge">
              {formattedDate} • <span className="tx-clock-time">{formattedClock}</span>
            </span>
          </div>

          <div className="tx-hero-controls">
            {/* Extension Status Badge */}
            <div
              className={`tx-status-pill ${hasRecentActivity ? 'tx-status-online' : 'tx-status-waiting'}`}
              title={
                hasRecentActivity
                  ? 'Extension Connected & Recording Active'
                  : 'Extension Idle or Waiting for browser activity'
              }
            >
              <span className="tx-status-dot" />
              <span>{hasRecentActivity ? 'Tracking Active' : 'Waiting for browser activity'}</span>
            </div>

            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              className={`tx-icon-btn ${loading ? 'tx-rotating' : ''}`}
              title="Refresh Activity Data"
              disabled={loading}
            >
              <RefreshCw size={15} />
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={onToggleTheme}
              className="tx-icon-btn"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>

        {/* Center: Greeting & Subtitle */}
        <div className="tx-hero-heading-group">
          <h1 className="tx-hero-title">
            {greeting}, Krishna <span className="tx-wave-emoji">👋</span>
          </h1>
          <p className="tx-hero-subtitle">
            Here's what your digital day looked like.
          </p>
        </div>

        {/* Bottom bar: Search & Quick stats summary */}
        <div className="tx-hero-searchbar-container">
          <div className="tx-search-input-wrapper">
            <Search size={16} className="tx-search-icon" />
            <input
              type="text"
              placeholder="Search observed activity, domains, resources..."
              value={searchQuery}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              className="tx-hero-search-input"
            />
            <span className="tx-search-shortcut">⌘K</span>
          </div>

          <div className="tx-hero-privacy-flag" title="100% Local Telemetry on your own server">
            <ShieldCheck size={14} color="#10b981" />
            <span>Local & Privacy First</span>
          </div>
        </div>
      </div>
    </div>
  );
}
