import React from 'react';
import { Radio, ExternalLink, Globe, Clock, Layers } from 'lucide-react';

function formatDurationSeconds(s) {
  if (!s || s <= 0) return '00:00:00';
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  return [
    hrs.toString().padStart(2, '0'),
    mins.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0'),
  ].join(':');
}

function getFavicon(domain) {
  if (!domain) return '';
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function LiveActivityCard({ activities = [], loading = false }) {
  const hasActivities = activities && activities.length > 0;
  const latestActivity = hasActivities ? activities[0] : null;

  return (
    <div className="tx-glass-card tx-live-activity-card">
      <div className="tx-card-header">
        <div className="tx-card-title-group">
          <div className="tx-live-pulse-badge">
            <span className="tx-live-pulse-dot" />
            <Radio size={14} className="tx-live-icon" />
          </div>
          <div>
            <h3 className="tx-card-title">Live Browser Activity</h3>
            <span className="tx-card-subtitle">Real-time passive telemetry stream</span>
          </div>
        </div>

        <div className="tx-header-status-tag">
          {hasActivities ? (
            <span className="tx-stream-active-tag">
              <span className="tx-dot-green" /> Stream Active
            </span>
          ) : (
            <span className="tx-stream-waiting-tag">
              <span className="tx-dot-amber" /> Idle
            </span>
          )}
        </div>
      </div>

      <div className="tx-live-activity-body">
        {loading ? (
          <div className="tx-loading-stack">
            {[1, 2, 3].map((i) => (
              <div key={i} className="tx-skeleton-row" />
            ))}
          </div>
        ) : !hasActivities ? (
          <div className="tx-empty-stream">
            <Globe size={32} className="tx-empty-stream-icon" />
            <h4>Waiting for browser activity</h4>
            <p>
              Open any webpage with the TraceX Chrome extension active to see live streaming events here.
            </p>
          </div>
        ) : (
          <div className="tx-live-list">
            {activities.slice(0, 6).map((item, index) => {
              const isFirst = index === 0;
              return (
                <div
                  key={item.activity_id || item.event_id || `${item.url}-${index}`}
                  className={`tx-live-item ${isFirst ? 'tx-live-item-current' : ''}`}
                >
                  {/* Favicon / App Icon */}
                  <div className="tx-live-icon-container">
                    <img
                      src={getFavicon(item.domain)}
                      alt=""
                      className="tx-live-favicon"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div className="tx-live-fallback-icon" style={{ display: 'none' }}>
                      <Globe size={16} />
                    </div>
                    {isFirst && <span className="tx-live-active-indicator" />}
                  </div>

                  {/* Title & Domain */}
                  <div className="tx-live-content-col">
                    <div className="tx-live-item-top">
                      <span className="tx-live-domain-badge">{item.domain}</span>
                      <span className="tx-live-timestamp">
                        {formatRelativeTime(item.visit_time || item.created_at)}
                      </span>
                    </div>
                    <div className="tx-live-page-title" title={item.page_title || item.url}>
                      {item.page_title || item.url || 'Active Page'}
                    </div>
                  </div>

                  {/* Duration Column */}
                  <div className="tx-live-duration-col">
                    <div className="tx-live-duration-label">
                      <Clock size={11} />
                      <span>{formatDurationSeconds(item.duration_seconds)}</span>
                    </div>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="tx-live-link"
                        title="Open URL"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
