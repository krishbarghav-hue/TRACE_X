import React from 'react';
import {
  Activity,
  ShieldCheck,
  Zap,
  Clock,
  Compass,
  ArrowRight,
  Download,
  Lock,
  EyeOff,
  Database,
  Layers,
  ChevronRight,
  CheckCircle2,
  Sparkles,
  Radio,
} from 'lucide-react';

export default function Landing({ onNavigate }) {
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="tx-landing-page">
      {/* ── Top Navigation Bar ───────────────────────────────────────── */}
      <header className="tx-landing-nav">
        <div className="tx-landing-nav-container">
          <div className="tx-landing-brand" onClick={() => onNavigate('/')}>
            <div className="tx-logo-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 4C9 1 3 3 2 9C1 15 7 19 12 21C17 19 23 15 22 9C21 3 15 1 12 4Z"
                  fill="url(#landing-logo-grad)"
                />
                <path
                  d="M12 6C10 3 6 4 5 8C4 12 8 16 12 18C16 16 20 12 19 8C18 4 14 3 12 6Z"
                  fill="#070b14"
                  opacity="0.35"
                />
                <defs>
                  <linearGradient id="landing-logo-grad" x1="2" y1="2" x2="22" y2="22">
                    <stop stopColor="#a855f7" />
                    <stop offset="0.5" stopColor="#6366f1" />
                    <stop offset="1" stopColor="#0ea5e9" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="tx-landing-brand-text">TraceX</span>
          </div>

          <nav className="tx-landing-links">
            <button onClick={() => scrollTo('what-it-does')} className="tx-landing-link">
              Features
            </button>
            <button onClick={() => scrollTo('how-it-works')} className="tx-landing-link">
              How It Works
            </button>
            <button onClick={() => scrollTo('timeline-preview')} className="tx-landing-link">
              Timeline
            </button>
            <button onClick={() => scrollTo('privacy')} className="tx-landing-link">
              Privacy
            </button>
            <button onClick={() => scrollTo('extension')} className="tx-landing-link">
              Extension
            </button>
          </nav>

          <div className="tx-landing-nav-actions">
            <button onClick={() => onNavigate('/login')} className="tx-btn-ghost">
              Sign In
            </button>
            <button onClick={() => onNavigate('/signup')} className="tx-btn-primary tx-btn-glow">
              <span>Get Started</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero Section ─────────────────────────────────────────────── */}
      <section className="tx-landing-hero">
        <div className="tx-landing-hero-bg">
          <img
            src="/mountain_hero_panorama.jpg"
            alt="Twilight Mountains"
            className="tx-landing-hero-img"
          />
          <div className="tx-landing-hero-overlay" />
        </div>

        <div className="tx-landing-hero-content">
          <div className="tx-landing-badge">
            <span className="tx-badge-pulse" />
            <Zap size={13} className="tx-badge-icon" />
            <span>Digital Activity & Learning Intelligence</span>
          </div>

          <h1 className="tx-landing-title">
            Understand your <span className="tx-title-gradient">digital day.</span>
          </h1>

          <p className="tx-landing-subtitle">
            See what you actually do across the web — through a private activity timeline.
            Zero manual tracking, 100% local, built for deep focus and learning clarity.
          </p>

          <div className="tx-landing-cta-group">
            <button
              onClick={() => onNavigate('/signup')}
              className="tx-btn-primary tx-btn-xl tx-btn-glow"
            >
              <span>Get Started Free</span>
              <ArrowRight size={18} />
            </button>
            <button
              onClick={() => scrollTo('how-it-works')}
              className="tx-btn-secondary tx-btn-xl"
            >
              <span>See How It Works</span>
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Hero Visual Preview Card */}
          <div className="tx-hero-mockup-card">
            <div className="tx-mockup-header">
              <div className="tx-mockup-dots">
                <span className="tx-dot-red" />
                <span className="tx-dot-yellow" />
                <span className="tx-dot-green" />
              </div>
              <div className="tx-mockup-url-bar">
                <span>tracex.local/today</span>
              </div>
              <div className="tx-mockup-status">
                <span className="tx-dot-pulse" />
                <span>Tracking Active</span>
              </div>
            </div>

            <div className="tx-mockup-body">
              <div className="tx-mockup-metric-grid">
                <div className="tx-mockup-stat">
                  <span className="tx-stat-lbl">Active Time</span>
                  <span className="tx-stat-num" style={{ color: '#0ea5e9' }}>6h 42m</span>
                </div>
                <div className="tx-mockup-stat">
                  <span className="tx-stat-lbl">Activities</span>
                  <span className="tx-stat-num" style={{ color: '#6366f1' }}>147</span>
                </div>
                <div className="tx-mockup-stat">
                  <span className="tx-stat-lbl">Resources</span>
                  <span className="tx-stat-num" style={{ color: '#10b981' }}>38</span>
                </div>
                <div className="tx-mockup-stat">
                  <span className="tx-stat-lbl">Websites</span>
                  <span className="tx-stat-num" style={{ color: '#f59e0b' }}>9</span>
                </div>
              </div>

              {/* Sample timeline stream row inside mockup */}
              <div className="tx-mockup-stream-snippet">
                <div className="tx-stream-chip">
                  <span className="tx-chip-time">09:00</span>
                  <span className="tx-chip-site">YouTube</span>
                  <span className="tx-chip-sub">CFG to PDA Conversion</span>
                  <span className="tx-chip-dur">22m</span>
                </div>
                <div className="tx-stream-chip">
                  <span className="tx-chip-time">09:22</span>
                  <span className="tx-chip-site">ChatGPT</span>
                  <span className="tx-chip-sub">SQL Query Discussion</span>
                  <span className="tx-chip-dur">18m</span>
                </div>
                <div className="tx-stream-chip">
                  <span className="tx-chip-time">09:40</span>
                  <span className="tx-chip-site">LeetCode</span>
                  <span className="tx-chip-sub">Array Problems</span>
                  <span className="tx-chip-dur">31m</span>
                </div>
                <div className="tx-stream-chip">
                  <span className="tx-chip-time">10:11</span>
                  <span className="tx-chip-site">GitHub</span>
                  <span className="tx-chip-sub">TraceX Project</span>
                  <span className="tx-chip-dur">42m</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 1: What TraceX Does ──────────────────────────────── */}
      <section id="what-it-does" className="tx-landing-section">
        <div className="tx-section-header">
          <span className="tx-section-tag">Core Capabilities</span>
          <h2 className="tx-section-title">What TraceX does for your digital day</h2>
          <p className="tx-section-desc">
            Passive digital observation that gives you clarity without adding another task to your to-do list.
          </p>
        </div>

        <div className="tx-feature-cards-grid">
          <div className="tx-feature-card">
            <div className="tx-feature-icon-box" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
              <Activity size={24} />
            </div>
            <h3>Passive Telemetry</h3>
            <p>
              Records active domain visits, titles, and real dwell time automatically as you browse in Chrome.
              Never asks you to start or stop a timer manually.
            </p>
          </div>

          <div className="tx-feature-card">
            <div className="tx-feature-icon-box" style={{ background: 'rgba(14,165,233,0.15)', color: '#38bdf8' }}>
              <Clock size={24} />
            </div>
            <h3>Chronological Timeline</h3>
            <p>
              Reconstructs your day from morning to evening. Review exactly what you researched,
              read, coded, and watched in true temporal sequence.
            </p>
          </div>

          <div className="tx-feature-card">
            <div className="tx-feature-icon-box" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
              <Compass size={24} />
            </div>
            <h3>Time Distribution</h3>
            <p>
              Directly observes domain distribution (YouTube, ChatGPT, GitHub, LeetCode)
              with beautiful ring charts and precise duration metrics.
            </p>
          </div>

          <div className="tx-feature-card">
            <div className="tx-feature-icon-box" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>
              <Sparkles size={24} />
            </div>
            <h3>Derived Activity Focus</h3>
            <p>
              Groups browsing sessions into derived focus areas (Programming, Research, Documentation)
              transparently marked as derived from recorded facts.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 2: How It Works ──────────────────────────────────── */}
      <section id="how-it-works" className="tx-landing-section tx-section-alt">
        <div className="tx-section-header">
          <span className="tx-section-tag">Architecture</span>
          <h2 className="tx-section-title">How TraceX operates</h2>
          <p className="tx-section-desc">
            A clean 3-tier system running privately on your own computer.
          </p>
        </div>

        <div className="tx-steps-grid">
          <div className="tx-step-card">
            <div className="tx-step-number">01</div>
            <div className="tx-step-content">
              <h3>Chromium Extension</h3>
              <p>
                A Manifest V3 service worker runs silently in Google Chrome. It tracks active tab changes,
                window focus, and idle states with millisecond precision.
              </p>
              <div className="tx-step-badge">Manifest V3</div>
            </div>
          </div>

          <div className="tx-step-card">
            <div className="tx-step-number">02</div>
            <div className="tx-step-content">
              <h3>FastAPI & MySQL Local Backend</h3>
              <p>
                Telemetries are sent over HTTPS/REST to your local FastAPI server. Idempotent event deduplication
                and offline buffering ensure zero data loss even when disconnected.
              </p>
              <div className="tx-step-badge">Local Port 8000</div>
            </div>
          </div>

          <div className="tx-step-card">
            <div className="tx-step-number">03</div>
            <div className="tx-step-content">
              <h3>Interactive Intelligence</h3>
              <p>
                The React dashboard renders live activity, hourly heatmaps, timeline flows,
                and resource rankings from your own database with zero 3rd-party tracking.
              </p>
              <div className="tx-step-badge">TraceX React Dashboard</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: Activity Timeline Preview ─────────────────────── */}
      <section id="timeline-preview" className="tx-landing-section">
        <div className="tx-section-header">
          <span className="tx-section-tag">Visual Demonstration</span>
          <h2 className="tx-section-title">Your day, sequenced automatically</h2>
          <p className="tx-section-desc">
            Never wonder where your hours went. Here is an example of what your personal timeline looks like.
          </p>
        </div>

        <div className="tx-timeline-sample-container">
          <div className="tx-sample-timeline">
            <div className="tx-sample-item">
              <div className="tx-sample-time">09:00</div>
              <div className="tx-sample-dot tx-dot-yt" />
              <div className="tx-sample-card">
                <div className="tx-sample-card-head">
                  <span className="tx-sample-site">YouTube</span>
                  <span className="tx-sample-dur">22m</span>
                </div>
                <div className="tx-sample-title">CFG to PDA Conversion — Formal Languages</div>
                <div className="tx-sample-cat">Video Learning</div>
              </div>
            </div>

            <div className="tx-sample-item">
              <div className="tx-sample-time">09:22</div>
              <div className="tx-sample-dot tx-dot-gpt" />
              <div className="tx-sample-card">
                <div className="tx-sample-card-head">
                  <span className="tx-sample-site">ChatGPT</span>
                  <span className="tx-sample-dur">18m</span>
                </div>
                <div className="tx-sample-title">DBMS Trigger Discussion & Index Tuning</div>
                <div className="tx-sample-cat">Research & Queries</div>
              </div>
            </div>

            <div className="tx-sample-item">
              <div className="tx-sample-time">09:40</div>
              <div className="tx-sample-dot tx-dot-leet" />
              <div className="tx-sample-card">
                <div className="tx-sample-card-head">
                  <span className="tx-sample-site">LeetCode</span>
                  <span className="tx-sample-dur">31m</span>
                </div>
                <div className="tx-sample-title">Two Sum & Subarray Sum Equals K Problems</div>
                <div className="tx-sample-cat">Coding Practice</div>
              </div>
            </div>

            <div className="tx-sample-item">
              <div className="tx-sample-time">10:11</div>
              <div className="tx-sample-dot tx-dot-gh" />
              <div className="tx-sample-card">
                <div className="tx-sample-card-head">
                  <span className="tx-sample-site">GitHub</span>
                  <span className="tx-sample-dur">42m</span>
                </div>
                <div className="tx-sample-title">TraceX Repository — Feature Branch Commits</div>
                <div className="tx-sample-cat">Development</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 4: Privacy Guarantee ─────────────────────────────── */}
      <section id="privacy" className="tx-landing-section tx-section-alt">
        <div className="tx-section-header">
          <span className="tx-section-tag">Privacy & Security</span>
          <h2 className="tx-section-title">Designed with zero compromises on privacy</h2>
          <p className="tx-section-desc">
            We believe productivity software should respect personal privacy above everything else.
          </p>
        </div>

        <div className="tx-privacy-grid">
          <div className="tx-privacy-card">
            <div className="tx-privacy-icon"><CheckCircle2 size={24} color="#10b981" /></div>
            <h3>What TraceX Records</h3>
            <ul>
              <li>Browser URL and top-level domain</li>
              <li>Webpage title</li>
              <li>Visit timestamp & exit timestamp</li>
              <li>Active dwell duration in seconds</li>
            </ul>
          </div>

          <div className="tx-privacy-card">
            <div className="tx-privacy-icon"><EyeOff size={24} color="#f43f5e" /></div>
            <h3>What TraceX Never Records</h3>
            <ul>
              <li>Passwords, forms, or credentials</li>
              <li>Keystrokes or typed text</li>
              <li>Screen recordings or screenshots</li>
              <li>Unrelated files on your hard drive</li>
            </ul>
          </div>

          <div className="tx-privacy-card">
            <div className="tx-privacy-icon"><Database size={24} color="#0ea5e9" /></div>
            <h3>100% Local Sovereignty</h3>
            <ul>
              <li>Data lives in your local MySQL database</li>
              <li>Zero analytics sold or uploaded to cloud trackers</li>
              <li>Pause or clear your tracking with one click</li>
              <li>Full schema and code open for inspection</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Section 5: Extension Feature ─────────────────────────────── */}
      <section id="extension" className="tx-landing-section">
        <div className="tx-extension-highlight-card">
          <div className="tx-highlight-left">
            <span className="tx-section-tag">Browser Companion</span>
            <h2>The TraceX Chrome Extension</h2>
            <p>
              Ultra-lightweight Manifest V3 extension. Zero background tab slowdown,
              instant service worker sleep, and offline buffering for intermittent connections.
            </p>
            <div className="tx-highlight-features">
              <div><CheckCircle2 size={16} color="#10b981" /> Idle detection after 60s of inactivity</div>
              <div><CheckCircle2 size={16} color="#10b981" /> Offline buffering queue with automatic retry</div>
              <div><CheckCircle2 size={16} color="#10b981" /> Deduplication protects against duplicate logs</div>
              <div><CheckCircle2 size={16} color="#10b981" /> One-click pause directly from popup or dashboard</div>
            </div>
            <div className="tx-highlight-actions">
              <button onClick={() => onNavigate('/signup')} className="tx-btn-primary tx-btn-glow">
                <Download size={16} />
                <span>Get Extension</span>
              </button>
              <button onClick={() => onNavigate('/privacy')} className="tx-btn-ghost">
                Read Privacy Manifesto
              </button>
            </div>
          </div>

          <div className="tx-highlight-right">
            <div className="tx-extension-popup-mockup">
              <div className="tx-ep-head">
                <div className="tx-ep-logo">TX</div>
                <div className="tx-ep-title">TraceX Companion</div>
                <span className="tx-ep-badge">Connected</span>
              </div>
              <div className="tx-ep-body">
                <div className="tx-ep-row">
                  <span>Tracking Status</span>
                  <span className="tx-ep-status-on">● Active</span>
                </div>
                <div className="tx-ep-domain-box">
                  <div className="tx-ep-active-site">youtube.com</div>
                  <div className="tx-ep-active-time">00:25:36</div>
                </div>
                <div className="tx-ep-btn-row">
                  <button className="tx-ep-btn tx-ep-pause">Pause</button>
                  <button className="tx-ep-btn tx-ep-open">Open Dashboard</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 6: Final CTA ─────────────────────────────────────── */}
      <section className="tx-landing-final-cta">
        <div className="tx-final-cta-card">
          <h2>Ready to understand your digital day?</h2>
          <p>
            Start recording your digital hours with privacy, accuracy, and clarity.
          </p>
          <div className="tx-final-cta-btns">
            <button
              onClick={() => onNavigate('/signup')}
              className="tx-btn-primary tx-btn-xl tx-btn-glow"
            >
              <span>Get Started Now</span>
              <ArrowRight size={18} />
            </button>
            <button
              onClick={() => onNavigate('/login')}
              className="tx-btn-secondary tx-btn-xl"
            >
              <span>Sign In to Existing Account</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="tx-landing-footer">
        <div className="tx-footer-container">
          <div className="tx-footer-left">
            <div className="tx-footer-brand">TraceX</div>
            <p>Student Learning & Digital Activity Intelligence Platform</p>
          </div>
          <div className="tx-footer-right">
            <button onClick={() => onNavigate('/privacy')} className="tx-footer-link">Privacy Policy</button>
            <button onClick={() => onNavigate('/login')} className="tx-footer-link">Login</button>
            <button onClick={() => onNavigate('/signup')} className="tx-footer-link">Sign Up</button>
            <button onClick={() => onNavigate('/today')} className="tx-footer-link">Dashboard</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
