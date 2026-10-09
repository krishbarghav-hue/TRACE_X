import React from 'react';
import { GitBranch, ArrowRight, ExternalLink, Globe, Clock } from 'lucide-react';

function formatDurationMinutes(seconds) {
  if (!seconds || seconds <= 0) return '1m';
  const mins = Math.round(seconds / 60);
  if (mins < 1) return `${seconds}s`;
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  }
  return `${mins}m`;
}

function formatClockTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function getFavicon(domain) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

export default function ActivityTimelinePreview({
  activities = [],
  onViewFullTimeline,
  loading = false,
}) {
  const hasItems = activities && activities.length > 0;

  return (
    <div className="tx-glass-card tx-timeline-preview-card">
      <div className="tx-card-header">
        <div className="tx-card-title-group">
          <div className="tx-icon-accent-box tx-accent-orange">
            <GitBranch size={16} />
          </div>
          <div>
            <h3 className="tx-card-title">Activity Timeline</h3>
            <span className="tx-card-subtitle">
              Chronological sequence of digital sessions
            </span>
          </div>
        </div>

        {onViewFullTimeline && (
          <button
            onClick={onViewFullTimeline}
            className="tx-btn-link"
          >
            <span>View Full Timeline</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>

      <div className="tx-timeline-preview-body">
        {loading ? (
          <div className="tx-loading-stack">
            {[1, 2, 3].map((i) => (
              <div key={i} className="tx-skeleton-row" />
            ))}
          </div>
        ) : !hasItems ? (
          <div className="tx-empty-timeline-preview">
            <GitBranch size={26} className="tx-empty-tl-icon" />
            <p>No timeline events recorded yet today</p>
            <span>Events will form a chronological journey as you navigate the web.</span>
          </div>
        ) : (
          <div className="tx-timeline-nodes-list">
            {activities.slice(0, 5).map((item, idx) => (
              <div key={item.activity_id || idx} className="tx-tl-node-item">
                {/* Time pill */}
                <div className="tx-tl-node-time">
                  {formatClockTime(item.visit_time || item.created_at)}
                </div>

                {/* Vertical line connecting nodes */}
                <div className="tx-tl-line-wrapper">
                  <div className="tx-tl-dot" />
                  {idx < Math.min(activities.length, 5) - 1 && <div className="tx-tl-connector" />}
                </div>

                {/* Event Card preview */}
                <div className="tx-tl-node-content">
                  <div className="tx-tl-node-header">
                    <img
                      src={getFavicon(item.domain)}
                      alt=""
                      className="tx-tl-node-fav"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    <span className="tx-tl-node-domain">{item.domain}</span>
                    <span className="tx-tl-node-duration">
                      {formatDurationMinutes(item.duration_seconds)}
                    </span>
                  </div>

                  <div className="tx-tl-node-title" title={item.page_title || item.url}>
                    {item.page_title || item.url || 'Active Page'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
