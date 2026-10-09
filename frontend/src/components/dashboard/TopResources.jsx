import React from 'react';
import { Globe, ArrowUpRight } from 'lucide-react';

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function getFavicon(domain) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

export default function TopResources({ topDomains = [], loading = false }) {
  const hasDomains = topDomains && topDomains.length > 0;
  const maxSeconds = hasDomains ? Math.max(...topDomains.map((d) => d.total_seconds || 0), 1) : 1;

  return (
    <div className="tx-glass-card tx-top-resources-card">
      <div className="tx-card-header">
        <div className="tx-card-title-group">
          <div className="tx-icon-accent-box tx-accent-green">
            <Globe size={16} />
          </div>
          <div>
            <h3 className="tx-card-title">Top Resources Today</h3>
            <span className="tx-card-subtitle">
              Most visited websites & documentation hubs
            </span>
          </div>
        </div>

        <span className="tx-header-count-badge">
          {topDomains.length} Domains
        </span>
      </div>

      <div className="tx-top-resources-body">
        {loading ? (
          <div className="tx-loading-stack">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="tx-skeleton-row" />
            ))}
          </div>
        ) : !hasDomains ? (
          <div className="tx-empty-resources">
            <Globe size={26} className="tx-empty-res-icon" />
            <p>No resources visited today</p>
            <span>Websites visited through Chrome will be listed here with cumulative times.</span>
          </div>
        ) : (
          <div className="tx-resources-list">
            {topDomains.slice(0, 6).map((item, index) => {
              const seconds = item.total_seconds || 0;
              const fillPct = Math.max(8, (seconds / maxSeconds) * 100);

              return (
                <div key={item.domain} className="tx-res-row">
                  <span className="tx-res-rank">#{index + 1}</span>

                  <div className="tx-res-avatar-wrap">
                    <img
                      src={getFavicon(item.domain)}
                      alt=""
                      className="tx-res-favicon"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div className="tx-res-fallback" style={{ display: 'none' }}>
                      <Globe size={14} />
                    </div>
                  </div>

                  <div className="tx-res-details">
                    <div className="tx-res-name-row">
                      <span className="tx-res-domain-title">{item.domain}</span>
                      <span className="tx-res-duration">{formatDuration(seconds)}</span>
                    </div>

                    <div className="tx-res-bar-container">
                      <div
                        className="tx-res-bar-fill"
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                  </div>

                  <span className="tx-res-visits-badge">
                    {item.visits} {item.visits === 1 ? 'visit' : 'visits'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
